import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const ids = ['fa149fa7']; // ЕР І
for (const id of ids) {
  const [[d]] = await db.query('SELECT id, description FROM description WHERE id = ?', [id]);
  console.log('=== desc', id);
  console.log(d?.description);
}

const [termit] = await db.query(
  `SELECT t.soz, d.id, d.description FROM titles t JOIN description d ON d.titles_id = t.id WHERE t.soz LIKE 'ТЕРМИТ%' OR t.soz = 'ТЕРМО'`
);
for (const r of termit) {
  console.log('\n===', r.soz, '| desc', r.id);
  console.log(r.description);
}

const [tam] = await db.query(`SELECT soz FROM titles WHERE soz LIKE 'ТАМЫЗ%'`);
console.log('\nТАМЫЗ* mavjudlari:', tam.map((r) => r.soz));

await db.end();
