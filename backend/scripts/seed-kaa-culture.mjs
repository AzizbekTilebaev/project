/**
 * Qaraqalpaq madaniy bilimlar to‘plami + lug‘at yozuvlari
 *
 *   node scripts/seed-kaa-culture.mjs
 *   node scripts/seed-kaa-culture.mjs --force
 */
import dotenv from 'dotenv';
import { validateTitlesArray } from '../src/validators/title.validator.js';
import TusindirmeService from '../src/services/tusindirmeService.js';
import db from '../src/config/dictionary.db.js';

dotenv.config();
const FORCE = process.argv.includes('--force');

const CULTURE = {
  language: 'qaraqalpaqsha',
  packs: [
    {
      id: 'besqala',
      title: 'Bes qala',
      subtitle: 'Qaraqalpaqstannıń tariyxıy bes qalası',
      items: [
        { name: 'Xojeli', alt: 'ХОЖЕЛИ' },
        { name: 'Qońırat', alt: 'ҚОҢЫРАТ' },
        { name: 'Shımbay', alt: 'ШЫМБАЙ' },
        { name: 'Shoraxan', alt: 'ШОРАХАН', note: 'Tórtkúl' },
        { name: 'Shabbaz', alt: 'ШАББАЗ', note: 'Beruniy' },
      ],
    },
    {
      id: 'founded',
      title: 'Qala hám rayonlar qashan dúzilgen?',
      subtitle: 'Qaraqalpaqstan Respublikası',
      source: '@Dunya_siyasat_jamiyet',
      items: [
        { name: 'Nókis qalası', date: '1932-jıl' },
        { name: 'Qońırat', date: '1927-jıl, 22-iyun' },
        { name: 'Shımbay', date: '1927-jıl, 3-iyul' },
        { name: 'Xojeli', date: '1927-jıl, 3-iyul' },
        { name: 'Beruniy', date: '1927-jıl, 3-iyul' },
        { name: 'Tórtkúl', date: '1927-jıl, 13-iyul' },
        { name: 'Kegeyli', date: '1928-jıl, 3-sentyabr' },
        { name: 'Moynaq', date: '1931-jıl, 15-sentyabr' },
        { name: 'Taqıyatas', date: '1953-jıl (qayta 2017-jıl avgust)' },
        { name: 'Taqtakópir', date: '1965-jıl, 29-dekabr' },
        { name: 'Shomanay', date: '1967-jıl, 9-yanvar' },
        { name: 'Nókis r/n', date: '1968-jıl, 25-dekabr' },
        { name: 'Qanlıkól', date: '1970-jıl, 7-dekabr' },
        { name: 'Qaraózek', date: '1975-jıl, 26-sentyabr' },
        { name: 'Ellikqala', date: '1977-jıl, 23-fevral' },
        { name: 'Bozataw', date: '1979-jıl, 10-aprel (qayta 2019-jıl, sentyabr)' },
      ],
    },
    {
      id: 'jeti-urpaq',
      title: 'Jetı urpaq',
      subtitle: 'Jetı áwlad atamaları — Qaraqalpaqsha',
      items: [
        { n: 1, name: 'belbala' },
        { n: 2, name: 'aqlıq' },
        { n: 3, name: 'shawlıq' },
        { n: 4, name: 'quwlıq' },
        { n: 5, name: 'tuwlıq' },
        { n: 6, name: 'bawlıq' },
        { n: 7, name: 'jatlıq' },
      ],
    },
    {
      id: 'gimn',
      title: 'Mámleketlik Gimn',
      subtitle: '1993-jılı 24-dekabr — qabıl etilgen kún',
      meta: {
        author: 'I. Yusupov',
        composer: 'Najimaddin Muxammeddinov',
        adopted: '1993-12-24',
      },
      lyrics: [
        'Jayxun jaǵasında ósken bayterek,',
        'Túbi bir shaqası mıń bolar demek,',
        'Sen sonday sayalı quyashlı elseń,',
        'Tınıshlıq hám ıǵbal sendegi tilek.',
        '',
        'Diyxan baba nápesi bar jerinde,',
        'Juwısan ańqıp, kiyik qashar shólinde,',
        '«Qaraqalpaqstan» degen atıńdı,',
        'Áwladlar ádiwler júrek tóride.',
        '',
        'Aydın keleńshekke shaqırar zaman,',
        'Mártlik miynet, bilim jetizer oǵan,',
        'Xalqıń bar azamat, dos hám miyirban,',
        'Erkin jaynap-jasnap, máńgi bol aman.',
        '',
        'Diyxan baba nápesi bar jerinde,',
        'Juwısan ańqıp, kiyik qashar shólinde,',
        '«Qaraqalpaqstan» degen atıńdı,',
        'Áwladlar ádiwler júrek tóride.',
      ],
    },
    {
      id: 'jeti-gaziynie',
      title: 'Jetı ǵáziyne',
      subtitle: 'Qaraqalpaqstan ǵáziyneleri',
      items: [
        { n: 1, name: 'Sıyır', gloss: 'xojalıqtıń qassabı hám baqqalı' },
        { n: 2, name: 'Pal hárre', gloss: 'shańaraqtıń táwibi' },
        { n: 3, name: 'Jipek qurtı', gloss: 'qızlardıń sebi' },
        { n: 4, name: 'Mayjuwaz', gloss: 'qazannıń mayı' },
        { n: 5, name: 'Digirman', gloss: 'qarınnıń belbewi' },
        { n: 6, name: 'Toǵay', gloss: 'imarat súyegi, qazan otı' },
        { n: 7, name: 'Tawıq', gloss: 'hám gósh, hám dárman' },
      ],
    },
    {
      id: 'hapte-kunleri',
      title: 'Hápte kúnleriniń shıǵısı',
      subtitle: 'Etimologiya — @qaraqalpaq_tilim_qalqanim',
      source: 'ChatExport index-2.html',
      items: [
        {
          n: 1,
          name: 'Dúyshembi',
          gloss: 'parsısha doshánbe — «eki shembi; shembiden keyingi ekinshi kún»',
        },
        {
          n: 2,
          name: 'Shiyshembi',
          gloss: 'parsısha seshánbe — «úshinshi shembi»',
        },
        {
          n: 3,
          name: 'Sárshembi',
          gloss: 'parsısha charshánbe — «shembiden keyingi tórtinshi kún»',
        },
        {
          n: 4,
          name: 'Piyshembi',
          gloss: 'parsısha pándj + shánbe — «bes + shembi»',
        },
        {
          n: 5,
          name: 'Juma',
          gloss: 'arabsha jumatun — «hápte»; «juma, besinshi kún»',
        },
        {
          n: 6,
          name: 'Shembi',
          gloss: 'parsısha shánbe — jumadan keyingi, altınshı kún',
        },
        {
          n: 7,
          name: 'Ekshembi',
          gloss: 'parsısha yekshánbe — «birinshi shembi»; demalıs / bazar kúni',
        },
      ],
    },
    {
      id: 'til-kuni',
      title: 'Mámleketlik til kúni',
      subtitle: '1-dekabr',
      source: 'ChatExport index-2.html',
      meta: {
        date: '1989-jılı 1-dekabr',
      },
      body:
        '1989-jılı 1-dekabrde Qaraqalpaqstan Respublikasınıń «Mámleketlik til haqqında»ǵı Nızamı qabıl etildi. Sol kún — qaraqalpaq tiline mámleketlik til biyligi berilgen kún.',
    },
    {
      id: 'sayaxat-7',
      title: 'Jetı sayaxat ornı',
      subtitle: 'Qaraqalpaqstan Respublikası',
      source: 'ChatExport index-2.html',
      items: [
        {
          n: 1,
          name: 'Savickiy muzeyi',
          gloss: '«Sahradaǵı Luvr» — 90 mıńnan artıq eksponat; Oraylıq Aziyadaǵı eń jaqsı kórkem kollekciyalardan biri',
        },
        {
          n: 2,
          name: 'Aral teńizi',
          gloss: 'Nókiske ~400 km; Ústirt boylap sayaxat, jaǵasında otawlar',
        },
        {
          n: 3,
          name: 'Korabller muzeyi',
          gloss: 'Moynaqtaǵı «Ashıq aspan astındaǵı korabller» — házir 11 korabl',
        },
        {
          n: 4,
          name: 'Mizdakxan',
          gloss: 'Xojeli átirapı — Gyaur qala, Shamun nabi, Mazlumxan sulıw hám t.b.',
        },
        {
          n: 5,
          name: 'Ayaz qala',
          gloss: 'Beruniy rayonı — Kushan dáwiri qorǵanı (II–IV ásir)',
        },
        {
          n: 6,
          name: 'Barsakelmes',
          gloss: 'Qońırat — Tetis qaldıǵı shorlıq; «barsań, qaytıp kelmeyseń»',
        },
        {
          n: 7,
          name: 'Sudoche kóli',
          gloss: 'Moynaq — flamingo hám migrant quslar; 50 mıń+ ga',
        },
      ],
    },
    {
      id: 'aydar',
      title: 'Aydar shash nege qoyıladı?',
      subtitle: 'Milliy dástúr — er balaǵa',
      source: 'ChatExport index-2.html · Seydin Ámirlan',
      items: [
        { n: 1, name: 'Kóp kúttirilgen ul', gloss: 'shańaraq uzaq kútkén perzent' },
        { n: 2, name: 'Aldınǵı náreste turmaǵan', gloss: 'sońǵı ulğa aydar' },
        { n: 3, name: 'Qızlardan keyingi ul', gloss: 'aldın gileń qız bolǵan shańaraqta' },
        { n: 4, name: 'Ayrıqsha nıshan', gloss: 'shoq shash yamasa bas kesası menen tuwılǵan' },
        { n: 5, name: 'Írımlıq', gloss: '«aybatlı bolsın, til-kózden aman bolsın»' },
      ],
      note:
        'Qız balaǵa ádette tulımshaq qoyıladı. Írımlıq ushın geyde qızǵa da aydar qoyıw ushırasadı.',
    },
    {
      id: 'enshi',
      title: 'Enshi beriw',
      subtitle: 'Qaraqalpaq úrp-ádeti',
      source: 'ChatExport index-2.html',
      body:
        'Perzentleri erjetip, úylenip shańaraqlı bolǵannan soń, ata-anası olarǵa jańa otaw tigip, dúnya-múlk berip bólek shıǵaradı — bunı «enshisin berdi» dep ataydı. Qızǵa turmısqa shıqqannan soń «jasaw» hám bir mal «enshi»ge beriledi; qızı balalı bolǵanda jiyenge de enshi beriledi.',
    },
    {
      id: 'milliy-tagam',
      title: 'Milliy taǵamlar',
      subtitle: 'Qaraqalpaq ası',
      source: 'ChatExport index-2.html',
      items: [
        {
          name: 'Aqsawlaq',
          gloss: 'Biyday unına may qosıp iylep, juqalap qazanda pisiriledi; shıyırıp kesiledi, sorpaǵa salınadı',
        },
        {
          name: 'Júweri gúrtik',
          gloss: 'Tek qaraqalpaqta keń taralǵan; qonaq ası — gósh, tawıq, balıq, qazı menen',
        },
        {
          name: 'Júweri jarǵan',
          gloss: 'Júweri unınan; júweri bórtpe / jarma dep te ataladı; toyımlı taǵam',
        },
        {
          name: 'Qawın aqsawlaq',
          gloss: 'Qaynatılǵan qawın ústine aqsawlaq, sarı may hám qatıq',
        },
      ],
    },
    {
      id: 'quraq',
      title: 'Quraq',
      subtitle: 'Qaraqalpaq qol óneri',
      source: 'ChatExport index-2.html',
      body:
        'Hár túrli reńdegi shúbereklerden qurap kórpeshe, dastıq, dasturxan, kergi, dásker, shımıldıq, bala gúrteshe islenedi. Baslı naǵısları: segizaq, tortaq, shiy quraq, dastıq kóz, bawırsaq gúl.',
    },
    {
      id: 'qumay-aniz',
      title: 'Qumay qus haqqında',
      subtitle: 'Ańız',
      source: 'ChatExport index-2.html',
      body:
        'Ózbekstan hám Qaraqalpaqstan gerbindegi Qumay — baxıt qusı. «Avesto»daǵı Senemurg / Semurgqa jaqın: xalıqtıń jaqsı ármanları tımsalı. Túrkiy variantlar: Qumay, Anka, Dáwlet qusı hám t.b.',
    },
    {
      id: 'musulmansha-jil',
      title: 'Musılmansha jıl atamaları',
      subtitle: '12 haywan jılı — este saqlań',
      source: 'index.html · @qaraqalpaq_tilim_qalqanim',
      items: [
        { n: 1, name: 'Tıshqan', gloss: 'tıshqan jılı' },
        { n: 2, name: 'Sıyır', gloss: 'siyır jılı' },
        { n: 3, name: 'Barıs', gloss: 'barıs (jolbarıs) jılı' },
        { n: 4, name: 'Qoyan', gloss: 'qoyan jılı' },
        { n: 5, name: 'Ulıw', gloss: 'ulıw (balıq) jılı' },
        { n: 6, name: 'Jılan', gloss: 'jılan jılı' },
        { n: 7, name: 'Jılqı', gloss: 'jılqı jılı' },
        { n: 8, name: 'Qoy', gloss: 'qoy jılı' },
        { n: 9, name: 'Meshin', gloss: 'meshin jılı' },
        { n: 10, name: 'Tawıq', gloss: 'tawıq jılı' },
        { n: 11, name: 'Iyt', gloss: 'iyt jılı' },
        { n: 12, name: 'Qara kiyik', gloss: 'dońız / qara kiyik jılı' },
      ],
    },
    {
      id: 'olshem-sozler',
      title: 'Ólshem sózler',
      subtitle: 'Anıq hám anıq emes esaplıq ólshemler',
      source: 'index.html · @qaraqalpaq_tilim_qalqanim',
      items: [
        {
          n: 1,
          name: 'Anıq uzınlıq',
          gloss: 'metr, kilometr, decimetr, santimetr, gez, arshın',
        },
        {
          n: 2,
          name: 'Anıq awırlıq',
          gloss: 'gram, kilogram, centner, tonna, pud, batpan; gón. siyseri, seri, qadaq, mısqal',
        },
        {
          n: 3,
          name: 'Anıq maydan / waqıt',
          gloss: 'tanap, gektar, sotıx · saat, kún, hápte, ay, jıl',
        },
        {
          n: 4,
          name: 'Anıq emes uzınlıq',
          gloss: 'qulash, súyem, qarıs, eli, adım, shaqırım',
        },
        {
          n: 5,
          name: 'Anıq emes kólem',
          gloss: 'top, topar, bólek, óris, pada, úyir, salım, qısım, oram, dáste',
        },
        {
          n: 6,
          name: 'Batpan',
          gloss:
            'Gón. awırlıq ólshemi (~20–40 kg jerine qarap). Mánisi keńeyip: awır júk, uwayım, zor nárse',
        },
      ],
    },
    {
      id: 'toponim-neshe',
      title: 'Toponimika: Nókis, Ámiwdárya, Moynaq',
      subtitle: 'Qaraqalpaqstan toponimikası tariyxınan',
      source: 'index.html · @qaraqalpaq_tilim_qalqanim',
      items: [
        {
          n: 1,
          name: 'Nókis',
          gloss:
            'Paytaxt. Xalıq ańızında parsısha «Нукэс» penen baylanıslı: xan toǵız qatının shetke jibergen, olar toǵız ul tuwǵan — «toǵız / nókis» etimologiyası usı ańızǵa tiykarlanadı.',
        },
        {
          n: 2,
          name: 'Ámiwdárya',
          gloss:
            'Atı Orta ásirlerdegi Amul qalası (házirgi Sharjaw átirapı) menen baylanıslı dep esaplanadı (V.V. Bartold). Daryanıń eki jaǵında Amul hám Farab turǵan.',
        },
        {
          n: 3,
          name: 'Moynaq',
          gloss:
            '«Moynı aq» — teńizge kirip turǵan aq tóbelik / túyeniń moynınday qumshıq. Keyinirek «Moynaq» bolıp qısqarǵan (A. Begimov «Balıqshınıń qızı»).',
        },
      ],
    },
  ],
};

