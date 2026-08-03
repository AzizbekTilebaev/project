/**
 * Soft unatqanlar mashq navbatı (localStorage).
 * Bookmarks ózgermeydi — tek mashq ids / missed / completed.
 */

import { emitResumeChanged } from './resumeEvents';
import { mergeFocusedPracticeResults } from './readingPractice';

export const FAVORITES_PRACTICE_KEY = 'qp_favorites_practice';
const TTL_MS = 14 * 24 * 3600 * 1000;
const MAX_IDS = 40;

function uniqueIds(list) {
  return [...new Set((list || []).map(String).filter(Boolean))];
}

function writePractice({ ids = [], missedIds = [], completedIds = [] } = {}) {
  const nextIds = uniqueIds(ids).slice(0, MAX_IDS);
  const nextMissed = uniqueIds(missedIds).slice(0, MAX_IDS);
  const nextCompleted = uniqueIds(completedIds).slice(0, MAX_IDS);
  try {
    if (!nextIds.length && !nextMissed.length && !nextCompleted.length) {
      localStorage.removeItem(FAVORITES_PRACTICE_KEY);
    } else {
      localStorage.setItem(
        FAVORITES_PRACTICE_KEY,
        JSON.stringify({
          ids: nextIds,
          missedIds: nextMissed,
          completedIds: nextCompleted,
          at: Date.now(),
        })
      );
    }
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}

export function readFavoritesPractice() {
  try {
    const raw = JSON.parse(localStorage.getItem(FAVORITES_PRACTICE_KEY) || 'null');
    if (!raw) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(FAVORITES_PRACTICE_KEY);
      return null;
    }
    return {
      ids: uniqueIds(raw.ids).slice(0, MAX_IDS),
      missedIds: uniqueIds(raw.missedIds).slice(0, MAX_IDS),
      completedIds: uniqueIds(raw.completedIds).slice(0, MAX_IDS),
      at: raw.at || null,
    };
  } catch {
    return null;
  }
}

/**
 * Soft round start — completed soft id ler qayta qosılmaydı.
 * @param {string[]} titleIds
 */
export function seedFavoritesPractice(titleIds = []) {
  const prev = readFavoritesPractice() || {
    ids: [],
    missedIds: [],
    completedIds: [],
  };
  const completed = new Set(prev.completedIds);
  const incoming = uniqueIds(titleIds).filter((id) => !completed.has(id));
  if (!incoming.length) {
    return prev;
  }
  const ids = uniqueIds([...incoming, ...prev.ids]).filter((id) => !completed.has(id));
  const missedIds = prev.missedIds.filter((id) => !completed.has(id));
  writePractice({
    ids,
    missedIds,
    completedIds: prev.completedIds,
  });
  return readFavoritesPractice();
}

/**
 * Dict-game tamam (exit=favorites) — durıs dequeue + completed; qáte → missedIds.
 * Júrek (bookmark) ózgermeydi.
 * @param {Array<{ id: string, correct: boolean }>} results
 */
export function applyFavoritesPracticeResults(results = []) {
  const prev = readFavoritesPractice() || {
    ids: [],
    missedIds: [],
    completedIds: [],
  };
  const merged = mergeFocusedPracticeResults(prev, results);
  const completed = uniqueIds([
    ...prev.completedIds,
    ...results.filter((r) => r?.correct && r?.id).map((r) => String(r.id)),
  ]).slice(0, MAX_IDS);
  writePractice({
    ids: merged.ids,
    missedIds: merged.missedIds,
    completedIds: completed,
  });
  return {
    ids: merged.ids,
    missedIds: merged.missedIds,
    completedIds: completed,
  };
}
