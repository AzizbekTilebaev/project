#!/usr/bin/env node
/**
 * Import only the missing target words used by к./қ. reference entries.
 *
 * Default is dry-run. Use --write after reviewing the preview.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { transformPage } from './lib/transform.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORDATA_ROOT = path.resolve(__dirname, '..');
const BACKEND_ROOT = path.resolve(FORDATA_ROOT, '..', 'backend');
const WRITE = process.argv.includes('--write');

const SOURCES = [
  ['dict_pages_v2/12_has_citation/togri/0019.json', 'АҚЫРЫСЫНДА', 'АҚЫРЫСЫНДА'],
  ['dict_pages_v2/12_has_citation/togri/0072.json', 'БАҲАЛАЎ Ф.', 'БАҲАЛАЎ'],
  ['dict_pages_v2/10_has_number_in_text/togri/0001.json', 'АҚ ОТАЎ', 'АҚ ОТАЎ'],
  ['dict_pages_v2/12_has_citation/togri/0442.json', 'УЙҚЫЛАЎ Ф.', 'УЙҚЫЛАЎ'],
  ['dict_pages_v2/01_with_compound/togri/0005.json', 'ЛАЛ II', 'ЛАЛ ІІ'],
  ['dict_pages_v2/10_has_number_in_text/togri/0003.json', 'БАЙҚАЎ', 'БАЙҚАЎ'],
  ['dict_pages_v2/12_has_citation/togri/0374.json', 'СЕЙИС', 'СЕЙИС'],
  ['dict_pages_v2/12_has_citation/togri/0243.json', 'ҚАТНАС', 'ҚАТНАС'],
  ['dict_pages_v2/05_with_idioms/shubhali/0001.json', 'КЕТИЎ Ф.', 'КЕТИЎ'],
  ['dict_pages_v2/11_has_quotes/togri/0028.json', 'БОЗ І', 'БОЗ І'],
  ['dict_pages_v2/12_has_citation/togri/0334.json', 'ПЕЧЬ', 'ПЕЧЬ'],
  ['dict_pages_v2/11_has_quotes/togri/0004.json', 'АҚ ҮЙ', 'АҚ ҮЙ'],
  ['dict_pages_v2/10_has_number_in_text/togri/0001.json', 'АҚ ОРДА', 'АҚ ОРДА'],
  ['dict_pages_v2/11_has_quotes/togri/0059.json', 'ЕР І', 'ЕР І'],
  ['dict_pages_v2/11_has_quotes/togri/0010.json', 'АЯЗ БАБА', 'АЯЗ БАБА'],
  ['dict_pages_v2/11_has_quotes/togri/0104.json', 'МИЙ І', 'МИЙ І'],
  ['dict_pages_v2/09_multi_category/togri/0047.json', 'МИЙ ІІ', 'МИЙ ІІ'],
  ['dict_pages_v2/12_has_citation/togri/0295.json', 'НӘЛЕТ', 'НӘЛЕТ'],
  ['dict_pages_v2/13_multi_definition/togri/0038.json', 'ҚЫСТАНЫЎ Ф.', 'ҚЫСТАНЫЎ'],
  ['dict_pages_v2/12_has_citation/togri/0122.json', 'FAPFA', 'ҒАРҒА'],
];

const MANUAL = [
  {
    soz: 'БИРАҚ',
    normalized: 'бирақ',
    descriptions: [
      {
        category: 'к.с.',
        definition: 'Қарсы мәнили гәплерди ямаса гәп ағзаларын байланыстыратуғын көмекши сөз; деген менен, алайда.',
        order: 1,
      },
    ],
  },
  {
    soz: 'ӘЛЛЕ НЕ',
    normalized: 'әлле не',
    descriptions: [
      {
        category: 'алм.',
        definition: 'Белгисиз бир нәрсени, затты ямаса жағдайды билдиретуғын алмасық.',
        order: 1,
      },
    ],
  },
  {
    soz: 'ЕГЕР',
    normalized: 'егер',
    descriptions: [
      {
        category: 'к.с.',
        definition: 'Шәрт мәнисин билдиретуғын көмекши сөз.',
        order: 1,
        example: [
          {
            example: 'Шықпаса егер бул Нәдирша қаладан, Оның елин мен қыламан тас-талқан.',
            author: 'Қырқ қыз',
            order: 1,
          },
          {
            example: 'Егер маған Гүлайымды көрсетсең, Ат басындай алтынымды беремен.',
            author: 'Қырқ қыз',
            order: 2,
          },
        ],
      },
    ],
  },
];

const OVERRIDES = {
  'АҚ ОТАЎ': {
    category: 'ат.',
    definition: 'Ақ ордаға қарағанда кишилеў, ақ кийиз бенен жабылған 4-6 қанатлы қара үй.',
  },
  'АҚ ҮЙ': {
    category: 'ат.',
    definition: 'Ақ кийиз, ақ үзик пенен жабылған қара үй.',
    example: [
      {
        example: 'Киятырған атлылар аўылдан бөлегирек тигилген ақ үйге қарай бурылды.',
        author: 'Қыз. Ққ. г.',
        order: 1,
      },
    ],
  },
  'АҚ ОРДА': {
    category: 'ат.',
    definition:
      'Үскенеси жағынан ҳеш қандай кемшилиги жоқ, киси таң қаларлық етип үскенеленген, ақ кийиз бенен жабылған 6-8 қанатлы қара үй; бурынлары бийлер ел басқарып отыратуғын арнаўлы үй.',
  },
  'АЯЗ БАБА': {
    category: 'ат.',
    definition: 'Аяз ата, қар баба.',
  },
};

const LATIN_TO_CYRILLIC = {
  A: 'А',
  B: 'В',
  C: 'С',
  E: 'Е',
  H: 'Н',
  K: 'К',
  M: 'М',
  O: 'О',
  P: 'Р',
  T: 'Т',
  X: 'Х',
  Y: 'У',
  F: 'Ғ',
  a: 'а',
  c: 'с',
  e: 'е',
  o: 'о',
  p: 'р',
  x: 'х',
  y: 'у',
  f: 'ғ',
};

function fixMixedOcr(value) {
  if (typeof value !== 'string') return value;
  return value
    .split(/(\s+)/)
    .map((token) => {
      const latin = (token.match(/[A-Za-z]/g) || []).length;
      const cyrillic = (token.match(/[\u0400-\u04FF]/g) || []).length;
      if (!latin || !cyrillic) return token;
      return token.replace(/[A-Za-z]/g, (char) => LATIN_TO_CYRILLIC[char] || char);
    })
    .join('');
}

function cleanItem(item) {
  return {
    ...item,
    descriptions: item.descriptions.map((description) => ({
      ...description,
      definition: fixMixedOcr(description.definition)
        .replace(/\u00a0/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
      example: description.example?.map((example) => ({
        ...example,
        example: fixMixedOcr(example.example)
          .replace(/\u00a0/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim(),
      })),
    })),
  };
}

function readEntry(relativePath, rawTitle) {
  const file = path.join(FORDATA_ROOT, relativePath);
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entry = entries.find((candidate) => candidate.title === rawTitle);
  if (!entry) throw new Error(`${rawTitle} topilmadi: ${relativePath}`);
  return entry;
}

const items = SOURCES.map(([file, rawTitle, desiredTitle]) => {
  const entry = readEntry(file, rawTitle);
  const transformed = transformPage([entry]).items[0];
  if (!transformed) throw new Error(`${rawTitle} transform qilinmadi`);
  transformed.soz = desiredTitle;
  transformed.normalized = desiredTitle.toLocaleLowerCase('kk');
  const override = OVERRIDES[desiredTitle];
  if (override && transformed.descriptions[0]) {
    transformed.descriptions[0] = {
      ...transformed.descriptions[0],
      ...override,
    };
  }
  return cleanItem(transformed);
}).concat(MANUAL.map(cleanItem));

const previewPath = path.join(FORDATA_ROOT, 'reference-targets.import-preview.json');
fs.writeFileSync(previewPath, JSON.stringify(items, null, 2));

console.log(`Tayyor: ${items.length} ta so'z`);
for (const item of items) {
  const examples = item.descriptions.reduce(
    (sum, description) => sum + (description.example?.length || 0),
    0
  );
  console.log(
    ` - ${item.soz}: ${item.descriptions.length} ma'no, ${examples} misol :: ` +
      item.descriptions[0].definition.slice(0, 90)
  );
}

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish uchun: node tools/import-reference-targets.js --write');
  process.exit(0);
}

const dotenv = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'node_modules/dotenv/lib/main.js')).href
);
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
const { default: TusindirmeService } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/services/tusindirmeService.js')).href
);
const { default: db } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/config/dictionary.db.js')).href
);

try {
  const service = new TusindirmeService();
  const result = await service.insertNested(items);

  // ӘГӘР havolasi "егер де" emas, bazadagi asosiy ЕГЕР yozuviga olib borsin.
  await db.query(
    `UPDATE description d
     JOIN titles t ON t.id = d.titles_id
     SET d.description = 'егер.'
     WHERE t.soz = 'ӘГӘР' AND LOWER(d.description) LIKE '%егер де%'`
  );

  console.log('\nIMPORT:', JSON.stringify(result, null, 2));
} finally {
  await db.end();
}
