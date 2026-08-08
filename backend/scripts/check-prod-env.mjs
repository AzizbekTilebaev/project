#!/usr/bin/env node
/**
 * Production .env tayyorligini tekshiradi (sirlar qiymatini chop etmaydi).
 * Usage: node scripts/check-prod-env.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

const REQUIRED = [
  'JWT_SECRET',
  'ACTOR_HMAC_SECRET',
  'ADMIN_PASSWORD',
  'ADMIN_SESSION_SECRET',
  'FRONTEND_ORIGIN',
];
/** Bo‘sh bo‘lsa runtime `root` (db.js). Productionda aniq user tavsiya. */
const DB_USER_OPTIONAL = true;

const WEAK = new Set([
  '',
  'changeme',
  'secret',
  'admin123',
  'password',
  'your-secret',
  'REPLACE_ME',
]);

function parseEnv(raw) {
  const out = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

if (!existsSync(envPath)) {
  fail(`.env topilmadi (${envPath}). Namuna: cp .env.example .env`);
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, 'utf8'));
let bad = false;

for (const key of REQUIRED) {
  const v = env[key];
  if (v == null || WEAK.has(String(v).trim().toLowerCase()) || String(v).trim().length < 8) {
    fail(`${key} bo‘sh yoki zaif / juda qisqa`);
    bad = true;
  } else if (
    (key.includes('SECRET') || key === 'JWT_SECRET' || key === 'ADMIN_PASSWORD') &&
    String(v).length < 16
  ) {
    fail(`${key} kamida 16 belgi bo‘lishi kerak`);
    bad = true;
  } else {
    ok(`${key} belgilangan (uzunlik ${String(v).length})`);
  }
}

const dbUser = String(env.DB_USER || '').trim();
if (!dbUser) {
  if (DB_USER_OPTIONAL) {
    console.warn('⚠️  DB_USER bo‘sh — runtime default: root. Productionda aniq user yozing.');
  } else {
    fail('DB_USER bo‘sh');
    bad = true;
  }
} else if (WEAK.has(dbUser.toLowerCase()) && dbUser.toLowerCase() !== 'root') {
  fail('DB_USER zaif/namuna');
  bad = true;
} else {
  ok(`DB_USER belgilangan (${dbUser === 'root' ? 'root' : 'custom'})`);
}

const origin = String(env.FRONTEND_ORIGIN || '');
if (origin.includes('*') || /\bnull\b/i.test(origin)) {
  fail('FRONTEND_ORIGIN da * yoki null bo‘lmasin');
  bad = true;
} else if (env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/i.test(origin)) {
  // Lokal prod-sim uchun ogohlantirish; VPS’da haqiqiy domen majburiy
  console.warn('⚠️  FRONTEND_ORIGIN localhost — lokal sim OK; VPS’da https://domen qo‘ying');
  ok('FRONTEND_ORIGIN (local-sim)');
} else {
  ok(`FRONTEND_ORIGIN ok`);
}

const pool = Number(env.DB_POOL_LIMIT || 4);
if (!Number.isFinite(pool) || pool < 1 || pool > 20) {
  fail('DB_POOL_LIMIT 1–20 oralig‘ida bo‘lsin');
  bad = true;
} else {
  ok(`DB_POOL_LIMIT=${pool}`);
}

const writeLimit = Number(env.ACTOR_WRITE_LIMIT || 40);
if (writeLimit !== 40 && env.NODE_ENV === 'production') {
  console.warn(`⚠️  ACTOR_WRITE_LIMIT=${writeLimit} (tavsiya: 40)`);
} else {
  ok(`ACTOR_WRITE_LIMIT default/prod=${writeLimit}`);
}

if (env.NODE_ENV !== 'production') {
  console.warn('⚠️  NODE_ENV production emas — VPS’da NODE_ENV=production qiling');
}

if (bad) {
  console.error('\ncheck-prod-env: FAIL');
  process.exit(1);
}
console.log('\ncheck-prod-env: OK (sirlar chop etilmadi)');
