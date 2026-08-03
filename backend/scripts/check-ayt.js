import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const [rows] = await db.query(
  `SELECT t.id, t.soz, d.id AS desc_id, d.description, c.name AS category
   FROM titles t
   JOIN description d ON d.titles_id = t.id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1 AND (t.soz = 'АЙТ' OR t.soz LIKE 'АЙТ %')
   ORDER BY t.soz`
);
for (const r of rows) {
  const codes = [...r.description.slice(0, 12)]
    .map((ch) => `${ch}(${ch.codePointAt(0).toString(16)})`)
    .join(' ');
  console.log(`[${r.soz}] cat=${r.category} :: "${r.description.slice(0, 80)}"`);
  console.log(`   codes: ${codes}`);
}

// misollar ham
const [ex] = await db.query(
  `SELECT t.soz, e.example, e.author
   FROM titles t
   JOIN description d ON d.titles_id = t.id
   JOIN examples e ON e.descriptions_id = d.id
   WHERE t.status = 1 AND (t.soz = 'АЙТ' OR t.soz LIKE 'АЙТ %')`
);
console.log('\nMisollar:');
for (const r of ex) console.log(`  [${r.soz}] "${r.example}" — ${r.author}`);

await db.end();