const MONTH_ETYMOLOGY = [
  { soz: 'DÁLIW', monthNum: 1, etymology: 'Rim ápsanalarındaǵı Yanus húrmetine «yanvarius» dep atalǵan.' },
  { soz: 'HÚT', monthNum: 2, etymology: 'Latınsha «fevruarius» — tazalanıw, pákleniw mánisin ańlatqan.' },
  { soz: 'HAMAL', monthNum: 3, etymology: 'Diyqanlar hám shopanlardıń qáwenderi Mars húrmetine «martius» sózinen alınǵan.' },
  { soz: 'SÁWIR', monthNum: 4, etymology: '«Apfire» sózinen — átiraptı gúllerge bezewshi, gózzallıqların inam etiwshi.' },
  { soz: 'JAWZA', monthNum: 5, etymology: 'Mayya «Mayus» atınan — gózzallıq, shadıqorramlıq ayı.' },
  { soz: 'SARATAN', monthNum: 6, etymology: 'Yupiterdiń ómirlik joldası Yunona húrmetine qoyılǵan.' },
  { soz: 'HÁSET', monthNum: 7, etymology: 'Rim ǵayratkeri hám láshkerbasısı Yuliy Cezar húrmetine atalǵan.' },
  { soz: 'SÚMBILE', monthNum: 8, etymology: 'Rim imperatorı Oktavian Avgust húrmeti ushın qoyılǵan.' },
  { soz: 'MIYZAN', monthNum: 9, etymology: '«September» (jeti) degen sózlerden alınǵan.' },
  { soz: 'AQÍRAP', monthNum: 10, etymology: '«Oktober» (segiz) degen sózlerden alınǵan.' },
  { soz: 'QAWÍS', monthNum: 11, etymology: '«November» (toǵız) degen sózlerden alınǵan.' },
  { soz: 'JEDDI', monthNum: 12, etymology: '«Desember» (on) degen sózlerden alınǵan.' },
];

