// 4-bosqich: ta'rif ichiga qo'shilib ketgan yozuvlarni qo'lda ajratish.
// Manba: fordata dict_pages_v2 sahifalari bilan solishtirildi.
import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import { randomUUID } from 'crypto';

const uid = () => randomUUID().slice(0, 8);

async function catId(name) {
  const [c] = await db.query('SELECT id FROM categorys WHERE LOWER(name)=LOWER(?)', [name]);
  if (c[0]) return c[0].id;
  const [ins] = await db.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
    `cat_${name}`, name, name.replace(/\./g, ''),
  ]);
  return ins.insertId;
}

async function descBySoz(soz) {
  const [rows] = await db.query(
    `SELECT d.id, d.titles_id FROM description d JOIN titles t ON d.titles_id=t.id
     WHERE t.soz=? ORDER BY d.sort_order LIMIT 1`,
    [soz]
  );
  return rows[0] || null;
}

async function setDesc(soz, def, category, examples = []) {
  const d = await descBySoz(soz);
  if (!d) { console.log('TOPILMADI:', soz); return; }
  const cid = category ? await catId(category) : null;
  if (cid) {
    await db.query('UPDATE description SET description=?, categorys_id=? WHERE id=?', [def, cid, d.id]);
  } else {
    await db.query('UPDATE description SET description=? WHERE id=?', [def, d.id]);
  }
  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i];
    const [dup] = await db.query('SELECT id FROM examples WHERE descriptions_id=? AND example=?', [d.id, ex.text]);
    if (dup.length) continue;
    await db.query(
      'INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved) VALUES (?,?,?,?,?,1)',
      [uid(), d.id, ex.text, ex.author || null, i + 1]
    );
  }
  console.log('tuzatildi:', soz);
}

async function renameTitle(oldSoz, newSoz) {
  const [r] = await db.query('SELECT id FROM titles WHERE soz=?', [oldSoz]);
  if (!r.length) { console.log('TOPILMADI (rename):', oldSoz); return; }
  await db.query('UPDATE titles SET soz=?, normalized=?, st_let=? WHERE id=?', [
    newSoz, newSoz.toLocaleLowerCase('kk'), newSoz.charAt(0), r[0].id,
  ]);
  console.log('sarlavha:', oldSoz, '->', newSoz);
}

async function addWord(soz, senses) {
  const [exists] = await db.query('SELECT id FROM titles WHERE soz=?', [soz]);
  if (exists.length) { console.log('bor, o\u2018tkazildi:', soz); return; }
  const tid = uid();
  await db.query(
    'INSERT INTO titles (id, soz, normalized, st_let, status, `order`) SELECT ?,?,?,?,1, COALESCE(MAX(`order`),0)+1 FROM titles',
    [tid, soz, soz.toLocaleLowerCase('kk'), soz.charAt(0)]
  );
  let order = 1;
  for (const s of senses) {
    const did = uid();
    await db.query(
      'INSERT INTO description (id, titles_id, categorys_id, description, sort_order) VALUES (?,?,?,?,?)',
      [did, tid, await catId(s.category || 'ат.'), s.def, order++]
    );
    let eo = 1;
    for (const ex of s.examples || []) {
      await db.query(
        'INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved) VALUES (?,?,?,?,?,1)',
        [uid(), did, ex.text, ex.author || null, eo++]
      );
    }
  }
  console.log('qo\u2018shildi:', soz, `(${senses.length} ma'no)`);
}

// ── 1. ҚӘТЕП І ichidagi ІІ va ІІІ omonimlarni ajratish ──────────────────
await setDesc('ҚӘТЕП І', 'Қораның яки от салатуғын ақырдың аўзы.', 'ат.');
await addWord('ҚӘТЕП ІІ', [
  {
    category: 'ат.',
    def: 'Күйме, гебеже.',
    examples: [
      { text: 'Белдеуде бедеў көринсе, Ердин үйи деседи, Қәтептен ары бар болса, Бардың үйи деседи', author: 'Термелер' },
      { text: 'Түйеге минип, қәтебине букла', author: 'кк.х.н.м.' },
    ],
  },
]);
await addWord('ҚӘТЕП ІІІ', [{ category: 'ат.', def: 'Бесик жақлаўы.' }]);

