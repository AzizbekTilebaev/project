#!/usr/bin/env node
/**
 * Backup + Restore Drill — asl kk_* / public/uploads NI BUZMAYDI.
 *
 * Izolyatsiya: sim_kk_* bazalar + public/uploads-restore-drill/
 * (Docker :3308 yo‘q bo‘lsa shu yo‘l — tavsiya etilgan xavfsiz default.)
 *
 * Usage:
 *   node scripts/restore-drill.mjs
 *   node scripts/restore-drill.mjs --stamp 2026-08-08T10-29-54
 *   node scripts/restore-drill.mjs --keep   # tozalashni o‘tkazib yuborish
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backend = join(__dirname, '..');
const require = createRequire(join(backend, 'package.json'));
require('dotenv').config({ path: join(backend, '.env') });

const keep = process.argv.includes('--keep');
const stampArg = (() => {
  const i = process.argv.indexOf('--stamp');
  return i >= 0 ? process.argv[i + 1] : null;
})();

const DB_NAMES = [
  'kk_users',
  'kk_poets',
  'kk_poetrys',
  'kk_jumbaqlar',
  'kk_tusindirme',
  'kk_quiz',
  'kk_krasvord',
  'kk_statistika',
  'kk_ai_db',
  'kk_logs',
];

const DRILL_UPLOADS = join(backend, 'public', 'uploads-restore-drill');
const DRILL_PORT = Number(process.env.RESTORE_DRILL_PORT || 5011);
const t0 = Date.now();
const log = [];

function note(msg) {
  console.log(msg);
  log.push(msg);
}

function elapsed() {
  return ((Date.now() - t0) / 1000).toFixed(1);
}

function fail(msg) {
  note(`❌ FAIL (${elapsed()}s): ${msg}`);
  process.exit(1);
}

function mysqlArgs() {
  const args = [
    `-h${process.env.DB_HOST || '127.0.0.1'}`,
    `-P${process.env.DB_PORT || '3306'}`,
    `-u${process.env.DB_USER || 'root'}`,
    '--default-character-set=utf8mb4',
  ];
  if (process.env.DB_PASS) args.push(`-p${process.env.DB_PASS}`);
  return args;
}

async function main() {
  note('=== Restore Drill ===');
  note('Path: sim_kk_* + uploads-restore-drill (asl kk_* / uploads o‘zgarmaydi)');
  note('Docker :3308: bu muhitda o‘rnatilmagan — shu izolyatsiya ishlatiladi.\n');

  // 1) Backup (yangi)
  note('--- 1) Backup ---');
  const bak = spawnSync('npm', ['run', 'backup'], {
    cwd: backend,
    encoding: 'utf8',
    timeout: 600000,
  });
  if (bak.status !== 0) fail(`backup: ${bak.stderr || bak.stdout}`);
  note('✓ npm run backup');

  const backupDir = join(backend, 'backups');
  const sqlAll = readdirSync(backupDir).filter((f) => f.startsWith('kk_') && f.endsWith('.sql'));
  const byStamp = new Map();
  for (const f of sqlAll) {
    const m = f.match(/^(kk_[a-z0-9_]+)-(.+)\.sql$/);
    if (!m) continue;
    const [, db, stamp] = m;
    if (!byStamp.has(stamp)) byStamp.set(stamp, []);
    byStamp.get(stamp).push({ db, file: f });
  }
  const stamp =
    stampArg ||
    [...byStamp.entries()]
      .sort((a, b) => b[1].length - a[1].length || b[0].localeCompare(a[0]))[0]?.[0];
  const group = byStamp.get(stamp);
  if (!group?.length) fail('dump topilmadi');
  if (group.length < 10) {
    note(`⚠️  stamp ${stamp}: ${group.length}/10 dump`);
  }
  const uploadsTar = join(backupDir, `uploads-${stamp}.tar.gz`);
  if (!existsSync(uploadsTar)) fail(`uploads tar yo‘q: uploads-${stamp}.tar.gz`);
  note(`✓ stamp=${stamp} sql=${group.length} uploads=${(statSync(uploadsTar).size / 1024 / 1024).toFixed(1)}MB`);

  // 2) "Yo‘qotish" — faqat sim_* ni tozalash (aslga tegilmaydi)
  note('\n--- 2) Izolyatsiya / yo‘qotish simulyatsiyasi ---');
  const mysql = require('mysql2/promise');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });

  for (const db of DB_NAMES) {
    const sim = `sim_${db}`;
    await conn.query(`DROP DATABASE IF EXISTS \`${sim}\``);
    await conn.query(
      `CREATE DATABASE \`${sim}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  }
  note('✓ sim_kk_* drop+create (10)');

  if (existsSync(DRILL_UPLOADS)) rmSync(DRILL_UPLOADS, { recursive: true, force: true });
  mkdirSync(DRILL_UPLOADS, { recursive: true });
  note('✓ uploads-restore-drill toza papka (asl uploads saqlanadi)');

  // 3) Restore SQL + uploads
  note('\n--- 3) Restore ---');
  for (const { db, file } of group) {
    const simDb = `sim_${db}`;
    let sql = readFileSync(join(backupDir, file), 'utf8');
    sql = sql
      .replace(new RegExp(`\`${db}\``, 'g'), `\`${simDb}\``)
      .replace(new RegExp(`Database: ${db}\\b`, 'g'), `Database: ${simDb}`);
    const r = spawnSync('mysql', mysqlArgs(), {
      input: sql,
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024,
    });
    if (r.status !== 0) fail(`import ${simDb}: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
    note(`  ✓ ${simDb}`);
  }

  const tar = spawnSync(
    'tar',
    ['-xzf', uploadsTar, '-C', join(backend, 'public'), '--transform=s|^uploads|uploads-restore-drill|'],
    { encoding: 'utf8' }
  );
  // GNU tar --transform; fallback: extract then move
  if (tar.status !== 0 || !existsSync(join(DRILL_UPLOADS, 'books')) && !existsSync(join(DRILL_UPLOADS, 'avatars'))) {
    const tmp = join(backend, 'public', `_uploads_extract_${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    const t2 = spawnSync('tar', ['-xzf', uploadsTar, '-C', tmp], { encoding: 'utf8' });
    if (t2.status !== 0) fail(`tar uploads: ${t2.stderr || t2.stdout}`);
    const extracted = join(tmp, 'uploads');
    if (!existsSync(extracted)) fail('tar ichida uploads/ yo‘q');
    rmSync(DRILL_UPLOADS, { recursive: true, force: true });
    spawnSync('mv', [extracted, DRILL_UPLOADS]);
    rmSync(tmp, { recursive: true, force: true });
  }
  note('✓ uploads → public/uploads-restore-drill/');

  // titles sanity
  const [[titles]] = await conn.query(`SELECT COUNT(*) AS c FROM sim_kk_tusindirme.titles`);
  if (Number(titles.c) < 1) fail('sim titles bo‘sh');
  note(`✓ sim titles=${titles.c}`);
  await conn.end();

  // 4) API against sim_* + drill uploads
  note('\n--- 4) Tiklangan holatni sinash ---');
  if (!existsSync(join(backend, '..', 'frontend', 'dist', 'index.html'))) {
    const b = spawnSync('npm', ['run', 'build'], {
      cwd: join(backend, '..', 'frontend'),
      encoding: 'utf8',
      timeout: 180000,
    });
    if (b.status !== 0) fail('frontend build');
  }

  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(DRILL_PORT),
    KK_USERS_DB: 'sim_kk_users',
    KK_POETS_DB: 'sim_kk_poets',
    KK_POETRYS_DB: 'sim_kk_poetrys',
    KK_JUMBAQLAR_DB: 'sim_kk_jumbaqlar',
    KK_TUSINDIRME_DB: 'sim_kk_tusindirme',
    KK_QUIZ_DB: 'sim_kk_quiz',
    KK_KRASVORD_DB: 'sim_kk_krasvord',
    KK_STATISTIKA_DB: 'sim_kk_statistika',
    KK_AI_DB: 'sim_kk_ai_db',
    KK_LOGS_DB: 'sim_kk_logs',
    BOOKS_UPLOAD_DIR: join(DRILL_UPLOADS, 'books'),
    UPLOADS_ROOT: DRILL_UPLOADS,
    DB_NAME: 'sim_kk_tusindirme',
  };

  const child = spawn('node', ['src/server.js'], {
    cwd: backend,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let boot = '';
  child.stdout.on('data', (d) => {
    boot += d;
  });
  child.stderr.on('data', (d) => {
    boot += d;
  });

  try {
    const health = await waitJson(`http://127.0.0.1:${DRILL_PORT}/api/health`, 25000);
    if (health.status !== 'ok') fail(`health=${health.status} ${JSON.stringify(health.checks || {})}`);
    note('✓ GET /api/health status=ok');

    const anon = randomUUID();
    const search = await fetch(
      `http://127.0.0.1:${DRILL_PORT}/api/tusindirme/search?q=kitap&limit=3`,
      { headers: { Accept: 'application/json', 'X-Anonymous-Id': anon } }
    );
    const sdata = await search.json();
    const rows = sdata.data || sdata.results || sdata.items || [];
    if (search.status !== 200 || !rows.length) fail(`search http=${search.status} n=${rows.length}`);
    note(`✓ search q=kitap → ${rows.length} so‘z`);

    // uploads: writers/avatars — public static; books — ataylab 403 (signed URL)
    const publicSample =
      findSampleFile(join(DRILL_UPLOADS, 'writers')) ||
      findSampleFile(join(DRILL_UPLOADS, 'avatars'));
    const bookSample = findSampleFile(join(DRILL_UPLOADS, 'books'));
    if (bookSample) {
      const st = statSync(bookSample);
      note(`✓ books disk OK: ${bookSample.split('/').pop()} (${st.size} bayt)`);
    }
    if (!publicSample) {
      note('⚠️  writers/avatars namuna yo‘q — public HTTP skip');
    } else {
      const st = statSync(publicSample);
      if (st.size < 1) fail(`bo‘sh fayl: ${publicSample}`);
      const sub = publicSample.includes(`${join('uploads-restore-drill', 'writers')}`) ||
        publicSample.includes('/writers/')
        ? 'writers'
        : 'avatars';
      const base = sub === 'writers' ? join(DRILL_UPLOADS, 'writers') : join(DRILL_UPLOADS, 'avatars');
      const name = publicSample.slice(base.length + 1);
      const urlPath = `/uploads/${sub}/${name.split('/').map(encodeURIComponent).join('/')}`;
      const fr = await fetch(`http://127.0.0.1:${DRILL_PORT}${urlPath}`);
      if (!fr.ok) fail(`uploads HTTP ${fr.status} ${urlPath}`);
      note(`✓ HTTP ${fr.status} ${urlPath} (${st.size} bayt)`);
    }

    // users jadvali — backupdagi akkaunt izi
    const mysql2 = require('mysql2/promise');
    const c2 = await mysql2.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
    });
    try {
      const [[{ c }]] = await c2.query(
        `SELECT COUNT(*) AS c FROM information_schema.tables
         WHERE table_schema='sim_kk_users' AND table_name IN ('users','user_accounts','accounts')`
      );
      if (Number(c) > 0) {
        const [[urow]] = await c2.query(
          `SELECT COUNT(*) AS c FROM sim_kk_users.users`
        ).catch(() => [[{ c: null }]]);
        if (urow?.c != null) note(`✓ sim_kk_users.users count=${urow.c}`);
      } else {
        note('ℹ️  users jadval nomi boshqacha — login brauzerda qo‘lda tekshiriladi');
      }
    } finally {
      await c2.end();
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }

  // 5) Cleanup
  note('\n--- 5) Tozalash ---');
  if (!keep) {
    const c3 = await require('mysql2/promise').createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASS || '',
    });
    for (const db of DB_NAMES) {
      await c3.query(`DROP DATABASE IF EXISTS \`sim_${db}\``);
    }
    await c3.end();
    rmSync(DRILL_UPLOADS, { recursive: true, force: true });
    note('✓ sim_* + uploads-restore-drill o‘chirildi');
  } else {
    note('ℹ️  --keep: sim_* va uploads-restore-drill qoldirildi');
  }

  const mins = (Number(elapsed()) / 60).toFixed(2);
  note(`\n=== DoD PASS — ${elapsed()}s (~${mins} daqiqa) ===`);
  note(`STAMP=${stamp}`);

  const reportPath = join(backupDir, `RESTORE-DRILL-${stamp}.md`);
  writeFileSync(
    reportPath,
    [
      `# Restore drill report`,
      ``,
      `- Date: ${new Date().toISOString()}`,
      `- Isolation: sim_kk_* + public/uploads-restore-drill (NOT Docker; asl kk_* untouched)`,
      `- Stamp: ${stamp}`,
      `- Duration: ${elapsed()}s (~${mins} min)`,
      `- Result: PASS`,
      ``,
      '## Log',
      '```',
      ...log,
      '```',
      '',
    ].join('\n')
  );
  note(`Report: ${reportPath}`);
}

function findSampleFile(dir) {
  if (!existsSync(dir)) return null;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (st.isFile() && st.size > 0) return p;
    }
  }
  return null;
}

async function waitJson(url, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const res = await fetch(url);
      return await res.json();
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`timeout ${url}`);
}

main().catch((e) => fail(e.message));