function dictItems() {
  const items = [];

  for (const u of CULTURE.packs.find((p) => p.id === 'jeti-urpaq').items) {
    items.push({
      soz: u.name,
      normalized: u.name.toLocaleLowerCase('kk'),
      descriptions: [
        {
          category: 'urpaq ataması',
          definition: `Qaraqalpaq tilindegi jetı urpaq (jetı áwlad) qatarında ${u.n}-orın. «Jetı urpaq» — ata-baba áwladların sanaw dástúri.`,
          order: 1,
        },
      ],
    });
  }

  for (const g of CULTURE.packs.find((p) => p.id === 'jeti-gaziynie').items) {
    items.push({
      soz: g.name,
      normalized: g.name.toLocaleLowerCase('kk'),
      descriptions: [
        {
          category: 'ǵáziyne',
          definition: `Qaraqalpaqstan «Jetı ǵáziyne» qatarında ${g.n}-orın: ${g.gloss}.`,
          order: 1,
        },
      ],
    });
  }

  for (const c of CULTURE.packs.find((p) => p.id === 'besqala').items) {
    items.push({
      soz: c.name,
      normalized: c.name.toLocaleLowerCase('kk'),
      descriptions: [
        {
          category: 'qala',
          definition:
            `Qaraqalpaqstan Respublikasındaǵı tariyxıy «Bes qala» qatarına kiredi` +
            (c.note ? ` (${c.note})` : '') +
            `.`,
          order: 1,
        },
      ],
    });
  }

  items.push({
    soz: 'Gimn',
    normalized: 'gimn',
    descriptions: [
      {
        category: 'ат.',
        definition:
          'Qaraqalpaqstan Respublikasınıń Mámleketlik Gimni. 1993-jılı 24-dekabrde qabıl etilgen. Avtor: I. Yusupov. Kompozitor: Najimaddin Muxammeddinov.',
        order: 1,
      },
    ],
  });

  return items;
}

