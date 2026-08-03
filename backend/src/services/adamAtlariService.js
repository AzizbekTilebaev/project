/**
 * Adam atları (personal names) dictionary service.
 */
import db from '../config/dictionary.db.js';
import searchFold from '../utils/searchFold.js';

function safeJson(val, fallback = []) {
  if (val == null) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function mapNameRow(r) {
  const senses = safeJson(r.senses_json, []);
  return {
    id: r.id,
    name: r.name,
    gender: r.gender || null,
    senses: Array.isArray(senses) ? senses : [],
    gloss: r.gloss,
    titleId: r.title_id || null,
    needsReview: Boolean(r.needs_review),
    source: r.source,
  };
}

export async function searchAdamAtlari({
  q = '',
  gender = '',
  limit = 50,
  offset = 0,
} = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const off = Math.max(Number(offset) || 0, 0);
  const query = String(q || '').trim();
  const g = ['ul', 'qiz'].includes(String(gender || '').trim())
    ? String(gender).trim()
    : '';

  const where = ['1=1'];
  const params = [];
  if (g) {
    where.push('gender = ?');
    params.push(g);
  }

  if (!query) {
    const sqlWhere = where.join(' AND ');
    const [rows] = await db.query(
      `SELECT id, name, gender, senses_json, gloss, title_id, needs_review, source
       FROM kaa_adam_atlari
       WHERE ${sqlWhere}
       ORDER BY name
       LIMIT ? OFFSET ?`,
      [...params, lim, off]
    );
    const [[c]] = await db.query(
      `SELECT COUNT(*) AS n FROM kaa_adam_atlari WHERE ${sqlWhere}`,
      params
    );
    return { total: c.n, items: rows.map(mapNameRow) };
  }

  const fold = searchFold(query);
  const like = `%${query.replace(/[%_]/g, '')}%`;
  where.push('(name LIKE ? OR gloss LIKE ? OR name_fold LIKE ?)');
  params.push(like, like, fold ? `%${fold}%` : like);
  const sqlWhere = where.join(' AND ');

  const [rows] = await db.query(
    `SELECT id, name, gender, senses_json, gloss, title_id, needs_review, source
     FROM kaa_adam_atlari
     WHERE ${sqlWhere}
     ORDER BY
       CASE
         WHEN name = ? THEN 0
         WHEN name LIKE ? THEN 1
         WHEN name_fold = ? THEN 2
         ELSE 3
       END,
       name
     LIMIT ? OFFSET ?`,
    [...params, query, `${query}%`, fold || query, lim, off]
  );
  const [[c]] = await db.query(
    `SELECT COUNT(*) AS n FROM kaa_adam_atlari WHERE ${sqlWhere}`,
    params
  );
  return { total: c.n, items: rows.map(mapNameRow) };
}

export async function getAdamAtariById(id) {
  const [rows] = await db.query(
    `SELECT id, name, gender, senses_json, gloss, title_id, needs_review, source
     FROM kaa_adam_atlari WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] ? mapNameRow(rows[0]) : null;
}

export async function countAdamAtlari() {
  try {
    const [[n]] = await db.query(`SELECT COUNT(*) AS n FROM kaa_adam_atlari`);
    return n.n;
  } catch {
    return 0;
  }
}

export async function getAdamAtlariForTitle(titleId, soz) {
  try {
    const [byTitle] = await db.query(
      `SELECT id, name, gender, senses_json, gloss, title_id, needs_review, source
       FROM kaa_adam_atlari WHERE title_id = ? LIMIT 8`,
      [titleId]
    );
    if (byTitle.length) return byTitle.map(mapNameRow);
    const base = String(soz || '').trim();
    if (base.length < 2) return [];
    const fold = searchFold(base);
    const [byName] = await db.query(
      `SELECT id, name, gender, senses_json, gloss, title_id, needs_review, source
       FROM kaa_adam_atlari
       WHERE name_fold = ? OR name = ?
       LIMIT 6`,
      [fold, base]
    );
    return byName.map(mapNameRow);
  } catch {
    return [];
  }
}
