#!/usr/bin/env node
import path from 'path';
import { validatePage } from './lib/validate.js';
import { readJson, resolvePagePath, relFromFordata, appendProgress } from './lib/progress.js';

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: node validate-page.js <path-to-page.json> [--allow-shubhali]');
  process.exit(1);
}

const allowShubhali = process.argv.includes('--allow-shubhali');
const filePath = resolvePagePath(fileArg);
const entries = readJson(filePath);
const result = validatePage(entries, { allowShubhali });

const rel = relFromFordata(filePath);
console.log(JSON.stringify({ file: rel, ...result }, null, 2));

appendProgress({
  action: 'validate',
  file: rel,
  ok: result.ok,
  errors: result.errors.length,
  warnings: result.warnings.length,
  skipEntries: result.skipEntries.length,
});

process.exit(result.ok ? 0 : 2);
