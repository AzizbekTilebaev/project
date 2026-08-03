/**
 * Qaraqalpaq an'anaviy oy atamalari (arabcha zodiak) → kk_tusindirme
 *
 *   node scripts/seed-kaa-month-names.mjs
 *   node scripts/seed-kaa-month-names.mjs --force
 */
import dotenv from 'dotenv';
import { validateTitlesArray } from '../src/validators/title.validator.js';
import TusindirmeService from '../src/services/tusindirmeService.js';
import db from '../src/config/dictionary.db.js';
import searchFold from '../src/utils/searchFold.js';

dotenv.config();

const FORCE = process.argv.includes('--force');

const MONTHS = [
  {
    soz: 'DÁLIW',
    arabic: 'دلو',
    meaning: 'shelek',
    month: 'Yanvar',
    monthNum: 1,
  },
  {
    soz: 'HÚT',
    arabic: 'حوت',
    meaning: 'úlken balıq, kit',
    month: 'Fevral',
    monthNum: 2,
  },
  {
    soz: 'HAMAL',
    arabic: 'حمل',
    meaning: 'qozı',
    month: 'Mart',
    monthNum: 3,
  },
  {
    soz: 'SÁWIR',
    arabic: 'ثور',
    meaning: 'buǵa',
    month: 'Aprel',
    monthNum: 4,
  },
  {
    soz: 'JAWZA',
    arabic: 'جوزاء',
    meaning: 'egiz',
    month: 'May',
    monthNum: 5,
  },
  {
    soz: 'SARATAN',
    arabic: 'سرطان',
    meaning: 'teńiz shayanı',
    month: 'Iyun',
    monthNum: 6,
  },
  {
    soz: 'HÁSET',
    arabic: 'أسد',
    meaning: 'arıslan',
    month: 'Iyul',
    monthNum: 7,
  },
  {
    soz: 'SÚMBILE',
    arabic: 'سنبل',
    meaning: 'masaq; qızǵaldaq',
    month: 'Avgust',
    monthNum: 8,
  },
  {
    soz: 'MIYZAN',
    arabic: 'ميزان',
    meaning: 'ólshewish',
    month: 'Sentyabr',
    monthNum: 9,
  },
  {
    soz: 'AQÍRAP',
    arabic: 'عقرب',
    meaning: 'shayan',
    month: 'Oktyabr',
    monthNum: 10,
  },
  {
    soz: 'QAWÍS',
    arabic: 'قوس',
    meaning: 'oq jay',
    month: 'Noyabr',
    monthNum: 11,
  },
  {
    soz: 'JEDDI',
    arabic: 'جدى',
    meaning: 'ılaq',
    month: 'Dekabr',
    monthNum: 12,
  },
];

function toItem(m) {
  const definition =
    `Qaraqalpaq tilindegi anʼanavıy oy ataması (${m.month}). ` +
    `Arabsha: ${m.arabic}. Mánisi: ${m.meaning}. ` +
    `Grigorian kalendarında ${m.month} ayına tuwra keledi.`;
  return {
    soz: m.soz,
    normalized: m.soz.toLocaleLowerCase('kk'),
    descriptions: [
      {
        category: 'oy ataması',
        definition,
        order: 1,
      },
    ],
  };
}

async function ensureMetaTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS kaa_month_names (
      month_num tinyint unsigned NOT NULL,
      soz varchar(64) NOT NULL,
      arabic varchar(32) NOT NULL,
      meaning varchar(255) NOT NULL,
      gregorian_month varchar(32) NOT NULL,
      title_id varchar(64) DEFAULT NULL,
      PRIMARY KEY (month_num),
      UNIQUE KEY uq_kaa_month_soz (soz)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function main() {
  await ensureMetaTable();

  const items = MONTHS.map(toItem);
  if (!validateTitlesArray(items)) {
    console.error('AJV:', validateTitlesArray.errors);
    process.exit(2);
  }

  if (FORCE) {
    for (const m of MONTHS) {
      const fold = searchFold(m.soz);
      const [titles] = await db.query(
        `SELECT id FROM titles WHERE soz = ? OR normalized = ? OR search_key = ?`,
        [m.soz, m.soz.toLocaleLowerCase('kk'), fold]
      );
      for (const t of titles) {
        await db.query(`DELETE FROM titles WHERE id = ?`, [t.id]);
      }
    }
    await db.query(`DELETE FROM kaa_month_names`);
    console.log('Force: eski yozuvlar o‘chirildi');
  }

  const service = new TusindirmeService();
  const result = await service.insertNested(items);
  console.log(`IMPORT titles: +${result.added}, skip ${result.skipped}`);

  // Link title_ids into meta table
  for (const m of MONTHS) {
    const [[row]] = await db.query(
      `SELECT id FROM titles WHERE soz = ? AND status = 1 LIMIT 1`,
      [m.soz]
    );
    await db.query(
      `INSERT INTO kaa_month_names (month_num, soz, arabic, meaning, gregorian_month, title_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         arabic = VALUES(arabic),
         meaning = VALUES(meaning),
         gregorian_month = VALUES(gregorian_month),
         title_id = COALESCE(VALUES(title_id), title_id),
         soz = VALUES(soz)`,
      [m.monthNum, m.soz, m.arabic, m.meaning, m.month, row?.id || null]
    );
  }

  const [rows] = await db.query(
    `SELECT month_num, soz, arabic, meaning, gregorian_month, title_id FROM kaa_month_names ORDER BY month_num`
  );
  console.log(JSON.stringify(rows, null, 2));
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
