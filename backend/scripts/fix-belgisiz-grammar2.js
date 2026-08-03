import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WRITE = process.argv.includes('--write');

// OCR variantlari bilan grammatik forma: "... фейил... <daraja/forma> дәр*/дар*"
const GRAMMAR_RE2 =
  /фейил(?:лер)?\S*\s+[а-яёәөүғқңҳіў]+\s+(?:д[әөaе]р[а-яёәөүғқңҳіў]*|форма\S*|түр\S*)/iu;

const [cats] = await db.query('SELECT id, name FROM categorys');
const FEYIL_ID = cats.find((c) => c.name === 'ф.')?.id;

const [rows] = await db.query(
  `SELECT d.id AS desc_id, d.description, t.soz, c.name AS category
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1
     AND (d.categorys_id IS NULL OR LOWER(TRIM(c.name)) IN ('белгисиз','belgisiz'))`
);

const hits = rows.filter((r) => GRAMMAR_RE2.test((r.description || '').trim()));
console.log('OCR grammatik forma topildi:', hits.length);
for (const r of hits.slice(0, 30)) {
  console.log(`  ${r.soz} :: ${r.description.slice(0, 60)}`);
}

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish: --write');
  await db.end();
  process.exit(0);
}

if (hits.length) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ph = hits.map(() => '?').join(',');
    await conn.query(
      `UPDATE description SET categorys_id = ? WHERE id IN (${ph})`,
      [FEYIL_ID, ...hits.map((r) => r.desc_id)]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
console.log('YOZILDI:', hits.length);
await db.end();
