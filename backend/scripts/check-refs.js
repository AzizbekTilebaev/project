import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import fs from 'fs';

// Barcha havola-yozuvlar va ularning nishonlari bazada bormi?
const [refs] = await db.query(
  `SELECT t.id, t.soz, c.name cat, d.description
   FROM titles t JOIN description d ON d.titles_id=t.id
   LEFT JOIN categorys c ON d.categorys_id=c.id
   WHERE t.status=1 AND (LOWER(c.name) IN ('к.','қ.') OR d.description REGEXP '^[кқ]\\\\. ')
     AND CHAR_LENGTH(d.description) <= 60`
);
const out = [];
for (const r of refs) {
  const cleaned = r.description.replace(/\([^)]*\)/g, '').trim();
  const target = cleaned.replace(/^[кқ]\.\s*/u, '').replace(/\.$/, '').trim();
  if (!target || target.length > 30 || target.split(/\s+/).length > 3) continue;
  const folded = target
    .toLocaleLowerCase('kk')
    .replace(/\u049B/g, 'к').replace(/\u0493/g, 'г').replace(/\u04A3/g, 'н')
    .replace(/[\u045E\u04AF\u04B1]/g, 'у').replace(/\u04B3/g, 'х').replace(/\u0456/g, 'i');
  const FOLD =
    "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(normalized," +
    "'\u049B','к'),'\u0493','г'),'\u04A3','н'),'\u045E','у'),'\u04AF','у'),'\u04B1','у'),'\u04B3','х'),'\u0456','i')";
  const [hit] = await db.query(
    `SELECT id, soz FROM titles
     WHERE status=1 AND (${FOLD}=? OR ${FOLD} LIKE CONCAT(?, ' %'))
     ORDER BY CASE WHEN ${FOLD}=? THEN 0 ELSE 1 END, \`order\`
     LIMIT 1`,
    [folded, folded, folded]
  );
  out.push(`${hit[0] ? 'OK  ' : 'YO\u2018Q'} ${r.soz} -> "${target}"${hit[0] ? ' => ' + hit[0].soz : ''}`);
}
fs.writeFileSync('../refs.txt', out.join('\n'));
console.log('jami havolalar:', out.length, '| topilmadi:', out.filter((s) => s.startsWith('YO')).length);
await db.end();
