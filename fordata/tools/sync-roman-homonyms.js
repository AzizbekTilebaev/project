#!/usr/bin/env node
/**
 * Rim raqamli omonimlarni tekshirish va to'ldirish.
 *
 * 1. Bazadagi har bir rim-raqamli guruh uchun fordatadan yetishmayotgan
 *    variantlarni (I, II, ...) topib import qiladi.
 * 2. Fordatada ham boshqa varianti yo'q yolg'iz raqamlilarni asosiy so'zga
 *    aylantiradi (raqam olib tashlanadi) — agar asosiy so'z band bo'lmasa.
 *
 * Default: dry-run. Yozish: node tools/sync-roman-homonyms.js --write
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { cleanTitle, transformPage } from './lib/transform.js';
import { validatePage } from './lib/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FORDATA_ROOT = path.resolve(__dirname, '..');
const DICT_ROOT = path.join(FORDATA_ROOT, 'dict_pages_v2');
const BACKEND_ROOT = path.resolve(FORDATA_ROOT, '..', 'backend');
const WRITE = process.argv.includes('--write');

const ROMAN_SUFFIX_RE = /\s+([IVXІХ]+)\s*$/iu;

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
  return fold(value).replace(/\s+[ivx]+$/iu, '').trim();
}

// Qat'iy taqqoslash: faqat kichik harf, imlo folding YO'Q (қ≠к, ғ≠г, ң≠н)
function strictFold(value) {
  return String(value || '')
    .toLocaleLowerCase('kk')
    .replace(/[.,:;!?()[\]{}«»"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/і/g, 'i');
}

function strictBase(value) {
  return strictFold(value).replace(/\s+[ivxх]+$/iu, '').trim();
}

function romanValue(raw) {
  const s = raw.toUpperCase().replace(/І/g, 'I').replace(/Х/g, 'X');
  const map = { I: 1, V: 5, X: 10 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const v = map[s[i]];
    if (!v) return null;
    const next = map[s[i + 1]] || 0;
    total += v < next ? -v : v;
  }
  return total;
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
  const defs = Array.isArray(source.entry.definitions) ? source.entry.definitions : [];
  const textSize = defs.reduce((sum, d) => sum + String(d.text || '').length, 0);
  return defs.length * 10_000 + textSize;
}

function buildSourceIndex() {
  const byBase = new Map(); // baseFold -> [source]
  let filesRead = 0;
  for (const file of jsonFiles(DICT_ROOT)) {
    const normalizedPath = file.replaceAll('\\', '/');
    if (!normalizedPath.includes('/togri/')) continue;
    let entries;
    try {
      entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(entries)) continue;
    filesRead++;
    entries.forEach((entry, index) => {
      // "АШШЫЛАЎ І." kabi rim raqamidan keyingi nuqtani olib tashlash
      const title = cleanTitle(entry.title).replace(/(\s[IVXІХ]+)\.+\s*$/iu, '$1');
      if (!title) return;
      const key = strictBase(title);
      if (!byBase.has(key)) byBase.set(key, []);
      byBase.get(key).push({
        file,
        relativeFile: path.relative(FORDATA_ROOT, file).replaceAll('\\', '/'),
        index,
        title,
        entry,
      });
    });
  }
  return { byBase, filesRead };
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

function prepareSource(source) {
  const validation = validatePage([source.entry], { allowShubhali: false });
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }
  const transformed = transformPage([source.entry], {
    skipIndexes: validation.skipEntries,
  }).items[0];
  if (!transformed?.descriptions?.length) {
    return { ok: false, errors: ['Transformdan keyin ma’no qolmadi'] };
  }
  // "АШШЫЛАЎ І." -> "АШШЫЛАЎ І"
  transformed.soz = transformed.soz.replace(/(\s[IVXІХ]+)\.+\s*$/iu, '$1').trim();
  transformed.normalized = transformed.soz.toLocaleLowerCase('kk');
  return { ok: true, item: transformed };
}

// --- DB ---
const dotenv = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'node_modules/dotenv/lib/main.js')).href
);
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });
const { default: db } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/config/dictionary.db.js')).href
);

const [titleRows] = await db.query('SELECT id, soz, normalized FROM titles WHERE status = 1');
// Import tekshiruvi qat'iy imloda: КАЛ (OCR) ni ҚАЛ deb hisoblamaslik uchun
const existingStrict = new Set(titleRows.map((r) => strictFold(r.soz)));
const existingLoose = new Set(titleRows.map((r) => fold(r.soz)));

// Rim guruhlar — guruhlashda yumshoq fold (OCR imlo farqlari bitta guruh)
const groups = new Map(); // looseBase -> { base, bases:Set, variants: [{id, soz, num}], plain: null }
for (const r of titleRows) {
  const m = r.soz.match(ROMAN_SUFFIX_RE);
  if (!m || romanValue(m[1]) == null) continue;
  const base = r.soz.replace(ROMAN_SUFFIX_RE, '').trim();
  const key = fold(base);
  if (!groups.has(key)) groups.set(key, { base, bases: new Set(), variants: [], plain: null });
  groups.get(key).bases.add(base);
  groups.get(key).variants.push({ id: r.id, soz: r.soz, num: romanValue(m[1]) });
}
for (const r of titleRows) {
  if (ROMAN_SUFFIX_RE.test(r.soz)) continue;
  const key = fold(r.soz);
  if (groups.has(key)) groups.get(key).plain = { id: r.id, soz: r.soz };
}

console.log(`Baza: ${titleRows.length} so‘z, rim guruhlar: ${groups.size}`);
console.log('Fordata indeksi tuzilmoqda...');
const sourceIndex = buildSourceIndex();
console.log(`Fordata: ${sourceIndex.filesRead} togri fayl.`);

const importItems = [];
const renames = []; // { id, from, to }
const blocked = []; // rename qilib bo'lmaydiganlar
const report = { imports: [], renames: [], blocked: [], stillGrouped: 0 };

for (const [, g] of groups) {
  // Qat'iy imlo bo'yicha manbalar (har bir bazaviy imlo varianti uchun)
  const collected = [];
  for (const baseSpelling of g.bases) {
    collected.push(...(sourceIndex.byBase.get(strictBase(baseSpelling)) || []));
  }
  const sources = uniqueSources(collected);
  // Fordatadagi bazada yo'q variantlar (qat'iy taqqoslash)
  const newSources = sources.filter(
    (s) => !existingStrict.has(strictFold(s.title)) && !existingLoose.has(fold(s.title))
  );

  // Guruhda band bo'lgan raqamlar (DB + shu turda import qilinayotganlar)
  const takenNums = new Set(g.variants.map((v) => v.num));

  const prepared = [];
  for (const source of newSources) {
    const p = prepareSource(source);
    if (!p.ok) continue;
    const m = p.item.soz.match(ROMAN_SUFFIX_RE);
    const num = m ? romanValue(m[1]) : null;
    prepared.push({ source, item: p.item, num });
  }

  // Avval raqamlilar band qiladi
  for (const p of prepared) {
    if (p.num != null) takenNums.add(p.num);
  }
  // Raqamsiz manba — kitobda raqami OCR'da yo'qolgan variant:
  // eng kichik bo'sh raqamni beramiz (guruhda boshqa variantlar borligi aniq)
  const ROMAN_NUMS = ['І', 'ІІ', 'ІІІ', 'IV', 'V', 'VI', 'VII', 'VIII'];
  for (const p of prepared) {
    if (p.num != null) continue;
    if (g.plain) continue; // bazada raqamsiz variant allaqachon bor — qo'shmaymiz
    let n = 1;
    while (takenNums.has(n)) n++;
    if (n > ROMAN_NUMS.length) continue;
    takenNums.add(n);
    p.item.soz = `${p.item.soz} ${ROMAN_NUMS[n - 1]}`;
    p.item.normalized = p.item.soz.toLocaleLowerCase('kk');
    p.assignedNum = n;
  }

  let importedForGroup = 0;
  for (const p of prepared) {
    if (p.num == null && !p.assignedNum) continue;
    importItems.push(p.item);
    importedForGroup++;
    report.imports.push({
      group: g.base,
      title: p.item.soz,
      assigned: p.assignedNum ? `raqam berildi: ${p.assignedNum}` : undefined,
      source: `${p.source.relativeFile}#${p.source.index}`,
      meanings: p.item.descriptions.length,
    });
  }

  // Yolg'iz variant va import ham topilmadi -> asosiy so'zga aylantirish
  const totalAfter = g.variants.length + importedForGroup + (g.plain ? 1 : 0);
  if (g.variants.length === 1 && !g.plain && totalAfter === 1) {
    const v = g.variants[0];
    if (existingStrict.has(strictFold(g.base))) {
      blocked.push({ id: v.id, soz: v.soz, reason: 'asosiy so‘z allaqachon bor' });
      report.blocked.push({ soz: v.soz, reason: 'asosiy so‘z band' });
    } else {
      renames.push({ id: v.id, from: v.soz, to: g.base });
      report.renames.push({ from: v.soz, to: g.base });
    }
  } else if (totalAfter > 1) {
    report.stillGrouped++;
  }
}

console.log(`\nImport uchun tayyor: ${importItems.length}`);
for (const i of report.imports) {
  console.log(`  OK  [${i.group}] ${i.title} (${i.meanings} ma’no; ${i.source})`);
}
console.log(`\nAsosiy so‘zga aylantiriladi (rename): ${renames.length}`);
for (const r of report.renames.slice(0, 250)) {
  console.log(`  ${r.from} -> ${r.to}`);
}
if (blocked.length) {
  console.log(`\nBloklangan: ${blocked.length}`);
  for (const b of blocked) console.log(`  ${b.soz}: ${b.reason}`);
}

fs.writeFileSync(
  path.join(FORDATA_ROOT, 'roman-homonyms.audit.json'),
  JSON.stringify(report, null, 2)
);

if (!WRITE) {
  console.log('\nDRY-RUN. Yozish: node tools/sync-roman-homonyms.js --write');
  await db.end();
  process.exit(0);
}

// 1) Import
if (importItems.length) {
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
  for (let i = 0; i < importItems.length; i += 100) {
    const result = await service.insertNested(importItems.slice(i, i + 100));
    added += result.added;
    skipped += result.skipped;
  }
  console.log(`\nIMPORT: ${added} qo‘shildi, ${skipped} tashlab ketildi.`);
}

// 2) Rename
let renamed = 0;
for (const r of renames) {
  await db.query('UPDATE titles SET soz = ?, normalized = ?, st_let = ? WHERE id = ?', [
    r.to,
    r.to.toLocaleLowerCase('kk'),
    r.to.charAt(0),
    r.id,
  ]);
  renamed++;
}
console.log(`RENAME: ${renamed} ta so‘zdan rim raqami olib tashlandi.`);

await db.end();
