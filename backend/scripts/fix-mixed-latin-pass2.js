import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const WRITE = process.argv.includes('--write');

const LAT2CYR = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М',
  O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У', F: 'Ғ', I: 'І',
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м',
  o: 'о', p: 'р', t: 'т', x: 'х', y: 'у', f: 'ғ', i: 'і',
};

/** so'z asosan kirill bo'lsa, ichidagi lotin lookalike larni almashtiradi */
function fixMixedWord(word) {
  const latin = (word.match(/[A-Za-z]/g) || []).length;
  const cyr = (word.match(/[\u0400-\u04FF\u04D8\u04D9]/gu) || []).length;
  if (latin === 0 || cyr === 0) return word;
  return word.replace(/[A-Za-z]/g, (ch) => LAT2CYR[ch] || ch);
}

function fixMixedText(text) {
  return text.split(/(\s+)/).map(fixMixedWord).join('');
}

// 1) Ta'riflardagi aralash (kirill+lotin) so'zlarni tuzatish
const [defs] = await db.query(
  "SELECT d.id, d.description FROM description d WHERE d.description REGEXP BINARY '[A-Za-z]'"
);
let descFixed = 0;
for (const d of defs) {
  const fixed = fixMixedText(d.description);
  if (fixed !== d.description) {
    descFixed++;
    if (descFixed <= 10) console.log('DESC:', d.description.slice(0, 60), '->', fixed.slice(0, 60));
    if (WRITE) await db.query('UPDATE description SET description=? WHERE id=?', [fixed, d.id]);
  }
}
console.log('Ta\u2019rifda tuzatildi:', descFixed);

// 2) Misollardagi aralash so'zlar
const [exs] = await db.query(
  "SELECT e.id, e.example FROM examples e WHERE e.example REGEXP BINARY '[A-Za-z]'"
);
let exFixed = 0;
for (const e of exs) {
  const fixed = fixMixedText(e.example);
  if (fixed !== e.example) {
    exFixed++;
    if (WRITE) await db.query('UPDATE examples SET example=? WHERE id=?', [fixed, e.id]);
  }
}
console.log('Misollarda tuzatildi:', exFixed);

// 3) Qolgan lotin titlelar nima?
const [rem] = await db.query(
  "SELECT id, soz FROM titles WHERE status=1 AND soz REGEXP BINARY '[A-Za-z]'"
);
console.log('\nQolgan lotin titlelar:');
for (const r of rem) console.log(' -', JSON.stringify(r.soz));

// 4) Ta'rif "TITLE_OXIRGI_SOZ + POS." bilan boshlanadigan qoldiqlar (translitdan keyin qayta)
const POS = '(ат|ф|кел|к|рәў|алм|сан|б|лингв|астр|мед)';
// faqat TO'LIQ KATTA HARFLI bosh so'z (qonuniy ta'riflar tegilmaydi)
const TAIL = new RegExp(`^([А-ЯӘҒҚҢӨҮҰҺІЁЎ-]{2,})\\s+${POS}?\\.?\\s*(.+)$`, 'su');
const [belg] = await db.query("SELECT id FROM categorys WHERE name='белгисиз' LIMIT 1");
const belgId = belg[0]?.id ?? null;

const [pairs] = await db.query(
  `SELECT t.id tid, t.soz, d.id did, d.description, d.categorys_id
   FROM titles t JOIN description d ON d.titles_id=t.id
   WHERE t.status=1 AND d.description REGEXP BINARY '^[А-ЯЁӘҒҚҢӨҮҰҺІЎ-]{2,}[[:space:]]'`
);
let tailFixed = 0;
for (const p of pairs) {
  const m = p.description.trim().match(TAIL);
  if (!m) continue;
  const lastWord = p.soz.split(/\s+/).pop();
  if (m[1].toLocaleLowerCase('kk') !== lastWord.toLocaleLowerCase('kk')) continue;
  const rest = (m[3] || '').trim();
  if (rest.length < 3) continue;
  tailFixed++;
  console.log('TAIL:', p.soz, '::', p.description.slice(0, 50), '->', rest.slice(0, 50));
  if (WRITE) {
    await db.query('UPDATE description SET description=? WHERE id=?', [rest, p.did]);
    if (m[2] && (p.categorys_id === belgId || p.categorys_id == null)) {
      const name = m[2].toLowerCase() + '.';
      const [c] = await db.query('SELECT id FROM categorys WHERE LOWER(name)=?', [name]);
      let cid = c[0]?.id;
      if (!cid) {
        const [ins] = await db.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
          `cat_${name}`, name, name.replace('.', ''),
        ]);
        cid = ins.insertId;
      }
      await db.query('UPDATE description SET categorys_id=? WHERE id=?', [cid, p.did]);
    }
  }
}
console.log('Tail qoldiqlar tuzatildi:', tailFixed);
console.log('MODE:', WRITE ? 'WRITE' : 'DRY-RUN');

await db.end();
