import crypto from 'crypto';
import { pools } from '../config/db.js';
import { recordEvent } from './actorService.js';

const db = pools.ai;

const BOX_INTERVALS_HOURS = [0, 24, 72, 168, 336, 720];

/** Birinshi durıs juwap — SRS introduce box (24h), readingLessonSrs menen birdey. */
export const LEARNED_INTRODUCE_BOX = 1;

/** Sof: jańa learned card maydanları (DB jazıwsız). */
export function learnedIntroducePlan({ source = 'quiz', prompt = null } = {}) {
  const box = LEARNED_INTRODUCE_BOX;
  return {
    wrongCount: 0,
    correctStreak: 1,
    box,
    dueHours: BOX_INTERVALS_HOURS[box] ?? 24,
    resolved: 0,
    source: String(source || 'quiz')
      .trim()
      .toLowerCase() || 'quiz',
    prompt: prompt || null,
  };
}

/** Due pool: graduated (resolved=1) rows return when due_at elapses. */
export const LIST_DUE_WHERE = 'actor_id = ? AND due_at <= NOW()';

/** Active hard-mistakes ranking — unresolved only. */
export const LIST_TOP_WHERE = 'actor_id = ? AND resolved = 0';

/**
 * Title touch / sibling credit — include resolved so wrong reactivates
 * the same row instead of creating an orphan fallback.
 */
export const TITLE_ROWS_WHERE = 'actor_id = ? AND dict_title_id = ?';

/** Quiz/adaptive: questionId bo‘yicha; dict-only: dictTitleId bo‘yicha. */
export function uniqueKey({ actorId, source, questionId, dictTitleId }) {
  if (questionId != null && String(questionId) !== '') {
    return `${actorId}|${source}|${questionId}|`;
  }
  return `${actorId}|${source}||${dictTitleId || ''}`;
}

function dueFromBox(box) {
  const idx = Math.max(0, Math.min(box, BOX_INTERVALS_HOURS.length - 1));
  // Nullish (not ||) so box 0 correctly means "due immediately" (0 hours),
  // instead of falling back to 24h due to 0 being falsy.
  const hours = BOX_INTERVALS_HOURS[idx] ?? 24;
  return new Date(Date.now() + hours * 3600 * 1000);
}

export async function upsertMistake(actorId, {
  questionId = null,
  dictTitleId = null,
  source = 'quiz',
  prompt = null,
} = {}) {
  const key = uniqueKey({ actorId, source, questionId, dictTitleId });
  const [[existing]] = await db.query(
    `SELECT id, wrong_count AS wrongCount, box FROM mistake_bank WHERE unique_key = ? LIMIT 1`,
    [key]
  );

  if (existing) {
    const box = Math.max(0, Number(existing.box) - 1);
    await db.query(
      `UPDATE mistake_bank
       SET wrong_count = wrong_count + 1, correct_streak = 0, box = ?, due_at = ?,
           last_seen_at = CURRENT_TIMESTAMP, resolved = 0,
           prompt = COALESCE(?, prompt),
           dict_title_id = COALESCE(?, dict_title_id)
       WHERE id = ?`,
      [box, dueFromBox(box), prompt, dictTitleId, existing.id]
    );
  } else {
    await db.query(
      `INSERT INTO mistake_bank
       (id, actor_id, question_id, dict_title_id, source, prompt, wrong_count, correct_streak, box, due_at, unique_key)
       VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, ?, ?)`,
      [
        crypto.randomUUID(),
        actorId,
        questionId,
        dictTitleId,
        source,
        prompt,
        dueFromBox(0),
        key,
      ]
    );
  }
  await recordEvent(actorId, 'mistake_recorded', {
    payload: { mode: source, questionId: questionId != null ? String(questionId) : undefined },
  });
}

export async function recordCorrect(
  actorId,
  { questionId = null, dictTitleId = null, source = 'quiz', prompt = null } = {}
) {
  const key = uniqueKey({ actorId, source, questionId, dictTitleId });
  const [[existing]] = await db.query(
    `SELECT id, correct_streak AS streak, box FROM mistake_bank WHERE unique_key = ? LIMIT 1`,
    [key]
  );
  if (!existing) {
    return introduceLearnedCard(actorId, {
      questionId,
      dictTitleId,
      source,
      prompt,
    });
  }
  await advanceCorrectRow(existing);
  return { introduced: false, advanced: true };
}

/**
 * Birinshi durıs — bankada joq bolsa SRS kartashası (box=1, ~24h due).
 * Bar bolsa advanceCorrectRow.
 */
