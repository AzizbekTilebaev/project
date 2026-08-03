import db from '../src/config/dictionary.db.js';

// Ta'rifi to'liq BOSH HARFDAN iborat (kesilgan OCR bo'lagi) bo'lgan yozuvlarni topamiz
const [rows] = await db.query(
  `SELECT t.id, t.soz, d.id AS desc_id, d.description
   FROM titles t
   JOIN description d ON d.titles_id = t.id
   WHERE t.status = 1
     AND CHAR_LENGTH(d.description) >= 6
     AND BINARY d.description = BINARY UPPER(d.description)
     AND BINARY d.description != BINARY LOWER(d.description)`
);

const byTitle = new Map();
for (const r of rows) {
  if (!byTitle.has(r.id)) byTitle.set(r.id, { soz: r.soz, descs: [] });
  byTitle.get(r.id).descs.push(r.description);
}

console.log(`Faqat bosh harfli ta'rifi bor yozuvlar: ${byTitle.size}`);
for (const [id, info] of byTitle) {
  console.log(` ${id}  ${info.soz}  ->  ${info.descs.join(' | ').slice(0, 90)}`);
}

// Nechta ta'rifi borligini tekshiramiz — bitta bo'lsa va u ham bo'lak bo'lsa, yozuv yaroqsiz
const apply = process.argv.includes('--apply');
if (apply) {
  let off = 0;
  for (const [id] of byTitle) {
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) AS total FROM description WHERE titles_id = ?',
      [id]
    );
    const [[{ bad }]] = await db.query(
      `SELECT COUNT(*) AS bad FROM description
       WHERE titles_id = ?
         AND BINARY description = BINARY UPPER(description)
         AND BINARY description != BINARY LOWER(description)`,
      [id]
    );
    if (total === bad) {
      await db.query('UPDATE titles SET status = 0 WHERE id = ?', [id]);
      off++;
    }
  }
  console.log(`\n${off} ta yaroqsiz yozuv o'chirildi (status=0).`);
} else {
  console.log('\nDry-run. Qo‘llash uchun: node scripts/fix-fragment-titles.js --apply');
}
await db.end();
