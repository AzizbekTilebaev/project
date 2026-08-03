/**
 * Orfografiyalıq (imla) sózlik service.
 * Manbalar: 2020 | github | ozimizdan
 */
import db from '../config/dictionary.db.js';
import searchFold from '../utils/searchFold.js';

export const IMLA_SOURCES = ['2020', 'github', 'ozimizdan'];

function safeJson(val, fallback = []) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function mapRow(r) {
  return {
    id: r.id,
    word: r.word,
    entryText: r.entry_text,
    letter: r.letter || null,
    tags: safeJson(r.tags_json, []),
    titleId: r.title_id || null,
    pageNum: r.page_num ?? null,
    source: r.source,
  };
}

function normalizeSource(source) {
  const s = String(source || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'dawletov-orfografiya-2020') return '2020';
  if (IMLA_SOURCES.includes(s)) return s;
  return '';
}

export async function searchImla({
  q = '',
  letter = '',
  source = '',
  limit = 50,
  offset = 0,
} = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);
  const query = String(q || '').trim();
  const letq = String(letter || '')
    .trim()
    .toLocaleLowerCase('kk')
    .slice(0, 8);
  const src = normalizeSource(source);

  const where = ['1=1'];
  const params = [];
  if (letq) {
    where.push('letter = ?');
    params.push(letq);
  }
  if (src) {
    where.push('source = ?');
    params.push(src);
  }

  if (!query) {
    const sqlWhere = where.join(' AND ');
    const [rows] = await db.query(
      `SELECT id, word, entry_text, letter, tags_json, title_id, page_num, source
       FROM kaa_imla
       WHERE ${sqlWhere}
       ORDER BY
         CASE source WHEN '2020' THEN 0 WHEN 'ozimizdan' THEN 1 ELSE 2 END,
         word
       LIMIT ? OFFSET ?`,
      [...params, lim, off]
    );
    const [[c]] = await db.query(
      `SELECT COUNT(*) AS n FROM kaa_imla WHERE ${sqlWhere}`,
      params
    );
    return { total: c.n, items: rows.map(mapRow) };
  }

  const fold = searchFold(query);
  const safe = query.replace(/[%_]/g, '');
  const like = `%${safe}%`;
  where.push('(word LIKE ? OR entry_text LIKE ? OR word_fold LIKE ?)');
  params.push(like, like, fold ? `%${fold}%` : like);
  const sqlWhere = where.join(' AND ');

  const [rows] = await db.query(
    `SELECT id, word, entry_text, letter, tags_json, title_id, page_num, source
     FROM kaa_imla
     WHERE ${sqlWhere}
     ORDER BY
       CASE
         WHEN word = ? THEN 0
         WHEN word LIKE ? THEN 1
         WHEN word_fold = ? THEN 2
         ELSE 3
       END,
       CASE source WHEN '2020' THEN 0 WHEN 'ozimizdan' THEN 1 ELSE 2 END,
       word
     LIMIT ? OFFSET ?`,
    [...params, query, `${safe}%`, fold || query, lim, off]
  );
  const [[c]] = await db.query(
    `SELECT COUNT(*) AS n FROM kaa_imla WHERE ${sqlWhere}`,
    params
  );
  return { total: c.n, items: rows.map(mapRow) };
}

export async function getImlaById(id) {
  const [rows] = await db.query(
    `SELECT id, word, entry_text, letter, tags_json, title_id, page_num, source
     FROM kaa_imla WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function countImla() {
  try {
    const [[n]] = await db.query(`SELECT COUNT(*) AS n FROM kaa_imla`);
    return n.n;
  } catch {
    return 0;
  }
}

export async function getImlaSourceStats() {
  try {
    const [rows] = await db.query(
      `SELECT source, COUNT(*) AS n FROM kaa_imla GROUP BY source ORDER BY source`
    );
    return Object.fromEntries(rows.map((r) => [r.source, r.n]));
  } catch {
    return {};
  }
}

export async function getImlaLetters(source = '') {
  try {
    const src = normalizeSource(source);
    const where = src ? 'WHERE letter IS NOT NULL AND letter != "" AND source = ?' : 'WHERE letter IS NOT NULL AND letter != ""';
    const params = src ? [src] : [];
    const [rows] = await db.query(
      `SELECT letter, COUNT(*) AS n FROM kaa_imla
       ${where}
       GROUP BY letter ORDER BY letter`,
      params
    );
    return rows.map((r) => ({ letter: r.letter, n: r.n }));
  } catch {
    return [];
  }
}

export async function getImlaForTitle(titleId, soz) {
  try {
    const [byTitle] = await db.query(
      `SELECT id, word, entry_text, letter, tags_json, title_id, page_num, source
       FROM kaa_imla WHERE title_id = ?
       ORDER BY CASE source WHEN '2020' THEN 0 WHEN 'ozimizdan' THEN 1 ELSE 2 END
       LIMIT 8`,
      [titleId]
    );
    if (byTitle.length) return byTitle.map(mapRow);
    const base = String(soz || '').trim();
    if (base.length < 2) return [];
    const fold = searchFold(base);
    const [byWord] = await db.query(
      `SELECT id, word, entry_text, letter, tags_json, title_id, page_num, source
       FROM kaa_imla
       WHERE word_fold = ? OR word = ?
       ORDER BY CASE source WHEN '2020' THEN 0 WHEN 'ozimizdan' THEN 1 ELSE 2 END
       LIMIT 6`,
      [fold, base]
    );
    return byWord.map(mapRow);
  } catch {
    return [];
  }
}
