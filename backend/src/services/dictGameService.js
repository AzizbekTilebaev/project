import crypto from 'crypto';
import { pools } from '../config/db.js';
import TusindirmeService from './tusindirmeService.js';
import { computeAttemptPoints, awardPoints } from './pointsService.js';
import {
  buildProduceAccepted,
  buildTutorGlossAccepted,
} from './tutorService.js';
import {
  gradeGlossProduceSubmission,
  gradeProduceSubmission,
} from '../utils/produceGrade.js';

const db = pools.krasvord;
const service = new TusindirmeService();

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function isElevatedProduceSource(source) {
  const s = String(source || '')
    .trim()
    .toLowerCase();
  return (
    s === 'focused' ||
    s === 'mistakes' ||
    s === 'reading' ||
    s === 'crossword' ||
    s === 'jumbaq' ||
    s === 'checkin' ||
    s === 'favorites' ||
    s === 'recent'
  );
}

/**
 * Habit seed — typed produce majburiy (pad pool emes).
 * checkin (WoD) + favorites + recent seed ids.
 * Sof — unit test.
 */
export function shouldForceDictGameProduce({ titleId, source = '', seedIds = [] } = {}) {
  const src = String(source || '')
    .trim()
    .toLowerCase();
  if (src !== 'checkin' && src !== 'favorites' && src !== 'recent') return false;
  const id = String(titleId || '').trim();
  if (!id) return false;
  const seeds = Array.isArray(seedIds) ? seedIds : [];
  return seeds.some((x) => String(x) === id);
}

/**
 * Typed produce slot — titleId (+ roundId) boyınsha deterministik.
 * Oddiy: ~30%; elevated (remediation + checkin/favorites/recent): ~50%.
 * force=true — WoD / favorites / recent seed ushın.
 * Sof — unit test.
 */
export function shouldDictGameProduce({
  titleId,
  roundId = '',
  source = '',
  force = false,
} = {}) {
  const id = String(titleId || '').trim();
  if (!id) return false;
  if (force) return true;
  const key = `${roundId}|${id}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const threshold = isElevatedProduceSource(source) ? 5 : 3;
  return h % 10 < threshold;
}

/**
 * Produce slot ishinde reverse (lemma → gloss) — ~50%.
 * Gloss qabıl etilmese caller MCQ/forwardǵa qaytadı.
 * Sof — unit test.
 */
export function shouldDictGameProduceReverse({ titleId, roundId = '' } = {}) {
  const id = String(titleId || '').trim();
  if (!id) return false;
  const key = `rev|${roundId}|${id}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % 2 === 1;
}

export function isDictGameTypedKind(kind) {
  return kind === 'produce' || kind === 'produce_reverse';
}

/** Client payload — accepted/soz/reveal (produce*) jasırın. */
export function publicDictGameQuestion(q) {
  if (!q) return null;
  if (q.kind === 'produce') {
    return {
      id: q.id,
      category: q.category || null,
      kind: 'produce',
      prompt: q.prompt,
    };
  }
  if (q.kind === 'produce_reverse') {
    return {
      id: q.id,
      category: q.category || null,
      kind: 'produce_reverse',
      prompt: q.prompt,
    };
  }
  return {
    id: q.id,
    soz: q.soz,
    category: q.category || null,
    kind: 'mcq',
    options: q.options,
  };
}

async function awardDictGamePoints(actorId, roundId, score, total) {
  try {
    const [[{ prior }]] = await db.query(
      `SELECT COUNT(*) AS prior FROM dict_game_rounds
       WHERE actor_id = ? AND completed_at IS NOT NULL AND id != ?
         AND DATE(completed_at) = CURDATE()`,
      [actorId, roundId]
    );
    const breakdown = computeAttemptPoints(
      Array.from({ length: total }, (_, i) => ({
        isCorrect: i < score,
        timeSpentMs: null,
      })),
      {
        perfect: score === total && total > 0,
        priorAttempts: Number(prior) || 0,
      }
    );
    const award = await awardPoints(actorId, {
      amount: breakdown.total,
      kind: 'dict_game_completed',
      refId: roundId,
      meta: { score, total, ...breakdown },
    });
    if (!award.awarded && breakdown.total > 0) {
      return {
        earned: 0,
        balance: award.balance,
        level: award.level,
        alreadyAwarded: true,
        leveledUp: false,
        previousLevel: award.previousLevel ?? award.level,
        breakdown,
      };
    }
    return {
      earned: award.amount,
      balance: award.balance,
      level: award.level,
      alreadyAwarded: false,
      leveledUp: Boolean(award.leveledUp),
      previousLevel: award.previousLevel ?? null,
      breakdown,
    };
  } catch (e) {
    console.error('Ball beriwde qátelik (dict_game):', e.message);
    return null;
  }
}

