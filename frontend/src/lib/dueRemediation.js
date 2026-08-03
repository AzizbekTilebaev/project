/**
 * Due / qáte remediation — produce-first (Tutor), tanıp alıw ekinshi.
 */

export const DUE_TUTOR_HREF = '/games';
export const DUE_MISTAKES_DICT_HREF = '/dictionary/game?source=mistakes';

/** Bankada due/top bar — Tutor produce. */
export function dueTutorHref(hasBankMistakes) {
  return hasBankMistakes ? DUE_TUTOR_HREF : null;
}

/** Tanıp alıw (MCQ) — ekinshi lane. */
export function dueMistakesDictHref(hasBankMistakes) {
  return hasBankMistakes ? DUE_MISTAKES_DICT_HREF : null;
}

/**
 * Quiz/adaptive tamam primary: Tutor produce-first.
 * Sessiya focused queue — ekinshi (tanıp alıw).
 */
export function dueRemediationPrimaryHref({ hasMistakes = false } = {}) {
  if (hasMistakes) return DUE_TUTOR_HREF;
  return null;
}

/** Free-strip / ekinshi: focused queue yamasa dict MCQ. */
export function dueRemediationSecondaryHref({
  focusHref = null,
  hasMistakes = false,
} = {}) {
  if (focusHref) return focusHref;
  return dueRemediationDictHref({ hasMistakes });
}

/** Free-strip / ekinshi: dict MCQ yamasa ápiwayı oyın. */
export function dueRemediationDictHref({ hasMistakes = false } = {}) {
  return hasMistakes ? DUE_MISTAKES_DICT_HREF : '/dictionary/game';
}
