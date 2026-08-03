/**
 * Ball (points) tizimi. Uy bazasi: kk_statistika.
 *
 * Qoidalar:
 *  - To‘g‘ri javob: +10 ball
 *  - Tezlik bonusi: har to‘g‘ri javob uchun 0–5 ball (<=3s: +5, <=6s: +3, <=10s: +1)
 *  - Xatosiz to‘liq tugatish: +20 ball
 *  - Takroriy urinish: 2-marta 50%, keyingilari 20%
 *  - Javob ochish narxi: har savolga 5 ball, minimum 30 ball
 *
 * Idempotensiya: point_transactions (kind, ref_id) UNIQUE — bir attempt uchun
 * ikki marta ball yozilmaydi. Sarflash SELECT ... FOR UPDATE bilan himoyalangan.
 *
 * Kelajak: 'coin_purchase' / 'coin_game' tranzaksiya turlari real pul manbalari
 * uchun ajratilgan — sxema o‘zgarmasdan qo‘shiladi.
 */
import { pools, DB } from '../config/db.js';

const db = pools.statistika;

export const POINTS = {
  CORRECT: 10,
  PERFECT_BONUS: 20,
  SPEED_FAST_MS: 3000,
  SPEED_MID_MS: 6000,
  SPEED_SLOW_MS: 10000,
  SPEED_FAST: 5,
  SPEED_MID: 3,
  SPEED_SLOW: 1,
  REVIEW_COST_PER_QUESTION: 5,
  REVIEW_COST_MIN: 30,
};

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra);
  return err;
}

/** Daraja chegarasi: level L uchun jami ball >= 50*L*(L-1). L1:0, L2:100, L3:300, L4:600... */
export function levelForPoints(totalEarned) {
  const total = Math.max(0, Number(totalEarned) || 0);
  let level = 1;
  while (50 * (level + 1) * level <= total) level += 1;
  const currentFloor = 50 * level * (level - 1);
  const nextAt = 50 * (level + 1) * level;
  return {
    level,
    nextAt,
    progress: Math.min(1, (total - currentFloor) / (nextAt - currentFloor)),
  };
}

/** Takroriy urinish koeffitsiyenti: 1-urinish 1.0, 2-urinish 0.5, keyin 0.2. */
export function retryMultiplier(priorAttempts) {
  const n = Math.max(0, Number(priorAttempts) || 0);
  if (n === 0) return 1;
  if (n === 1) return 0.5;
  return 0.2;
}

/** Tezlik bonusi (faqat to‘g‘ri javob uchun). */
export function speedBonus(timeSpentMs) {
  const t = Number(timeSpentMs);
  if (!Number.isFinite(t) || t <= 0) return 0;
  if (t <= POINTS.SPEED_FAST_MS) return POINTS.SPEED_FAST;
  if (t <= POINTS.SPEED_MID_MS) return POINTS.SPEED_MID;
  if (t <= POINTS.SPEED_SLOW_MS) return POINTS.SPEED_SLOW;
  return 0;
}

/**
 * Yakunlangan urinish uchun ball hisoblash.
 * @param {Array<{isCorrect:boolean, timeSpentMs:number|null}>} answers
 * @param {{perfect:boolean, priorAttempts:number}} opts
 */
export function computeAttemptPoints(answers, { perfect = false, priorAttempts = 0 } = {}) {
  let base = 0;
  let speed = 0;
  for (const a of answers) {
    if (!a.isCorrect) continue;
    base += POINTS.CORRECT;
    speed += speedBonus(a.timeSpentMs);
  }
  const perfectBonus = perfect ? POINTS.PERFECT_BONUS : 0;
  const multiplier = retryMultiplier(priorAttempts);
  const total = Math.round((base + speed + perfectBonus) * multiplier);
  return { base, speed, perfectBonus, multiplier, total };
}

export function reviewCost(totalQuestions) {
  const n = Math.max(1, Number(totalQuestions) || 1);
  return Math.max(POINTS.REVIEW_COST_MIN, n * POINTS.REVIEW_COST_PER_QUESTION);
}

async function ensureWallet(conn, actorId) {
  await conn.query(`INSERT IGNORE INTO actor_wallets (actor_id) VALUES (?)`, [actorId]);
}