function parseRoundPayload(raw) {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (Array.isArray(parsed)) {
    return { source: null, questions: parsed };
  }
  if (parsed && typeof parsed === 'object') {
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    return {
      source: parsed.source ? String(parsed.source).toLowerCase() : null,
      questions,
    };
  }
  return { source: null, questions: [] };
}

function serializeRoundPayload(source, questions) {
  return JSON.stringify({
    source: source || null,
    questions,
  });
}

/** Start a server-graded dictionary round (no correct indices to client). */
export async function startDictRound(actorId, count = 10, { titleIds, source } = {}) {
  let ids = Array.isArray(titleIds)
    ? [...new Set(titleIds.map(String).filter(Boolean))].slice(0, 40)
    : [];

  const src = String(source || '')
    .trim()
    .toLowerCase();

  if (!ids.length && src === 'mistakes') {
    try {
      const { listDue, listTopMistakes } = await import('./mistakeBankService.js');
      const { resolveDictTitleIdFromQuestionId } = await import('./quizDictBridge.js');
      const { pools } = await import('../config/db.js');
      let rows = await listDue(actorId, Math.max(count * 2, 12));
      if (rows.length < 3) {
        rows = await listTopMistakes(actorId, Math.max(count * 2, 12));
      }
      const resolved = [];
      for (const r of rows) {
        let titleId = r.dictTitleId ? String(r.dictTitleId) : null;
        if (!titleId && r.questionId) {
          titleId = await resolveDictTitleIdFromQuestionId(r.questionId, {
            quizDb: pools.quiz,
          });
          if (titleId && r.id) {
            try {
              await pools.ai.query(
                `UPDATE mistake_bank
                 SET dict_title_id = ?
                 WHERE id = ? AND (dict_title_id IS NULL OR dict_title_id = '')`,
                [titleId, r.id]
              );
            } catch {
              /* best-effort backfill */
            }
          }
        }
        if (titleId) resolved.push(titleId);
      }
      ids = [...new Set(resolved)].slice(0, 40);
    } catch {
      ids = [];
    }
    if (!ids.length) {
      throw httpError('Qáte bankında mashq ushın sóz joq', 404);
    }
  }

  if (src === 'favorites' && !ids.length) {
    throw httpError('Unatqan sózler kerek (keminde 3)', 400);
  }

  if ((src === 'focused' || src === 'reading') && !ids.length) {
    throw httpError('Fokus sózler kerek', 400);
  }

  const padWithPool = src === 'checkin' || src === 'recent';
  const raw = await service.getQuiz(count, {
    titleIds: ids.length ? ids : undefined,
    padWithPool: padWithPool && ids.length > 0,
  });
  const roundId = crypto.randomUUID();
  const seedIds = ids.map(String);
  const questions = (raw.data || []).map((q) => {
    const definition =
      Array.isArray(q.options) && Number.isInteger(q.correct)
        ? String(q.options[q.correct] || '').trim()
        : '';
    const lemma = String(q.soz || '').trim();
    const forceProduce = shouldForceDictGameProduce({
      titleId: q.id,
      source: src,
      seedIds,
    });
    if (
      definition &&
      lemma &&
      shouldDictGameProduce({
        titleId: q.id,
        roundId,
        source: src,
        force: forceProduce,
      })
    ) {
      const glossAccepted = buildTutorGlossAccepted(definition);
      if (
        shouldDictGameProduceReverse({ titleId: q.id, roundId }) &&
        glossAccepted.length
      ) {
        return {
          id: q.id,
          soz: q.soz,
          category: q.category,
          kind: 'produce_reverse',
          prompt: lemma,
          accepted: glossAccepted,
          revealAnswer: glossAccepted[0],
          options: null,
          correct: null,
        };
      }
      return {
        id: q.id,
        soz: q.soz,
        category: q.category,
        kind: 'produce',
        prompt: definition,
        accepted: buildProduceAccepted(lemma),
        options: null,
        correct: null,
      };
    }
    return {
      id: q.id,
      soz: q.soz,
      category: q.category,
      kind: 'mcq',
      options: q.options,
      correct: q.correct,
    };
  });
  if (questions.length < 3) {
    // Fokus: az id bolsa dilutsiyasız qısqa raund (1–2 sóz); basqalar — keminde 3
    const allowShort =
      (src === 'focused' || src === 'reading' || src === 'crossword') && ids.length > 0;
    const minNeeded = allowShort ? Math.min(3, Math.max(1, ids.length)) : 3;
    if (questions.length < minNeeded) {
      throw httpError(
        src === 'favorites' ||
          src === 'focused' ||
          src === 'reading' ||
          (ids.length && !padWithPool)
          ? 'Berilgen sózlerden oyın ushın jetkilikli anıqlama joq'
          : 'Oyın ushın jetkilikli soraw joq',
        503
      );
    }
  }

  await db.query(
    `INSERT INTO dict_game_rounds (id, actor_id, questions_json, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR))`,
    [roundId, actorId, serializeRoundPayload(src || null, questions)]
  );

  if (src === 'checkin') {
    try {
      const { recordEvent } = await import('./actorService.js');
      await recordEvent(actorId, 'wod_game_started', {
        payload: { roundId, count: questions.length, source: src },
      });
    } catch {
      /* optional funnel */
    }
  }

  return {
    roundId,
    count: questions.length,
    source: src || null,
    data: questions.map(publicDictGameQuestion),
  };
}

