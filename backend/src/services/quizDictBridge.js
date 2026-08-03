/**
 * Quiz / adaptive qátelikler → lugʻat title id.
 * correct_answer yamasa sorawdaǵı «sóz» kandidatların tusindirme arqalı sheshedi.
 */
import TusindirmeService from './tusindirmeService.js';

const dictService = new TusindirmeService();

/** Sof: quiz tekstinen sóz kandidatları (DB joq). */
export function extractQuizWordCandidates({ correctAnswer, question } = {}) {
  const out = [];
  const push = (raw) => {
    let t = String(raw || '')
      .replace(/\u00a0/g, ' ')
      .trim();
    if (!t) return;
    t = t.replace(/^[«"'\[]+|[»"'\].,:;!?]+$/g, '').trim();
    if (!t || t.length > 80) return;
    if (/^\d+([.,]\d+)?$/.test(t)) return;
    if (out.some((x) => x.toLocaleLowerCase('kk') === t.toLocaleLowerCase('kk'))) return;
    out.push(t);
  };

  push(correctAnswer);

  const q = String(question || '');
  for (const m of q.matchAll(/[«"“]\s*([^»"”]+?)\s*[»"”]/gu)) {
    push(m[1]);
  }

  return out;
}

async function defaultLookup(word) {
  try {
    const resolved = await dictService.resolveTargetTitle(word);
    return resolved?.id ? String(resolved.id) : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ correctAnswer?: string, question?: string }} payload
 * @param {(word: string) => Promise<string|null>} [lookup]
 * @returns {Promise<string|null>}
 */
export async function resolveDictTitleIdFromQuiz(payload, lookup = defaultLookup) {
  const candidates = extractQuizWordCandidates(payload);
  for (const word of candidates) {
    const id = await lookup(word);
    if (id) return String(id);
  }
  return null;
}

/**
 * Eski mistake_bank qatarları: questionId bar, dict_title_id joq.
 * @returns {Promise<string|null>}
 */
export async function resolveDictTitleIdFromQuestionId(questionId, {
  quizDb,
  lookup = defaultLookup,
} = {}) {
  if (questionId == null || questionId === '') return null;
  if (!quizDb) return null;
  try {
    const [[q]] = await quizDb.query(
      `SELECT question, correct_answer AS correctAnswer
       FROM quiz_questions WHERE id = ? LIMIT 1`,
      [questionId]
    );
    if (!q) return null;
    return resolveDictTitleIdFromQuiz(q, lookup);
  } catch {
    return null;
  }
}

const MAX_PRACTICE_IDS = 40;

/**
 * Session juwapları → fokuslı mashq payload (juwap matni klientke ketmeydi).
 * @param {Array<{ correct?: boolean, correctAnswer?: string, question?: string }>} answered
 * @param {(word: string) => Promise<string|null>} [lookup]
 * @returns {Promise<{ missedIds: string[], titleIds: string[] }>}
 */
export async function buildQuizPracticePayload(answered = [], lookup = defaultLookup) {
  const missedIds = [];
  const linkedIds = [];
  for (const row of answered || []) {
    if (row == null) continue;
    const id = await resolveDictTitleIdFromQuiz(
      { correctAnswer: row.correctAnswer, question: row.question },
      lookup
    );
    if (!id) continue;
    if (!linkedIds.includes(id)) linkedIds.push(id);
    if (row.correct === false && !missedIds.includes(id)) missedIds.push(id);
  }
  const titleIds = [...new Set([...missedIds, ...linkedIds])].slice(0, MAX_PRACTICE_IDS);
  return {
    missedIds: missedIds.slice(0, MAX_PRACTICE_IDS),
    titleIds,
  };
}
