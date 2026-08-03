import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

// Lotin va kirill rim raqamlari (І U+0406, Х U+0425)
const ROMAN_SUFFIX_RE = /\s+([IVXІХ]+)\s*$/iu;

function romanValue(raw) {
  const s = raw.toUpperCase().replace(/І/g, 'I').replace(/Х/g, 'X');
  const map = { I: 1, V: 5, X: 10 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = map[s[i]];
    if (!v) return null;
    const next = map[s[i + 1]] || 0;
    total += v < next ? -v : v;
  }
  return total;
}

function fold(value) {
  return String(value || '')
    .toLocaleLowerCase('kk')
    .replace(/\s+/g, ' ')
    .trim();
}

const [rows] = await db.query(
  'SELECT id, soz FROM titles WHERE status = 1'
);

const groups = new Map(); // baseFold -> { base, variants: [{id, soz, num}], plain: [{id,soz}] }
for (const r of rows) {
  const m = r.soz.match(ROMAN_SUFFIX_RE);
  if (m) {
    const num = romanValue(m[1]);
    if (num == null) continue;
    const base = r.soz.replace(ROMAN_SUFFIX_RE, '').trim();
    const key = fold(base);
    if (!groups.has(key)) groups.set(key, { base, variants: [], plain: [] });
    groups.get(key).variants.push({ id: r.id, soz: r.soz, num });
  }
}

// Asos so'z raqamsiz ham bormi?
const plainByFold = new Map();
for (const r of rows) {
  if (!ROMAN_SUFFIX_RE.test(r.soz)) {
    plainByFold.set(fold(r.soz), r);
  }
}
for (const [key, g] of groups) {
  const plain = plainByFold.get(key);
  if (plain) g.plain.push(plain);
}

let totalRoman = 0;
const singles = []; // faqat bitta raqamli variant, asossiz
const gaps = []; // raqamlar orasida bo'shliq (II bor, I yo'q)
const withPlain = []; // ham raqamli, ham raqamsiz varianti bor
const dupNums = []; // bitta raqam ikki marta

for (const [, g] of groups) {
  totalRoman += g.variants.length;
  const nums = g.variants.map((v) => v.num).sort((a, b) => a - b);
  const uniq = [...new Set(nums)];
  if (uniq.length !== nums.length) dupNums.push(g);
  if (g.plain.length) withPlain.push(g);

  const max = uniq[uniq.length - 1];
  const missing = [];
  for (let n = 1; n <= max; n++) if (!uniq.includes(n)) missing.push(n);

  if (g.variants.length === 1 && !g.plain.length) {
    singles.push({ ...g, missing });
  } else if (missing.length) {
    gaps.push({ ...g, missing });
  }
}

console.log('=== RIM RAQAM AUDITI ===');
console.log('Rim raqamli titles:', totalRoman, '| guruhlar:', groups.size);
console.log('Yolg‘iz variant (asossiz):', singles.length);
console.log('Raqam bo‘shlig‘i bor guruhlar:', gaps.length);
console.log('Raqamli + raqamsiz aralash:', withPlain.length);
console.log('Takror raqamli guruhlar:', dupNums.length);

console.log('\n--- YOLG‘IZ variantlar ---');
for (const g of singles) {
  console.log(`  ${g.variants[0].soz} (id ${g.variants[0].id})`);
}

console.log('\n--- BO‘SHLIQLAR ---');
for (const g of gaps) {
  const have = g.variants.map((v) => `${v.soz}#${v.num}`).join(', ');
  console.log(`  ${g.base}: bor [${have}] — yetishmaydi [${g.missing.join(',')}]`);
}

console.log('\n--- ARALASH (raqamsiz + raqamli) ---');
for (const g of withPlain.slice(0, 30)) {
  console.log(
    `  ${g.base}: raqamsiz id ${g.plain[0].id} + ${g.variants.map((v) => v.soz).join(', ')}`
  );
}

console.log('\n--- TAKROR raqamlar ---');
for (const g of dupNums) {
  console.log(`  ${g.base}: ${g.variants.map((v) => `${v.soz}(id ${v.id})`).join(', ')}`);
}

await db.end();
