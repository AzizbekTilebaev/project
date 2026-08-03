/**
 * Sóz oyını (dict game) mid-session resume — localStorage.
 */

import { emitResumeChanged } from './resumeEvents';

export const DICT_GAME_CONTINUE_KEY = 'qp_dict_game_continue';
const TTL_MS = 24 * 3600 * 1000;

function readRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(DICT_GAME_CONTINUE_KEY) || 'null');
    if (!raw?.roundId || !Array.isArray(raw.questions) || !raw.questions.length) {
      return null;
    }
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(DICT_GAME_CONTINUE_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

export function buildDictGameHref({
  source = 'all',
  ids = [],
  goal = null,
  exit = null,
} = {}) {
  const q = new URLSearchParams();
  const src = String(source || 'all').toLowerCase();
  if (src && src !== 'all') q.set('source', src);
  const idList = [...new Set((ids || []).map(String).filter(Boolean))].slice(0, 40);
  if (idList.length) q.set('ids', idList.join(','));
  if (goal) q.set('goal', String(goal));
  if (exit) q.set('exit', String(exit));
  const qs = q.toString();
  return qs ? `/dictionary/game?${qs}` : '/dictionary/game';
}

export function dictGameSessionKey({ source = 'all', ids = [], goal = null } = {}) {
  const src = String(source || 'all').toLowerCase();
  const idList = [...new Set((ids || []).map(String).filter(Boolean))].slice(0, 40).join(',');
  return `${src}|${idList}|${goal || ''}`;
}

function normalizeContinuePicked(rawPicked, question) {
  if (rawPicked == null || rawPicked === '') return null;
  if (question?.kind === 'produce' || question?.kind === 'produce_reverse') {
    return String(rawPicked);
  }
  const n = Number(rawPicked);
  return Number.isInteger(n) ? n : null;
}

/**
 * @returns {{
 *   roundId: string,
 *   questions: array,
 *   answers: object,
 *   index: number,
 *   score: number,
 *   streak: number,
 *   bestStreak: number,
 *   picked: number|string|null,
 *   correctIndex: number|null,
 *   correctLemma: string|null,
 *   correctGloss: string|null,
 *   nearMiss: boolean,
 *   source: string,
 *   ids: string[],
 *   goal: string|null,
 *   exit: string|null,
 *   sessionKey: string,
 *   total: number,
 *   href: string,
 *   updatedAt: number,
 * }|null}
 */
export function getContinueDictGame() {
  const raw = readRaw();
  if (!raw) return null;
  const source = String(raw.source || 'all').toLowerCase();
  const ids = Array.isArray(raw.ids) ? raw.ids.map(String).filter(Boolean) : [];
  const goal = raw.goal ? String(raw.goal) : null;
  const exit = raw.exit ? String(raw.exit) : null;
  const index = Number(raw.index) || 0;
  const total = raw.questions.length;
  const question = raw.questions[index] || null;
  return {
    roundId: String(raw.roundId),
    questions: raw.questions,
    answers: raw.answers && typeof raw.answers === 'object' ? raw.answers : {},
    index,
    score: Number(raw.score) || 0,
    streak: Number(raw.streak) || 0,
    bestStreak: Number(raw.bestStreak) || 0,
    picked: normalizeContinuePicked(raw.picked, question),
    correctIndex: raw.correctIndex != null ? Number(raw.correctIndex) : null,
    correctLemma: raw.correctLemma ? String(raw.correctLemma) : null,
    correctGloss: raw.correctGloss ? String(raw.correctGloss) : null,
    nearMiss: Boolean(raw.nearMiss),
    source,
    ids,
    goal,
    exit,
    sessionKey: dictGameSessionKey({ source, ids, goal }),
    total,
    href: buildDictGameHref({ source, ids, goal, exit }),
    updatedAt: Number(raw.at) || 0,
  };
}

/**
 * Oynaw waqtında saqlaw.
 * @param {object} meta
 */
export function touchDictGameContinue(meta) {
  const roundId = String(meta?.roundId || '').trim();
  const questions = Array.isArray(meta?.questions) ? meta.questions : [];
  if (!roundId || !questions.length) return null;
  const source = String(meta.source || 'all').toLowerCase();
  const ids = Array.isArray(meta.ids) ? meta.ids.map(String).filter(Boolean).slice(0, 40) : [];
  const goal = meta.goal ? String(meta.goal) : null;
  const exit = meta.exit ? String(meta.exit) : null;
  const index = Number(meta.index) || 0;
  const question = questions[index] || null;
  const next = {
    roundId,
    questions,
    answers: meta.answers && typeof meta.answers === 'object' ? meta.answers : {},
    index,
    score: Number(meta.score) || 0,
    streak: Number(meta.streak) || 0,
    bestStreak: Number(meta.bestStreak) || 0,
    picked: normalizeContinuePicked(meta.picked, question),
    correctIndex: meta.correctIndex != null ? Number(meta.correctIndex) : null,
    correctLemma: meta.correctLemma ? String(meta.correctLemma) : null,
    correctGloss: meta.correctGloss ? String(meta.correctGloss) : null,
    nearMiss: Boolean(meta.nearMiss),
    source,
    ids,
    goal,
    exit,
    at: Date.now(),
  };
  try {
    localStorage.setItem(DICT_GAME_CONTINUE_KEY, JSON.stringify(next));
    emitResumeChanged();
  } catch {
    /* ignore quota */
  }
  return getContinueDictGame();
}

export function clearDictGameContinue() {
  try {
    localStorage.removeItem(DICT_GAME_CONTINUE_KEY);
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}
