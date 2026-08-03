import dotenv from 'dotenv';
dotenv.config();
import db from '../src/config/dictionary.db.js';

const WRITE = process.argv.includes('--write');

const [belg] = await db.query("SELECT id FROM categorys WHERE name='белгисиз' LIMIT 1");
const belgId = belg[0]?.id ?? null;

async function catId(name) {
  const [c] = await db.query('SELECT id FROM categorys WHERE LOWER(name)=LOWER(?)', [name]);
  return c[0]?.id ?? null;
}

async function apply(titleId, descId, newSoz, newDef, catName) {
  console.log(` ${newSoz}${catName ? ' [' + catName + ']' : ''}${newDef ? ' :: ' + newDef.slice(0, 55) : ''}`);
  if (!WRITE) return;
  if (newSoz) {
    const [dup] = await db.query('SELECT id FROM titles WHERE soz=? AND id<>?', [newSoz, titleId]);
    if (dup.length) {
      console.log(`   ! dublikat — status=0`);
      await db.query('UPDATE titles SET status=0 WHERE id=?', [titleId]);
      return;
    }
    await db.query('UPDATE titles SET soz=?, normalized=?, st_let=? WHERE id=?', [
      newSoz, newSoz.toLocaleLowerCase('kk'), newSoz.charAt(0), titleId,
    ]);
  }
  if (newDef) await db.query('UPDATE description SET description=? WHERE id=?', [newDef, descId]);
  if (catName) {
    const cid = await catId(catName);
    if (cid) {
      const [cur] = await db.query('SELECT categorys_id FROM description WHERE id=?', [descId]);
      if (cur[0] && (cur[0].categorys_id === belgId || cur[0].categorys_id == null)) {
        await db.query('UPDATE description SET categorys_id=? WHERE id=?', [cid, descId]);
      }
    }
  }
}

// [titleId, descId, yangi title, yangi def (null=tegilmaydi), kategoriya]
const FIXES = [
  ['f0a07bc4', '0dec42a9', 'ӘЗЕЛДЕ', null, 'р.'],
  ['da75e6c8', '2a1de7bb', 'САЗ V', 'Полдың астына қойылатуғын көлденең ағаш.', 'ат.'],
  ['0c73a04d', '36fb3b28', 'ЖАЙЫНДА', null, 'к.с.'],
  ['1ef1edf1', '386c4e6c', 'ҚАЛПАҚШАҢ', null, 'р.'],
  ['2217d2f8', '39b795ff', 'ТИРИЛЕЙ', null, 'р.'],
  ['a8c56a69', '3b028a58', 'АЎМИЙИН', null, 'м.с.'],
  ['cfb21dd2', '3c644afc', 'ҚАЙЫР V', 'Хош, саў бол. Көргенше қайыр, саў болыңыз.', 'т.с.'],
  ['43f46e8d', '46ecf75d', 'ҚАЙТАДАН', null, 'р.'],
  ['e0f8cb84', '5a3b78cd', 'АРАСЫНДА', null, 'р.'],
  ['4c075a02', '700a16cc', null, '(АСТРОГРАФИЯ, АСТРОНОМИЯЛЫҚ ФОТОГРАФИЯ) астрографлар жәрдеминде аспан денелерин сүўретке алыў тийкарында астрономиялық баклаўлар өткериўдиң бир усылы.', 'ат.'],
  ['4e6a80cf', '73334618', 'АССОЦИАТИВЛИК', 'Ассоциативлик алгебра, ассоциативлик кольцо.', null],
  ['e5746848', '757bfc85', 'ЖАБЫЛА', 'Ҳәмме бирден, жәмлесип, уйымласып. Иске жабыла кирисиў.', 'р.'],
  ['d79954a6', '7a8f8b46', 'ВА-БАНККЕ БАРЫЎ', 'Тәуекелге бел буўыў.', 'ф.'],
  ['dd291342', '7dc46f65', 'БАЛҚАР І', null, 'кел.'],
  ['11a6b98a', '813ba45a', 'УДАЙЫНА', null, 'р.'],
  ['a58ccf3d', '91f6f6e8', 'ӘДА', 'Әда болмаў. Таўсылмаў, даўам етиў.', 'к.ф.'],
  ['bc448b30', '95fc5e0c', null, 'Азлаў.', 'р.'],
  ['5b57b60a', '98d1e2a4', 'АСЫҚ ІІ', 'Асығыў фейилиниң буйрық формасы.', 'ф.'],
  ['4ee0eee4', 'a391fa99', 'АШШЫЛАЎ ІІ', 'Бир ашшы затты жегиси келиў, ашшылағысы келиў.', 'ф.'],
  ['91b9f498', 'aa585b2a', 'ӘГӘР', '(ӘГӘРКИ) қ. егер де.', 'қ.'],
  ['2b8cd02a', 'af1325f6', 'ЖҮЗ V', 'Адам қайтыс болғаннан кейин жүз күн толыўына байланыслы берилетуғын садақа. Бердимурат жақында әкесиниң жүзин берди.', 'ат.'],
  ['37bad0fe', 'b1c708e0', null, 'Ғарғаның ала түри.', 'ат.'],
  ['899c23ba', 'b8637023', 'ЫССЫЛАЙ', null, 'р.'],
  ['315ff00d', 'bf89724c', 'ЖҮДӘМА', null, 'д.'],
  ['2e136694', 'c3c362c0', 'ҚУЛАНША', null, 'р.'],
  ['073db97a', 'c5d4efbd', 'ҚАЛТАҢ', null, 'р.'],
  ['59cd74d7', 'd3fb9d39', 'БИЛЕН', null, 'гөн.с.'],
];

for (const [tid, did, soz, def, cat] of FIXES) {
  await apply(tid, did, soz, def, cat);
}
console.log('MODE:', WRITE ? 'WRITE' : 'DRY-RUN');
await db.end();
