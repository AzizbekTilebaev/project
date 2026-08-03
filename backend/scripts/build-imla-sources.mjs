/**
 * Bitta kaa_imla jadvalına kóp manba qosıw:
 *   - 2020      → Dawletov orfografiyalıq sózlik (PDF import aldınnan bar)
 *   - github    → Allaniyaz repos (apertium-kaa lexc; imla.local da dump joq)
 *   - ozimizdan → platforma sózlikleri (titles, uzb-kaa, frazeologiya, …)
 *
 *   node scripts/build-imla-sources.mjs
 *   node scripts/build-imla-sources.mjs --apply
 *   node scripts/build-imla-sources.mjs --apply --only=github,ozimizdan
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import searchFold from '../src/utils/searchFold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(__dirname, '../.env') });

const APPLY = process.argv.includes('--apply');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ONLY = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean))
  : null;

const SRC_2020 = '2020';
const SRC_GITHUB = 'github';
const SRC_OURS = 'ozimizdan';
const OLD_2020 = 'dawletov-orfografiya-2020';

const LEXC_PATH = path.join(ROOT, 'fordata/github-imla/apertium-kaa.kaa.lexc');

const WORD_RE = /^[\p{L}][\p{L}'ʼʻ`´\-]*$/u;

function letterOf(word) {
  return String(word || '')
    .normalize('NFC')
    .charAt(0)
    .toLocaleLowerCase('kk') || '#';
}

function cleanWord(raw) {
  let w = String(raw || '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
  // drop POS / roman numerals / trailing punctuation
  w = w.replace(/\s+[IVXІХ]+$/u, '').replace(/[.,;:!?]+$/g, '').trim();
  if (w.length < 2 || w.length > 80) return null;
  if (!WORD_RE.test(w)) return null;
  if (/[\^<>|/\\#@$%&*=+~0-9]/.test(w)) return null;
  return w;
}

function parseLexc(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const words = new Map(); // fold -> surface
  for (const line of text.split(/\r?\n/)) {
    let s = line.trim();
    if (!s || s.startsWith('!') || s.startsWith('LEXICON') || s.startsWith('Multichar')) continue;
    if (s.startsWith('COPY') || s.startsWith('END') || s.startsWith('<')) continue;
    s = s.split('!')[0].trim();
    if (!s.endsWith(';')) continue;
    s = s.slice(0, -1).trim();
    if (!s) continue;
    const token = s.split(/\s+/)[0];
    if (!token) continue;
    const parts = token.includes(':') ? token.split(':') : [token, token];
    for (let part of parts) {
      part = part.replace(/%([.:])/g, '$1').replace(/^%/, '').trim();
      // apertium sometimes uses a' for á
      part = part.replace(/a'/g, 'á').replace(/o'/g, 'ó').replace(/u'/g, 'ú').replace(/n'/g, 'ń').replace(/g'/g, 'ǵ').replace(/i'/g, 'ı');
      const w = cleanWord(part);
      if (!w) continue;
      // skip pure affix-like stubs
      if (w.startsWith('-') || w.length < 2) continue;
      const fold = searchFold(w) || w.toLocaleLowerCase('kk');
      if (!words.has(fold)) words.set(fold, w);
    }
  }
  return words;
}

async function tryLoadImlaLocalWords() {
  // Optional: local MySQL DB named imla.local (schema from github.com/Allaniyaz/imla.local)
  const candidates = [
    {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASS || '',
      database: 'imla.local',
    },
    {
      host: '127.0.0.1',
      port: 3306,
      user: 'admin',
      password: 'Admin123',
      database: 'imla.local',
    },
  ];
  for (const cfg of candidates) {
    try {
      const conn = await mysql.createConnection(cfg);
      const [rows] = await conn.query(`SELECT title FROM words WHERE title IS NOT NULL AND title != ''`);
      await conn.end();
      const map = new Map();
      for (const r of rows) {
        const w = cleanWord(r.title);
        if (!w) continue;
        const fold = searchFold(w) || w.toLocaleLowerCase('kk');
        if (!map.has(fold)) map.set(fold, w);
      }
      console.log(`imla.local MySQL: ${map.size} words`);
      return map;
    } catch {
      /* try next */
    }
  }
  console.log('imla.local MySQL dump/joq — github manbası ushın apertium-kaa.lexc paydalanıladı');
  return new Map();
}

