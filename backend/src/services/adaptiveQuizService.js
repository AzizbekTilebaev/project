import crypto from 'crypto';
import { pools, DB } from '../config/db.js';
import { parseOptions } from './quizService.js';
import {
  difficultyFromLevel,
  selectNextItem,
  updateTheta,
  estimateFromPValue,
} from './irtService.js';
import { upsertMistake, recordCorrect, creditSiblingRowsByDictTitle, siblingCreditPlan, listDue, listTopMistakes } from './mistakeBankService.js';
import { recordEvent } from './actorService.js';
import { computeAttemptPoints, awardPoints } from './pointsService.js';

const db = pools.quiz;
const DEFAULT_MAX = 10;
const CALIBRATION_MIN_SEEN = 20;

/** Sof: adaptiv bank bo‘sh / jetkiliksiz — remediation payload. */
export function buildAdaptiveEmptyPayload({ hasMistakes = false } = {}) {
  // Produce-first: done screen menen bir xil — /tutor (Practice Hub emes).
  const tutorHref = '/tutor';
  const practiceHref = '/tutor/practice?from=quiz';
  return {
    reason: 'empty_bank',
    code: 'ADAPTIVE_EMPTY_BANK',
    remediation: hasMistakes ? 'mistakes' : 'seed',
    practiceLinks: {
      primary: hasMistakes ? tutorHref : '/quiz',
      mistakes: tutorHref,
      practice: practiceHref,
      tutor: tutorHref,
      quiz: '/quiz',
      dictGame: '/dictionary/game',
      immersion: '/dictionary/immersion',
      crossword: '/crossword',
      books: '/books',
      jumbaq: '/jumbaqlar',
    },
  };
}

/** Sof: sessiya ortasında bank tawsılǵan. */
export function buildAdaptiveBankExhaustedMeta() {
  const base = buildAdaptiveEmptyPayload({ hasMistakes: false });
  return {
    earlyEnd: true,
    reason: 'bank_exhausted',
    practiceLinks: base.practiceLinks,
  };
}

async function actorHasMistakeRemediation(actorId) {
  try {
    const due = await listDue(actorId, 1);
    if (due.length) return true;
    const top = await listTopMistakes(actorId, 1);
    return top.length > 0;
  } catch {
    return false;
  }
}

async function adaptiveEmptyHttpError(actorId) {
  const hasMistakes = await actorHasMistakeRemediation(actorId);
  const payload = buildAdaptiveEmptyPayload({ hasMistakes });
  const err = httpError(
    hasMistakes
      ? 'Adaptiv bankada jetkilikli soraw joq — qátelerdi qayta kóriń'
      : 'Adaptiv bankada jetkilikli soraw joq — ádettegi test yamasa mashqtan baslań',
    503
  );
  err.code = payload.code;
  err.reason = payload.reason;
  err.remediation = payload.remediation;
  err.practiceLinks = payload.practiceLinks;
  return err;
}

/** Session qáteleri → fokuslı mashq (juwap matni siz). */
async function practicePayloadForAttempt(attemptId) {
  try {
    const { buildQuizPracticePayload } = await import('./quizDictBridge.js');
    const [rows] = await db.query(
      `SELECT aq.is_correct AS isCorrect, qq.question, qq.correct_answer AS correctAnswer
       FROM quiz_attempt_questions aq
       JOIN quiz_questions qq ON qq.id = aq.question_id
       WHERE aq.attempt_id = ? AND aq.is_correct IS NOT NULL`,
      [attemptId]
    );
    return buildQuizPracticePayload(
      rows.map((r) => ({
        correct: Boolean(r.isCorrect),
        question: r.question,
        correctAnswer: r.correctAnswer,
      }))
    );
  } catch (e) {
    console.error('Quiz practice payload (adaptive):', e.message);
    return { missedIds: [], titleIds: [] };
  }
}

