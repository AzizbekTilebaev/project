import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const [r] = await db.query('SHOW CREATE TABLE description');
console.log(r[0]['Create Table']);

const [r2] = await db.query("SELECT COUNT(*) c FROM description WHERE id='' OR id='0'");
console.log('bo\u2018sh id li descriptionlar:', r2[0].c);

const [r3] = await db.query(
  "SELECT d.id, t.soz, d.description FROM description d JOIN titles t ON d.titles_id=t.id WHERE d.id='' OR d.id='0' LIMIT 40"
);
for (const x of r3) console.log(' -', JSON.stringify(x.id), x.soz, '::', x.description.slice(0, 40));
await db.end();
