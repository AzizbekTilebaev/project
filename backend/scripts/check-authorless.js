import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const [rows] = await db.query(
  `SELECT e.example, e.author, t.soz
   FROM examples e
   JOIN description d ON e.descriptions_id = d.id
   JOIN titles t ON d.titles_id = t.id
   WHERE e.author IS NULL OR e.author = ''`
);
console.log('Avtorsiz misollar soni:', rows.length);
for (const r of rows.slice(0, 20)) {
  console.log(' -', r.soz, '::', r.example.slice(0, 70));
}

// Umumiy statistika
const [[{ tc }]] = await db.query('SELECT COUNT(*) tc FROM titles');
const [[{ ec }]] = await db.query('SELECT COUNT(*) ec FROM examples');
const [[{ eauth }]] = await db.query(
  "SELECT COUNT(*) eauth FROM examples WHERE author IS NOT NULL AND author <> ''"
);
console.log(`\nTitles: ${tc} | Examples: ${ec} | avtorli: ${eauth}`);
await db.end();
