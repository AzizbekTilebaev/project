import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

// АЛДАНҒЫШ А va МАТЕРИЯ И — asosiy so'z band bo'lgani uchun rename bo'lmagan
// dublikatlar. Ta'rifi asosiy so'zga ikkinchi ma'no sifatida ko'chiriladi.
const MERGES = [
  {
    extra: 'АЛДАНҒЫШ А',
    base: 'АЛДАНҒЫШ',
    cleanDef: (d) => d.trim(),
  },
  {
    extra: 'МАТЕРИЯ И',
    base: 'МАТЕРИЯ',
    // "И ат. Барлық..." -> "Барлық..."
    cleanDef: (d) => d.replace(/^И\s+ат\.\s*/iu, '').trim(),
  },
];

for (const m of MERGES) {
  const [[extra]] = await db.query(
    'SELECT id FROM titles WHERE soz = ? AND status = 1',
    [m.extra]
  );
  const [[base]] = await db.query(
    'SELECT id FROM titles WHERE soz = ? AND status = 1',
    [m.base]
  );
  if (!extra || !base) {
    console.log(`O‘TKAZILDI: ${m.extra} yoki ${m.base} topilmadi`);
    continue;
  }

  const [extraDefs] = await db.query(
    'SELECT id, description, categorys_id FROM description WHERE titles_id = ?',
    [extra.id]
  );
  const [[{ maxOrder }]] = await db.query(
    'SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM description WHERE titles_id = ?',
    [base.id]
  );

  let order = maxOrder;
  for (const def of extraDefs) {
    order++;
    const cleaned = m.cleanDef(def.description);
    // ta'rifni bazaga ko'chiramiz (misollar descriptions_id orqali bog'langan,
    // shuning uchun descriptionni ko'chirsak misollar ham birga o'tadi)
    await db.query(
      'UPDATE description SET titles_id = ?, description = ?, sort_order = ? WHERE id = ?',
      [base.id, cleaned, order, def.id]
    );
    console.log(`${m.extra} -> ${m.base}: "${cleaned.slice(0, 60)}" (order ${order})`);
  }

  await db.query('UPDATE titles SET status = 0 WHERE id = ?', [extra.id]);
  console.log(`${m.extra} o‘chirildi (status=0).`);
}

await db.end();
