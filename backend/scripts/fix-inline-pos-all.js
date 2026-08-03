import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WRITE = process.argv.includes('--write');

// Ta'rif matni boshida qolib ketgan turkum/uslub belgilari.
// Tartib muhim: uzunroq va aniqroqlari birinchi.
const MARKERS = [
  { re: /^ат\.\s*лингв\.\s+/iu, cat: 'ат. лингв.' },
  { re: /^ат\.\s*мед\.\s+/iu, cat: 'ат.мед.' },
  { re: /^ат\.\s*тех\.\s+/iu, cat: 'ат.тех.' },
  { re: /^ат\.\s*биол\.\s+/iu, cat: 'ат.биол.' },
  { re: /^диал\.\s*с\.\s+/iu, cat: 'диал.с.' },
  { re: /^к\.\s*с\.\s+/iu, cat: 'к.с.' },
  { re: /^т\.\s*с\.\s+/iu, cat: 'т.с.' },
  { re: /^ф\.\s*аўыс\.\s+/iu, cat: 'ф. аўыс.' },
  { re: /^а\s*т\.\s+/iu, cat: 'ат.' },
  { re: /^ф\.\s+/iu, cat: 'ф.' },
  { re: /^кел\.\s+/iu, cat: 'кел.' },
  { re: /^р\.\s+/iu, cat: 'р.' },
  { re: /^сан\.\s+/iu, cat: 'сан.' },
  { re: /^алм\.\s+/iu, cat: 'алм.' },
  { re: /^рәў\.\s+/iu, cat: 'РӘў.' },
  { re: /^аўыс\.\s+/iu, cat: 'аўыс.' },
  { re: /^мед\.\s+/iu, cat: 'мед.' },
  { re: /^бот\.\s+/iu, cat: 'бот.' },
  { re: /^зоол\.\s+/iu, cat: 'зоол.' },
  { re: /^грамм\.\s+/iu, cat: 'грамм.' },
  { re: /^лингв\.\s+/iu, cat: 'лингв.' },
  { re: /^физ\.\s+/iu, cat: 'физ.' },
  { re: /^хим\.\s+/iu, cat: 'хим.' },
  { re: /^мат\.\s+/iu, cat: 'мат.' },
  { re: /^фраз\.\s+/iu, cat: 'фраз.' },
];

// Belgi ajratilgach ta'rifda ma'noli matn qolishi shart
const MIN_REMAINDER = 3;

const [cats] = await db.query('SELECT id, name FROM categorys');
const catByName = new Map(cats.map((c) => [c.name.toLocaleLowerCase('kk'), c]));

async function ensureCat(name) {
  const key = name.toLocaleLowerCase('kk');
  if (catByName.has(key)) return catByName.get(key).id;
  const [res] = await db.query('INSERT INTO categorys (name) VALUES (?)', [name]);
  catByName.set(key, { id: res.insertId, name });
  console.log(`Yangi toifa: "${name}" (id ${res.insertId})`);
  return res.insertId;
}

const [rows] = await db.query(
  `SELECT d.id AS desc_id, d.description, d.categorys_id, t.soz, c.name AS category
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1`
);

const updates = [];
for (const r of rows) {
  const desc = (r.description || '').trim();
  for (const m of MARKERS) {
    const match = desc.match(m.re);
    if (!match) continue;

    const newDesc = desc.slice(match[0].length).trim();
    if (newDesc.length < MIN_REMAINDER) break; // faqat belgi qolsa — tegmaymiz

    const currentCat = (r.category || '').trim().toLocaleLowerCase('kk');
    const isUnset = !r.category || currentCat === 'белгисиз' || currentCat === 'belgisiz';
    const sameCat = currentCat === m.cat.toLocaleLowerCase('kk');

    updates.push({
      desc_id: r.desc_id,
      soz: r.soz,
      oldCat: r.category || '(null)',
      // Turkum bo'sh bo'lsa — belgidan olamiz; bor bo'lsa saqlanadi, faqat matn tozalanadi
      newCatName: isUnset ? m.cat : null,
      sameCat,
      oldDesc: desc,
      newDesc,
    });
    break;
  }
}

const setCat = updates.filter((u) => u.newCatName);
const textOnly = updates.filter((u) => !u.newCatName);

console.log('=== MATN ICHIDA TURKUM BELGISI ===');
console.log('Jami topildi:', updates.length);
console.log('  turkum ham beriladi (hozirgisi bo‘sh/belgisiz):', setCat.length);
console.log('  faqat matn tozalanadi (turkumi allaqachon bor):', textOnly.length);

console.log('\n--- turkum beriladiganlar (30) ---');
for (const u of setCat.slice(0, 30)) {
  console.log(`  ${u.soz} [${u.oldCat} -> ${u.newCatName}] :: "${u.oldDesc.slice(0, 45)}" -> "${u.newDesc.slice(0, 45)}"`);
}
console.log('\n--- faqat matn tozalanadiganlar (30) ---');
for (const u of textOnly.slice(0, 30)) {
  console.log(`  ${u.soz} [${u.oldCat}] :: "${u.oldDesc.slice(0, 45)}" -> "${u.newDesc.slice(0, 45)}"`);
}

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish: node scripts/fix-inline-pos-all.js --write');
  await db.end();
  process.exit(0);
}

const conn = await db.getConnection();
try {
  await conn.beginTransaction();
  for (const u of updates) {
    if (u.newCatName) {
      const catId = await ensureCat(u.newCatName);
      await conn.query(
        'UPDATE description SET categorys_id = ?, description = ? WHERE id = ?',
        [catId, u.newDesc, u.desc_id]
      );
    } else {
      await conn.query('UPDATE description SET description = ? WHERE id = ?', [
        u.newDesc,
        u.desc_id,
      ]);
    }
  }
  await conn.commit();
} catch (e) {
  await conn.rollback();
  throw e;
} finally {
  conn.release();
}

console.log(`\nYOZILDI: ${updates.length} ta’rif tozalandi (${setCat.length} tasiga turkum berildi).`);
await db.end();
