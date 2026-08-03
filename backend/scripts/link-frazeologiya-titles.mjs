/**
 * Link kaa_frazeologiya → titles (túsindirme) via folded headword match.
 *
 *   node scripts/link-frazeologiya-titles.mjs
 *   node scripts/link-frazeologiya-titles.mjs --apply
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import searchFold from '../src/utils/searchFold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');

function phraseCandidates(phrase) {
  const raw = String(phrase || '')
    .replace(/[«»""()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return [];
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.replace(/^[—–\-]+|[—–\-,;:]+$/g, '').trim())
    .filter((t) => t.length > 1);
  if (!tokens.length) return [];

  const out = [];
  const push = (s) => {
    const v = String(s || '').replace(/\s+/g, ' ').trim();
    if (v.length >= 2 && !out.includes(v)) out.push(v);
  };

  push(tokens.join(' '));
  if (tokens.length >= 3) push(tokens.slice(0, 3).join(' '));
  if (tokens.length >= 2) push(tokens.slice(0, 2).join(' '));

  // Single-token fallback only for long distinctive headwords (avoid "aq", "bir", …)
  if (tokens.length === 1 && tokens[0].length >= 4) push(tokens[0]);
  if (tokens.length > 1 && tokens[0].length >= 6) push(tokens[0]);

  return out;
}

async function main() {
  const { default: db } = await import('../src/config/dictionary.db.js');

  try {
    await db.query(
      `ALTER TABLE kaa_frazeologiya
       ADD COLUMN title_id varchar(64) NULL AFTER kind,
       ADD KEY idx_fraz_title (title_id)`
    );
    console.log('Added title_id column');
  } catch (e) {
    if (!/Duplicate|exists/i.test(e.message)) throw e;
    console.log('title_id already present');
  }

  const [titles] = await db.query(
    `SELECT id, soz, normalized, search_key FROM titles WHERE status = 1`
  );
  const byFold = new Map();
  for (const r of titles) {
    for (const raw of [r.normalized, r.search_key, r.soz]) {
      const f = searchFold(raw);
      if (f && !byFold.has(f)) byFold.set(f, r.id);
    }
  }
  console.log(`Title index: ${byFold.size} folds from ${titles.length} titles`);

  const [rows] = await db.query(`SELECT id, phrase, title_id FROM kaa_frazeologiya`);
  let linked = 0;
  let already = 0;
  const updates = [];

  // Always recompute when --apply (clear weak first-token matches)
  if (APPLY) {
    await db.query(`UPDATE kaa_frazeologiya SET title_id = NULL`);
    console.log('Cleared previous title_id links');
  }

  for (const row of rows) {
    let titleId = null;
    const cands = phraseCandidates(row.phrase);
    for (const cand of cands) {
      const f = searchFold(cand);
      if (f && byFold.has(f)) {
        titleId = byFold.get(f);
        break;
      }
    }
    if (!titleId) {
      // longest standalone token that exists as a headword
      const tokens = String(row.phrase || '')
        .replace(/[«»""()]/g, ' ')
        .split(/\s+/)
        .map((t) => t.replace(/^[—–\-]+|[—–\-,;:]+$/g, '').trim())
        .filter((t) => t.length >= 4)
        .sort((a, b) => b.length - a.length);
      for (const tok of tokens) {
        const f = searchFold(tok);
        if (f && byFold.has(f)) {
          titleId = byFold.get(f);
          break;
        }
      }
    }
    if (titleId) {
      linked += 1;
      updates.push([titleId, row.id]);
    } else if (row.title_id && !APPLY) {
      already += 1;
    }
  }

  console.log(`Would link: ${linked}, kept previous (dry): ${already}, total: ${rows.length}`);

  if (!APPLY) {
    console.log('Dry-run. Re-run with --apply to write.');
    await db.end();
    return;
  }

  const chunk = 200;
  for (let i = 0; i < updates.length; i += chunk) {
    const slice = updates.slice(i, i + chunk);
    await Promise.all(
      slice.map(([titleId, id]) =>
        db.query(`UPDATE kaa_frazeologiya SET title_id = ? WHERE id = ?`, [titleId, id])
      )
    );
  }
  const [[n]] = await db.query(
    `SELECT COUNT(*) n FROM kaa_frazeologiya WHERE title_id IS NOT NULL`
  );
  console.log('Linked total now:', n.n);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
