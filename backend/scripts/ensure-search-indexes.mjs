/**
 * titles qidiruv prefiks indekslari — LIKE 'kitap%' tezligi uchun.
 * Usage: node scripts/ensure-search-indexes.mjs
 */
import { pools, DB } from '../src/config/db.js';

const db = pools.tusindirme;

async function ensureIndex(name, sql) {
  const [rows] = await db.query(
    `SELECT 1 AS ok FROM information_schema.statistics
     WHERE table_schema = ? AND table_name = 'titles' AND index_name = ?
     LIMIT 1`,
    [DB.tusindirme, name]
  );
  if (rows.length) {
    console.log(`✓ ${name} already exists`);
    return;
  }
  await db.query(sql);
  console.log(`✅ created ${name}`);
}

await ensureIndex(
  'idx_titles_soz_prefix',
  'CREATE INDEX idx_titles_soz_prefix ON titles (soz(48))'
);
await ensureIndex(
  'idx_titles_normalized_prefix',
  'CREATE INDEX idx_titles_normalized_prefix ON titles (normalized(48))'
);
await ensureIndex(
  'idx_titles_search_key_prefix',
  'CREATE INDEX idx_titles_search_key_prefix ON titles (search_key(48))'
);

await pools.tusindirme.end();
console.log('Done.');
