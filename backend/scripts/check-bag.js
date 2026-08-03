import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const [rows] = await db.query(
  `SELECT t.id, t.soz, d.id AS did, d.sort_order, c.name category, d.description
   FROM titles t
   LEFT JOIN description d ON d.titles_id=t.id
   LEFT JOIN categorys c ON d.categorys_id=c.id
   WHERE t.soz='БАҒ' OR t.soz LIKE 'БАҒ %' OR t.soz LIKE 'БАҒ_%'
   ORDER BY t.soz, d.sort_order`
);
for (const r of rows) {
  console.log(`\n[${r.id}] ${r.soz} | did=${r.did} #${r.sort_order} | kat=${r.category || '-'}`);
  console.log('  ' + (r.description || ''));
  const [ex] = await db.query('SELECT example, author FROM examples WHERE descriptions_id=? ORDER BY sort_order', [r.did]);
  for (const e of ex) console.log('    misol: ' + e.example + '  (' + (e.author || '') + ')');
}
await db.end();
