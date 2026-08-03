/**
 * Import Qaraqalpaq adam atları sózligi.
 *
 *   node scripts/import-adam-atlari.mjs
 *   node scripts/import-adam-atlari.mjs --apply
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import searchFold from '../src/utils/searchFold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const MAIN = path.join(ROOT, 'new/adam_atlari.json');
const REVIEW = path.join(ROOT, 'new/adam_atlari_tekshiriw_kerek.json');
const SOURCE = 'adam-atlari-json';

function normalizeGender(g) {
  const v = String(g || '').trim().toLowerCase();
  if (v === 'ul' || v === 'qiz') return v;
  return null;
}

function sensesFromDescriptions(descriptions) {
  const list = Array.isArray(descriptions) ? descriptions : [];
  return list
    .map((d, i) => ({
      n: i + 1,
      text: String(d?.definition || d?.text || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((s) => s.text.length >= 2);
}

function glossFromSenses(senses) {
  return senses.map((s) => (senses.length > 1 ? `${s.n}) ${s.text}` : s.text)).join(' ');
}

/** Pull comma-separated name lists from broken review rows when possible. */
function repairReviewRow(row) {
  const rawName = String(row.raw_name || '').trim();
  const rawDesc = String(row.raw_description || '').trim();
  if (!rawName) return [];

  // "Name1, Name2, Name3— definition" in raw_name
  const em = rawName.match(/^(.+?)[—–-]\s*(.+)$/u);
  if (em && /[А-ЯӘӨҮҚҒҢЎІЁ]/.test(em[1]) && em[1].includes(',')) {
    const names = em[1]
      .split(/[,;]/)
      .map((n) => n.replace(/\s+/g, ' ').trim())
      .filter((n) => /^[А-ЯӘӨҮҚҒҢЎІЁA-ZÁÓÚŃǴÍ]/.test(n) && n.length >= 3 && n.length <= 40);
    const def = em[2].trim() || rawDesc;
    if (names.length >= 2 && def.length >= 8) {
      return names.map((name) => ({
        name,
        gender: null,
        senses: [{ n: 1, text: def }],
        needsReview: 1,
      }));
    }
  }

  // Names in raw_name, definition in raw_description
  if (rawDesc.length >= 8 && rawName.includes(',')) {
    const names = rawName
      .split(/[,;]/)
      .map((n) => n.replace(/\s+/g, ' ').trim())
      .filter((n) => /^[А-ЯӘӨҮҚҒҢЎІЁA-ZÁÓÚŃǴÍ]/.test(n) && n.length >= 3 && n.length <= 40 && !/\d/.test(n));
    if (names.length >= 2) {
      return names.map((name) => ({
        name,
        gender: null,
        senses: [{ n: 1, text: rawDesc }],
        needsReview: 1,
      }));
    }
  }

  return [];
}

async function ensureSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS kaa_adam_atlari (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      source_id int NULL,
      name varchar(255) NOT NULL,
      name_fold varchar(255) NOT NULL DEFAULT '',
      gender varchar(8) NULL,
      senses_json longtext NOT NULL,
      gloss text NOT NULL,
      title_id varchar(64) NULL,
      needs_review tinyint NOT NULL DEFAULT 0,
      source varchar(64) NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_adam_name (name),
      KEY idx_adam_fold (name_fold),
      KEY idx_adam_gender (gender),
      KEY idx_adam_title (title_id),
      KEY idx_adam_source (source)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS kaa_adam_atlari_review (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      row_num int NULL,
      raw_name text NOT NULL,
      raw_description text NULL,
      source varchar(64) NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function loadTitleIndex(db) {
  const [rows] = await db.query(
    `SELECT id, soz, normalized, search_key FROM titles WHERE status = 1`
  );
  const byFold = new Map();
  for (const r of rows) {
    for (const raw of [r.normalized, r.search_key, r.soz]) {
      const f = searchFold(raw);
      if (f && !byFold.has(f)) byFold.set(f, r.id);
    }
  }
  return byFold;
}

async function main() {
  if (!fs.existsSync(MAIN)) {
    console.error('Missing', MAIN);
    process.exit(1);
  }
  const mainData = JSON.parse(fs.readFileSync(MAIN, 'utf8'));
  const reviewData = fs.existsSync(REVIEW)
    ? JSON.parse(fs.readFileSync(REVIEW, 'utf8'))
    : [];

  const entries = [];
  const used = new Set();

  for (const item of mainData) {
    const name = String(item.name || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;
    const senses = sensesFromDescriptions(item.descriptions);
    if (!senses.length) continue;
    const key = searchFold(name) || name.toLocaleLowerCase('kk');
    if (used.has(key)) continue;
    used.add(key);
    entries.push({
      sourceId: item.id ?? null,
      name,
      nameFold: key,
      gender: normalizeGender(item.gender),
      senses,
      gloss: glossFromSenses(senses),
      needsReview: 0,
    });
  }

  let repaired = 0;
  for (const row of reviewData) {
    for (const fixed of repairReviewRow(row)) {
      const key = searchFold(fixed.name) || fixed.name.toLocaleLowerCase('kk');
      if (used.has(key)) continue;
      used.add(key);
      entries.push({
        sourceId: null,
        name: fixed.name,
        nameFold: key,
        gender: null,
        senses: fixed.senses,
        gloss: glossFromSenses(fixed.senses),
        needsReview: 1,
      });
      repaired += 1;
    }
  }

  console.log(`Main entries: ${entries.length - repaired}, repaired from review: ${repaired}`);
  console.log(`Review stubs: ${reviewData.length}`);
  console.log('sample:', entries[0]);

  if (!APPLY) {
    console.log('Dry-run. Re-run with --apply to write DB.');
    return;
  }

  const { default: db } = await import('../src/config/dictionary.db.js');
  await ensureSchema(db);

  await db.query(`DELETE FROM kaa_adam_atlari WHERE source = ?`, [SOURCE]);
  await db.query(`DELETE FROM kaa_adam_atlari_review WHERE source = ?`, [SOURCE]);

  const byFold = await loadTitleIndex(db);
  let linked = 0;

  const chunk = 200;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk);
    const values = slice.map((e) => {
      const titleId = byFold.get(e.nameFold) || null;
      if (titleId) linked += 1;
      return [
        e.sourceId,
        e.name,
        e.nameFold,
        e.gender,
        JSON.stringify(e.senses),
        e.gloss,
        titleId,
        e.needsReview,
        SOURCE,
      ];
    });
    await db.query(
      `INSERT INTO kaa_adam_atlari
        (source_id, name, name_fold, gender, senses_json, gloss, title_id, needs_review, source)
       VALUES ?`,
      [values]
    );
  }

  if (reviewData.length) {
    const revValues = reviewData.map((r) => [
      r.row ?? null,
      String(r.raw_name || ''),
      String(r.raw_description || ''),
      SOURCE,
    ]);
    await db.query(
      `INSERT INTO kaa_adam_atlari_review (row_num, raw_name, raw_description, source) VALUES ?`,
      [revValues]
    );
  }

  const [[n]] = await db.query(`SELECT COUNT(*) n FROM kaa_adam_atlari`);
  const [[r]] = await db.query(`SELECT COUNT(*) n FROM kaa_adam_atlari_review`);
  console.log(`Done. names=${n.n}, linked_titles=${linked}, review=${r.n}`);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
