import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const words = process.argv.slice(2);
for (const word of words) {
  const [rows] = await db.query(
    `SELECT t.id, t.soz, c.name AS category, d.description
     FROM titles t
     JOIN description d ON d.titles_id = t.id
     LEFT JOIN categorys c ON c.id = d.categorys_id
     WHERE t.status = 1 AND (t.soz = ? OR t.soz LIKE CONCAT(?, ' %'))
     ORDER BY t.\`order\`, d.sort_order`,
    [word, word]
  );
  console.log(`\n=== ${word} ===`);
  for (const row of rows) {
    console.log(`[${row.soz}] ${row.category || ''} :: ${row.description}`);
  }
}

await db.end();
