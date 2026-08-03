/**
 * Guest / localStorage oqıw signalı — Háptelik esap empty CTAs.
 */

import { getImmersionListenMeta, getContinueImmersion } from './immersionProgress';
import { getReadingLessonMeta } from './readingProgress';
import { getReadingLessonSrsMeta } from './readingLessonSrs';
import { getJumbaqRevealMeta, getContinueJumbaq } from './jumbaqProgress';
import { getCrosswordPracticeMeta, getContinueCrossword } from './crosswordProgress';
import { getContinueQuiz } from './anonymousId';
import { getContinueDictGame } from './dictGameProgress';
import { getContinueAdaptive } from './adaptiveProgress';
import { getContinueBook } from '../components/literature/litUtils';
import { getContinueTutor } from './tutorProgress';
import { readDailyGoal } from './dailyGoalProgress';
import { recentPracticeHref } from './recentPractice';

const RECENT_KEY = 'dictionary:recent:v1';

function readRecentLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((x) => x && x.id);
  } catch {
    return [];
  }
}

/**
 * @returns {{
 *   hasLocal: boolean,
 *   chips: Array<{ id: string, labelKey: string, value: string|number, href: string }>,
 *   primary: { href: string, labelKey: string, icon: string } | null,
 *   immersion: object,
 *   reading: object,
 *   jumbaq: object,
 *   recentCount: number,
 * }}
 */
