import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WRITE = process.argv.includes('--write');
const CAT_NAME = 'грамм. форма';

// Grammatik forma: "X фейилиниң ... дәрежеси/формасы/түри" (OCR variantlari bilan)
const GRAMMAR_RE =
  /фейил(?:лер)?\S*\s+[а-яёәөүғқңҳіў]+\s+(?:д[әөaе]р[а-яёәөүғқңҳіў]*|форма\S*|түр\S*)/iu;

const [rows] = await db.query(
  `SELECT d.id AS desc_id, d.description, t.soz, c.name AS category
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1`
);

const hits = rows.filter((r) => GRAMMAR_RE.test((r.description || '').trim()));
const byCat = new Map();
for (const r of hits) {
  const k = r.category || '(null)';
  byCat.set(k, (byCat.get(k) || 0) + 1);
}

console.log('Grammatik forma ta’riflari:', hits.length);
console.log('Hozirgi turkumlari:', [...byCat.entries()]);

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish: --write');
  await db.end();
  process.exit(0);
}

// Toifani yaratish (bo'lmasa)
let [[cat]] = await db.query('SELECT id FROM categorys WHERE name = ?', [CAT_NAME]);
if (!cat) {
  const [res] = await db.query('INSERT INTO categorys (name) VALUES (?)', [CAT_NAME]);
  cat = { id: res.insertId };
  console.log(`Yangi toifa yaratildi: "${CAT_NAME}" (id ${cat.id})`);
} else {
  console.log(`Toifa mavjud: "${CAT_NAME}" (id ${cat.id})`);
}

const conn = await db.getConnection();
try {
  await conn.beginTransaction();
  const BATCH = 500;
  for (let i = 0; i < hits.length; i += BATCH) {
    const chunk = hits.slice(i, i + BATCH);
    const ph = chunk.map(() => '?').join(',');
    await conn.query(
      `UPDATE description SET categorys_id = ? WHERE id IN (${ph})`,
      [cat.id, ...chunk.map((r) => r.desc_id)]
    );
  }
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}

console.log('YOZILDI:', hits.length, `ta’rif → "${CAT_NAME}"`);
await db.end();
