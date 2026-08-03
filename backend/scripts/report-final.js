import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const [[{ titles }]] = await db.query(
  'SELECT COUNT(*) AS titles FROM titles WHERE status = 1'
);
const [[{ descs }]] = await db.query(
  `SELECT COUNT(*) AS descs FROM description d JOIN titles t ON t.id = d.titles_id WHERE t.status = 1`
);
const [[{ belgisiz }]] = await db.query(
  `SELECT COUNT(*) AS belgisiz FROM description d
   JOIN titles t ON t.id = d.titles_id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1 AND (d.categorys_id IS NULL OR LOWER(TRIM(c.name)) IN ('белгисиз','belgisiz'))`
);

console.log('=== YAKUNIY HISOBOT ===');
console.log('Faol so‘zlar (titles):', titles);
console.log('Ta’riflar (descriptions):', descs);
console.log('Belgisiz qolgan ta’rif:', belgisiz, `(${((belgisiz / descs) * 100).toFixed(1)}%)`);
console.log('Turkumlangan:', descs - belgisiz, `(${(((descs - belgisiz) / descs) * 100).toFixed(1)}%)`);

const [top] = await db.query(
  `SELECT c.name, COUNT(d.id) AS n
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1
   GROUP BY c.name ORDER BY n DESC LIMIT 8`
);
console.log('\nAsosiy turkumlar:');
for (const r of top) console.log(`  ${String(r.n).padStart(5)}  ${r.name}`);

// Namuna: tuzatilgan grammatik forma so'z
const [aza] = await db.query(
  `SELECT t.soz, c.name AS category, d.description
   FROM titles t JOIN description d ON d.titles_id = t.id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.soz = 'АЗАПЛАНЫЎ' LIMIT 1`
);
console.log('\nTekshiruv (АЗАПЛАНЫЎ):', aza[0] ? `${aza[0].category} :: ${aza[0].description}` : 'topilmadi');

await db.end();
