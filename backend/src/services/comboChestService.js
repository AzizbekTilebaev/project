/**
 * 7-kunlik combo chest — streak 7/14/21... da ochıladı, alohida claim.
 */
import crypto from 'crypto';
import { pools } from '../config/db.js';
import { awardPoints } from './pointsService.js';

const db = pools.statistika;
const COMBO_EVERY = 7;

let schemaReady = false;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function rewardForStreak(streak) {
  const s = Math.max(0, Number(streak) || 0);
  if (s >= 21) return { points: 100, tier: 'diamond' };
  if (s >= 14) return { points: 70, tier: 'gold' };
  return { points: 40, tier: 'silver' };
}

function isComboStreak(streak) {
  const s = Math.max(0, Number(streak) || 0);
  return s > 0 && s % COMBO_EVERY === 0;
}

function nextComboAt(streak) {
  const s = Math.max(0, Number(streak) || 0);
  const next = Math.ceil((s + 1) / COMBO_EVERY) * COMBO_EVERY;
  return {
    at: next,
    remaining: Math.max(0, next - s),
    reward: rewardForStreak(next),
  };
}

export async function ensureComboChestSchema() {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS loyalty_combo_chests (
      id CHAR(36) NOT NULL,
      actor_id BIGINT UNSIGNED NOT NULL,
      unlock_day DATE NOT NULL,
      streak_at INT NOT NULL,
      reward_points INT NOT NULL,
      tier VARCHAR(20) NOT NULL DEFAULT 'silver',
      status ENUM('pending','claimed') NOT NULL DEFAULT 'pending',
      claimed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_combo_actor_day (actor_id, unlock_day),
      KEY idx_combo_actor_status (actor_id, status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

function rowToChest(row) {
  if (!row) return null;
  return {
    id: row.id,
    unlockDay: row.unlock_day instanceof Date
      ? row.unlock_day.toISOString().slice(0, 10)
      : String(row.unlock_day).slice(0, 10),
    streakAt: Number(row.streak_at) || 0,
    rewardPoints: Number(row.reward_points) || 0,
    tier: row.tier || 'silver',
    status: row.status,
    claimedAt: row.claimed_at || null,
    createdAt: row.created_at || null,
  };
}

/**
 * Streak 7/14/21... bolǵanda pending chest ashıw.
 */
export async function maybeUnlockComboChest(actorId, { day, streak }) {
  await ensureComboChestSchema();
  if (!isComboStreak(streak)) return null;

  const reward = rewardForStreak(streak);
  const id = crypto.randomUUID();
  try {
    await db.query(
      `INSERT INTO loyalty_combo_chests
         (id, actor_id, unlock_day, streak_at, reward_points, tier, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [id, actorId, day, streak, reward.points, reward.tier]
    );
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      const [[existing]] = await db.query(
        `SELECT * FROM loyalty_combo_chests WHERE actor_id = ? AND unlock_day = ? LIMIT 1`,
        [actorId, day]
      );
      return rowToChest(existing);
    }
    throw e;
  }

  const [[row]] = await db.query(`SELECT * FROM loyalty_combo_chests WHERE id = ? LIMIT 1`, [id]);
  return rowToChest(row);
}

export async function getComboChestBundle(actorId, { streak = 0 } = {}) {
  await ensureComboChestSchema();
  const [pendingRows] = await db.query(
    `SELECT * FROM loyalty_combo_chests
     WHERE actor_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 5`,
    [actorId]
  );
  const [historyRows] = await db.query(
    `SELECT * FROM loyalty_combo_chests
     WHERE actor_id = ? AND status = 'claimed'
     ORDER BY claimed_at DESC
     LIMIT 8`,
    [actorId]
  );
  return {
    pending: (pendingRows || []).map(rowToChest),
    history: (historyRows || []).map(rowToChest),
    next: nextComboAt(streak),
  };
}

export async function claimComboChest(actorId, chestId) {
  await ensureComboChestSchema();
  const id = String(chestId || '').trim();
  if (!id) throw httpError('Chest id kerek');

  const [[row]] = await db.query(
    `SELECT * FROM loyalty_combo_chests WHERE id = ? AND actor_id = ? LIMIT 1`,
    [id, actorId]
  );
  if (!row) throw httpError('Chest tabılmadı', 404);
  if (row.status === 'claimed') {
    const wallet = await import('./pointsService.js').then((m) => m.getWallet(actorId));
    return {
      alreadyClaimed: true,
      chest: rowToChest(row),
      points: { earned: 0, balance: wallet.balance, level: wallet.level },
    };
  }

  const [upd] = await db.query(
    `UPDATE loyalty_combo_chests
     SET status = 'claimed', claimed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND actor_id = ? AND status = 'pending'`,
    [id, actorId]
  );
  if (!upd.affectedRows) {
    throw httpError('Chest aldın ashılǵan', 409);
  }

  const award = await awardPoints(actorId, {
    amount: Number(row.reward_points) || 0,
    kind: 'combo_chest_claim',
    refId: id,
    meta: {
      streakAt: row.streak_at,
      tier: row.tier,
      unlockDay: row.unlock_day,
    },
  });

  try {
    const { recordEvent } = await import('./actorService.js');
    await recordEvent(actorId, 'combo_chest_claimed', {
      payload: {
        chestId: id,
        streakAt: row.streak_at,
        earned: award.amount,
        tier: row.tier,
      },
    });
  } catch {
    /* optional */
  }

  const [[fresh]] = await db.query(`SELECT * FROM loyalty_combo_chests WHERE id = ? LIMIT 1`, [id]);
  return {
    alreadyClaimed: false,
    chest: rowToChest(fresh),
    points: {
      earned: award.amount,
      balance: award.balance,
      level: award.level,
      leveledUp: Boolean(award.leveledUp),
      previousLevel: award.previousLevel ?? null,
    },
  };
}

export { COMBO_EVERY, nextComboAt, isComboStreak };
