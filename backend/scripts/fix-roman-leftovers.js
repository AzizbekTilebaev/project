import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

// 1) Raqamsiz ЫҚ (dc305297) — ЫҚ І + ЫҚ ІІ ni ichiga olgan eski dublikat
const [dup] = await db.query(
  `SELECT id, soz FROM titles WHERE id = 'dc305297' AND soz = 'ЫҚ' AND status = 1`
);
if (dup.length) {
  await db.query(`UPDATE titles SET status = 0 WHERE id = 'dc305297'`);
  console.log('ЫҚ (dublikat) o‘chirildi (status=0).');
} else {
  console.log('ЫҚ dublikati topilmadi yoki allaqachon o‘chirilgan.');
}

// 2) КАЗЫҚША ІІ -> ҚАЗЫҚША ІІ (OCR: К -> Қ)
const [kaz] = await db.query(
  `SELECT id FROM titles WHERE soz = 'КАЗЫҚША ІІ' AND status = 1`
);
if (kaz.length) {
  await db.query(
    `UPDATE titles SET soz = 'ҚАЗЫҚША ІІ', normalized = 'қазықша іі', st_let = 'Қ' WHERE id = ?`,
    [kaz[0].id]
  );
  console.log('КАЗЫҚША ІІ -> ҚАЗЫҚША ІІ tuzatildi.');
} else {
  console.log('КАЗЫҚША ІІ topilmadi.');
}

await db.end();
