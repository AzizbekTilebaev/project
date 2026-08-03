import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

// Grammatik forma: "X фейилиниң ... дәрежеси/формасы"
const GRAMMAR_RE =
  /фейил(?:лер)?\S*\s+[а-яёәөүғқңҳіў]+\s+(?:д[әөa]реж|форма|түр)\S*/iu;

// Havola: "к. X" yoki "қ. X"
const REF_RE = /^\s*[кқ]\.\s+\S/iu;

const [rows] = await db.query(
  `SELECT t.id AS title_id, t.soz, d.id AS desc_id, d.description,
          c.id AS cat_id, c.name AS category
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1`
);

let belgisizTotal = 0;
const grammarBelgisiz = [];
const refBelgisiz = [];
const otherBelgisiz = [];

for (const r of rows) {
  const cat = (r.category || '').trim().toLowerCase();
  const isBelgisiz = !r.category || cat === 'белгисиз' || cat === 'belgisiz';
  if (!isBelgisiz) continue;
  belgisizTotal++;

  const desc = (r.description || '').trim();
  if (GRAMMAR_RE.test(desc)) grammarBelgisiz.push(r);
  else if (REF_RE.test(desc)) refBelgisiz.push(r);
  else otherBelgisiz.push(r);
}

console.log('=== BELGISIZ audit ===');
console.log('Jami belgisiz ta’rif:', belgisizTotal);
console.log('  - grammatik forma (feyil):', grammarBelgisiz.length);
console.log('  - havola (к./қ.):', refBelgisiz.length);
console.log('  - boshqa:', otherBelgisiz.length);

console.log('\n--- grammatik forma namunalari (10) ---');
for (const r of grammarBelgisiz.slice(0, 10)) {
  console.log(`${r.soz} :: ${r.description.slice(0, 70)}`);
}

console.log('\n--- havola namunalari (10) ---');
for (const r of refBelgisiz.slice(0, 10)) {
  console.log(`${r.soz} :: ${r.description.slice(0, 70)}`);
}

console.log('\n--- boshqa belgisiz namunalari (20) ---');
for (const r of otherBelgisiz.slice(0, 20)) {
  console.log(`${r.soz} :: ${r.description.slice(0, 70)}`);
}

await db.end();
