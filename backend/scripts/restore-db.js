/**
 * Usage: node scripts/restore-db.js path/to/dump.sql
 * Dump `--databases` bilan yaratilgan bo'lishi kerak.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { DICT_DB_CONFIG } from '../src/config/dictionary.db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node scripts/restore-db.js <dump.sql>');
  process.exit(1);
}

const cfg = DICT_DB_CONFIG;
const args = [`-h${cfg.host}`, `-P${cfg.port}`, `-u${cfg.user}`, `--default-character-set=utf8mb4`];
if (cfg.password) args.push(`-p${cfg.password}`);

const sql = fs.readFileSync(file, 'utf8');
const r = spawnSync('mysql', args, { input: sql, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
if (r.error) {
  console.error('❌ mysql CLI topilmadi:', r.error.message);
  process.exit(1);
}
if (r.status !== 0) {
  console.error('❌ Restore xato:', r.stderr || r.stdout);
  process.exit(r.status || 1);
}
console.log(`✅ Restore OK: ${path.resolve(file)}`);
