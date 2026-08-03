import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

async function catId(name) {
  const [c] = await db.query('SELECT id FROM categorys WHERE LOWER(name)=LOWER(?)', [name]);
  if (c[0]) return c[0].id;
  const [ins] = await db.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
    `cat_${name}`, name, name.replace(/\./g, ''),
  ]);
  return ins.insertId;
}

// ҮШ АҒАШ: ta'rif boshidagi "тар.с." kategoriya ustuniga o'tsin
await db.query(
  `UPDATE description d JOIN titles t ON t.id=d.titles_id
   SET d.description='Дар мәнисинде.', d.categorys_id=?
   WHERE t.soz='ҮШ АҒАШ' AND d.description LIKE 'тар.с.%'`,
  [await catId('тар.с.')]
);

// ГИДРОЭЛЕКТРОСТАНЦИЯ: "(ГЭС) ат." qoldig'ini tozalash
await db.query(
  `UPDATE description d JOIN titles t ON t.id=d.titles_id
   SET d.description='(ГЭС) Суўдың жоқарыдан қулап ағыў күшин пайдаланыў арқалы электр қуўатын ислеп шығарыўшы электростанция.', d.categorys_id=?
   WHERE t.soz='ГИДРОЭЛЕКТРОСТАНЦИЯ'`,
  [await catId('ат.')]
);

const [check] = await db.query(
  `SELECT t.soz, c.name category, d.description FROM titles t
   JOIN description d ON d.titles_id=t.id LEFT JOIN categorys c ON d.categorys_id=c.id
   WHERE t.soz IN ('ҮШ АҒАШ','ГИДРОЭЛЕКТРОСТАНЦИЯ')`
);
for (const r of check) console.log(`${r.soz} [${r.category}] ${r.description}`);
await db.end();
