/**
 * Ops smoke: EXPLAIN, device token register/unregister, privacy wipe.
 * Usage: node scripts/validate-ops-smoke.mjs
 */
import crypto from 'crypto';
import { pools, DB } from '../src/config/db.js';
import { ensureActor, deleteActorData } from '../src/services/actorService.js';
import { hashAnonymousId } from '../src/utils/actorHash.js';
import {
  ensureDeviceTokensSchema,
  registerDeviceToken,
  unregisterDeviceToken,
} from '../src/services/deviceTokenService.js';

const results = [];

function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`✅ ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.error(`❌ ${id}: ${detail}`);
}

// --- 2 EXPLAIN ---
try {
  const [rows] = await pools.tusindirme.query(
    `EXPLAIN SELECT id, soz FROM titles WHERE status = 1 AND soz LIKE 'kitap%' LIMIT 20`
  );
  const plan = rows[0] || {};
  const type = String(plan.type || '').toLowerCase();
  const key = plan.key || plan.possible_keys || '';
  const detail = `type=${plan.type} key=${key} rows=${plan.rows}`;
  if (type === 'all') fail('2-EXPLAIN', `${detail} (FULL SCAN)`);
  else pass('2-EXPLAIN', detail);
} catch (e) {
  fail('2-EXPLAIN', e.message);
}

// --- 6 register → unregister ---
const uuid = crypto.randomUUID();
const actorKey = hashAnonymousId(uuid);
let actor;
try {
  actor = await ensureActor(actorKey);
  const token = `smoke-fcm-${crypto.randomBytes(24).toString('hex')}`;
  await ensureDeviceTokensSchema();
  await registerDeviceToken({
    actorId: actor.id,
    token,
    platform: 'fcm',
    appVersion: 'smoke-1',
  });
  const [[row]] = await pools.users.query(
    `SELECT id FROM ${DB.users}.device_tokens WHERE token = ? LIMIT 1`,
    [token]
  );
  if (!row) throw new Error('token not inserted');
  const un = await unregisterDeviceToken(token);
  const [[gone]] = await pools.users.query(
    `SELECT id FROM ${DB.users}.device_tokens WHERE token = ? LIMIT 1`,
    [token]
  );
  if (!un.removed || gone) throw new Error('unregister failed');
  pass('6-register-unregister', `actor=${actor.id} token lifecycle ok`);

  // --- 4 privacy wipe ---
  const token2 = `smoke-priv-${crypto.randomBytes(24).toString('hex')}`;
  await registerDeviceToken({
    actorId: actor.id,
    token: token2,
    platform: 'apns',
  });
  await deleteActorData(actor.id);
  const [[orphan]] = await pools.users.query(
    `SELECT id FROM ${DB.users}.device_tokens WHERE actor_id = ? OR token = ? LIMIT 1`,
    [actor.id, token2]
  );
  if (orphan) fail('4-privacy-me', `orphan token row id=${orphan.id}`);
  else pass('4-privacy-me', 'device_tokens cleared with deleteActorData');
} catch (e) {
  fail('4/6-tokens', e.message);
}

// --- health shape (if server up) ---
try {
  const r = await fetch('http://127.0.0.1:5000/api/health');
  const body = await r.json();
  const hasOk = JSON.stringify(body).includes('"status":"ok"') || body.status === 'ok';
  const hasDegraded = body.status === 'degraded';
  pass(
    '3-health-shape',
    `HTTP ${r.status} status=${body.status} keywordOk=${hasOk} degraded=${hasDegraded}`
  );
} catch {
  fail('3-health-shape', 'API :5000 ishlamayapti — keyword monitorni VPS da tekshiring');
}

console.log('\n--- summary ---');
const failed = results.filter((r) => !r.ok);
console.log(`${results.filter((r) => r.ok).length}/${results.length} pass`);
process.exit(failed.length ? 1 : 0);