async function ensureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS kaa_culture_packs (
      pack_id varchar(64) NOT NULL,
      payload_json longtext NOT NULL,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (pack_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // optional etymology column on months
  try {
    await db.query(
      `ALTER TABLE kaa_month_names ADD COLUMN etymology text NULL AFTER meaning`
    );
  } catch {
    /* already exists */
  }
}

async function main() {
  await ensureTables();

  await db.query(
    `INSERT INTO kaa_culture_packs (pack_id, payload_json) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json)`,
    ['all', JSON.stringify(CULTURE)]
  );
  console.log('Culture packs saved');

  for (const m of MONTH_ETYMOLOGY) {
    await db.query(
      `UPDATE kaa_month_names SET etymology = ? WHERE month_num = ? OR soz = ?`,
      [m.etymology, m.monthNum, m.soz]
    );
  }
  console.log('Month etymologies updated');

  const items = dictItems();
  if (!validateTitlesArray(items)) {
    console.error(validateTitlesArray.errors);
    process.exit(2);
  }

  if (FORCE) {
    for (const it of items) {
      await db.query(`DELETE FROM titles WHERE soz = ? OR normalized = ?`, [
        it.soz,
        it.normalized,
      ]);
    }
  }

  const service = new TusindirmeService();
  const result = await service.insertNested(items);
  console.log(`Dict import: +${result.added}, skip ${result.skipped}`);

  // attach title ids into culture pack copy for UI links
  const enriched = structuredClone(CULTURE);
  for (const pack of enriched.packs) {
    if (!pack.items) continue;
    for (const item of pack.items) {
      const name = item.name;
      if (!name) continue;
      const [[row]] = await db.query(
        `SELECT id FROM titles WHERE status = 1 AND (soz = ? OR normalized = ?) LIMIT 1`,
        [name, name.toLocaleLowerCase('kk')]
      );
      if (row) item.titleId = row.id;
    }
  }
  const [[gimnTitle]] = await db.query(
    `SELECT id FROM titles WHERE soz = 'Gimn' AND status = 1 LIMIT 1`
  );
  const gimn = enriched.packs.find((p) => p.id === 'gimn');
  if (gimn && gimnTitle) gimn.titleId = gimnTitle.id;

  await db.query(
    `UPDATE kaa_culture_packs SET payload_json = ? WHERE pack_id = 'all'`,
    [JSON.stringify(enriched)]
  );

  console.log('Done');
  await db.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
