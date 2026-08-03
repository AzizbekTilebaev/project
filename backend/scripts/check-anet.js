import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const [r1] = await db.query(
  "SELECT t.soz, t.status, c.name category, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id LEFT JOIN categorys c ON d.categorys_id=c.id WHERE t.normalized LIKE '%нет' AND CHAR_LENGTH(t.soz) <= 6 LIMIT 15"
);
console.log(JSON.stringify(r1, null, 2));

const [r2] = await db.query("SELECT COUNT(*) c FROM titles WHERE status=1");
console.log('Faol titlelar:', r2[0].c);
await db.end();
