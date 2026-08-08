#!/usr/bin/env node
/**
 * Lokal MySQL (kk_*) → masofaviy MySQL (Aiven va h.k.).
 *
 * 1) Aiven Console → Download CA → backend/certs/aiven-ca.pem
 * 2) backend/.env.aiven yarating (namuna: .env.aiven.example)
 * 3) cd backend && npm run migrate:aiven
 *
 * Env:
 *   REMOTE_DB_HOST / PORT / USER / PASS  (majburiy)
 *   REMOTE_DB_SSL_CA                     (tavsiya)
 *   SKIP_DUMP=1                          (mavjud backups/*-STAMP.sql dan)
 *   BACKUP_STAMP=2026-08-08T10-51-53     (SKIP_DUMP bilan)
 *   DRY_RUN=1                            (faqat dump + ulanish tekshiruvi)
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ALL_DB_NAMES, SERVER_CONFIG } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const backupsDir = path.join(backendRoot, 'backups');
const migrateDir = path.join(backupsDir, 'migrate-aiven');

dotenv.config({ path: path.join(backendRoot, '.env') });
dotenv.config({ path: path.join(backendRoot, '.env.aiven'), override: true });

const remote = {
  host: process.env.REMOTE_DB_HOST || process.env.AIVEN_DB_HOST || '',
  port: Number(process.env.REMOTE_DB_PORT || process.env.AIVEN_DB_PORT || 0),
  user: process.env.REMOTE_DB_USER || process.env.AIVEN_DB_USER || 'avnadmin',
  password: process.env.REMOTE_DB_PASS || process.env.AIVEN_DB_PASS || '',
  sslCa: process.env.REMOTE_DB_SSL_CA || process.env.DB_SSL_CA || '',
};

const DRY = process.env.DRY_RUN === '1';
const SKIP_DUMP = process.env.SKIP_DUMP === '1';
const stamp =
  process.env.BACKUP_STAMP ||
  new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function die(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    ...opts,
  });
  if (r.error) die(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) {
    die(`${cmd} exit ${r.status}:\n${r.stderr || r.stdout}`);
  }
  return r;
}

function mysqlRemoteArgs() {
  const args = [
    `-h${remote.host}`,
    `-P${remote.port}`,
    `-u${remote.user}`,
    `--default-character-set=utf8mb4`,
    `--ssl-mode=REQUIRED`,
  ];
  if (remote.password) args.push(`-p${remote.password}`);
  if (remote.sslCa && fs.existsSync(remote.sslCa)) {
    args.push(`--ssl-ca=${remote.sslCa}`);
  }
  return args;
}

function sanitizeDump(sql) {
  return sql
    .replace(/DEFINER=`[^`]+`@`[^`]+`/gi, '')
    .replace(/DEFINER='[^']+'@'[^']+'/gi, '')
    .replace(/SQL SECURITY DEFINER/gi, 'SQL SECURITY INVOKER');
}

function dumpLocal(database) {
  fs.mkdirSync(migrateDir, { recursive: true });
  const file = path.join(migrateDir, `${database}-${stamp}.sql`);
  const args = [
    `-h${SERVER_CONFIG.host}`,
    `-P${SERVER_CONFIG.port}`,
    `-u${SERVER_CONFIG.user}`,
    '--default-character-set=utf8mb4',
    '--single-transaction',
    '--routines',
    '--triggers',
    '--set-gtid-purged=OFF',
    '--column-statistics=0',
    '--databases',
    database,
  ];
  if (SERVER_CONFIG.password) args.splice(3, 0, `-p${SERVER_CONFIG.password}`);

  console.log(`📦 Dump lokal: ${database} …`);
  const r = run('mysqldump', args);
  const cleaned = sanitizeDump(r.stdout);
  fs.writeFileSync(file, cleaned, 'utf8');
  console.log(`   → ${file} (${Math.round(cleaned.length / 1024)} KB)`);
  return file;
}

function latestBackup(database) {
  if (process.env.BACKUP_STAMP) {
    const exact = path.join(backupsDir, `${database}-${process.env.BACKUP_STAMP}.sql`);
    if (fs.existsSync(exact)) return exact;
    die(`Backup topilmadi: ${exact}`);
  }
  const files = fs
    .readdirSync(backupsDir)
    .filter((f) => f.startsWith(`${database}-`) && f.endsWith('.sql'))
    .sort();
  if (!files.length) die(`${database} uchun backup yo‘q — avval SKIP_DUMP siz ishga tushiring`);
  return path.join(backupsDir, files[files.length - 1]);
}

function ensureRemoteDbs() {
  const creates = ALL_DB_NAMES.map(
    (db) =>
      `CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  ).join('\n');
  console.log('🗄  Remote: CREATE DATABASE (10× kk_*) …');
  run('mysql', mysqlRemoteArgs(), { input: creates });
}

function restoreRemote(file, database) {
  let sql = fs.readFileSync(file, 'utf8');
  sql = sanitizeDump(sql);
  console.log(`⬆  Restore → ${database} (${Math.round(sql.length / 1024)} KB) …`);
  const t0 = Date.now();
  run('mysql', mysqlRemoteArgs(), { input: sql });
  console.log(`   ✅ ${database} (${Math.round((Date.now() - t0) / 1000)}s)`);
}

function pingRemote() {
  console.log(`🔌 Remote ping: ${remote.user}@${remote.host}:${remote.port}`);
  const r = run('mysql', [...mysqlRemoteArgs(), '-e', 'SELECT 1 AS ok, @@version AS v;']);
  console.log(r.stdout.trim());
}

function main() {
  if (!remote.host || !remote.port || !remote.user || !remote.password) {
    die(
      'REMOTE_DB_HOST / REMOTE_DB_PORT / REMOTE_DB_USER / REMOTE_DB_PASS kerak.\n' +
        '  Namuna: cp .env.aiven.example .env.aiven  # parolni yozing\n' +
        '  Keyin:  npm run migrate:aiven'
    );
  }
  if (remote.sslCa && !fs.existsSync(remote.sslCa)) {
    console.warn(
      `⚠️  CA yo‘q (${remote.sslCa}) — --ssl-mode=REQUIRED bilan davom (tavsiya: Aiven CA yuklang)`
    );
    remote.sslCa = '';
  }

  console.log('Manba (lokal):', `${SERVER_CONFIG.user}@${SERVER_CONFIG.host}:${SERVER_CONFIG.port}`);
  console.log('Nishon (Aiven):', `${remote.user}@${remote.host}:${remote.port}`);
  console.log('Bazalar:', ALL_DB_NAMES.join(', '));
  if (DRY) console.log('DRY_RUN=1 — restore qilinmaydi\n');

  pingRemote();
  if (DRY) {
    console.log('✅ Ulanish OK. Restore uchun DRY_RUN ni olib tashlang.');
    return;
  }

  ensureRemoteDbs();

  for (const db of ALL_DB_NAMES) {
    const file = SKIP_DUMP ? latestBackup(db) : dumpLocal(db);
    if (SKIP_DUMP) {
      const cleaned = path.join(migrateDir, path.basename(file));
      fs.mkdirSync(migrateDir, { recursive: true });
      fs.writeFileSync(cleaned, sanitizeDump(fs.readFileSync(file, 'utf8')));
      restoreRemote(cleaned, db);
    } else {
      restoreRemote(file, db);
    }
  }

  console.log('\n✅ Migratsiya tugadi.');
  console.log('Keyingi qadam — backend/.env ni Aiven ga yo‘naltiring:');
  console.log(`  DB_HOST=${remote.host}`);
  console.log(`  DB_PORT=${remote.port}`);
  console.log(`  DB_USER=${remote.user}`);
  console.log(`  DB_PASS=***`);
  console.log(`  DB_SSL=REQUIRED`);
  if (remote.sslCa) console.log(`  DB_SSL_CA=${remote.sslCa}`);
  console.log('  Keyin: npm run dev  +  curl localhost:5000/api/health');
}

main();
