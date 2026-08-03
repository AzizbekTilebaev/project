/**
 * Oqıw darsi — bólim boyınsha spaced revisit (localStorage).
 * BOX intervallar mistake_bank menen birdey.
 */

import { emitResumeChanged } from './resumeEvents.js';

export const READING_LESSON_SRS_KEY = 'qp_reading_lesson_srs';
/** Saat: 0, 1k, 3k, 7k, 14k, 30k — mistake_bank mirror. */
export const READING_LESSON_BOX_HOURS = [0, 24, 72, 168, 336, 720];
const MAX_ENTRIES = 40;
const WEAK_RATIO = 0.7;

export function lessonSrsKey(bookId, sectionIndex) {
  return `${String(bookId || '').trim()}:${Number(sectionIndex) || 0}`;
}

export function readingLessonHref({ bookId, sectionIndex } = {}) {
  const id = String(bookId || '').trim();
  if (!id) return null;
  const sec = sectionIndex != null && Number.isFinite(Number(sectionIndex))
    ? `?section=${Number(sectionIndex)}`
    : '';
  return `/books/${encodeURIComponent(id)}/learn${sec}`;
}

/** Sof: box → dueAt (ms). */
export function dueAtFromBox(box, now = Date.now()) {
  const idx = Math.max(
    0,
    Math.min(Number(box) || 0, READING_LESSON_BOX_HOURS.length - 1)
  );
  const hours = READING_LESSON_BOX_HOURS[idx] ?? 24;
  return now + hours * 3600 * 1000;
}

/**
 * Sof: tamamnan keyingi box.
 * Birinshi: box=1 (24h). Keyin: kúshli → +1, álsiz (<70%) → max(1, box-1).
 */
export function nextBoxAfterLessonComplete({
  prevBox = null,
  score = 0,
  total = 0,
} = {}) {
  const maxBox = READING_LESSON_BOX_HOURS.length - 1;
  if (prevBox == null || !Number.isFinite(Number(prevBox))) {
    return 1;
  }
  const totalN = Math.max(0, Number(total) || 0);
  const scoreN = Math.max(0, Number(score) || 0);
  const weak = totalN > 0 && scoreN / totalN < WEAK_RATIO;
  const cur = Math.max(0, Math.min(maxBox, Number(prevBox)));
  if (weak) return Math.max(1, cur - 1);
  return Math.min(maxBox, cur + 1);
}

/**
 * Sof: bir entry merge (localStorage jazıwsız).
 */
export function mergeLessonSrsComplete(
  prevEntry,
  { bookId, sectionIndex, score = 0, total = 0, now = Date.now() } = {}
) {
  const id = String(bookId || '').trim();
  const sec = Number(sectionIndex) || 0;
  if (!id) return null;
  const box = nextBoxAfterLessonComplete({
    prevBox: prevEntry ? prevEntry.box : null,
    score,
    total,
  });
  return {
    bookId: id,
    sectionIndex: sec,
    box,
    dueAt: dueAtFromBox(box, now),
    lastCompletedAt: now,
    lastScore: Number(score) || 0,
    lastTotal: Number(total) || 0,
  };
}

