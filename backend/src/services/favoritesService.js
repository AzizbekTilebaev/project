/**
 * Lug‘at yoqtirilganlari — akkaunt bo‘yicha (kk_users.word_favorites).
 * Mehmon: faqat localStorage; login da sync.
 */
import { pools } from '../config/db.js';

const db = pools.users;
const MAX_FAVORITES = 200;

let schemaReady = false;

export async function ensureFavoritesSchema() {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS word_favorites (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      title_id VARCHAR(64) NOT NULL,
      soz VARCHAR(255) NOT NULL DEFAULT '',
      definition_preview VARCHAR(500) NULL,
      category VARCHAR(120) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_title (user_id, title_id),
      KEY idx_fav_user_created (user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

function rowToItem(row) {
  return {
    id: row.title_id,
    soz: row.soz || '',
    birinshi_aniqlama: row.definition_preview || null,
    category: row.category || null,
    savedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

export async function listFavorites(userId) {
  await ensureFavoritesSchema();
  const [rows] = await db.query(
    `SELECT title_id, soz, definition_preview, category, created_at
     FROM word_favorites
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, MAX_FAVORITES]
  );
  return rows.map(rowToItem);
}

export async function addFavorite(userId, entry) {
  await ensureFavoritesSchema();
  const titleId = String(entry?.id || entry?.titleId || '').trim();
  if (!titleId) {
    const err = new Error('title id kerek');
    err.statusCode = 400;
    throw err;
  }
  const soz = String(entry.soz || entry.base_soz || '').slice(0, 255);
  const def = String(
    entry.birinshi_aniqlama || entry.definition || entry.aniqlamalar?.[0]?.description || ''
  ).slice(0, 500) || null;
  const category = String(entry.category || entry.aniqlamalar?.[0]?.category || '').slice(0, 120) || null;

  const [[countRow]] = await db.query(
    `SELECT COUNT(*) AS n FROM word_favorites WHERE user_id = ?`,
    [userId]
  );
  if (Number(countRow.n) >= MAX_FAVORITES) {
    const [[exists]] = await db.query(
      `SELECT id FROM word_favorites WHERE user_id = ? AND title_id = ? LIMIT 1`,
      [userId, titleId]
    );
    if (!exists) {
      const err = new Error(`Eng kóp ${MAX_FAVORITES} sóz saqlaw múmkin`);
      err.statusCode = 400;
      throw err;
    }
  }

  await db.query(
    `INSERT INTO word_favorites (user_id, title_id, soz, definition_preview, category)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       soz = VALUES(soz),
       definition_preview = COALESCE(VALUES(definition_preview), definition_preview),
       category = COALESCE(VALUES(category), category)`,
    [userId, titleId, soz, def, category]
  );
  return { added: true, id: titleId };
}

export async function removeFavorite(userId, titleId) {
  await ensureFavoritesSchema();
  const id = String(titleId || '').trim();
  if (!id) {
    const err = new Error('title id kerek');
    err.statusCode = 400;
    throw err;
  }
  const [result] = await db.query(
    `DELETE FROM word_favorites WHERE user_id = ? AND title_id = ?`,
    [userId, id]
  );
  return { removed: (result.affectedRows || 0) > 0, id };
}

export async function clearFavorites(userId) {
  await ensureFavoritesSchema();
  const [result] = await db.query(`DELETE FROM word_favorites WHERE user_id = ?`, [userId]);
  return { cleared: result.affectedRows || 0 };
}

/**
 * Local + server merge: kelgan itemlarni upsert, keyin to‘liq ro‘yxat.
 */
export async function syncFavorites(userId, items = []) {
  await ensureFavoritesSchema();
  const list = Array.isArray(items) ? items.slice(0, MAX_FAVORITES) : [];
  for (const entry of list) {
    if (!entry?.id) continue;
    await addFavorite(userId, entry);
  }
  return listFavorites(userId);
}

export { MAX_FAVORITES };
