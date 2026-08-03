/**
 * Import EN/RU JSON dictionaries into kk_tusindirme.bilingual_dict
 * and link to titles via searchFold.
 *
 *   node scripts/import-bilingual-json.mjs           # dry-run
 *   node scripts/import-bilingual-json.mjs --apply
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import searchFold from '../src/utils/searchFold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

const SOURCES = [
  {
    lang: 'en',
    file: path.join(ROOT, 'new/sozlik.json'),
    source: 'sozlik.json-kaa-en',
    /** KAA headword → English gloss */
    linkSide: 'word',
  },
  {
    lang: 'ru',
    file: path.join(ROOT, 'new/ruqq.json'),
    source: 'ruqq.json-ru-kaa',
    /** Russian headword; KAA lives in translation — link via extracted KAA tokens */
    linkSide: 'translation',
  },
];

function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPos(html) {
  const m = String(html || '').match(/<i>\s*([^<]{1,40})\s*<\/i>/i);
  return m ? m[1].trim().slice(0, 64) : null;
}

/** Split gloss into numbered senses when possible */
function parseSenses(html, plain) {
  const senses = [];
  const boldNums = [...String(html || '').matchAll(/<b>\s*(\d+)\.\s*<\/b>/gi)];
  if (boldNums.length >= 2) {
    const parts = String(html).split(/<b>\s*\d+\.\s*<\/b>/i).map(stripHtml).filter(Boolean);
    // first chunk may be POS/intro before sense 1
    const start = parts.length > boldNums.length ? 1 : 0;
    for (let i = start; i < parts.length; i++) {
      if (parts[i].length >= 2) senses.push({ n: senses.length + 1, text: parts[i] });
    }
  }
  if (!senses.length) {
    const numbered = plain.split(/(?=\b\d+\.\s+)/).map((s) => s.trim()).filter(Boolean);
    if (numbered.length >= 2 && /^\d+\./.test(numbered[0] || numbered[1] || '')) {
      for (const chunk of numbered) {
        const m = chunk.match(/^(\d+)\.\s*(.+)$/s);
        if (m) senses.push({ n: Number(m[1]), text: m[2].trim() });
      }
    }
  }
  if (!senses.length && plain) {
    senses.push({ n: 1, text: plain });
  }
  return senses;
}