// ── 2. ТАМҒАСЫЗ: "ІІ қ. тамызыў" qoldig'ini olib tashlash, misolni ajratish ──
await setDesc('ТАМҒАСЫЗ', 'Тамғасы жоқ, тамға салынбаған, басылмаған.', 'кел.', [
  { text: 'Малларына тамға басты, Тамғасыз мал қалған емес', author: 'Бердақ' },
]);

// ── 3. ТАМЫЗЫЎ manbadan import (0410.json) — havolalar unga ishora qiladi ──
await addWord('ТАМЫЗЫЎ', [
  {
    category: 'ф.',
    def: 'Суйық затты тамшылатып қуйыў, сорғалатыў, ағызыў.',
    examples: [
      { text: 'Улбосын набаттың суўын Турымбеттин аузына тамызды', author: 'Н.Дәўкараев' },
      { text: 'Көзиниң жасын тамызып, Ырза болды, жылады', author: 'Бердак' },
      { text: 'Усыннан үш-төрт тамшы дәрини бир уртлам суўға тамызып, үш мезгил ишесең, деди дәриханадағы қыз', author: 'М.Нызанов' },
    ],
  },
  {
    category: 'ф.',
    def: 'Майын тамызып айтыў — сөзди кәмине келтирип, тартымлы етип сөйлеў.',
    examples: [
      { text: 'Ертеңине Жоллыбайға оқыған әңгимелериниң ўақыясын биринен соң бирин майын тамызып айтып бердим', author: 'Б.Соқпақбаев' },
    ],
  },
]);

// ── 4. Ta'rif boshidagi sitata / qavs qoldiqlari ──────────────────────────
await setDesc('ТОҚҚЫЗ', 'Тоғыз.', 'сан.', [
  { text: 'Тоққыз атлы болыс келди бир жақтан', author: 'Бердак' },
]);
await setDesc('ӘЯ', 'Үндеў, қаратпа мәнисинде қолланылатуғын сөз.', 'т.с.', [
  { text: 'Әя дослар, тардур заман, Бастағы бул күнлер жаман', author: 'Бердақ' },
]);
await setDesc('БЕРЕТ', '(итал. beretta — жалпақ, ийилген шапка) Жийексиз, жеңил ҳәм жумсақ, жалпақ бас кийим.', 'ат.');
await setDesc('ВИТАМИН', '(лат. vita — өмир) Инсан ҳәм ҳайўан организминиң әдеттеги өмир сүриўи ушын керекли элементлер, усындай элементлери бар препарат; дәри.', 'ат.');
await setDesc('БЕДУИН', 'Араб ярым атаўы ҳәм Арқа Африканың көшпели ҳәм ярым көшпели араблары (феллахлар).', 'ат.');

// ── 5. Sarlavha qoldiqlari ────────────────────────────────────────────────
await renameTitle('МАҚБАРА М', 'МАҚБАРА');
await setDesc('МАҚБАРА', 'Мазар, қәбир үстине тикленген зияратхана.', 'ат.', [
  { text: 'Пайғамбар өлгеннен кейин оның жети кызы әкесине жети гүмбезли мақбара салдырған екен', author: 'Әпсаналар. Назлымхан сулыў' },
]);
await renameTitle('УСТУХАН Д', 'УСТУХАН');
await setDesc('УСТУХАН', 'Сүйек, дене мәнисинде.', 'диал.с.', [
  { text: 'Устуханым ағыр келди', author: 'Д. Насыров, О.Доспанов' },
]);

