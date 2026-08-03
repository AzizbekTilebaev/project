/**
 * Testlarni (quiz) admin boshqaruvi. Uy bazasi: kk_quiz.
 * Savollar options JSON massiv, correct_answer variant matni bilan saqlanadi.
 */
import { pools } from '../config/db.js';

const db = pools.quiz;
let publishedColumnReady = false;

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export async function ensurePublishedColumn() {
  if (publishedColumnReady) return;
  try {
    await db.query(
      `ALTER TABLE quizzes
       ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order`
    );
  } catch (err) {
    if (err?.code !== 'ER_DUP_FIELDNAME' && err?.errno !== 1060) {
      const msg = String(err?.message || '');
      if (!/Duplicate column/i.test(msg)) throw err;
    }
  }
  publishedColumnReady = true;
}

function parseOptions(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function validateQuizMeta({ title, level, category, timeMode, timeLimitSeconds }) {
  const cleanTitle = String(title || '').trim();
  if (cleanTitle.length < 3) throw httpError('Test atı keminde 3 belgiden ibarat bolıwı kerek');
  const mode = timeMode === 'timed' ? 'timed' : 'untimed';
  let limit = null;
  if (mode === 'timed') {
    limit = Number.parseInt(timeLimitSeconds, 10);
    if (!Number.isInteger(limit) || limit < 30 || limit > 3600) {
      throw httpError('Waqıtlı test ushın ulıwma waqıt 30–3600 sekund aralıǵında bolıwı kerek');
    }
  }
  return {
    title: cleanTitle,
    level: String(level || '').trim().slice(0, 32) || null,
    category: String(category || '').trim().slice(0, 64) || null,
    timeMode: mode,
    timeLimitSeconds: limit,
  };
}

function validateQuestion({ question, options, correctIndex, timeLimitSeconds }, timeMode) {
  const cleanQuestion = String(question || '').trim();
  if (cleanQuestion.length < 3) throw httpError('Soraw teksti keminde 3 belgiden ibarat bolıwı kerek');
  const cleanOptions = (Array.isArray(options) ? options : [])
    .map((option) => String(option || '').trim())
    .filter(Boolean);
  if (cleanOptions.length < 2 || cleanOptions.length > 6) {
    throw httpError('Hár sorawda 2–6 variant bolıwı kerek');
  }
  if (new Set(cleanOptions).size !== cleanOptions.length) {
    throw httpError('Variantlar qaytalanbawı kerek');
  }
  const idx = Number.parseInt(correctIndex, 10);
  if (!Number.isInteger(idx) || idx < 0 || idx >= cleanOptions.length) {
    throw httpError('Durıs variant indeksi nadurıs');
  }
  let perQuestion = null;
  if (timeLimitSeconds != null && timeLimitSeconds !== '') {
    perQuestion = Number.parseInt(timeLimitSeconds, 10);
    if (!Number.isInteger(perQuestion) || perQuestion < 5 || perQuestion > 600) {
      throw httpError('Soraw waqtı 5–600 sekund aralıǵında bolıwı kerek');
    }
  }
  if (timeMode === 'timed' && !perQuestion) {
    throw httpError('Waqıtlı testte hár soraw ushın waqıt shegi kerek');
  }
  return {
    question: cleanQuestion,
    options: cleanOptions,
    correctAnswer: cleanOptions[idx],
    timeLimitSeconds: perQuestion,
  };
}

function parseSortOrder(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 0 || n > 100000) {
    throw httpError('sortOrder 0–100000 aralıǵında bolıwı kerek');
  }
  return n;
}

function parsePublished(raw, fallback = true) {
  if (raw === undefined) return fallback;
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true;
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false;
  return fallback;
}

export async function listQuizzesAdmin({
  q = '',
  level = '',
  category = '',
  published = '',
  page = 1,
  limit = 50,
} = {}) {
  await ensurePublishedColumn();
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  const where = [];
  const params = [];

  const needle = String(q || '').trim().slice(0, 80);
  if (needle) {
    where.push('(q.id LIKE ? OR q.title LIKE ? OR q.description LIKE ? OR q.category LIKE ?)');
    const like = `%${needle}%`;
    params.push(like, like, like, like);
  }
  if (level) {
    where.push('q.level = ?');
    params.push(String(level).trim().slice(0, 32));
  }
  if (category) {
    where.push('q.category LIKE ?');
    params.push(`%${String(category).trim().slice(0, 64)}%`);
  }
  if (published === '1' || published === 'true') {
    where.push('q.is_published = 1');
  } else if (published === '0' || published === 'false') {
    where.push('q.is_published = 0');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM quizzes q ${whereSql}`,
    params
  );
  const [rows] = await db.query(
    `SELECT q.id, q.title, q.description, q.level, q.category,
            q.time_mode AS timeMode, q.time_limit_seconds AS timeLimitSeconds,
            q.sort_order AS sortOrder, q.is_published AS isPublished,
            q.created_at AS createdAt,
            COUNT(qq.id) AS questionCount,
            (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id = q.id) AS attemptCount
     FROM quizzes q
     LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
     ${whereSql}
     GROUP BY q.id
     ORDER BY q.sort_order, q.id
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset]
  );
  return {
    items: rows.map((row) => ({
      ...row,
      isPublished: Boolean(Number(row.isPublished)),
      questionCount: Number(row.questionCount) || 0,
      attemptCount: Number(row.attemptCount) || 0,
    })),
    total: Number(total) || 0,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil((Number(total) || 0) / safeLimit)),
  };
}

