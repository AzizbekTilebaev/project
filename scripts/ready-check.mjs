#!/usr/bin/env node
/**
 * Loyiha «foydalanishga tayyorlik» tekshiruvi (lokal).
 * Ishlatish: node scripts/ready-check.mjs
 * yoki: npm run ready
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => console.log(`  ❌ ${m}`);
const warn = (m) => console.log(`  ⚠️  ${m}`);

let fails = 0;

console.log('\nQaraqalpaq platforma — ready check\n');

// 1) packages
for (const dir of ['backend/node_modules', 'frontend/node_modules']) {
  if (fs.existsSync(path.join(root, dir))) ok(`${dir} bor`);
  else {
    bad(`${dir} yo‘q — npm run install:all`);
    fails += 1;
  }
}

// 2) env
const envPath = path.join(root, 'backend/.env');
if (!fs.existsSync(envPath)) {
  bad('backend/.env yo‘q — cp backend/.env.example backend/.env');
  fails += 1;
} else {
  ok('backend/.env bor');
  const env = fs.readFileSync(envPath, 'utf8');
  const need = ['DB_USER', 'JWT_SECRET', 'ACTOR_HMAC_SECRET'];
  for (const k of need) {
    const m = env.match(new RegExp(`^${k}=(.+)$`, 'm'));
    const v = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
    if (!v) {
      bad(`${k} bo‘sh`);
      fails += 1;
    } else if (v.length < 8 && k !== 'DB_USER') {
      warn(`${k} juda qisqa`);
    } else ok(`${k} to‘ldirilgan`);
  }
}

// 3) content MD
for (const f of [
  'fordata/grammar/1-4-klass-tolıq-qoidalar.md',
  'fordata/english/english-tolıq.md',
]) {
  if (fs.existsSync(path.join(root, f))) ok(`${f}`);
  else {
    bad(`${f} yo‘q`);
    fails += 1;
  }
}

// 4) API health (ixtiyoriy)
const port = process.env.PORT || 5000;
try {
  const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
    signal: AbortSignal.timeout(2500),
  });
  if (res.ok) {
    const j = await res.json().catch(() => ({}));
    ok(`API :${port}/api/health OK`);
    if (j?.databases) {
      const entries = Object.entries(j.databases);
      const down = entries.filter(([, v]) => v !== 'ok' && v !== true);
      if (down.length) {
        warn(`DB muammo: ${down.map(([k]) => k).join(', ')}`);
      } else ok(`DB pool’lar: ${entries.length}`);
    }
  } else {
    warn(`API javob ${res.status} — npm run dev:backend`);
  }
} catch {
  warn(`API :${port} ochilmagan — npm run dev:backend`);
}

console.log('');
if (fails) {
  console.log(`Natija: ${fails} muhim xato. Avval shularni tuzating.\n`);
  process.exit(1);
}
console.log('Natija: asosiy fayllar joyida. Serverlarni yoqing:\n');
console.log('  npm run dev:backend');
console.log('  npm run dev:frontend');
console.log('  brauzer: http://localhost:3000\n');
console.log('Foydalanuvchi: docs/FOYDALANISH.md');
console.log('Roadmap:     docs/ROADMAP.md\n');
