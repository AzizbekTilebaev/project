import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

// Manbada yo'q variantlar tufayli qolgan bo'shliqlarni ketma-ket raqamlash
const RENUM = [
  { from: 'ТҮРМЕ ІІ', to: 'ТҮРМЕ І' },
  { from: 'ТҮРМЕ ІІІ', to: 'ТҮРМЕ ІІ' },
  { from: 'ҒАРҚ ІІІ', to: 'ҒАРҚ ІІ' },
  { from: 'ИЛИЎ ІІІ', to: 'ИЛИЎ ІІ' },
  { from: 'ТАП VI', to: 'ТАП V' },
];

for (const r of RENUM) {
  const [rows] = await db.query(
    'SELECT id FROM titles WHERE soz = ? AND status = 1',
    [r.from]
  );
  if (!rows.length) {
    console.log(`YO‘Q: ${r.from}`);
    continue;
  }
  const [taken] = await db.query(
    'SELECT id FROM titles WHERE soz = ? AND status = 1',
    [r.to]
  );
  if (taken.length) {
    console.log(`BAND: ${r.to} — ${r.from} o‘zgartirilmadi`);
    continue;
  }
  await db.query(
    'UPDATE titles SET soz = ?, normalized = ? WHERE id = ?',
    [r.to, r.to.toLocaleLowerCase('kk'), rows[0].id]
  );
  console.log(`OK: ${r.from} -> ${r.to}`);
}

await db.end();
