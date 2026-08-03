import { pools, DB } from '../config/db.js';

const db = pools.users;
/** null = sheksiz (mehman ham erkin oyin/test). */
const QUIZ_LIMIT = null;
/** Mehmon sózlik oqıwı — sheksiz. null = limit joq. */
const WORD_LIMIT = null;
/** Mehmon krossvord — sheksiz. */
const CROSSWORD_GUEST_ALLOWED = true;

let schemaReady = false;

export async function ensureQuotaSchema() {
  if (schemaReady) return;
  try {
    await db.query(
      `ALTER TABLE anonymous_actors ADD COLUMN user_id BIGINT UNSIGNED NULL`
    ).catch(() => {});
    await db.query(
      `ALTER TABLE anonymous_actors ADD COLUMN quiz_completes INT UNSIGNED NOT NULL DEFAULT 0`
    ).catch(() => {});
    await db.query(
      `ALTER TABLE anonymous_actors ADD COLUMN word_views INT UNSIGNED NOT NULL DEFAULT 0`
    ).catch(() => {});
    schemaReady = true;
  } catch {
    schemaReady = true;
  }
}

export async function getActorQuotaRow(actorId) {
  await ensureQuotaSchema();
  const [rows] = await db.query(
    `SELECT id, user_id AS userId, quiz_completes AS quizCompletes, word_views AS wordViews
     FROM anonymous_actors WHERE id = ? LIMIT 1`,
    [actorId]
  );
  return rows[0] || null;
}

export function buildQuotaStatus(row, { isAuthenticated = false } = {}) {
  const linked = Boolean(row?.userId) || isAuthenticated;
  const quizCompletes = Number(row?.quizCompletes) || 0;
  const wordViews = Number(row?.wordViews) || 0;
  const wordLimit = linked ? null : WORD_LIMIT;
  const quizLimit = linked ? null : QUIZ_LIMIT;
  const hasWordCap = wordLimit != null && Number.isFinite(wordLimit);
  const hasQuizCap = quizLimit != null && Number.isFinite(quizLimit);
  return {
    isGuest: !linked,
    quizCompletes,
    wordViews,
    quizLimit,
    wordLimit,
    crosswordAllowed: linked || CROSSWORD_GUEST_ALLOWED,
    canStartQuiz: linked || !hasQuizCap || quizCompletes < quizLimit,
    canViewWord: linked || !hasWordCap || wordViews < wordLimit,
  };
}

export async function assertCanStartQuiz(actorId, { isAuthenticated = false } = {}) {
  const row = await getActorQuotaRow(actorId);
  const status = buildQuotaStatus(row, { isAuthenticated });
  if (!status.canStartQuiz) {
    const err = new Error('Mehmon test limiti — dizimnen ótiń');
    err.statusCode = 403;
    err.code = 'GUEST_QUIZ_LIMIT';
    throw err;
  }
  return status;
}

export async function assertCanViewWord(actorId, { isAuthenticated = false } = {}) {
  const row = await getActorQuotaRow(actorId);
  const status = buildQuotaStatus(row, { isAuthenticated });
  if (!status.canViewWord) {
    const err = new Error('Mehmon sóz limiti — dizimnen ótiń');
    err.statusCode = 403;
    err.code = 'GUEST_WORD_LIMIT';
    throw err;
  }
  return status;
}

export async function assertCanPlayCrossword(actorId, { isAuthenticated = false } = {}) {
  const row = await getActorQuotaRow(actorId);
  const status = buildQuotaStatus(row, { isAuthenticated });
  if (!status.crosswordAllowed) {
    const err = new Error('Krossvord juwapı ushın dizim kerek');
    err.statusCode = 403;
    err.code = 'GUEST_CROSSWORD_BLOCK';
    throw err;
  }
  return status;
}

export async function incrementQuizCompletes(actorId) {
  await ensureQuotaSchema();
  await db.query(
    `UPDATE anonymous_actors SET quiz_completes = quiz_completes + 1 WHERE id = ?`,
    [actorId]
  );
}

export async function incrementWordViews(actorId) {
  await ensureQuotaSchema();
  await db.query(
    `UPDATE anonymous_actors SET word_views = word_views + 1 WHERE id = ?`,
    [actorId]
  );
  const row = await getActorQuotaRow(actorId);
  return buildQuotaStatus(row);
}

/**
 * Actorni user ga bog‘lash. Boshqa user ga tegishli actorni o‘g‘irlab bo‘lmaydi.
 */
export async function linkActorToUser(actorId, userId) {
  await ensureQuotaSchema();
  const id = Number(actorId);
  const uid = Number(userId);
  if (!id || !uid) {
    const err = new Error('actorId hám userId kerek');
    err.statusCode = 400;
    throw err;
  }
  const [[row]] = await db.query(
    `SELECT user_id AS userId FROM anonymous_actors WHERE id = ? LIMIT 1`,
    [id]
  );
  if (!row) {
    const err = new Error('Actor tabılmadı');
    err.statusCode = 404;
    throw err;
  }
  if (row.userId != null && Number(row.userId) !== uid) {
    const err = new Error('Bul qurılma basqa akkauntqa baylanǵan');
    err.statusCode = 409;
    err.code = 'ACTOR_OWNED';
    throw err;
  }
  if (row.userId == null) {
    await db.query(
      `UPDATE anonymous_actors SET user_id = ? WHERE id = ? AND user_id IS NULL`,
      [uid, id]
    );
  }
}

/** User ga bog‘langan barcha actor id lar. */
export async function listLinkedActorIds(userId) {
  if (!userId) return [];
  await ensureQuotaSchema();
  const [rows] = await db.query(
    `SELECT id FROM anonymous_actors WHERE user_id = ? ORDER BY id ASC`,
    [userId]
  );
  return rows.map((r) => Number(r.id));
}

/**
 * Auth bo‘lsa user ning barcha actorlari; aks holda faqat joriy.
 * Stats/points agregatsiyasi uchun. userId + actorId bolsa — har doim bog‘laydı.
 */
export async function resolveActorScope(actorId, userId = null) {
  const current = actorId ? Number(actorId) : null;
  if (userId && current) {
    try {
      await linkActorToUser(current, userId);
    } catch (e) {
      // Steal qilmaymiz — faqat shu user ning actorlarini qaytaramiz
      if (e?.statusCode !== 409) throw e;
      const ids = await listLinkedActorIds(userId);
      return ids.length ? ids : [];
    }
    const ids = await listLinkedActorIds(userId);
    return [...new Set([...(ids || []), current])].filter(Boolean).sort((a, b) => a - b);
  }
  if (userId) {
    const ids = await listLinkedActorIds(userId);
    if (ids.length) return ids;
  }
  return current ? [current] : [];
}

export { QUIZ_LIMIT, WORD_LIMIT, CROSSWORD_GUEST_ALLOWED };
