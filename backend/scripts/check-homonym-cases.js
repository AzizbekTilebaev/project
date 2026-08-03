import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const words = ['ҚӘТЕП', 'ТАМҒАСЫЗ', 'ТАМЫЗЫЎ', 'ЕР', 'ТОҚҚЫЗ', 'ӘЯ', 'БЕРЕТ', 'ВИТАМИН', 'БЕДУИН', 'МАҚБАРА', 'УСТУХАН'];
for (const w of words) {
  const [rows] = await db.query(
    `SELECT t.id, t.soz, d.id AS desc_id, c.name AS category, d.description
     FROM titles t
     LEFT JOIN description d ON d.titles_id = t.id
     LEFT JOIN categorys c ON d.categorys_id = c.id
     WHERE t.soz = ? OR t.soz LIKE CONCAT(?, ' %')
     ORDER BY t.soz`,
    [w, w]
  );
  console.log('\n#### ' + w + ' (' + rows.length + ')');
  for (const r of rows) {
    console.log(`- [${r.id}] ${r.soz} | desc=${r.desc_id} | kat=${r.category || '-'}`);
    console.log('  ' + (r.description || '').slice(0, 400));
  }
}
await db.end();
