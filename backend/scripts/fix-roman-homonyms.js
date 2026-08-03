// Rim raqamli omonimlarni manba asosida tiklash.
// - Ta'rif ichiga qo'shilib ketgan omonimlarni ajratadi
// - Adashgan rim prefikslarini olib tashlaydi
// - Yo'q qolgan omonimlarni qo'shadi
import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import { randomUUID } from 'crypto';

const uid = () => randomUUID().slice(0, 8);
const DRY = !process.argv.includes('--write');

const catCache = new Map();
async function catId(name) {
  const key = (name || 'белгисиз').trim();
  if (catCache.has(key)) return catCache.get(key);
  const [c] = await db.query('SELECT id FROM categorys WHERE LOWER(name)=LOWER(?)', [key]);
  let id;
  if (c[0]) id = c[0].id;
  else {
    const [ins] = await db.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
      `cat_${key}`, key, key.replace(/\./g, ''),
    ]);
    id = ins.insertId;
  }
  catCache.set(key, id);
  return id;
}

// Har bir "so'z" = yakuniy sarlavha. senses[].def/cat/examples[]
// examples: {text, author}
const WORDS = [
  // ── БАҒ: yagona ma'no, "БАҒ II" -> "БАҒ" ────────────────────────────
  { soz: 'БАҒ', renameFrom: 'БАҒ II', senses: [
    { cat: 'ф.', def: 'Бағын байлаў — биреўдиң бахтына иркиниш жасаў (диний түсиникте). Байлама мениң бағымды.' },
  ]},

  // ── ОБА ──────────────────────────────────────────────────────────────
  { soz: 'ОБА І', senses: [
    { cat: 'ат.', def: 'Дәстанларда жийи ушырасып, аўыл, ел, жай, үй деген мәнилерин аңлатады.', examples: [
      { text: 'Бул обалар Ахмед сәрдар ели еди', author: 'Гөруғлы' },
      { text: 'Қорлық пенен өтти ҳаялдың күнлери, Көре алмады өз обасын, шешесин', author: 'И.Юсупов' },
    ]},
  ]},
  { soz: 'ОБА ІІ', renameFrom: 'ОБА II', senses: [
    { cat: 'ат.', def: 'Аўырыўдың аты, тырыспай, холера, жүдә жуқпалы кеселлик.', examples: [
      { text: 'Ол жыллары оба кеселинен бир неше адам қаза тапқан', author: 'газетадан' },
    ]},
  ]},

  // ── КЕЛИС (havolalar) ─────────────────────────────────────────────────
  { soz: 'КЕЛИС І', senses: [{ cat: 'к.', def: 'келиў.' }]},
  { soz: 'КЕЛИС ІІ', renameFrom: 'КЕЛИС II', senses: [{ cat: 'к.', def: 'келисиў.' }]},

  // ── ЖАҚ ──────────────────────────────────────────────────────────────
  { soz: 'ЖАҚ І', senses: [
    { cat: 'ат.', def: 'Адамлардың, жанлы-жаныўарлардың бас сүйегиниң тис орнатылған астынғы бөлегиниң еки қаптал сүйеги.', examples: [
      { text: 'Жаңылмас жақ болмайды, Сүринбес туяқ болмайды', author: 'кк.х.н.' },
      { text: 'Келген пәтте жағыма да шаппаты менен бир-екини дөндирип те жиберди', author: 'Т.Қайыпбергенов' },
    ]},
  ]},
  { soz: 'ЖАҚ ІІ', senses: [
    { cat: 'ат.', def: 'Тәреп, қаптал, бағдар, бет алыс.', examples: [
      { text: 'Оң жағынан ай туўды, Сол жағынан күн туўды', author: 'Қырқ қыз' },
      { text: 'Бәри бир қосылып атаў жаққа жүрип кетти', author: 'Қ.Ирманов' },
    ]},
  ]},
  { soz: 'ЖАҚ ІІІ', renameFrom: 'ЖАҚ III', senses: [
    { cat: 'к.с.', def: 'Бийкарлаўшы сөз. Бүгин аўылға қайтасаң ба? — Жақ, қайтпайман, жумысым бар.' },
  ]},

  // ── ТҮРМЕ (ІІ - 3 ma'noli, ІІІ - havola) ──────────────────────────────
  { soz: 'ТҮРМЕ ІІ', senses: [
    { cat: 'ат.', def: 'Жынаятлы адамларды услайтуғын жай.' },
    { cat: 'ат.', def: 'Суд тәрепинен белгиленип жыл берилген адамларды қамап қоятуғын орын, бина. Түрмеге салыў. Түрмеге қамаў.' },
    { cat: 'ат.', def: 'аўыс. Адамлардың турмыс кешириўи аўыр болған, экономикалық ҳәм сиясий жақтан езилиўде жасап атырған орын. Патша Россиясы халықлардың түрмеси болған.' },
  ]},
  { soz: 'ТҮРМЕ ІІІ', renameFrom: 'ТҮРМЕ III', senses: [{ cat: 'к.', def: 'түрмеў.' }]},

  // ── САҒАТ (havola, rim yo'q) ──────────────────────────────────────────
  { soz: 'САҒАТ', senses: [{ cat: 'к.', def: 'саат.' }]},

  // ── САҒЫЙРА ───────────────────────────────────────────────────────────
  { soz: 'САҒЫЙРА І', senses: [
    { cat: 'ат.', def: 'Нәресте, бөпе.', examples: [
      { text: 'Сағыйраның жүрегине ҳәсирет саласаң', author: 'К.Султанов' },
      { text: 'Бул ҳәдийсеге бийпәрўа қарайтуғын бизлер сағыйрамыз ба?', author: 'К.Султанов' },
    ]},
  ]},
  { soz: 'САҒЫЙРА ІІ', renameFrom: 'САҒЫЙРА II', senses: [
    { cat: 'кел.', def: 'аўыс. Кеўли ашық, ҳақ жүрек, ҳақ кеўилли, ҳақ нийетли.' },
  ]},

  // ── БИЙДАЙЫҚ ──────────────────────────────────────────────────────────
  { soz: 'БИЙДАЙЫҚ І', senses: [
    { cat: 'ат.', def: 'бот. Бийдай туқымлас өсимлик, жабайы сулы.', examples: [
      { text: 'Бийдай атызының дөгерегинде бийдайықлар да көгерген', author: 'Қ.Айымбетов' },
    ]},
  ]},
  { soz: 'БИЙДАЙЫҚ ІІ', senses: [
    { cat: 'ат.', def: 'Гүпиниң тысы менен астарының ишине айырым таза ямаса гөне гезлеме материалға пахта яки жүн салып сырылған зат ҳәм де көпшиктиң қабының ишки қабаты.', examples: [
      { text: 'Келиншек көпшиктиң тысын да, ишки бийдайығын да сөтип алып жуўыўға таярлады', author: 'Ө.Айжанов' },
    ]},
  ]},
  { soz: 'БИЙДАЙЫҚ ІІІ', renameFrom: 'БИЙДАЙЫҚ III', senses: [
    { cat: 'ат.', def: 'Жыртқыш қустың бир түри.', examples: [
      { text: 'Бул тоғайлықта бийдайық деген қус та жасайды', author: 'газетадан' },
    ]},
  ]},

  // ── ҚАРАБУЎРА ─────────────────────────────────────────────────────────
  { soz: 'ҚАРАБУЎРА І', senses: [
    { cat: 'ат.', def: 'Түйе.', examples: [
      { text: 'Сен де қуўрап қалған гикеш, Атқосшылар, буйдасын шеш, Қара буўра, қыйсық өркеш, Заманыңда түйе екенсең', author: 'Күнхожа' },
    ]},
  ]},
  { soz: 'ҚАРАБУЎРА ІІ', senses: [{ cat: 'ат.', def: 'Қарақалпақлардың руў-тийре атамасы.' }]},
  { soz: 'ҚАРАБУЎРА ІІІ', renameFrom: 'ҚАРАБУЎРА III', senses: [
    { cat: 'ат.', def: 'Суўды бөгеў ушын қамыс, жыңғыл ҳәм топырақты араластырып шандыған бөгет.' },
  ]},

  // ── ҚОРАСАН ───────────────────────────────────────────────────────────
  { soz: 'ҚОРАСАН І', senses: [{ cat: 'ат.', def: 'Қарақалпақлардың руў-тийре атамасы.' }]},
  { soz: 'ҚОРАСАН ІІ', senses: [{ cat: 'ат.', def: 'Малларда болатуғын сортлардың бир түри.' }]},
  { soz: 'ҚОРАСАН ІІІ', renameFrom: 'ҚОРАСАН III', senses: [
    { cat: 'ат.', def: 'Иранның аймағындағы ески мәмлекет аты.', examples: [
      { text: 'Бир жаз мәкан еттиң Нариманның тутын, Қыз келсе, дәптердиң астында қутың, Қолың Қорасанда, Бухарда путың, Соныңдай мәс, қақай адам усайсаң', author: 'Садық шайыр' },
    ]},
  ]},

  // ── ПАРЛАЎШЫ ──────────────────────────────────────────────────────────
  { soz: 'ПАРЛАЎШЫ І', senses: [
    { cat: 'ат.', def: 'Жуплаўшы, қосақлаўшы.' },
    { cat: 'ат.', def: 'Пуўға айландырыўшы.' },
  ]},
  { soz: 'ПАРЛАЎШЫ ІІ', senses: [{ cat: 'ат.', def: 'Пуўға айландырыўшы, пуўландырыўшы.' }]},
  { soz: 'ПАРЛАЎШЫ ІІІ', renameFrom: 'ПАРЛАЎШЫ III', senses: [
    { cat: 'ат.', def: 'Қурылдаўшы, қурылдап уйқылаўшы.' },
  ]},

  // ── Ta'rif ichida "ІІ" markeri bilan qo'shilganlar (split) ────────────
  { soz: 'ҚУНДАҚЛАЎ І', senses: [
    { cat: 'ф.', def: 'Жас баланы жөргекке ораў, танып байлаў. Ол баласын қундақлаў ушын асығып үйине кирди.' },
  ]},
  { soz: 'ҚУНДАҚЛАЎ ІІ', senses: [{ cat: 'ф.', def: 'Мылтыққа қундақ салыў, орнатыў.' }]},

  { soz: 'ЫЗҒАРЛАЎ І', senses: [{ cat: 'ф.', def: 'Ығаллаў, хөллеў, ләмлеў.' }]},
  { soz: 'ЫЗҒАРЛАЎ ІІ', senses: [{ cat: 'ф.', def: 'Ләм болып қалыў, хөл болыў, ығал болыў.' }]},

  { soz: 'ПАРЛАЎ І', senses: [{ cat: 'ф.', def: 'Жуплаў, қосақлаў, екеўлеў.' }]},
  { soz: 'ПАРЛАЎ ІІ', senses: [{ cat: 'ф.', def: 'Пуўға айланыў, пуўланыў.' }]},

  { soz: 'ПАРАХОРЛЫҚ І', senses: [{ cat: 'кел.', def: 'Пара алыўды жақсы көриўшилик, алымсақлық.' }]},
  { soz: 'ПАРАХОРЛЫҚ ІІ', senses: [{ cat: 'ат.', def: 'Пара алыўшылық, параға тән, параға тийисли.' }]},

  { soz: 'ПӘПЕЛЕКЛЕЎ І', senses: [{ cat: 'кел.', def: 'Ушқалақлаў, жедиллеў, дәлбиреклеў.' }]},
  { soz: 'ПӘПЕЛЕКЛЕЎ ІІ', senses: [{ cat: 'ф.', def: 'Ушып қоныў, дәлбиреклеў.' }]},

  { soz: 'ПАРДАЙ І', senses: [{ cat: 'кел.', def: 'Теңдей, жуптай, қосақтай.' }]},
  { soz: 'ПАРДАЙ ІІ', senses: [{ cat: 'кел.', def: 'Пуў сыяқлы, пуўға уқсаған, пуў тәризли, пуудай.' }]},

  { soz: 'УЛЛЫСЫНЫЎ І', senses: [{ cat: 'ф.', def: 'Үлкенсиниў, нәҳәнсиниў.' }]},
  { soz: 'УЛЛЫСЫНЫЎ ІІ', senses: [{ cat: 'кел.', def: 'Өзин басқалардан жоқары санаў.' }]},
];