/** Hamyon holati (yo‘q bo‘lsa yaratiladi). */
export async function getWallet(actorId) {
  await ensureWallet(db, actorId);
  const [[row]] = await db.query(
    `SELECT actor_id AS actorId, balance, total_earned AS totalEarned,
            total_spent AS totalSpent, level, updated_at AS updatedAt
     FROM actor_wallets WHERE actor_id = ?`,
    [actorId]
  );
  const levelInfo = levelForPoints(row.totalEarned);
  return { ...row, level: levelInfo.level, levelNextAt: levelInfo.nextAt, levelProgress: levelInfo.progress };
}

/** Bir nechta actor (multi-device) hamyonlarini yig‘indi ko‘rinishi. */
export async function getAggregatedWallet(actorIds) {
  const ids = (Array.isArray(actorIds) ? actorIds : [actorIds])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) {
    return {
      actorId: null,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      level: 1,
      levelNextAt: 100,
      levelProgress: 0,
    };
  }
  if (ids.length === 1) return getWallet(ids[0]);

  for (const id of ids) await ensureWallet(db, id);
  const placeholders = ids.map(() => '?').join(',');
  const [[row]] = await db.query(
    `SELECT COALESCE(SUM(balance), 0) AS balance,
            COALESCE(SUM(total_earned), 0) AS totalEarned,
            COALESCE(SUM(total_spent), 0) AS totalSpent
     FROM actor_wallets WHERE actor_id IN (${placeholders})`,
    ids
  );
  const levelInfo = levelForPoints(row.totalEarned);
  return {
    actorId: ids[0],
    balance: Number(row.balance) || 0,
    totalEarned: Number(row.totalEarned) || 0,
    totalSpent: Number(row.totalSpent) || 0,
    level: levelInfo.level,
    levelNextAt: levelInfo.nextAt,
    levelProgress: levelInfo.progress,
  };
}

/**
 * Ball berish (idempotent: bir xil kind+refId ikkinchi marta yozilmaydi).
 * @returns {{awarded:boolean, amount:number, balance:number, level:number, previousLevel:number, leveledUp:boolean, levelProgress:number, levelNextAt:number}}
 */
export async function awardPoints(actorId, { amount, kind, refId = null, meta = null }) {
  const value = Math.max(0, Math.round(Number(amount) || 0));
  let previousLevel = 1;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureWallet(conn, actorId);
    const [[before]] = await conn.query(
      `SELECT total_earned AS totalEarned, level FROM actor_wallets WHERE actor_id = ? FOR UPDATE`,
      [actorId]
    );
    previousLevel = Number(before?.level) || levelForPoints(before?.totalEarned || 0).level;

    if (value > 0) {
      try {
        await conn.query(
          `INSERT INTO point_transactions (actor_id, amount, kind, ref_id, meta_json)
           VALUES (?, ?, ?, ?, ?)`,
          [actorId, value, kind, refId, meta ? JSON.stringify(meta) : null]
        );
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          await conn.rollback();
          const wallet = await getWallet(actorId);
          return {
            awarded: false,
            amount: 0,
            balance: wallet.balance,
            level: wallet.level,
            previousLevel: wallet.level,
            leveledUp: false,
            levelProgress: wallet.levelProgress,
            levelNextAt: wallet.levelNextAt,
          };
        }
        throw e;
      }
      await conn.query(
        `UPDATE actor_wallets
         SET balance = balance + ?, total_earned = total_earned + ?
         WHERE actor_id = ?`,
        [value, value, actorId]
      );
      const [[{ totalEarned }]] = await conn.query(
        `SELECT total_earned AS totalEarned FROM actor_wallets WHERE actor_id = ?`,
        [actorId]
      );
      await conn.query(`UPDATE actor_wallets SET level = ? WHERE actor_id = ?`, [
        levelForPoints(totalEarned).level,
        actorId,
      ]);
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  const wallet = await getWallet(actorId);
  const leveledUp = wallet.level > previousLevel;
  return {
    awarded: value > 0,
    amount: value,
    balance: wallet.balance,
    level: wallet.level,
    previousLevel,
    leveledUp,
    levelProgress: wallet.levelProgress,
    levelNextAt: wallet.levelNextAt,
  };
}

/**
 * Ball sarflash — balans yetmasa 402 (parallel sarflashdan FOR UPDATE himoya qiladi).
 */
