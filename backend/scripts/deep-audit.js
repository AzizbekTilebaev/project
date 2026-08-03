import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import fs from 'fs';

const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };

// 1. POS qoldig'i bilan tugaydigan titlelar: "... Ф." / "... К." / "... АТ."
const [posTail] = await db.query(
  "SELECT id, soz FROM titles WHERE status=1 AND soz REGEXP BINARY ' (Ф|АТ|КЕЛ|К|РӘЎ)\\\\.?$'"
);
log('\n[1] POS qoldiqli titlelar:', posTail.length);
for (const r of posTail) log('   ', r.soz);

// 2. Dublikat titlelar
const [dups] = await db.query(
  "SELECT soz, COUNT(*) c FROM titles WHERE status=1 GROUP BY soz HAVING c > 1 ORDER BY c DESC"
);
log('\n[2] Dublikat titlelar:', dups.length);
for (const r of dups.slice(0, 30)) log('   ', r.soz, 'x' + r.c);

// 3. Juda qisqa yoki buzuq ta'riflar
const [shortDefs] = await db.query(
  `SELECT t.soz, d.id, d.description FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND CHAR_LENGTH(TRIM(d.description)) < 8`
);
log('\n[3] Qisqa ta\u2019riflar (<8 belgi):', shortDefs.length);
for (const r of shortDefs) log('   ', r.soz, '::', JSON.stringify(r.description));

// 4. Tinish belgisi/kichik harf bilan boshlanuvchi ta'riflar (qochirma "қ." dan tashqari)
const [oddStart] = await db.query(
  `SELECT t.soz, d.description FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND d.description REGEXP '^[^А-ЯЁӘҒҚҢӨҮҰҺІЎа-яёәғқңөүұһіў0-9XVI]'`
);
log('\n[4] G\u2018alati boshlanuvchi ta\u2019riflar:', oddStart.length);
for (const r of oddStart.slice(0, 30)) log('   ', r.soz, '::', r.description.slice(0, 55));

// 5. Ta'rif ichida hali ham KATTA HARFLI ikkinchi maqola qolganlar
const [merged] = await db.query(
  `SELECT t.soz, d.description FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND d.description REGEXP BINARY '[[:space:]][А-ЯӘҒҚҢӨҮҰҺІЁЎ-]{5,}[[:space:]]+(Ф|АТ|КЕЛ|РӘЎ)\\\\.'`
);
log('\n[5] Ichida 2-maqola qolganlar:', merged.length);
for (const r of merged.slice(0, 20)) log('   ', r.soz, '::', r.description.slice(0, 70));

// 6. Bullet/OCR artefaktli ta'riflar
const [bullets] = await db.query(
  `SELECT t.soz, d.description FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND (d.description LIKE '%\u2022%' OR d.description LIKE '%|%' OR d.description LIKE '%~%' OR d.description REGEXP '[[:space:]][[:space:]]')`
);
log('\n[6] Artefaktli ta\u2019riflar (\u2022 | ~ juft probel):', bullets.length);
for (const r of bullets.slice(0, 20)) log('   ', r.soz, '::', r.description.slice(0, 60));

// 7. Avtorsiz misollar
const [noAuthor] = await db.query(
  `SELECT COUNT(*) c FROM examples e JOIN description d ON e.descriptions_id=d.id JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND (e.author IS NULL OR e.author='')`
);
log('\n[7] Avtorsiz misollar:', noAuthor[0].c);

// 8. Ta'rifsiz titlelar
const [noDef] = await db.query(
  `SELECT t.id, t.soz FROM titles t LEFT JOIN description d ON d.titles_id=t.id
   WHERE t.status=1 AND d.id IS NULL`
);
log('\n[8] Ta\u2019rifsiz titlelar:', noDef.length);
for (const r of noDef.slice(0, 20)) log('   ', r.soz);

// 9. Title ichida raqam yoki g'alati belgilar
const [oddTitle] = await db.query(
  "SELECT soz FROM titles WHERE status=1 AND soz REGEXP '[0-9;:,!?()\\\\[\\\\]{}=+*/\\\\\\\\]'"
);
log('\n[9] Raqam/belgili titlelar:', oddTitle.length);
for (const r of oddTitle.slice(0, 20)) log('   ', JSON.stringify(r.soz));

// 10. Ta'rif nuqtasiz, "..." yoki vergul bilan tugaydiganlar (kesilgan bo'lishi mumkin)
const [truncDefs] = await db.query(
  `SELECT t.soz, d.description FROM description d JOIN titles t ON d.titles_id=t.id
   WHERE t.status=1 AND d.description REGEXP '[,;:-]$'`
);
log('\n[10] Vergul/ikkinuqta bilan tugagan ta\u2019riflar:', truncDefs.length);
for (const r of truncDefs.slice(0, 20)) log('   ', r.soz, '::', '...' + r.description.slice(-40));

// 11. Bir xil descriptionsga ega dublikat misollar
const [dupEx] = await db.query(
  `SELECT e.descriptions_id, e.example, COUNT(*) c FROM examples e GROUP BY e.descriptions_id, e.example HAVING c>1`
);
log('\n[11] Dublikat misollar:', dupEx.length);

fs.writeFileSync('../audit-report.txt', out.join('\n'));
await db.end();