export function getGuestLocalSummary() {
  const immersion = getImmersionListenMeta();
  const reading = getReadingLessonMeta();
  const readingSrs = getReadingLessonSrsMeta();
  const jumbaq = getJumbaqRevealMeta();
  const crossword = getCrosswordPracticeMeta();
  const continueCrossword = getContinueCrossword();
  const continueQuiz = getContinueQuiz();
  const continueDictGame = getContinueDictGame();
  const continueImmersion = getContinueImmersion();
  const continueJumbaq = getContinueJumbaq();
  const continueAdaptive = getContinueAdaptive();
  const continueBook = getContinueBook();
  const continueTutor = getContinueTutor();
  const continueLearn =
    reading.bookId &&
    ({
      href: `/books/${encodeURIComponent(reading.bookId)}/learn${
        reading.sectionIndex != null ? `?section=${reading.sectionIndex}` : ''
      }`,
    });
  const dueLearn = readingSrs.href
    ? { href: readingSrs.href, dueCount: readingSrs.dueCount }
    : null;
  const recentItems = readRecentLocal();
  const recentHref = recentPracticeHref(recentItems);
  const recentCount = recentItems.length;
  const wodPracticed = Boolean(readDailyGoal()?.practicedId);

  const chips = [];
  if (continueQuiz) {
    chips.push({
      id: 'quiz-continue',
      labelKey: 'continueQuiz',
      value:
        continueQuiz.total != null && continueQuiz.currentIndex != null
          ? `${continueQuiz.currentIndex + 1}/${continueQuiz.total}`
          : 1,
      href: continueQuiz.href,
    });
  }
  if (continueAdaptive) {
    chips.push({
      id: 'adaptive-continue',
      labelKey: 'continueAdaptive',
      value: `${(continueAdaptive.currentIndex || 0) + 1}/${continueAdaptive.total || 10}`,
      href: continueAdaptive.href,
    });
  }
  if (continueTutor) {
    chips.push({
      id: 'tutor-continue',
      labelKey: 'continueTutor',
      value:
        continueTutor.total != null && continueTutor.score != null
          ? `${continueTutor.score}/${continueTutor.total}`
          : 1,
      href: continueTutor.href,
    });
  }
  if (continueBook) {
    chips.push({
      id: 'book-continue',
      labelKey: 'continueBook',
      value:
        continueBook.percent != null ? `${Math.round(continueBook.percent)}%` : 1,
      href: continueBook.href,
    });
  }
  if (continueLearn) {
    chips.push({
      id: 'learn-continue',
      labelKey: 'continueBookLearn',
      value: reading.streak || 1,
      href: continueLearn.href,
    });
  }
  if (continueDictGame) {
    chips.push({
      id: 'dict-game-continue',
      labelKey: 'continueDictGame',
      value: `${(continueDictGame.index || 0) + 1}/${continueDictGame.total || 10}`,
      href: continueDictGame.href,
    });
  }
  if (continueImmersion) {
    chips.push({
      id: 'immersion-continue',
      labelKey: 'continueImmersion',
      value: continueImmersion.soz || 1,
      href: continueImmersion.href,
    });
  }
  if (continueJumbaq) {
    chips.push({
      id: 'jumbaq-continue',
      labelKey: 'continueJumbaq',
      value: continueJumbaq.label || 1,
      href: continueJumbaq.href,
    });
  }
  if (immersion.practiceCount > 0 || immersion.streak > 0) {
    chips.push({
      id: 'immersion',
      labelKey: 'immersionStreak',
      value: immersion.practiceCount || immersion.streak,
      href:
        immersion.practiceCount > 0
          ? '/tutor/practice?from=immersion'
          : '/dictionary/immersion',
    });
  }
  if (reading.practiceCount > 0 || reading.streak > 0) {
    chips.push({
      id: 'reading',
      labelKey: 'readingStreak',
      value: reading.practiceCount || reading.streak,
      href:
        reading.practiceCount > 0 ? '/tutor/practice?from=reading' : '/books',
    });
  }
  if (dueLearn) {
    chips.unshift({
      id: 'reading-due',
      labelKey: 'readingLessonDue',
      value: dueLearn.dueCount || 1,
      href: dueLearn.href,
    });
  }
  if (continueCrossword) {
    chips.push({
      id: 'crossword-continue',
      labelKey: 'continueCrossword',
      value: continueCrossword.solvedCells || 1,
      href: continueCrossword.href,
    });
  }
  if (crossword.practiceCount > 0 || crossword.streak > 0) {
    chips.push({
      id: 'crossword',
      labelKey: 'practiceCrossword',
      value: crossword.practiceCount || crossword.streak,
      href:
        crossword.practiceCount > 0
          ? '/tutor/practice?from=crossword'
          : '/crossword',
    });
  }
  if (jumbaq.todayCount > 0 || jumbaq.streak > 0) {
    chips.push({
      id: 'jumbaq',
      labelKey: 'haptaliqChipJumbaq',
      value: jumbaq.streak || jumbaq.todayCount,
      href: continueJumbaq?.href || '/jumbaqlar',
    });
  }
  if (recentCount > 0) {
    chips.push({
      id: 'recent',
      labelKey: 'practiceRecent',
      value: recentCount,
      href: recentHref || '/dictionary',
    });
  }

  let primary = null;
  if (continueQuiz) {
    primary = {
      href: continueQuiz.href,
      labelKey: 'continueQuiz',
      icon: 'trophy',
    };
  } else if (continueAdaptive) {
    primary = {
      href: continueAdaptive.href,
      labelKey: 'continueAdaptive',
      icon: 'sparkle',
    };
  } else if (continueTutor) {
    primary = {
      href: continueTutor.href,
      labelKey: 'continueTutor',
      icon: 'tutor',
    };
  } else if (dueLearn) {
    primary = {
      href: dueLearn.href,
      labelKey: 'readingLessonDueCta',
      icon: 'grammar',
    };
  } else if (continueBook) {
    primary = {
      href: continueBook.href,
      labelKey: 'continueBook',
      icon: 'book',
    };
  } else if (continueLearn) {
    primary = {
      href: continueLearn.href,
      labelKey: 'continueBookLearn',
      icon: 'grammar',
    };
  } else if (continueImmersion) {
    primary = {
      href: continueImmersion.href,
      labelKey: 'continueImmersion',
      icon: 'sparkle',
    };
  } else if (immersion.practiceCount > 0) {
    primary = {
      href: '/tutor/practice?from=immersion',
      labelKey: 'haptaliqCtaImmersion',
      icon: 'bolt',
    };
  } else if (reading.practiceCount > 0) {
    primary = {
      href: '/tutor/practice?from=reading',
      labelKey: 'haptaliqCtaReading',
      icon: 'bolt',
    };
  } else if (continueCrossword) {
    primary = {
      href: continueCrossword.href,
      labelKey: 'continueCrossword',
      icon: 'grammar',
    };
  } else if (continueDictGame) {
    primary = {
      href: continueDictGame.href,
      labelKey: 'continueDictGame',
      icon: 'gamepad',
    };
  } else if (crossword.practiceCount > 0) {
    primary = {
      href: '/tutor/practice?from=crossword',
      labelKey: 'haptaliqCtaCrossword',
      icon: 'bolt',
    };
  } else if (recentHref) {
    primary = {
      href: recentHref,
      labelKey: 'haptaliqCtaRecent',
      icon: 'clock',
    };
  } else if (continueJumbaq) {
    primary = {
      href: continueJumbaq.href,
      labelKey: 'continueJumbaq',
      icon: 'sparkle',
    };
  } else if (jumbaq.todayCount > 0 || jumbaq.streak > 0) {
    primary = {
      href: '/jumbaqlar',
      labelKey: 'haptaliqCtaJumbaq',
      icon: 'sparkle',
    };
  } else if (!wodPracticed) {
    primary = {
      href: '/#kun-sozi',
      labelKey: 'haptaliqCtaWod',
      icon: 'sparkle',
    };
  } else {
    primary = {
      href: '/tutor/practice',
      labelKey: 'haptaliqCtaPractice',
      icon: 'gamepad',
    };
  }

  return {
    hasLocal: chips.length > 0,
    chips,
    primary,
    immersion,
    reading,
    jumbaq,
    crossword,
    recentCount,
  };
}

