#!/usr/bin/env node
/**
 * Audit tasdiqlash: favorites sync, offline local saqlanish, vote 429 (prod limit).
 * Exit survey cooldown — sof logic tekshiruvi.
 */
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const requireBackend = createRequire(join(root, 'backend/package.json'));
const API = process.env.API_BASE || 'http://127.0.0.1:5000';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function api(path, { method = 'GET', headers = {}, body, anon } = {}) {
  const h = {
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(anon ? { 'X-Anonymous-Id': anon } : {}),
    ...headers,
  };
  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

/** Test 2: guest local items → register → sync → GET favorites */
async function testFavoritesSync() {
  console.log('\n=== TEST 2: favorites sync (guest → register) ===');
  const anon = randomUUID();
  const email = `fav-smoke-${Date.now()}@example.com`;
  const password = 'TestPass123!';

  const search = await api('/api/tusindirme/search?q=kitap&limit=8', { anon });
  assert(search.status === 200, `search HTTP ${search.status}`);
  const words = (search.data?.data || search.data?.results || search.data?.items || [])
    .filter((w) => w?.id && w?.soz)
    .slice(0, 4);
  // fallback: list endpoint
  let items = words.map((w) => ({
    id: String(w.id),
    soz: String(w.soz),
    birinshi_aniqlama: w.birinshi_aniqlama || null,
    category: w.category || null,
    savedAt: Date.now(),
  }));
  if (items.length < 3) {
    const list = await api('/api/tusindirme?limit=6', { anon });
    const rows = list.data?.data || list.data?.items || [];
    items = rows
      .filter((w) => w?.id && w?.soz)
      .slice(0, 4)
      .map((w) => ({
        id: String(w.id),
        soz: String(w.soz),
        birinshi_aniqlama: w.birinshi_aniqlama || null,
        category: w.category || null,
        savedAt: Date.now(),
      }));
  }
  assert(items.length >= 3, `need ≥3 words, got ${items.length}`);
  console.log(`  guest favorites: ${items.map((x) => x.soz).join(', ')}`);

  const reg = await api('/api/auth/register', {
    method: 'POST',
    anon,
    body: { email, password, name: 'Fav Smoke' },
  });
  // ba'zi muhitlarda register yo‘li boshqacha
  let token = reg.data?.token;
  if (!token) {
    const login = await api('/api/auth/login', {
      method: 'POST',
      anon,
      body: { email, password },
    });
    token = login.data?.token;
    assert(token, `register/login failed: ${JSON.stringify(reg.data)} / ${JSON.stringify(login.data)}`);
  }

  const sync = await api('/api/favorites/sync', {
    method: 'POST',
    anon,
    headers: { Authorization: `Bearer ${token}` },
    body: { items },
  });
  assert(sync.status === 200, `sync HTTP ${sync.status} ${JSON.stringify(sync.data)}`);
  const syncedIds = new Set((sync.data?.items || []).map((x) => String(x.id)));
  for (const it of items) {
    assert(syncedIds.has(String(it.id)), `missing after sync: ${it.soz} (${it.id})`);
  }

  const get = await api('/api/favorites/', {
    anon,
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(get.status === 200, `GET favorites HTTP ${get.status}`);
  const gotIds = new Set((get.data?.items || []).map((x) => String(x.id)));
  for (const it of items) {
    assert(gotIds.has(String(it.id)), `missing on GET /favorites: ${it.soz}`);
  }
  console.log(`  PASS — ${items.length} so‘z sync + GET da ko‘rinadi`);
}

/** Offline edge: sync fail → local saqlanadi (FE pattern unit) */
async function testFavoritesOfflinePattern() {
  console.log('\n=== EDGE: sync fail localStorage tozalanmasligi ===');
  // FE AuthContext: faqat data.items array bo‘lsa yozadi; catch da hech narsa o‘chirmaydi
  const FAV_KEY = 'dictionary:favorites:v1';
  const store = new Map();
  const localItems = [
    { id: 'a', soz: 'bir' },
    { id: 'b', soz: 'eki' },
  ];
  store.set(FAV_KEY, JSON.stringify(localItems));

  async function loginSuccessSync(syncFn) {
    let local = [];
    try {
      const raw = JSON.parse(store.get(FAV_KEY) || '[]');
      if (Array.isArray(raw)) local = raw;
    } catch {
      /* ignore */
    }
    try {
      const data = local.length ? await syncFn(local) : { items: [] };
      if (Array.isArray(data?.items)) {
        store.set(FAV_KEY, JSON.stringify(data.items.slice(0, 200)));
      }
    } catch {
      /* offline — local qoladi */
    }
  }

  await loginSuccessSync(async () => {
    throw new Error('network down');
  });
  const afterFail = JSON.parse(store.get(FAV_KEY));
  assert(afterFail.length === 2, 'fail: local wiped');
  assert(afterFail[0].soz === 'bir', 'fail: content changed');

  await loginSuccessSync(async () => ({ items: [{ id: 'a', soz: 'bir' }, { id: 'c', soz: 'ush' }] }));
  const afterOk = JSON.parse(store.get(FAV_KEY));
  assert(afterOk.length === 2 && afterOk.some((x) => x.id === 'c'), 'ok: server merge not applied');
  console.log('  PASS — xatoda local saqlanadi; 200 dan keyin yangilanadi');
}

/** Test 3: vote 429 — prod limitlari bilan mini server */
async function testVote429() {
  console.log('\n=== TEST 3: vote rate-limit → 429 ===');
  process.env.NODE_ENV = 'production';
  const express = requireBackend('express');
  const { voteLimiter, actorWriteLimiter } = await import(
    join(root, 'backend/src/middleware/security.js')
  );

  const app = express();
  app.use(express.json());
  app.post(
    '/suggestions/:id/vote',
    (req, _res, next) => {
      // actorOrIpKey X-Anonymous-Id o‘qiydi
      next();
    },
    voteLimiter,
    actorWriteLimiter,
    (_req, res) => res.json({ success: true })
  );

  const server = createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const anon = randomUUID();
  const statuses = [];
  for (let i = 0; i < 45; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/suggestions/1/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Anonymous-Id': anon,
        'X-Forwarded-For': '203.0.113.50',
      },
      body: JSON.stringify({ vote: 'up' }),
    });
    statuses.push(res.status);
    if (res.status === 429) break;
  }
  server.close();

  const first429 = statuses.indexOf(429);
  const okCount = statuses.filter((s) => s === 200).length;
  console.log(`  responses: ${statuses.join(',')} (first 429 at #${first429 + 1}, ok=${okCount})`);
  assert(first429 >= 0, '429 hech qachon chiqmadi (prod actorWrite max=40)');
  // actorWriteLimiter prod: 40/soat — 20-30 yetmasligi mumkin; 41-da 429
  assert(first429 + 1 <= 41, `429 juda kech: ${first429 + 1}`);
  console.log(`  PASS — 429 chiqdi (chegara ~${first429 + 1}-urinish; prod actorWrite=40/h)`);
  if (first429 + 1 > 30) {
    console.log(
      '  NOTE: 20–30 urinishda hali 429 bo‘lmasligi normal — limit 40/soat (actorWrite) + 80/15daq (vote).'
    );
  }
}