export async function getQuizAdmin(quizId) {
  await ensurePublishedColumn();
  const [[quiz]] = await db.query(
    `SELECT id, title, description, level, category,
            time_mode AS timeMode, time_limit_seconds AS timeLimitSeconds,
            sort_order AS sortOrder, is_published AS isPublished
     FROM quizzes WHERE id = ?`,
    [String(quizId)]
  );
  if (!quiz) return null;
  const [questions] = await db.query(
    `SELECT id, question, options, correct_answer AS correctAnswer,
            time_limit_seconds AS timeLimitSeconds, sort_order AS sortOrder
     FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id`,
    [quiz.id]
  );
  const [[{ attemptCount }]] = await db.query(
    'SELECT COUNT(*) AS attemptCount FROM quiz_attempts WHERE quiz_id = ?',
    [quiz.id]
  );
  return {
    ...quiz,
    isPublished: Boolean(Number(quiz.isPublished)),
    attemptCount: Number(attemptCount) || 0,
    questions: questions.map((q) => {
      const options = parseOptions(q.options);
      return {
        id: q.id,
        question: q.question,
        options,
        correctIndex: options.findIndex((option) => option === q.correctAnswer),
        timeLimitSeconds: q.timeLimitSeconds,
        sortOrder: q.sortOrder,
      };
    }),
  };
}

export async function createQuizAdmin(payload) {
  await ensurePublishedColumn();
  const meta = validateQuizMeta(payload || {});
  const questions = payload?.questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > 100) {
    throw httpError('Testte 1–100 soraw bolıwı kerek');
  }
  const validated = questions.map((q) => validateQuestion(q, meta.timeMode));

  const requestedId = String(payload?.id || '').trim().toLowerCase();
  if (requestedId && !/^[a-z0-9-]{1,32}$/.test(requestedId)) {
    throw httpError('Test ID tek hárip, san hám defisten ibarat bolıwı kerek');
  }
  const id = requestedId || `q${Date.now().toString(36)}`;

  const [[existing]] = await db.query('SELECT id FROM quizzes WHERE id = ?', [id]);
  if (existing) throw httpError('Bul ID menen test aldınnan bar', 409);

  const [[{ maxSort }]] = await db.query(
    'SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM quizzes'
  );
  const sortOrder = parseSortOrder(payload?.sortOrder, Number(maxSort) + 1);
  const isPublished = parsePublished(payload?.isPublished, true);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO quizzes
         (id, title, description, level, category, time_mode, time_limit_seconds, sort_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        meta.title,
        String(payload?.description || '').trim() || null,
        meta.level,
        meta.category,
        meta.timeMode,
        meta.timeLimitSeconds,
        sortOrder,
        isPublished ? 1 : 0,
      ]
    );
    for (let i = 0; i < validated.length; i++) {
      const q = validated[i];
      await conn.query(
        `INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, time_limit_seconds, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, q.question, JSON.stringify(q.options), q.correctAnswer, q.timeLimitSeconds, i]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getQuizAdmin(id);
}

export async function updateQuizAdmin(quizId, payload) {
  await ensurePublishedColumn();
  const existing = await getQuizAdmin(quizId);
  if (!existing) throw httpError('Test tabılmadı', 404);

  const meta = validateQuizMeta({ ...existing, ...payload });
  const questions = payload?.questions;
  if (questions !== undefined) {
    if (!Array.isArray(questions) || questions.length < 1 || questions.length > 100) {
      throw httpError('Testte 1–100 soraw bolıwı kerek');
    }
  }
  const validated = questions ? questions.map((q) => validateQuestion(q, meta.timeMode)) : null;
  const sortOrder = parseSortOrder(
    payload?.sortOrder !== undefined ? payload.sortOrder : existing.sortOrder,
    existing.sortOrder ?? 0
  );
  const isPublished = parsePublished(
    payload?.isPublished !== undefined ? payload.isPublished : existing.isPublished,
    existing.isPublished !== false
  );

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE quizzes
       SET title = ?, description = ?, level = ?, category = ?, time_mode = ?,
           time_limit_seconds = ?, sort_order = ?, is_published = ?
       WHERE id = ?`,
      [
        meta.title,
        payload?.description !== undefined
          ? String(payload.description || '').trim() || null
          : existing.description,
        meta.level,
        meta.category,
        meta.timeMode,
        meta.timeLimitSeconds,
        sortOrder,
        isPublished ? 1 : 0,
        existing.id,
      ]
    );
    if (validated) {
      const [[{ attempts }]] = await conn.query(
        `SELECT COUNT(*) AS attempts FROM quiz_attempts WHERE quiz_id = ?`,
        [existing.id]
      );
      if (Number(attempts) > 0) {
        throw httpError(
          'Bul testte urınıwlar bar — meta/nashr/tártip ózgertiliwi múmkin, biraq sorawlardı ózgertip bolmaydı',
          409
        );
      }
      await conn.query('DELETE FROM quiz_questions WHERE quiz_id = ?', [existing.id]);
      for (let i = 0; i < validated.length; i++) {
        const q = validated[i];
        await conn.query(
          `INSERT INTO quiz_questions (quiz_id, question, options, correct_answer, time_limit_seconds, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [existing.id, q.question, JSON.stringify(q.options), q.correctAnswer, q.timeLimitSeconds, i]
        );
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return getQuizAdmin(existing.id);
}

export async function deleteQuizAdmin(quizId) {
  const existing = await getQuizAdmin(quizId);
  if (!existing) throw httpError('Test tabılmadı', 404);
  const [[{ attempts }]] = await db.query(
    'SELECT COUNT(*) AS attempts FROM quiz_attempts WHERE quiz_id = ?',
    [existing.id]
  );
  await db.query('DELETE FROM quizzes WHERE id = ?', [existing.id]);
  return { deleted: true, id: existing.id, removedAttempts: Number(attempts) || 0 };
}
