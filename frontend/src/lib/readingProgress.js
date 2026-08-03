/**
 * Oqıw darsi → mashq navbatı (localStorage, immersiya patterni).
 */

import { emitResumeChanged } from './resumeEvents.js';
import { mergeFocusedPracticeResults } from './readingPractice.js';

export const READING_PRACTICE_KEY = 'qp_reading_practice';
const DAY_KEY = 'qp_reading_lesson_day';
const STREAK_KEY = 'qp_reading_lesson_streak';
const TTL_MS = 7 * 24 * 3600 * 1000;
const MAX_IDS = 40;

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function readReadingPractice() {
  try {
    const raw = JSON.parse(localStorage.getItem(READING_PRACTICE_KEY) || 'null');
    if (!raw) return null;
    const ids = (raw.ids || []).map(String).filter(Boolean).slice(0, MAX_IDS);
    const missedIds = (raw.missedIds || []).map(String).filter(Boolean).slice(0, MAX_IDS);
    if (!ids.length && !missedIds.length) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(READING_PRACTICE_KEY);
      return null;
    }
    return {
      ids,
      missedIds,
      bookId: raw.bookId || null,
      sectionIndex: raw.sectionIndex != null ? Number(raw.sectionIndex) : null,
      at: raw.at || null,
    };
  } catch {
    return null;
  }
}

export function getReadingLessonStreak() {
  try {
    const day = localStorage.getItem(DAY_KEY);
    const streak = Number(localStorage.getItem(STREAK_KEY) || 0);
    if (!day || !Number.isFinite(streak) || streak < 1) return 0;
    if (day === todayKey() || day === yesterdayKey()) return streak;
    return 0;
  } catch {
    return 0;
  }
}

export function hasReadingPracticedToday() {
  try {
    return localStorage.getItem(DAY_KEY) === todayKey();
  } catch {
    return false;
  }
}

/** UI ushın bir jerden meta. */
export function getReadingLessonMeta() {
  const practice = readReadingPractice();
  const ids = practice?.ids || [];
  const missedIds = practice?.missedIds || [];
  return {
    streak: getReadingLessonStreak(),
    practicedToday: hasReadingPracticedToday(),
    practiceCount: ids.length,
    missedCount: missedIds.length,
    ids,
    missedIds,
    bookId: practice?.bookId || null,
    sectionIndex: practice?.sectionIndex,
  };
}

/**
 * Dars resume (bookId) óshiriw — mashq navbatı (ids) saqlanadı.
 * @param {string|null} bookId
 */
