/**
 * Adaptiv test mid-session resume (local hint; server resume on /adaptive/start).
 */

import { emitResumeChanged } from './resumeEvents';

export const ADAPTIVE_CONTINUE_KEY = 'qp_adaptive_continue';
const TTL_MS = 24 * 3600 * 1000;

function readRaw() {
  try {
    const raw = JSON.parse(localStorage.getItem(ADAPTIVE_CONTINUE_KEY) || 'null');
    if (!raw?.attemptId) return null;
    if (raw.at && Date.now() - Number(raw.at) > TTL_MS) {
      localStorage.removeItem(ADAPTIVE_CONTINUE_KEY);
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/**
 * @returns {{ attemptId: string, skill: string, currentIndex: number, total: number, href: string, updatedAt: number }|null}
 */
export function getContinueAdaptive() {
  const raw = readRaw();
  if (!raw) return null;
  const currentIndex = Number(raw.currentIndex) || 0;
  const total = Number(raw.total) || 10;
  return {
    attemptId: String(raw.attemptId),
    skill: raw.skill ? String(raw.skill) : 'global',
    currentIndex,
    total,
    href: '/quiz/adaptive',
    updatedAt: Number(raw.at) || 0,
  };
}

export function touchAdaptiveContinue({
  attemptId,
  skill = 'global',
  currentIndex = 0,
  total = 10,
} = {}) {
  const id = String(attemptId || '').trim();
  if (!id) return null;
  const next = {
    attemptId: id,
    skill: String(skill || 'global'),
    currentIndex: Number(currentIndex) || 0,
    total: Number(total) || 10,
    at: Date.now(),
  };
  try {
    localStorage.setItem(ADAPTIVE_CONTINUE_KEY, JSON.stringify(next));
    emitResumeChanged();
  } catch {
    /* ignore */
  }
  return getContinueAdaptive();
}

export function clearAdaptiveContinue() {
  try {
    localStorage.removeItem(ADAPTIVE_CONTINUE_KEY);
    emitResumeChanged();
  } catch {
    /* ignore */
  }
}
