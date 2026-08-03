import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

// Tuzatilgan ikkala yozuvni tekshirish
const [r1] = await db.query(
  "SELECT t.soz, c.name category, d.description FROM titles t JOIN description d ON d.titles_id=t.id LEFT JOIN categorys c ON d.categorys_id=c.id WHERE t.soz LIKE '%ТОРС%'"
);
console.log('TORC-TORS:', JSON.stringify(r1, null, 2));

const [r2] = await db.query(
  "SELECT t.soz, t.status FROM titles t WHERE t.soz = 'T' OR t.soz = 'ƏƏНЕТ'"
);
console.log('T title:', JSON.stringify(r2));

const [r3] = await db.query(
  "SELECT COUNT(*) c FROM titles WHERE status=1 AND soz REGEXP BINARY '[A-Za-z]' AND soz NOT REGEXP '^.* [IVX]+$' AND soz NOT REGEXP ' [IVX]+ '"
);
console.log('Qolgan lotin (status=1):', r3[0].c);

const [r4] = await db.query('SELECT COUNT(*) c FROM titles WHERE status=1 AND CHAR_LENGTH(soz) <= 1');
console.log('Qolgan 1-harfli faol:', r4[0].c);

// АЯ, ӘЯ kabi 2 harfli qonuniy sozlar saqlanganini korish
const [r5] = await db.query("SELECT soz, status FROM titles WHERE CHAR_LENGTH(soz)=2 AND status=1 LIMIT 10");
console.log('2 harfli faol (namuna):', r5.map((r) => r.soz).join(', '));

await db.end();
