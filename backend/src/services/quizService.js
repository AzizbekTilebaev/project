import crypto from 'crypto';
import { pools, DB } from '../config/db.js';
import { recordEvent } from './actorService.js';
import {
  computeAttemptPoints,
  awardPoints,
  getWallet,
  getAwardForRef,
  revokeAwardForRef,
  isReviewUnlocked,
  reviewCost,
  unlockAnswerReview,
} from './pointsService.js';

const db = pools.quiz;
export const MIN_COHORT_SIZE = 5;
let voidedStatusReady = false;

/** quiz_attempts.status ga `voided` qiymatini qo‘shadi (idempotent). */
export async function ensureAttemptVoidedStatus() {
  if (voidedStatusReady) return;
  try {
    await db.query(
      `ALTER TABLE quiz_attempts
       MODIFY COLUMN status
       ENUM('in_progress','completed','partial','expired','voided')
       NOT NULL DEFAULT 'in_progress'`
    );
  } catch (err) {
    const [[col]] = await db
      .query(
        `SELECT COLUMN_TYPE AS t FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quiz_attempts' AND COLUMN_NAME = 'status'`
      )
      .catch(() => [[null]]);
    if (!col?.t || !String(col.t).includes('voided')) throw err;
  }
  voidedStatusReady = true;
}

export function parseOptions(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function httpError(message, statusCode = 400, extra = {}) {
  const err = new Error(message);
  err.statusCode = statusCode;
  Object.assign(err, extra || {});
  return err;
}

export async function listQuizzes() {
  const { ensurePublishedColumn } = await import('./quizAdminService.js');
  await ensurePublishedColumn();
  const [rows] = await db.query(
    `SELECT q.id, q.title, q.description, q.level, q.category,
            q.time_mode AS timeMode, q.time_limit_seconds AS timeLimitSeconds,
            COUNT(qq.id) AS questionCount
     FROM quizzes q
     LEFT JOIN quiz_questions qq ON qq.quiz_id = q.id
     WHERE q.is_published = 1
     GROUP BY q.id
     HAVING questionCount > 0
     ORDER BY q.sort_order, q.id`
  );
  return rows;
}

/** Aktor tarixı: dashboard ushın tamamlanǵan/shala urinishlar. */
export async function listAttemptsForActor(actorId, limit = 30) {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const [rows] = await db.query(
    `SELECT a.id, a.quiz_id AS quizId, a.status, a.score, a.total,
            a.started_at AS startedAt, a.completed_at AS completedAt,
            q.title, q.category, q.level
     FROM quiz_attempts a
     JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.actor_id = ? AND a.status IN ('completed','partial','expired')
     ORDER BY COALESCE(a.completed_at, a.started_at) DESC
     LIMIT ${safeLimit}`,
    [actorId]
  );
  return rows;
}

export async function loadQuestions(quizId) {
  const [rows] = await db.query(
    `SELECT id, question, options, correct_answer AS correctAnswer,
            time_limit_seconds AS timeLimitSeconds
     FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id`,
    [quizId]
  );
  return rows.map((q) => ({
    id: String(q.id),
    question: q.question,
    options: parseOptions(q.options),
    correctAnswer: q.correctAnswer,
    timeLimitSeconds: q.timeLimitSeconds,
  }));
}

export async function getQuizPublic(id) {
  const { ensurePublishedColumn } = await import('./quizAdminService.js');
  await ensurePublishedColumn();
  const [[quiz]] = await db.query(
    `SELECT id, title, description, level, category,
            time_mode AS timeMode, time_limit_seconds AS timeLimitSeconds
     FROM quizzes WHERE id = ? AND is_published = 1`,
    [id]
  );
  if (!quiz) return null;
  const questions = await loadQuestions(id);
  quiz.questions = questions.map(({ id: qid, question, options, timeLimitSeconds }) => ({
    id: qid,
    question,
    options,
    timeLimitSeconds,
  }));
  return quiz;
}

/** Legacy: aralashtirmasdan bir martalik baholash. */
export async function submitQuiz(id, answers) {
  const [[quiz]] = await db.query('SELECT id, title FROM quizzes WHERE id = ?', [id]);
  if (!quiz) return null;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw httpError('Juwaplar obyekti kerek');
  }
  const questions = await loadQuestions(id);
  if (!questions.length) throw httpError('Testte soraw joq');
  let score = 0;
  const results = questions.map((q) => {
    const raw = answers[q.id];
    let givenIndex = null;
    let given = null;
    if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw < q.options.length) {
      givenIndex = raw;
      given = q.options[raw];
    } else if (typeof raw === 'string') {
      const idx = q.options.indexOf(raw);
      if (idx >= 0) {
        givenIndex = idx;
        given = raw;
      }
    }
    const correctIndex = q.options.findIndex((o) => o === q.correctAnswer);
    const correct = givenIndex !== null && correctIndex >= 0 && givenIndex === correctIndex;
    if (correct) score += 1;
    return {
      id: q.id,
      question: q.question,
      given,
      givenIndex,
      correctAnswer: q.correctAnswer,
      correctIndex: correctIndex >= 0 ? correctIndex : null,
      correct,
    };
  });
  return {
    quizId: quiz.id,
    title: quiz.title,
    score,
    total: questions.length,
    results,
  };
}

async function loadQuizMeta(quizId) {
  const [[quiz]] = await db.query(
    `SELECT id, title, description, level, category,
            time_mode AS timeMode, time_limit_seconds AS timeLimitSeconds
     FROM quizzes WHERE id = ?`,
    [quizId]
  );
  return quiz || null;
}

function buildShuffledInstance(questions, seedStr) {
  const rng = mulberry32(seedFromString(seedStr));
  const questionIds = questions.map((q) => q.id);
  shuffleInPlace(questionIds, rng);
  const optionOrders = {};
  for (const q of questions) {
    const order = q.options.map((_, i) => i);
    shuffleInPlace(order, rng);
    optionOrders[q.id] = order;
  }
  return { questionOrder: questionIds, optionOrders };
}

