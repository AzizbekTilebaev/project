import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WRITE = process.argv.includes('--write');

// Bir xil soz nomli faol titlelar
const [dups] = await db.query(
  `SELECT soz, COUNT(*) AS n, GROUP_CONCAT(id) AS ids
   FROM titles WHERE status = 1
   GROUP BY soz HAVING n > 1`
);

console.log('Dublikat sarlavhalar:', dups.length);
const toDeactivate = [];

for (const d of dups) {
  const ids = d.ids.split(',');
  console.log(`\n[${d.soz}] ${d.n} nusxa:`);
  const details = [];
  for (const id of ids) {
    const [defs] = await db.query(
      `SELECT d.id, d.description FROM description d WHERE d.titles_id = ? ORDER BY d.sort_order`,
      [id]
    );
    const [ex] = await db.query(
      `SELECT COUNT(*) AS n FROM examples e JOIN description d ON d.id = e.descriptions_id WHERE d.titles_id = ?`,
      [id]
    );
    details.push({ id, defs, exCount: ex[0].n });
    console.log(`  id=${id}: ${defs.length} ta’rif, ${ex[0].n} misol`);
    for (const def of defs) console.log(`     - ${def.description.slice(0, 70)}`);
  }
  // Tanlov: ko'proq ta'rif/misolga ega nusxa qoladi
  details.sort((a, b) => b.defs.length - a.defs.length || b.exCount - a.exCount);
  const keep = details[0];
  for (const det of details.slice(1)) {
    // Ta'riflari keep ichida bormi (prefiks taqqoslash)?
    const keepTexts = keep.defs.map((x) => x.description.slice(0, 50));
    const allCovered = det.defs.every((x) =>
      keepTexts.some((k) => k.startsWith(x.description.slice(0, 30)) || x.description.slice(0, 30).startsWith(k.slice(0, 30)))
    );
    console.log(`  -> qoladi: ${keep.id}; o‘chiriladi: ${det.id} (qamrab olingan: ${allCovered})`);
    if (allCovered) toDeactivate.push({ soz: d.soz, id: det.id });
    else console.log(`     DIQQAT: ta’riflar farq qiladi — qo‘lda ko‘rish kerak`);
  }
}

// АЛДАНҒЫШ А va МАТЕРИЯ И — bloklanganlar
for (const pair of [
  { extra: 'АЛДАНҒЫШ А', base: 'АЛДАНҒЫШ' },
  { extra: 'МАТЕРИЯ И', base: 'МАТЕРИЯ' },
]) {
  const [rows] = await db.query('SELECT id FROM titles WHERE soz = ? AND status = 1', [pair.extra]);
  if (!rows.length) continue;
  const [defs] = await db.query('SELECT description FROM description WHERE titles_id = ?', [rows[0].id]);
  const [baseRows] = await db.query('SELECT id FROM titles WHERE soz = ? AND status = 1', [pair.base]);
  const [baseDefs] = baseRows.length
    ? await db.query('SELECT description FROM description WHERE titles_id = ?', [baseRows[0].id])
    : [[]];
  console.log(`\n[${pair.extra}] vs [${pair.base}]`);
  console.log('  extra:', defs.map((x) => x.description.slice(0, 60)));
  console.log('  base :', baseDefs.map((x) => x.description.slice(0, 60)));
}

if (!WRITE) {
  console.log('\nDRY-RUN. O‘chirish uchun: --write');
  await db.end();
  process.exit(0);
}

for (const t of toDeactivate) {
  await db.query('UPDATE titles SET status = 0 WHERE id = ?', [t.id]);
  console.log(`O‘chirildi: ${t.soz} (${t.id})`);
}
await db.end();
