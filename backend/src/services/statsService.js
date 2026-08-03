import { pools, DB } from '../config/db.js';
import { recordEvent } from './actorService.js';

const users = pools.users;
const stat = pools.statistika;

const PERIOD_DAYS = {
  day: 1,
  week: 7,
  '15d': 15,
  month: 30,
};

function isoDay(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function shiftIsoDay(day, delta) {
  const d = new Date(`${day}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function computeActivityStreak(heatmap) {
  const activeDays = [...new Set((heatmap || []).filter((r) => Number(r.count) > 0).map((r) => isoDay(r.day)))].sort();
  if (!activeDays.length) return { current: 0, best: 0, lastActiveDay: null };

  let best = 1;
  let run = 1;
  for (let i = 1; i < activeDays.length; i++) {
    if (activeDays[i] === shiftIsoDay(activeDays[i - 1], 1)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  const lastActiveDay = activeDays[activeDays.length - 1];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = shiftIsoDay(today, -1);
  let current = 0;
  if (lastActiveDay === today || lastActiveDay === yesterday) {
    current = 1;
    for (let i = activeDays.length - 1; i > 0; i--) {
      if (activeDays[i] === shiftIsoDay(activeDays[i - 1], 1)) current += 1;
      else break;
    }
  }

  return { current, best, lastActiveDay };
}

export function periodToDays(period) {
  return PERIOD_DAYS[period] || 7;
}

export async function ensureStatsSchema() {
  await stat
    .query(
      `CREATE TABLE IF NOT EXISTS actor_time_spent (
        actor_id BIGINT UNSIGNED NOT NULL,
        surface VARCHAR(32) NOT NULL,
        day DATE NOT NULL,
        duration_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (actor_id, surface, day),
        KEY idx_time_day (day)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    )
    .catch(() => {});
  await stat
    .query(
      `CREATE TABLE IF NOT EXISTS exit_feedback (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        actor_id BIGINT UNSIGNED NULL,
        user_id BIGINT UNSIGNED NULL,
        helpful TINYINT(1) NOT NULL,
        note VARCHAR(500) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_exit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    )
    .catch(() => {});
}

export async function recordHeartbeat(actorId, { surface = 'app', durationMs = 30000 } = {}) {
  await ensureStatsSchema();
  const ms = Math.min(120000, Math.max(1000, Number(durationMs) || 30000));
  const surf = String(surface || 'app').slice(0, 32);
  await stat.query(
    `INSERT INTO actor_time_spent (actor_id, surface, day, duration_ms)
     VALUES (?, ?, CURDATE(), ?)
     ON DUPLICATE KEY UPDATE duration_ms = duration_ms + VALUES(duration_ms)`,
    [actorId, surf, ms]
  );
  await recordEvent(actorId, 'session_heartbeat', {
    payload: { product: surf, timeSpentMs: ms },
  });
}

export async function getMyActivity(actorIds, { days = 90, period = 'week' } = {}) {
  await ensureStatsSchema();
  const ids = (Array.isArray(actorIds) ? actorIds : [actorIds])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) {
    return {
      period,
      periodDays: periodToDays(period),
      heatmap: [],
      timeSpent: {
        totalMs: 0,
        bySurface: {},
        quizMs: 0,
        dictionaryMs: 0,
        crosswordMs: 0,
        literatureMs: 0,
        tutorMs: 0,
        immersionMs: 0,
        jumbaqMs: 0,
      },
      quiz: { completes: 0 },
      crossword: { completes: 0 },
      review: {
        activeDays: 0,
        wordViews: 0,
        dictGames: 0,
        quizCompletes: 0,
        crosswordCompletes: 0,
        totalMs: 0,
      },
    };
  }

  const heatDays = Math.min(180, Math.max(7, Number(days) || 90));
  const periodDays = periodToDays(period);
  const placeholders = ids.map(() => '?').join(',');

  const [heat] = await users.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM ${DB.statistika}.learning_events
     WHERE actor_id IN (${placeholders}) AND created_at >= (CURDATE() - INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [...ids, heatDays]
  );

  const [timeRows] = await stat.query(
    `SELECT surface, SUM(duration_ms) AS durationMs
     FROM actor_time_spent
     WHERE actor_id IN (${placeholders}) AND day >= (CURDATE() - INTERVAL ? DAY)
     GROUP BY surface`,
    [...ids, periodDays]
  );

  const [quizRows] = await users.query(
    `SELECT COUNT(*) AS completes,
            COALESCE(SUM(JSON_EXTRACT(payload_json, '$.score')), 0) AS scoreSum
     FROM ${DB.statistika}.learning_events
     WHERE actor_id IN (${placeholders})
       AND event_type IN ('quiz_completed','quiz_partial_completed')
       AND created_at >= (NOW() - INTERVAL ? DAY)`,
    [...ids, periodDays]
  );

  const [wordViewRows] = await users.query(
    `SELECT COUNT(*) AS n
     FROM ${DB.statistika}.learning_events
     WHERE actor_id IN (${placeholders})
       AND event_type = 'word_viewed'
       AND created_at >= (NOW() - INTERVAL ? DAY)`,
    [...ids, periodDays]
  );

  const [dictGameRows] = await users.query(
    `SELECT COUNT(*) AS n
     FROM ${DB.statistika}.learning_events
     WHERE actor_id IN (${placeholders})
       AND event_type = 'dict_game_completed'
       AND created_at >= (NOW() - INTERVAL ? DAY)`,
    [...ids, periodDays]
  );

  let crosswordCount = 0;
  try {
    const [cw] = await users.query(
      `SELECT COUNT(*) AS n FROM ${DB.krasvord}.crossword_stats
       WHERE actor_id IN (${placeholders}) AND created_at >= (NOW() - INTERVAL ? DAY)`,
      [...ids, periodDays]
    );
    crosswordCount = Number(cw[0]?.n) || 0;
  } catch {
    crosswordCount = 0;
  }

  const timeBySurface = {};
  let totalMs = 0;
  for (const row of timeRows) {
    const ms = Number(row.durationMs) || 0;
    timeBySurface[row.surface] = ms;
    totalMs += ms;
  }

  const heatmap = (heat || []).map((r) => ({
    day: isoDay(r.day),
    count: Number(r.count) || 0,
  }));
  const streak = computeActivityStreak(heatmap);

  const periodStart = shiftIsoDay(new Date().toISOString().slice(0, 10), -(periodDays - 1));
  const activeDaysInPeriod = heatmap.filter(
    (d) => d.day >= periodStart && Number(d.count) > 0
  ).length;

  return {
    period,
    periodDays,
    heatmap,
    streak,
    review: {
      activeDays: activeDaysInPeriod,
      wordViews: Number(wordViewRows[0]?.n) || 0,
      dictGames: Number(dictGameRows[0]?.n) || 0,
      quizCompletes: Number(quizRows[0]?.completes) || 0,
      crosswordCompletes: crosswordCount,
      totalMs,
    },
    timeSpent: {
      totalMs,
      bySurface: timeBySurface,
      quizMs: timeBySurface.quiz || 0,
      dictionaryMs: timeBySurface.dictionary || 0,
      crosswordMs: timeBySurface.crossword || 0,
      literatureMs: timeBySurface.literature || 0,
      tutorMs: timeBySurface.tutor || 0,
      immersionMs: timeBySurface.immersion || 0,
      jumbaqMs: timeBySurface.jumbaq || 0,
    },
    quiz: {
      completes: Number(quizRows[0]?.completes) || 0,
    },
    crossword: {
      completes: crosswordCount,
    },
  };
}

export async function getSiteStats({ period = 'week' } = {}) {
  await ensureStatsSchema();
  const periodDays = periodToDays(period);

  const [[active]] = await users.query(
    `SELECT COUNT(DISTINCT actor_id) AS actors,
            COUNT(*) AS events
     FROM ${DB.statistika}.learning_events
     WHERE created_at >= (NOW() - INTERVAL ? DAY)`,
    [periodDays]
  );

  const [[today]] = await users.query(
    `SELECT COUNT(DISTINCT actor_id) AS actors
     FROM ${DB.statistika}.learning_events
     WHERE created_at >= CURDATE()`
  );

  let helpful = 0;
  let totalFeedback = 0;
  try {
    const [[fb]] = await stat.query(
      `SELECT
         SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) AS helpful,
         COUNT(*) AS total
       FROM exit_feedback
       WHERE created_at >= (NOW() - INTERVAL ? DAY)`,
      [periodDays]
    );
    helpful = Number(fb?.helpful) || 0;
    totalFeedback = Number(fb?.total) || 0;
  } catch {
    /* ignore */
  }

  return {
    period,
    periodDays,
    activeActors: Number(active?.actors) || 0,
    events: Number(active?.events) || 0,
    todayActors: Number(today?.actors) || 0,
    exitFeedback: {
      helpful,
      total: totalFeedback,
      helpfulRate: totalFeedback ? Math.round((helpful / totalFeedback) * 100) : null,
    },
  };
}

export async function saveExitFeedback({ actorId = null, userId = null, helpful, note = '' }) {
  await ensureStatsSchema();
  await stat.query(
    `INSERT INTO exit_feedback (actor_id, user_id, helpful, note) VALUES (?, ?, ?, ?)`,
    [actorId, userId, helpful ? 1 : 0, String(note || '').slice(0, 500) || null]
  );
  if (actorId) {
    await recordEvent(actorId, 'exit_feedback', {
      payload: { product: helpful ? 'helpful' : 'not_helpful' },
    });
  }
  return { ok: true };
}

/**
 * Admin inbox: exit survey juwapları.
 */
export async function listExitFeedback({
  helpful = '',
  page = 1,
  limit = 40,
  days = 30,
} = {}) {
  await ensureStatsSchema();
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 40));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  const periodDays = Math.min(365, Math.max(1, Number(days) || 30));

  const where = ['created_at >= (NOW() - INTERVAL ? DAY)'];
  const params = [periodDays];

  if (helpful === '1' || helpful === 'true' || helpful === true) {
    where.push('helpful = 1');
  } else if (helpful === '0' || helpful === 'false' || helpful === false) {
    where.push('helpful = 0');
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [[{ total }]] = await stat.query(
    `SELECT COUNT(*) AS total FROM exit_feedback ${whereSql}`,
    params
  );

  const [[summary]] = await stat.query(
    `SELECT
       SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) AS helpful,
       COUNT(*) AS total
     FROM exit_feedback
     WHERE created_at >= (NOW() - INTERVAL ? DAY)`,
    [periodDays]
  );

  const [rows] = await stat.query(
    `SELECT id, actor_id AS actorId, user_id AS userId, helpful, note, created_at AS createdAt
     FROM exit_feedback
     ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  const helpfulN = Number(summary?.helpful) || 0;
  const totalN = Number(summary?.total) || 0;

  return {
    items: rows.map((r) => ({
      id: Number(r.id),
      actorId: r.actorId != null ? Number(r.actorId) : null,
      userId: r.userId != null ? Number(r.userId) : null,
      helpful: Boolean(Number(r.helpful)),
      note: r.note || '',
      createdAt: r.createdAt,
    })),
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil((Number(total) || 0) / safeLimit)),
    days: periodDays,
    summary: {
      helpful: helpfulN,
      total: totalN,
      helpfulRate: totalN ? Math.round((helpfulN / totalN) * 100) : null,
    },
  };
}
