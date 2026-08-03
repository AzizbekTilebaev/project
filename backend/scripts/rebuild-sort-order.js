import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// Qoraqalpoq (kirill) alifbosi tartibi
const ALPHABET = 'АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҮЎФХҲЦЧШЩЪЫІЬЭЮЯ';
const RANK = new Map();
for (let i = 0; i < ALPHABET.length; i++) {
  RANK.set(ALPHABET[i], i + 1);
  RANK.set(ALPHABET[i].toLocaleLowerCase('kk'), i + 1);
}

const ROMAN_VAL = (s) => {
  const map = { I: 1, V: 5, X: 10 };
  let total = 0;
  let prev = 0;
  const norm = s.replace(/І/g, 'I');
  for (let i = norm.length - 1; i >= 0; i--) {
    const v = map[norm[i]] || 0;
    total += v < prev ? -v : v;
    prev = v;
  }
  return total;
};

/** So'zni solishtirish kaliti: harf ranklari massivi + omonim raqami */
function sortKey(soz) {
  const parts = soz.trim().split(/\s+/);
  let roman = 0;
  if (parts.length > 1 && /^[IVXІ]+$/.test(parts[parts.length - 1])) {
    roman = ROMAN_VAL(parts.pop());
  }
  const word = parts.join(' ');
  const ranks = [];
  for (const ch of word) {
    if (RANK.has(ch)) ranks.push(RANK.get(ch));
    else if (ch === ' ' || ch === '-') ranks.push(0); // bo'shliq/defis harflardan oldin
    else ranks.push(99);
  }
  return { ranks, roman };
}

function compare(a, b) {
  const ka = a.key;
  const kb = b.key;
  const len = Math.min(ka.ranks.length, kb.ranks.length);
  for (let i = 0; i < len; i++) {
    if (ka.ranks[i] !== kb.ranks[i]) return ka.ranks[i] - kb.ranks[i];
  }
  if (ka.ranks.length !== kb.ranks.length) return ka.ranks.length - kb.ranks.length;
  return ka.roman - kb.roman;
}

const [titles] = await db.query('SELECT id, soz FROM titles');
const items = titles.map((t) => ({ ...t, key: sortKey(t.soz) }));
items.sort(compare);

const conn = await db.getConnection();
try {
  await conn.beginTransaction();
  // CASE bilan bo'lib-bo'lib yozamiz (tezroq)
  const BATCH = 500;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const cases = chunk.map(() => 'WHEN ? THEN ?').join(' ');
    const params = [];
    for (let j = 0; j < chunk.length; j++) {
      params.push(chunk[j].id, i + j + 1);
    }
    params.push(...chunk.map((c) => c.id));
    await conn.query(
      `UPDATE titles SET \`order\` = CASE id ${cases} END WHERE id IN (${chunk.map(() => '?').join(',')})`,
      params
    );
  }
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}

console.log(`${items.length} ta title tartiblandi.`);
console.log('Namuna (birinchi 15):', items.slice(0, 15).map((i) => i.soz).join(' | '));
const sIdx = items.findIndex((i) => i.soz === 'САЙ І');
if (sIdx >= 0) console.log('САЙ atrofida:', items.slice(sIdx - 2, sIdx + 6).map((i) => i.soz).join(' | '));
await db.end();
