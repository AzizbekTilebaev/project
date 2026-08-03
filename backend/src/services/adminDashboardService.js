import { DB, pools } from '../config/db.js';

const DATABASES = Object.entries(DB);

function positiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function getAdminDashboard() {
  const databaseNames = DATABASES.map(([, name]) => name);
  const placeholders = databaseNames.map(() => '?').join(',');

  const [tableRows] = await pools.users.query(
    `SELECT TABLE_SCHEMA AS databaseName, TABLE_NAME AS tableName,
            TABLE_ROWS AS estimatedRows,
            DATA_LENGTH + INDEX_LENGTH AS sizeBytes
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA IN (${placeholders})
     ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    databaseNames
  );

  const healthEntries = await Promise.all(
    DATABASES.map(async ([key, name]) => {
      const startedAt = Date.now();
      try {
        await pools[key].query('SELECT 1');
        return [key, { key, name, healthy: true, latencyMs: Date.now() - startedAt }];
      } catch (error) {
        return [
          key,
          {
            key,
            name,
            healthy: false,
            latencyMs: Date.now() - startedAt,
            error: error.message,
          },
        ];
      }
    })
  );
  const health = Object.fromEntries(healthEntries);

  const grouped = DATABASES.map(([key, name]) => {
    const tables = tableRows
      .filter((row) => row.databaseName === name)
      .map((row) => ({
        name: row.tableName,
        estimatedRows: Number(row.estimatedRows) || 0,
        sizeBytes: Number(row.sizeBytes) || 0,
      }));
    return {
      ...health[key],
      tableCount: tables.length,
      estimatedRows: tables.reduce((sum, table) => sum + table.estimatedRows, 0),
      sizeBytes: tables.reduce((sum, table) => sum + table.sizeBytes, 0),
      tables,
    };
  });

  const [[users]] = await pools.users.query(
    `SELECT COUNT(*) AS total,
            SUM(last_seen_at >= NOW() - INTERVAL 1 DAY) AS activeToday,
            SUM(last_seen_at >= NOW() - INTERVAL 7 DAY) AS activeWeek
     FROM anonymous_actors`
  );
  const [[attempts]] = await pools.quiz.query(
    `SELECT COUNT(*) AS total,
            SUM(status IN ('completed','partial')) AS completed
     FROM quiz_attempts`
  );
  const [[errors]] = await pools.logs.query(
    `SELECT COUNT(*) AS total,
            SUM(created_at >= NOW() - INTERVAL 24 HOUR) AS last24Hours
     FROM app_errors`
  );
  const [[wallets]] = await pools.statistika.query(
    `SELECT COALESCE(SUM(total_earned), 0) AS pointsEarned,
            COALESCE(SUM(total_spent), 0) AS pointsSpent
     FROM actor_wallets`
  );

  let exitFeedback = { helpful: 0, total: 0, helpfulRate: null };
  try {
    const [[fb]] = await pools.statistika.query(
      `SELECT
         SUM(CASE WHEN helpful = 1 THEN 1 ELSE 0 END) AS helpful,
         COUNT(*) AS total
       FROM exit_feedback
       WHERE created_at >= (NOW() - INTERVAL 30 DAY)`
    );
    const helpful = Number(fb?.helpful) || 0;
    const total = Number(fb?.total) || 0;
    exitFeedback = {
      helpful,
      total,
      helpfulRate: total ? Math.round((helpful / total) * 100) : null,
    };
  } catch {
    /* table may be missing on fresh deploy */
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      users: Number(users.total) || 0,
      activeToday: Number(users.activeToday) || 0,
      activeWeek: Number(users.activeWeek) || 0,
      quizAttempts: Number(attempts.total) || 0,
      completedAttempts: Number(attempts.completed) || 0,
      errors: Number(errors.total) || 0,
      errorsLast24Hours: Number(errors.last24Hours) || 0,
      pointsEarned: Number(wallets.pointsEarned) || 0,
      pointsSpent: Number(wallets.pointsSpent) || 0,
      healthyDatabases: grouped.filter((item) => item.healthy).length,
      databaseCount: grouped.length,
      exitFeedbackHelpful: exitFeedback.helpful,
      exitFeedbackTotal: exitFeedback.total,
      exitFeedbackRate: exitFeedback.helpfulRate,
    },
    exitFeedback,
    databases: grouped,
  };
}

export async function listAppErrors({ page, limit, level, search } = {}) {
  const safePage = positiveInt(page, 1, 100000);
  const safeLimit = positiveInt(limit, 25, 100);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];

  if (['error', 'warn', 'info'].includes(level)) {
    where.push('level = ?');
    params.push(level);
  }
  const cleanSearch = String(search || '').trim().slice(0, 200);
  if (cleanSearch) {
    where.push('(message LIKE ? OR path LIKE ? OR source LIKE ?)');
    const pattern = `%${cleanSearch}%`;
    params.push(pattern, pattern, pattern);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [[{ total }]] = await pools.logs.query(
    `SELECT COUNT(*) AS total FROM app_errors ${whereSql}`,
    params
  );
  const [items] = await pools.logs.query(
    `SELECT id, level, source, method, path, status_code AS statusCode,
            message, context_json AS context, created_at AS createdAt
     FROM app_errors
     ${whereSql}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );

  return {
    items: items.map((item) => ({
      ...item,
      context:
        typeof item.context === 'string'
          ? JSON.parse(item.context)
          : item.context,
    })),
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil((Number(total) || 0) / safeLimit)),
  };
}

export async function deleteAppError(id) {
  const parsed = Number.parseInt(id, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    const error = new Error('Qátelik ID-si nadurıs');
    error.statusCode = 400;
    throw error;
  }
  const [result] = await pools.logs.query('DELETE FROM app_errors WHERE id = ?', [parsed]);
  return { deleted: result.affectedRows > 0 };
}

export async function clearAppErrors({ olderThanDays } = {}) {
  const days = Math.min(Math.max(Number.parseInt(olderThanDays, 10) || 30, 1), 3650);
  const [result] = await pools.logs.query(
    'DELETE FROM app_errors WHERE created_at < NOW() - INTERVAL ? DAY',
    [days]
  );
  return { deleted: Number(result.affectedRows) || 0, olderThanDays: days };
}
