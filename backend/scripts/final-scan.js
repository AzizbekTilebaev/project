import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// Faqat raqam/rim raqamdan iborat titlelar
const [r1] = await db.query(
  "SELECT t.soz, d.description FROM titles t LEFT JOIN description d ON d.titles_id=t.id WHERE t.status=1 AND t.soz REGEXP '^[IVXІ0-9 .-]+$'"
);
console.log('Raqam-titlelar:', r1.length);
for (const r of r1) console.log(' -', JSON.stringify(r.soz), '::', (r.description || '').slice(0, 60));

// Lotin qolganlar (homonim raqamlaridan tashqari)
const [r2] = await db.query(
  "SELECT soz FROM titles WHERE status=1 AND soz REGEXP BINARY '[A-Za-z]' AND soz NOT REGEXP ' [IVX]+$'"
);
console.log('Lotin qolganlar:', r2.length);
for (const r of r2) console.log(' -', r.soz);
await db.end();
