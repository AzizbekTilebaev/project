import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WRITE = process.argv.includes('--write');

// Grammatik forma: "X фейилиниң ... дәрежеси/формасы/түри"
const GRAMMAR_RE =
  /фейил(?:лер)?\S*\s+[а-яёәөүғқңҳіў]+\s+(?:д[әөa]реж|форма|түр)\S*/iu;

// Havola: "к. X" / "қ. X"
const REF_K = /^\s*к\.\s+\S/iu;
const REF_Q = /^\s*қ\.\s+\S/iu;

// Qaraqalpaq feyil (infinitiv) suffikslari — kuchli signal
const VERB_SUFFIX = /(ыў|иў|аў|еў|оў|өў|үў|ұў|ыу|иу)$/u;

function baseWord(soz) {
  return soz.replace(/\s+[IVXІХ]+$/iu, '').trim().toLocaleLowerCase('kk');
}

// Turkum id larini olish
const [cats] = await db.query('SELECT id, name FROM categorys');
const catId = (name) => cats.find((c) => c.name === name)?.id;

const FEYIL_ID = catId('ф.');
const K_ID = catId('к.');
const Q_ID = catId('қ.');
if (!FEYIL_ID) throw new Error("'ф.' turkumi topilmadi");

const [rows] = await db.query(
  `SELECT d.id AS desc_id, d.description, t.soz, c.name AS category
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1
     AND (d.categorys_id IS NULL OR LOWER(TRIM(c.name)) IN ('белгисиз','belgisiz'))`
);

const plan = { grammar: [], verbSuffix: [], refK: [], refQ: [], skipped: [] };

for (const r of rows) {
  const desc = (r.description || '').trim();
  if (GRAMMAR_RE.test(desc)) plan.grammar.push(r);
  else if (REF_K.test(desc)) plan.refK.push(r);
  else if (REF_Q.test(desc)) plan.refQ.push(r);
  else if (VERB_SUFFIX.test(baseWord(r.soz))) plan.verbSuffix.push(r);
  else plan.skipped.push(r);
}

console.log('=== BELGISIZ → POS reja ===');
console.log('grammatik forma → ф.:', plan.grammar.length);
console.log('feyil suffiks → ф.:', plan.verbSuffix.length);
console.log('havola → к.:', plan.refK.length, '| → қ.:', plan.refQ.length);
console.log('o‘zgarmaydi (aniqlab bo‘lmadi):', plan.skipped.length);

console.log('\n--- feyil-suffiks namunalari (15) ---');
for (const r of plan.verbSuffix.slice(0, 15)) {
  console.log(`  ${r.soz} :: ${r.description.slice(0, 60)}`);
}
console.log('\n--- o‘zgarmaydigan namunalar (25) ---');
for (const r of plan.skipped.slice(0, 25)) {
  console.log(`  ${r.soz} :: ${r.description.slice(0, 60)}`);
}

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish: node scripts/fix-belgisiz-pos.js --write');
  await db.end();
  process.exit(0);
}

async function applyCat(list, categoryId) {
  if (!list.length || !categoryId) return 0;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const BATCH = 500;
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      const ph = chunk.map(() => '?').join(',');
      await conn.query(
        `UPDATE description SET categorys_id = ? WHERE id IN (${ph})`,
        [categoryId, ...chunk.map((r) => r.desc_id)]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return list.length;
}

const nGrammar = await applyCat(plan.grammar, FEYIL_ID);
const nVerb = await applyCat(plan.verbSuffix, FEYIL_ID);
const nRefK = await applyCat(plan.refK, K_ID);
const nRefQ = await applyCat(plan.refQ, Q_ID);

console.log('\nYOZILDI:');
console.log('  grammatik forma → ф.:', nGrammar);
console.log('  feyil suffiks → ф.:', nVerb);
console.log('  havola → к.:', nRefK, '| → қ.:', nRefQ);
console.log('  jami:', nGrammar + nVerb + nRefK + nRefQ);

await db.end();
