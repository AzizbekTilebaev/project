import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const words = process.argv.slice(2);
for (const word of words) {
  const [rows] = await db.query(
    `SELECT id, soz
     FROM titles
     WHERE status = 1 AND soz LIKE CONCAT('%', ?, '%')
     ORDER BY CHAR_LENGTH(soz), \`order\`
     LIMIT 12`,
    [word]
  );
  console.log(`${word}: ${rows.map((row) => row.soz).join(' | ') || '—'}`);
}

await db.end();
