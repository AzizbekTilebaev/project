import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WRITE = process.argv.includes('--write');

// Ta'rif boshida yashiringan turkum: "ат. ...", "а т. ...", "кел. ...", "р. ..."
// Ba'zilarida OCR bo'shliqlari bor: "а т." -> "ат."
const INLINE_POS = [
  { re: /^\s*а\s*т\s*\.\s+/iu, cat: 'ат.' },
  { re: /^\s*кел\s*\.\s+/iu, cat: 'кел.' },
  { re: /^\s*ф\s*\.\s+/iu, cat: 'ф.' },
  { re: /^\s*р\s*\.\s+/iu, cat: 'р.' },
  { re: /^\s*сан\s*\.\s+/iu, cat: 'сан.' },
  { re: /^\s*алм\s*\.\s+/iu, cat: 'алм.' },
  { re: /^\s*рәў\s*\.\s+/iu, cat: 'рәў.' },
];

const [cats] = await db.query('SELECT id, name FROM categorys');
const catId = (name) => cats.find((c) => c.name === name)?.id;

const [rows] = await db.query(
  `SELECT d.id AS desc_id, d.description, t.soz, c.name AS category
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1
     AND (d.categorys_id IS NULL OR LOWER(TRIM(c.name)) IN ('белгисиз','belgisiz'))`
);

const updates = []; // { desc_id, catId, newDesc, soz, cat }
for (const r of rows) {
  const desc = (r.description || '').trim();
  for (const p of INLINE_POS) {
    const m = desc.match(p.re);
    if (m) {
      const id = catId(p.cat);
      if (!id) break;
      const newDesc = desc.slice(m[0].length).trim();
      if (newDesc.length < 3) break; // faqat POS qolса — tegilmaydi
      updates.push({ desc_id: r.desc_id, catId: id, newDesc, soz: r.soz, cat: p.cat });
      break;
    }
  }
}

console.log('Ichki turkum topildi:', updates.length);
for (const u of updates.slice(0, 25)) {
  console.log(`  ${u.soz} → ${u.cat} :: ${u.newDesc.slice(0, 55)}`);
}

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish: node scripts/fix-belgisiz-inline.js --write');
  await db.end();
  process.exit(0);
}

const conn = await db.getConnection();
try {
  await conn.beginTransaction();
  for (const u of updates) {
    await conn.query(
      'UPDATE description SET categorys_id = ?, description = ? WHERE id = ?',
      [u.catId, u.newDesc, u.desc_id]
    );
  }
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}

console.log('YOZILDI:', updates.length);
await db.end();
