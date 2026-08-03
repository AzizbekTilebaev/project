#!/usr/bin/env node
/**
 * Import one fordata page into tusindirme_sozlik.
 *
 * Usage:
 *   node import-page.js <page.json> [--dry-run] [--api http://localhost:5000] [--force]
 *
 * Default: direct DB import via backend service (no HTTP).
 * --dry-run: validate + transform + AJV only, no write.
 * --api URL: POST to /api/tusindirme/import-nested
 */
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { validatePage } from './lib/validate.js';
import { transformPage } from './lib/transform.js';
import {
  readJson,
  resolvePagePath,
  relFromFordata,
  appendProgress,
  FORDATA_ROOT,
} from './lib/progress.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(FORDATA_ROOT, '..', 'backend');

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: node import-page.js <page.json> [--dry-run] [--api URL] [--force]');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const apiIdx = process.argv.indexOf('--api');
const apiBase = apiIdx >= 0 ? process.argv[apiIdx + 1] : null;

async function loadAjvValidator() {
  const mod = await import(pathToFileURL(path.join(BACKEND_ROOT, 'src/validators/title.validator.js')).href);
  return mod.validateTitlesArray;
}

async function importDirect(items) {
  // Ensure dotenv loads before pool
  const dotenv = await import(pathToFileURL(path.join(BACKEND_ROOT, 'node_modules/dotenv/lib/main.js')).href);
  dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

  const { default: TusindirmeService } = await import(
    pathToFileURL(path.join(BACKEND_ROOT, 'src/services/tusindirmeService.js')).href
  );
  const { default: db } = await import(
    pathToFileURL(path.join(BACKEND_ROOT, 'src/config/dictionary.db.js')).href
  );

  const service = new TusindirmeService();
  const result = await service.insertNested(items);
  await db.end();
  return result;
}

async function importViaApi(items, base) {
  const dotenv = await import(pathToFileURL(path.join(BACKEND_ROOT, 'node_modules/dotenv/lib/main.js')).href);
  dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

  const url = `${base.replace(/\/$/, '')}/api/tusindirme/import-nested`;
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.IMPORT_API_KEY) {
    headers['x-import-key'] = process.env.IMPORT_API_KEY;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(items),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${JSON.stringify(body)}`);
  }
  return body.data || body;
}

async function main() {
  const filePath = resolvePagePath(fileArg);
  const rel = relFromFordata(filePath);
  const entries = readJson(filePath);
  const validation = validatePage(entries);

  if (!validation.ok && !force) {
    console.error(JSON.stringify({ file: rel, status: 'validation_failed', ...validation }, null, 2));
    appendProgress({ action: 'import', file: rel, status: 'validation_failed', errors: validation.errors });
    process.exit(2);
  }

  const { items, skipped } = transformPage(entries, { skipIndexes: validation.skipEntries });
  if (!items.length) {
    console.error(JSON.stringify({ file: rel, status: 'no_items', skipped }, null, 2));
    appendProgress({ action: 'import', file: rel, status: 'no_items', skipped });
    process.exit(2);
  }

  const validateTitlesArray = await loadAjvValidator();
  const ajvOk = validateTitlesArray(items);
  if (!ajvOk) {
    console.error(
      JSON.stringify(
        { file: rel, status: 'ajv_failed', errors: validateTitlesArray.errors },
        null,
        2
      )
    );
    appendProgress({ action: 'import', file: rel, status: 'ajv_failed', errors: validateTitlesArray.errors });
    process.exit(2);
  }

  if (dryRun) {
    const summary = {
      file: rel,
      status: 'dry_run_ok',
      items: items.length,
      skipped,
      warnings: validation.warnings.slice(0, 15),
      sample: items.slice(0, 2),
    };
    console.log(JSON.stringify(summary, null, 2));
    appendProgress({ action: 'import', file: rel, status: 'dry_run_ok', items: items.length });
    return;
  }

  let result;
  if (apiBase) {
    result = await importViaApi(items, apiBase);
  } else {
    result = await importDirect(items);
  }

  const out = {
    file: rel,
    status: 'imported',
    result,
    skipped,
    warnings: validation.warnings.length,
  };
  console.log(JSON.stringify(out, null, 2));
  appendProgress({ action: 'import', file: rel, status: 'imported', ...result });
}

main().catch((err) => {
  console.error(err);
  appendProgress({ action: 'import', file: fileArg, status: 'error', error: String(err.message || err) });
  process.exit(1);
});