async function findTitle(soz) {
  const [r] = await db.query('SELECT id FROM titles WHERE soz=?', [soz]);
  return r[0]?.id || null;
}

async function clearDescriptions(titleId) {
  const [ds] = await db.query('SELECT id FROM description WHERE titles_id=?', [titleId]);
  for (const d of ds) {
    const [ids] = await db.query('SELECT id FROM idioms WHERE descriptions_id=?', [d.id]);
    for (const i of ids) await db.query('DELETE FROM idiom_desc WHERE idioms_id=?', [i.id]);
    await db.query('DELETE FROM idioms WHERE descriptions_id=?', [d.id]);
    await db.query('DELETE FROM examples WHERE descriptions_id=?', [d.id]);
  }
  await db.query('DELETE FROM description WHERE titles_id=?', [titleId]);
}

async function upsert(word) {
  let titleId = null;
  // rename bo'lsa eski sarlavhani topib qayta nomlash
  if (word.renameFrom) {
    titleId = await findTitle(word.renameFrom);
    if (titleId) {
      if (!DRY) await db.query('UPDATE titles SET soz=?, normalized=?, st_let=? WHERE id=?', [
        word.soz, word.soz.toLocaleLowerCase('kk'), word.soz.charAt(0), titleId,
      ]);
    }
  }
  if (!titleId) titleId = await findTitle(word.soz);

  const action = titleId ? (word.renameFrom ? 'rename+upd' : 'update') : 'create';

  if (!DRY) {
    if (!titleId) {
      titleId = uid();
      await db.query(
        'INSERT INTO titles (id, soz, normalized, st_let, status, `order`) SELECT ?,?,?,?,1, COALESCE(MAX(`order`),0)+1 FROM titles',
        [titleId, word.soz, word.soz.toLocaleLowerCase('kk'), word.soz.charAt(0)]
      );
    } else {
      await clearDescriptions(titleId);
    }
    let order = 1;
    for (const s of word.senses) {
      const did = uid();
      await db.query(
        'INSERT INTO description (id, titles_id, categorys_id, description, sort_order) VALUES (?,?,?,?,?)',
        [did, titleId, await catId(s.cat), s.def, order++]
      );
      let eo = 1;
      for (const ex of s.examples || []) {
        await db.query(
          'INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved) VALUES (?,?,?,?,?,1)',
          [uid(), did, ex.text, ex.author || null, eo++]
        );
      }
    }
  }
  const exCount = word.senses.reduce((n, s) => n + (s.examples?.length || 0), 0);
  console.log(`  [${action}] ${word.soz} — ${word.senses.length} ma'no, ${exCount} misol`);
}

console.log(DRY ? '=== DRY-RUN ===' : '=== WRITE ===');
for (const w of WORDS) await upsert(w);

if (!DRY) {
  console.log('\nTartib qayta qurilyapti...');
}
await db.end();
console.log(DRY ? '\nYozish uchun: node scripts/fix-roman-homonyms.js --write' : '\nTayyor. Endi rebuild-sort-order.js ni ishga tushiring.');
