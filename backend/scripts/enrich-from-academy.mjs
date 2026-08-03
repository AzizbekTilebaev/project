#!/usr/bin/env node
/**
 * One-shot enrichment from qaraqalpaq.academy API → local kk_tusindirme.
 * After import, the app does NOT call academy (no runtime dependency).
 *
 * Usage:
 *   node scripts/enrich-from-academy.mjs --crawl          # fetch + save cache
 *   node scripts/enrich-from-academy.mjs --diff            # show missing vs local
 *   node scripts/enrich-from-academy.mjs --import          # insert missing
 *   node scripts/enrich-from-academy.mjs --crawl --import  # full pipeline
 *   node scripts/enrich-from-academy.mjs --import --limit 50
 *
 * Options:
 *   --delay Ms   delay between API calls (default 180)
 *   --max-depth N  prefix deepen depth (default 4)
 *   --cache PATH cache jsonl (default backend/tmp/academy-crawl.jsonl)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API = 'https://qaraqalpaq.academy/api/soz';
const KK_LETTERS =
  'АӘБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҮЎФХҲЦЧШЩЪЫІЬЭЮЯ'.split('');

const ROMAN = [
  '',
  'І',
  'ІІ',
  'ІІІ',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

const args = process.argv.slice(2);
const doCrawl = args.includes('--crawl');
const doDiff = args.includes('--diff') || (!doCrawl && !args.includes('--import'));
const doImport = args.includes('--import');
const delayMs = Number(args[args.indexOf('--delay') + 1]) || 450;
const maxDepth = Number(args[args.indexOf('--max-depth') + 1]) || 3;
const importLimit =
  args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

const cacheIdx = args.indexOf('--cache');
const CACHE = cacheIdx >= 0
  ? path.resolve(args[cacheIdx + 1])
  : path.resolve(__dirname, '../tmp/academy-crawl.jsonl');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function resultKey(r) {
  const hw = String(r.headword || '').trim();
  const hi = r.homonymIndex == null || r.homonymIndex === '' ? '' : String(r.homonymIndex);
  return `${hw}::${hi}`;
}

function toLocalTitle(headword, homonymIndex) {
  const hw = String(headword || '').trim();
  if (homonymIndex == null || homonymIndex === '') return hw;
  // academy sometimes sends "I"/"II" strings
  if (typeof homonymIndex === 'string' && /[IVXІ]+/i.test(homonymIndex) && !/^\d+$/.test(homonymIndex)) {
    return `${hw} ${homonymIndex}`.trim();
  }
  const n = Number(homonymIndex);
  if (!Number.isFinite(n) || n <= 0) return hw;
  const roman = ROMAN[n] || String(n);
  return `${hw} ${roman}`;
}

function titleAliases(headword, homonymIndex) {
  const hw = String(headword || '').trim();
  const aliases = new Set([hw, hw.toLocaleLowerCase('kk')]);
  if (homonymIndex == null || homonymIndex === '') return [...aliases];

  const nums = [];
  if (typeof homonymIndex === 'string' && !/^\d+$/.test(homonymIndex)) {
    const map = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, І: 1, ІІ: 2, ІІІ: 3 };
    nums.push(map[homonymIndex] || map[homonymIndex.toUpperCase()] || null);
    aliases.add(`${hw} ${homonymIndex}`);
  } else {
    nums.push(Number(homonymIndex));
  }
  for (const n of nums.filter(Boolean)) {
    const variants = [ROMAN[n], String(n)];
    // Latin romans too
    const latin = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n];
    if (latin) variants.push(latin);
    for (const v of variants.filter(Boolean)) {
      aliases.add(`${hw} ${v}`);
      aliases.add(`${hw.toLocaleLowerCase('kk')} ${String(v).toLocaleLowerCase('kk')}`);
    }
  }
  return [...aliases];
}

function academyToImportItem(r) {
  const soz = toLocalTitle(r.headword, r.homonymIndex);
  const defs = Array.isArray(r.definitions) ? r.definitions : [];
  const descriptions = [];
  const pos = (r.pos || '').trim() || 'белгисиз';

  defs.forEach((d, i) => {
    let text = String(d?.text || '').trim();
    if (!text) return;
    // seeAlso-only rows still useful as cross-ref
    const examples = (d.examples || [])
      .map((ex, j) => {
        const example = String(ex?.text || '').trim();
        if (!example) return null;
        return {
          example,
          author: String(ex?.source || '').trim() || undefined,
          order: j + 1,
        };
      })
      .filter(Boolean);

    const desc = {
      category: pos,
      definition: text,
      order: descriptions.length + 1,
    };
    if (examples.length) desc.example = examples;
    descriptions.push(desc);
  });

  // If no definitions but seeAlso present
  if (!descriptions.length && r.seeAlso) {
    descriptions.push({
      category: 'к.',
      definition: String(r.seeAlso).trim(),
      order: 1,
    });
  }

  if (!descriptions.length) return null;

  return {
    soz,
    normalized: soz.toLocaleLowerCase('kk'),
    descriptions,
  };
}

async function fetchPrefix(q, { retries = 6 } = {}) {
  const u = `${API}?q=${encodeURIComponent(q)}&limit=20`;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(u, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (compatible; proyekt2-enrichment/1.0; one-shot offline sync)',
        },
      });
      if (res.status === 429 || res.status === 503) {
        const wait = Math.min(30_000, 1000 * 2 ** attempt);
        console.warn(`rate-limit ${res.status} q=${q}; wait ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for q=${q}`);
      const data = await res.json();
      return data;
    } catch (e) {
      lastErr = e;
      await sleep(Math.min(20_000, 800 * 2 ** attempt));
    }
  }
  throw lastErr || new Error(`fetch failed for q=${q}`);
}

function loadCache() {
  const byKey = new Map();
  if (!fs.existsSync(CACHE)) return byKey;
  for (const line of fs.readFileSync(CACHE, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row?.result) byKey.set(resultKey(row.result), row.result);
    } catch {
      /* ignore */
    }
  }
  return byKey;
}

