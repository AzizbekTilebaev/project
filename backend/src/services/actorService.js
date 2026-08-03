import { pools, DB } from '../config/db.js';
import { hashAnonymousId } from '../utils/actorHash.js';

const db = pools.users;

/** Domen eventlari allowlist — boshqa turlar rad etiladi. */
export const ALLOWED_EVENTS = new Set([
  'quiz_started',
  'question_viewed',
  'question_answered',
  'quiz_paused',
  'quiz_resumed',
  'quiz_completed',
  'quiz_partial_completed',
  'consent_age_granted',
  'consent_age_denied',
  'actor_deleted',
  'adaptive_started',
  'adaptive_answered',
  'tutor_started',
  'tutor_completed',
  'dict_game_completed',
  'word_of_day_claimed',
  'combo_chest_claimed',
  'mistake_recorded',
  'answer_review_waitlist',
  'session_heartbeat',
  'word_viewed',
  'exit_feedback',
  'site_visit',
  'account_claimed',
  'quiz_force_expired',
  'quiz_attempt_voided',
]);

const PAYLOAD_KEYS = new Set([
  'questionId',
  'position',
  'timeSpentMs',
  'mode',
  'partial',
  'score',
  'total',
  'product',
  'reason',
  'clawbackAmount',
  'by',
]);

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const out = {};
  for (const key of PAYLOAD_KEYS) {
    if (payload[key] === undefined) continue;
    const v = payload[key];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[key] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

export async function ensureActor(actorKey) {
  const selectSql =
    'SELECT id, age_years AS ageYears, age_consent AS ageConsent FROM anonymous_actors WHERE actor_key = ? LIMIT 1';

  const [rows] = await db.query(selectSql, [actorKey]);
  if (rows[0]) {
    await db.query('UPDATE anonymous_actors SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [
      rows[0].id,
    ]);
    return rows[0];
  }

  try {
    const [result] = await db.query('INSERT INTO anonymous_actors (actor_key) VALUES (?)', [
      actorKey,
    ]);
    return { id: result.insertId, ageYears: null, ageConsent: 0 };
  } catch (err) {
    // Parallel requests: unique key race — re-read existing row.
    if (err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062) {
      const [again] = await db.query(selectSql, [actorKey]);
      if (again[0]) {
        await db.query(
          'UPDATE anonymous_actors SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?',
          [again[0].id]
        );
        return again[0];
      }
    }
    throw err;
  }
}

export async function setAgeConsent(actorId, { consent, ageYears }) {
  if (!consent) {
    await db.query(
      'UPDATE anonymous_actors SET age_consent = 0, age_years = NULL WHERE id = ?',
      [actorId]
    );
    await recordEvent(actorId, 'consent_age_denied', {});
    return { ageConsent: false, ageYears: null };
  }
  const age = Number(ageYears);
  if (!Number.isInteger(age) || age < 5 || age > 120) {
    const err = new Error('Jas 5–120 aralıǵında bolıwı kerek');
    err.statusCode = 400;
    throw err;
  }
  await db.query(
    'UPDATE anonymous_actors SET age_consent = 1, age_years = ? WHERE id = ?',
    [age, actorId]
  );
  await recordEvent(actorId, 'consent_age_granted', {});
  return { ageConsent: true, ageYears: age };
}

export async function recordEvent(actorId, eventType, { quizId = null, attemptId = null, payload = null } = {}) {
  if (!ALLOWED_EVENTS.has(eventType)) return null;
  const clean = sanitizePayload(payload);
  const [result] = await db.query(
    `INSERT INTO ${DB.statistika}.learning_events (actor_id, event_type, quiz_id, attempt_id, payload_json)
     VALUES (?, ?, ?, ?, ?)`,
    [actorId, eventType, quizId, attemptId, clean ? JSON.stringify(clean) : null]
  );
  return result.insertId;
}

/** Bitta user ga bog‘langan barcha actor id lar (qurilmalar). */
export async function listActorIdsForUser(userId) {
  if (!userId) return [];
  const [rows] = await db.query(
    `SELECT id FROM anonymous_actors WHERE user_id = ? ORDER BY id ASC`,
    [userId]
  );
  return rows.map((r) => Number(r.id));
}

/**
 * Auth: joriy anonim actorni user ga bog‘lash + multi-device tarixni saqlash.
 * Har qurilma o‘z actor_id sini saqlaydi; statistik/ball o‘qishda barcha
 * bog‘langan actorlar agregatlanadi. Wallet qatorlari asosiy (eng eski)
 * actorga birlashtiriladi — ko‘rinadigan balans yo‘qolmasin.
 */
