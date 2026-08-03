/**
 * Fix САЗ I–V homonyms to match authoritative senses.
 * Run: node scripts/fix-saz-homonyms.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { default: db } = await import('../src/config/dictionary.db.js');

function id8() {
  return randomBytes(4).toString('hex');
}

const SENSES = [
  {
    soz: 'САЗ І',
    normalized: 'саз і',
    category: 'ат.',
    definition: 'Музыка, шертилетуғын нама.',
    examples: [
      {
        example: 'Қартайғанда саз үйренип, ақыретте шертесең бе?',
        author: 'кк.х.н.',
      },
      {
        example: 'Қолында тилла сазыңды, ат көтермес назыңды',
        author: 'Алпамыс',
      },
      {
        example:
          'Халық неге шебер болса, бәри исленди: Қобыз ба, доңызқабақ па, дуўтар ма, домбыра ма, сырнай ма, ушпелек пе, баламан ба.. – барлық саз әсбаплары жанлады',
        author: 'Т.Қайыпбергенов',
      },
    ],
  },
  {
    soz: 'САЗ ІІ',
    normalized: 'саз іі',
    category: 'ат.',
    definition: 'Топырақтың қатты ылай ислеўге қолайлы түри, соға.',
    examples: [
      {
        example:
          'Жүннен тоқылған қапқа өңменин созып, қапталында саз ылайдан ушпелек соғып отырған баласына жекиринди',
        author: 'К.Султанов',
      },
      {
        example:
          'Ырысқул бийдиң түни менен уйқыламағаны, шеке тамырлары шертилип, маңлай жыйрықлары жүдә майдаланып, саз қайырдың жарығындай айғыз-айғыз болып кетти',
        author: 'Т.Қайыпбергенов',
      },
    ],
  },
  {
    soz: 'САЗ ІІІ',
    normalized: 'саз ііі',
    category: 'ат.',
    definition: 'Қозақтың тараққа усаған әсбабы.',
    examples: [
      {
        example: 'Сылтаўың саз, гүле, баханасы басқа еди',
        author: 'Ж.Аймурзаев',
      },
    ],
  },
  {
    soz: 'САЗ IV',
    normalized: 'саз iv',
    category: 'ат.',
    definition: 'Қолай, тайын турыў, таяр турыў, сазлаўлы.',
    examples: [
      {
        example:
          'Бизин халықтың бийлери, саздур жәхәнде үйлери, Таймастан хеш уақ күйлери, Дуўры жуўап айтқан емес',
        author: 'Бердақ',
      },
      {
        example: 'Аз да болса саз болсын',
        author: 'кк.х.н.',
      },
      {
        example: 'Хәммеси саз, – деди Турымбет аға',
        author: 'Ө.Хожаниязов',
      },
      {
        example:
          'Ханның орнына Ырысқул бий жуўап берип, тез әкетиў ушын хәмме жағынан саз етилип қойылғанын айтты',
        author: 'Т.Қайыпбергенов',
      },
    ],
    idioms: [
      {
        phrase: 'Саз бериў',
        description: 'Таңның атып ағара баслаўы.',
      },
    ],
  },
  {
    soz: 'САЗ V',
    normalized: 'саз v',
    category: 'ат.',
    definition: 'Полдың астына қойылатуғын көлденең ағаш.',
    examples: [],
  },
];

async function findOrCreateCategory(conn, name) {
  const [rows] = await conn.query(
    'SELECT id FROM categorys WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [name]
  );
  if (rows[0]) return rows[0].id;
  const [res] = await conn.query(
    'INSERT INTO categorys (temp_id, name, code) VALUES (?, ?, ?)',
    [`cat_${name}`, name, name.toLowerCase()]
  );
  return res.insertId;
}

async function clearSenseTree(conn, titleId) {
  const [descs] = await conn.query(
    'SELECT id FROM description WHERE titles_id = ?',
    [titleId]
  );
  const descIds = descs.map((d) => d.id);
  if (!descIds.length) return;
  const ph = descIds.map(() => '?').join(',');
  const [idioms] = await conn.query(
    `SELECT id FROM idioms WHERE descriptions_id IN (${ph})`,
    descIds
  );
  const idiomIds = idioms.map((i) => i.id);
  if (idiomIds.length) {
    const iph = idiomIds.map(() => '?').join(',');
    await conn.query(`DELETE FROM idiom_desc WHERE idioms_id IN (${iph})`, idiomIds);
    await conn.query(`DELETE FROM idioms WHERE id IN (${iph})`, idiomIds);
  }
  await conn.query(`DELETE FROM examples WHERE descriptions_id IN (${ph})`, descIds);
  await conn.query(`DELETE FROM description WHERE titles_id = ?`, [titleId]);
}

const ROMAN_ALIASES = {
  'САЗ І': ['САЗ І', 'САЗ I', 'САЗ Ⅰ'],
  'САЗ ІІ': ['САЗ ІІ', 'САЗ II', 'САЗ Ⅱ'],
  'САЗ ІІІ': ['САЗ ІІІ', 'САЗ III', 'САЗ Ⅲ'],
  'САЗ IV': ['САЗ IV', 'САЗ ІV', 'САЗ Ⅳ', 'САЗ ІѴ'],
  'САЗ V': ['САЗ V', 'САЗ Ⅴ', 'САЗ V.', 'САЗ'],
};

async function upsertSense(conn, sense) {
  const aliases = ROMAN_ALIASES[sense.soz] || [sense.soz];
  const ph = aliases.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT id, soz FROM titles
     WHERE status = 1 AND (soz IN (${ph}) OR normalized = ?)
     ORDER BY CASE WHEN soz = ? THEN 0 ELSE 1 END, \`order\`
     LIMIT 5`,
    [...aliases, sense.normalized, sense.soz]
  );

  // Prefer exact soz match; else first candidate
  let title = rows.find((r) => r.soz === sense.soz) || rows[0] || null;
  let titleId;

  if (!title) {
    titleId = id8();
    await conn.query(
      `INSERT INTO titles (id, soz, normalized, search_key, st_let, \`order\`, status)
       VALUES (?, ?, ?, ?, 'С', (SELECT COALESCE(MAX(t2.\`order\`),0)+1 FROM titles t2), 1)`,
      [titleId, sense.soz, sense.normalized, sense.normalized.replace(/\s+/g, '')]
    );
    console.log(`+ created ${sense.soz} (${titleId})`);
  } else {
    titleId = title.id;
    if (title.soz !== sense.soz) {
      await conn.query(
        'UPDATE titles SET soz = ?, normalized = ? WHERE id = ?',
        [sense.soz, sense.normalized, titleId]
      );
      console.log(`~ renamed "${title.soz}" → "${sense.soz}"`);
    } else {
      console.log(`~ update ${sense.soz} (${titleId})`);
    }
  }

  await clearSenseTree(conn, titleId);
  const catId = await findOrCreateCategory(conn, sense.category);
  const descId = id8();
  await conn.query(
    `INSERT INTO description (id, titles_id, categorys_id, description, sort_order)
     VALUES (?, ?, ?, ?, 1)`,
    [descId, titleId, catId, sense.definition]
  );

  let exOrder = 1;
  for (const ex of sense.examples || []) {
    await conn.query(
      `INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [id8(), descId, ex.example, ex.author || null, exOrder++]
    );
  }

  let idmOrder = 1;
  for (const idm of sense.idioms || []) {
    const idiomId = id8();
    await conn.query(
      `INSERT INTO idioms (id, descriptions_id, phrase, sort_order)
       VALUES (?, ?, ?, ?)`,
      [idiomId, descId, idm.phrase, idmOrder++]
    );
    if (idm.description) {
      await conn.query(
        `INSERT INTO idiom_desc (id, idioms_id, description) VALUES (?, ?, ?)`,
        [id8(), idiomId, idm.description]
      );
    }
  }
}

const conn = await db.getConnection();
try {
  await conn.beginTransaction();
  const [[dbName]] = await conn.query('SELECT DATABASE() AS db');
  console.log('DB:', dbName.db);

  // Remove bare "САЗ" if it duplicates V
  const [bare] = await conn.query(
    `SELECT id, soz FROM titles WHERE status=1 AND (soz='САЗ' OR normalized='саз')`
  );
  for (const b of bare) {
    console.log(`- deactivating bare "${b.soz}" (${b.id})`);
    await conn.query('UPDATE titles SET status = 0 WHERE id = ?', [b.id]);
  }

  for (const sense of SENSES) {
    await upsertSense(conn, sense);
  }

  await conn.commit();
  console.log('\nDone. Verifying…');
  const [rows] = await conn.query(
    `SELECT t.soz, c.name AS cat, LEFT(d.description, 80) AS def,
            (SELECT COUNT(*) FROM examples e WHERE e.descriptions_id = d.id) AS ex
     FROM titles t
     JOIN description d ON d.titles_id = t.id
     LEFT JOIN categorys c ON c.id = d.categorys_id
     WHERE t.status = 1 AND t.soz LIKE 'САЗ %'
     ORDER BY t.soz`
  );
  for (const r of rows) {
    console.log(`${r.soz} | ${r.cat} | ex=${r.ex} | ${r.def}`);
  }
} catch (e) {
  await conn.rollback();
  console.error(e);
  process.exitCode = 1;
} finally {
  conn.release();
  await db.end();
}
