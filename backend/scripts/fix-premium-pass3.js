import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';
import { randomUUID } from 'crypto';

const WRITE = process.argv.includes('--write');
const log = (...a) => console.log(...a);

async function catId(name) {
  const [c] = await db.query('SELECT id FROM categorys WHERE LOWER(name)=?', [name]);
  if (c[0]) return c[0].id;
  if (!WRITE) return null;
  const [ins] = await db.query('INSERT INTO categorys (temp_id, name, code) VALUES (?,?,?)', [
    `cat_${name}`, name, name.replace(/\./g, ''),
  ]);
  return ins.insertId;
}

async function renameTitle(id, newSoz) {
  const [dup] = await db.query('SELECT id FROM titles WHERE soz=? AND id<>?', [newSoz, id]);
  if (dup.length) {
    log(`  ! ${newSoz} allaqachon bor — status=0 qilinadi`);
    if (WRITE) await db.query('UPDATE titles SET status=0 WHERE id=?', [id]);
    return false;
  }
  if (WRITE) {
    await db.query('UPDATE titles SET soz=?, normalized=?, st_let=? WHERE id=?', [
      newSoz, newSoz.toLocaleLowerCase('kk'), newSoz.charAt(0), id,
    ]);
  }
  return true;
}

async function setDef(titleId, def, cat) {
  if (!WRITE) return;
  await db.query(
    'UPDATE description SET description=? WHERE titles_id=? ORDER BY sort_order LIMIT 1',
    [def, titleId]
  );
  if (cat) {
    const cid = await catId(cat);
    await db.query(
      'UPDATE description SET categorys_id=? WHERE titles_id=? ORDER BY sort_order LIMIT 1',
      [cid, titleId]
    );
  }
}

async function replaceExamples(titleId, examples) {
  if (!WRITE) return;
  const [defs] = await db.query('SELECT id FROM description WHERE titles_id=? ORDER BY sort_order LIMIT 1', [titleId]);
  if (!defs[0]) return;
  const did = defs[0].id;
  await db.query('DELETE FROM examples WHERE descriptions_id=?', [did]);
  let order = 1;
  for (const ex of examples) {
    await db.query(
      'INSERT INTO examples (id, descriptions_id, sort_order, example, author, is_approved) VALUES (?,?,?,?,?,1)',
      [randomUUID().slice(0, 8), did, order++, ex.text, ex.author]
    );
  }
}

/* ============ 1. K-quyruqli titlelar ============ */
log('=== 1. K-quyruqli titlelar');
const K_TAIL = [
  // [id, yangi title, def tuzatish (null = tegilmaydi)]
  ['2e44f377', 'ҚЫЯЛЛАСЫЎ', 'қыяллаў фейилиниң шериклик дәрежеси.'],
  ['32686322', 'ӨҢСИЗЛИК', null],
  ['433ad43a', 'ЛЕҢГИР', null],
  ['82498b9a', 'КСЕРОКОПИЯ', null],
  ['8532811a', 'АММИАКЛЫ', null],
  ['8603990d', 'ВОНА', null],
  ['8a541d6c', 'ҚОМЛАТЫЎ', 'қомлаў фейилиниң өзгелик дәрежеси.'],
  ['a68df3d8', 'АТА-ЕНЕ', null],
  ['b734934a', 'АНТАРКТИДА', null],
  ['b87a7b9d', 'АСҚАБАҚТАЙ', null],
  ['bcd8fb4a', 'ҚЫЯЛАТЫЎ', 'қыялаў фейилиниң өзгелик дәрежеси.'],
  ['c1f51dbe', 'АСТАРЛАТҚЫЗЫЎ', null],
  ['d3072336', 'ҚУЎАЛАНЫЎ', null],
  ['d45d1d2c', 'СОЛАҚАЙ', null],
  ['d6847c13', 'ТҮСКИ', 'Күнниң ортасындағы мәҳәл.'],
  ['db966b77', 'ЦИТОЛОГИЯ', null],
  ['f68ffdad', 'КИСЕНЛЕНИЎ', 'кисенлеў фейилиниң белгисиз дәрежеси.'],
];
for (const [id, soz, def] of K_TAIL) {
  log(` ${soz}`);
  const ok = await renameTitle(id, soz);
  if (ok && def) await setDef(id, def, null);
}
// КАРҒА К. -> КАРҒА (havola: к. ғарға)
log(' КАРҒА (к. ғарға)');
if (await renameTitle('67826719', 'КАРҒА')) {
  await setDef('67826719', 'ғарға.', 'к.');
}
// БАНТИК К -> БАНТИК, ta'rifdan misolni ajratish, quyruq olib tashlash
log(' БАНТИК');
if (await renameTitle('87a2f090', 'БАНТИК')) {
  await setDef('87a2f090', 'Кишкене бант.', 'ат.');
  await replaceExamples('87a2f090', [
    { text: 'Нәзийра бантигин қолына алып, мектепке қарай жуўырып кетти.', author: 'газетадан' },
  ]);
}