function publicQuestionsFromInstance(questionsById, questionOrder, optionOrders) {
  return questionOrder.map((qid) => {
    const q = questionsById[qid];
    const order = optionOrders[qid] || q.options.map((_, i) => i);
    return {
      id: q.id,
      question: q.question,
      options: order.map((i) => q.options[i]),
      timeLimitSeconds: q.timeLimitSeconds,
    };
  });
}

async function fetchAttemptBundle(attemptId, actorId) {
  const [[attempt]] = await db.query(
    `SELECT a.id, a.instance_id AS instanceId, a.quiz_id AS quizId, a.actor_id AS actorId,
            a.status, a.current_index AS currentIndex, a.age_years AS ageYears,
            a.age_consent AS ageConsent, a.score, a.total,
            a.started_at AS startedAt, a.updated_at AS updatedAt,
            a.completed_at AS completedAt, a.total_deadline_at AS totalDeadlineAt,
            i.question_order AS questionOrder, i.option_orders AS optionOrders
     FROM quiz_attempts a
     JOIN quiz_instances i ON i.id = a.instance_id
     WHERE a.id = ? AND a.actor_id = ?`,
    [attemptId, actorId]
  );
  if (!attempt) return null;
  attempt.questionOrder =
    typeof attempt.questionOrder === 'string'
      ? JSON.parse(attempt.questionOrder)
      : attempt.questionOrder;
  attempt.optionOrders =
    typeof attempt.optionOrders === 'string'
      ? JSON.parse(attempt.optionOrders)
      : attempt.optionOrders;

  const [aqRows] = await db.query(
    `SELECT question_id AS questionId, position, viewed,
            selected_option_index AS selectedOptionIndex,
            selected_original_index AS selectedOriginalIndex,
            is_correct AS isCorrect, time_spent_ms AS timeSpentMs,
            question_started_at AS questionStartedAt,
            question_deadline_at AS questionDeadlineAt,
            answered_at AS answeredAt
     FROM quiz_attempt_questions WHERE attempt_id = ? ORDER BY position`,
    [attemptId]
  );
  return { attempt, attemptQuestions: aqRows };
}

function isPast(ts) {
  if (!ts) return false;
  return new Date(ts).getTime() <= Date.now();
}

