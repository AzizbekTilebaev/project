import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// "T" (status=0) yozuvini ТӘӘНЕТ sifatida tiklash
const [tRows] = await db.query("SELECT id FROM titles WHERE soz='T' AND status=0");
if (!tRows.length) {
  console.log('T yozuvi topilmadi');
} else {
  const tid = tRows[0].id;
  const [c] = await db.query("SELECT id FROM categorys WHERE LOWER(name)='ат.'");
  const cid = c[0].id;
  await db.query(
    "UPDATE titles SET soz='ТӘӘНЕТ', normalized='тәәнет', st_let='Т', status=1 WHERE id=?",
    [tid]
  );
  await db.query(
    "UPDATE description SET description='Ғам, муң.', categorys_id=? WHERE titles_id=?",
    [cid, tid]
  );
  const [check] = await db.query(
    'SELECT t.soz, t.status, c.name category, d.description FROM titles t JOIN description d ON d.titles_id=t.id LEFT JOIN categorys c ON d.categorys_id=c.id WHERE t.id=?',
    [tid]
  );
  console.log('Tiklandi:', JSON.stringify(check, null, 2));
}
await db.end();
