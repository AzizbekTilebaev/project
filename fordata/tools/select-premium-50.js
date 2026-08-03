#!/usr/bin/env node
/**
 * Pick 50 premium-quality headwords from fordata (togri only).
 * Criteria: category present, definition >= 40 chars, optional citation example,
 * clean title, no suspicious tags, no OCR glue.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FORDATA_ROOT, appendProgress } from './lib/progress.js';
import { transformPage } from './lib/transform.js';
import { validatePage } from './lib/validate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET = 50;

const PREFERRED_DIRS = [
  'dict_pages_v2/15_remaining_simple/togri',
  'dict_pages_v2/12_has_citation/togri',
  'dict_pages_v2/11_has_quotes/togri',
];

function walkJson(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJson(p, acc);
    else if (e.name.endsWith('.json')) acc.push(p);
  }
  return acc;
}

function scoreEntry(entry) {
  if (entry._suspicious_reasons?.length) return -1;
  const title = (entry.title || '').trim();
  if (!title || title.length < 2) return -1;
  if (/[A-Za-z]{3,}[А-Я]/.test(title)) return -1;

  const defs = entry.definitions || [];
  if (!defs.length) return -1;

  let score = 0;
  let bestLen = 0;
  let hasCat = false;
  let hasExample = false;

  for (const d of defs) {
    const text = (d.text || '').trim();
    if (text.length < 40) continue;
    bestLen = Math.max(bestLen, text.length);
    const cats = (d.categorys || []).filter(Boolean);
    if (cats.length) hasCat = true;
    if (/\([^)]{2,40}\)/.test(text)) hasExample = true;
    if ((d.idioms || []).some((i) => (i.idiom || '').trim() && (i.idiom_text || '').trim())) {
      score += 5;
    }
  }

  if (!hasCat || bestLen < 40) return -1;
  score += Math.min(40, Math.floor(bestLen / 10));
  if (hasExample) score += 15;
  if (defs.length > 1) score += 8;
  if (!entry.etymology) score += 2; // prefer clean simple for curated set
  return score;
}

const seen = new Set();
const picked = [];

for (const rel of PREFERRED_DIRS) {
  const dir = path.join(FORDATA_ROOT, rel);
  const files = walkJson(dir).sort();
  for (const file of files) {
    if (picked.length >= TARGET) break;
    let entries;
    try {
      entries = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (picked.length >= TARGET) break;
      const sc = scoreEntry(entry);
      if (sc < 20) continue;
      const key = entry.title.trim().toLocaleLowerCase('kk');
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push({
        ...entry,
        _curated: {
          score: sc,
          source_file: path.relative(FORDATA_ROOT, file).replace(/\\/g, '/'),
        },
      });
    }
  }
  if (picked.length >= TARGET) break;
}

// Sort by score desc, take top 50
picked.sort((a, b) => b._curated.score - a._curated.score);
const top = picked.slice(0, TARGET);

const validation = validatePage(top);
const { items, skipped } = transformPage(top, { skipIndexes: validation.skipEntries });

const outDir = path.join(FORDATA_ROOT, 'curated');
fs.mkdirSync(outDir, { recursive: true });
const rawPath = path.join(outDir, 'premium-50.raw.json');
const importPath = path.join(outDir, 'premium-50.import.json');
const metaPath = path.join(outDir, 'premium-50.meta.json');

fs.writeFileSync(rawPath, JSON.stringify(top, null, 2), 'utf8');
fs.writeFileSync(importPath, JSON.stringify(items, null, 2), 'utf8');
fs.writeFileSync(
  metaPath,
  JSON.stringify(
    {
      count: top.length,
      importItems: items.length,
      skipped,
      words: top.map((e) => ({
        title: e.title,
        score: e._curated.score,
        source: e._curated.source_file,
        category: e.definitions?.[0]?.categorys?.[0] || null,
        defPreview: (e.definitions?.[0]?.text || '').slice(0, 80),
      })),
    },
    null,
    2
  ),
  'utf8'
);

console.log(
  JSON.stringify(
    {
      selected: top.length,
      importReady: items.length,
      rawPath: path.relative(FORDATA_ROOT, rawPath),
      importPath: path.relative(FORDATA_ROOT, importPath),
      sample: top.slice(0, 5).map((e) => e.title),
    },
    null,
    2
  )
);

appendProgress({
  action: 'select-premium-50',
  selected: top.length,
  importReady: items.length,
});