async function loadOurs(db) {
  const map = new Map(); // fold -> { word, titleId, note }

  function put(word, { titleId = null, note = '' } = {}) {
    const w = cleanWord(word);
    if (!w) return;
    const fold = searchFold(w) || w.toLocaleLowerCase('kk');
    const prev = map.get(fold);
    if (!prev) {
      map.set(fold, { word: w, titleId, note });
      return;
    }
    // Prefer title-linked / longer dictionary form
    if (!prev.titleId && titleId) prev.titleId = titleId;
    if (w.length > prev.word.length && /[А-ЯӘӨҮҚҒҢЎІЁа-яәөүқғңўіё]/.test(w)) {
      prev.word = w;
    }
    if (note && !prev.note.includes(note)) {
      prev.note = prev.note ? `${prev.note}, ${note}` : note;
    }
  }

  const [titles] = await db.query(
    `SELECT id, soz FROM titles WHERE status = 1 AND soz IS NOT NULL`
  );
  for (const r of titles) put(r.soz, { titleId: r.id, note: 'túsindirme' });

  try {
    const [adam] = await db.query(`SELECT name, title_id FROM kaa_adam_atlari`);
    for (const r of adam) put(r.name, { titleId: r.title_id, note: 'adam atları' });
  } catch { /* empty */ }

  try {
    const [fr] = await db.query(`SELECT phrase, title_id FROM kaa_frazeologiya`);
    for (const r of fr) {
      const head = String(r.phrase || '')
        .split(/[\s,;:]+/)
        .map((x) => x.trim())
        .find((x) => x.length >= 2);
      if (head) put(head, { titleId: r.title_id, note: 'frazeologiya' });
    }
  } catch { /* empty */ }

  try {
    const [uzb] = await db.query(
      `SELECT kaa_primary, title_id FROM uzb_kaa_sozlik WHERE kaa_primary IS NOT NULL AND kaa_primary != ''`
    );
    for (const r of uzb) {
      // may contain comma glosses — take first token/phrase chunk
      const primary = String(r.kaa_primary).split(/[,;]/)[0].trim();
      const head = primary.split(/\s+/).find((x) => x.length >= 2) || primary;
      put(head, { titleId: r.title_id || null, note: 'uzb-kaa' });
    }
  } catch { /* empty */ }

  try {
    const [lex] = await db.query(`SELECT kaa FROM uzb_kaa_lexicon WHERE kaa IS NOT NULL AND kaa != ''`);
    for (const r of lex) {
      const head = String(r.kaa).split(/[\s,;]+/)[0];
      put(head, { note: 'lexicon' });
    }
  } catch { /* empty */ }

  try {
    const [en] = await db.query(
      `SELECT word, title_id FROM bilingual_dict WHERE lang = 'en' AND word IS NOT NULL`
    );
    for (const r of en) put(r.word, { titleId: r.title_id, note: 'en' });
  } catch { /* empty */ }

  return map;
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

async function insertEntries(db, source, entries) {
  await db.query(`DELETE FROM kaa_imla WHERE source = ?`, [source]);
  const chunk = 400;
  for (let i = 0; i < entries.length; i += chunk) {
    const slice = entries.slice(i, i + chunk);
    const values = slice.map((e) => [
      e.word,
      e.wordFold,
      e.entryText,
      e.letter,
      e.tagsJson,
      e.titleId,
      e.pageNum,
      source,
    ]);
    await db.query(
      `INSERT INTO kaa_imla
        (word, word_fold, entry_text, letter, tags_json, title_id, page_num, source)
       VALUES ?`,
      [values]
    );
  }
}

function shouldRun(name) {
  return !ONLY || ONLY.has(name);
}

async function main() {
  const { default: db } = await import('../src/config/dictionary.db.js');
  await ensureSchema(db);

  // Retag old 2020 source key
  if (shouldRun('2020')) {
    const [upd] = await db.query(`UPDATE kaa_imla SET source = ? WHERE source = ?`, [
      SRC_2020,
      OLD_2020,
    ]);
    const [[n2020]] = await db.query(`SELECT COUNT(*) n FROM kaa_imla WHERE source = ?`, [SRC_2020]);
    console.log(`2020: retagged=${upd.affectedRows || 0}, rows=${n2020.n}`);
  }

  if (shouldRun('github')) {
    const fromMysql = await tryLoadImlaLocalWords();
    const fromLexc = fs.existsSync(LEXC_PATH) ? parseLexc(LEXC_PATH) : new Map();
    console.log(`github apertium-kaa.lexc: ${fromLexc.size}`);

    const merged = new Map(fromLexc);
    for (const [fold, w] of fromMysql) {
      if (!merged.has(fold)) merged.set(fold, w);
    }

    const entries = [...merged.entries()].map(([fold, word]) => ({
      word,
      wordFold: fold,
      entryText: word,
      letter: letterOf(word),
      tagsJson: JSON.stringify(['github']),
      titleId: null,
      pageNum: null,
    }));
    console.log(`github total unique: ${entries.length}`);
    if (APPLY) {
      await insertEntries(db, SRC_GITHUB, entries);
      console.log(`github applied: ${entries.length}`);
    }
  }

  if (shouldRun('ozimizdan')) {
    const ours = await loadOurs(db);
    const entries = [...ours.entries()].map(([fold, info]) => ({
      word: info.word,
      wordFold: fold,
      entryText: info.note ? `${info.word} (${info.note})` : info.word,
      letter: letterOf(info.word),
      tagsJson: JSON.stringify(['ozimizdan']),
      titleId: info.titleId,
      pageNum: null,
    }));
    console.log(`ozimizdan unique: ${entries.length}`);
    console.log('sample:', entries.slice(0, 5));
    if (APPLY) {
      await insertEntries(db, SRC_OURS, entries);
      console.log(`ozimizdan applied: ${entries.length}`);
    }
  }

  const [bySrc] = await db.query(
    `SELECT source, COUNT(*) n FROM kaa_imla GROUP BY source ORDER BY source`
  );
  console.log('kaa_imla by source:', bySrc);
  if (!APPLY) console.log('Dry-run. Re-run with --apply to write.');
  await db.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