export async function checkDictAnswer(
  actorId,
  roundId,
  { questionId, optionIndex, answer } = {}
) {
  const [[row]] = await db.query(
    `SELECT * FROM dict_game_rounds WHERE id = ? AND actor_id = ? LIMIT 1`,
    [roundId, actorId]
  );
  if (!row) throw httpError('Raund tabılmadı', 404);
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw httpError('Raund muddeti tamam', 410);
  }
  const { source: roundSource, questions } = parseRoundPayload(row.questions_json);
  const q = questions.find((x) => String(x.id) === String(questionId));
  if (!q) throw httpError('Soraw tabılmadı', 404);

  let correct = false;
  let nearMiss = false;
  let storedAnswer;
  let responseExtra = {};

  if (isDictGameTypedKind(q.kind)) {
    const submitted = String(answer ?? '').trim();
    if (!submitted) {
      throw httpError(
        q.kind === 'produce_reverse' ? 'Anıqlamanı jazıń' : 'Sózdi jazıń',
        400
      );
    }
    if (q.kind === 'produce_reverse') {
      const accepted =
        Array.isArray(q.accepted) && q.accepted.length
          ? q.accepted
          : buildTutorGlossAccepted(
              Array.isArray(q.options) && Number.isInteger(q.correct)
                ? q.options[q.correct]
                : ''
            );
      const graded = gradeGlossProduceSubmission(accepted, submitted);
      correct = graded.correct;
      nearMiss = graded.nearMiss;
      storedAnswer = { kind: 'produce_reverse', answer: submitted };
      responseExtra = {
        nearMiss,
        correctLemma: q.soz,
        correctGloss: q.revealAnswer || accepted[0] || null,
      };
    } else {
      const accepted =
        Array.isArray(q.accepted) && q.accepted.length
          ? q.accepted
          : buildProduceAccepted(q.soz);
      const graded = gradeProduceSubmission(accepted, submitted);
      correct = graded.correct;
      nearMiss = graded.nearMiss;
      storedAnswer = { kind: 'produce', answer: submitted };
      responseExtra = { nearMiss, correctLemma: q.soz };
    }
  } else {
    const opts = Array.isArray(q.options) ? q.options : [];
    const idx = Number(optionIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= opts.length) {
      throw httpError('Variant qáte');
    }
    correct = idx === q.correct;
    storedAnswer = idx;
    responseExtra = { correctIndex: q.correct };
  }

  const prev =
    row.answers_json == null
      ? {}
      : typeof row.answers_json === 'string'
        ? JSON.parse(row.answers_json)
        : row.answers_json;
  prev[q.id] = storedAnswer;
  await db.query(`UPDATE dict_game_rounds SET answers_json = ? WHERE id = ?`, [
    JSON.stringify(prev),
    roundId,
  ]);

  try {
    const {
      upsertMistake,
      recordCorrect,
      touchMistakeBankByDictTitle,
      shouldCreditByDictTitle,
    } = await import('./mistakeBankService.js');
    const titleId = String(q.id);
    const prompt = isDictGameTypedKind(q.kind)
      ? q.prompt || null
      : q.soz
        ? `${q.soz} — anıqlama`
        : null;
    if (shouldCreditByDictTitle(roundSource)) {
      await touchMistakeBankByDictTitle(actorId, titleId, { correct, prompt });
    } else if (correct) {
      await recordCorrect(actorId, { dictTitleId: titleId, source: 'dict_game', prompt });
    } else {
      await upsertMistake(actorId, {
        dictTitleId: titleId,
        source: 'dict_game',
        prompt,
      });
    }
  } catch {
    /* mistake bank optional if tables not ready */
  }

  return { correct, questionId: q.id, ...responseExtra };
}