/** Adaptiv yakun: ball berish (idempotent, takroriy sessiya kamaytiriladi). */
async function awardAdaptivePoints(actorId, attempt, attemptId, score, total) {
  try {
    const [answers] = await db.query(
      `SELECT is_correct AS isCorrect, time_spent_ms AS timeSpentMs
       FROM quiz_attempt_questions WHERE attempt_id = ?`,
      [attemptId]
    );
    const [[{ prior }]] = await db.query(
      `SELECT COUNT(*) AS prior FROM quiz_attempts
       WHERE actor_id = ? AND is_adaptive = 1 AND skill <=> ? AND status = 'completed'
         AND id != ?`,
      [actorId, attempt.skill || 'global', attemptId]
    );
    const breakdown = computeAttemptPoints(
      answers.map((r) => ({
        isCorrect: r.isCorrect === 1 || r.isCorrect === true,
        timeSpentMs: r.timeSpentMs,
      })),
      { perfect: score === total && total > 0, priorAttempts: Number(prior) || 0 }
    );
    const award = await awardPoints(actorId, {
      amount: breakdown.total,
      kind: 'adaptive_completed',
      refId: attemptId,
      meta: { skill: attempt.skill || 'global', score, total, ...breakdown },
    });
    return award.awarded
      ? {
          earned: award.amount,
          balance: award.balance,
          level: award.level,
          leveledUp: Boolean(award.leveledUp),
          previousLevel: award.previousLevel ?? null,
        }
      : null;
  } catch (e) {
    console.error('Ball berishda xato (adaptive):', e.message);
    return null;
  }
}

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function getAbilityRow(actorId, skill = 'global') {
  const [[row]] = await db.query(
    `SELECT theta, theta_se AS thetaSe, attempts FROM ${DB.statistika}.actor_ability
     WHERE actor_id = ? AND skill = ? LIMIT 1`,
    [actorId, skill]
  );
  return row || { theta: 0, thetaSe: 1, attempts: 0 };
}

async function saveAbility(actorId, skill, theta, se, attempts) {
  await db.query(
    `INSERT INTO ${DB.statistika}.actor_ability (actor_id, skill, theta, theta_se, attempts)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE theta = VALUES(theta), theta_se = VALUES(theta_se),
       attempts = VALUES(attempts), updated_at = CURRENT_TIMESTAMP`,
    [actorId, skill, theta, se, attempts]
  );
}

async function loadItemBank(skill = null) {
  const [rows] = await db.query(
    `SELECT qq.id, qq.quiz_id AS quizId, qq.question, qq.options, qq.correct_answer AS correctAnswer,
            qq.time_limit_seconds AS timeLimitSeconds,
            qq.irt_difficulty AS irtDifficulty, qq.irt_discrimination AS irtDiscrimination,
            qq.irt_guessing AS irtGuessing, q.level, q.category
     FROM quiz_questions qq
     JOIN quizzes q ON q.id = qq.quiz_id
     ${skill && skill !== 'global' ? 'WHERE q.category = ?' : ''}
     ORDER BY qq.id`,
    skill && skill !== 'global' ? [skill] : []
  );
  return rows.map((r) => ({
    ...r,
    options: parseOptions(r.options),
    a: r.irtDiscrimination != null ? Number(r.irtDiscrimination) : 1,
    b:
      r.irtDifficulty != null
        ? Number(r.irtDifficulty)
        : difficultyFromLevel(r.level),
    c: r.irtGuessing != null ? Number(r.irtGuessing) : 0.2,
  }));
}

function publicItem(item, optionOrder) {
  const order = optionOrder || item.options.map((_, i) => i);
  return {
    id: String(item.id),
    question: item.question,
    options: order.map((i) => item.options[i]),
    timeLimitSeconds: item.timeLimitSeconds,
    quizId: item.quizId,
    category: item.category,
  };
}

/** Keyingi soraw qiyinligi — juwap matnin ochirmay. */
function difficultyHint(itemB, theta) {
  const diff = Number(itemB) - Number(theta);
  if (!Number.isFinite(diff)) return 'similar';
  if (diff > 0.4) return 'harder';
  if (diff < -0.4) return 'easier';
  return 'similar';
}

function roundTheta(n) {
  return Math.round(Number(n) * 1000) / 1000;
}