export async function spendPoints(actorId, { amount, kind, refId = null, meta = null }) {
  const value = Math.round(Number(amount) || 0);
  if (value <= 0) throw httpError('Sarplanatuǵın ball muǵdarı nadurıs');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureWallet(conn, actorId);
    const [[wallet]] = await conn.query(
      `SELECT balance FROM actor_wallets WHERE actor_id = ? FOR UPDATE`,
      [actorId]
    );
    if (Number(wallet.balance) < value) {
      await conn.rollback();
      throw httpError('Ball jeterli emes', 402, {
        code: 'INSUFFICIENT_POINTS',
        balance: Number(wallet.balance),
        cost: value,
        needed: value - Number(wallet.balance),
      });
    }
    try {
      await conn.query(
        `INSERT INTO point_transactions (actor_id, amount, kind, ref_id, meta_json)
         VALUES (?, ?, ?, ?, ?)`,
        [actorId, -value, kind, refId, meta ? JSON.stringify(meta) : null]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        // Shu refId uchun allaqachon sarflangan — takror yechmaymiz
        await conn.rollback();
        return { spent: false, amount: 0, duplicate: true };
      }
      throw e;
    }
    await conn.query(
      `UPDATE actor_wallets
       SET balance = balance - ?, total_spent = total_spent + ?
       WHERE actor_id = ?`,
      [value, value, actorId]
    );
    await conn.commit();
    return { spent: true, amount: value };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}

/** Tranzaksiyalar tarixi. */
export async function getHistory(actorIdOrIds, limit = 50) {
  const ids = (Array.isArray(actorIdOrIds) ? actorIdOrIds : [actorIdOrIds])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT id, amount, kind, ref_id AS refId, meta_json AS meta, created_at AS createdAt
     FROM point_transactions
     WHERE actor_id IN (${placeholders})
     ORDER BY created_at DESC, id DESC LIMIT ?`,
    [...ids, safeLimit]
  );
  return rows.map((r) => ({
    ...r,
    meta: typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta,
  }));
}

/**
 * Reyting — faqat rozilik bildirgan foydalanuvchilar, nickname bilan.
 * actor_key yoki ichki ID ommaga chiqmaydi.
 */
export async function getLeaderboard({ limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const [rows] = await db.query(
    `SELECT w.total_earned AS totalEarned, w.level, a.nickname
     FROM actor_wallets w
     JOIN ${DB.users}.anonymous_actors a ON a.id = w.actor_id
     WHERE a.leaderboard_opt_in = 1 AND a.nickname IS NOT NULL AND w.total_earned > 0
     ORDER BY w.total_earned DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    nickname: r.nickname,
    totalEarned: Number(r.totalEarned),
    level: Number(r.level),
  }));
}

/** Reytingdagi o‘z o‘rni (rozilikdan qat’i nazar, faqat o‘ziga ko‘rinadi). */
export async function getMyRank(actorId) {
  const wallet = await getWallet(actorId);
  const [[{ higher }]] = await db.query(
    `SELECT COUNT(*) AS higher FROM actor_wallets WHERE total_earned > ?`,
    [wallet.totalEarned]
  );
  return { rank: Number(higher) + 1, totalEarned: wallet.totalEarned, level: wallet.level };
}

/** Nickname va reyting roziligini saqlash. */
export async function setLeaderboardProfile(actorId, { nickname, optIn }) {
  const clean = String(nickname || '').trim().slice(0, 40);
  const wantsOptIn = Boolean(optIn);
  if (wantsOptIn && clean.length < 3) {
    throw httpError('Laqab keminde 3 belgiden ibarat bolıwı kerek');
  }
  await pools.users.query(
    `UPDATE anonymous_actors SET nickname = ?, leaderboard_opt_in = ? WHERE id = ?`,
    [clean || null, wantsOptIn ? 1 : 0, actorId]
  );
  return { nickname: clean || null, leaderboardOptIn: wantsOptIn };
}

export async function getLeaderboardProfile(actorId) {
  const [[row]] = await pools.users.query(
    `SELECT nickname, leaderboard_opt_in AS optIn FROM anonymous_actors WHERE id = ?`,
    [actorId]
  );
  return { nickname: row?.nickname || null, leaderboardOptIn: Boolean(row?.optIn) };
}

// ---------- Javob ochish (answer review unlock) ----------

