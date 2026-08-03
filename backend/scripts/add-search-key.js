import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';
import searchFold from '../src/utils/searchFold.js';

dotenv.config();

// 1. Ustun mavjudligini tekshirish
const [cols] = await db.query(
  `SELECT COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'titles' AND COLUMN_NAME = 'search_key'`
);
if (!cols.length) {
  await db.query(
    `ALTER TABLE titles
     ADD COLUMN search_key VARCHAR(191) NULL AFTER normalized,
     ADD INDEX idx_titles_search_key (search_key)`
  );
  console.log('search_key ustuni va indeksi qo‘shildi.');
} else {
  console.log('search_key ustuni allaqachon mavjud.');
}

// 2. To'ldirish
const [titles] = await db.query('SELECT id, soz FROM titles');
let updated = 0;
const conn = await db.getConnection();
try {
  await conn.beginTransaction();
  for (const t of titles) {
    const key = searchFold(t.soz);
    await conn.query('UPDATE titles SET search_key = ? WHERE id = ?', [key, t.id]);
    updated++;
  }
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}

console.log(`${updated} ta title uchun search_key yangilandi.`);

// Namuna
const [sample] = await db.query(
  `SELECT soz, search_key FROM titles WHERE status = 1 ORDER BY \`order\` LIMIT 8`
);
for (const r of sample) console.log(`  ${r.soz} -> ${r.search_key}`);

await db.end();
