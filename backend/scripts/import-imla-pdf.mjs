/**
 * Import Qaraqalpaq orfografiyalıq (imla) sózligi from Dawletov PDF.
 *
 *   node scripts/import-imla-pdf.mjs
 *   node scripts/import-imla-pdf.mjs --apply
 *   node scripts/import-imla-pdf.mjs --text=/path/to/extracted.txt --apply
 *
 * Requires `pdftotext` (poppler) unless --text is given.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import searchFold from '../src/utils/searchFold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const SOURCE = '2020';
const PDF_DEFAULT = path.join(ROOT, 'fordata/qaraqalpaq-orfografiyaliq-sozligi-2020.pdf');
const JSON_OUT = path.join(ROOT, 'fordata/imla_sozlik.json');

const FIRST_PAGE = 14;
const LAST_PAGE = 490;

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : null;
}

const TEXT_PATH = argValue('--text');
const PDF_PATH = argValue('--pdf') || PDF_DEFAULT;

const HEAD_RE = /^([a-zA-ZáÁóÓúÚńŃǵǴıÍäöüÄÖÜа-яА-ЯәөүқғңўһіёІ][^\s,;(]{0,80})/;
const PAGE_NUM_RE = /^\d{1,3}$/;
const TAG_RE = /\(([^)]{1,40})\)/g;

function extractPdfText(pdfPath) {
  const outPath = path.join(ROOT, 'fordata/imla_sozlik.pdftotext.txt');
  console.log(`pdftotext pages ${FIRST_PAGE}-${LAST_PAGE}…`);
  execFileSync(
    'pdftotext',
    ['-f', String(FIRST_PAGE), '-l', String(LAST_PAGE), '-layout', pdfPath, outPath],
    { stdio: 'inherit' }
  );
  return outPath;
}

function splitColumns(line) {
  const gaps = [...line.matchAll(/ {2,}/g)];
  if (!gaps.length) {
    const s = line.trim();
    return s ? [{ side: 'L', text: line, stripped: s }] : [];
  }
  const mid = line.length / 2;
  let best = gaps[0];
  let bestDist = Infinity;
  for (const g of gaps) {
    const center = (g.index + g.index + g[0].length) / 2;
    const dist = Math.abs(center - mid);
    // Prefer wider gaps near center
    const score = dist - g[0].length * 0.15;
    if (score < bestDist) {
      bestDist = score;
      best = g;
    }
  }
  const leftRaw = line.slice(0, best.index);
  const rightRaw = line.slice(best.index + best[0].length);
  const out = [];
  if (leftRaw.trim()) {
    out.push({ side: 'L', text: leftRaw, stripped: leftRaw.trim() });
  }
  if (rightRaw.trim()) {
    out.push({ side: 'R', text: rightRaw, stripped: rightRaw.trim() });
  }
  return out;
}

function isRunningHeader(line, lineIndex) {
  const s = line.trim();
  if (!s || PAGE_NUM_RE.test(s)) return true;
  if (lineIndex > 2) return false;
  // "abadan                                          abiturientlik"
  const parts = s.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2 && parts.every((p) => /^[a-zA-ZáóúńǵıÁÓÚŃǴÍ\-]+$/u.test(p))) {
    return true;
  }
  return false;
}

function looksLikeContinuation(prev, cell) {
  if (!prev) return false;
  const lead = cell.text.length - cell.text.trimStart().length;
  if (lead >= 3) return true;
  if (prev.endsWith(',')) return true;
  // OCR often breaks "adamgershilik," / "        adam gershiligi"
  if (/^[a-záóúńǵı]/u.test(cell.stripped) && /[,\-]$/.test(prev.trim())) return true;
  return false;
}

function mergeColumn(cells) {
  const out = [];
  for (const cell of cells) {
    const stripped = cell.stripped.replace(/\s+/g, ' ').trim();
    if (!stripped) continue;
    if (out.length && looksLikeContinuation(out[out.length - 1], cell)) {
      out[out.length - 1] = `${out[out.length - 1]} ${stripped}`.replace(/\s+/g, ' ').trim();
      continue;
    }
    out.push(stripped);
  }
  return out;
}

function parseHeadword(entry) {
  const m = entry.match(HEAD_RE);
  if (!m) return null;
  let w = m[1].replace(/[.,;:]+$/g, '');
  if (w.startsWith('-') || w.length < 2 || w.length > 60) return null;
  // Drop pure inflection stubs
  if (/^-[a-z]{1,6}$/i.test(w)) return null;
  // OCR garbage: symbols, broken digraphs, digits-in-head
  if (/[\^<>|/\\#@$%&*=+~\[\]{}0-9]/.test(w)) return null;
  if (!/^[\p{L}][\p{L}'ʼʻ`´\-]*$/u.test(w)) return null;
  const letters = [...w].filter((ch) => /\p{L}/u.test(ch)).length;
  if (letters < 2 || letters / w.length < 0.7) return null;
  // Reject dense OCR garbage (too many spaced letters)
  if ((w.match(/\s/g) || []).length >= 1) return null;
  return w;
}

function extractTags(entry) {
  const tags = [];
  for (const m of entry.matchAll(TAG_RE)) {
    const t = m[1].replace(/\s+/g, ' ').trim();
    if (t && t.length <= 40) tags.push(t);
  }
  return tags.slice(0, 4);
}

function letterOf(word) {
  const ch = String(word || '')
    .normalize('NFC')
    .charAt(0)
    .toLocaleLowerCase('kk');
  return ch || '#';
}

function parseText(raw) {
  const pages = raw.split('\f');
  const entries = [];
  const seen = new Set();

  pages.forEach((page, pageIndex) => {
    const pageNum = FIRST_PAGE + pageIndex;
    const left = [];
    const right = [];
    const lines = page.split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i].replace(/\u00a0/g, ' ');
      if (!line.trim()) continue;
      if (PAGE_NUM_RE.test(line.trim())) continue;
      if (isRunningHeader(line, i)) continue;

      const cells = splitColumns(line);
      if (cells.length === 2) {
        left.push(cells[0]);
        right.push(cells[1]);
      } else if (cells.length === 1) {
        const cell = cells[0];
        const indent = cell.text.length - cell.text.trimStart().length;
        if (indent > 34) right.push({ ...cell, side: 'R' });
        else left.push(cell);
      }
    }

    for (const entryText of [...mergeColumn(left), ...mergeColumn(right)]) {
      const word = parseHeadword(entryText);
      if (!word) continue;
      // Filter heavy OCR garbage (mixed symbols / boxed letters)
      if (/[■▪●□_|^]/.test(entryText)) continue;
      if (/[<>|/\\]{2,}/.test(entryText)) continue;
      if ((entryText.match(/[A-ZА-Я]{3,}/g) || []).length > 2) continue;
      // Too many spaced single letters → OCR noise
      if ((entryText.match(/\b[a-z]\b/g) || []).length >= 4) continue;

      const fold = searchFold(word) || word.toLocaleLowerCase('kk');
      const key = `${fold}\t${entryText.toLocaleLowerCase('kk').slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      entries.push({
        word,
        wordFold: fold,
        entryText,
        letter: letterOf(word),
        tags: extractTags(entryText),
        pageNum,
      });
    }
  });

  return entries;
}

async function ensureSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS kaa_imla (
      id bigint unsigned NOT NULL AUTO_INCREMENT,
      word varchar(255) NOT NULL,
      word_fold varchar(255) NOT NULL DEFAULT '',
      entry_text text NOT NULL,
      letter varchar(8) NULL,
      tags_json text NULL,
      title_id varchar(64) NULL,
      page_num int NULL,
      source varchar(64) NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_imla_word (word),
      KEY idx_imla_fold (word_fold),
      KEY idx_imla_letter (letter),
      KEY idx_imla_title (title_id),
      KEY idx_imla_source (source)
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
  let textPath = TEXT_PATH;
  if (!textPath) {
    if (!fs.existsSync(PDF_PATH)) {
      console.error('PDF joq:', PDF_PATH);
      process.exit(1);
    }
    textPath = extractPdfText(PDF_PATH);
  }
  if (!fs.existsSync(textPath)) {
    console.error('Text joq:', textPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(textPath, 'utf8');
  const entries = parseText(raw);
  console.log(`Parsed entries: ${entries.length}`);
  console.log(`Unique headwords: ${new Set(entries.map((e) => e.wordFold)).size}`);
  console.log('sample:', entries.slice(0, 8));

  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify(entries, null, 0), 'utf8');
  console.log('Wrote', JSON_OUT);

  if (!APPLY) {
    console.log('Dry-run. Re-run with --apply to write DB.');
    return;
  }

  const { default: db } = await import('../src/config/dictionary.db.js');
  await ensureSchema(db);
  await db.query(`DELETE FROM kaa_imla WHERE source = ?`, [SOURCE]);

  const byFold = await loadTitleIndex(db);
  let linked = 0;
  const chunk = 300;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk);
    const values = slice.map((e) => {
      const titleId = byFold.get(e.wordFold) || null;
      if (titleId) linked += 1;
      return [
        e.word,
        e.wordFold,
        e.entryText,
        e.letter,
        e.tags.length ? JSON.stringify(e.tags) : null,
        titleId,
        e.pageNum,
        SOURCE,
      ];
    });
    await db.query(
      `INSERT INTO kaa_imla
        (word, word_fold, entry_text, letter, tags_json, title_id, page_num, source)
       VALUES ?`,
      [values]
    );
  }

  const [[n]] = await db.query(`SELECT COUNT(*) n FROM kaa_imla WHERE source = ?`, [SOURCE]);
  const [[letters]] = await db.query(
    `SELECT COUNT(DISTINCT letter) n FROM kaa_imla WHERE source = ?`,
    [SOURCE]
  );
  console.log(`Done. rows=${n.n}, linked_titles=${linked}, letters=${letters.n}`);
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
