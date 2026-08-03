import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const [rows] = await db.query(
  `SELECT t.id, t.soz, d.description
   FROM titles t
   JOIN description d ON d.titles_id = t.id
   WHERE t.status = 1 AND (t.soz = 'ЫҚ' OR t.soz LIKE 'ЫҚ %')
   ORDER BY t.soz, d.sort_order`
);
for (const r of rows) {
  console.log(`[${r.soz}] (${r.id}) ${r.description.slice(0, 100)}`);
}
await db.end();
