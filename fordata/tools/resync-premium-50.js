#!/usr/bin/env node
/**
 * Re-sync curated premium-50 into DB with the improved transform:
 *  - regenerate curated/premium-50.import.json from premium-50.raw.json
 *  - for each curated word: delete existing rows (examples/idioms/desc/title) and re-insert clean
 *
 * Safe: runs in a single transaction. Only touches the 50 curated words.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { FORDATA_ROOT, readJson, appendProgress } from './lib/progress.js';
import { transformPage } from './lib/transform.js';
import { validatePage } from './lib/validate.js';

const BACKEND_ROOT = path.resolve(FORDATA_ROOT, '..', 'backend');
const rawPath = path.join(FORDATA_ROOT, 'curated', 'premium-50.raw.json');
const importPath = path.join(FORDATA_ROOT, 'curated', 'premium-50.import.json');

const raw = readJson(rawPath);
const validation = validatePage(raw);
const { items } = transformPage(raw, { skipIndexes: validation.skipEntries });
fs.writeFileSync(importPath, JSON.stringify(items, null, 2), 'utf8');
console.log(`Regenerated import: ${items.length} words`);

// Load backend env + modules
const dotenv = await import(pathToFileURL(path.join(BACKEND_ROOT, 'node_modules/dotenv/lib/main.js')).href);
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

const { validateTitlesArray } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/validators/title.validator.js')).href
);
if (!validateTitlesArray(items)) {
  console.error('AJV failed', validateTitlesArray.errors);
  process.exit(2);
}

const { default: db } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/config/dictionary.db.js')).href
);
const { default: TusindirmeService } = await import(
  pathToFileURL(path.join(BACKEND_ROOT, 'src/services/tusindirmeService.js')).href
);

async function deleteTitleDeep(conn, titleId) {
  const [descs] = await conn.query('SELECT id FROM description WHERE titles_id = ?', [titleId]);
  for (const d of descs) {
    const [idioms] = await conn.query('SELECT id FROM idioms WHERE descriptions_id = ?', [d.id]);
    for (const idm of idioms) {
      await conn.query('DELETE FROM idiom_desc WHERE idioms_id = ?', [idm.id]);
    }
    await conn.query('DELETE FROM idioms WHERE descriptions_id = ?', [d.id]);
    await conn.query('DELETE FROM examples WHERE descriptions_id = ?', [d.id]);
  }
  await conn.query('DELETE FROM description WHERE titles_id = ?', [titleId]);
  await conn.query('DELETE FROM titles WHERE id = ?', [titleId]);
}

const conn = await db.getConnection();
let removed = 0;
try {
  await conn.beginTransaction();
  for (const item of items) {
    const [rows] = await conn.query('SELECT id FROM titles WHERE soz = ?', [item.soz]);
    for (const r of rows) {
      await deleteTitleDeep(conn, r.id);
      removed++;
    }
  }
  await conn.commit();
} catch (e) {
  await conn.rollback();
  console.error('delete failed', e);
  await db.end();
  process.exit(1);
} finally {
  conn.release();
}
console.log(`Removed ${removed} old title rows`);

const service = new TusindirmeService();
const result = await service.insertNested(items);
console.log(JSON.stringify({ status: 'resynced', ...result }, null, 2));
appendProgress({ action: 'resync-premium-50', removed, ...result });
await db.end();
