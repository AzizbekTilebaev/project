import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const [r1] = await db.query(
  "SELECT t.id, t.soz, t.status, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id WHERE t.normalized LIKE 'сай%' ORDER BY t.soz LIMIT 25"
);
for (const r of r1) console.log(r.soz, '| status', r.status, '::', (r.description || '').slice(0, 60));

const [r2] = await db.query(
  "SELECT t.id, t.soz, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id WHERE t.soz IN ('III', 'XVI-XVIII')"
);
console.log('\nBuzuq titlelar:', JSON.stringify(r2, null, 2));
await db.end();
