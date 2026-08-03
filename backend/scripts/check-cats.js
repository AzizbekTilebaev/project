import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const [cats] = await db.query(
  `SELECT c.id, c.name, COUNT(d.id) AS uses
   FROM categorys c
   LEFT JOIN description d ON d.categorys_id = c.id
   GROUP BY c.id, c.name
   ORDER BY uses DESC
   LIMIT 40`
);
console.log('Eng ko‘p ishlatilgan turkumlar:');
for (const c of cats) console.log(`  ${String(c.uses).padStart(5)}  [${c.id}] ${c.name}`);

// feyil bilan bog'liq variantlar
const [feyil] = await db.query(
  `SELECT id, name FROM categorys WHERE name LIKE '%ф%' OR name LIKE '%фейил%'`
);
console.log('\nFeyil variantlari:', feyil.map((f) => `${f.name}`).join(' | '));

await db.end();