export function clearReadingBookContinue(bookId = null) {
  const practice = readReadingPractice();
  if (!practice?.bookId) return;
  if (bookId != null && String(practice.bookId) !== String(bookId)) return;
  try {
    if (!practice.ids?.length) {
      localStorage.removeItem(READING_PRACTICE_KEY);
    } else {
      localStorage.setItem(
        READING_PRACTICE_KEY,
        JSON.stringify({
          ...practice,
          bookId: null,
          sectionIndex: null,
          at: Date.now(),
        })
      );
    }
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}

/**
 * Dars tamam — navbatqa qosıw + kúnlik streak.
 * @returns {{ ids: string[], streak: number, bookId: string|null }}
 */
export function recordReadingLessonComplete({
  titleIds = [],
  missedIds = [],
  bookId = null,
  sectionIndex = null,
} = {}) {
  const ids = [...new Set((titleIds || []).map(String).filter(Boolean))].slice(0, MAX_IDS);
  const missed = [...new Set((missedIds || []).map(String).filter(Boolean))];

  if (ids.length) {
    try {
      localStorage.setItem(
        READING_PRACTICE_KEY,
        JSON.stringify({
          ids,
          missedIds: missed,
          bookId: bookId || null,
          sectionIndex: sectionIndex != null ? Number(sectionIndex) : null,
          at: Date.now(),
        })
      );
      emitResumeChanged();
    } catch {
      /* ignore quota */
    }
  }

  let streak = getReadingLessonStreak();
  try {
    const today = todayKey();
    const last = localStorage.getItem(DAY_KEY);
    if (last !== today) {
      streak = last === yesterdayKey() ? Math.max(1, streak) + 1 : 1;
      localStorage.setItem(DAY_KEY, today);
      localStorage.setItem(STREAK_KEY, String(streak));
    }
  } catch {
    /* ignore */
  }

  /* first-run play doors: reading no longer a primary path */

  return {
    ids: ids.length ? ids : readReadingPractice()?.ids || [],
    missedIds: missed.length ? missed : readReadingPractice()?.missedIds || [],
    streak,
    bookId: bookId || readReadingPractice()?.bookId || null,
  };
}

/**
 * Dict-game tamam (exit=reading) — durıs dequeue, qáte → missedIds.
 * @param {Array<{ id: string, correct: boolean }>} results
 */
export function applyReadingPracticeResults(results = []) {
  const prev = readReadingPractice();
  const next = mergeFocusedPracticeResults(prev, results);
  try {
    if (!next.ids.length && !next.missedIds.length) {
      localStorage.removeItem(READING_PRACTICE_KEY);
    } else {
      localStorage.setItem(
        READING_PRACTICE_KEY,
        JSON.stringify({
          ids: next.ids,
          missedIds: next.missedIds,
          bookId: prev?.bookId || null,
          sectionIndex: prev?.sectionIndex != null ? prev.sectionIndex : null,
          at: Date.now(),
        })
      );
    }
    emitResumeChanged();
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * Sof: oqıw navbatına title id qosıw (lesson replace emes — append).
 */
export function mergeQueuedReadingTitleId(
  practice,
  titleId,
  { bookId = null, sectionIndex = null } = {}
) {
  const id = String(titleId || '').trim();
  const prevIds = (practice?.ids || []).map(String).filter(Boolean);
  const prevMissed = (practice?.missedIds || []).map(String).filter(Boolean);
  const nextBook = bookId != null ? String(bookId) : practice?.bookId || null;
  const nextSection =
    sectionIndex != null
      ? Number(sectionIndex)
      : practice?.sectionIndex != null
        ? Number(practice.sectionIndex)
        : null;
  if (!id) {
    return {
      ids: prevIds.slice(0, MAX_IDS),
      missedIds: prevMissed.slice(0, MAX_IDS),
      bookId: nextBook,
      sectionIndex: nextSection,
      isNew: false,
    };
  }
  if (prevIds.includes(id)) {
    return {
      ids: prevIds.slice(0, MAX_IDS),
      missedIds: prevMissed.slice(0, MAX_IDS),
      bookId: nextBook,
      sectionIndex: nextSection,
      isNew: false,
    };
  }
  return {
    ids: [id, ...prevIds].slice(0, MAX_IDS),
    missedIds: prevMissed.slice(0, MAX_IDS),
    bookId: nextBook,
    sectionIndex: nextSection,
    isNew: true,
  };
}

/**
 * Kitap oqıwda sóz basıw — mashq navbatına qosıw.
 * @returns {{ ids: string[], missedIds: string[], isNew: boolean }}
 */
export function queueReadingTitleId(titleId, { bookId = null, sectionIndex = null } = {}) {
  const prev = readReadingPractice();
  const next = mergeQueuedReadingTitleId(prev, titleId, { bookId, sectionIndex });
  try {
    if (!next.ids.length && !next.missedIds.length) {
      localStorage.removeItem(READING_PRACTICE_KEY);
    } else {
      localStorage.setItem(
        READING_PRACTICE_KEY,
        JSON.stringify({
          ids: next.ids,
          missedIds: next.missedIds,
          bookId: next.bookId,
          sectionIndex: next.sectionIndex,
          at: Date.now(),
        })
      );
      emitResumeChanged();
    }
  } catch {
    /* ignore */
  }
  return { ids: next.ids, missedIds: next.missedIds, isNew: next.isNew };
}

/**
 * Lemma → sózlik title + navbat (jumbaq pattern).
 * @returns {Promise<{ ids: string[], missedIds: string[], isNew: boolean, titleId: string|null, word: object|null }>}
 */
export async function queueReadingLemma(lemma, { bookId = null, sectionIndex = null } = {}) {
  const text = String(lemma || '').trim();
  if (!text) {
    const p = readReadingPractice();
    return {
      ids: p?.ids || [],
      missedIds: p?.missedIds || [],
      isNew: false,
      titleId: null,
      word: null,
    };
  }
  try {
    const { searchWords } = await import('../api/tusindirme');
    const res = await searchWords(text, 8);
    const rows = res?.data || [];
    const upper = text.toUpperCase();
    const exact =
      rows.find((w) => String(w.soz || '').toUpperCase() === upper) ||
      rows.find((w) => String(w.base_soz || '').toUpperCase() === upper) ||
      rows[0];
    if (exact?.id) {
      const recorded = queueReadingTitleId(exact.id, { bookId, sectionIndex });
      return { ...recorded, titleId: String(exact.id), word: exact };
    }
  } catch {
    /* ignore */
  }
  const p = readReadingPractice();
  return {
    ids: p?.ids || [],
    missedIds: p?.missedIds || [],
    isNew: false,
    titleId: null,
    word: null,
  };
}