/** Pull likely KAA lemmas from RU→KAA translation text for linking */
function extractKaaCandidates(plain) {
  const out = [];
  const seen = new Set();
  // Prefer Cyrillic tokens of length >= 3
  for (const m of plain.matchAll(/[А-Яа-яӘәҒғҚқҢңӨөҮүЎўІіҺһ]{3,}/g)) {
    const w = m[0];
    const fold = searchFold(w);
    if (!fold || seen.has(fold)) continue;
    seen.add(fold);
    out.push({ surface: w, fold });
    if (out.length >= 6) break;
  }
  if (!out.length) {
    for (const m of plain.matchAll(/[A-Za-zÁáǴǵŃńÓóÚúÍıЎўʼ']{3,}/g)) {
      const w = m[0];
      if (/^(soyuz|protivit|soedinit|razgov|sm|см)$/i.test(w)) continue;
      const fold = searchFold(w);
      if (!fold || seen.has(fold)) continue;
      seen.add(fold);
      out.push({ surface: w, fold });
      if (out.length >= 4) break;
    }
  }
  return out;
}

function parseUzbGloss(kaaGloss) {
  const plain = String(kaaGloss || '').replace(/\s+/g, ' ').trim();
  const senses = [];
  const parts = plain.split(/(?=\b\d+\.\s+)/);
  for (const chunk of parts) {
    const m = chunk.trim().match(/^(\d+)\.\s*(.+)$/);
    if (m) senses.push({ n: Number(m[1]), text: m[2].trim() });
  }
  if (!senses.length && plain) senses.push({ n: 1, text: plain });
  return senses;
}

async function ensureSchema(db) {
  const sql = fs.readFileSync(
    path.join(__dirname, '../db/schema.bilingual_dict.sql'),
    'utf8'
  );
  await db.query(sql);
}

async function loadTitleIndex(db) {
  const [rows] = await db.query(
    `SELECT id, soz, normalized, search_key FROM titles WHERE status = 1`
  );
  const byFold = new Map();
  for (const r of rows) {
    for (const raw of [r.normalized, r.search_key, r.soz]) {
      const f = searchFold(raw);
      if (!f) continue;
      if (!byFold.has(f)) byFold.set(f, r.id);
    }
  }
  return { byFold, count: rows.length };
}

async function main() {
  const { default: db } = await import('../src/config/dictionary.db.js');
  await ensureSchema(db);

  if (!APPLY) {
    console.log('Dry-run: will parse JSON and report counts. Use --apply to write.');
  }

  let existing = [];
  try {
    const [rows] = await db.query(
      `SELECT lang, COUNT(*) AS n FROM bilingual_dict GROUP BY lang`
    );
    existing = rows;
  } catch {
    existing = [];
  }

  console.log('Existing bilingual_dict:', existing);

  if (APPLY && FORCE) {
    await db.query(`DELETE FROM bilingual_dict`);
    console.log('Cleared bilingual_dict (--force)');
  }

  if (APPLY && !FORCE && existing?.length) {
    const total = existing.reduce((s, r) => s + Number(r.n), 0);
    if (total > 1000) {
      console.log(`Already have ${total} rows — skip import (pass --force to reimport).`);
      await db.end();
      return;
    }
  }

  const titles = await loadTitleIndex(db);
  console.log(`Title index folds: ${titles.byFold.size} / titles ${titles.count}`);

  let inserted = 0;
  let linked = 0;

  for (const src of SOURCES) {
    if (!fs.existsSync(src.file)) {
      console.warn('Missing', src.file);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(src.file, 'utf8'));
    if (!Array.isArray(data)) throw new Error(`${src.file} is not an array`);
    console.log(`Parsing ${src.lang}: ${data.length} entries from ${path.basename(src.file)}`);

    const batch = [];
    let linkHits = 0;
    for (const row of data) {
      const word = String(row.word || '').trim();
      if (!word) continue;
      const html = String(row.translation || '');
      const plain = stripHtml(html);
      if (!plain) continue;
      const pos = extractPos(html);
      const senses = parseSenses(html, plain);
      const wordFold = searchFold(word);

      let titleId = null;
      if (src.linkSide === 'word' && wordFold) {
        titleId = titles.byFold.get(wordFold) || null;
      } else if (src.linkSide === 'translation') {
        for (const c of extractKaaCandidates(plain)) {
          const id = titles.byFold.get(c.fold);
          if (id) {
            titleId = id;
            break;
          }
        }
      }
      if (titleId) linkHits++;

      batch.push([
        src.lang,
        word.slice(0, 255),
        (wordFold || word.toLowerCase()).slice(0, 191),
        html,
        plain,
        pos,
        JSON.stringify(senses),
        titleId,
        src.source,
      ]);
    }

    console.log(`  ready ${batch.length}, linked ${linkHits}`);

    if (!APPLY) {
      console.log(`  sample:`, batch[0]?.slice(0, 3), batch[0]?.[7]);
      continue;
    }

    const CHUNK = 400;
    for (let i = 0; i < batch.length; i += CHUNK) {
      const slice = batch.slice(i, i + CHUNK);
      await db.query(
        `INSERT INTO bilingual_dict
          (lang, word, word_fold, translation_html, translation_text, pos, senses_json, title_id, source)
         VALUES ?`,
        [slice]
      );
      inserted += slice.length;
      if (i % 4000 === 0) console.log(`  … ${Math.min(i + CHUNK, batch.length)}/${batch.length}`);
    }
    linked += linkHits;
  }

  // Stats for uzb gloss parser demo (no write)
  const [[uzbSample]] = await db.query(
    `SELECT uzb, kaa_primary, kaa_gloss FROM uzb_kaa_sozlik LIMIT 1`
  );
  if (uzbSample) {
    console.log('uzb_kaa_sozlik sense parse sample:', parseUzbGloss(uzbSample.kaa_gloss));
  }

  const [counts] = await db.query(
    `SELECT lang, COUNT(*) n, SUM(title_id IS NOT NULL) linked FROM bilingual_dict GROUP BY lang`
  );
  console.log({ apply: APPLY, inserted, linked, counts });
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
