/**
 * Fokuslı lugʻat mashq URL (pool pad joq).
 * Oqıw / krossvord / immersiya: missedIds birinshi.
 */

const MAX_IDS = 40;

function uniqueIds(list) {
  return [...new Set((list || []).map(String).filter(Boolean))];
}

/** Tek berilgen id ler — source=focused. */
export function focusedPracticeHref(ids, { exit = null } = {}) {
  const list = uniqueIds(ids).slice(0, MAX_IDS);
  if (!list.length) return null;
  const q = new URLSearchParams({
    source: 'focused',
    ids: list.join(','),
  });
  if (exit) q.set('exit', exit);
  return `/dictionary/game?${q.toString()}`;
}

/**
 * Missed sózler birinshi; kem bolsa session vocabı menen toldırıladı (global pool emes).
 */
export function buildMissedFirstFocusIds(practice, { minCount = 3 } = {}) {
  const missed = uniqueIds(practice?.missedIds);
  const all = uniqueIds(practice?.ids);
  if (!missed.length && !all.length) return [];
  if (missed.length >= minCount) return missed.slice(0, MAX_IDS);
  if (missed.length) return uniqueIds([...missed, ...all]).slice(0, MAX_IDS);
  return all.slice(0, MAX_IDS);
}

export function buildReadingFocusIds(practice, opts) {
  return buildMissedFirstFocusIds(practice, opts);
}

export function buildCrosswordFocusIds(practice, opts) {
  return buildMissedFirstFocusIds(practice, opts);
}

/** Sof: fokuslı mashq nátiyjeleri → jańa ids / missedIds. */
export function mergeFocusedPracticeResults(practice, results = []) {
  let ids = uniqueIds(practice?.ids);
  let missedIds = uniqueIds(practice?.missedIds);
  for (const r of results) {
    const id = String(r?.id || '').trim();
    if (!id) continue;
    if (r.correct) {
      ids = ids.filter((x) => x !== id);
      missedIds = missedIds.filter((x) => x !== id);
    } else if (!missedIds.includes(id)) {
      missedIds = [id, ...missedIds];
    }
  }
  return {
    ids: ids.slice(0, MAX_IDS),
    missedIds: missedIds.slice(0, MAX_IDS),
  };
}

/** @deprecated alias — mergeFocusedPracticeResults */
export const mergeImmersionPracticeResults = mergeFocusedPracticeResults;

/**
 * @returns {string|null}
 */
export function readingPracticeHref(practice, { minCount = 3, exit = 'reading' } = {}) {
  return focusedPracticeHref(buildMissedFirstFocusIds(practice, { minCount }), { exit });
}

export function immersionPracticeHref(practice, { minCount = 3, exit = 'immersion' } = {}) {
  return focusedPracticeHref(buildMissedFirstFocusIds(practice, { minCount }), { exit });
}

export function crosswordPracticeHref(practice, { minCount = 3, exit = 'crossword' } = {}) {
  return focusedPracticeHref(buildMissedFirstFocusIds(practice, { minCount }), { exit });
}

/**
 * Unatqanlar: ≥3 → source=favorites; az bolsa focused soft (pool pad joq).
 * Soft queue (practice) missed-first; completed soft id lar qayta kelmeydi.
 * @param {Array<{id?: string}|string>} items
 * @param {{ minFull?: number, exit?: string, practice?: { ids?: string[], missedIds?: string[], completedIds?: string[] }|null }} [opts]
 */
export function favoritesPracticeHref(items, { minFull = 3, exit = 'favorites', practice = null } = {}) {
  const favIds = uniqueIds((items || []).map((x) => (x && typeof x === 'object' ? x.id : x)));
  if (!favIds.length) return null;

  const completed = new Set(uniqueIds(practice?.completedIds));
  const active = {
    ids: uniqueIds(practice?.ids).filter((id) => favIds.includes(id) && !completed.has(id)),
    missedIds: uniqueIds(practice?.missedIds).filter(
      (id) => favIds.includes(id) && !completed.has(id)
    ),
  };
  // Soft queue (missed-first) wins even when ≥ minFull — full pool only when soft empty
  let softFocus = buildMissedFirstFocusIds(active, { minCount: 1 });
  if (softFocus.length) {
    return focusedPracticeHref(softFocus, { exit });
  }

  if (favIds.length >= minFull) {
    return '/dictionary/game?source=favorites';
  }

  const focus = favIds.filter((id) => !completed.has(id));
  if (!focus.length) return null;
  return focusedPracticeHref(focus, { exit });
}

/**
 * 0 unatqan — sońǵı kórilgenlerden soft (exit=favorites), completed soft respekt.
 */
export function favoritesEmptySoftHref(recentItems, { practice = null, limit = 8, exit = 'favorites' } = {}) {
  const recentIds = uniqueIds(
    (recentItems || []).map((x) => (x && typeof x === 'object' ? x.id : x))
  ).slice(0, limit);
  if (!recentIds.length) return null;
  const completed = new Set(uniqueIds(practice?.completedIds));
  const active = {
    ids: uniqueIds(practice?.ids).filter((id) => recentIds.includes(id) && !completed.has(id)),
    missedIds: uniqueIds(practice?.missedIds).filter(
      (id) => recentIds.includes(id) && !completed.has(id)
    ),
  };
  let focus = buildMissedFirstFocusIds(active, { minCount: 1 });
  if (!focus.length) {
    focus = recentIds.filter((id) => !completed.has(id));
  }
  if (!focus.length) return null;
  return focusedPracticeHref(focus, { exit });
}

export function jumbaqPracticeHref(practice, { minCount = 3, exit = 'jumbaq' } = {}) {
  return focusedPracticeHref(buildMissedFirstFocusIds(practice, { minCount }), { exit });
}

export function quizPracticeHref(practice, { minCount = 3, exit = 'quiz' } = {}) {
  return focusedPracticeHref(buildMissedFirstFocusIds(practice, { minCount }), { exit });
}