async function expireIfNeeded(attempt) {
  if (attempt.status !== 'in_progress') return attempt;
  if (isPast(attempt.totalDeadlineAt)) {
    await db.query(
      `UPDATE quiz_attempts SET status = 'expired', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [attempt.id]
    );
    attempt.status = 'expired';
  }
  return attempt;
}

export async function startAttempt(quizId, actor, { ageConsent = false, ageYears = null } = {}) {
  const quiz = await loadQuizMeta(quizId);
  if (!quiz) return null;
  const questions = await loadQuestions(quizId);
  if (!questions.length) throw httpError('Testte soraw joq');

  if (quiz.timeMode === 'timed') {
    if (!quiz.timeLimitSeconds || quiz.timeLimitSeconds < 1) {
      throw httpError('Waqıtlı testte ulıwma waqıt shegi kerek');
    }
    for (const q of questions) {
      if (!q.timeLimitSeconds || q.timeLimitSeconds < 1) {
        throw httpError('Waqıtlı testte hár soraw ushın waqıt shegi kerek');
      }
    }
  }

  // Faol urinish bo‘lsa — resume (solo only; room attempts isolated)
  const [[existing]] = await db.query(
    `SELECT id FROM quiz_attempts
     WHERE actor_id = ? AND quiz_id = ? AND status = 'in_progress'
       AND room_id IS NULL
     ORDER BY started_at DESC LIMIT 1`,
    [actor.id, quizId]
  );
  if (existing) {
    return getAttemptState(existing.id, actor.id);
  }

  const seed = crypto.randomBytes(16).toString('hex');
  const { questionOrder, optionOrders } = buildShuffledInstance(questions, seed);
  const instanceId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();

  let consent = Boolean(ageConsent);
  let age = consent ? Number(ageYears) : null;
  if (consent) {
    if (!Number.isInteger(age) || age < 5 || age > 120) {
      throw httpError('Jas 5–120 aralıǵında bolıwı kerek');
    }
  } else {
    age = null;
  }

  const totalDeadline =
    quiz.timeMode === 'timed'
      ? new Date(Date.now() + quiz.timeLimitSeconds * 1000)
      : null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `INSERT INTO quiz_instances (id, quiz_id, question_order, option_orders, seed)
       VALUES (?, ?, ?, ?, ?)`,
      [instanceId, quizId, JSON.stringify(questionOrder), JSON.stringify(optionOrders), seed]
    );
    await conn.query(
      `INSERT INTO quiz_attempts
       (id, instance_id, quiz_id, actor_id, room_id, play_mode, status, current_index, age_years, age_consent, total, total_deadline_at)
       VALUES (?, ?, ?, ?, NULL, 'solo', 'in_progress', 0, ?, ?, ?, ?)`,
      [attemptId, instanceId, quizId, actor.id, age, consent ? 1 : 0, questions.length, totalDeadline]
    );

    for (let pos = 0; pos < questionOrder.length; pos++) {
      const qid = questionOrder[pos];
      const q = questions.find((x) => x.id === qid);
      let qDeadline = null;
      let qStarted = null;
      if (pos === 0) {
        qStarted = new Date();
        if (quiz.timeMode === 'timed' && q.timeLimitSeconds) {
          qDeadline = new Date(Date.now() + q.timeLimitSeconds * 1000);
        }
      }
      await conn.query(
        `INSERT INTO quiz_attempt_questions
         (attempt_id, question_id, position, viewed, question_started_at, question_deadline_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [attemptId, Number(qid), pos, pos === 0 ? 1 : 0, qStarted, qDeadline]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  await recordEvent(actor.id, 'quiz_started', { quizId, attemptId, payload: { mode: quiz.timeMode } });
  if (consent) {
    await recordEvent(actor.id, 'consent_age_granted', { quizId, attemptId });
  } else {
    await recordEvent(actor.id, 'consent_age_denied', { quizId, attemptId });
  }
  await recordEvent(actor.id, 'question_viewed', {
    quizId,
    attemptId,
    payload: { questionId: questionOrder[0], position: 0 },
  });

  return getAttemptState(attemptId, actor.id);
}

export async function getAttemptState(attemptId, actorId) {
  const bundle = await fetchAttemptBundle(attemptId, actorId);
  if (!bundle) return null;
  let { attempt, attemptQuestions } = bundle;
  attempt = await expireIfNeeded(attempt);

  const quiz = await loadQuizMeta(attempt.quizId);
  const questions = await loadQuestions(attempt.quizId);
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const publicQuestions = publicQuestionsFromInstance(
    byId,
    attempt.questionOrder,
    attempt.optionOrders
  );

  const answers = {};
  const viewed = {};
  const timings = {};
  for (const aq of attemptQuestions) {
    const qid = String(aq.questionId);
    viewed[qid] = Boolean(aq.viewed);
    if (aq.selectedOptionIndex !== null && aq.selectedOptionIndex !== undefined) {
      answers[qid] = aq.selectedOptionIndex;
    }
    if (aq.timeSpentMs != null) timings[qid] = aq.timeSpentMs;
  }

  const currentAq = attemptQuestions.find((a) => a.position === attempt.currentIndex);

  return {
    attemptId: attempt.id,
    quizId: attempt.quizId,
    title: quiz?.title,
    description: quiz?.description,
    level: quiz?.level,
    category: quiz?.category,
    timeMode: quiz?.timeMode || 'untimed',
    timeLimitSeconds: quiz?.timeLimitSeconds,
    status: attempt.status,
    currentIndex: attempt.currentIndex,
    ageConsent: Boolean(attempt.ageConsent),
    ageYears: attempt.ageYears,
    score: attempt.score,
    total: attempt.total,
    startedAt: attempt.startedAt,
    totalDeadlineAt: attempt.totalDeadlineAt,
    questionDeadlineAt: currentAq?.questionDeadlineAt || null,
    questions: publicQuestions,
    answers,
    viewed,
    timings,
    serverNow: new Date().toISOString(),
  };
}

export async function resumeAttempt(attemptId, actorId) {
  const state = await getAttemptState(attemptId, actorId);
  if (!state) return null;
  if (state.status === 'in_progress') {
    await recordEvent(actorId, 'quiz_resumed', { quizId: state.quizId, attemptId });
  }
  return state;
}

export async function viewQuestion(attemptId, actorId, position) {
  const bundle = await fetchAttemptBundle(attemptId, actorId);
  if (!bundle) return null;
  let { attempt, attemptQuestions } = bundle;
  attempt = await expireIfNeeded(attempt);
  if (attempt.status !== 'in_progress') throw httpError('Urınıw belsendi emes', 409);

  const pos = Number(position);
  if (!Number.isInteger(pos) || pos < 0 || pos >= attemptQuestions.length) {
    throw httpError('Orın nadurıs');
  }

  const quiz = await loadQuizMeta(attempt.quizId);
  const questions = await loadQuestions(attempt.quizId);
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  const aq = attemptQuestions.find((a) => a.position === pos);
  const q = byId[String(aq.questionId)];

  let qDeadline = aq.questionDeadlineAt;
  let qStarted = aq.questionStartedAt;
  if (!qStarted) {
    qStarted = new Date();
    if (quiz.timeMode === 'timed' && q.timeLimitSeconds) {
      qDeadline = new Date(Date.now() + q.timeLimitSeconds * 1000);
    }
    await db.query(
      `UPDATE quiz_attempt_questions
       SET viewed = 1, question_started_at = ?, question_deadline_at = ?
       WHERE attempt_id = ? AND question_id = ?`,
      [qStarted, qDeadline, attemptId, aq.questionId]
    );
  } else if (!aq.viewed) {
    await db.query(
      `UPDATE quiz_attempt_questions SET viewed = 1 WHERE attempt_id = ? AND question_id = ?`,
      [attemptId, aq.questionId]
    );
  }

  await db.query(`UPDATE quiz_attempts SET current_index = ? WHERE id = ?`, [pos, attemptId]);
  await recordEvent(actorId, 'question_viewed', {
    quizId: attempt.quizId,
    attemptId,
    payload: { questionId: String(aq.questionId), position: pos },
  });

  return getAttemptState(attemptId, actorId);
}

export async function answerQuestion(attemptId, actorId, { questionId, optionIndex, timeSpentMs }) {
  const bundle = await fetchAttemptBundle(attemptId, actorId);
  if (!bundle) return null;
  let { attempt, attemptQuestions } = bundle;
  attempt = await expireIfNeeded(attempt);
  if (attempt.status !== 'in_progress') throw httpError('Urınıw belsendi emes', 409);
  if (isPast(attempt.totalDeadlineAt)) {
    await expireIfNeeded({ ...attempt, status: 'in_progress' });
    throw httpError('Ulıwma waqıt tamam', 409);
  }

  const qid = String(questionId);
  const aq = attemptQuestions.find((a) => String(a.questionId) === qid);
  if (!aq) throw httpError('Soraw tabılmadı');

  if (aq.questionDeadlineAt && isPast(aq.questionDeadlineAt) && aq.selectedOptionIndex == null) {
    // Vaqt o‘tgan — javobsiz qoldirish mumkin, lekin yangi javob qabul qilinmaydi
    throw httpError('Soraw waqtı tamam', 409);
  }

  const questions = await loadQuestions(attempt.quizId);
  const q = questions.find((x) => x.id === qid);
  if (!q) throw httpError('Soraw tabılmadı');

  const order = attempt.optionOrders[qid] || q.options.map((_, i) => i);
  const idx = Number(optionIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= order.length) {
    throw httpError('Variant indeksi nadurıs');
  }
  const originalIndex = order[idx];
  const correctIndex = q.options.findIndex((o) => o === q.correctAnswer);
  const isCorrect = originalIndex === correctIndex ? 1 : 0;

  let spent = Number(timeSpentMs);
  if (!Number.isFinite(spent) || spent < 0) {
    if (aq.questionStartedAt) {
      spent = Math.max(0, Date.now() - new Date(aq.questionStartedAt).getTime());
    } else {
      spent = 0;
    }
  }
  spent = Math.min(spent, 24 * 60 * 60 * 1000);

  await db.query(
    `UPDATE quiz_attempt_questions
     SET selected_option_index = ?, selected_original_index = ?, is_correct = ?,
         time_spent_ms = ?, answered_at = CURRENT_TIMESTAMP, viewed = 1
     WHERE attempt_id = ? AND question_id = ?`,
    [idx, originalIndex, isCorrect, Math.round(spent), attemptId, Number(qid)]
  );

  try {
    const {
      upsertMistake,
      recordCorrect,
      creditSiblingRowsByDictTitle,
      siblingCreditPlan,
    } = await import('./mistakeBankService.js');
    const { resolveDictTitleIdFromQuiz } = await import('./quizDictBridge.js');
    const dictTitleId = await resolveDictTitleIdFromQuiz({
      correctAnswer: q.correctAnswer,
      question: q.question,
    });
    if (isCorrect) {
      await recordCorrect(actorId, {
        questionId: Number(qid),
        dictTitleId,
        source: 'quiz',
      });
    } else {
      await upsertMistake(actorId, {
        questionId: Number(qid),
        dictTitleId,
        source: 'quiz',
        prompt: q.question,
      });
    }
    const sibling = siblingCreditPlan({
      actorId,
      source: 'quiz',
      questionId: Number(qid),
      dictTitleId,
      correct: Boolean(isCorrect),
      prompt: q.question,
    });
    if (sibling) {
      await creditSiblingRowsByDictTitle(actorId, sibling.dictTitleId, sibling);
    }
  } catch (e) {
    console.error('Mistake bank (quiz):', e.message);
  }

  await recordEvent(actorId, 'question_answered', {
    quizId: attempt.quizId,
    attemptId,
    payload: { questionId: qid, timeSpentMs: Math.round(spent), correct: Boolean(isCorrect) },
  });

  const state = await getAttemptState(attemptId, actorId);
  const correctShuffledIndex = order.findIndex((oi) => oi === correctIndex);
  return {
    ...state,
    lastAnswer: {
      questionId: qid,
      isCorrect: Boolean(isCorrect),
      givenIndex: idx,
      correctIndex: correctShuffledIndex >= 0 ? correctShuffledIndex : null,
      correctAnswer: q.correctAnswer,
    },
  };
}

export async function finalizeAttempt(attemptId, actorId, { partial = false, force = false } = {}) {
  const bundle = await fetchAttemptBundle(attemptId, actorId);
  if (!bundle) return null;
  let { attempt, attemptQuestions } = bundle;
  attempt = await expireIfNeeded(attempt);

  if (attempt.status === 'completed' || attempt.status === 'partial') {
    return getAttemptResult(attemptId, actorId);
  }
  if (attempt.status === 'expired') {
    // Expired — mavjud javoblar bilan partial sifatida yakunlash
    partial = true;
    force = true;
  } else if (attempt.status !== 'in_progress') {
    throw httpError('Urınıwdı juwmaqlaw múmkin emes', 409);
  }

  const viewedRows = attemptQuestions.filter((a) => a.viewed);
  const answeredViewed = viewedRows.filter(
    (a) => a.selectedOptionIndex !== null && a.selectedOptionIndex !== undefined
  );

  if (!force) {
    if (partial) {
      if (!viewedRows.length || answeredViewed.length < viewedRows.length) {
        throw httpError('Shala juwmaqlaw: kórilgen barlıq sorawlarǵa juwap kerek');
      }
    } else {
      const allAnswered = attemptQuestions.every(
        (a) => a.selectedOptionIndex !== null && a.selectedOptionIndex !== undefined
      );
      if (!allAnswered) {
        throw httpError('Tolıq juwmaqlaw ushın barlıq sorawlarǵa juwap kerek');
      }
    }
  } else {
    partial = true;
  }

  // Fresh answers
  const [fresh] = await db.query(
    `SELECT is_correct AS isCorrect, time_spent_ms AS timeSpentMs
     FROM quiz_attempt_questions WHERE attempt_id = ?`,
    [attemptId]
  );
  const answered = fresh.filter((r) => r.isCorrect !== null);
  const score = answered.filter((r) => r.isCorrect === 1 || r.isCorrect === true).length;
  const status = partial || attempt.status === 'expired' ? 'partial' : 'completed';

  await db.query(
    `UPDATE quiz_attempts
     SET status = ?, score = ?, total = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, score, attempt.total, attemptId]
  );

  // Ball berish: takroriy urinishlar kamaytirilgan koeffitsiyent bilan.
  // (kind, ref_id) UNIQUE — bir attempt uchun ikki marta yozilmaydi.
  let awardResult = null;
  try {
    // Solo ham, xona (multiplayer) ham hisobga olinadi — bir testni qayta o‘ynab
    // cheksiz ball yig‘ishning oldi olinadi.
    const [[{ prior }]] = await db.query(
      `SELECT COUNT(*) AS prior FROM quiz_attempts
       WHERE actor_id = ? AND quiz_id = ? AND status IN ('completed','partial')
         AND is_adaptive = 0 AND id != ?`,
      [actorId, attempt.quizId, attemptId]
    );
    const breakdown = computeAttemptPoints(
      fresh.map((r) => ({ isCorrect: r.isCorrect === 1 || r.isCorrect === true, timeSpentMs: r.timeSpentMs })),
      {
        perfect: status === 'completed' && score === attempt.total,
        priorAttempts: Number(prior) || 0,
      }
    );
    awardResult = await awardPoints(actorId, {
      amount: breakdown.total,
      kind: 'quiz_completed',
      refId: attemptId,
      meta: { quizId: attempt.quizId, score, total: attempt.total, ...breakdown },
    });
  } catch (e) {
    console.error('Ball beriwde qátelik (finalize):', e.message);
  }

  await recordEvent(
    actorId,
    status === 'partial' ? 'quiz_partial_completed' : 'quiz_completed',
    {
      quizId: attempt.quizId,
      attemptId,
      payload: { score, total: attempt.total, partial: status === 'partial' },
    }
  );

  try {
    const { incrementQuizCompletes } = await import('./quotaService.js');
    await incrementQuizCompletes(actorId);
  } catch (e) {
    console.error('Quota quiz_completes:', e.message);
  }

  return getAttemptResult(attemptId, actorId);
}

export async function getAttemptResult(attemptId, actorId) {
  const bundle = await fetchAttemptBundle(attemptId, actorId);
  if (!bundle) return null;
  const { attempt, attemptQuestions } = bundle;
  if (!['completed', 'partial', 'expired'].includes(attempt.status)) {
    throw httpError('Nátiyje ele tayın emes', 409);
  }

  const quiz = await loadQuizMeta(attempt.quizId);
  const questions = await loadQuestions(attempt.quizId);
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));

  const results = attemptQuestions.map((aq) => {
    const q = byId[String(aq.questionId)];
    const order = attempt.optionOrders[String(aq.questionId)] || q.options.map((_, i) => i);
    const given =
      aq.selectedOptionIndex != null ? q.options[order[aq.selectedOptionIndex]] : null;
    return {
      id: String(aq.questionId),
      question: q.question,
      given,
      givenIndex: aq.selectedOptionIndex,
      correctAnswer: q.correctAnswer,
      correctIndex: q.options.findIndex((o) => o === q.correctAnswer),
      correct: Boolean(aq.isCorrect),
      timeSpentMs: aq.timeSpentMs,
      viewed: Boolean(aq.viewed),
    };
  });

  const analytics = await buildAgeAnalytics(attempt, results);
  const wrongCount = results.filter((r) => r.viewed && !r.correct).length;
  const answeredCount = results.filter((r) => r.givenIndex != null).length;

  let practice = { missedIds: [], titleIds: [] };
  try {
    const { buildQuizPracticePayload } = await import('./quizDictBridge.js');
    practice = await buildQuizPracticePayload(
      results
        .filter((r) => r.givenIndex != null)
        .map((r) => ({
          correct: Boolean(r.correct),
          question: r.question,
          correctAnswer: r.correctAnswer,
        }))
    );
  } catch (e) {
    console.error('Quiz practice payload:', e.message);
  }

  // Ball ma’lumoti + javob ochish holati
  let points = null;
  let reviewAccess = { available: false, product: 'answer_review', status: 'points' };
  try {
    const [award, wallet, unlocked] = await Promise.all([
      getAwardForRef('quiz_completed', attempt.id),
      getWallet(actorId),
      isReviewUnlocked(attempt.id),
    ]);
    points = {
      earned: award ? award.amount : 0,
      breakdown: award?.meta
        ? {
            base: award.meta.base,
            speed: award.meta.speed,
            perfectBonus: award.meta.perfectBonus,
            multiplier: award.meta.multiplier,
          }
        : null,
      balance: wallet.balance,
      level: wallet.level,
      levelProgress: wallet.levelProgress,
      levelNextAt: wallet.levelNextAt,
      leveledUp: Boolean(awardResult?.leveledUp),
      previousLevel: awardResult?.previousLevel ?? null,
    };
    reviewAccess = {
      available: true,
      product: 'answer_review',
      status: unlocked ? 'unlocked' : 'locked',
      unlocked,
      cost: unlocked ? 0 : reviewCost(attempt.total),
      balance: wallet.balance,
    };
  } catch {
    /* ball tizimi ishlamasa natija baribir qaytadi */
  }

  return {
    attemptId: attempt.id,
    quizId: attempt.quizId,
    title: quiz?.title,
    status: attempt.status,
    score: attempt.score ?? results.filter((r) => r.correct).length,
    total: attempt.total,
    answeredCount,
    wrongCount,
    practice,
    points,
    reviewAccess,
    ageConsent: Boolean(attempt.ageConsent),
    ageYears: attempt.ageYears,
    analytics: analytics.available
      ? {
          available: true,
          age: analytics.age,
          cohortSize: analytics.cohortSize,
          avgScore: analytics.avgScore,
          userScore: analytics.userScore,
          percentVsCohort: analytics.percentVsCohort,
          ageGroups: analytics.ageGroups,
        }
      : analytics,
  };
}

/** Attempt savollari bo‘yicha to‘liq tahlil (to‘g‘ri javoblar bilan). */
async function buildReviewResults(attempt, attemptQuestions) {
  const questions = await loadQuestions(attempt.quizId);
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]));
  return attemptQuestions
    .filter((aq) => byId[String(aq.questionId)])
    .map((aq) => {
      const q = byId[String(aq.questionId)];
      const order = attempt.optionOrders[String(aq.questionId)] || q.options.map((_, i) => i);
      const given =
        aq.selectedOptionIndex != null ? q.options[order[aq.selectedOptionIndex]] : null;
      return {
        id: String(aq.questionId),
        question: q.question,
        options: order.map((i) => q.options[i]),
        given,
        givenIndex: aq.selectedOptionIndex,
        correctAnswer: q.correctAnswer,
        correctIndex: order.findIndex((i) => q.options[i] === q.correctAnswer),
        correct: Boolean(aq.isCorrect),
        timeSpentMs: aq.timeSpentMs,
        viewed: Boolean(aq.viewed),
      };
    });
}

function assertTerminal(attempt) {
  if (!['completed', 'partial', 'expired'].includes(attempt.status)) {
    throw httpError('Dáslep testti juwmaqláń', 409);
  }
}

/** Javob ochish holati: narx, balans, ochilganmi. */
export async function getAttemptReviewStatus(attemptId, actorId) {
  const bundle = await fetchAttemptBundle(attemptId, actorId);
  if (!bundle) return null;
  assertTerminal(bundle.attempt);
  const [unlocked, wallet] = await Promise.all([isReviewUnlocked(attemptId), getWallet(actorId)]);
  return {
    attemptId,
    unlocked,
    cost: unlocked ? 0 : reviewCost(bundle.attempt.total),
    balance: wallet.balance,
    level: wallet.level,
  };
}

/** Ball evaziga javoblarni ochish; yetmasa 402 (code: INSUFFICIENT_POINTS). */
export async function unlockAttemptReview(attemptId, actorId) {
  const bundle = await fetchAttemptBundle(attemptId, actorId);
  if (!bundle) return null;
  assertTerminal(bundle.attempt);
  const result = await unlockAnswerReview(actorId, attemptId, bundle.attempt.total);
  return { attemptId, ...result };
}

/**
 * Javoblar tahlili — ball menen ashılǵannan keyin.
 * scope=mistakes — faqat noto‘g‘ri; scope=full — barcha savollar.
 */
export async function getAttemptReview(attemptId, actorId, { scope = 'full' } = {}) {
  const bundle = await fetchAttemptBundle(attemptId, actorId);
  if (!bundle) return null;
  assertTerminal(bundle.attempt);
  const unlocked = await isReviewUnlocked(attemptId);

  if (!unlocked) {
    const wallet = await getWallet(actorId);
    throw httpError('Juwaplar ashılmaǵan — dáslep ball menen ashıń', 402, {
      code: 'ANSWER_REVIEW_LOCKED',
      cost: reviewCost(bundle.attempt.total),
      balance: wallet.balance,
    });
  }

  const wantFull = String(scope || 'full').toLowerCase() !== 'mistakes';
  let results = await buildReviewResults(bundle.attempt, bundle.attemptQuestions);
  if (!wantFull) {
    results = results.filter((r) => !r.correct);
  }

  return {
    attemptId,
    quizId: bundle.attempt.quizId,
    status: bundle.attempt.status,
    score: bundle.attempt.score,
    total: bundle.attempt.total,
    scope: wantFull ? 'full' : 'mistakes',
    results,
  };
}

/** Admin uchun: istalgan foydalanuvchi urinishini ball sarfisiz ko‘rish. */
export async function getAttemptReviewForAdmin(attemptId) {
  const [[attempt]] = await db.query(
    `SELECT a.id, a.quiz_id AS quizId, a.actor_id AS actorId, a.status, a.score, a.total,
            a.started_at AS startedAt, a.completed_at AS completedAt,
            i.question_order AS questionOrder, i.option_orders AS optionOrders
     FROM quiz_attempts a
     JOIN quiz_instances i ON i.id = a.instance_id
     WHERE a.id = ? LIMIT 1`,
    [String(attemptId)]
  );
  if (!attempt) return null;
  attempt.optionOrders =
    typeof attempt.optionOrders === 'string'
      ? JSON.parse(attempt.optionOrders)
      : attempt.optionOrders || {};
  const [attemptQuestions] = await db.query(
    `SELECT question_id AS questionId, position, viewed,
            selected_option_index AS selectedOptionIndex,
            is_correct AS isCorrect, time_spent_ms AS timeSpentMs
     FROM quiz_attempt_questions WHERE attempt_id = ? ORDER BY position`,
    [String(attemptId)]
  );
  const quiz = await loadQuizMeta(attempt.quizId);
  const results = await buildReviewResults(attempt, attemptQuestions);
  const answered = results.filter((r) => r.givenIndex != null).length;
  const viewed = results.filter((r) => r.viewed).length;
  const unanswered = Math.max(0, results.length - answered);
  const totalTimeMs = results.reduce((sum, r) => sum + (Number(r.timeSpentMs) || 0), 0);
  const flags = [];
  if (
    attempt.status === 'completed' &&
    attempt.score != null &&
    attempt.total > 0 &&
    Number(attempt.score) === Number(attempt.total) &&
    totalTimeMs > 0 &&
    totalTimeMs < Number(attempt.total) * 1500
  ) {
    flags.push('low_time_perfect');
  }
  if (unanswered >= Math.max(2, Math.ceil(results.length * 0.3))) {
    flags.push('many_unanswered');
  }
  if (attempt.status === 'in_progress') flags.push('in_progress');
  if (attempt.status === 'voided') flags.push('voided');
  return {
    attemptId: attempt.id,
    quizId: attempt.quizId,
    title: quiz?.title || attempt.quizId,
    actorId: attempt.actorId,
    status: attempt.status,
    score: attempt.score,
    total: attempt.total,
    startedAt: attempt.startedAt,
    completedAt: attempt.completedAt,
    summary: {
      answered,
      viewed,
      unanswered,
      totalTimeMs,
      flags,
    },
    results,
  };
}

/** Admin: stuck in_progress → expired (ball bermaydi; solo restart ochiladi). */
export async function forceExpireAttemptAdmin(attemptId) {
  await ensureAttemptVoidedStatus();
  const [[attempt]] = await db.query(
    `SELECT id, actor_id AS actorId, quiz_id AS quizId, status
     FROM quiz_attempts WHERE id = ? LIMIT 1`,
    [String(attemptId)]
  );
  if (!attempt) throw httpError('Urınıw tabılmadı', 404);
  if (attempt.status !== 'in_progress') {
    throw httpError('Faqat dáwam etip atırǵan urınıwdı expire qılıw múmkin', 409);
  }
  await db.query(
    `UPDATE quiz_attempts
     SET status = 'expired', completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'in_progress'`,
    [attempt.id]
  );
  try {
    await recordEvent(attempt.actorId, 'quiz_force_expired', {
      quizId: attempt.quizId,
      attemptId: attempt.id,
      payload: { by: 'admin' },
    });
  } catch {
    /* ignore */
  }
  return {
    id: attempt.id,
    actorId: attempt.actorId,
    quizId: attempt.quizId,
    status: 'expired',
  };
}

/** Admin: completed|partial → voided + quiz_completed award clawback. */
export async function voidAttemptAdmin(attemptId, { reason = '' } = {}) {
  await ensureAttemptVoidedStatus();
  const [[attempt]] = await db.query(
    `SELECT id, actor_id AS actorId, quiz_id AS quizId, status, score, total
     FROM quiz_attempts WHERE id = ? LIMIT 1`,
    [String(attemptId)]
  );
  if (!attempt) throw httpError('Urınıw tabılmadı', 404);
  if (!['completed', 'partial'].includes(attempt.status)) {
    throw httpError('Faqat juwmaqlangan / shala urınıwdı biykarlaw múmkin', 409);
  }
  const note = String(reason || '').trim().slice(0, 240);
  const [result] = await db.query(
    `UPDATE quiz_attempts SET status = 'voided', completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP)
     WHERE id = ? AND status IN ('completed','partial')`,
    [attempt.id]
  );
  if (!result.affectedRows) {
    throw httpError('Urınıw statusı ózgertiwi múmkin emes', 409);
  }

  let clawback = { revoked: false, amount: 0 };
  try {
    clawback = await revokeAwardForRef('quiz_completed', attempt.id, {
      clawbackKind: 'quiz_attempt_voided',
      meta: { quizId: attempt.quizId, reason: note || null, by: 'admin' },
    });
  } catch (e) {
    console.error('Void clawback:', e.message);
  }

  try {
    await recordEvent(attempt.actorId, 'quiz_attempt_voided', {
      quizId: attempt.quizId,
      attemptId: attempt.id,
      payload: {
        reason: note || null,
        score: attempt.score,
        total: attempt.total,
        clawbackAmount: clawback.amount || 0,
      },
    });
  } catch {
    /* ignore */
  }

  return {
    attempt: {
      id: attempt.id,
      actorId: attempt.actorId,
      quizId: attempt.quizId,
      status: 'voided',
      score: attempt.score,
      total: attempt.total,
    },
    clawback,
  };
}

async function buildAgeAnalytics(attempt, results) {
  if (!attempt.ageConsent || attempt.ageYears == null) {
    return { available: false, reason: 'no_consent' };
  }

  const age = attempt.ageYears;
  const [[cohort]] = await db.query(
    `SELECT COUNT(*) AS n, AVG(score) AS avgScore
     FROM quiz_attempts
     WHERE quiz_id = ? AND status IN ('completed','partial')
       AND age_consent = 1 AND age_years = ?
       AND id != ?`,
    [attempt.quizId, age, attempt.id]
  );
  const n = Number(cohort?.n || 0);
  if (n < MIN_COHORT_SIZE) {
    return { available: false, reason: 'small_cohort', minCohort: MIN_COHORT_SIZE, cohortSize: n };
  }

  const avgScore = Number(cohort.avgScore);
  const userScore = attempt.score ?? results.filter((r) => r.correct).length;
  const farq = userScore - avgScore;
  const foizFarq = avgScore > 0 ? (farq / avgScore) * 100 : null;

  const [ageGroups] = await db.query(
    `SELECT age_years AS age, COUNT(*) AS count, AVG(score) AS avgScore
     FROM quiz_attempts
     WHERE quiz_id = ? AND status IN ('completed','partial')
       AND age_consent = 1 AND age_years IS NOT NULL AND id != ?
     GROUP BY age_years
     HAVING count >= ?
     ORDER BY age_years`,
    [attempt.quizId, attempt.id, MIN_COHORT_SIZE]
  );

  const questionTiming = [];
  for (const r of results) {
    if (r.timeSpentMs == null) {
      questionTiming.push({
        questionId: r.id,
        userMs: null,
        cohortAvgMs: null,
        comparison: null,
      });
      continue;
    }
    const [[row]] = await db.query(
      `SELECT AVG(aq.time_spent_ms) AS avgMs, COUNT(*) AS n
       FROM quiz_attempt_questions aq
       JOIN quiz_attempts a ON a.id = aq.attempt_id
       WHERE a.quiz_id = ? AND a.status IN ('completed','partial')
         AND a.age_consent = 1 AND a.age_years = ?
         AND a.id != ? AND aq.question_id = ?
         AND aq.time_spent_ms IS NOT NULL`,
      [attempt.quizId, age, attempt.id, Number(r.id)]
    );
    const tn = Number(row?.n || 0);
    if (tn < MIN_COHORT_SIZE) {
      questionTiming.push({
        questionId: r.id,
        userMs: r.timeSpentMs,
        cohortAvgMs: null,
        comparison: null,
        reason: 'small_cohort',
      });
      continue;
    }
    const avgMs = Number(row.avgMs);
    const delta = r.timeSpentMs - avgMs;
    questionTiming.push({
      questionId: r.id,
      userMs: r.timeSpentMs,
      cohortAvgMs: Math.round(avgMs),
      deltaMs: Math.round(delta),
      comparison: delta > 250 ? 'slower' : delta < -250 ? 'faster' : 'similar',
    });
  }

  return {
    available: true,
    age,
    cohortSize: n,
    avgScore: Math.round(avgScore * 100) / 100,
    userScore,
    percentVsCohort: foizFarq != null ? Math.round(foizFarq * 10) / 10 : null,
    ageGroups: ageGroups.map((g) => ({
      age: g.age,
      count: Number(g.count),
      avgScore: Math.round(Number(g.avgScore) * 100) / 100,
    })),
    questionTiming,
  };
}

export async function findActiveAttempt(actorId, quizId) {
  const [[row]] = await db.query(
    `SELECT id FROM quiz_attempts
     WHERE actor_id = ? AND quiz_id = ? AND status = 'in_progress'
       AND room_id IS NULL
     ORDER BY started_at DESC LIMIT 1`,
    [actorId, quizId]
  );
  return row?.id || null;
}

/** Dashboard/module: include play_mode & room for local stats. */
export async function listAttemptsForActorDetailed(actorId, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const [rows] = await db.query(
    `SELECT a.id, a.quiz_id AS quizId, a.status, a.score, a.total,
            a.play_mode AS playMode, a.room_id AS roomId,
            a.started_at AS startedAt, a.completed_at AS completedAt,
            q.title, q.category, q.level
     FROM quiz_attempts a
     JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.actor_id = ? AND a.status IN ('completed','partial','expired')
     ORDER BY COALESCE(a.completed_at, a.started_at) DESC
     LIMIT ${safeLimit}`,
    [actorId]
  );
  return rows;
}

/** Full module-local statistics. Raw answers remain in DB and are not returned. */
export async function getQuizStatistics(actorIdOrIds) {
  const ids = (Array.isArray(actorIdOrIds) ? actorIdOrIds : [actorIdOrIds])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) {
    return {
      summary: {
        attempts: 0,
        completed: 0,
        multiplayer: 0,
        adaptive: 0,
        avgPercent: 0,
        bestPercent: 0,
        correctAnswers: 0,
        totalAnswers: 0,
      },
      categories: [],
      modes: [],
      trend: [],
      recent: [],
      ability: null,
      mistakes: { active: 0, totalWrong: 0 },
    };
  }
  const ph = ids.map(() => '?').join(',');

  const [[summary]] = await db.query(
    `SELECT COUNT(*) AS attempts,
            COALESCE(SUM(status = 'completed'), 0) AS completed,
            COALESCE(SUM(play_mode = 'sync' OR play_mode = 'race'), 0) AS multiplayer,
            COALESCE(SUM(is_adaptive = 1), 0) AS adaptive,
            COALESCE(AVG(CASE WHEN total > 0 THEN score / total * 100 END), 0) AS avgPercent,
            COALESCE(MAX(CASE WHEN total > 0 THEN score / total * 100 END), 0) AS bestPercent,
            COALESCE(SUM(score), 0) AS correctAnswers,
            COALESCE(SUM(total), 0) AS totalAnswers
     FROM quiz_attempts
     WHERE actor_id IN (${ph}) AND status IN ('completed','partial','expired')`,
    ids
  );

  const [categories] = await db.query(
    `SELECT q.category, COUNT(*) AS attempts,
            AVG(CASE WHEN a.total > 0 THEN a.score / a.total * 100 END) AS avgPercent
     FROM quiz_attempts a
     JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.actor_id IN (${ph}) AND a.status IN ('completed','partial','expired')
     GROUP BY q.category
     ORDER BY attempts DESC`,
    ids
  );

  const [modes] = await db.query(
    `SELECT COALESCE(a.play_mode, 'solo') AS mode, COUNT(*) AS attempts,
            AVG(CASE WHEN a.total > 0 THEN a.score / a.total * 100 END) AS avgPercent
     FROM quiz_attempts a
     WHERE a.actor_id IN (${ph}) AND a.status IN ('completed','partial','expired')
     GROUP BY COALESCE(a.play_mode, 'solo')
     ORDER BY attempts DESC`,
    ids
  );

  const [trend] = await db.query(
    `SELECT DATE(COALESCE(completed_at, started_at)) AS day,
            COUNT(*) AS attempts,
            AVG(CASE WHEN total > 0 THEN score / total * 100 END) AS avgPercent
     FROM quiz_attempts
     WHERE actor_id IN (${ph}) AND status IN ('completed','partial','expired')
       AND COALESCE(completed_at, started_at) >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
     GROUP BY DATE(COALESCE(completed_at, started_at))
     ORDER BY day`,
    ids
  );

  const [recent] = await db.query(
    `SELECT a.id, a.quiz_id AS quizId, q.title, q.category, a.play_mode AS playMode,
            a.is_adaptive AS isAdaptive, a.score, a.total, a.status,
            a.completed_at AS completedAt, a.started_at AS startedAt
     FROM quiz_attempts a
     JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.actor_id IN (${ph}) AND a.status IN ('completed','partial','expired')
     ORDER BY COALESCE(a.completed_at, a.started_at) DESC
     LIMIT 20`,
    ids
  );

  const [[ability]] = await db.query(
    `SELECT theta, theta_se AS thetaSe, attempts, updated_at AS updatedAt
     FROM ${DB.statistika}.actor_ability
     WHERE actor_id IN (${ph}) AND skill = 'global'
     ORDER BY attempts DESC LIMIT 1`,
    ids
  );

  const [[mistakes]] = await db.query(
    `SELECT COUNT(*) AS active, COALESCE(SUM(wrong_count), 0) AS totalWrong
     FROM ${DB.ai}.mistake_bank WHERE actor_id IN (${ph}) AND resolved = 0`,
    ids
  );

  return {
    summary: {
      attempts: Number(summary.attempts || 0),
      completed: Number(summary.completed || 0),
      multiplayer: Number(summary.multiplayer || 0),
      adaptive: Number(summary.adaptive || 0),
      avgPercent: Math.round(Number(summary.avgPercent || 0)),
      bestPercent: Math.round(Number(summary.bestPercent || 0)),
      correctAnswers: Number(summary.correctAnswers || 0),
      totalAnswers: Number(summary.totalAnswers || 0),
    },
    categories: categories.map((r) => ({
      category: r.category || 'other',
      attempts: Number(r.attempts),
      avgPercent: Math.round(Number(r.avgPercent || 0)),
    })),
    modes: modes.map((r) => ({
      mode: r.mode,
      attempts: Number(r.attempts),
      avgPercent: Math.round(Number(r.avgPercent || 0)),
    })),
    trend: trend.map((r) => ({
      day: r.day,
      attempts: Number(r.attempts),
      avgPercent: Math.round(Number(r.avgPercent || 0)),
    })),
    recent: recent.map((r) => ({ ...r, isAdaptive: Boolean(r.isAdaptive) })),
    ability: ability
      ? {
          theta: Number(ability.theta),
          thetaSe: Number(ability.thetaSe),
          attempts: Number(ability.attempts),
          updatedAt: ability.updatedAt,
        }
      : null,
    mistakes: {
      active: Number(mistakes.active || 0),
      totalWrong: Number(mistakes.totalWrong || 0),
    },
  };
}

/** Testlar uchun: shuffle determinism. */
export function shuffleForSeed(questions, seedStr) {
  return buildShuffledInstance(questions, seedStr);
}
