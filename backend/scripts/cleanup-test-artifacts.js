// Test/smoke artefaktlarini tozalash (comp_*, testsin_*, smoke_* prefikslari)
import db from '../src/config/dictionary.db.js';

const PREFIXES = ['comp\\_%', 'testsin\\_%', 'smoke\\_%'];

let total = 0;
for (const p of PREFIXES) {
  const [r1] = await db.query(
    `DELETE cw FROM compound_words cw
     JOIN titles t ON t.id = cw.component_title_id
     WHERE t.soz LIKE ?`,
    [p]
  );
  const [r2] = await db.query(
    `DELETE sgd FROM synonym_group_descriptions sgd
     JOIN description d ON d.id = sgd.description_id
     JOIN titles t ON t.id = d.titles_id
     WHERE t.soz LIKE ?`,
    [p]
  );
  const [r3] = await db.query(
    `DELETE da FROM description_antonyms da
     JOIN description d ON d.id = da.description_id_a OR d.id = da.description_id_b
     JOIN titles t ON t.id = d.titles_id
     WHERE t.soz LIKE ?`,
    [p]
  );
  const [r4] = await db.query(
    `DELETE d FROM description d
     JOIN titles t ON t.id = d.titles_id
     WHERE t.soz LIKE ? AND t.status = 0`,
    [p]
  );
  const [r5] = await db.query(`DELETE FROM titles WHERE soz LIKE ? AND status = 0`, [p]);
  const [r6] = await db.query(`DELETE FROM community_suggestions WHERE suggested_word LIKE ?`, [p]);
  total +=
    (r1.affectedRows || 0) +
    (r2.affectedRows || 0) +
    (r3.affectedRows || 0) +
    (r4.affectedRows || 0) +
    (r5.affectedRows || 0) +
    (r6.affectedRows || 0);
}

// Bo'sh qolgan sinonim guruhlar
const [r7] = await db.query(
  `DELETE sg FROM synonym_groups sg
   LEFT JOIN synonym_group_descriptions sgd ON sgd.group_id = sg.id
   WHERE sgd.id IS NULL`
);
total += r7.affectedRows || 0;

console.log(`✅ Tozalandi: ${total} yozuv`);
await db.end();