export function readLessonSrsMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(READING_LESSON_SRS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return {};
    const out = {};
    for (const [key, row] of Object.entries(raw)) {
      if (!row || !row.bookId) continue;
      out[key] = {
        bookId: String(row.bookId),
        sectionIndex: Number(row.sectionIndex) || 0,
        box: Math.max(0, Number(row.box) || 0),
        dueAt: Number(row.dueAt) || 0,
        lastCompletedAt: Number(row.lastCompletedAt) || 0,
        lastScore: Number(row.lastScore) || 0,
        lastTotal: Number(row.lastTotal) || 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeLessonSrsMap(map) {
  try {
    const entries = Object.entries(map || {});
    if (!entries.length) {
      localStorage.removeItem(READING_LESSON_SRS_KEY);
    } else {
      // Eń jańa tamamlar saqlanadı
      const sorted = entries.sort(
        (a, b) => (b[1].lastCompletedAt || 0) - (a[1].lastCompletedAt || 0)
      );
      const trimmed = Object.fromEntries(sorted.slice(0, MAX_ENTRIES));
      localStorage.setItem(READING_LESSON_SRS_KEY, JSON.stringify(trimmed));
    }
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}

/**
 * Dars tamam — keyingi dueAt joybarlaw.
 * @returns {object|null} jańa entry
 */
export function recordLessonSrsComplete({
  bookId,
  sectionIndex,
  score = 0,
  total = 0,
  now = Date.now(),
} = {}) {
  const key = lessonSrsKey(bookId, sectionIndex);
  if (!String(bookId || '').trim()) return null;
  const map = readLessonSrsMap();
  const next = mergeLessonSrsComplete(map[key] || null, {
    bookId,
    sectionIndex,
    score,
    total,
    now,
  });
  if (!next) return null;
  map[key] = next;
  writeLessonSrsMap(map);
  return next;
}

/**
 * Due darslar — eń eski due birinshi.
 */
export function listDueReadingLessons({
  now = Date.now(),
  limit = 5,
  bookId = null,
} = {}) {
  const map = readLessonSrsMap();
  const bookFilter = bookId != null ? String(bookId) : null;
  const due = Object.values(map)
    .filter((row) => {
      if (!row?.bookId || !row.dueAt) return false;
      if (row.dueAt > now) return false;
      if (bookFilter && String(row.bookId) !== bookFilter) return false;
      return true;
    })
    .sort((a, b) => a.dueAt - b.dueAt || a.lastCompletedAt - b.lastCompletedAt);
  return due.slice(0, Math.max(1, Number(limit) || 5));
}

export function pickDueReadingLesson({ bookId = null, now = Date.now() } = {}) {
  return listDueReadingLessons({ now, limit: 1, bookId })[0] || null;
}

export function getReadingLessonSrsMeta({ now = Date.now(), bookId = null } = {}) {
  const due = listDueReadingLessons({ now, limit: 20, bookId });
  const nextDue = pickDueReadingLesson({ bookId, now });
  return {
    dueCount: due.length,
    nextDue,
    href: nextDue ? readingLessonHref(nextDue) : null,
  };
}

/** Sof: server entry → local shape. */
export function normalizeServerLessonSrsEntry(raw) {
  if (!raw || !raw.bookId) return null;
  return {
    bookId: String(raw.bookId),
    sectionIndex: Number(raw.sectionIndex) || 0,
    box: Math.max(0, Number(raw.box) || 0),
    dueAt: Number(raw.dueAt) || 0,
    lastCompletedAt: Number(raw.lastCompletedAt) || 0,
    lastScore: Number(raw.lastScore) || 0,
    lastTotal: Number(raw.lastTotal) || 0,
  };
}

/**
 * Server → local merge. Guest-only keys óshirilmeydi.
 * Birdey keyda jańaraq lastCompletedAt jeńedi.
 */
export function mergeServerLessonSrsIntoLocal(serverEntries = []) {
  const map = readLessonSrsMap();
  let changed = false;
  for (const raw of serverEntries || []) {
    const entry = normalizeServerLessonSrsEntry(raw);
    if (!entry?.bookId) continue;
    const key = lessonSrsKey(entry.bookId, entry.sectionIndex);
    const prev = map[key];
    if (!prev || entry.lastCompletedAt >= (prev.lastCompletedAt || 0)) {
      map[key] = entry;
      changed = true;
    }
  }
  if (changed) writeLessonSrsMap(map);
  return map;
}

/** Bir complete.srs jazıwı. */
export function applyServerLessonSrsEntry(entry) {
  if (!entry) return null;
  mergeServerLessonSrsIntoLocal([entry]);
  return normalizeServerLessonSrsEntry(entry);
}

/**
 * GET /srs/me → local merge (guest/qáte — tınış no-op).
 * @returns {Promise<object>} local map
 */
export async function hydrateReadingLessonSrsFromServer() {
  try {
    const { fetchReadingLessonSrs } = await import('../api/reading.js');
    const res = await fetchReadingLessonSrs();
    return mergeServerLessonSrsIntoLocal(res?.entries || []);
  } catch {
    return readLessonSrsMap();
  }
}
