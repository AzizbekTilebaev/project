#!/usr/bin/env node
/**
 * Import all remaining fordata dict_pages_v2 (togri JSON pages) into live DB.
 * Skips pages already marked imported in progress.jsonl.
 *
 *   node import-remaining.js [--dry-run] [--limit N] [--include-shubhali]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { validatePage } from './lib/validate.js';
import { transformPage } from './lib/transform.js';
import {
  FORDATA_ROOT,
  PROGRESS_PATH,
  appendProgress,
  listJsonFiles,
  readJson,
  relFromFordata,
} from './lib/progress.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(FORDATA_ROOT, '..', 'backend');

const dryRun = process.argv.includes('--dry-run');
const includeShubhali = process.argv.includes('--include-shubhali');
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(process.argv[limitIdx + 1]) : Infinity;

function alreadyImported() {
  const set = new Set();
  if (!fs.existsSync(PROGRESS_PATH)) return set;
  for (const line of fs.readFileSync(PROGRESS_PATH, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      if (o.status === 'imported' && o.file) set.add(o.file.replace(/\\/g, '/'));
    } catch {
      /* ignore */
    }
  }
  return set;
}

function collectPages() {
  const root = path.join(FORDATA_ROOT, 'dict_pages_v2');
  const done = alreadyImported();
  const pages = [];
  for (const cat of fs.readdirSync(root).sort()) {
    const catDir = path.join(root, cat);
    if (!fs.statSync(catDir).isDirectory()) continue;
    const buckets = includeShubhali
      ? ['togri', 'shubhali', 'togri_repaired']
      : ['togri', 'togri_repaired'];
    for (const bucket of buckets) {
      const dir = path.join(catDir, bucket);
      if (!fs.existsSync(dir)) continue;
      for (const file of listJsonFiles(dir)) {
        const rel = relFromFordata(file);
        if (done.has(rel)) continue;
        pages.push(file);
      }
    }
  }
  return pages;
}

async function loadImporter() {
  const dotenv = await import(
    pathToFileURL(path.join(BACKEND_ROOT, 'node_modules/dotenv/lib/main.js')).href
  );
  dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

  const { default: TusindirmeService } = await import(
    pathToFileURL(path.join(BACKEND_ROOT, 'src/services/tusindirmeService.js')).href
  );
  const { default: db } = await import(
    pathToFileURL(path.join(BACKEND_ROOT, 'src/config/dictionary.db.js')).href
  );
  const { validateTitlesArray } = await import(
    pathToFileURL(path.join(BACKEND_ROOT, 'src/validators/title.validator.js')).href
  );

  // Confirm target DB
  const [[row]] = await db.query('SELECT DATABASE() AS db');
  console.log(`Target DB: ${row.db}`);
  if (!String(row.db || '').includes('kk_tusindirme') && !dryRun) {
    throw new Error(`Refusing to import into unexpected DB: ${row.db}`);
  }

  return { service: new TusindirmeService(), db, validateTitlesArray };
}

async function main() {
  let pages = collectPages();
  if (Number.isFinite(limit)) pages = pages.slice(0, limit);
  console.log(`Pages to process: ${pages.length}${dryRun ? ' (dry-run)' : ''}`);

  const { service, db, validateTitlesArray } = await loadImporter();
  const summary = {
    files: pages.length,
    ok: 0,
    failed: 0,
    added: 0,
    skipped: 0,
    validationFailed: 0,
  };

  try {
    for (let i = 0; i < pages.length; i++) {
      const file = pages[i];
      const rel = relFromFordata(file);
      process.stdout.write(`[${i + 1}/${pages.length}] ${rel} ... `);
      try {
        const entries = readJson(file);
        const validation = validatePage(entries);
        if (!validation.ok) {
          summary.validationFailed++;
          summary.failed++;
          console.log('validation_failed');
          appendProgress({
            action: 'import',
            file: rel,
            status: 'validation_failed',
            errors: validation.errors,
          });
          continue;
        }

        const { items, skipped } = transformPage(entries, {
          skipIndexes: validation.skipEntries,
        });
        if (!items.length) {
          summary.failed++;
          console.log('no_items');
          appendProgress({ action: 'import', file: rel, status: 'no_items', skipped });
          continue;
        }

        const ajvOk = validateTitlesArray(items);
        if (!ajvOk) {
          summary.failed++;
          console.log('ajv_failed');
          appendProgress({
            action: 'import',
            file: rel,
            status: 'ajv_failed',
            errors: validateTitlesArray.errors,
          });
          continue;
        }

        if (dryRun) {
          summary.ok++;
          console.log(`dry_run_ok items=${items.length}`);
          appendProgress({
            action: 'import',
            file: rel,
            status: 'dry_run_ok',
            items: items.length,
          });
          continue;
        }

        // Silence per-word logs from insertNested
        const origLog = console.log;
        console.log = () => {};
        let result;
        try {
          result = await service.insertNested(items);
        } finally {
          console.log = origLog;
        }

        summary.ok++;
        summary.added += result.added || 0;
        summary.skipped += result.skipped || 0;
        console.log(`ok +${result.added} skip=${result.skipped}`);
        appendProgress({
          action: 'import',
          file: rel,
          status: 'imported',
          added: result.added,
          skipped: result.skipped,
          total: result.total,
        });
      } catch (err) {
        summary.failed++;
        console.log(`ERROR ${err.message || err}`);
        appendProgress({
          action: 'import',
          file: rel,
          status: 'error',
          error: String(err.message || err),
        });
      }
    }
  } finally {
    await db.end();
  }

  appendProgress({ action: 'import-remaining-done', ...summary, dryRun });
  console.log('\nSUMMARY', JSON.stringify(summary, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
