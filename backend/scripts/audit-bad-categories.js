import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

// To'g'ri turkum qisqartmalari (kichik harfda, nuqtasiz taqqoslanadi)
const KNOWN = new Set([
  'ат', 'атлық', 'ф', 'фейил', 'кел', 'келбетлик', 'сан', 'санлық', 'р', 'рәўиш', 'рәў',
  'алм', 'аты', 'белгисиз', 'к', 'қ', 'ке', 'к.с', 'т.с', 'диал.с', 'ел.с', 'аўыс',
  'мед', 'бот', 'зоол', 'геогр', 'астр', 'анат', 'физиол', 'этногр', 'соц', 'юрид',
  'лит', 'муз', 'иск', 'тех', 'физ', 'хим', 'мат', 'биол', 'проф', 'грамм', 'лингв',
  'фраз', 'миф', 'дин.с', 'эт', 'д', 'а', 'фф', 'ф. аўыс', 'грамм. форма',
  'ат. лингв', 'ат.мед', 'ат.тех', 'ат.биол', 'ат. диал.с', 'к.ф', 'фольк', 'фоль',
  'филос', 'фехт', 'спорт', 'тар', 'эск', 'көне', 'жерг', 'сөйл',
]);

function normCat(name) {
  return name
    .toLocaleLowerCase('kk')
    .replace(/\.+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const [cats] = await db.query(
  `SELECT c.id, c.name, COUNT(d.id) AS uses
   FROM categorys c
   LEFT JOIN description d ON d.categorys_id = c.id
   LEFT JOIN titles t ON t.id = d.titles_id AND t.status = 1
   GROUP BY c.id, c.name
   ORDER BY uses DESC`
);

const suspicious = [];
for (const c of cats) {
  const n = normCat(c.name);
  if (KNOWN.has(n)) continue;
  // Ikki qismli kombinatsiyalar: "ат. лингв." kabi hammasi ma'lum bo'lsa OK
  const parts = n.split(/\s+/).map((p) => p.replace(/\.+$/g, ''));
  if (parts.length > 1 && parts.every((p) => KNOWN.has(p))) continue;
  suspicious.push(c);
}

console.log('Shubhali turkum nomlari:', suspicious.length);
for (const c of suspicious) {
  console.log(`  [id ${c.id}] "${c.name}" — ${c.uses} ta’rifda`);
}

// Har biri qaysi so'zlarda ishlatilganini ko'rsatamiz
console.log('\n--- foydalanish tafsiloti ---');
for (const c of suspicious) {
  const [rows] = await db.query(
    `SELECT t.soz, d.description
     FROM description d
     JOIN titles t ON t.id = d.titles_id
     WHERE d.categorys_id = ? AND t.status = 1
     LIMIT 5`,
    [c.id]
  );
  for (const r of rows) {
    console.log(`  "${c.name}" => [${r.soz}] :: ${r.description.slice(0, 70)}`);
  }
}

await db.end();
