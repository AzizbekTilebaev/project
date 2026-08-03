import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import fs from 'fs';

// Ҳ, «, ( va boshqa qonuniy boshlanishlarni chiqarib tashlagan holda
const [rows] = await db.query(
  `SELECT t.soz, d.description FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1
     AND d.description NOT REGEXP '^[А-ЯЁӘҒҚҢӨҮҰҲҺІЎа-яёәғқңөүұҳһіў0-9\u2039\u00AB(XVI«]'`
);
const out = ['Chinakam g\u2018alati boshlanuvchi: ' + rows.length];
for (const r of rows) out.push(`  ${r.soz} :: ${r.description.slice(0, 70)}`);
fs.writeFileSync('../odd-start.txt', out.join('\n'));
console.log('yozildi:', rows.length);
await db.end();