/**
 * Guest local week cells (labelKey → KAA). Empty when no local signal.
 * @param {ReturnType<typeof getGuestLocalSummary>} local
 * @returns {Array<{ id: string, labelKey: string, value: string|number, icon: string }>}
 */
export function getGuestLocalWeekCells(local) {
  if (!local?.hasLocal) return [];
  const cells = [];
  if (local.immersion?.streak > 0 || local.immersion?.practiceCount > 0) {
    cells.push({
      id: 'immersion',
      labelKey: 'immersionStreak',
      value: local.immersion.streak || local.immersion.practiceCount,
      icon: 'sparkle',
    });
  }
  if (local.reading?.streak > 0 || local.reading?.practiceCount > 0) {
    cells.push({
      id: 'reading',
      labelKey: 'readingStreak',
      value: local.reading.streak || local.reading.practiceCount,
      icon: 'book',
    });
  }
  if (local.crossword?.streak > 0 || local.crossword?.practiceCount > 0) {
    cells.push({
      id: 'crossword',
      labelKey: 'krossvord',
      value: local.crossword.streak || local.crossword.practiceCount,
      icon: 'grammar',
    });
  }
  if (local.jumbaq?.streak > 0 || local.jumbaq?.todayCount > 0) {
    cells.push({
      id: 'jumbaq',
      labelKey: 'haptaliqChipJumbaq',
      value: local.jumbaq.streak || local.jumbaq.todayCount,
      icon: 'sparkle',
    });
  }
  if (local.recentCount > 0) {
    cells.push({
      id: 'recent',
      labelKey: 'practiceRecent',
      value: local.recentCount,
      icon: 'clock',
    });
  }
  if (local.chips?.length > 0) {
    cells.push({
      id: 'continues',
      labelKey: 'dawamEtiw',
      value: local.chips.length,
      icon: 'bolt',
    });
  }
  return cells;
}
