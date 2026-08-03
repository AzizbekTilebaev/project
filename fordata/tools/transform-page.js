#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { validatePage } from './lib/validate.js';
import { transformPage } from './lib/transform.js';
import { readJson, resolvePagePath, relFromFordata, appendProgress, TOOLS_ROOT } from './lib/progress.js';

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: node transform-page.js <path-to-page.json> [--out file.json]');
  process.exit(1);
}

const outIdx = process.argv.indexOf('--out');
const outPath =
  outIdx >= 0
    ? path.resolve(process.argv[outIdx + 1])
    : path.join(TOOLS_ROOT, 'out', path.basename(fileArg, '.json') + '.import.json');

const filePath = resolvePagePath(fileArg);
const entries = readJson(filePath);
const validation = validatePage(entries);
const { items, skipped } = transformPage(entries, { skipIndexes: validation.skipEntries });

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf8');

const rel = relFromFordata(filePath);
console.log(
  JSON.stringify(
    {
      file: rel,
      out: outPath,
      validationOk: validation.ok,
      errors: validation.errors,
      warnings: validation.warnings.slice(0, 20),
      items: items.length,
      skipped,
    },
    null,
    2
  )
);

appendProgress({
  action: 'transform',
  file: rel,
  items: items.length,
  skipped: skipped.length,
  out: outPath,
});

process.exit(items.length > 0 ? 0 : 2);
