import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { SERVER_CONFIG, ALL_DB_NAMES } from '../src/config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const outDir = path.join(__dirname, '..', 'backups');
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

function dumpDatabase(database) {
  const file = path.join(outDir, `${database}-${stamp}.sql`);
  const args = [
    `-h${SERVER_CONFIG.host}`,
    `-P${SERVER_CONFIG.port}`,
    `-u${SERVER_CONFIG.user}`,
    '--default-character-set=utf8mb4',
    '--single-transaction',
    '--routines',
    '--databases',
    database,
  ];
  if (SERVER_CONFIG.password) args.splice(3, 0, `-p${SERVER_CONFIG.password}`);

  const r = spawnSync('mysqldump', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  if (r.error) {
    console.error(`❌ mysqldump topilmadi yoki ishlamadi (${database}):`, r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`❌ mysqldump xato (${database}):`, r.stderr || r.stdout);
    process.exit(r.status || 1);
  }
  fs.writeFileSync(file, r.stdout, 'utf8');
  console.log(`✅ ${database}: ${file} (${Math.round(r.stdout.length / 1024)} KB)`);
  return file;
}

const names = ALL_DB_NAMES.length ? ALL_DB_NAMES : [
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

for (const dbName of names) {
  dumpDatabase(dbName);
}
console.log('\nBackup tamamlandı. Fayllar: backend/backups/');
