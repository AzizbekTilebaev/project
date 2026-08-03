import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const [r] = await db.query(
  "SELECT t.id, t.soz, t.status, t.normalized, d.id did, d.sort_order, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id WHERE t.soz='САЙ І' ORDER BY d.sort_order"
);
console.log(JSON.stringify(r, null, 2));
if (r[0]) {
  const [ex] = await db.query(
    "SELECT e.example, e.author FROM examples e JOIN description d ON e.descriptions_id=d.id WHERE d.titles_id=?",
    [r[0].id]
  );
  console.log('Misollar:', JSON.stringify(ex, null, 2));
}
await db.end();
