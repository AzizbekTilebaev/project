#!/usr/bin/env node
/**
 * Database definitionsidagi cross-reference nishonlarini fordata'dan topish.
 *
 * Default: audit/dry-run. Faqat validatsiyadan o'tgan `togri` manbalar olinadi.
 * Import: node tools/sync-linked-words.js --write
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { cleanOcrText, cleanTitle, transformPage } from './lib/transform.js';
import { validatePage } from './lib/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORDATA_ROOT = path.resolve(__dirname, '..');
const DICT_ROOT = path.join(FORDATA_ROOT, 'dict_pages_v2');
const BACKEND_ROOT = path.resolve(FORDATA_ROOT, '..', 'backend');
const WRITE = process.argv.includes('--write');
const INCLUDE_SHUBHALI = process.argv.includes('--include-shubhali');

const ROMAN_SUFFIX_RE = /\s+(?:[IVX]+|[ІХ]+)$/iu;
const GRAMMAR_REF_RE =
  /^(.{2,50}?)[,]?\s+фейил(?:лер)?\S*\s+[а-яёәөүғқңҳіў]+\s+д[әөa]реж\S*/iu;

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

function baseFold(value) {
  return fold(value).replace(ROMAN_SUFFIX_RE, '').trim();
}

function detectReference(category, description) {
  const cat = String(category || '').trim().toLocaleLowerCase('kk');
  const desc = String(description || '').replace(/\u00a0/g, ' ').trim();
  if (!desc) return null;

  const grammar = desc.match(GRAMMAR_REF_RE);
  if (grammar) {
    const target = cleanOcrText(grammar[1]).replace(/[,:.]+$/g, '');
    if (target && target.split(/\s+/).length <= 3) {
      return { target, kind: 'grammar' };
    }
  }

  if (desc.length > 80) return null;
  const cleaned = desc.replace(/\([^)]*\)/g, '').trim();
  const isReference = cat === 'к.' || cat === 'қ.' || /^[кқ]\.\s+/iu.test(cleaned);
  if (!isReference) return null;
  const target = cleanOcrText(
    cleaned.replace(/^[кқ]\.\s*/iu, '').replace(/[.\s]+$/g, '')
  );
  if (!target || target.length > 40 || target.split(/\s+/).length > 4) return null;
  return { target, kind: 'cross-reference' };
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

function sourceScore(source) {
  const definitions = Array.isArray(source.entry.definitions) ? source.entry.definitions : [];
  const textSize = definitions.reduce((sum, definition) => sum + String(definition.text || '').length, 0);
  return definitions.length * 10_000 + textSize;
}

function buildSourceIndex() {
  const exact = new Map();
  const byBase = new Map();
  let filesRead = 0;
  let entriesRead = 0;

  for (const file of jsonFiles(DICT_ROOT)) {
    const normalizedPath = file.replaceAll('\\', '/');
    if (!INCLUDE_SHUBHALI && !normalizedPath.includes('/togri/')) continue;

    let entries;
    try {
      entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(entries)) continue;
    filesRead++;

    entries.forEach((entry, index) => {
      const title = cleanTitle(entry.title);
      if (!title) return;
      entriesRead++;
      const source = {
        file,
        relativeFile: path.relative(FORDATA_ROOT, file).replaceAll('\\', '/'),
        index,
        title,
        entry,
      };
      const exactKey = fold(title);
      const baseKey = baseFold(title);
      if (!exact.has(exactKey)) exact.set(exactKey, []);
      if (!byBase.has(baseKey)) byBase.set(baseKey, []);
      exact.get(exactKey).push(source);
      byBase.get(baseKey).push(source);
    });
  }

  return { exact, byBase, filesRead, entriesRead };
}

function uniqueSources(sources) {
  const byTitle = new Map();
  for (const source of sources) {
    const key = fold(source.title);
    const current = byTitle.get(key);
    if (!current || sourceScore(source) > sourceScore(current)) {
      byTitle.set(key, source);
    }
  }
  return [...byTitle.values()];
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row++) {
    const current = [row];
    for (let column = 1; column <= b.length; column++) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (a[row - 1] === b[column - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function suggestSources(target, sourceIndex) {
  const wanted = baseFold(target);
  if (!wanted) return [];
  const suggestions = [];
  for (const [candidate, sources] of sourceIndex.byBase) {
    if (!candidate || candidate[0] !== wanted[0]) continue;
    if (Math.abs(candidate.length - wanted.length) > 4) continue;
    const distance = levenshtein(wanted, candidate);
    const threshold = wanted.length <= 5 ? 1 : wanted.length <= 9 ? 2 : 3;
    if (distance > threshold) continue;
    const source = uniqueSources(sources)[0];
    suggestions.push({
      title: source.title,
      distance,
      source: `${source.relativeFile}#${source.index}`,
    });
  }
  return suggestions
    .sort((a, b) => a.distance - b.distance || a.title.localeCompare(b.title))
    .slice(0, 5);
}

function selectSources(target, sourceIndex) {
  const targetFold = fold(target);
  const exact = uniqueSources(sourceIndex.exact.get(targetFold) || []);
  if (exact.length) return exact;
  return uniqueSources(sourceIndex.byBase.get(baseFold(target)) || []);
}

function prepareSource(source) {
  const validation = validatePage([source.entry], { allowShubhali: INCLUDE_SHUBHALI });
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const transformed = transformPage([source.entry], {
    skipIndexes: validation.skipEntries,
  }).items[0];
  if (!transformed?.descriptions?.length) {
    return { ok: false, errors: ['Transformdan keyin ma’no qolmadi'], warnings: validation.warnings };
  }

  return { ok: true, item: transformed, warnings: validation.warnings };
}

const dotenv = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'node_modules/dotenv/lib/main.js')).href
);
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
const { default: db } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/config/dictionary.db.js')).href
);