/** Empirical p-value bookkeeping; once enough exposure, recalibrate irt_difficulty. */
async function recalibrateItem(questionId) {
  const [[row]] = await db.query(
    `SELECT times_seen AS timesSeen, times_correct AS timesCorrect, calibrated_at AS calibratedAt
     FROM quiz_questions WHERE id = ? LIMIT 1`,
    [questionId]
  );
  if (!row || !row.timesSeen) return;
  const pValue = row.timesCorrect / row.timesSeen;
  if (!row.calibratedAt && row.timesSeen >= CALIBRATION_MIN_SEEN) {
    await db.query(
      `UPDATE quiz_questions
       SET p_value = ?, irt_difficulty = ?, calibrated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [pValue, estimateFromPValue(pValue), questionId]
    );
  } else {
    await db.query(`UPDATE quiz_questions SET p_value = ? WHERE id = ?`, [pValue, questionId]);
  }
}

function shuffleOrder(n) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export async function getAbility(actorId, skill = 'global') {
  const row = await getAbilityRow(actorId, skill);
  return {
    skill,
    theta: Number(row.theta || 0),
    thetaSe: Number(row.thetaSe || 1),
    attempts: Number(row.attempts || 0),
  };
}

/** Faol adaptiv urınıw id (quota bypass ushın). */
export async function getAdaptiveInProgressId(actorId, skill = 'global') {
  const [[row]] = await db.query(
    `SELECT id FROM quiz_attempts
     WHERE actor_id = ? AND is_adaptive = 1 AND status = 'in_progress'
       AND room_id IS NULL AND skill <=> ?
     ORDER BY id DESC
     LIMIT 1`,
    [actorId, skill]
  );
  return row?.id || null;
}

async function publicAdaptiveState(attempt, actorId, { resumed = false } = {}) {
  const bank = await loadItemBank(attempt.skill || 'global');
  const order = (attempt.questionOrder || []).map(String);
  if (!order.length) throw httpError('Adaptiv urınıw búzinǵan', 409);

  let idx = Number(attempt.current_index) || 0;
  for (let i = 0; i < order.length; i++) {
    const id = order[i];
    const [[row]] = await db.query(
      `SELECT is_correct AS isCorrect FROM quiz_attempt_questions
       WHERE attempt_id = ? AND question_id = ? LIMIT 1`,
      [attempt.id, Number(id) || id]
    );
    if (!row || row.isCorrect == null) {
      idx = i;
      break;
    }
    if (i === order.length - 1) idx = i;
  }

  const currentQid = order[idx];
  const item = bank.find((x) => String(x.id) === String(currentQid));
  if (!item) throw httpError('Soraw tabılmadı', 404);
  const optionOrder =
    attempt.optionOrders[String(currentQid)] || item.options.map((_, i) => i);
  const ability = await getAbilityRow(actorId, attempt.skill || 'global');
  const [[{ scoreSoFar }]] = await db.query(
    `SELECT COALESCE(SUM(is_correct = 1), 0) AS scoreSoFar
     FROM quiz_attempt_questions WHERE attempt_id = ? AND is_correct IS NOT NULL`,
    [attempt.id]
  );

  return {
    attemptId: attempt.id,
    skill: attempt.skill || 'global',
    status: 'in_progress',
    currentIndex: idx,
    total: Number(attempt.total) || DEFAULT_MAX,
    theta: roundTheta(Number(ability.theta != null ? ability.theta : attempt.theta_start) || 0),
    score: Number(scoreSoFar) || 0,
    question: publicItem(item, optionOrder),
    resumed: Boolean(resumed),
    serverNow: new Date().toISOString(),
  };
}

/** Faol adaptiv urınıwdı shala juwmaqlaw (resume zınjırın úziw). */
export async function abandonAdaptiveAttempt(attemptId, actorId) {
  const attempt = await loadAdaptiveAttempt(attemptId, actorId);
  if (!attempt) throw httpError('Urınıw tabılmadı', 404);
  if (attempt.status !== 'in_progress') {
    return {
      attemptId,
      status: attempt.status,
      score: Number(attempt.score) || 0,
      total: Number(attempt.total) || 0,
      abandoned: false,
    };
  }

  const [[agg]] = await db.query(
    `SELECT COALESCE(SUM(is_correct = 1), 0) AS scoreSoFar,
            COALESCE(SUM(is_correct IS NOT NULL), 0) AS answered
     FROM quiz_attempt_questions WHERE attempt_id = ?`,
    [attemptId]
  );
  const score = Number(agg?.scoreSoFar) || 0;
  const answered = Number(agg?.answered) || 0;
  const total = Number(attempt.total) || Math.max(answered, 1);

  await db.query(
    `UPDATE quiz_attempts
     SET status = 'partial', score = ?, total = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'in_progress'`,
    [score, total, attemptId]
  );

  await recordEvent(actorId, 'adaptive_abandoned', {
    quizId: attempt.quiz_id,
    attemptId,
    payload: { score, answered, total, mode: 'adaptive' },
  });

  return {
    attemptId,
    status: 'partial',
    score,
    total,
    answered,
    abandoned: true,
  };
}

export async function startAdaptiveAttempt(actor, { skill = 'global', maxItems = DEFAULT_MAX, forceNew = false } = {}) {
  const existingId = await getAdaptiveInProgressId(actor.id, skill);
  if (existingId) {
    if (forceNew) {
      await abandonAdaptiveAttempt(existingId, actor.id);
    } else {
      const existing = await loadAdaptiveAttempt(existingId, actor.id);
      if (existing && existing.status === 'in_progress') {
        return publicAdaptiveState(existing, actor.id, { resumed: true });
      }
    }
  }

  const bank = await loadItemBank(skill);
  if (bank.length < 3) throw await adaptiveEmptyHttpError(actor.id);

  const ability = await getAbilityRow(actor.id, skill);
  const theta = Number(ability.theta || 0);
  const first = selectNextItem(bank, theta, new Set());
  if (!first) throw await adaptiveEmptyHttpError(actor.id);

  const optionOrder = shuffleOrder(first.options.length);
  const instanceId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const total = Math.min(Math.max(Number(maxItems) || DEFAULT_MAX, 3), 20);

  await db.query(
    `INSERT INTO quiz_instances (id, quiz_id, question_order, option_orders, seed)
     VALUES (?, ?, ?, ?, ?)`,
    [
      instanceId,
      first.quizId,
      JSON.stringify([String(first.id)]),
      JSON.stringify({ [String(first.id)]: optionOrder }),
      `adaptive-${crypto.randomBytes(8).toString('hex')}`,
    ]
  );

  await db.query(
    `INSERT INTO quiz_attempts
     (id, instance_id, quiz_id, actor_id, room_id, play_mode, is_adaptive, skill,
      theta_start, status, current_index, age_years, age_consent, total)
     VALUES (?, ?, ?, ?, NULL, 'adaptive', 1, ?, ?, 'in_progress', 0, NULL, 0, ?)`,
    [attemptId, instanceId, first.quizId, actor.id, skill, theta, total]
  );

  await db.query(
    `INSERT INTO quiz_attempt_questions
     (attempt_id, question_id, position, viewed, question_started_at)
     VALUES (?, ?, 0, 1, CURRENT_TIMESTAMP)`,
    [attemptId, first.id]
  );

  await db.query(
    `UPDATE quiz_questions SET times_seen = times_seen + 1 WHERE id = ?`,
    [first.id]
  );

  await recordEvent(actor.id, 'adaptive_started', {
    quizId: first.quizId,
    attemptId,
    payload: { mode: 'adaptive' },
  });

  return {
    attemptId,
    skill,
    status: 'in_progress',
    currentIndex: 0,
    total,
    theta,
    score: 0,
    question: publicItem(first, optionOrder),
    resumed: false,
    serverNow: new Date().toISOString(),
  };
}

async function loadAdaptiveAttempt(attemptId, actorId) {
  const [[attempt]] = await db.query(
    `SELECT a.*, i.question_order AS questionOrder, i.option_orders AS optionOrders
     FROM quiz_attempts a
     JOIN quiz_instances i ON i.id = a.instance_id
     WHERE a.id = ? AND a.actor_id = ? AND a.is_adaptive = 1 AND a.room_id IS NULL
     LIMIT 1`,
    [attemptId, actorId]
  );
  if (!attempt) return null;
  attempt.questionOrder =
    typeof attempt.questionOrder === 'string'
      ? JSON.parse(attempt.questionOrder)
      : attempt.questionOrder || [];
  attempt.optionOrders =
    typeof attempt.optionOrders === 'string'
      ? JSON.parse(attempt.optionOrders)
      : attempt.optionOrders || {};
  return attempt;
}

export async function answerAdaptive(attemptId, actorId, { questionId, optionIndex, timeSpentMs }) {
  const attempt = await loadAdaptiveAttempt(attemptId, actorId);
  if (!attempt) throw httpError('Urınıw tabılmadı', 404);
  if (attempt.status !== 'in_progress') throw httpError('Urınıw faol emes', 409);

  const qid = String(questionId);
  const bank = await loadItemBank(attempt.skill || 'global');
  const item = bank.find((x) => String(x.id) === qid);
  if (!item) throw httpError('Soraw tabılmadı');

  const order = attempt.optionOrders[qid] || item.options.map((_, i) => i);
  const idx = Number(optionIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= order.length) {
    throw httpError('Variant nadurıs');
  }
  const originalIndex = order[idx];
  const correctIndex = item.options.findIndex((o) => o === item.correctAnswer);
  const isCorrect = originalIndex === correctIndex;

  let spent = Number(timeSpentMs);
  if (!Number.isFinite(spent) || spent < 0) spent = 0;
  spent = Math.min(spent, 24 * 60 * 60 * 1000);

  await db.query(
    `UPDATE quiz_attempt_questions
     SET selected_option_index = ?, selected_original_index = ?, is_correct = ?,
         time_spent_ms = ?, answered_at = CURRENT_TIMESTAMP, viewed = 1
     WHERE attempt_id = ? AND question_id = ?`,
    [idx, originalIndex, isCorrect ? 1 : 0, Math.round(spent), attemptId, Number(qid)]
  );

  if (isCorrect) {
    await db.query(`UPDATE quiz_questions SET times_correct = times_correct + 1 WHERE id = ?`, [
      item.id,
    ]);
  }
  try {
    const { resolveDictTitleIdFromQuiz } = await import('./quizDictBridge.js');
    const dictTitleId = await resolveDictTitleIdFromQuiz({
      correctAnswer: item.correctAnswer,
      question: item.question,
    });
    if (isCorrect) {
      await recordCorrect(actorId, {
        questionId: item.id,
        dictTitleId,
        source: 'adaptive',
      });
    } else {
      await upsertMistake(actorId, {
        questionId: item.id,
        dictTitleId,
        source: 'adaptive',
        prompt: item.question,
      });
    }
    const sibling = siblingCreditPlan({
      actorId,
      source: 'adaptive',
      questionId: item.id,
      dictTitleId,
      correct: Boolean(isCorrect),
      prompt: item.question,
    });
    if (sibling) {
      await creditSiblingRowsByDictTitle(actorId, sibling.dictTitleId, sibling);
    }
  } catch (e) {
    console.error('Mistake bank (adaptive):', e.message);
  }
  await recalibrateItem(item.id);

  const [answeredRows] = await db.query(
    `SELECT qq.id, qq.irt_difficulty AS b, qq.irt_discrimination AS a, qq.irt_guessing AS c,
            aq.is_correct AS isCorrect, q.level
     FROM quiz_attempt_questions aq
     JOIN quiz_questions qq ON qq.id = aq.question_id
     JOIN quizzes q ON q.id = qq.quiz_id
     WHERE aq.attempt_id = ? AND aq.is_correct IS NOT NULL`,
    [attemptId]
  );

  const responses = answeredRows.map((r) => ({
    a: r.a != null ? Number(r.a) : 1,
    b: r.b != null ? Number(r.b) : difficultyFromLevel(r.level),
    c: r.c != null ? Number(r.c) : 0.2,
    correct: Boolean(r.isCorrect),
  }));

  const thetaStart = attempt.theta_start != null ? Number(attempt.theta_start) : 0;
  const prevResponses = responses.slice(0, -1);
  const thetaPrev = prevResponses.length
    ? updateTheta(thetaStart, prevResponses).theta
    : thetaStart;
  const { theta, se } = updateTheta(thetaStart, responses);
  const thetaDelta = roundTheta(theta - thetaPrev);
  const sessionDelta = roundTheta(theta - thetaStart);

  const ability = await getAbilityRow(actorId, attempt.skill || 'global');
  await saveAbility(
    actorId,
    attempt.skill || 'global',
    theta,
    se,
    Number(ability.attempts || 0) + 1
  );

  await recordEvent(actorId, 'adaptive_answered', {
    quizId: attempt.quiz_id,
    attemptId,
    payload: { questionId: qid, score: isCorrect ? 1 : 0, thetaDelta },
  });

  const answeredCount = answeredRows.length;
  const total = Number(attempt.total) || DEFAULT_MAX;
  const finished = answeredCount >= total;

  const feedbackBase = {
    correct: isCorrect,
    theta: roundTheta(theta),
    thetaSe: roundTheta(se),
    thetaPrev: roundTheta(thetaPrev),
    thetaDelta,
    timeSpentMs: Math.round(spent),
  };

  if (finished) {
    const score = answeredRows.filter((r) => r.isCorrect).length;
    await db.query(
      `UPDATE quiz_attempts
       SET status = 'completed', score = ?, theta_end = ?, completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [score, theta, attemptId]
    );
    const points = await awardAdaptivePoints(actorId, attempt, attemptId, score, total);
    const practice = await practicePayloadForAttempt(attemptId);
    return {
      attemptId,
      status: 'completed',
      ...feedbackBase,
      score,
      total,
      thetaStart: roundTheta(thetaStart),
      sessionThetaDelta: sessionDelta,
      points,
      practice,
      done: true,
    };
  }

  const seen = new Set(attempt.questionOrder.map(String));
  const next = selectNextItem(bank, theta, seen);
  if (!next) {
    const score = answeredRows.filter((r) => r.isCorrect).length;
    await db.query(
      `UPDATE quiz_attempts
       SET status = 'completed', score = ?, theta_end = ?, completed_at = CURRENT_TIMESTAMP, total = ?
       WHERE id = ?`,
      [score, theta, answeredCount, attemptId]
    );
    const points = await awardAdaptivePoints(actorId, attempt, attemptId, score, answeredCount);
    const practice = await practicePayloadForAttempt(attemptId);
    const exhausted = buildAdaptiveBankExhaustedMeta();
    return {
      attemptId,
      status: 'completed',
      ...feedbackBase,
      score,
      total: answeredCount,
      thetaStart: roundTheta(thetaStart),
      sessionThetaDelta: sessionDelta,
      points,
      practice,
      done: true,
      ...exhausted,
    };
  }

  const optionOrder = shuffleOrder(next.options.length);
  const newOrder = [...attempt.questionOrder.map(String), String(next.id)];
  const newOrders = { ...attempt.optionOrders, [String(next.id)]: optionOrder };
  const pos = newOrder.length - 1;
  const nextDifficultyHint = difficultyHint(next.b, theta);

  await db.query(
    `UPDATE quiz_instances SET question_order = ?, option_orders = ? WHERE id = ?`,
    [JSON.stringify(newOrder), JSON.stringify(newOrders), attempt.instance_id]
  );
  await db.query(
    `INSERT INTO quiz_attempt_questions
     (attempt_id, question_id, position, viewed, question_started_at)
     VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)`,
    [attemptId, next.id, pos]
  );
  await db.query(`UPDATE quiz_attempts SET current_index = ?, quiz_id = ? WHERE id = ?`, [
    pos,
    next.quizId,
    attemptId,
  ]);
  await db.query(`UPDATE quiz_questions SET times_seen = times_seen + 1 WHERE id = ?`, [next.id]);

  return {
    attemptId,
    status: 'in_progress',
    ...feedbackBase,
    currentIndex: pos,
    total,
    nextDifficultyHint,
    question: publicItem(next, optionOrder),
    done: false,
    serverNow: new Date().toISOString(),
  };
}
