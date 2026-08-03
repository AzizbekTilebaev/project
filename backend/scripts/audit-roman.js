import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// Rim raqami (kiril I/ІІ va lotin I/V aralash) qatorda alohida token bo'lsa
const ROMAN = '(?:[IVXІ]{1,4})';
// Ta'rif ICHIDA yashiringan homonim belgisi: "II ф." / "I ат." / " ІІІ кел."
const EMBEDDED = new RegExp(`(^|[.\\s])(${ROMAN})\\s+(ат|ф|кел|сан|алм|рәв|к|қ|с|т|дин|тар)\\.`, 'i');

// 1) Bazadagi barcha rim raqamli sarlavhalar
const [titles] = await db.query(
  "SELECT id, soz FROM titles WHERE soz REGEXP '[[:space:]](I|V|X|II|III|IV|VI|VII|IX|Х|І|ІІ|ІІІ|ІV|V)$'"
);

// Sarlavhalarni asosiy so'z bo'yicha guruhlash
const groups = {};
for (const t of titles) {
  const base = t.soz.replace(/\s+[IVXІ]+$/i, '').trim();
  (groups[base] ||= []).push(t.soz);
}

// Har guruh uchun uzluksizlik/to'liqlik tekshiruvi
const ROMAN_SEQ = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const suspiciousGroups = [];
for (const [base, arr] of Object.entries(groups)) {
  const nums = arr.map((s) => s.replace(base, '').trim().toUpperCase().replace(/І/g, 'I').replace(/Х/g, 'X'));
  const set = new Set(nums);
  // I bilan boshlanmasa yoki uzilish bo'lsa - shubhali
  let broken = false;
  const maxIdx = Math.max(...nums.map((n) => ROMAN_SEQ.indexOf(n)));
  for (let i = 0; i <= maxIdx; i++) {
    if (!set.has(ROMAN_SEQ[i])) { broken = true; break; }
  }
  if (broken || !set.has('I')) suspiciousGroups.push({ base, have: [...set].sort() });
}

// 2) Ta'rif ichida yashiringan homonim belgisi bor yozuvlar
const [descs] = await db.query(
  `SELECT t.id, t.soz, d.id did, d.description
   FROM description d JOIN titles t ON d.titles_id=t.id`
);
const embedded = [];
for (const d of descs) {
  if (EMBEDDED.test(d.description)) {
    embedded.push({ soz: d.soz, did: d.did, desc: d.description.slice(0, 160) });
  }
}

console.log('=== Rim raqamli sarlavhalar:', titles.length, ', guruhlar:', Object.keys(groups).length);
console.log('\n=== To\u2018liq bo\u2018lmagan homonim guruhlari:', suspiciousGroups.length);
for (const g of suspiciousGroups) console.log(`  ${g.base}: bor = [${g.have.join(', ')}]`);

console.log('\n=== Ta\u2019rif ichida yashiringan homonim belgisi:', embedded.length);
for (const e of embedded) console.log(`\n  [${e.did}] ${e.soz}\n    ${e.desc}`);

await db.end();
