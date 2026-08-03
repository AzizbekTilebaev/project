/**
 * Jumbaq juwap ashıw → seriya + fokuslı mashq navbatı.
 */

import { searchWords } from '../api/tusindirme';
import { emitResumeChanged } from './resumeEvents';
import { mergeFocusedPracticeResults } from './readingPractice';

export const JUMBAQ_CONTINUE_KEY = 'qp_jumbaq_continue';
export const JUMBAQ_PRACTICE_KEY = 'qp_jumbaq_practice';
const DAY_KEY = 'qp_jumbaq_reveal_day';
const STREAK_KEY = 'qp_jumbaq_reveal_streak';
const COUNT_KEY = 'qp_jumbaq_reveal_today_count';
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
      localStorage.removeItem(JUMBAQ_PRACTICE_KEY);
    } else {
      localStorage.setItem(
        JUMBAQ_PRACTICE_KEY,
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

export function getJumbaqRevealStreak() {
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

export function readJumbaqPractice() {
  try {
    const raw = JSON.parse(localStorage.getItem(JUMBAQ_PRACTICE_KEY) || 'null');
    if (!raw) return null;
    const ids = uniqueIds(raw.ids).slice(0, MAX_IDS);
    const missedIds = uniqueIds(raw.missedIds).slice(0, MAX_IDS);
    if (!ids.length && !missedIds.length) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(JUMBAQ_PRACTICE_KEY);
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

export function getJumbaqPracticeMeta() {
  const practice = readJumbaqPractice();
  const ids = practice?.ids || [];
  const missedIds = practice?.missedIds || [];
  return {
    streak: getJumbaqRevealStreak(),
    practiceCount: ids.length,
    missedCount: missedIds.length,
    ids,
    missedIds,
  };
}

export function recordJumbaqTitleId(titleId) {
  const id = String(titleId || '').trim();
  const prev = readJumbaqPractice();
  const prevIds = prev?.ids || [];
  const prevMissed = prev?.missedIds || [];
  if (!id) return { ids: prevIds, missedIds: prevMissed, isNew: false };
  if (prevIds.includes(id)) return { ids: prevIds, missedIds: prevMissed, isNew: false };
  const ids = [id, ...prevIds].slice(0, MAX_IDS);
  writePractice({ ids, missedIds: prevMissed });
  return { ids, missedIds: prevMissed, isNew: true };
}

/**
 * Dict-game tamam (exit=jumbaq) — durıs dequeue, qáte → missedIds.
 * @param {Array<{ id: string, correct: boolean }>} results
 */
export function applyJumbaqPracticeResults(results = []) {
  const next = mergeFocusedPracticeResults(readJumbaqPractice(), results);
  writePractice(next);
  return next;
}

/** Juwap lemma → sózlik title id (fon). */
export async function queueJumbaqAnswer(answer) {
  const lemma = String(answer || '').trim();
  if (!lemma) {
    const p = readJumbaqPractice();
    return { ids: p?.ids || [], missedIds: p?.missedIds || [], isNew: false, titleId: null };
  }
  try {
    const res = await searchWords(lemma, 8);
    const rows = res?.data || [];
    const upper = lemma.toUpperCase();
    const exact =
      rows.find((w) => String(w.soz || '').toUpperCase() === upper) ||
      rows.find((w) => String(w.base_soz || '').toUpperCase() === upper) ||
      rows[0];
    if (exact?.id) {
      const recorded = recordJumbaqTitleId(exact.id);
      return { ...recorded, titleId: String(exact.id) };
    }
  } catch {
    /* ignore */
  }
  const p = readJumbaqPractice();
  return { ids: p?.ids || [], missedIds: p?.missedIds || [], isNew: false, titleId: null };
}

export function getJumbaqRevealMeta() {
  try {
    const day = localStorage.getItem(DAY_KEY);
    const today = todayKey();
    const revealedToday = day === today;
    const todayCount = revealedToday ? Number(localStorage.getItem(COUNT_KEY) || 0) || 0 : 0;
    const practice = readJumbaqPractice();
    return {
      streak: getJumbaqRevealStreak(),
      revealedToday,
      todayCount,
      practiceCount: practice?.ids?.length || 0,
      missedCount: practice?.missedIds?.length || 0,
      ids: practice?.ids || [],
      missedIds: practice?.missedIds || [],
    };
  } catch {
    return {
      streak: 0,
      revealedToday: false,
      todayCount: 0,
      practiceCount: 0,
      missedCount: 0,
      ids: [],
      missedIds: [],
    };
  }
}

function buildJumbaqHref({ topar = '', utopar = '', q = '' } = {}) {
  const params = new URLSearchParams();
  if (topar) params.set('topar', String(topar));
  if (utopar) params.set('utopar', String(utopar));
  if (q) params.set('q', String(q));
  const qs = params.toString();
  return qs ? `/jumbaqlar?${qs}` : '/jumbaqlar';
}

export function getContinueJumbaq() {
  try {
    const raw = JSON.parse(localStorage.getItem(JUMBAQ_CONTINUE_KEY) || 'null');
    if (!raw) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(JUMBAQ_CONTINUE_KEY);
      return null;
    }
    const topar = raw.topar != null && String(raw.topar) !== '' ? String(raw.topar) : '';
    const utopar = raw.utopar != null && String(raw.utopar) !== '' ? String(raw.utopar) : '';
    const q = raw.q != null && String(raw.q) !== '' ? String(raw.q) : '';
    if (!topar && !utopar && !q) return null;
    return {
      topar,
      utopar,
      q,
      label: raw.label ? String(raw.label) : '',
      href: buildJumbaqHref({ topar, utopar, q }),
      updatedAt: Number(raw.at) || 0,
    };
  } catch {
    return null;
  }
}

export function touchJumbaqContinue(meta = {}) {
  const topar =
    meta.topar != null && String(meta.topar).trim() !== '' ? String(meta.topar).trim() : '';
  const utopar =
    meta.utopar != null && String(meta.utopar).trim() !== '' ? String(meta.utopar).trim() : '';
  const q = meta.q != null && String(meta.q).trim() !== '' ? String(meta.q).trim() : '';
  if (!topar && !utopar && !q) return null;
  const next = {
    topar,
    utopar,
    q,
    label: meta.label != null ? String(meta.label).trim() : '',
    at: Date.now(),
  };
  try {
    localStorage.setItem(JUMBAQ_CONTINUE_KEY, JSON.stringify(next));
    emitResumeChanged();
  } catch {
    /* ignore quota */
  }
  return getContinueJumbaq();
}

export function clearJumbaqContinue() {
  try {
    if (!localStorage.getItem(JUMBAQ_CONTINUE_KEY)) return;
    localStorage.removeItem(JUMBAQ_CONTINUE_KEY);
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}

/** Juwap ashılǵanda — streak + juwap → mashq navbatı. */
export async function recordJumbaqReveal(meta = {}) {
  if (meta && (meta.topar != null || meta.utopar != null || meta.q || meta.label)) {
    touchJumbaqContinue(meta);
  }

  let streak = getJumbaqRevealStreak();
  let todayCount = 0;
  try {
    const today = todayKey();
    const last = localStorage.getItem(DAY_KEY);
    if (last !== today) {
      streak = last === yesterdayKey() ? Math.max(1, streak) + 1 : 1;
      localStorage.setItem(DAY_KEY, today);
      localStorage.setItem(STREAK_KEY, String(streak));
      todayCount = 1;
      localStorage.setItem(COUNT_KEY, '1');
    } else {
      todayCount = (Number(localStorage.getItem(COUNT_KEY) || 0) || 0) + 1;
      localStorage.setItem(COUNT_KEY, String(todayCount));
    }
  } catch {
    /* ignore */
  }

  let practiceCount = readJumbaqPractice()?.ids?.length || 0;
  if (meta?.juwap) {
    try {
      const queued = await queueJumbaqAnswer(meta.juwap);
      practiceCount = queued.ids?.length || practiceCount;
    } catch {
      /* ignore */
    }
  }

  return {
    streak,
    todayCount,
    revealedToday: true,
    practiceCount,
  };
}
