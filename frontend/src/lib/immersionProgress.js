/**
 * Immersiya tıńlaw → mashq navbatı (localStorage).
 * Tıńlaw → ids; mashq qáteleri → missedIds; durıs → navbattan shıǵarıw.
 */

import { emitResumeChanged } from './resumeEvents';
import { buildMissedFirstFocusIds, mergeFocusedPracticeResults } from './readingPractice';

export { mergeFocusedPracticeResults as mergeImmersionPracticeResults } from './readingPractice';

export const IMMERSION_PRACTICE_KEY = 'qp_immersion_practice';
export const IMMERSION_CONTINUE_KEY = 'qp_immersion_continue';
const DAY_KEY = 'qp_immersion_listen_day';
const STREAK_KEY = 'qp_immersion_listen_streak';
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
      localStorage.removeItem(IMMERSION_PRACTICE_KEY);
    } else {
      localStorage.setItem(
        IMMERSION_PRACTICE_KEY,
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

export function readImmersionPractice() {
  try {
    const raw = JSON.parse(localStorage.getItem(IMMERSION_PRACTICE_KEY) || 'null');
    if (!raw) return null;
    const ids = uniqueIds(raw.ids).slice(0, MAX_IDS);
    const missedIds = uniqueIds(raw.missedIds).slice(0, MAX_IDS);
    if (!ids.length && !missedIds.length) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(IMMERSION_PRACTICE_KEY);
      return null;
    }
    return { ids, missedIds, at: raw.at || null };
  } catch {
    return null;
  }
}

export function getImmersionListenStreak() {
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

export function hasImmersionListenedToday() {
  try {
    return localStorage.getItem(DAY_KEY) === todayKey();
  } catch {
    return false;
  }
}

export function isImmersionWordQueued(titleId) {
  const id = String(titleId || '').trim();
  if (!id) return false;
  const practice = readImmersionPractice();
  return Boolean(
    practice?.ids?.includes(id) || practice?.missedIds?.includes(id)
  );
}

/** UI ushın bir jerden meta. */
export function getImmersionListenMeta() {
  const practice = readImmersionPractice();
  const ids = practice?.ids || [];
  const missedIds = practice?.missedIds || [];
  const focusIds = buildMissedFirstFocusIds(practice);
  return {
    streak: getImmersionListenStreak(),
    listenedToday: hasImmersionListenedToday(),
    practiceCount: focusIds.length || ids.length,
    missedCount: missedIds.length,
    ids,
    missedIds,
    focusIds,
  };
}

/**
 * Dict-game tamam (exit=immersion) — durıs dequeue, qáte → missedIds.
 * @param {Array<{ id: string, correct: boolean }>} results
 */
export function applyImmersionPracticeResults(results = []) {
  const next = mergeFocusedPracticeResults(readImmersionPractice(), results);
  writePractice(next);
  return next;
}

export function getContinueImmersion() {
  try {
    const raw = JSON.parse(localStorage.getItem(IMMERSION_CONTINUE_KEY) || 'null');
    if (!raw?.id) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(IMMERSION_CONTINUE_KEY);
      return null;
    }
    const id = String(raw.id);
    return {
      id,
      soz: raw.soz ? String(raw.soz) : '',
      href: `/dictionary/${encodeURIComponent(id)}`,
      browseHref: '/dictionary/immersion',
      updatedAt: Number(raw.at) || 0,
    };
  } catch {
    return null;
  }
}

export function touchImmersionContinue({ id, soz } = {}) {
  const titleId = String(id || '').trim();
  if (!titleId) return null;
  let prevSoz = '';
  try {
    const prev = JSON.parse(localStorage.getItem(IMMERSION_CONTINUE_KEY) || 'null');
    if (prev && String(prev.id) === titleId) prevSoz = prev.soz || '';
  } catch {
    /* ignore */
  }
  const next = {
    id: titleId,
    soz: soz != null && String(soz).trim() ? String(soz).trim() : prevSoz,
    at: Date.now(),
  };
  try {
    localStorage.setItem(IMMERSION_CONTINUE_KEY, JSON.stringify(next));
    emitResumeChanged();
  } catch {
    /* ignore quota */
  }
  return getContinueImmersion();
}

export function clearImmersionContinue(id = null) {
  try {
    if (id == null) {
      if (!localStorage.getItem(IMMERSION_CONTINUE_KEY)) return;
      localStorage.removeItem(IMMERSION_CONTINUE_KEY);
      emitResumeChanged();
      return;
    }
    const raw = JSON.parse(localStorage.getItem(IMMERSION_CONTINUE_KEY) || 'null');
    if (raw && String(raw.id) === String(id)) {
      localStorage.removeItem(IMMERSION_CONTINUE_KEY);
      emitResumeChanged();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Sóz tıńlandı — navbatqa qosıw + kúnlik streak.
 */
export function recordImmersionListen(titleId, meta = {}) {
  const id = String(titleId || '').trim();
  if (!id) {
    const p = readImmersionPractice();
    return {
      ids: p?.ids || [],
      missedIds: p?.missedIds || [],
      streak: getImmersionListenStreak(),
      isNew: false,
    };
  }

  touchImmersionContinue({ id, soz: meta.soz });

  const prev = readImmersionPractice();
  let ids = prev?.ids ? [...prev.ids] : [];
  const missedIds = prev?.missedIds ? [...prev.missedIds] : [];
  let isNew = false;
  if (!ids.includes(id)) {
    ids = [id, ...ids].slice(0, MAX_IDS);
    isNew = true;
  }
  writePractice({ ids, missedIds });

  let streak = getImmersionListenStreak();
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

  return { ids, missedIds, streak, isNew };
}
