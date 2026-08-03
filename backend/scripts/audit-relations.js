import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const [tables] = await db.query(
  `SELECT TABLE_NAME
   FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME IN ('sinonimler', 'antonimler', 'word_relations')`
);
console.log('Munosabat jadvallari:', tables.map((row) => row.TABLE_NAME));

for (const table of tables.map((row) => row.TABLE_NAME)) {
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
  const [columns] = await db.query(
    `SELECT COLUMN_NAME, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [table]
  );
  console.log(`\n${table}: ${total} qator`);
  console.log(columns.map((column) => `${column.COLUMN_NAME}:${column.COLUMN_TYPE}`).join(', '));
}

const [explicit] = await db.query(
  `SELECT t.soz, d.description
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   WHERE t.status = 1
     AND (
       LOWER(d.description) LIKE '%синоним%'
       OR LOWER(d.description) LIKE '%антоним%'
       OR LOWER(d.description) LIKE '%мәнилес%'
       OR LOWER(d.description) LIKE '%қарсы мәни%'
     )
   ORDER BY t.\`order\`
   LIMIT 100`
);
console.log(`\nTa’rifdagi aniq markerlar: ${explicit.length} namuna`);
for (const row of explicit) {
  console.log(`${row.soz} :: ${row.description.slice(0, 180)}`);
}

await db.end();