export async function isReviewUnlocked(attemptId) {
  const [[row]] = await db.query(
    `SELECT id FROM answer_review_unlocks WHERE attempt_id = ? LIMIT 1`,
    [String(attemptId)]
  );
  return Boolean(row);
}

/**
 * Javoblarni ball evaziga ochish. Takror chaqirilsa xatosiz "allaqachon ochilgan".
 */
export async function unlockAnswerReview(actorId, attemptId, totalQuestions) {
  if (await isReviewUnlocked(attemptId)) {
    return { unlocked: true, alreadyUnlocked: true, cost: 0 };
  }
  const cost = reviewCost(totalQuestions);
  const spend = await spendPoints(actorId, {
    amount: cost,
    kind: 'answer_review_unlock',
    refId: String(attemptId),
    meta: { totalQuestions },
  });
  if (spend.duplicate) {
    return { unlocked: true, alreadyUnlocked: true, cost: 0 };
  }
  try {
    await db.query(
      `INSERT INTO answer_review_unlocks (actor_id, attempt_id, cost) VALUES (?, ?, ?)`,
      [actorId, String(attemptId), cost]
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_ENTRY') throw e;
  }
  const wallet = await getWallet(actorId);
  return { unlocked: true, alreadyUnlocked: false, cost, balance: wallet.balance };
}

/** Attempt uchun berilgan ballni topish (natija sahifasida ko‘rsatish uchun). */
export async function getAwardForRef(kind, refId) {
  const [[row]] = await db.query(
    `SELECT amount, meta_json AS meta FROM point_transactions
     WHERE kind = ? AND ref_id = ? LIMIT 1`,
    [kind, String(refId)]
  );
  if (!row) return null;
  return {
    amount: Number(row.amount),
    meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
  };
}

/**
 * Award clawback (admin void). Balans yetmasa — mavjud balansgacha yechadi (402 bermaydi).
 * Idempotent: bir xil clawbackKind+refId ikkinchi marta yozilmaydi.
 */
export async function revokeAwardForRef(
  awardKind,
  refId,
  { clawbackKind = 'award_revoked', meta = null } = {}
) {
  const [[award]] = await db.query(
    `SELECT actor_id AS actorId, amount FROM point_transactions
     WHERE kind = ? AND ref_id = ? LIMIT 1`,
    [awardKind, String(refId)]
  );
  if (!award || !(Number(award.amount) > 0)) {
    return { revoked: false, amount: 0, reason: 'no_award' };
  }

  const [[dup]] = await db.query(
    `SELECT id FROM point_transactions WHERE kind = ? AND ref_id = ? LIMIT 1`,
    [clawbackKind, String(refId)]
  );
  if (dup) {
    return { revoked: false, amount: 0, reason: 'already_revoked', duplicate: true };
  }

  const requested = Number(award.amount);
  const actorId = award.actorId;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await ensureWallet(conn, actorId);
    const [[wallet]] = await conn.query(
      `SELECT balance, total_earned AS totalEarned FROM actor_wallets WHERE actor_id = ? FOR UPDATE`,
      [actorId]
    );
    const claw = Math.min(requested, Math.max(0, Number(wallet.balance) || 0));
    try {
      await conn.query(
        `INSERT INTO point_transactions (actor_id, amount, kind, ref_id, meta_json)
         VALUES (?, ?, ?, ?, ?)`,
        [
          actorId,
          -claw,
          clawbackKind,
          String(refId),
          JSON.stringify({
            ...(meta && typeof meta === 'object' ? meta : {}),
            awardKind,
            requested,
            clawed: claw,
            shortfall: Math.max(0, requested - claw),
          }),
        ]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        await conn.rollback();
        return { revoked: false, amount: 0, reason: 'already_revoked', duplicate: true };
      }
      throw e;
    }
    if (claw > 0) {
      const nextEarned = Math.max(0, (Number(wallet.totalEarned) || 0) - claw);
      await conn.query(
        `UPDATE actor_wallets
         SET balance = balance - ?,
             total_spent = total_spent + ?,
             total_earned = ?,
             level = ?
         WHERE actor_id = ?`,
        [claw, claw, nextEarned, levelForPoints(nextEarned).level, actorId]
      );
    }
    await conn.commit();
    const after = await getWallet(actorId);
    return {
      revoked: true,
      amount: claw,
      requested,
      shortfall: Math.max(0, requested - claw),
      balance: after.balance,
      level: after.level,
    };
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    conn.release();
  }
}
