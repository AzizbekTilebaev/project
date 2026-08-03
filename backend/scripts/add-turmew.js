import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import { randomUUID } from 'crypto';

const uid = () => randomUUID().slice(0, 8);
const [exists] = await db.query("SELECT id FROM titles WHERE soz='ТҮРМЕЎ'");
if (exists.length) {
  console.log('ТҮРМЕЎ allaqachon bor');
} else {
  const [c] = await db.query("SELECT id FROM categorys WHERE LOWER(name)='ф.'");
  const cid = c[0].id;
  const tid = uid();
  await db.query(
    'INSERT INTO titles (id, soz, normalized, st_let, status, `order`) SELECT ?,?,?,?,1, COALESCE(MAX(`order`),0)+1 FROM titles',
    [tid, 'ТҮРМЕЎ', 'түрмеў', 'Т']
  );
  const did = uid();
  await db.query(
    'INSERT INTO description (id, titles_id, categorys_id, description, sort_order) VALUES (?,?,?,?,1)',
    [did, tid, cid, 'Бир затты көтермеў, жыйнамаў, қайырмаў.']
  );
  await db.query(
    'INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved) VALUES (?,?,?,?,1,1)',
    [uid(), did, 'Үйдиң есигин жоқары түрмеў керек, — деди ғарры', 'Қ.Айымбетов']
  );
  console.log('ТҮРМЕЎ qo\u2018shildi');
}
await db.end();
