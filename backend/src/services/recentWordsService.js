/**
 * Jaqında kórilgen sózler — akkaunt bo‘yınsha saqlanadı.
 * Mehmonda localStorage qaldırıladı, login bolǵanda sync qılınadı.
 */
import { pools } from '../config/db.js';

const db = pools.users;
const MAX_RECENT = 24;

let schemaReady = false;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export async function ensureRecentWordsSchema() {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS word_recent_views (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      title_id VARCHAR(64) NOT NULL,
      soz VARCHAR(255) NOT NULL DEFAULT '',
      category VARCHAR(120) NULL,
      viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_recent_user_title (user_id, title_id),
      KEY idx_recent_user_viewed (user_id, viewed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

function rowToItem(row) {
  return {
    id: row.title_id,
    soz: row.soz || '',
    category: row.category || null,
    viewedAt: row.viewed_at ? new Date(row.viewed_at).getTime() : Date.now(),
  };
}

export async function listRecentWords(userId) {
  await ensureRecentWordsSchema();
  const [rows] = await db.query(
    `SELECT title_id, soz, category, viewed_at
     FROM word_recent_views
     WHERE user_id = ?
     ORDER BY viewed_at DESC
     LIMIT ?`,
    [userId, MAX_RECENT]
  );
  return rows.map(rowToItem);
}

async function withDeadlockRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isDeadlock = err?.code === 'ER_LOCK_DEADLOCK' || err?.errno === 1213;
      if (!isDeadlock || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 40 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function addRecentWord(userId, entry) {
  await ensureRecentWordsSchema();
  const titleId = String(entry?.id || entry?.titleId || '').trim();
  if (!titleId) throw httpError('title id kerek');
  const soz = String(entry?.soz || entry?.base_soz || '').trim().slice(0, 255);
  if (!soz) throw httpError('soz kerek');
  const category = String(entry?.category || '').trim().slice(0, 120) || null;

  await withDeadlockRetry(async () => {
    await db.query(
      `INSERT INTO word_recent_views (user_id, title_id, soz, category, viewed_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         soz = VALUES(soz),
         category = COALESCE(VALUES(category), category),
         viewed_at = CURRENT_TIMESTAMP`,
      [userId, titleId, soz, category]
    );

    const [[countRow]] = await db.query(
      `SELECT COUNT(*) AS c FROM word_recent_views WHERE user_id = ?`,
      [userId]
    );
    const excess = Number(countRow?.c || 0) - MAX_RECENT;
    if (excess > 0) {
      await db.query(
        `DELETE FROM word_recent_views
         WHERE user_id = ?
         ORDER BY viewed_at ASC
         LIMIT ?`,
        [userId, excess]
      );
    }
  });

  return { added: true, id: titleId };
}

export async function clearRecentWords(userId) {
  await ensureRecentWordsSchema();
  const [result] = await db.query(`DELETE FROM word_recent_views WHERE user_id = ?`, [userId]);
  return { cleared: result.affectedRows || 0 };
}

export async function syncRecentWords(userId, items = []) {
  await ensureRecentWordsSchema();
  const list = Array.isArray(items) ? items.slice(0, MAX_RECENT) : [];
  for (const entry of list) {
    if (!entry?.id || !entry?.soz) continue;
    await addRecentWord(userId, entry);
  }
  return listRecentWords(userId);
}

