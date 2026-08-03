#!/usr/bin/env node
// КЕЛИС/САҒАТ havolalari uchun yetishmayotgan nishon so'zlarni import qilish.
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { transformPage } from './lib/transform.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORDATA_ROOT = path.resolve(__dirname, '..');
const BACKEND_ROOT = path.resolve(FORDATA_ROOT, '..', 'backend');
const WRITE = process.argv.includes('--write');

const SOURCES = [
  ['dict_pages_v2/08_has_subitems/togri/0007.json', 'КЕЛИЎ Ф.', 'КЕЛИЎ'],
  ['dict_pages_v2/11_has_quotes/togri/0073.json', 'КЕЛИСИЎ Ф.', 'КЕЛИСИЎ'],
  ['dict_pages_v2/12_has_citation/togri/0352.json', 'СААТ', 'СААТ'],
];

function readEntry(rel, rawTitle) {
  const entries = JSON.parse(fs.readFileSync(path.join(FORDATA_ROOT, rel), 'utf8'));
  const entry = entries.find((e) => e.title === rawTitle);
  if (!entry) throw new Error(`${rawTitle} topilmadi: ${rel}`);
  return entry;
}

const items = SOURCES.map(([file, rawTitle, desired]) => {
  const entry = readEntry(file, rawTitle);
  const t = transformPage([entry]).items[0];
  if (!t) throw new Error(`${rawTitle} transform bo'lmadi`);
  t.soz = desired;
  t.normalized = desired.toLocaleLowerCase('kk');
  return t;
});

console.log(`Tayyor: ${items.length} ta so'z`);
for (const item of items) {
  const ex = item.descriptions.reduce((n, d) => n + (d.example?.length || 0), 0);
  console.log(` - ${item.soz}: ${item.descriptions.length} ma'no, ${ex} misol`);
  for (const d of item.descriptions) {
    console.log(`     [${d.category || '-'}] ${d.definition.slice(0, 90)}`);
  }
}

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish: node tools/import-missing-targets2.js --write');
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
  console.log('\nIMPORT:', JSON.stringify(result, null, 2));
} finally {
  await db.end();
}
