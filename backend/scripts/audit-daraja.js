import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const db = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'tusindirme_sozlik',
});

// "X фейилиниң ... дәрежеси" uslubidagi ta'riflar
const [rows] = await db.query(
  `SELECT t.id, t.soz, d.description
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   WHERE t.status = 1 AND (
     d.description LIKE '%дәрежеси%'
     OR d.description LIKE '%дәреже%'
     OR d.description LIKE '%фейилиниң%'
     OR d.description LIKE '%фейилинин%'
   )
   ORDER BY t.\`order\``
);

console.log('TOTAL:', rows.length);

// Pattern tahlili
const P = /^(\S+(?:\s\S+)?)\s+фейили?ни[ңн]\s+(.+?)\s*[.\s]*$/u;
let matched = 0;
const forms = new Map();
for (const r of rows) {
  const desc = r.description.trim();
  const m = desc.match(P);
  if (m) {
    matched++;
    const form = m[2];
    forms.set(form, (forms.get(form) || 0) + 1);
  }
}
console.log('MATCHED pattern:', matched);
console.log('FORMS:', [...forms.entries()].sort((a, b) => b[1] - a[1]));

// Namuna: pattern-ga mos kelmaganlari
console.log('\n--- NOT matched samples ---');
let shown = 0;
for (const r of rows) {
  if (!r.description.trim().match(P) && shown < 15) {
    console.log(`${r.soz} :: ${r.description.slice(0, 120)}`);
    shown++;
  }
}

// Namuna: mos kelganlari (birinchi 10)
console.log('\n--- matched samples ---');
shown = 0;
for (const r of rows) {
  const m = r.description.trim().match(P);
  if (m && shown < 10) {
    console.log(`${r.soz} -> base:"${m[1]}" form:"${m[2]}"`);
    shown++;
  }
}

await db.end();
