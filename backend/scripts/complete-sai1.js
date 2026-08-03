import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import { randomUUID } from 'crypto';

const TID = '40b88cf2'; // САЙ І
const DID1 = '2da7d7d9-827e-11f1-a964-50a1323db666'; // 1-ma'no

const [c] = await db.query("SELECT id FROM categorys WHERE LOWER(name)='ат.'");
const atId = c[0].id;
await db.query('UPDATE description SET categorys_id=? WHERE id=? AND categorys_id IS NULL', [atId, DID1]);

// 1-ma'no misollari
const ex1 = [
  { text: 'Бизиң жаўынгерлер кишкене сайдың ишине буққы таслап, жаўдың оңайын ала баслады.', author: 'Ө.Хожаниязов' },
  { text: 'Таўлы еллер кандай сулыў жерге бай! Көркин көрип көзиң тоймас карасан. Соның бири: жасыл қыснақ, терең сай, Гүл төселген қырғыз жери Арашан.', author: 'И.Юсупов' },
];
let order = 1;
for (const e of ex1) {
  await db.query(
    'INSERT INTO examples (id, descriptions_id, sort_order, example, author) VALUES (?,?,?,?,?)',
    [randomUUID().slice(0, 8), DID1, order++, e.text, e.author]
  );
}

// 2-ma'no + misoli
const did2 = randomUUID().slice(0, 8);
await db.query(
  'INSERT INTO description (id, titles_id, categorys_id, description, sort_order) VALUES (?,?,?,?,2)',
  [did2, TID, atId, 'Жайылым суў, суўдың ултаны.']
);
await db.query(
  'INSERT INTO examples (id, descriptions_id, sort_order, example, author) VALUES (?,?,1,?,?)',
  [randomUUID().slice(0, 8), did2, 'Айрықша Айымжамалдың аяғы сайға тиймей кетти.', 'Ө.Хожаниязов']
);

const [check] = await db.query(
  `SELECT d.sort_order, d.description, e.example, e.author
   FROM description d LEFT JOIN examples e ON e.descriptions_id=d.id
   WHERE d.titles_id=? ORDER BY d.sort_order, e.sort_order`,
  [TID]
);
console.log(JSON.stringify(check, null, 2));
await db.end();
