/**
 * literature_writers.roles_json — biografiyadan rollardı tolıqtırıw.
 * Usage: node scripts/seed-writer-roles.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { pools, DB } from '../src/config/db.js';
import { extractWriterRoles } from '../src/lib/writerRoles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function ensureColumn() {
  const db = DB.poets;
  const [cols] = await pools.poets.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'literature_writers' AND COLUMN_NAME = 'roles_json'`,
    [db]
  );
  if (!cols.length) {
    await pools.poets.query(
      `ALTER TABLE ${db}.literature_writers
       ADD COLUMN roles_json JSON NULL AFTER facts_json`
    );
    console.log('+ roles_json column');
  }
}

async function main() {
  await ensureColumn();
  const [rows] = await pools.poets.query(
    `SELECT id, slug, poet_name_original, biography_plain_original, biography_original
     FROM ${DB.poets}.literature_writers`
  );
  let updated = 0;
  let empty = 0;
  for (const row of rows) {
    const bio = row.biography_plain_original || row.biography_original || '';
    const { roles, evidence } = extractWriterRoles(bio);
    const payload = roles.length
      ? JSON.stringify({ roles, evidence, source: 'bio-auto', at: new Date().toISOString() })
      : null;
    if (!roles.length) empty += 1;
    await pools.poets.query(
      `UPDATE ${DB.poets}.literature_writers SET roles_json = ? WHERE id = ?`,
      [payload, row.id]
    );
    updated += 1;
  }
  console.log(`OK: ${updated} writers · with roles: ${updated - empty} · empty: ${empty}`);
  await pools.poets.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await pools.poets.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
