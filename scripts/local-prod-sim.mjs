#!/usr/bin/env node
/**
 * Lokal production-simulyatsiya (VPS’siz).
 * Usage: node scripts/local-prod-sim.mjs [--skip-backup] [--skip-build]
 *
 * Qadamlar: check:prod-env → CORS* → frontend build → prod API start/restart
 * → backup → restore-drill (alohida sim_* bazalar) → health.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(root, 'backend');
const frontend = join(root, 'frontend');
const requireBackend = createRequire(join(backend, 'package.json'));
const skipBackup = process.argv.includes('--skip-backup');
const skipBuild = process.argv.includes('--skip-build');
const PROD_PORT = Number(process.env.PROD_SIM_PORT || 5010);

const results = [];

function log(step, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  results.push({ step, ok, detail });
  console.log(`\n[${mark}] ${step}${detail ? ` — ${detail}` : ''}`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    encoding: 'utf8',
    env: { ...process.env, ...opts.env },
    stdio: opts.stdio || 'pipe',
    timeout: opts.timeout || 120000,
  });
  return r;
}

function assert(cond, step, detail) {
  if (!cond) {
    log(step, false, detail);
    throw new Error(detail || step);
  }
  log(step, true, detail);
}

async function waitHealth(port, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      const data = await res.json();
      if (data?.status === 'ok' || data?.success) return data;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`health timeout :${port}`);
}

async function main() {
  console.log('=== Lokal production-sim ===\n');

  // 1) check:prod-env
  {
    const r = run('npm', ['run', 'check:prod-env'], { cwd: backend });
    assert(r.status === 0, 'check:prod-env', (r.stdout || r.stderr || '').split('\n').pop());
  }

  // 2) FRONTEND_ORIGIN=* → exit(1)
  {
    const r = run('node', ['src/server.js'], {
      cwd: backend,
      env: { NODE_ENV: 'production', FRONTEND_ORIGIN: '*' },
      timeout: 8000,
    });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    assert(
      r.status === 1 && out.includes('FRONTEND_ORIGIN'),
      'CORS * → exit(1)',
      `status=${r.status}`
    );
  }

  // 3) frontend build (prod API dist talab qiladi)
  if (!skipBuild) {
    const r = run('npm', ['run', 'build'], { cwd: frontend, timeout: 180000 });
    assert(
      r.status === 0 && existsSync(join(frontend, 'dist/index.html')),
      'frontend build',
      'dist/index.html'
    );
  } else {
    assert(existsSync(join(frontend, 'dist/index.html')), 'frontend dist mavjud', 'skip build');
  }

  // 4) Prod API start + restart sim
  let child;
  const startProd = () =>
    spawn('node', ['src/server.js'], {
      cwd: backend,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(PROD_PORT),
        // lokal sim: localhost origin OK (faqat warn)
        TRUST_PROXY: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  child = startProd();
  let bootLog = '';
  child.stdout.on('data', (d) => {
    bootLog += d.toString();
  });
  child.stderr.on('data', (d) => {
    bootLog += d.toString();
  });

  try {
    const health1 = await waitHealth(PROD_PORT);
    assert(true, 'prod start health', `status=${health1.status}`);

    // Restart simulyatsiyasi
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 800));
    child = startProd();
    child.stdout.on('data', (d) => {
      bootLog += d.toString();
    });
    child.stderr.on('data', (d) => {
      bootLog += d.toString();
    });
    const health2 = await waitHealth(PROD_PORT);
    assert(true, 'prod restart health', `status=${health2.status}`);

    // Search smoke (bo‘sh ekran emas)
    const anon = cryptoRandom();
    const search = await fetch(
      `http://127.0.0.1:${PROD_PORT}/api/tusindirme/search?q=kitap&limit=3`,
      { headers: { 'X-Anonymous-Id': anon, Accept: 'application/json' } }
    );
    const sdata = await search.json().catch(() => ({}));
    const rows = sdata.data || sdata.results || sdata.items || [];
    assert(search.status === 200, 'search smoke', `http=${search.status} n=${rows.length}`);
  } finally {
    if (child && !child.killed) child.kill('SIGTERM');
  }

  // 5) Backup
  let stampFiles = [];
  if (!skipBackup) {
    const r = run('npm', ['run', 'backup'], { cwd: backend, timeout: 600000 });
    assert(r.status === 0, 'npm run backup', 'SQL + uploads');
    const backupDir = join(backend, 'backups');
    const latestSql = readdirSync(backupDir).filter(
      (f) => f.startsWith('kk_') && f.endsWith('.sql')
    );
    assert(latestSql.length >= 1, 'backup sql files', `${latestSql.length} dump`);
    stampFiles = latestSql;
  }

  // 6) Restore drill → sim_* bazalar (mavjud kk_* ni buzmaydi)
  if (!skipBackup && stampFiles.length) {
    await restoreDrill(stampFiles);
  } else if (!skipBackup) {
    log('restore-drill', false, 'dump topilmadi');
  }

  // 7) Docker / nginx holati
  const docker = run('bash', ['-lc', 'command -v docker || true']);
  if ((docker.stdout || '').trim()) {
    log('docker', true, 'mavjud — toza MySQL qo‘lda: docs/PRODUCTION-TODO');
  } else {
    log('docker', true, 'SKIP — o‘rnatilmagan; restore-drill sim_* bilan qisman yopildi');
  }
  const nginx = run('bash', ['-lc', 'command -v nginx || true']);
  if ((nginx.stdout || '').trim()) {
    const conf = join(root, 'docs/deploy/nginx.local-test.conf');
    const r = run('nginx', ['-t', '-c', conf]);
    log('nginx -t', r.status === 0, (r.stderr || r.stdout || '').trim().slice(0, 120));
  } else {
    log('nginx -t', true, 'SKIP — nginx CLI yo‘q; conf tayyor (nginx.local-test.conf)');
  }

  console.log('\n=== XULOSA ===');
  const failed = results.filter((x) => !x.ok);
  for (const x of results) {
    console.log(`${x.ok ? '✓' : '✗'} ${x.step}${x.detail ? ` (${x.detail})` : ''}`);
  }
  if (failed.length) {
    process.exit(1);
  }
  console.log('\nVPS’da qoladi: A1 server, A5 domen+Let’s Encrypt, DNS.');
}

function cryptoRandom() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function restoreDrill(sqlFiles) {
  // Eng yangi stamp guruhini topish
  const byStamp = new Map();
  for (const f of sqlFiles) {
    const m = f.match(/^(kk_[a-z0-9_]+)-(.+)\.sql$/);
    if (!m) continue;
    const [, db, stamp] = m;
    if (!byStamp.has(stamp)) byStamp.set(stamp, []);
    byStamp.get(stamp).push({ db, file: f });
  }
  // Eng to‘liq stamp (kamida ko‘proq dump); vaqt bo‘yicha eng yangi orasidan
  const stamp = [...byStamp.entries()]
    .sort((a, b) => b[1].length - a[1].length || b[0].localeCompare(a[0]))[0]?.[0];
  const group = byStamp.get(stamp) || [];
  assert(group.length >= 1, 'restore-drill stamp', `${stamp} (${group.length} db)`);
  if (group.length < 10) {
    console.warn(`⚠️  Bu stampda ${group.length}/10 dump — to‘liq backup qayta oling`);
  }

  const mysql = requireBackend('mysql2/promise');
  // dotenv orqali ulanish — sir chop etilmaydi
  requireBackend('dotenv').config({ path: join(backend, '.env') });
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
  });

  const drillDir = join(backend, 'backups', '_restore_drill');
  mkdirSync(drillDir, { recursive: true });

  try {
    let restored = 0;
    for (const { db, file } of group) {
      const simDb = `sim_${db}`;
      await conn.query(
        `CREATE DATABASE IF NOT EXISTS \`${simDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );
      await conn.query(`DROP DATABASE IF EXISTS \`${simDb}\``);
      await conn.query(
        `CREATE DATABASE \`${simDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
      );

      let sql = readFileSync(join(backend, 'backups', file), 'utf8');
      // --databases dump: USE/`CREATE DATABASE` nomlarini sim_* ga
      sql = sql
        .replace(new RegExp(`\`${db}\``, 'g'), `\`${simDb}\``)
        .replace(new RegExp(`/${db}/`, 'g'), `/${simDb}/`)
        .replace(new RegExp(`Database: ${db}\\b`, 'g'), `Database: ${simDb}`);

      const patched = join(drillDir, `${simDb}.sql`);
      writeFileSync(patched, sql, 'utf8');

      const args = [
        `-h${process.env.DB_HOST || '127.0.0.1'}`,
        `-P${process.env.DB_PORT || '3306'}`,
        `-u${process.env.DB_USER || 'root'}`,
        '--default-character-set=utf8mb4',
      ];
      if (process.env.DB_PASS) args.push(`-p${process.env.DB_PASS}`);

      const r = spawnSync('mysql', args, {
        input: sql,
        encoding: 'utf8',
        maxBuffer: 512 * 1024 * 1024,
      });
      if (r.status !== 0) {
        throw new Error(`restore ${simDb}: ${(r.stderr || r.stdout || '').slice(0, 300)}`);
      }

      const [[{ c }]] = await conn.query(
        `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ?`,
        [simDb]
      );
      if (Number(c) < 1 && db === 'kk_tusindirme') {
        throw new Error(`${simDb} jadvallar bo‘sh`);
      }
      restored += 1;
    }
    assert(true, 'restore-drill sim_*', `${restored} baza tiklandi (stamp ${stamp})`);

    // tusindirme titles soni (agar bor)
    try {
      const [[row]] = await conn.query(
        `SELECT COUNT(*) AS c FROM sim_kk_tusindirme.titles`
      ).catch(() => [[{ c: null }]]);
      if (row?.c != null) {
        assert(Number(row.c) > 0, 'restore titles count', `titles=${row.c}`);
      }
    } catch {
      /* optional */
    }
  } finally {
    await conn.end().catch(() => {});
    // patched SQL katta bo‘lishi mumkin — saqlab qo‘yamiz yoki tozalaymiz
    try {
      rmSync(drillDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error('\nFAIL:', e.message);
  process.exit(1);
});
