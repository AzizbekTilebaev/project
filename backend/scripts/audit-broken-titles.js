import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// 1. Ko'rsatilgan ikkita yozuv
const [rows1] = await db.query(
  "SELECT t.id, t.soz, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id WHERE t.soz LIKE '%TOPC%' OR t.soz LIKE '%ТОПС%'"
);
console.log('TOPC entries:', JSON.stringify(rows1, null, 2));

const [rows2] = await db.query(
  "SELECT t.id, t.soz, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id WHERE CHAR_LENGTH(t.soz) <= 2"
);
console.log('\nQisqa (<=2 harf) titlelar:', rows2.length);
for (const r of rows2.slice(0, 15)) console.log(' -', JSON.stringify(r.soz), '::', (r.description || '').slice(0, 60));

// 2. Lotin harflari aralashgan titlelar
const [rows3] = await db.query(
  "SELECT id, soz FROM titles WHERE soz REGEXP BINARY '[A-Za-z]' AND status = 1"
);
console.log('\nLotin aralash titlelar:', rows3.length);
for (const r of rows3.slice(0, 20)) console.log(' -', r.soz);

// 3. Ta'rif bosh so'z bilan boshlanadi (KATTA HARFLAR + POS)
const [rows4] = await db.query(
  "SELECT t.soz, d.description FROM description d JOIN titles t ON d.titles_id=t.id WHERE d.description REGEXP BINARY '^[А-ЯӘҒҚҢӨҮҰҺІA-Z\u0400-\u042F]{2,}[[:space:]]+(ат|ф|кел|Ф|АТ)\\\\.' LIMIT 15"
);
console.log('\nTa\u2019rifi bosh soz bilan boshlanganlar (namuna):', rows4.length);
for (const r of rows4) console.log(' -', r.soz, '::', r.description.slice(0, 70));

await db.end();