export async function answerDictRound(actorId, roundId, answers) {
  const [[row]] = await db.query(
    `SELECT * FROM dict_game_rounds WHERE id = ? AND actor_id = ? LIMIT 1`,
    [roundId, actorId]
  );
  if (!row) throw httpError('Raund tabılmadı', 404);
  if (row.completed_at) throw httpError('Raund tamamlanǵan', 409);
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw httpError('Raund muddeti tamam', 410);
  }

  const { questions } = parseRoundPayload(row.questions_json);

  if (!answers || typeof answers !== 'object') {
    throw httpError('answers obyekti kerek');
  }

  let score = 0;
  const results = questions.map((q) => {
    const given = answers[q.id];
    if (isDictGameTypedKind(q.kind)) {
      const submitted =
        typeof given === 'object' && given != null
          ? String(given.answer ?? '').trim()
          : String(given ?? '').trim();
      let graded;
      if (q.kind === 'produce_reverse') {
        const accepted =
          Array.isArray(q.accepted) && q.accepted.length
            ? q.accepted
            : [];
        graded = gradeGlossProduceSubmission(accepted, submitted);
      } else {
        const accepted =
          Array.isArray(q.accepted) && q.accepted.length
            ? q.accepted
            : buildProduceAccepted(q.soz);
        graded = gradeProduceSubmission(accepted, submitted);
      }
      if (graded.correct) score += 1;
      return {
        id: q.id,
        soz: q.soz,
        kind: q.kind,
        givenAnswer: submitted || null,
        correct: graded.correct,
        nearMiss: graded.nearMiss,
      };
    }
    const idx = Number(given);
    const ok = Number.isInteger(idx) && idx === q.correct;
    if (ok) score += 1;
    return {
      id: q.id,
      soz: q.soz,
      kind: 'mcq',
      givenIndex: Number.isInteger(idx) ? idx : null,
      correctIndex: q.correct,
      correct: ok,
    };
  });

  // Mistake bank juwaplar checkDictAnswer arqalı jazıladı (qosarlı credit emes)

  await db.query(
    `UPDATE dict_game_rounds
     SET score = ?, total = ?, completed_at = CURRENT_TIMESTAMP, answers_json = ?
     WHERE id = ?`,
    [score, questions.length, JSON.stringify(answers), roundId]
  );

  const points = await awardDictGamePoints(actorId, roundId, score, questions.length);

  try {
    const { recordEvent } = await import('./actorService.js');
    await recordEvent(actorId, 'dict_game_completed', {
      payload: { roundId, score, total: questions.length, earned: points?.earned ?? 0 },
    });
  } catch {
    /* event optional */
  }

  return { roundId, score, total: questions.length, results, points };
}

export async function listDictRoundsForActor(actorId, limit = 20) {
  const safe = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const [rows] = await db.query(
    `SELECT id, score, total, completed_at AS completedAt, created_at AS createdAt
     FROM dict_game_rounds
     WHERE actor_id = ? AND completed_at IS NOT NULL
     ORDER BY completed_at DESC
     LIMIT ${safe}`,
    [actorId]
  );
  return rows;
}