/* ============ 2. Kesilgan ta'riflar (manbadan tiklash) ============ */
log('\n=== 2. Kesilgan ta\u2019riflar');
const RESTORE = [
  {
    id: '07d0bae1', soz: 'БЕС ПАРЫЗ', cat: 'ат.',
    def: 'Диний түсиник бойынша кудайдың кулы тәрепинен булжытпай орынлаўға тийисли ўазыйпа.',
    examples: [
      { text: '...ҳәр күнги намазды бес парыз деп түсиниў керек, дейди оларға молла.', author: 'ққ.х.е.' },
      { text: 'Өзинде моллалық болмаса, исенип бес парыз алма.', author: 'Өтеш' },
    ],
  },
  {
    id: 'bc37fb56', soz: 'БЕС САЎСАҚ', cat: 'ат.',
    def: 'Бир қолдың бес бармағы.',
    examples: [
      { text: '...әй шырағым, бес саусағың бирдей емес ғой, деп кемпир өзинен өзи гүбирленди келгенлерге.', author: 'Қ.Айымбетов' },
    ],
  },
  {
    id: 'dbb22f7e', soz: 'АТ ШАПТЫРЫМ', cat: 'кел.',
    def: 'Әдеўир, бираз, узақ жол, аралық, бир талай жер.',
    examples: [
      { text: '...қалаға ат шаптырым жерде бир таў бар.', author: 'кк.х.е.' },
    ],
  },
  {
    id: '87541f8c', soz: 'ВАТТ', cat: 'ат.',
    def: '(ингл. инглис физиги Жеймс Уатт атынан) Халықаралық бирликлер системасында күштиң универсал өлшеў бирлиги (белгиси Вт).',
    examples: [],
  },
  {
    id: '00610d7f', soz: 'УСАҚ МАЛ', cat: 'диал.с.',
    def: 'Қой менен ешкини бирликте усылай атайды (Д.Насыров, О.Доспанов).',
    examples: [],
  },
  {
    id: 'a89b8895', soz: 'ҚАРА ЫЗҒАР', cat: 'кел.',
    def: 'Қыстағы қар, жаўынның суўы менен қанып жатқан жер.',
    examples: [
      { text: 'Ўақты өткенде егин ектик, қара ызғарға қаўын тиктик.', author: 'Бердак' },
    ],
  },
  {
    id: 'deb549b2', soz: 'ҲАЛҚАП КӨЙЛЕК', cat: 'диал.с.',
    def: 'Ҳаяллардын кийетуғын көйлегиниң бир түри, оның алдынғы бети нағысланған болады (Д.Насыров, О.Доспанов).',
    examples: [],
  },
  {
    id: '65513016', soz: 'БАҲАЛЫ ҚАҒАЗ', cat: 'ат. экон.',
    def: 'Дивидент акционерлердиң улыўма жыйналысының қарарына көре пул түсимлери яки басқа да нызамлы төленетуғын затлар ямаса баҳалы қағазлар менен төлениўи мүмкин (газетадан).',
    examples: [],
  },
  {
    id: '4e19e87b', soz: 'УСТЫҚАН', cat: 'ат.',
    def: 'Жилик.',
    examples: null, // misollar tegilmaydi
  },
];
for (const r of RESTORE) {
  log(` ${r.soz}: "${r.def.slice(0, 50)}..."`);
  await setDef(r.id, r.def, r.cat);
  if (r.examples) await replaceExamples(r.id, r.examples);
}

