/**
 * Jaqında kórilgen sózler → mashq URL + source-faithful exit.
 */

export function recentPracticeHref(items, { limit = 12, exit = null } = {}) {
  const ids = [...new Set((items || []).map((x) => x?.id).filter(Boolean).map(String))].slice(
    0,
    limit
  );
  if (!ids.length) return null;
  const q = new URLSearchParams({
    source: 'recent',
    ids: ids.join(','),
  });
  if (exit) q.set('exit', exit);
  return `/dictionary/game?${q.toString()}`;
}

/** Mashq tugaganda qaytıw jolı. */
export function sourceExitHref(source, { isWodGoal = false, exit = null } = {}) {
  if (exit === 'reading') return '/tutor/practice?from=reading';
  if (exit === 'immersion') return '/tutor/practice?from=immersion';
  if (exit === 'crossword') return '/tutor/practice?from=crossword';
  if (exit === 'jumbaq') return '/tutor/practice?from=jumbaq';
  if (exit === 'quiz') return '/tutor/practice?from=quiz';
  if (exit === 'favorites') return '/dictionary/favorites';
  if (isWodGoal || source === 'checkin') return '/';
  if (source === 'favorites') return '/dictionary/favorites';
  if (source === 'mistakes') return '/tutor/practice';
  if (source === 'focused') return '/tutor/practice';
  if (source === 'recent') return '/dictionary';
  return '/dictionary';
}

/**
 * @returns {string} KAA key yamasa oddıy matn
 */
export function sourceExitLabelKey(source, { isWodGoal = false, exit = null } = {}) {
  if (exit === 'reading') return 'practiceReading';
  if (exit === 'immersion') return 'practiceImmersion';
  if (exit === 'crossword') return 'practiceCrossword';
  if (exit === 'jumbaq') return 'practiceJumbaq';
  if (exit === 'quiz') return 'practiceQuizShort';
  if (exit === 'favorites') return 'yoqtirilganlar';
  if (isWodGoal || source === 'checkin') return 'basBet';
  if (source === 'favorites') return 'yoqtirilganlar';
  if (source === 'mistakes') return 'practiceTitle';
  if (source === 'focused') return 'practiceTitle';
  if (source === 'recent') return 'practiceRecent';
  return 'sozlik';
}
