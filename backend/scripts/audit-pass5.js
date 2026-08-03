import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const out = {};

// 1) Dublikat sarlavhalar (bir xil soz, ikki title)
const [dups] = await db.query(
  `SELECT soz, COUNT(*) n, GROUP_CONCAT(id) ids FROM titles WHERE status=1 GROUP BY soz HAVING n > 1`
);
out.duplicateTitles = dups;

// 2) Ta'rifsiz sarlavhalar
const [noDesc] = await db.query(
  `SELECT t.id, t.soz FROM titles t LEFT JOIN description d ON d.titles_id=t.id
   WHERE t.status=1 AND d.id IS NULL`
);
out.titlesWithoutDescription = noDesc;

// 3) Bo'sh yoki juda qisqa ta'riflar (havola emas)
const [shortDesc] = await db.query(
  `SELECT t.soz, d.id, d.description, c.name category FROM description d
   JOIN titles t ON t.id=d.titles_id LEFT JOIN categorys c ON c.id=d.categorys_id
   WHERE t.status=1 AND CHAR_LENGTH(TRIM(d.description)) < 4`
);
out.veryShortDescriptions = shortDesc;

// 4) Dublikat misollar (bir aniqlamada bir xil matn)
const [dupEx] = await db.query(
  `SELECT descriptions_id, example, COUNT(*) n FROM examples
   GROUP BY descriptions_id, example HAVING n > 1`
);
out.duplicateExamples = dupEx;

// 5) Havolalar: barcha к./қ. yozuvlari nishoni bazada bormi?
const [refs] = await db.query(
  `SELECT t.id, t.soz, d.description FROM description d
   JOIN titles t ON t.id=d.titles_id
   LEFT JOIN categorys c ON c.id=d.categorys_id
   WHERE t.status=1 AND (LOWER(c.name) IN ('к.','қ.') OR d.description REGEXP '^[кқ]\\\\. ')
     AND CHAR_LENGTH(d.description) < 60`
);
const FOLD = (s) => s.toLocaleLowerCase('kk').trim()
  .replace(/қ/g, 'к').replace(/ғ/g, 'г').replace(/ң/g, 'н')
  .replace(/[ўүұ]/g, 'у').replace(/ҳ/g, 'х').replace(/і/g, 'i');
const unresolved = [];
for (const r of refs) {
  const target = r.description.replace(/^[кқ]\.\s*/u, '').replace(/\.$/, '').replace(/\([^)]*\)/g, '').trim();
  if (!target || target.length > 30 || target.split(/\s+/).length > 3) continue;
  const [hit] = await db.query(
    `SELECT id FROM titles WHERE status=1 AND (normalized = ? OR
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(normalized,'қ','к'),'ғ','г'),'ң','н'),'ў','у'),'ү','у'),'ҳ','х') = ?)
     LIMIT 1`,
    [target.toLocaleLowerCase('kk'), FOLD(target)]
  );
  if (!hit.length) unresolved.push({ soz: r.soz, target });
}
out.unresolvedReferences = unresolved;

// 6) Sarlavhada g'alati belgilar
const [oddTitles] = await db.query(
  `SELECT id, soz FROM titles WHERE status=1 AND soz REGEXP '[a-zA-Z0-9]' AND soz NOT REGEXP '[[:space:]](I|II|III|IV|V|VI|VII)$'`
);
out.titlesWithLatinOrDigits = oddTitles;

for (const [k, v] of Object.entries(out)) {
  console.log(`\n=== ${k}: ${v.length}`);
  for (const item of v.slice(0, 25)) console.log('  ', JSON.stringify(item));
}
await db.end();
