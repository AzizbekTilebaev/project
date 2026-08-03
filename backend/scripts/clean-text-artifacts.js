import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const WRITE = process.argv.includes('--write');

function cleanText(s) {
  let t = s;
  t = t.replace(/\u2022/g, ' ');            // bullet
  t = t.replace(/\u04F0/g, 'Ў').replace(/\u04F1/g, 'ў'); // Ӱ -> Ў (OCR)
  t = t.replace(/[ \t]{2,}/g, ' ');          // juft probellar
  t = t.replace(/\s+([,.;:!?])/g, '$1');     // tinish belgisidan oldingi probel
  t = t.trim();
  t = t.replace(/[,;:]$/, '.');              // oxiridagi vergul/nuqtali vergul -> nuqta
  t = t.replace(/\.\s*\.$/, '.');            // ".." -> "."
  if (t && !/[.!?»)]$/.test(t)) t += '.';    // nuqta bilan tugamasa qo'shish
  return t.trim();
}

let dFixed = 0;
const [defs] = await db.query('SELECT id, description FROM description');
for (const d of defs) {
  const fixed = cleanText(d.description);
  if (fixed !== d.description) {
    dFixed++;
    if (dFixed <= 15) console.log('DEF:', JSON.stringify(d.description.slice(-45)), '->', JSON.stringify(fixed.slice(-45)));
    if (WRITE) await db.query('UPDATE description SET description=? WHERE id=?', [fixed, d.id]);
  }
}
console.log('Ta\u2019riflar tozalandi:', dFixed);

let eFixed = 0;
const [exs] = await db.query('SELECT id, example, author FROM examples');
for (const e of exs) {
  const fixedEx = cleanText(e.example);
  const fixedAu = e.author ? e.author.replace(/[ \t]{2,}/g, ' ').trim().replace(/[.,;]$/, '') : e.author;
  if (fixedEx !== e.example || fixedAu !== e.author) {
    eFixed++;
    if (WRITE) await db.query('UPDATE examples SET example=?, author=? WHERE id=?', [fixedEx, fixedAu, e.id]);
  }
}
console.log('Misollar tozalandi:', eFixed);

// Bo'sh yoki juda qisqa qolgan ta'riflar qayta tekshiruv
const [remaining] = await db.query(
  `SELECT t.soz, d.description FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND CHAR_LENGTH(TRIM(d.description)) < 8`
);
console.log('\nQolgan qisqa ta\u2019riflar:', remaining.length);
for (const r of remaining) console.log(' -', r.soz, '::', JSON.stringify(r.description));

console.log('MODE:', WRITE ? 'WRITE' : 'DRY-RUN');
await db.end();
