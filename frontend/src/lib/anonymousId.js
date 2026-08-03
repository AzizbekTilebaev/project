import { emitResumeChanged } from './resumeEvents';

const STORAGE_KEY = 'qp_anonymous_id';
const CONSENT_KEY = 'qp_age_consent';
const ATTEMPT_KEY = 'qp_last_attempt';

function randomUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getAnonymousId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomUuid();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return randomUuid();
  }
}

export function getAgeConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return { consent: null, ageYears: null };
    return JSON.parse(raw);
  } catch {
    return { consent: null, ageYears: null };
  }
}

export function setAgeConsentLocal({ consent, ageYears }) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ consent, ageYears: ageYears ?? null }));
  } catch {
    // ignore
  }
}

export function rememberAttempt(quizId, attemptId, meta = {}) {
  try {
    const prev = getRememberedAttempt();
    const same =
      prev &&
      String(prev.quizId) === String(quizId) &&
      String(prev.attemptId || '') === String(attemptId || '');
    localStorage.setItem(
      ATTEMPT_KEY,
      JSON.stringify({
        quizId,
        attemptId,
        title:
          meta.title != null
            ? String(meta.title)
            : same
              ? prev.title || null
              : null,
        currentIndex:
          meta.currentIndex != null
            ? Number(meta.currentIndex) || 0
            : same
              ? prev.currentIndex ?? null
              : null,
        total:
          meta.total != null
            ? Number(meta.total) || 0
            : same
              ? prev.total ?? null
              : null,
        at: Date.now(),
      })
    );
    emitResumeChanged();
  } catch {
    // ignore
  }
}

export function getRememberedAttempt() {
  try {
    const raw = localStorage.getItem(ATTEMPT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Yarım qalǵan test — list / Home resume.
 * @returns {{ quizId: string, attemptId: string|null, title: string, currentIndex: number|null, total: number|null, href: string, updatedAt: number }|null}
 */
export function getContinueQuiz() {
  const raw = getRememberedAttempt();
  if (!raw?.quizId) return null;
  const quizId = String(raw.quizId);
  return {
    quizId,
    attemptId: raw.attemptId ? String(raw.attemptId) : null,
    title: raw.title ? String(raw.title) : '',
    currentIndex:
      raw.currentIndex != null && Number.isFinite(Number(raw.currentIndex))
        ? Number(raw.currentIndex)
        : null,
    total:
      raw.total != null && Number.isFinite(Number(raw.total))
        ? Number(raw.total)
        : null,
    updatedAt: Number(raw.at) || 0,
    href: `/quiz/${encodeURIComponent(quizId)}`,
  };
}

export function clearRememberedAttempt() {
  try {
    localStorage.removeItem(ATTEMPT_KEY);
    emitResumeChanged();
  } catch {
    // ignore
  }
}