function appendCache(prefix, result) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.appendFileSync(
    CACHE,
    `${JSON.stringify({ ts: new Date().toISOString(), prefix, result })}\n`,
    'utf8'
  );
}

async function crawl() {
  const seenPrefix = new Set();
  const byKey = loadCache();
  console.log(`Cache already has ${byKey.size} unique results @ ${CACHE}`);

  // API requires min 2 chars (1-char always returns []).
  const queue = [];
  for (const a of KK_LETTERS) {
    for (const b of KK_LETTERS) queue.push(a + b);
  }
  let fetched = 0;
  let errors = 0;
  console.log(`Seed 2-letter prefixes: ${queue.length} (max-depth=${maxDepth})`);

  while (queue.length) {
    const prefix = queue.shift();
    if (!prefix || seenPrefix.has(prefix)) continue;
    const len = [...prefix].length;
    if (len < 2 || len > maxDepth) continue;
    seenPrefix.add(prefix);

    let data;
    try {
      data = await fetchPrefix(prefix);
      fetched++;
    } catch (e) {
      errors++;
      console.error(`FAIL q=${prefix}:`, e.message);
      await sleep(delayMs * 3);
      continue;
    }

    const results = data.results || [];
    const prefixUp = prefix.toLocaleUpperCase('kk');
    const relevant = results.filter((r) =>
      String(r.headword || '')
        .toLocaleUpperCase('kk')
        .startsWith(prefixUp)
    );

    for (const r of relevant) {
      const k = resultKey(r);
      if (!byKey.has(k)) {
        byKey.set(k, r);
        appendCache(prefix, r);
      }
    }
    // Also keep fuzzy hits that are useful (e.g. Latin query), but do not expand on them
    for (const r of results) {
      if (relevant.includes(r)) continue;
      const k = resultKey(r);
      if (!byKey.has(k)) {
        byKey.set(k, r);
        appendCache(prefix, r);
      }
    }

    // Only deepen when THIS prefix is truncated (20 relevant hits)
    const saturated = relevant.length >= 20;
    if (saturated && len < maxDepth) {
      const lastHw = String(relevant[relevant.length - 1]?.headword || '');
      const lastChars = [...lastHw];
      let startIdx = 0;
      if (lastChars.length > len) {
        const nextChar = lastChars[len];
        const idx = KK_LETTERS.indexOf(nextChar);
        startIdx = idx >= 0 ? idx : 0;
      }
      for (let i = startIdx; i < KK_LETTERS.length; i++) {
        const next = prefix + KK_LETTERS[i];
        if (!seenPrefix.has(next)) queue.push(next);
      }
    }

    if (fetched % 25 === 0) {
      console.log(
        `… fetched=${fetched} queue=${queue.length} unique=${byKey.size} last=${prefix} results=${results.length}`
      );
    }
    await sleep(delayMs);
  }

  console.log(
    JSON.stringify(
      { fetched, errors, uniqueResults: byKey.size, prefixes: seenPrefix.size, cache: CACHE },
      null,
      2
    )
  );
  return byKey;
}

