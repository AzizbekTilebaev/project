/**
 * Tutor mini-dars mid-session resume (local hint; server reminder is source of truth).
 */

import { emitResumeChanged } from './resumeEvents';

export const TUTOR_CONTINUE_KEY = 'qp_tutor_continue';
const TTL_MS = 24 * 3600 * 1000;

function readRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(TUTOR_CONTINUE_KEY) || 'null');
    if (!raw?.href) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(TUTOR_CONTINUE_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * @returns {{ href: string, score: number|null, total: number|null, scheduledTime: string|null, updatedAt: number }|null}
 */
export function getContinueTutor() {
  const raw = readRaw();
  if (!raw) return null;
  return {
    href: String(raw.href || '/tutor'),
    score: raw.score != null && Number.isFinite(Number(raw.score)) ? Number(raw.score) : null,
    total: raw.total != null && Number.isFinite(Number(raw.total)) ? Number(raw.total) : null,
    scheduledTime: raw.scheduledTime ? String(raw.scheduledTime) : null,
    updatedAt: Number(raw.at) || 0,
  };
}

export function touchTutorContinue({
  href = '/tutor',
  score = null,
  total = null,
  scheduledTime = null,
} = {}) {
  const next = {
    href: String(href || '/tutor'),
    score: score != null ? Number(score) : null,
    total: total != null ? Number(total) : null,
    scheduledTime: scheduledTime != null ? String(scheduledTime) : null,
    at: Date.now(),
  };
  try {
    const prev = localStorage.getItem(TUTOR_CONTINUE_KEY);
    const prevObj = prev ? JSON.parse(prev) : null;
    const same =
      prevObj &&
      String(prevObj.href || '') === next.href &&
      String(prevObj.score ?? '') === String(next.score ?? '') &&
      String(prevObj.total ?? '') === String(next.total ?? '') &&
      String(prevObj.scheduledTime || '') === String(next.scheduledTime || '');
    localStorage.setItem(TUTOR_CONTINUE_KEY, JSON.stringify(next));
    if (!same) emitResumeChanged();
  } catch {
    /* ignore */
  }
  return getContinueTutor();
}

export function clearTutorContinue() {
  try {
    if (!localStorage.getItem(TUTOR_CONTINUE_KEY)) return;
    localStorage.removeItem(TUTOR_CONTINUE_KEY);
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}

/** fetchTutorReminder natijasın local resume menen sinxronlaw. */
export function syncTutorContinueFromReminder(reminder) {
  if (!reminder) return;
  if (reminder.reason === 'in_progress') {
    touchTutorContinue({
      href: reminder.deepLink || '/tutor',
      score: reminder.score,
      total: reminder.total,
      scheduledTime: reminder.scheduledTime,
    });
  } else {
    clearTutorContinue();
  }
}