export async function introduceLearnedCard(
  actorId,
  { questionId = null, dictTitleId = null, source = 'quiz', prompt = null } = {}
) {
  const titleId =
    dictTitleId != null && String(dictTitleId).trim() !== ''
      ? String(dictTitleId).trim()
      : null;
  const qId = questionId != null && String(questionId) !== '' ? questionId : null;
  if (qId == null && !titleId) return { introduced: false };

  const src =
    String(source || 'quiz')
      .trim()
      .toLowerCase() || 'quiz';
  const key = uniqueKey({
    actorId,
    source: src,
    questionId: qId,
    dictTitleId: titleId,
  });
  const [[existing]] = await db.query(
    `SELECT id, correct_streak AS streak, box FROM mistake_bank WHERE unique_key = ? LIMIT 1`,
    [key]
  );
  if (existing) {
    await advanceCorrectRow(existing);
    return { introduced: false, advanced: true };
  }

  const plan = learnedIntroducePlan({ source: src, prompt });
  await db.query(
    `INSERT INTO mistake_bank
     (id, actor_id, question_id, dict_title_id, source, prompt,
      wrong_count, correct_streak, box, due_at, unique_key, resolved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      actorId,
      qId,
      titleId,
      plan.source,
      plan.prompt,
      plan.wrongCount,
      plan.correctStreak,
      plan.box,
      dueFromBox(plan.box),
      key,
      plan.resolved,
    ]
  );
  await recordEvent(actorId, 'learned_introduced', {
    payload: {
      mode: plan.source,
      questionId: qId != null ? String(qId) : undefined,
      dictTitleId: titleId || undefined,
    },
  });
  return { introduced: true, box: plan.box, dueHours: plan.dueHours };
}

let immersionSourceEnumReady = false;

/** Runtime ENUM expand — eski DB-larda immersion insert ushın. */
export async function ensureImmersionSourceEnum() {
  if (immersionSourceEnumReady) return;
  try {
    await db.query(
      `ALTER TABLE mistake_bank
       MODIFY COLUMN source ENUM('quiz','dict_game','adaptive','reading','crossword','immersion','jumbaq') NOT NULL`
    );
  } catch {
    /* already expanded / no DDL */
  }
  immersionSourceEnumReady = true;
}

/**
 * Sof: tıńlaw → introduce args (DB joq).
 * @returns {{ dictTitleId: string, source: 'immersion', prompt: string|null }|null}
 */
export function immersionListenSeedArgs({ dictTitleId, prompt = null } = {}) {
  const id = String(dictTitleId || '').trim();
  if (!id) return null;
  return {
    dictTitleId: id,
    source: 'immersion',
    prompt: prompt != null && String(prompt).trim() ? String(prompt).trim() : null,
  };
}

/**
 * Authed tıńlaw — birinshi ret introduce (box=1).
 * Qayta tıńlaw: box óspeydi (advance joq).
 */
export async function seedImmersionListenCard(
  actorId,
  { dictTitleId, prompt = null } = {}
) {
  const args = immersionListenSeedArgs({ dictTitleId, prompt });
  if (!actorId || !args) return { introduced: false };
  await ensureImmersionSourceEnum();

  const key = uniqueKey({
    actorId,
    source: 'immersion',
    questionId: null,
    dictTitleId: args.dictTitleId,
  });
  const [[existing]] = await db.query(
    `SELECT id FROM mistake_bank WHERE unique_key = ? LIMIT 1`,
    [key]
  );
  if (existing) return { introduced: false, already: true };

  try {
    return await introduceLearnedCard(actorId, args);
  } catch (e) {
    // Race: parallel listen — unique_key
    if (/Duplicate|ER_DUP_ENTRY/i.test(String(e?.message || ''))) {
      return { introduced: false, already: true };
    }
    throw e;
  }
}

async function advanceCorrectRow(existing) {
  const streak = Number(existing.streak || existing.correct_streak || 0) + 1;
  const box = Math.min(BOX_INTERVALS_HOURS.length - 1, Number(existing.box || 0) + 1);
  const resolved = streak >= 3 || box >= BOX_INTERVALS_HOURS.length - 1 ? 1 : 0;
  await db.query(
    `UPDATE mistake_bank
     SET correct_streak = ?, box = ?, due_at = ?, last_seen_at = CURRENT_TIMESTAMP, resolved = ?
     WHERE id = ?`,
    [streak, box, dueFromBox(box), resolved, existing.id]
  );
}

async function reinforceWrongRow(existing, prompt = null) {
  const box = Math.max(0, Number(existing.box) - 1);
  await db.query(
    `UPDATE mistake_bank
     SET wrong_count = wrong_count + 1, correct_streak = 0, box = ?, due_at = ?,
         last_seen_at = CURRENT_TIMESTAMP, resolved = 0,
         prompt = COALESCE(?, prompt)
     WHERE id = ?`,
    [box, dueFromBox(box), prompt, existing.id]
  );
}

/**
 * Lugʻat oyını: bir dictTitleId ushın barlıq qatarlar (resolved ham) —
 * wrong → reactivate; correct → due_at uzaytırıw.
 * Match joq bolsa fallbackSource (default dict_game).
 */
export async function touchMistakeBankByDictTitle(
  actorId,
  dictTitleId,
  { correct, prompt = null, fallbackSource = 'dict_game' } = {}
) {
  const titleId = String(dictTitleId || '').trim();
  if (!titleId) return { touched: 0 };

  const [rows] = await db.query(
    `SELECT id, correct_streak AS streak, box, wrong_count AS wrongCount, source, resolved
     FROM mistake_bank
     WHERE ${TITLE_ROWS_WHERE}`,
    [actorId, titleId]
  );

  const source =
    String(fallbackSource || 'dict_game')
      .trim()
      .toLowerCase() || 'dict_game';

  if (!rows.length) {
    if (correct) {
      const result = await introduceLearnedCard(actorId, {
        dictTitleId: titleId,
        source,
        prompt,
      });
      return {
        touched: result.introduced || result.advanced ? 1 : 0,
        introduced: Boolean(result.introduced),
        fallback: source,
      };
    }
    await upsertMistake(actorId, {
      dictTitleId: titleId,
      source,
      prompt,
    });
    return { touched: 0, fallback: source };
  }

  for (const row of rows) {
    if (correct) {
      await advanceCorrectRow(row);
    } else {
      await reinforceWrongRow(row, prompt);
    }
  }
  return { touched: rows.length };
}

/**
 * Primary uniqueKey alle qolǵan — sol dictTitleId dıń basqa qatarların
 * (resolved ham) jıljıtıw (fallback create joq). Quiz/adaptive/tutor ushın.
 */
export async function creditSiblingRowsByDictTitle(
  actorId,
  dictTitleId,
  { correct, prompt = null, excludeKey = null } = {}
) {
  const titleId = String(dictTitleId || '').trim();
  if (!titleId) return { touched: 0 };

  let sql = `SELECT id, correct_streak AS streak, box, wrong_count AS wrongCount, source, resolved
     FROM mistake_bank
     WHERE ${TITLE_ROWS_WHERE}`;
  const params = [actorId, titleId];
  if (excludeKey) {
    sql += ' AND unique_key <> ?';
    params.push(String(excludeKey));
  }

  const [rows] = await db.query(sql, params);
  for (const row of rows) {
    if (correct) {
      await advanceCorrectRow(row);
    } else {
      await reinforceWrongRow(row, prompt);
    }
  }
  return { touched: rows.length };
}

/**
 * Sof: sibling credit shaqırıwı kerek pe?
 * @returns {{ dictTitleId: string, correct: boolean, prompt: string|null, excludeKey: string }|null}
 */
export function siblingCreditPlan({
  actorId,
  source,
  questionId = null,
  dictTitleId = null,
  correct,
  prompt = null,
} = {}) {
  const titleId = dictTitleId != null ? String(dictTitleId).trim() : '';
  if (!titleId || actorId == null) return null;
  return {
    dictTitleId: titleId,
    correct: Boolean(correct),
    prompt: prompt || null,
    excludeKey: uniqueKey({ actorId, source, questionId, dictTitleId: titleId }),
  };
}

/** Round source: open lanes + focused → cross-source credit by dictTitleId. */
export function shouldCreditByDictTitle(roundSource) {
  const src = String(roundSource || '')
    .trim()
    .toLowerCase();
  // Legacy / default oyın (source joq yamasa all)
  if (!src || src === 'all') return true;
  return (
    src === 'mistakes' ||
    src === 'focused' ||
    src === 'reading' ||
    src === 'crossword' ||
    src === 'checkin' ||
    src === 'recent' ||
    src === 'favorites'
  );
}

export async function listTopMistakes(actorId, limit = 20) {
  const safe = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const [rows] = await db.query(
    `SELECT id, question_id AS questionId, dict_title_id AS dictTitleId, source, prompt,
            wrong_count AS wrongCount, correct_streak AS correctStreak, box, due_at AS dueAt, resolved
     FROM mistake_bank
     WHERE ${LIST_TOP_WHERE}
     ORDER BY wrong_count DESC, due_at ASC
     LIMIT ${safe}`,
    [actorId]
  );
  return rows;
}

export async function listDue(actorId, limit = 20) {
  const safe = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const [rows] = await db.query(
    `SELECT id, question_id AS questionId, dict_title_id AS dictTitleId, source, prompt,
            wrong_count AS wrongCount, box, due_at AS dueAt, resolved
     FROM mistake_bank
     WHERE ${LIST_DUE_WHERE}
     ORDER BY due_at ASC
     LIMIT ${safe}`,
    [actorId]
  );
  return rows;
}
