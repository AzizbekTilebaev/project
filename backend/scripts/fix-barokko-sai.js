import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import { randomUUID } from 'crypto';

async function catId(name) {
  const [c] = await db.query('SELECT id FROM categorys WHERE LOWER(name)=?', [name]);
  if (c[0]) return c[0].id;
  const [ins] = await db.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
    `cat_${name}`, name, name.replace('.', ''),
  ]);
  return ins.insertId;
}

const atId = await catId('ат.');

// 1) XVI-XVIII -> БАРОККО (manba: fordata 0038.json, БАРЛЫҚ ІІ dan keyin)
await db.query(
  "UPDATE titles SET soz='БАРОККО', normalized='барокко', st_let='Б' WHERE id='3fdb9978'"
);
await db.query(
  "UPDATE description SET description='XVI-XVIII әсирлердеги Батыс Европадағы аса әшекөйли, сулыў архитектуралық ҳәм скульптуралық стиль.', categorys_id=? WHERE titles_id='3fdb9978'",
  [atId]
);
console.log('XVI-XVIII -> БАРОККО');

// 2) III -> САЙ ІІІ (manba: fordata 0387.json boshi, САЗШЫЛЫҚ...САЙЛАСЫЎ orasida)
await db.query(
  "UPDATE titles SET soz='САЙ ІІІ', normalized='сай ііі', st_let='С' WHERE id='c090ec89'"
);
await db.query(
  "UPDATE description SET categorys_id=? WHERE titles_id='c090ec89' AND categorys_id IS NULL",
  [atId]
);
console.log('III -> САЙ ІІІ');

// 3) Yo'q homonimlarni manbadan qo'shish (fordata 0356.json)
const NEW_ENTRIES = [
  {
    soz: 'САЙ І',
    senses: [
      {
        def: 'Еки бәлентлик ямаса таў арасында ағын суў нәтийжесинде пайда болған аңғар, жыра.',
        examples: [
          { text: 'Бизиң жаўынгерлер кишкене сайдың ишине буққы таслап, жаўдың оңайын ала баслады.', author: 'Ө.Хожаниязов' },
          { text: 'Таўлы еллер кандай сулыў жерге бай! Көркин көрип көзиң тоймас карасан. Соның бири: жасыл қыснақ, терең сай, Гүл төселген қырғыз жери Арашан.', author: 'И.Юсупов' },
        ],
      },
      {
        def: 'Жайылым суў, суўдың ултаны.',
        examples: [
          { text: 'Айрықша Айымжамалдың аяғы сайға тиймей кетти.', author: 'Ө.Хожаниязов' },
        ],
      },
    ],
  },
  {
    soz: 'САЙ ІІ',
    senses: [
      {
        def: 'Саз, пүтин, тайын, ылайық, тең, сәйкес.',
        examples: [
          { text: 'Ғош жигиттиң аты-тоны сай болса, алған яры ақыл, өзине тай болса.', author: 'Әжинияз' },
          { text: 'Жасына сай кийимлери де өзгешелеў.', author: 'К.Султанов' },
          { text: 'Моторының куўатына кузовының аўырлығы сай келмес еди.', author: 'М.Нызанов' },
        ],
      },
    ],
  },
];

for (const entry of NEW_ENTRIES) {
  const [exists] = await db.query('SELECT id FROM titles WHERE soz=?', [entry.soz]);
  if (exists.length) { console.log('bor, o\u2018tkazildi:', entry.soz); continue; }
  const tid = randomUUID().slice(0, 8);
  await db.query(
    "INSERT INTO titles (id, soz, normalized, st_let, status) VALUES (?,?,?,?,1)",
    [tid, entry.soz, entry.soz.toLocaleLowerCase('kk'), entry.soz.charAt(0)]
  );
  let order = 1;
  for (const sense of entry.senses) {
    const did = randomUUID().slice(0, 8);
    await db.query(
      'INSERT INTO description (id, titles_id, categorys_id, description, sort_order) VALUES (?,?,?,?,?)',
      [did, tid, atId, sense.def, order++]
    );
    let exOrder = 1;
    for (const ex of sense.examples) {
      await db.query(
        'INSERT INTO examples (id, descriptions_id, sort_order, example, author) VALUES (?,?,?,?,?)',
        [randomUUID().slice(0, 8), did, exOrder++, ex.text, ex.author]
      );
    }
  }
  console.log('qo\u2018shildi:', entry.soz, `(${entry.senses.length} ma'no)`);
}

// Tekshirish
const [check] = await db.query(
  "SELECT t.soz, c.name category, d.description FROM titles t JOIN description d ON d.titles_id=t.id LEFT JOIN categorys c ON d.categorys_id=c.id WHERE t.normalized LIKE 'сай %' OR t.normalized='барокко' ORDER BY t.soz, d.sort_order"
);
console.log('\nYakuniy holat:');
for (const r of check) console.log(` ${r.soz} [${r.category}] ${r.description.slice(0, 70)}`);

await db.end();