/** Test 4: exit survey 7 kun cooldown */
function testExitCooldown() {
  console.log('\n=== TEST 4: exit survey 7-day cooldown ===');
  const SESSION_KEY = 'app:exit_survey_done';
  const COOLDOWN_KEY = 'app:exit_survey_cooldown_until';
  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  const store = { session: new Map(), local: new Map() };

  function isCoolingDown() {
    if (store.session.get(SESSION_KEY)) return true;
    const until = Number(store.local.get(COOLDOWN_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  }
  function markSurveyConsumed() {
    store.session.set(SESSION_KEY, '1');
    store.local.set(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS));
  }
  function tryOpen() {
    if (isCoolingDown()) return false;
    return true;
  }

  assert(tryOpen() === true, 'first open allowed');
  markSurveyConsumed();
  assert(tryOpen() === false, 'same session blocked');
  store.session.clear(); // yangi sessiya (brauzer qayta ochildi)
  assert(tryOpen() === false, 'within 7d still blocked');
  store.local.set(COOLDOWN_KEY, String(Date.now() - 1000)); // muddati o‘tgan
  assert(tryOpen() === true, 'after 7d allowed again');
  console.log('  PASS — 7 kun ichida ikkinchi marta ochilmaydi');
}

async function main() {
  testExitCooldown();
  await testFavoritesOfflinePattern();
  await testFavoritesSync();
  await testVote429();
  console.log('\n=== ALL SMOKE CHECKS PASSED ===');
}

main().catch((e) => {
  console.error('\nFAIL:', e.message);
  process.exit(1);
});