const [titleRows] = await db.query(
  'SELECT id, soz, normalized FROM titles WHERE status = 1'
);
const [definitionRows] = await db.query(
  `SELECT t.soz, c.name AS category, d.description
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   LEFT JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1`
);

const existingExact = new Set(titleRows.map((row) => fold(row.normalized || row.soz)));
const existingBases = new Set(titleRows.map((row) => baseFold(row.normalized || row.soz)));
const references = new Map();

for (const row of definitionRows) {
  const reference = detectReference(row.category, row.description);
  if (!reference) continue;
  const key = fold(reference.target);
  if (!references.has(key)) {
    references.set(key, {
      target: reference.target,
      kinds: new Set(),
      from: new Set(),
    });
  }
  references.get(key).kinds.add(reference.kind);
  references.get(key).from.add(row.soz);
}

const missing = [...references.values()].filter(
  (reference) =>
    !existingExact.has(fold(reference.target)) &&
    !existingBases.has(baseFold(reference.target))
);

console.log(
  `Baza: ${titleRows.length} so‘z, ${definitionRows.length} ta’rif, ` +
    `${references.size} noyob havola, ${missing.length} yetishmaydi.`
);
console.log('Fordata indeksi tuzilmoqda...');
const sourceIndex = buildSourceIndex();
console.log(
  `Fordata: ${sourceIndex.filesRead} ${INCLUDE_SHUBHALI ? 'barcha' : 'togri'} fayl, ` +
    `${sourceIndex.entriesRead} yozuv.`
);

const importItems = [];
const selectedKeys = new Set();
const report = {
  generatedAt: new Date().toISOString(),
  mode: WRITE ? 'write' : 'dry-run',
  stats: {},
  ready: [],
  unresolved: [],
  invalid: [],
};

for (const reference of missing) {
  const sources = selectSources(reference.target, sourceIndex);
  if (!sources.length) {
    report.unresolved.push({
      target: reference.target,
      kinds: [...reference.kinds],
      from: [...reference.from].slice(0, 20),
      suggestions: suggestSources(reference.target, sourceIndex),
    });
    continue;
  }

  let validForTarget = 0;
  for (const source of sources) {
    const prepared = prepareSource(source);
    if (!prepared.ok) {
      report.invalid.push({
        target: reference.target,
        source: `${source.relativeFile}#${source.index}`,
        title: source.title,
        errors: prepared.errors,
        warnings: prepared.warnings,
      });
      continue;
    }

    const key = fold(prepared.item.soz);
    if (existingExact.has(key) || selectedKeys.has(key)) continue;
    selectedKeys.add(key);
    importItems.push(prepared.item);
    validForTarget++;
    report.ready.push({
      target: reference.target,
      title: prepared.item.soz,
      source: `${source.relativeFile}#${source.index}`,
      meanings: prepared.item.descriptions.length,
      examples: prepared.item.descriptions.reduce(
        (sum, description) => sum + (description.example?.length || 0),
        0
      ),
      warnings: prepared.warnings,
    });
  }

  if (!validForTarget && !report.invalid.some((item) => item.target === reference.target)) {
    report.unresolved.push({
      target: reference.target,
      kinds: [...reference.kinds],
      from: [...reference.from].slice(0, 20),
      reason: 'Mos manba bor, lekin yangi yozuv tanlanmadi',
    });
  }
}

report.stats = {
  databaseWords: titleRows.length,
  definitions: definitionRows.length,
  uniqueReferences: references.size,
  missingTargets: missing.length,
  readyItems: importItems.length,
  unresolvedTargets: report.unresolved.length,
  invalidSources: report.invalid.length,
};

const reportPath = path.join(FORDATA_ROOT, 'linked-words.audit.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(
  `Tayyor: ${importItems.length}; topilmadi: ${report.unresolved.length}; ` +
    `validatsiyadan o‘tmadi: ${report.invalid.length}.`
);
for (const item of report.ready) {
  console.log(
    `  OK  ${item.target} => ${item.title} ` +
      `(${item.meanings} ma’no, ${item.examples} misol; ${item.source})`
  );
}
for (const item of report.unresolved) {
  console.log(`  YO‘Q ${item.target} <= ${item.from.join(', ')}`);
}
for (const item of report.invalid) {
  console.log(`  XATO ${item.target} => ${item.title}: ${item.errors.join('; ')}`);
}
console.log(`Hisobot: ${path.relative(FORDATA_ROOT, reportPath)}`);

if (!WRITE) {
  console.log('\nDRY-RUN. Import uchun: node tools/sync-linked-words.js --write');
  await db.end();
  process.exit(0);
}

if (!importItems.length) {
  console.log('Import qilinadigan yangi so‘z yo‘q.');
  await db.end();
  process.exit(0);
}

const { validateTitlesArray } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/validators/title.validator.js')).href
);
if (!validateTitlesArray(importItems)) {
  console.error('AJV validatsiya xatosi:', validateTitlesArray.errors);
  await db.end();
  process.exit(2);
}

const { default: TusindirmeService } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/services/tusindirmeService.js')).href
);
const service = new TusindirmeService();
let added = 0;
let skipped = 0;
for (let index = 0; index < importItems.length; index += 100) {
  const result = await service.insertNested(importItems.slice(index, index + 100));
  added += result.added;
  skipped += result.skipped;
}
console.log(`\nIMPORT: ${added} qo‘shildi, ${skipped} tashlab ketildi.`);
await db.end();
