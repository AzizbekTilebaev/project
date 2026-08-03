import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const [r] = await db.query(
  `SELECT t.id, t.soz, d.description FROM titles t
   LEFT JOIN description d ON d.titles_id=t.id
   WHERE t.soz LIKE 'ТҮРМЕ%' ORDER BY t.soz`
);
for (const x of r) console.log(x.soz, '::', (x.description || '').slice(0, 90));
await db.end();
