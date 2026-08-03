import { searchWords } from '../api/tusindirme';
import { emitResumeChanged } from './resumeEvents';
import { buildCrosswordFocusIds, mergeFocusedPracticeResults } from './readingPractice';
import { markFirstRunPathComplete } from './firstRunProgress';

export { buildCrosswordFocusIds } from './readingPractice';

export const CROSSWORD_PRACTICE_KEY = 'qp_crossword_practice';
export const CROSSWORD_CONTINUE_KEY = 'qp_crossword_continue';
const DAY_KEY = 'qp_crossword_complete_day';
const STREAK_KEY = 'qp_crossword_complete_streak';
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

function uniqueIds(list) {
  return [...new Set((list || []).map(String).filter(Boolean))];
}

function writePractice({ ids = [], missedIds = [] } = {}) {
  const nextIds = uniqueIds(ids).slice(0, MAX_IDS);
  const nextMissed = uniqueIds(missedIds).slice(0, MAX_IDS);
  try {
    if (!nextIds.length && !nextMissed.length) {
      localStorage.removeItem(CROSSWORD_PRACTICE_KEY);
    } else {
      localStorage.setItem(
        CROSSWORD_PRACTICE_KEY,
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

export function readCrosswordPractice() {
  try {
    const raw = JSON.parse(localStorage.getItem(CROSSWORD_PRACTICE_KEY) || 'null');
    if (!raw) return null;
    const ids = uniqueIds(raw.ids).slice(0, MAX_IDS);
    const missedIds = uniqueIds(raw.missedIds).slice(0, MAX_IDS);
    if (!ids.length && !missedIds.length) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(CROSSWORD_PRACTICE_KEY);
      return null;
    }
    return {
      ids,
      missedIds,
      at: raw.at || null,
    };
  } catch {
    return null;
  }
}

export function getCrosswordCompleteStreak() {
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

export function getCrosswordPracticeMeta() {
  const practice = readCrosswordPractice();
  const ids = practice?.ids || [];
  const missedIds = practice?.missedIds || [];
  const focusIds = buildCrosswordFocusIds(practice);
  return {
    streak: getCrosswordCompleteStreak(),
    practiceCount: focusIds.length || ids.length,
    missedCount: missedIds.length,
    ids,
    missedIds,
    focusIds,
  };
}

/** Dict title id ni «sheshilgen» navbatqa qosıw; missed den alıp taslaw. */
export function recordCrosswordTitleId(titleId) {
  const id = String(titleId || '').trim();
  const prev = readCrosswordPractice();
  const prevIds = prev?.ids || [];
  const prevMissed = prev?.missedIds || [];
  if (!id) {
    return { ids: prevIds, missedIds: prevMissed, isNew: false };
  }
  let isNew = false;
  let ids = prevIds;
  if (!prevIds.includes(id)) {
    ids = [id, ...prevIds].slice(0, MAX_IDS);
    isNew = true;
  }
  const missedIds = prevMissed.filter((x) => x !== id);
  if (isNew || missedIds.length !== prevMissed.length) {
    writePractice({ ids, missedIds });
  }
  return { ids, missedIds, isNew };
}

/** Qáte juwap — server bergen dictTitleId (juwap matni jasırın). */
export function recordCrosswordMissedId(titleId) {
  const id = String(titleId || '').trim();
  const prev = readCrosswordPractice();
  const prevIds = prev?.ids || [];
  const prevMissed = prev?.missedIds || [];
  if (!id) {
    return { ids: prevIds, missedIds: prevMissed, isNew: false };
  }
  if (prevMissed.includes(id)) {
    return { ids: prevIds, missedIds: prevMissed, isNew: false };
  }
  const missedIds = [id, ...prevMissed].slice(0, MAX_IDS);
  writePractice({ ids: prevIds, missedIds });
  return { ids: prevIds, missedIds, isNew: true };
}

/**
 * Dict-game tamam (exit=crossword) — durıs dequeue, qáte → missedIds.
 * @param {Array<{ id: string, correct: boolean }>} results
 */
export function applyCrosswordPracticeResults(results = []) {
  const next = mergeFocusedPracticeResults(readCrosswordPractice(), results);
  writePractice(next);
  return next;
}

/**
 * Durıs juwap → sózlikte izlep id qosıw (fon).
 * @returns {Promise<{ ids: string[], missedIds: string[], isNew: boolean, titleId: string|null }>}
 */
export async function queueCrosswordAnswer(answer) {
  const lemma = String(answer || '').trim();
  const empty = () => {
    const p = readCrosswordPractice();
    return {
      ids: p?.ids || [],
      missedIds: p?.missedIds || [],
      isNew: false,
      titleId: null,
    };
  };
  if (!lemma) return empty();
  try {
    const res = await searchWords(lemma, 8);
    const rows = res?.data || [];
    const upper = lemma.toUpperCase();
    const exact =
      rows.find((w) => String(w.soz || '').toUpperCase() === upper) ||
      rows.find((w) => String(w.base_soz || '').toUpperCase() === upper) ||
      rows[0];
    if (exact?.id) {
      const recorded = recordCrosswordTitleId(exact.id);
      return { ...recorded, titleId: String(exact.id) };
    }
  } catch {
    /* ignore search failures */
  }
  return empty();
}

/** Qáte — tek title id (serverden). */
export function queueCrosswordMiss(dictTitleId) {
  return recordCrosswordMissedId(dictTitleId);
}

/** Krossvord tamam — kúnlik streak. */
export function recordCrosswordComplete() {
  let streak = getCrosswordCompleteStreak();
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
  markFirstRunPathComplete('crossword');
  const practice = readCrosswordPractice();
  return {
    streak,
    practiceCount: buildCrosswordFocusIds(practice).length || practice?.ids?.length || 0,
    missedCount: practice?.missedIds?.length || 0,
  };
}

function readContinueRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(CROSSWORD_CONTINUE_KEY) || 'null');
    if (!raw?.id) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(CROSSWORD_CONTINUE_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * Solo krossvord davomı — Home / list resume.
 */
export function getContinueCrossword() {
  const raw = readContinueRaw();
  if (!raw) return null;
  const id = String(raw.id);
  const cellData =
    raw.cellData && typeof raw.cellData === 'object' && !Array.isArray(raw.cellData)
      ? raw.cellData
      : {};
  const solvedCells = Object.keys(cellData).length;
  return {
    id,
    title: String(raw.title || ''),
    difficulty: String(raw.difficulty || ''),
    wordCount: Number(raw.wordCount) || 0,
    solvedCells,
    cellData,
    updatedAt: Number(raw.at) || 0,
    href: `/crossword/${encodeURIComponent(id)}`,
  };
}

export function readCrosswordContinueCells(id) {
  const cur = getContinueCrossword();
  if (!cur || String(cur.id) !== String(id || '')) return null;
  return cur.cellData;
}

export function touchCrosswordContinue(meta) {
  const id = String(meta?.id || '').trim();
  if (!id) return null;
  const prev = readContinueRaw();
  const cellData =
    meta.cellData && typeof meta.cellData === 'object' && !Array.isArray(meta.cellData)
      ? meta.cellData
      : prev && String(prev.id) === id
        ? prev.cellData || {}
        : {};
  const next = {
    id,
    title: meta.title != null ? String(meta.title) : String(prev?.title || ''),
    difficulty:
      meta.difficulty != null ? String(meta.difficulty) : String(prev?.difficulty || ''),
    wordCount:
      meta.wordCount != null
        ? Number(meta.wordCount) || 0
        : Number(prev?.wordCount) || 0,
    cellData,
    at: Date.now(),
  };
  try {
    localStorage.setItem(CROSSWORD_CONTINUE_KEY, JSON.stringify(next));
    emitResumeChanged();
  } catch {
    /* ignore quota */
  }
  return getContinueCrossword();
}

export function clearCrosswordContinue(id = null) {
  try {
    if (id == null) {
      localStorage.removeItem(CROSSWORD_CONTINUE_KEY);
      emitResumeChanged();
      return;
    }
    const raw = readContinueRaw();
    if (raw && String(raw.id) === String(id)) {
      localStorage.removeItem(CROSSWORD_CONTINUE_KEY);
      emitResumeChanged();
    }
  } catch {
    /* ignore */
  }
}