// ── 6. ЕР І tozalash, ЕР ТУРМАН ga haqiqiy ta'rif ────────────────────────
await setDesc('ЕР І', 'Аттың ямаса ешектин жаўырынына салынатуғын ағаштан, темирден исленген қурал-сайманның (ер-турманның) бир түри.', 'ат.');
await setDesc('ЕР ТУРМАН', 'Көликке тийисли болған барлық үскенелердиң жыйнағы.', 'ат.');

// ── 7. She'riy misollar (sitata ichida nuqta bo'lgani uchun avto ajratilmaydi) ──
await setDesc('ҚАРҒАШ', 'Перзент, зүрият.', 'ат.', [
  { text: 'Қарағым менин қандайды, Қарғашым енди қандайды, Қарап алып бир бетиме, Қаймақ берип алдайды!', author: 'Сүймишлер' },
]);
await setDesc('ҚАМ', 'Атайы порхан.', 'ат.', [
  { text: 'Қамшылаў деген сен болсаң, Қамның қызы мен болсам, Қайдан келдиң сонда қайт, Қайттым мен де, сен де қайт!', author: 'Дарымлар' },
]);
await setDesc('ҚОРДАН І', 'Азықлық қор сақлайтуғын ыдыс.', 'ат.', [
  { text: 'Мардан, марданның үстинде қордан, Қорданның үсти шыра, Шыраның үсти қәлем, Қәлемнин үсти тоғай (аўыз, мурын, көз, қас, шаш)', author: 'Жумбақлар' },
]);
await setDesc('МӘҲИР', 'Шебер уста, исине жетик.', 'кел.', [
  { text: '...тәрийпиңиз халық арасында зәҳирдин бир машаққат ўә мүшкил нүкәтлерге мәҳир ерурсыз...', author: 'Шайырлар айтысы' },
]);
await setDesc('САЛПЫ', 'Салбыраған, иймейген, үлкен, узын.', 'кел.', [
  { text: 'Ешегиннин тамағы ток, қулағы салпы жалы жок', author: 'Бердак' },
]);
await setDesc('ОҢДЫРЫЎ', 'Дурыс ислеў, жақсылаў, жақсылық ислеў, жөнлеў.', 'ф.', [
  { text: 'Оңдырып исин етпесе, қалайша илаж етермен', author: 'Әжинияз' },
]);
await setDesc('ӘДАЛАТЛЫҚ', 'Тенлик, әдиллик, еркинлик, бостанлық.', 'ат.', [
  { text: 'Әдалатлық билән енди бий аға, Қайта шәриятқа қосышын көриң', author: 'Әжинияз' },
]);

// ── 8. ҒАРҒА: misol + frazeologizmni ajratish ────────────────────────────
{
  const d = await descBySoz('ҒАРҒА');
  if (d) {
    await db.query('UPDATE description SET description=? WHERE id=?', [
      'Қара ямаса ала ренли ҳәр түрли нәрсени жей беретуғын жабайы қус.', d.id,
    ]);
    const [dup] = await db.query('SELECT id FROM examples WHERE descriptions_id=?', [d.id]);
    if (!dup.length) {
      await db.query(
        'INSERT INTO examples (id, descriptions_id, example, author, sort_order, is_approved) VALUES (?,?,?,?,1,1)',
        [uid(), d.id, 'Қара ғарға, ала ғарға', 'А.Әлиев']
      );
    }
    const [idup] = await db.query('SELECT id FROM idioms WHERE descriptions_id=?', [d.id]);
    if (!idup.length) {
      const iid = uid();
      await db.query(
        'INSERT INTO idioms (id, descriptions_id, phrase, sort_order) VALUES (?,?,?,1)',
        [iid, d.id, 'Ғарғадай секелеклеу']
      );
      await db.query(
        'INSERT INTO idiom_desc (id, idioms_id, description) VALUES (?,?,?)',
        [uid(), iid, 'Турақсызлық, адамның ҳәр қыйлы истиң басында жүриўи.']
      );
    }
    console.log('tuzatildi: ҒАРҒА (misol + frazeologizm)');
  }
}

await db.end();
console.log('\nTayyor.');
