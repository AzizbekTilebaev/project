/**
 * Foydalanuvchilar (anonim actorlar) boshqaruvi — admin panel uchun.
 * Uy bazasi: kk_users. Faoliyat ko‘rsatkichlari boshqa bazalardan
 * to‘liq nom bilan olinadi (kk_quiz, kk_statistika, ...).
 */
import { pools, DB } from '../config/db.js';
import { deleteActorData } from './actorService.js';
import { ensureAttemptVoidedStatus } from './quizService.js';

const db = pools.users;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/** Umumiy ko‘rsatkichlar paneli. */
export async function usersOverview() {
  const [[totals]] = await db.query(
    `SELECT
       COUNT(*) AS totalUsers,
       SUM(CASE WHEN last_seen_at >= (NOW() - INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS activeToday,
       SUM(CASE WHEN last_seen_at >= (NOW() - INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS activeWeek,
       SUM(CASE WHEN last_seen_at >= (NOW() - INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS activeMonth,
       SUM(CASE WHEN created_at >= (NOW() - INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS newWeek,
       SUM(age_consent) AS withConsent
     FROM anonymous_actors`
  );

  const [[activity]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM ${DB.quiz}.quiz_attempts) AS quizAttempts,
       (SELECT COUNT(*) FROM ${DB.statistika}.learning_events
        WHERE created_at >= (NOW() - INTERVAL 7 DAY)) AS eventsWeek,
       (SELECT COUNT(*) FROM ${DB.statistika}.book_progress) AS bookProgressRows,
       (SELECT COUNT(*) FROM ${DB.ai}.tutor_sessions) AS tutorSessions`
  );

  const [byDay] = await db.query(
    `SELECT DATE(created_at) AS day, COUNT(*) AS count
     FROM anonymous_actors
     WHERE created_at >= (NOW() - INTERVAL 30 DAY)
     GROUP BY DATE(created_at) ORDER BY day`
  );

  return {
    totals: {
      totalUsers: Number(totals.totalUsers) || 0,
      activeToday: Number(totals.activeToday) || 0,
      activeWeek: Number(totals.activeWeek) || 0,
      activeMonth: Number(totals.activeMonth) || 0,
      newWeek: Number(totals.newWeek) || 0,
      withConsent: Number(totals.withConsent) || 0,
    },
    activity: {
      quizAttempts: Number(activity.quizAttempts) || 0,
      eventsWeek: Number(activity.eventsWeek) || 0,
      bookProgressRows: Number(activity.bookProgressRows) || 0,
      tutorSessions: Number(activity.tutorSessions) || 0,
    },
    signupsByDay: byDay.map((r) => ({ day: r.day, count: Number(r.count) })),
  };
}

/**
 * Foydalanuvchilar ro‘yxati (sahifalangan) — faoliyat ko‘rsatkichlari bilan.
 * @param {object} opts { page, limit, activeDays, sort, q }
 */
export async function listUsers({
  page = 1,
  limit = 25,
  activeDays = null,
  sort = 'last_seen',
  q = '',
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const where = [];
  const params = [];
  const days = Number(activeDays);
  if (Number.isInteger(days) && days > 0 && days <= 365) {
    where.push(`a.last_seen_at >= (NOW() - INTERVAL ? DAY)`);
    params.push(days);
  }
  const needle = String(q || '').trim();
  if (needle) {
    if (/^\d+$/.test(needle)) {
      where.push('a.id = ?');
      params.push(Number(needle));
    } else {
      where.push('a.actor_key LIKE ?');
      params.push(`%${needle.slice(0, 64)}%`);
    }
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const orderSql =
    sort === 'created'
      ? 'a.created_at DESC'
      : sort === 'attempts'
        ? 'quizAttempts DESC'
        : 'a.last_seen_at DESC';

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM anonymous_actors a ${whereSql}`,
    params
  );

  const [rows] = await db.query(
    `SELECT
       a.id,
       a.actor_key AS actorKey,
       a.age_years AS ageYears,
       a.age_consent AS ageConsent,
       a.created_at AS createdAt,
       a.last_seen_at AS lastSeenAt,
       (SELECT COUNT(*) FROM ${DB.quiz}.quiz_attempts qa WHERE qa.actor_id = a.id) AS quizAttempts,
       (SELECT COUNT(*) FROM ${DB.statistika}.learning_events le WHERE le.actor_id = a.id) AS events,
       (SELECT COUNT(*) FROM ${DB.statistika}.book_progress bp WHERE bp.actor_id = a.id) AS booksInProgress,
       (SELECT COUNT(*) FROM ${DB.krasvord}.crossword_stats cs WHERE cs.actor_id = a.id) AS crosswordsDone,
       (SELECT COUNT(*) FROM ${DB.ai}.mistake_bank mb WHERE mb.actor_id = a.id) AS mistakes
     FROM anonymous_actors a
     ${whereSql}
     ORDER BY ${orderSql}
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  const totalNum = Number(total) || 0;
  return {
    users: rows.map((r) => ({
      ...r,
      ageConsent: Boolean(r.ageConsent),
      quizAttempts: Number(r.quizAttempts),
      events: Number(r.events),
      booksInProgress: Number(r.booksInProgress),
      crosswordsDone: Number(r.crosswordsDone),
      mistakes: Number(r.mistakes),
    })),
    total: totalNum,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(totalNum / safeLimit)),
  };
}

const ATTEMPT_STATUSES = new Set([
  'in_progress',
  'completed',
  'partial',
  'expired',
  'voided',
]);

/**
 * Global quiz urinishlari — admin integrity browser.
 * @param {object} opts
 */
export async function listQuizAttemptsAdmin({
  page = 1,
  limit = 25,
  status = '',
  quizId = '',
  actorId = '',
  q = '',
  from = '',
  to = '',
} = {}) {
  await ensureAttemptVoidedStatus();
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const where = [];
  const params = [];

  const st = String(status || '').trim();
  if (st && ATTEMPT_STATUSES.has(st)) {
    where.push('a.status = ?');
    params.push(st);
  }

  const quiz = String(quizId || '').trim().slice(0, 32);
  if (quiz) {
    where.push('a.quiz_id = ?');
    params.push(quiz);
  }

  const actor = Number(actorId);
  if (Number.isInteger(actor) && actor > 0) {
    where.push('a.actor_id = ?');
    params.push(actor);
  }

  const needle = String(q || '').trim().slice(0, 80);
  if (needle) {
    where.push('(a.quiz_id LIKE ? OR q.title LIKE ? OR a.id LIKE ?)');
    const like = `%${needle}%`;
    params.push(like, like, like);
  }

  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) {
      where.push('a.started_at >= ?');
      params.push(d);
    }
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      where.push('a.started_at <= ?');
      params.push(d);
    }
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const joinQuizzes = `LEFT JOIN ${DB.quiz}.quizzes q ON q.id = a.quiz_id`;

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM ${DB.quiz}.quiz_attempts a
     ${joinQuizzes}
     ${whereSql}`,
    params
  );

  const [rows] = await db.query(
    `SELECT
       a.id,
       a.quiz_id AS quizId,
       q.title AS title,
       a.actor_id AS actorId,
       a.status,
       a.score,
       a.total,
       a.started_at AS startedAt,
       a.completed_at AS completedAt,
       (SELECT COUNT(*) FROM ${DB.quiz}.quiz_attempt_questions aq
         WHERE aq.attempt_id = a.id AND aq.selected_option_index IS NOT NULL) AS answeredCount,
       (SELECT COUNT(*) FROM ${DB.quiz}.quiz_attempt_questions aq
         WHERE aq.attempt_id = a.id AND aq.viewed = 1) AS viewedCount,
       (SELECT COALESCE(SUM(aq.time_spent_ms), 0) FROM ${DB.quiz}.quiz_attempt_questions aq
         WHERE aq.attempt_id = a.id) AS totalTimeMs
     FROM ${DB.quiz}.quiz_attempts a
     ${joinQuizzes}
     ${whereSql}
     ORDER BY a.started_at DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  const totalNum = Number(total) || 0;
  return {
    items: rows.map((r) => {
      const answeredCount = Number(r.answeredCount) || 0;
      const viewedCount = Number(r.viewedCount) || 0;
      const totalQ = Number(r.total) || 0;
      const totalTimeMs = Number(r.totalTimeMs) || 0;
      const unanswered = Math.max(0, totalQ - answeredCount);
      const flags = [];
      if (
        r.status === 'completed' &&
        r.score != null &&
        totalQ > 0 &&
        Number(r.score) === totalQ &&
        totalTimeMs > 0 &&
        totalTimeMs < totalQ * 1500
      ) {
        flags.push('low_time_perfect');
      }
      if (unanswered >= Math.max(2, Math.ceil(totalQ * 0.3))) {
        flags.push('many_unanswered');
      }
      if (r.status === 'in_progress') flags.push('in_progress');
      if (r.status === 'voided') flags.push('voided');
      return {
        id: r.id,
        quizId: r.quizId,
        title: r.title || r.quizId,
        actorId: r.actorId,
        status: r.status,
        score: r.score,
        total: totalQ || null,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        answeredCount,
        viewedCount,
        totalTimeMs,
        flags,
      };
    }),
    total: totalNum,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(totalNum / safeLimit)),
  };
}

/** Bitta foydalanuvchi detali: profil + faoliyat tafsiloti. */
export async function getUserDetail(id) {
  const actorId = Number(id);
  if (!Number.isInteger(actorId) || actorId <= 0) throw httpError('ID nadurıs');

  const [[actor]] = await db.query(
    `SELECT id, actor_key AS actorKey, age_years AS ageYears, age_consent AS ageConsent,
            created_at AS createdAt, last_seen_at AS lastSeenAt
     FROM anonymous_actors WHERE id = ? LIMIT 1`,
    [actorId]
  );
  if (!actor) throw httpError('Paydalanıwshı tabılmadı', 404);

  const [attempts] = await db.query(
    `SELECT qa.id, qa.quiz_id AS quizId, qa.status, qa.score, qa.total,
            qa.started_at AS startedAt, qa.completed_at AS completedAt
     FROM ${DB.quiz}.quiz_attempts qa
     WHERE qa.actor_id = ?
     ORDER BY qa.started_at DESC LIMIT 20`,
    [actorId]
  );

  const [events] = await db.query(
    `SELECT event_type AS eventType, COUNT(*) AS count, MAX(created_at) AS lastAt
     FROM ${DB.statistika}.learning_events
     WHERE actor_id = ?
     GROUP BY event_type ORDER BY count DESC`,
    [actorId]
  );

  const [ability] = await db.query(
    `SELECT skill, theta, theta_se AS thetaSe, attempts, updated_at AS updatedAt
     FROM ${DB.statistika}.actor_ability WHERE actor_id = ?`,
    [actorId]
  );

  const [books] = await db.query(
    `SELECT bp.book_id AS bookId, bp.percent, bp.updated_at AS updatedAt
     FROM ${DB.statistika}.book_progress bp
     WHERE bp.actor_id = ? ORDER BY bp.updated_at DESC LIMIT 10`,
    [actorId]
  );

  const [[mistakeStats]] = await db.query(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN box >= 4 THEN 1 ELSE 0 END) AS mastered
     FROM ${DB.ai}.mistake_bank WHERE actor_id = ?`,
    [actorId]
  );

  return {
    user: { ...actor, ageConsent: Boolean(actor.ageConsent) },
    quizAttempts: attempts,
    eventSummary: events.map((e) => ({ ...e, count: Number(e.count) })),
    ability,
    bookProgress: books,
    mistakes: {
      total: Number(mistakeStats?.total) || 0,
      mastered: Number(mistakeStats?.mastered) || 0,
    },
  };
}

/** Foydalanuvchi va unga tegishli barcha ma’lumotni o‘chirish (GDPR). */
export async function deleteUser(id) {
  const actorId = Number(id);
  if (!Number.isInteger(actorId) || actorId <= 0) throw httpError('ID nadurıs');
  const [[actor]] = await db.query(`SELECT id FROM anonymous_actors WHERE id = ? LIMIT 1`, [
    actorId,
  ]);
  if (!actor) throw httpError('Paydalanıwshı tabılmadı', 404);
  return deleteActorData(actorId);
}
