/**
 * Quiz / adaptive sessiya → fokuslı mashq navbatı (localStorage).
 */

import { emitResumeChanged } from './resumeEvents';
import { mergeFocusedPracticeResults } from './readingPractice';
import { markFirstRunPathComplete } from './firstRunProgress';

export const QUIZ_PRACTICE_KEY = 'qp_quiz_practice';
const TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_IDS = 40;

function uniqueIds(list) {
  return [...new Set((list || []).map(String).filter(Boolean))];
}

function writePractice({ ids = [], missedIds = [] } = {}) {
  const nextIds = uniqueIds(ids).slice(0, MAX_IDS);
  const nextMissed = uniqueIds(missedIds).slice(0, MAX_IDS);
  try {
    if (!nextIds.length && !nextMissed.length) {
      localStorage.removeItem(QUIZ_PRACTICE_KEY);
    } else {
      localStorage.setItem(
        QUIZ_PRACTICE_KEY,
        JSON.stringify({
          ids: nextIds,
          missedIds: nextMissed,
          at: Date.now(),
        })
      );
    }
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}

export function readQuizPractice() {
  try {
    const raw = JSON.parse(localStorage.getItem(QUIZ_PRACTICE_KEY) || 'null');
    if (!raw) return null;
    const ids = uniqueIds(raw.ids).slice(0, MAX_IDS);
    const missedIds = uniqueIds(raw.missedIds).slice(0, MAX_IDS);
    if (!ids.length && !missedIds.length) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(QUIZ_PRACTICE_KEY);
      return null;
    }
    return { ids, missedIds, at: raw.at || null };
  } catch {
    return null;
  }
}

/**
 * Test tamam — session practice seed.
 * @returns {{ ids: string[], missedIds: string[] }}
 */
export function recordQuizPracticeComplete({ titleIds = [], missedIds = [] } = {}) {
  const ids = uniqueIds(titleIds).slice(0, MAX_IDS);
  const missed = uniqueIds(missedIds).slice(0, MAX_IDS);
  if (ids.length || missed.length) {
    writePractice({ ids: ids.length ? ids : missed, missedIds: missed });
  }
  markFirstRunPathComplete('quiz');
  const next = readQuizPractice();
  return {
    ids: next?.ids || [],
    missedIds: next?.missedIds || [],
  };
}

/**
 * Dict-game tamam (exit=quiz) — durıs dequeue, qáte → missedIds.
 * @param {Array<{ id: string, correct: boolean }>} results
 */
export function applyQuizPracticeResults(results = []) {
  const prev = readQuizPractice();
  const next = mergeFocusedPracticeResults(prev, results);
  writePractice(next);
  return next;
}