/* ============ 3. Buzuq titlelar ============ */
log('\n=== 3. Buzuq titlelar');
// ҚӘЛ -> ҚӘЛУЕНДЕЙ
log(' ҚӘЛ -> ҚӘЛУЕНДЕЙ');
if (await renameTitle('60a0b19f', 'ҚӘЛУЕНДЕЙ')) {
  await setDef('60a0b19f', 'Қәлуен сыяқлы, усаған, яңлы. Мисли қәлуендей сезиледи.', 'кел.');
}
// ӘЛҒ -> ӘЛҒӘРЕЗ (manba: 0034.json — misol Ájiniyazdan)
log(' ӘЛҒ -> ӘЛҒӘРЕЗ');
if (await renameTitle('d0577ad7', 'ӘЛҒӘРЕЗ')) {
  await setDef('d0577ad7', '«Гәптиң тоқ етери, ақырында, қысқартып айтқанда» деген мәнилерди билдиретуғын сөз (қ. ғәрез).', 'м.с.');
  await replaceExamples('d0577ad7', [
    { text: 'Нәйлейин дүньяны, мақсудым сенде, Әлғәрез, дүньяның бәри садаға.', author: 'Әжинияз' },
  ]);
}
// ДӘР -> ДӘРЎАЗШЫЛЫҚ
log(' ДӘР -> ДӘРЎАЗШЫЛЫҚ');
if (await renameTitle('635a753b', 'ДӘРЎАЗШЫЛЫҚ')) {
  await setDef('635a753b', 'Дәрўаз өнери, хызмети, дарда ойнаў; дәрўазда ойнаўшылық, дәрўазшылық кәсиби.', 'ат.');
}
// ТАС ТУНЕК -> ТАС ТҮНЕК
log(' ТАС ТУНЕК -> ТАС ТҮНЕК');
if (await renameTitle('8b3d3f26', 'ТАС ТҮНЕК')) {
  await setDef('8b3d3f26', 'Оғыры қараңғы. Ҳеш нәрсе көринбейтуғын қараңғылық.', null);
}
// АССИРИОЛОГИЯ А -> АССИРИОЛОГИЯ
log(' АССИРИОЛОГИЯ А -> АССИРИОЛОГИЯ');
if (await renameTitle('673111e3', 'АССИРИОЛОГИЯ')) {
  await setDef('673111e3', 'Ассирия, Вавилония ҳәм Месопатамия тарийхын, мәдениятын, тиллерин ҳәм жазыўларын үйренетуғын комплексли гуманитар пән.', 'ат.');
}
// ҒОҒАҚЛАСЫЎ РО -> ҒОҒАҚЛАСЫЎ
log(' ҒОҒАҚЛАСЫЎ РО -> ҒОҒАҚЛАСЫЎ');
if (await renameTitle('8436e411', 'ҒОҒАҚЛАСЫЎ')) {
  await setDef('8436e411', 'ғоғақлаў фейилиниң шериклик дәрежеси.', null);
}
// ТОСҚЫЗЫЎ Т -> ТОСҚЫЗЫЎ
log(' ТОСҚЫЗЫЎ Т -> ТОСҚЫЗЫЎ');
if (await renameTitle('ad36153c', 'ТОСҚЫЗЫЎ')) {
  await setDef('ad36153c', 'тосыў фейилиниң өзгелик дәрежеси.', null);
}
// КОТ -> КОТЁЛ (manba: 0162.json)
log(' КОТ -> КОТЁЛ');
if (await renameTitle('afa77e6b', 'КОТЁЛ')) {
  await setDef('afa77e6b', 'Металлдан исленген үлкен дөңгелек ыдыс, казан (бунда суў жылытылыўы, аўқат писирилиўи тағы баскалар ислениўи мүмкин).', 'ат.');
  await replaceExamples('afa77e6b', []);
}

/* ============ 4. Yaroqsiz yozuvlarni o'chirish ============ */
log('\n=== 4. Yaroqsizlar (status=0)');
for (const [id, soz, why] of [
  ['58f5c376', 'ТИК КЕЛИЎ', 'manbada ham ta\u2019rifi yo\u2018q (faqat "фраз.")'],
  ['7357203d', 'ТОПАЙ', 'o\u2018z-o\u2018ziga havola ("к., топай.")'],
]) {
  log(` ${soz} — ${why}`);
  if (WRITE) await db.query('UPDATE titles SET status=0 WHERE id=?', [id]);
}

console.log('\nMODE:', WRITE ? 'WRITE' : 'DRY-RUN');
await db.end();
