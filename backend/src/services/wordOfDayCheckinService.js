/**
 * Kún sózi — kuniga bir marta check-in (ball + streak).
 * Actor asosida; mehmon ham X-Anonymous-Id menen qatnasadı.
 */
import { pools } from '../config/db.js';
import { awardPoints } from './pointsService.js';
import TusindirmeService from './tusindirmeService.js';

const db = pools.statistika;
const wordService = new TusindirmeService();

const BASE_POINTS = 15;
const STREAK_BONUS_CAP = 7; // max +7 ball streak ushın
const FREEZE_PER_WEEK = 1;
const MILESTONES = [
  { day: 3, bonus: 10, tier: 'bronze' },
  { day: 7, bonus: 25, tier: 'silver' },
  { day: 14, bonus: 50, tier: 'gold' },
];

let schemaReady = false;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** tzOffset faqat ko‘rsatish / «bugun» — ±14 soat oralig‘iga siqiladi */
function clampTzOffset(offsetMinutes = 0) {
  const n = Number(offsetMinutes) || 0;
  return Math.max(-14 * 60, Math.min(14 * 60, n));
}

function localDateString(offsetMinutes = 0) {
  const now = new Date(Date.now() + clampTzOffset(offsetMinutes) * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

/** Soatni oldinga-orqaga surib bir necha «kun» claim qilishni to‘sadi */
const MIN_CLAIM_INTERVAL_MS = Number(process.env.WOD_MIN_CLAIM_HOURS || 20) * 60 * 60 * 1000;

async function assertUtcClaimCooldown(actorIds) {
  const ids = [...new Set((actorIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return;
  const ph = ids.map(() => '?').join(',');
  const [[row]] = await db.query(
    `SELECT created_at AS createdAt
     FROM word_of_day_checkins
     WHERE actor_id IN (${ph})
     ORDER BY created_at DESC
     LIMIT 1`,
    ids
  );
  if (!row?.createdAt) return;
  const elapsed = Date.now() - new Date(row.createdAt).getTime();
  if (elapsed < MIN_CLAIM_INTERVAL_MS) {
    const waitMin = Math.ceil((MIN_CLAIM_INTERVAL_MS - elapsed) / 60000);
    throw httpError(`Júdá tez. Shama ${waitMin} minutdan keyin urınıń.`, 429);
  }
}

function shiftDate(isoDay, deltaDays) {
  const d = new Date(`${isoDay}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function weekKeyFromDay(isoDay) {
  const d = new Date(`${isoDay}T12:00:00.000Z`);
  const dow = d.getUTCDay() || 7; // 1..7 (Mon..Sun)
  d.setUTCDate(d.getUTCDate() - (dow - 1)); // monday
  return d.toISOString().slice(0, 10);
}

function pointsForStreak(streak) {
  const s = Math.max(1, Number(streak) || 1);
  return BASE_POINTS + Math.min(s - 1, STREAK_BONUS_CAP);
}

function milestoneForStreak(streak) {
  const s = Math.max(0, Number(streak) || 0);
  return MILESTONES.find((m) => m.day === s) || null;
}

function nextMilestone(streakNow) {
  const s = Math.max(0, Number(streakNow) || 0);
  const next = MILESTONES.find((m) => m.day > s) || null;
  if (!next) return null;
  return {
    day: next.day,
    bonus: next.bonus,
    tier: next.tier,
    remaining: Math.max(0, next.day - s),
  };
}

export async function ensureWordOfDayCheckinSchema() {
  if (schemaReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS word_of_day_checkins (
      actor_id BIGINT UNSIGNED NOT NULL,
      day DATE NOT NULL,
      title_id VARCHAR(64) NOT NULL,
      streak INT NOT NULL DEFAULT 1,
      freeze_used TINYINT(1) NOT NULL DEFAULT 0,
      points_awarded INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (actor_id, day),
      KEY idx_wod_checkin_day (day)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.query(
    `CREATE TABLE IF NOT EXISTS word_of_day_freeze (
      actor_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      week_key VARCHAR(16) NOT NULL,
      used_count INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  await db.query(
    `ALTER TABLE word_of_day_checkins
     ADD COLUMN freeze_used TINYINT(1) NOT NULL DEFAULT 0`
  ).catch(() => {});
  schemaReady = true;
}

async function getCheckin(actorId, day) {
  const [[row]] = await db.query(
    `SELECT actor_id AS actorId, day, title_id AS titleId, streak,
            freeze_used AS freezeUsed, points_awarded AS pointsAwarded, created_at AS createdAt
     FROM word_of_day_checkins
     WHERE actor_id = ? AND day = ?
     LIMIT 1`,
    [actorId, day]
  );
  return row || null;
}

async function getCheckinAny(actorIds, day) {
  const ids = [...new Set((actorIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return null;
  if (ids.length === 1) return getCheckin(ids[0], day);
  const ph = ids.map(() => '?').join(',');
  const [[row]] = await db.query(
    `SELECT actor_id AS actorId, day, title_id AS titleId, streak,
            freeze_used AS freezeUsed, points_awarded AS pointsAwarded, created_at AS createdAt
     FROM word_of_day_checkins
     WHERE actor_id IN (${ph}) AND day = ?
     ORDER BY streak DESC, created_at DESC
     LIMIT 1`,
    [...ids, day]
  );
  return row || null;
}

async function getLatestCheckin(actorId, day) {
  const [[row]] = await db.query(
    `SELECT actor_id AS actorId, day, title_id AS titleId, streak,
            freeze_used AS freezeUsed, points_awarded AS pointsAwarded, created_at AS createdAt
     FROM word_of_day_checkins
     WHERE actor_id = ? AND day < ?
     ORDER BY day DESC
     LIMIT 1`,
    [actorId, day]
  );
  return row || null;
}

async function getLatestCheckinAny(actorIds, day) {
  const ids = [...new Set((actorIds || []).map(Number).filter(Boolean))];
  if (!ids.length) return null;
  if (ids.length === 1) return getLatestCheckin(ids[0], day);
  const ph = ids.map(() => '?').join(',');
  const [[row]] = await db.query(
    `SELECT actor_id AS actorId, day, title_id AS titleId, streak,
            freeze_used AS freezeUsed, points_awarded AS pointsAwarded, created_at AS createdAt
     FROM word_of_day_checkins
     WHERE actor_id IN (${ph}) AND day < ?
     ORDER BY day DESC, streak DESC
     LIMIT 1`,
    [...ids, day]
  );
  return row || null;
}

async function getFreezeState(actorId, day) {
  const weekKey = weekKeyFromDay(day);
  const [[row]] = await db.query(
    `SELECT actor_id AS actorId, week_key AS weekKey, used_count AS usedCount
     FROM word_of_day_freeze
     WHERE actor_id = ?
     LIMIT 1`,
    [actorId]
  );
  if (!row) {
    await db.query(
      `INSERT INTO word_of_day_freeze (actor_id, week_key, used_count) VALUES (?, ?, 0)`,
      [actorId, weekKey]
    );
    return { weekKey, usedCount: 0, available: FREEZE_PER_WEEK };
  }
  if (String(row.weekKey) !== weekKey) {
    await db.query(`UPDATE word_of_day_freeze SET week_key = ?, used_count = 0 WHERE actor_id = ?`, [
      weekKey,
      actorId,
    ]);
    return { weekKey, usedCount: 0, available: FREEZE_PER_WEEK };
  }
  const used = Math.max(0, Number(row.usedCount) || 0);
  return { weekKey, usedCount: used, available: Math.max(0, FREEZE_PER_WEEK - used) };
}

async function markFreezeUsed(actorId) {
  await db.query(
    `UPDATE word_of_day_freeze SET used_count = used_count + 1 WHERE actor_id = ?`,
    [actorId]
  );
}

/**
 * @returns {{ day, claimedToday, streak, pointsToday, canClaim, nextPoints }}
 */
async function attachChest(actorId, streak) {
  try {
    const { getComboChestBundle } = await import('./comboChestService.js');
    return await getComboChestBundle(actorId, { streak });
  } catch {
    return { pending: [], history: [], next: null };
  }
}

export async function getWordOfDayCheckinStatus(actorId, { timezoneOffsetMinutes = 0, actorIds = null } = {}) {
  await ensureWordOfDayCheckinSchema();
  const day = localDateString(timezoneOffsetMinutes);
  const scope = (actorIds?.length ? actorIds : [actorId]).map(Number).filter(Boolean);
  const freeze = await getFreezeState(actorId, day);
  const today = await getCheckinAny(scope, day);
  if (today) {
    const streak = Number(today.streak) || 1;
    return {
      day,
      claimedToday: true,
      streak,
      pointsToday: Number(today.pointsAwarded) || 0,
      canClaim: false,
      nextPoints: 0,
      titleId: today.titleId,
      nextMilestone: nextMilestone(streak),
      milestoneToday: milestoneForStreak(streak),
      freeze: {
        available: freeze.available > 0,
        usedThisWeek: freeze.usedCount,
        totalPerWeek: FREEZE_PER_WEEK,
        weekKey: freeze.weekKey,
      },
      chest: await attachChest(actorId, streak),
    };
  }
  const yesterday = await getCheckinAny(scope, shiftDate(day, -1));
  const latest = yesterday || (await getLatestCheckinAny(scope, day));
  const latestDay = latest ? String(latest.day).slice(0, 10) : null;
  const canUseFreeze =
    Boolean(latest) && latestDay === shiftDate(day, -2) && freeze.available > 0;
  const keepsStreak = Boolean(yesterday) || canUseFreeze;
  const baseStreak = keepsStreak ? Number(latest?.streak) || 0 : 0;
  const streakIfClaim = baseStreak + 1;
  const currentStreak = keepsStreak ? baseStreak : 0;
  const milestoneIfClaim = milestoneForStreak(streakIfClaim);
  return {
    day,
    claimedToday: false,
    streak: currentStreak,
    pointsToday: 0,
    canClaim: true,
    nextPoints: pointsForStreak(streakIfClaim) + (milestoneIfClaim?.bonus || 0),
    titleId: null,
    nextMilestone: nextMilestone(currentStreak),
    milestoneOnClaim: milestoneIfClaim,
    freeze: {
      available: freeze.available > 0,
      usedThisWeek: freeze.usedCount,
      totalPerWeek: FREEZE_PER_WEEK,
      weekKey: freeze.weekKey,
      willUseOnClaim: canUseFreeze,
    },
    chest: await attachChest(actorId, currentStreak),
  };
}

/**
 * Búgingi kún sózin belgilew — ball + streak.
 */
export async function claimWordOfDay(actorId, { timezoneOffsetMinutes = 0, actorIds = null } = {}) {
  await ensureWordOfDayCheckinSchema();
  const offset = clampTzOffset(timezoneOffsetMinutes);
  const day = localDateString(offset);
  const freeze = await getFreezeState(actorId, day);
  const scope = (actorIds?.length ? actorIds : [actorId]).map(Number).filter(Boolean);

  const existing = await getCheckinAny(scope, day);
  if (existing) {
    const streak = Number(existing.streak) || 1;
    const milestone = milestoneForStreak(streak);
    const wallet = await import('./pointsService.js').then((m) => m.getWallet(actorId));
    return {
      alreadyClaimed: true,
      day,
      streak,
      points: {
        earned: 0,
        balance: wallet.balance,
        level: wallet.level,
        awardedEarlier: Number(existing.pointsAwarded) || 0,
      },
      milestone,
      nextMilestone: nextMilestone(streak),
      titleId: existing.titleId,
      freeze: {
        available: freeze.available > 0,
        usedThisWeek: freeze.usedCount,
        totalPerWeek: FREEZE_PER_WEEK,
        weekKey: freeze.weekKey,
      },
      chest: await attachChest(actorId, streak),
    };
  }

  const word = await wordService.getWordOfDay();
  if (!word?.id) throw httpError('Búginlik sóz tabılmadı', 404);

  // tzOffset firibgarligi: UTC bo‘yicha oxirgi claim dan kamida ~20 soat
  await assertUtcClaimCooldown(scope);

  const yesterday = await getCheckinAny(scope, shiftDate(day, -1));
  const latest = yesterday || (await getLatestCheckinAny(scope, day));
  const latestDay = latest ? String(latest.day).slice(0, 10) : null;
  const useFreeze = Boolean(latest) && latestDay === shiftDate(day, -2) && freeze.available > 0;
  const baseStreak = yesterday || useFreeze ? Number(latest?.streak) || 0 : 0;
  const streak = baseStreak + 1;
  const milestone = milestoneForStreak(streak);
  const amount = pointsForStreak(streak) + (milestone?.bonus || 0);

  try {
    await db.query(
      `INSERT INTO word_of_day_checkins (actor_id, day, title_id, streak, freeze_used, points_awarded)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [actorId, day, String(word.id), streak, useFreeze ? 1 : 0, amount]
    );
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return claimWordOfDay(actorId, { timezoneOffsetMinutes: offset, actorIds: scope });
    }
    throw e;
  }
  if (useFreeze) await markFreezeUsed(actorId);

  const award = await awardPoints(actorId, {
    amount,
    kind: 'word_of_day_claim',
    refId: `${actorId}:${day}`,
    meta: { titleId: word.id, soz: word.soz, streak, day, milestone, freezeUsed: useFreeze },
  });

  let unlockedChest = null;
  let chestBundle = null;
  try {
    const { maybeUnlockComboChest, getComboChestBundle } = await import('./comboChestService.js');
    unlockedChest = await maybeUnlockComboChest(actorId, { day, streak });
    chestBundle = await getComboChestBundle(actorId, { streak });
  } catch {
    unlockedChest = null;
    chestBundle = null;
  }

  try {
    const { recordEvent } = await import('./actorService.js');
    const payload = { day, titleId: word.id, streak, earned: award.amount, freezeUsed: useFreeze };
    await recordEvent(actorId, 'word_of_day_claimed', { payload });
    // Funnel alias (C-faza): check-in → o‘yin o‘tishini o‘lchash
    await recordEvent(actorId, 'checkin_done', { payload });
  } catch {
    /* optional */
  }

  return {
    alreadyClaimed: false,
    day,
    streak,
    word: { id: word.id, soz: word.soz },
    points: {
      earned: award.amount,
      balance: award.balance,
      level: award.level,
      leveledUp: Boolean(award.leveledUp),
      previousLevel: award.previousLevel ?? null,
    },
    milestone,
    nextMilestone: nextMilestone(streak),
    freeze: {
      available: Math.max(0, freeze.available - (useFreeze ? 1 : 0)) > 0,
      usedThisWeek: freeze.usedCount + (useFreeze ? 1 : 0),
      totalPerWeek: FREEZE_PER_WEEK,
      weekKey: freeze.weekKey,
      usedNow: useFreeze,
    },
    unlockedChest,
    chest: chestBundle || (await attachChest(actorId, streak)),
    titleId: word.id,
  };
}
