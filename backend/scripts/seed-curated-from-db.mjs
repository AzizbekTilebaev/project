/**
 * curated_words bo‘sh bo‘lsa — bazadagi titles dan 50 ta so‘z to‘ldiradi.
 * fordata/curated trashga ketgani uchun yangi serverlarda foydali.
 *
 *   node scripts/seed-curated-from-db.mjs
 *   node scripts/seed-curated-from-db.mjs --force   # mavjudni qayta yozadi
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const force = process.argv.includes('--force');
const LIMIT = 50;

async function main() {
  const dbName = process.env.KK_TUSINDIRME_DB || process.env.DB_NAME || 'kk_tusindirme';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS || '',
    database: dbName,
  });

  const [tables] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = ? AND table_name = 'curated_words'`,
    [dbName]
  );
  if (!tables[0]?.c) {
    console.error('❌ curated_words jadvali yo‘q — avval: npm run setup / setup-dictionary');
    process.exit(1);
  }

  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM curated_words');
  if (n > 0 && !force) {
    console.log(`✅ curated_words allaqachon ${n} ta — o‘tkazib yuborildi (--force bilan qayta)`);
    await conn.end();
    return;
  }

  const [rows] = await conn.query(
    `SELECT TRIM(title) AS soz FROM titles
     WHERE title IS NOT NULL AND CHAR_LENGTH(TRIM(title)) BETWEEN 2 AND 40
     ORDER BY RAND()
     LIMIT ?`,
    [LIMIT]
  );

  if (!rows.length) {
    console.error('❌ titles bo‘sh — avval sozlik import/restore qiling');
    process.exit(1);
  }

  await conn.query('DELETE FROM curated_words');
  let i = 0;
  for (const r of rows) {
    const soz = String(r.soz || '')
      .trim()
      .replace(/\s+(ат|ф|кел|б)\.?$/i, '');
    if (!soz) continue;
    await conn.query(
      'INSERT INTO curated_words (soz, sort_order, score, category, source) VALUES (?, ?, NULL, ?, ?)',
      [soz, i, 'demo', 'seed-curated-from-db']
    );
    i += 1;
  }
  console.log(`✅ curated_words: ${i} ta so‘z (titles dan)`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
