import crypto from 'crypto';
import { pools, DB } from '../config/db.js';
import { listTopMistakes, listDue, upsertMistake, recordCorrect, creditSiblingRowsByDictTitle, siblingCreditPlan } from './mistakeBankService.js';
import { parseOptions } from './quizService.js';
import { recordEvent } from './actorService.js';
import { buildLocalLesson } from './localTutorAiService.js';
import TusindirmeModel from '../models/tusindirme.model.js';
import searchFold from '../utils/searchFold.js';
import { clozeWordInSentence } from '../utils/clozeWord.js';
import {
  gradeGlossProduceSubmission,
  gradeProduceSubmission,
} from '../utils/produceGrade.js';

const db = pools.ai;
const dictModel = new TusindirmeModel();

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function localDateString(offsetMinutes = 0) {
  const now = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function localHour(offsetMinutes = 0) {
  const now = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return now.getUTCHours();
}

function localMinute(offsetMinutes = 0) {
  const now = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return now.getUTCMinutes();
}

function localWeekday(offsetMinutes = 0) {
  const now = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return now.getUTCDay();
}

function parseClock(timeStr) {
  const m = String(timeStr || '08:00').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { hour: 8, minute: 0 };
  return {
    hour: Math.min(23, Math.max(0, Number(m[1]))),
    minute: Math.min(59, Math.max(0, Number(m[2]))),
  };
}

async function getTutorPrefs(actorId) {
  const [[row]] = await db.query(
    `SELECT plan_json FROM tutor_sessions
     WHERE actor_id = ? ORDER BY session_date DESC LIMIT 1`,
    [actorId]
  );
  const plan =
    row && typeof row.plan_json === 'string'
      ? JSON.parse(row.plan_json)
      : row?.plan_json || {};
  const scheduledTime = /^\d{2}:\d{2}$/.test(String(plan.scheduledTime))
    ? String(plan.scheduledTime)
    : '08:00';
  const scheduledDays = Array.isArray(plan.scheduledDays)
    ? plan.scheduledDays.map(Number).filter((d) => d >= 0 && d <= 6)
    : [0, 1, 2, 3, 4, 5, 6];
  return {
    scheduledTime,
    scheduledDays: scheduledDays.length ? scheduledDays : [0, 1, 2, 3, 4, 5, 6],
  };
}

/** Sessiya ashılmasa da kún/waqıt sazlawın jańalaw (mehmon/unavailable). */
export async function updateTutorSchedulePrefs(
  actorId,
  { scheduledTime = '08:00', scheduledDays = null } = {}
) {
  const time = /^\d{2}:\d{2}$/.test(String(scheduledTime)) ? String(scheduledTime) : '08:00';
  const days = Array.isArray(scheduledDays)
    ? [...new Set(scheduledDays.map(Number).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [0, 1, 2, 3, 4, 5, 6];
  if (!days.length) throw httpError('Keminde bir kún saylań');

  const [[row]] = await db.query(
    `SELECT id, plan_json FROM tutor_sessions
     WHERE actor_id = ? ORDER BY session_date DESC LIMIT 1`,
    [actorId]
  );

  if (row) {
    const plan =
      typeof row.plan_json === 'string' ? JSON.parse(row.plan_json) : row.plan_json || {};
    plan.scheduledTime = time;
    plan.scheduledDays = days;
    await db.query(`UPDATE tutor_sessions SET plan_json = ? WHERE id = ?`, [
      JSON.stringify(plan),
      row.id,
    ]);
  } else {
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO tutor_sessions (id, actor_id, session_date, plan_json, status, score, total)
       VALUES (?, ?, '1970-01-01', ?, 'completed', 0, 0)`,
      [id, actorId, JSON.stringify({ items: [], scheduledTime: time, scheduledDays: days })]
    );
  }

  return { scheduledTime: time, scheduledDays: days, available: false };
}

async function dictContext(dictTitleId) {
  if (!dictTitleId) return { word: null, definition: null, example: null };
  try {
    const word = await dictModel.getSozById(dictTitleId);
    if (!word) return { word: null, definition: null, example: null };
    const senses = await dictModel.getAniqlamalarBySozId(dictTitleId);
    const first = senses?.[0];
    let example = null;
    if (first?.id) {
      const examples = await dictModel.getMisallarByAniqlamaId([first.id]);
      example = examples?.[0]?.example || null;
    }
    return {
      word: word.soz || null,
      definition: first?.description || null,
      example,
    };
  } catch {
    return { word: null, definition: null, example: null };
  }
}

/**
 * Tutor juwabı → mistake_bank uniqueKey menen birdey jazıw.
 * source plan itemde saqlanadı; meta.source — eski sessiyalar ushın fallback.
 */
export function mistakeBankTouchFromTutorItem(item, { correct }) {
  const source =
    item?.source ||
    item?.meta?.source ||
    (item?.kind === 'quiz' ? 'quiz' : 'dict_game');
  const questionId = item?.questionId ?? null;
  const dictTitleId = item?.dictTitleId || item?.meta?.dictTitleId || null;
  if (correct) {
    return { op: 'correct', args: { questionId, dictTitleId, source } };
  }
  return {
    op: 'upsert',
    args: {
      questionId,
      dictTitleId,
      source,
      prompt: item?.prompt || null,
    },
  };
}

/** Produce: accepted lemmas (fold) — juwap matni klientke ketpeydi. */
export function buildProduceAccepted(word) {
  const raw = String(word || '').trim();
  if (!raw) return [];
  const folded = searchFold(raw);
  return [...new Set([raw, folded].filter(Boolean))];
}

/** Sof: produce juwapın bahalaw (exact yamasa soft near-miss). */
export function gradeTutorProduceAnswer(accepted = [], submitted) {
  return gradeProduceSubmission(accepted, submitted).correct;
}

/** Soft detail — Tutor API nearMiss flag ushın. */
export function gradeTutorProduceSubmission(accepted = [], submitted) {
  return gradeProduceSubmission(accepted, submitted);
}

/** Soft detail — produce_reverse (gloss) ushın keńirek soft. */
export function gradeTutorGlossSubmission(accepted = [], submitted) {
  return gradeGlossProduceSubmission(accepted, submitted);
}

/**
 * Dual-direction: stubborn mistakes → reverse first; else alternate by mistakeId.
 * Sof — unit test.
 */
export function shouldTutorProduceReverse({ mistakeId, wrongCount = 1 } = {}) {
  const n = Number(wrongCount) || 1;
  if (n >= 3) return true;
  const id = String(mistakeId || '');
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 2 === 1;
}

/**
 * Quiz/adaptive bank qatarında dict lemma+anıqlama bar bolsa —
 * recognition MCQ emes, produce / sense_mcq.
 * Sof — unit test.
 */
export function preferTutorProduceOverQuiz({ word, definition } = {}) {
  return Boolean(String(word || '').trim() && String(definition || '').trim());
}

/**
 * Leech (wrongCount ≥ 3): dict mısalında lemma bar bolsa — contextual cloze.
 * @returns {{ prompt: string, accepted: string[] }|null}
 */
export function buildTutorExampleCloze({ example, word } = {}) {
  const sentence = String(example || '')
    .replace(/\s+/g, ' ')
    .trim();
  const lemma = String(word || '').trim();
  if (sentence.length < 16 || !lemma) return null;
  const prompt = clozeWordInSentence(sentence, lemma);
  if (!prompt || prompt === sentence || !prompt.includes('_____')) return null;
  const accepted = buildProduceAccepted(lemma);
  if (!accepted.length) return null;
  return { prompt, accepted };
}

/** Sof: leech + usable example → cloze modality. */
export function shouldTutorExampleCloze({ wrongCount = 1, example, word } = {}) {
  if ((Number(wrongCount) || 1) < 3) return false;
  return Boolean(buildTutorExampleCloze({ example, word }));
}

/** Sof: immersion + audio → listen→type. */
export function shouldTutorListenProduce({ source, hasAudio } = {}) {
  return String(source || '').toLowerCase() === 'immersion' && Boolean(hasAudio);
}

async function pickImmersionAudioUrl(dictTitleId) {
  const id = String(dictTitleId || '').trim();
  if (!id) return null;
  try {
    const { listImmersionForWord } = await import('./immersionService.js');
    const assets = await listImmersionForWord(id);
    const audio = (assets || []).find(
      (a) => a?.kind === 'audio' && a?.fileAccess?.url
    );
    return audio?.fileAccess?.url || null;
  } catch {
    return null;
  }
}

function clipSenseDef(text, max = 110) {
  const s = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Lemma → typed anıqlama: qısqa gloss accepted list.
 * Juwap klientke ketpeydi. Juda qısqa / shuwlı → [].
 * Sof — unit test.
 */
export function buildTutorGlossAccepted(definition, { max = 80, minLen = 12 } = {}) {
  const clipped = clipSenseDef(definition, max);
  if (!clipped || clipped.length < minLen) return [];
  const variants = [clipped];
  if (clipped.endsWith('…')) {
    const bare = clipped.slice(0, -1).trim();
    if (bare.length >= minLen) variants.push(bare);
  }
  const accepted = [];
  for (const v of variants) {
    for (const part of buildProduceAccepted(v)) {
      if (part && !accepted.some((x) => searchFold(x) === searchFold(part))) {
        accepted.push(part);
      }
    }
  }
  return accepted;
}

/** Sof: gloss typed reverse múmkin be (MCQ fallback ushın). */
export function shouldTutorTypedReverse({ definition } = {}) {
  return buildTutorGlossAccepted(definition).length > 0;
}

/**
 * Lemma → anıqlama MCQ (options + quiz-style meta).
 * @returns {{ options: string[], order: number[], correctAnswer: string, pool: string[] }|null}
 */
export function buildTutorSenseMcq({ definition, distractorDefs = [], seed = '' } = {}) {
  const correct = clipSenseDef(definition);
  if (!correct) return null;
  const correctFold = searchFold(correct);
  const distractors = [];
  for (const raw of distractorDefs) {
    const d = clipSenseDef(raw);
    if (!d) continue;
    if (searchFold(d) === correctFold) continue;
    if (distractors.some((x) => searchFold(x) === searchFold(d))) continue;
    distractors.push(d);
    if (distractors.length >= 3) break;
  }
  if (distractors.length < 3) return null;
  const pool = [correct, ...distractors];
  const order = pool.map((_, i) => i);
  let h = 0;
  const key = String(seed || correct);
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  for (let i = order.length - 1; i > 0; i -= 1) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    pool,
    order,
    correctAnswer: correct,
    options: order.map((i) => pool[i]),
  };
}

/** Sof: sense_mcq / quiz-style optionIndex. */
export function gradeTutorSenseMcqAnswer(meta, optionIndex) {
  if (!meta || !Array.isArray(meta.order) || !Array.isArray(meta.options)) return false;
  const idx = Number(optionIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= meta.order.length) return false;
  const given = meta.options[meta.order[idx]];
  return given === meta.correctAnswer;
}

async function fetchDefinitionDistractors(excludeTitleId, limit = 32) {
  try {
    const exclude = excludeTitleId != null ? String(excludeTitleId) : '';
    const [rows] = await pools.tusindirme.query(
      `SELECT d.description AS description
       FROM description d
       INNER JOIN titles t ON t.id = d.titles_id AND t.status = 1
       WHERE (? = '' OR t.id <> ?)
         AND d.sort_order = (
           SELECT MIN(d2.sort_order) FROM description d2 WHERE d2.titles_id = t.id
         )
         AND CHAR_LENGTH(TRIM(d.description)) > 8
       ORDER BY RAND()
       LIMIT ?`,
      [exclude, exclude, Math.max(8, Number(limit) || 32)]
    );
    return (rows || []).map((r) => r.description).filter(Boolean);
  } catch {
    return [];
  }
}

async function applyTutorBankTouch(actorId, item, correct) {
  const touch = mistakeBankTouchFromTutorItem(item, { correct });
  if (touch.op === 'correct') {
    if (touch.args.dictTitleId || touch.args.questionId) {
      await recordCorrect(actorId, touch.args);
    }
  } else {
    await upsertMistake(actorId, touch.args);
  }
  const sibling = siblingCreditPlan({
    actorId,
    ...touch.args,
    correct,
  });
  if (sibling) {
    await creditSiblingRowsByDictTitle(actorId, sibling.dictTitleId, sibling);
  }
}

/**
 * Produce yamasa sense_mcq item (quiz recognition emes).
 * questionId — quiz-sourced bank uniqueKey ushın saqlanadı.
 * @returns {Promise<object|null>}
 */
async function buildProduceOrSenseItem(m, { ctx, dictTitleId, source, questionId = null }) {
  if (!preferTutorProduceOverQuiz(ctx)) return null;
  const wrongCount = m.wrongCount || m.wrong_count || 1;
  const base = {
    mistakeId: m.id,
    dictTitleId,
    source,
    ...(questionId != null ? { questionId } : {}),
  };

  // Leech: contextual cloze (mısal) — reverse MCQ-dan aldın
  const cloze = shouldTutorExampleCloze({
    wrongCount,
    example: ctx.example,
    word: ctx.word,
  })
    ? buildTutorExampleCloze({ example: ctx.example, word: ctx.word })
    : null;
  if (cloze) {
    const lesson = buildLocalLesson({
      prompt: cloze.prompt,
      wrongCount,
      source,
      word: ctx.word,
      definition: ctx.definition,
      example: ctx.example,
      mode: 'example_cloze',
    });
    return {
      ...base,
      kind: 'example_cloze',
      prompt: cloze.prompt,
      options: null,
      lesson,
      _meta: { source, dictTitleId, accepted: cloze.accepted },
    };
  }

  // Immersion seed: tıńla → sóz jazıw (audio bar bolsa)
  if (String(source || '').toLowerCase() === 'immersion') {
    const audioUrl = await pickImmersionAudioUrl(dictTitleId);
    if (shouldTutorListenProduce({ source, hasAudio: Boolean(audioUrl) })) {
      const accepted = buildProduceAccepted(ctx.word);
      const lesson = buildLocalLesson({
        prompt: '',
        wrongCount,
        source,
        word: ctx.word,
        definition: ctx.definition,
        example: ctx.example,
        mode: 'listen_produce',
      });
      return {
        ...base,
        kind: 'listen_produce',
        prompt: 'Tıńlań — eslegen sózdi jazıń',
        audioUrl,
        options: null,
        lesson,
        _meta: { source, dictTitleId, accepted },
      };
    }
  }

  const wantReverse = shouldTutorProduceReverse({
    mistakeId: m.id,
    wrongCount,
  });
  if (wantReverse) {
    // Stubborn cards: typed gloss produce (recognition MCQ emes)
    const glossAccepted = buildTutorGlossAccepted(ctx.definition);
    if (shouldTutorTypedReverse({ definition: ctx.definition }) && glossAccepted.length) {
      const lesson = buildLocalLesson({
        prompt: ctx.word,
        wrongCount,
        source,
        word: ctx.word,
        definition: ctx.definition,
        example: ctx.example,
        mode: 'produce_reverse',
      });
      return {
        ...base,
        kind: 'produce_reverse',
        prompt: ctx.word,
        options: null,
        lesson,
        _meta: { source, dictTitleId, accepted: glossAccepted },
      };
    }
    // Gloss juda uzın/qısqa — sense_mcq fallback
    const distractors = await fetchDefinitionDistractors(dictTitleId, 40);
    const mcq = buildTutorSenseMcq({
      definition: ctx.definition,
      distractorDefs: distractors,
      seed: String(m.id || ctx.word),
    });
    if (mcq) {
      const lesson = buildLocalLesson({
        prompt: ctx.word,
        wrongCount,
        source,
        word: ctx.word,
        definition: ctx.definition,
        example: ctx.example,
        mode: 'produce_reverse',
      });
      return {
        ...base,
        kind: 'sense_mcq',
        prompt: ctx.word,
        options: mcq.options,
        lesson,
        _meta: {
          order: mcq.order,
          correctAnswer: mcq.correctAnswer,
          options: mcq.pool,
          source,
          dictTitleId,
        },
      };
    }
  }
  const accepted = buildProduceAccepted(ctx.word);
  const lesson = buildLocalLesson({
    prompt: ctx.definition,
    wrongCount,
    source,
    word: ctx.word,
    definition: ctx.definition,
    example: ctx.example,
    mode: 'produce',
  });
  return {
    ...base,
    kind: 'produce',
    prompt: ctx.definition,
    options: null,
    lesson,
    _meta: { source, dictTitleId, accepted },
  };
}

async function enrichMistake(m) {
  const source = m.source || (m.questionId ? 'quiz' : 'dict_game');
  let dictTitleId = m.dictTitleId ? String(m.dictTitleId) : null;
  let ctx = await dictContext(dictTitleId);
  let quizRow = null;

  if (m.questionId) {
    const [[q]] = await db.query(
      `SELECT id, question, options, correct_answer AS correctAnswer
       FROM ${DB.quiz}.quiz_questions WHERE id = ? LIMIT 1`,
      [m.questionId]
    );
    if (q) {
      quizRow = q;
      if (!dictTitleId) {
        try {
          const { resolveDictTitleIdFromQuiz } = await import('./quizDictBridge.js');
          dictTitleId = await resolveDictTitleIdFromQuiz({
            correctAnswer: q.correctAnswer,
            question: q.question,
          });
          if (dictTitleId && m.id) {
            await db.query(
              `UPDATE mistake_bank
               SET dict_title_id = ?
               WHERE id = ? AND (dict_title_id IS NULL OR dict_title_id = '')`,
              [dictTitleId, m.id]
            );
          }
        } catch {
          /* bridge optional */
        }
      }
      if (dictTitleId && !ctx.word) {
        ctx = await dictContext(dictTitleId);
      }
    }
  }

  // Dict lemma+anıqlama → produce / sense_mcq (quiz MCQ-dan aldın)
  const produced = await buildProduceOrSenseItem(m, {
    ctx,
    dictTitleId,
    source,
    questionId: quizRow?.id ?? m.questionId ?? null,
  });
  if (produced) return produced;

  // Bridge joq / anıqlama joq — quiz recognition MCQ
  if (quizRow) {
    const options = parseOptions(quizRow.options);
    const order = options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const lesson = buildLocalLesson({
      prompt: quizRow.question,
      wrongCount: m.wrongCount || m.wrong_count || 1,
      source,
      word: ctx.word,
      definition: ctx.definition,
      example: ctx.example,
    });
    return {
      mistakeId: m.id,
      kind: 'quiz',
      questionId: quizRow.id,
      dictTitleId,
      source,
      prompt: quizRow.question,
      options: order.map((i) => options[i]),
      lesson,
      _meta: {
        order,
        correctAnswer: quizRow.correctAnswer,
        options,
        source,
        dictTitleId,
      },
    };
  }

  const prompt = m.prompt || ctx.word || 'Qayta kóriw';
  const lesson = buildLocalLesson({
    prompt,
    wrongCount: m.wrongCount || m.wrong_count || 1,
    source,
    word: ctx.word,
    definition: ctx.definition,
    example: ctx.example,
  });
  return {
    mistakeId: m.id,
    kind: 'prompt',
    prompt,
    options: null,
    dictTitleId,
    source,
    lesson,
    _meta: { source, dictTitleId },
  };
}

export async function getOrCreateDailySession(
  actorId,
  { timezoneOffsetMinutes = 0, force = false } = {}
) {
  const offset = Number(timezoneOffsetMinutes) || 0;
  const hour = localHour(offset);
  const minute = localMinute(offset);
  const weekday = localWeekday(offset);
  const sessionDate = localDateString(offset);
  const prefs = await getTutorPrefs(actorId);
  const clock = parseClock(prefs.scheduledTime);

  const [[existing]] = await db.query(
    `SELECT * FROM tutor_sessions WHERE actor_id = ? AND session_date = ? LIMIT 1`,
    [actorId, sessionDate]
  );
  if (existing) {
    return publicSession(existing);
  }

  // Qáte bankında aktiv/due xatolar bar bolsa — jadval qápisini aylanıp ótiw
  let openNow = Boolean(force);
  if (!openNow) {
    try {
      const due = await listDue(actorId, 1);
      if (due.length) {
        openNow = true;
      } else {
        const top = await listTopMistakes(actorId, 1);
        if (top.length) openNow = true;
      }
    } catch {
      /* bank oqılmasa jadval boyınsha */
    }
  }

  if (!openNow && !prefs.scheduledDays.includes(weekday)) {
    return {
      available: false,
      reason: 'wrong_day',
      opensAtHour: clock.hour,
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      sessionDate,
      localHour: hour,
      localWeekday: weekday,
      reviewNowAvailable: false,
    };
  }

  const nowMins = hour * 60 + minute;
  const openMins = clock.hour * 60 + clock.minute;
  if (!openNow && nowMins < openMins) {
    return {
      available: false,
      reason: 'before_time',
      opensAtHour: clock.hour,
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      sessionDate,
      localHour: hour,
      localWeekday: weekday,
      reviewNowAvailable: false,
    };
  }

  let mistakes = await listDue(actorId, 20);
  if (mistakes.length < 5) {
    const top = await listTopMistakes(actorId, 20);
    const seen = new Set(mistakes.map((m) => m.id));
    for (const m of top) {
      if (!seen.has(m.id)) mistakes.push(m);
      if (mistakes.length >= 10) break;
    }
  }

  // Bo‘sh bank — soxta seed joq; paydalanıwshını test/oyınǵa baǵdarlaymız
  if (!mistakes.length) {
    return {
      available: false,
      reason: 'empty_bank',
      opensAtHour: clock.hour,
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      sessionDate,
      localHour: hour,
      localWeekday: weekday,
      reviewNowAvailable: false,
      practiceLinks: {
        quiz: '/quiz',
        dictGame: '/dictionary/game',
        immersion: '/dictionary/immersion',
        crossword: '/crossword',
        books: '/books',
        jumbaq: '/jumbaqlar',
        firstRun: '/',
      },
    };
  }

  const items = [];
  for (const m of mistakes.slice(0, 10)) {
    const enriched = await enrichMistake(m);
    items.push({
      mistakeId: enriched.mistakeId,
      kind: enriched.kind,
      questionId: enriched.questionId || null,
      dictTitleId: enriched.dictTitleId || null,
      source: enriched.source || null,
      prompt: enriched.prompt,
      options: enriched.options,
      audioUrl: enriched.audioUrl || null,
      lesson: enriched.lesson,
      meta: enriched._meta,
      answered: false,
      correct: null,
    });
  }

  const id = crypto.randomUUID();
  const plan = {
    items: items.map(({ meta, ...rest }) => ({ ...rest, meta })),
    scheduledTime: prefs.scheduledTime,
    scheduledDays: prefs.scheduledDays,
  };
  await db.query(
    `INSERT INTO tutor_sessions (id, actor_id, session_date, plan_json, status, score, total)
     VALUES (?, ?, ?, ?, 'active', 0, ?)`,
    [id, actorId, sessionDate, JSON.stringify(plan), items.length]
  );
  await recordEvent(actorId, 'tutor_started', { payload: { total: items.length } });

  const [[row]] = await db.query(`SELECT * FROM tutor_sessions WHERE id = ?`, [id]);
  return publicSession(row);
}

function publicSession(row) {
  const plan =
    typeof row.plan_json === 'string' ? JSON.parse(row.plan_json) : row.plan_json || { items: [] };
  const items = (plan.items || []).map((it) => ({
    mistakeId: it.mistakeId,
    kind: it.kind,
    questionId: it.questionId,
    // Produce: lemma/id jasırın — juwap berilgenshe sózlikke ótpey
    dictTitleId:
      (it.kind === 'produce' ||
        it.kind === 'produce_reverse' ||
        it.kind === 'sense_mcq' ||
        it.kind === 'example_cloze' ||
        it.kind === 'listen_produce') &&
      !it.answered
        ? null
        : it.dictTitleId,
    prompt: it.prompt,
    options: it.options,
    audioUrl: it.kind === 'listen_produce' && !it.answered ? it.audioUrl || null : null,
    lesson: it.lesson || null,
    answered: Boolean(it.answered),
    correct: it.correct,
  }));
  const days = Array.isArray(plan.scheduledDays)
    ? plan.scheduledDays.map(Number).filter((d) => d >= 0 && d <= 6)
    : [0, 1, 2, 3, 4, 5, 6];
  return {
    available: true,
    id: row.id,
    sessionDate: row.session_date,
    status: row.status,
    score: row.score,
    total: row.total,
    scheduledTime: plan.scheduledTime || '08:00',
    scheduledDays: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
    items,
  };
}

/** In-app reminder — no email/push vendor. */
export async function getReminderStatus(actorId, { timezoneOffsetMinutes = 0 } = {}) {
  const offset = Number(timezoneOffsetMinutes) || 0;
  const prefs = await getTutorPrefs(actorId);
  const hour = localHour(offset);
  const minute = localMinute(offset);
  const weekday = localWeekday(offset);
  const sessionDate = localDateString(offset);
  const clock = parseClock(prefs.scheduledTime);
  const nowMins = hour * 60 + minute;
  const openMins = clock.hour * 60 + clock.minute;

  const [[today]] = await db.query(
    `SELECT status, score, total FROM tutor_sessions
     WHERE actor_id = ? AND session_date = ? LIMIT 1`,
    [actorId, sessionDate]
  );

  if (today?.status === 'completed') {
    return {
      due: false,
      reason: 'completed',
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      sessionStatus: 'completed',
      deepLink: '/tutor',
    };
  }

  // Aktiv qáteler bar — jadvaldan aldın da esletiw
  let hasMistakes = false;
  try {
    const due = await listDue(actorId, 1);
    if (due.length) hasMistakes = true;
    else {
      const top = await listTopMistakes(actorId, 1);
      hasMistakes = top.length > 0;
    }
  } catch {
    hasMistakes = false;
  }

  if (hasMistakes) {
    return {
      due: true,
      reason: today ? 'in_progress' : 'mistakes_ready',
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      sessionStatus: today?.status || null,
      score: today?.score ?? null,
      total: today?.total ?? null,
      deepLink: '/tutor',
    };
  }

  if (!prefs.scheduledDays.includes(weekday)) {
    return {
      due: false,
      reason: 'wrong_day',
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      localWeekday: weekday,
      deepLink: '/tutor',
    };
  }

  if (nowMins < openMins) {
    return {
      due: false,
      reason: 'before_time',
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      localHour: hour,
      deepLink: '/tutor',
    };
  }

  // Jadval waqtı keldi, biraq qáte joq — esletpe shaqırma
  if (today) {
    return {
      due: true,
      reason: 'in_progress',
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      sessionStatus: today.status,
      score: today.score ?? null,
      total: today.total ?? null,
      deepLink: '/tutor',
    };
  }

  return {
    due: false,
    reason: 'empty_bank',
    scheduledTime: prefs.scheduledTime,
    scheduledDays: prefs.scheduledDays,
    deepLink: '/quiz',
  };
}

export async function answerTutorItem(actorId, { sessionId, mistakeId, optionIndex, answer }) {
  const [[row]] = await db.query(
    `SELECT * FROM tutor_sessions WHERE id = ? AND actor_id = ? LIMIT 1`,
    [sessionId, actorId]
  );
  if (!row) throw httpError('Sessiya tabılmadı', 404);
  if (row.status === 'completed') throw httpError('Sessiya tamamlanǵan', 409);

  const plan =
    typeof row.plan_json === 'string' ? JSON.parse(row.plan_json) : row.plan_json || { items: [] };
  const item = (plan.items || []).find((it) => it.mistakeId === mistakeId);
  if (!item) throw httpError('Element tabılmadı', 404);
  if (item.answered) throw httpError('Álle qáwanlanǵan', 409);

  let correct = false;
  let nearMiss = false;
  if ((item.kind === 'quiz' || item.kind === 'sense_mcq') && item.meta) {
    const idx = Number(optionIndex);
    const order = item.meta.order;
    if (!Number.isInteger(idx) || idx < 0 || idx >= order.length) {
      throw httpError('Variant qáte');
    }
    correct =
      item.kind === 'sense_mcq'
        ? gradeTutorSenseMcqAnswer(item.meta, idx)
        : item.meta.options[order[idx]] === item.meta.correctAnswer;
    await applyTutorBankTouch(actorId, item, correct);
  } else if (
    (item.kind === 'produce' ||
      item.kind === 'produce_reverse' ||
      item.kind === 'example_cloze' ||
      item.kind === 'listen_produce' ||
      item.kind === 'prompt') &&
    Array.isArray(item.meta?.accepted) &&
    item.meta.accepted.length
  ) {
    const submitted = String(answer ?? '').trim();
    if (!submitted) {
      throw httpError(
        item.kind === 'produce_reverse' ? 'Anıqlamanı jazıń' : 'Sózdi jazıń',
        400
      );
    }
    const graded =
      item.kind === 'produce_reverse'
        ? gradeTutorGlossSubmission(item.meta.accepted, submitted)
        : gradeTutorProduceSubmission(item.meta.accepted, submitted);
    correct = graded.correct;
    nearMiss = graded.nearMiss;
    await applyTutorBankTouch(actorId, item, correct);
  } else {
    // Eski prompt / anıqlamasız — self-report (legacy)
    correct = true;
    await applyTutorBankTouch(actorId, item, true);
  }

  item.answered = true;
  item.correct = correct;
  delete item.meta;

  const score = (plan.items || []).filter((it) => it.correct).length;
  const allDone = (plan.items || []).every((it) => it.answered);
  const status = allDone ? 'completed' : 'active';

  await db.query(
    `UPDATE tutor_sessions
     SET plan_json = ?, score = ?, status = ?,
         completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
     WHERE id = ?`,
    [JSON.stringify(plan), score, status, status, sessionId]
  );

  if (allDone) {
    await recordEvent(actorId, 'tutor_completed', {
      payload: { score, total: row.total },
    });
  }

  return {
    correct,
    nearMiss,
    score,
    status,
    done: allDone,
  };
}

export async function updateTutorPlan(
  actorId,
  { sessionId, orderedMistakeIds, scheduledTime = '08:00', scheduledDays = null }
) {
  const [[row]] = await db.query(
    `SELECT * FROM tutor_sessions WHERE id = ? AND actor_id = ? LIMIT 1`,
    [sessionId, actorId]
  );
  if (!row) throw httpError('Sessiya tabılmadı', 404);
  if (row.status === 'completed') throw httpError('Tamamlanǵan dars ózgertilmeydi', 409);

  const plan =
    typeof row.plan_json === 'string' ? JSON.parse(row.plan_json) : row.plan_json || { items: [] };
  const ids = Array.isArray(orderedMistakeIds) ? orderedMistakeIds.map(String) : [];
  const byId = new Map((plan.items || []).map((item) => [String(item.mistakeId), item]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  for (const item of plan.items || []) {
    if (!ids.includes(String(item.mistakeId))) ordered.push(item);
  }

  const time = /^\d{2}:\d{2}$/.test(String(scheduledTime)) ? String(scheduledTime) : '08:00';
  const days = Array.isArray(scheduledDays)
    ? [...new Set(scheduledDays.map(Number).filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b)
    : Array.isArray(plan.scheduledDays)
      ? plan.scheduledDays
      : [0, 1, 2, 3, 4, 5, 6];
  if (!days.length) throw httpError('Keminde bir kún saylań');

  plan.items = ordered;
  plan.scheduledTime = time;
  plan.scheduledDays = days;

  await db.query(`UPDATE tutor_sessions SET plan_json = ? WHERE id = ?`, [
    JSON.stringify(plan),
    sessionId,
  ]);
  const [[fresh]] = await db.query(`SELECT * FROM tutor_sessions WHERE id = ?`, [sessionId]);
  return publicSession(fresh);
}

export async function getSession(actorId, { sessionId = null, timezoneOffsetMinutes = 0 } = {}) {
  const row = sessionId
    ? (
        await db.query(`SELECT * FROM tutor_sessions WHERE id = ? AND actor_id = ? LIMIT 1`, [
          sessionId,
          actorId,
        ])
      )[0][0]
    : (
        await db.query(
          `SELECT * FROM tutor_sessions WHERE actor_id = ? AND session_date = ? LIMIT 1`,
          [actorId, localDateString(Number(timezoneOffsetMinutes) || 0)]
        )
      )[0][0];
  if (!row) return null;
  return publicSession(row);
}

export async function getMistakes(actorId) {
  const top = await listTopMistakes(actorId, 20);
  const due = await listDue(actorId, 20);
  return { top, due };
}
