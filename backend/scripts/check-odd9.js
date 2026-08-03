import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const [r1] = await db.query(
  "SELECT t.id, t.soz, d.id did, d.description FROM titles t JOIN description d ON d.titles_id=t.id WHERE t.soz IN ('АСТРОФОТОГРАФИЯ','САЗ','ҚАЙЫР','ЖҮЗ','КЕМЛЕЎ','ӘГАР','АЛА ҒАРҒА') OR t.soz LIKE '%.'"
);
for (const r of r1) console.log(`[${r.id}|${r.did}] ${JSON.stringify(r.soz)} :: ${r.description}`);

// mavjud omonimlarni tekshirish
const [r2] = await db.query(
  "SELECT soz FROM titles WHERE status=1 AND (normalized LIKE 'саз %' OR normalized LIKE 'жүз %' OR normalized LIKE 'қайыр%' OR normalized LIKE 'асық%' OR normalized LIKE 'ашшылаў%') ORDER BY soz"
);
console.log('\nOmonimlar:', r2.map((x) => x.soz).join(' | '));
await db.end();
