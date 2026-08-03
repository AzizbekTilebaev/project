#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanTitle } from './lib/transform.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORDATA_ROOT = path.resolve(__dirname, '..');
const DICT_ROOT = path.join(FORDATA_ROOT, 'dict_pages_v2');

const TARGETS = [
  'Ақырысында',
  'бахалаў',
  'бирак',
  'ак отаў',
  'Уйкылаў',
  'әлле не',
  'лал ІІ',
  'байкаў',
  'сейис',
  'қатнас',
  'кетиў',
  'боз І',
  'печь',
  'егер де',
  'ак үй',
  'ақ орда',
  'ер І',
  'Аяз баба',
  'мий',
  'ғарға',
  'Нәлет',
  'қыстаныў',
];

function fold(value) {
  return String(value || '')
    .toLocaleLowerCase('kk')
    .replace(/[.,:;!?()[\]{}«»"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/қ/g, 'к')
    .replace(/ғ/g, 'г')
    .replace(/ң/g, 'н')
    .replace(/[ўүұ]/g, 'у')
    .replace(/ҳ/g, 'х')
    .replace(/і/g, 'i');
}

function jsonFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...jsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
  }
  return files;
}

const wanted = TARGETS.map((target) => ({ target, folded: fold(target) }));
const matches = new Map(TARGETS.map((target) => [target, []]));

for (const file of jsonFiles(DICT_ROOT)) {
  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    continue;
  }
  if (!Array.isArray(entries)) continue;

  entries.forEach((entry, index) => {
    const title = cleanTitle(entry.title);
    const titleFolded = fold(title);
    for (const item of wanted) {
      const exact = titleFolded === item.folded;
      const homonymBase =
        titleFolded.replace(/\s+[ivx]+$/i, '') === item.folded.replace(/\s+[ivx]+$/i, '');
      if (!exact && !homonymBase) continue;
      matches.get(item.target).push({
        file: path.relative(FORDATA_ROOT, file).replaceAll('\\', '/'),
        index,
        title: entry.title,
        full_text: entry.full_text,
        definitions: entry.definitions,
      });
    }
  });
}

const output = TARGETS.map((target) => ({
  target,
  matches: matches.get(target),
}));

const outputPath = path.join(FORDATA_ROOT, 'reference-targets.audit.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const found = output.filter((item) => item.matches.length);
console.log(`Topildi: ${found.length}/${TARGETS.length}`);
for (const item of output) {
  console.log(
    `${item.matches.length ? 'OK  ' : "YO'Q"} ${item.target}` +
      (item.matches.length
        ? ` => ${item.matches.map((match) => `${match.title} (${match.file}#${match.index})`).join(', ')}`
        : '')
  );
}