export async function claimAnonymousHistory(actorId, userId) {
  if (!actorId || !userId) {
    const err = new Error('actorId hám userId kerek');
    err.statusCode = 400;
    throw err;
  }

  const { linkActorToUser } = await import('./quotaService.js');
  await linkActorToUser(actorId, userId);

  const actorIds = await listActorIdsForUser(userId);
  const primaryId = actorIds[0] || Number(actorId);

  let mergedWallets = 0;
  if (actorIds.length > 1) {
    mergedWallets = await consolidateWallets(primaryId, actorIds);
  }

  await recordEvent(actorId, 'account_claimed', {
    payload: { product: 'auth', score: actorIds.length },
  }).catch(() => {});

  return {
    ok: true,
    claimed: true,
    actorId: Number(actorId),
    userId: Number(userId),
    primaryActorId: primaryId,
    linkedActors: actorIds.length,
    mergedWallets,
  };
}

/** Boshqa actor hamyonlarini primary ga ko‘chirish (bir marta, destructive). */
async function consolidateWallets(primaryId, actorIds) {
  const others = actorIds.filter((id) => Number(id) !== Number(primaryId));
  if (!others.length) return 0;

  const { levelForPoints } = await import('./pointsService.js');
  const stat = pools.statistika;
  const conn = await stat.getConnection();
  let moved = 0;
  try {
    await conn.beginTransaction();
    await conn.query(`INSERT IGNORE INTO actor_wallets (actor_id) VALUES (?)`, [primaryId]);
    for (const oid of others) {
      const [[w]] = await conn.query(
        `SELECT balance, total_earned, total_spent FROM actor_wallets WHERE actor_id = ? FOR UPDATE`,
        [oid]
      );
      if (!w) continue;
      const bal = Number(w.balance) || 0;
      const earned = Number(w.total_earned) || 0;
      const spent = Number(w.total_spent) || 0;
      if (!bal && !earned && !spent) continue;

      await conn.query(
        `UPDATE actor_wallets
         SET balance = balance + ?, total_earned = total_earned + ?, total_spent = total_spent + ?
         WHERE actor_id = ?`,
        [bal, earned, spent, primaryId]
      );
      // Unique (kind, ref_id) to‘qnashsa IGNORE — eski qatorlar primary da qoladi
      await conn.query(
        `UPDATE IGNORE point_transactions SET actor_id = ? WHERE actor_id = ?`,
        [primaryId, oid]
      );
      await conn.query(
        `UPDATE actor_wallets
         SET balance = 0, total_earned = 0, total_spent = 0, level = 1
         WHERE actor_id = ?`,
        [oid]
      );
      moved += 1;
    }
    const [[{ totalEarned }]] = await conn.query(
      `SELECT total_earned AS totalEarned FROM actor_wallets WHERE actor_id = ?`,
      [primaryId]
    );
    await conn.query(`UPDATE actor_wallets SET level = ? WHERE actor_id = ?`, [
      levelForPoints(totalEarned).level,
      primaryId,
    ]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return moved;
}

export async function deleteActorData(actorId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `DELETE FROM ${DB.quiz}.quiz_attempt_questions
       WHERE attempt_id IN (SELECT id FROM ${DB.quiz}.quiz_attempts WHERE actor_id = ?)`,
      [actorId]
    );
    await conn.query(`DELETE FROM ${DB.quiz}.quiz_attempts WHERE actor_id = ?`, [actorId]);
    await conn.query(`DELETE FROM ${DB.statistika}.learning_events WHERE actor_id = ?`, [actorId]);
    await conn.query(`DELETE FROM ${DB.krasvord}.crossword_stats WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.statistika}.book_progress WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.statistika}.reading_sessions WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.statistika}.reading_lesson_srs WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.krasvord}.dict_game_rounds WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.quiz}.game_room_members WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.statistika}.actor_ability WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.ai}.mistake_bank WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.ai}.tutor_sessions WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.statistika}.point_transactions WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.statistika}.answer_review_unlocks WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query(`DELETE FROM ${DB.statistika}.actor_wallets WHERE actor_id = ?`, [actorId]).catch(() => {});
    await conn.query('DELETE FROM anonymous_actors WHERE id = ?', [actorId]);
    await conn.commit();
    return { deleted: true };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Retention: eski eventlarni o‘chirish (default 180 kun). */
export async function cleanupOldEvents(days = 180) {
  const [result] = await db.query(
    `DELETE FROM ${DB.statistika}.learning_events WHERE created_at < (NOW() - INTERVAL ? DAY)`,
    [days]
  );
  return { deleted: result.affectedRows || 0 };
}

export function actorKeyFromRaw(rawId) {
  return hashAnonymousId(rawId);
}