async function loadLocalIndex(db) {
  const [rows] = await db.query(
    `SELECT id, soz, normalized, search_key FROM titles WHERE status = 1`
  );
  const byExact = new Set();
  const byNorm = new Set();
  for (const r of rows) {
    byExact.add(String(r.soz || ''));
    byNorm.add(String(r.normalized || '').toLocaleLowerCase('kk'));
    if (r.search_key) byNorm.add(String(r.search_key).toLocaleLowerCase('kk'));
  }
  return { byExact, byNorm, count: rows.length };
}

function isMissing(local, headword, homonymIndex) {
  for (const alias of titleAliases(headword, homonymIndex)) {
    if (local.byExact.has(alias)) return false;
    if (local.byNorm.has(alias.toLocaleLowerCase('kk'))) return false;
  }
  // bare headword match only when academy has no homonym index
  if (homonymIndex == null || homonymIndex === '') {
    if (local.byExact.has(headword)) return false;
  }
  return true;
}

async function diffAndMaybeImport({ apply }) {
  const { default: db } = await import('../src/config/dictionary.db.js');
  const TusindirmeService = (await import('../src/services/tusindirmeService.js')).default;
  const { validateTitlesArray } = await import('../src/validators/title.validator.js');

  const [[dbName]] = await db.query('SELECT DATABASE() AS db');
  console.log('Target DB:', dbName.db);

  const byKey = loadCache();
  if (!byKey.size) {
    console.error('Cache empty — run with --crawl first');
    await db.end();
    process.exit(2);
  }

  const local = await loadLocalIndex(db);
  console.log(`Local titles: ${local.count}; academy cache: ${byKey.size}`);

  const missing = [];
  for (const r of byKey.values()) {
    if (!isMissing(local, r.headword, r.homonymIndex)) continue;
    const item = academyToImportItem(r);
    if (!item) continue;
    missing.push({ item, raw: r });
  }

  console.log(`Missing candidates: ${missing.length}`);
  for (const m of missing.slice(0, 15)) {
    console.log(
      `  + ${m.item.soz} | ${m.item.descriptions[0]?.category} | ${String(m.item.descriptions[0]?.definition).slice(0, 70)}`
    );
  }
  if (missing.length > 15) console.log(`  … +${missing.length - 15} more`);

  const reportPath = path.resolve(__dirname, '../tmp/academy-missing.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        localCount: local.count,
        academyUnique: byKey.size,
        missingCount: missing.length,
        missing: missing.map((m) => m.item),
      },
      null,
      2
    ),
    'utf8'
  );
  console.log('Wrote', reportPath);

  if (!apply) {
    await db.end();
    return { missing: missing.length };
  }

  const batch = missing.slice(0, Number.isFinite(importLimit) ? importLimit : missing.length);
  const items = batch.map((m) => m.item);
  if (!items.length) {
    console.log('Nothing to import');
    await db.end();
    return { added: 0 };
  }

  // Validate in chunks (AJV)
  const chunkSize = 40;
  const service = new TusindirmeService();
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const ok = validateTitlesArray(chunk);
    if (!ok) {
      console.error('AJV fail at chunk', i, validateTitlesArray.errors?.slice(0, 3));
      // try one-by-one
      for (const one of chunk) {
        if (!validateTitlesArray([one])) {
          failed++;
          console.error(' skip invalid', one.soz, validateTitlesArray.errors?.[0]);
          continue;
        }
        const orig = console.log;
        console.log = () => {};
        try {
          const r = await service.insertNested([one]);
          added += r.added;
          skipped += r.skipped;
        } catch (e) {
          failed++;
          console.error(' insert fail', one.soz, e.message);
        } finally {
          console.log = orig;
        }
      }
      continue;
    }

    const orig = console.log;
    console.log = () => {};
    try {
      const r = await service.insertNested(chunk);
      added += r.added;
      skipped += r.skipped;
      console.log = orig;
      console.log(
        `chunk ${i / chunkSize + 1}: +${r.added} skip=${r.skipped} (${i + chunk.length}/${items.length})`
      );
    } catch (e) {
      console.log = orig;
      console.error('chunk fail', e.message);
      failed++;
    }
  }

  const [[after]] = await db.query(
    'SELECT COUNT(*) AS total, SUM(status=1) AS active FROM titles'
  );
  console.log(JSON.stringify({ added, skipped, failed, titlesAfter: after }, null, 2));
  await db.end();
  return { added, skipped, failed };
}

async function main() {
  if (!doCrawl && !doImport && !args.includes('--diff')) {
    // default: diff if cache exists else hint
    if (!fs.existsSync(CACHE)) {
      console.log('No cache. Run: node scripts/enrich-from-academy.mjs --crawl');
      process.exit(0);
    }
  }

  if (doCrawl) await crawl();
  if (doDiff || doImport) await diffAndMaybeImport({ apply: doImport });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
