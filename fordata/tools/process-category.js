#!/usr/bin/env node
/**
 * Process all JSON pages in a category folder one-by-one.
 *
 * Usage:
 *   node process-category.js dict_pages_v2/15_remaining_simple/togri [--dry-run] [--limit N] [--start NNNN]
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  FORDATA_ROOT,
  listJsonFiles,
  relFromFordata,
  appendProgress,
} from './lib/progress.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const catArg = process.argv[2];
if (!catArg) {
  console.error('Usage: node process-category.js <category-rel-path> [--dry-run] [--limit N] [--start NNNN]');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : Infinity;
const startIdx = process.argv.indexOf('--start');
const startName = startIdx >= 0 ? process.argv[startIdx + 1] : null;

const catDir = path.isAbsolute(catArg)
  ? catArg
  : path.resolve(FORDATA_ROOT, catArg);

if (!fs.existsSync(catDir)) {
  console.error('Directory not found:', catDir);
  process.exit(1);
}

let files = listJsonFiles(catDir);
if (startName) {
  const needle = startName.endsWith('.json') ? startName : `${startName}.json`;
  const i = files.findIndex((f) => path.basename(f) === needle);
  if (i >= 0) files = files.slice(i);
}

files = files.slice(0, Number.isFinite(limit) ? limit : files.length);

const importScript = path.join(__dirname, 'import-page.js');
const summary = { ok: 0, failed: 0, dry: 0, files: files.length };

console.log(`Processing ${files.length} files in ${relFromFordata(catDir)} ...`);

for (const file of files) {
  const rel = relFromFordata(file);
  const args = [importScript, file];
  if (dryRun) args.push('--dry-run');

  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    cwd: __dirname,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (r.status === 0) {
    if (dryRun) summary.dry++;
    else summary.ok++;
    console.log(`OK  ${rel}`);
  } else {
    summary.failed++;
    console.error(`FAIL ${rel}`);
    if (r.stdout) console.error(r.stdout.slice(-1500));
    if (r.stderr) console.error(r.stderr.slice(-1500));
    appendProgress({
      action: 'process-category',
      file: rel,
      status: 'failed',
      code: r.status,
    });
    // Continue one-by-one — do not abort whole category
  }
}

appendProgress({
  action: 'process-category-done',
  category: relFromFordata(catDir),
  ...summary,
  dryRun,
});

console.log(JSON.stringify({ category: relFromFordata(catDir), ...summary }, null, 2));
process.exit(summary.failed > 0 ? 1 : 0);
