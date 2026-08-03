import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import db from '../src/config/dictionary.db.js';

dotenv.config();

const WRITE = process.argv.includes('--write');
const REPORT_PATH = path.resolve('reference-synonyms.audit.json');
const ROMAN_SUFFIX_RE = /\s+(?:[IVX]+|[ІХ]+)$/iu;

function cleanTarget(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/^[кқ]\.\s*/iu, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[.;,\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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

const [titles] = await db.query(
  'SELECT id, soz, normalized FROM titles WHERE status = 1 ORDER BY `order`'
);
const exact = new Map();
const byBase = new Map();
for (const title of titles) {
  const exactKey = fold(title.normalized || title.soz);
  const baseKey = baseFold(title.normalized || title.soz);
  if (!exact.has(exactKey)) exact.set(exactKey, []);
  if (!byBase.has(baseKey)) byBase.set(baseKey, []);
  exact.get(exactKey).push(title);
  byBase.get(baseKey).push(title);
}

const [rows] = await db.query(
  `SELECT t.id AS source_id, t.soz AS source_soz, c.name AS category, d.description
   FROM description d
   JOIN titles t ON t.id = d.titles_id
   JOIN categorys c ON c.id = d.categorys_id
   WHERE t.status = 1 AND LOWER(TRIM(c.name)) IN ('к.', 'қ.')
   ORDER BY t.\`order\`, d.sort_order`
);

const ready = [];
const ambiguous = [];
const unresolved = [];
const skipped = [];
const pairKeys = new Set();

for (const row of rows) {
  const targetText = cleanTarget(row.description);
  if (!targetText || targetText.length > 80 || targetText.split(/\s+/).length > 5) {
    skipped.push({ ...row, target: targetText, reason: 'nishon formati ishonchsiz' });
    continue;
  }

  const exactMatches = exact.get(fold(targetText)) || [];
  const candidates = exactMatches.length ? exactMatches : byBase.get(baseFold(targetText)) || [];

  if (!candidates.length) {
    unresolved.push({ ...row, target: targetText });
    continue;
  }
  if (candidates.length > 1 && !exactMatches.length) {
    ambiguous.push({
      ...row,
      target: targetText,
      candidates: candidates.map((item) => ({ id: item.id, soz: item.soz })),
    });
    continue;
  }

  const target = candidates[0];
  if (target.id === row.source_id) {
    skipped.push({ ...row, target: targetText, reason: 'o‘ziga havola' });
    continue;
  }

  const [sourceId, targetId] =
    String(row.source_id).localeCompare(String(target.id)) <= 0
      ? [row.source_id, target.id]
      : [target.id, row.source_id];
  const pairKey = `${sourceId}:${targetId}`;
  if (pairKeys.has(pairKey)) continue;
  pairKeys.add(pairKey);

  ready.push({
    source_id: sourceId,
    target_id: targetId,
    source_soz: row.source_soz,
    target_soz: target.soz,
    marker: row.category,
    raw_target: targetText,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: WRITE ? 'write' : 'dry-run',
  stats: {
    referenceDefinitions: rows.length,
    ready: ready.length,
    ambiguous: ambiguous.length,
    unresolved: unresolved.length,
    skipped: skipped.length,
  },
  ready,
  ambiguous,
  unresolved,
  skipped,
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

console.log('=== HAVOLA → SINONIM AUDITI ===');
console.log(`Havola ta’rifi: ${rows.length}`);
console.log(`Tayyor: ${ready.length}`);
console.log(`Noaniq: ${ambiguous.length}`);
console.log(`Topilmadi: ${unresolved.length}`);
console.log(`O‘tkazildi: ${skipped.length}`);

console.log('\n--- TAYYOR ---');
for (const item of ready) {
  console.log(`  ${item.source_soz} ↔ ${item.target_soz} (${item.marker})`);
}
console.log('\n--- NOANIQ ---');
for (const item of ambiguous) {
  console.log(`  ${item.source_soz} → ${item.target}: ${item.candidates.map((c) => c.soz).join(', ')}`);
}
console.log('\n--- TOPILMADI ---');
for (const item of unresolved) {
  console.log(`  ${item.source_soz} → ${item.target}`);
}
console.log(`\nHisobot: ${REPORT_PATH}`);

if (!WRITE) {
  console.log('DRY-RUN. Yozish: node scripts/sync-reference-synonyms.js --write');
  await db.end();
  process.exit(0);
}

let added = 0;
for (const item of ready) {
  const [result] = await db.query(
    `INSERT IGNORE INTO word_relations
       (source_title_id, target_title_id, relation_type, note, source_kind)
     VALUES (?, ?, 'synonym', ?, 'imported')`,
    [item.source_id, item.target_id, `${item.marker} sózlik havolası`]
  );
  added += result.affectedRows;
}
console.log(`\nYOZILDI: ${added} yangi sinonim juftligi.`);
await db.end();
