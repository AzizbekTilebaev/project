#!/usr/bin/env node
/** Import curated/premium-50.import.json into MySQL (skips existing). */
import path from 'path';
import { pathToFileURL } from 'url';
import { FORDATA_ROOT, readJson, appendProgress } from './lib/progress.js';

const BACKEND_ROOT = path.resolve(FORDATA_ROOT, '..', 'backend');
const importPath = path.join(FORDATA_ROOT, 'curated', 'premium-50.import.json');

const items = readJson(importPath);
console.log(`Importing ${items.length} curated words...`);

const dotenv = await import(pathToFileURL(path.join(BACKEND_ROOT, 'node_modules/dotenv/lib/main.js')).href);
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

const { validateTitlesArray } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/validators/title.validator.js')).href
);
const ok = validateTitlesArray(items);
if (!ok) {
  console.error('AJV failed', validateTitlesArray.errors);
  process.exit(2);
}

const { default: TusindirmeService } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/services/tusindirmeService.js')).href
);
const { default: db } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/config/dictionary.db.js')).href
);

const service = new TusindirmeService();
const result = await service.insertNested(items);
console.log(JSON.stringify({ status: 'done', ...result }, null, 2));
appendProgress({ action: 'import-premium-50', ...result });
await db.end();
