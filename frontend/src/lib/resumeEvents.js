/**
 * Resume chip / Continuity — Header hám basqa UI jańalaw signalı.
 */

export const RESUME_CHANGED_EVENT = 'qp:resume-changed';

/** localStorage resume ózgergende shaqırıń (Header chip jańalanadı). */
export function emitResumeChanged() {
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RESUME_CHANGED_EVENT));
    }
  } catch {
    /* ignore */
  }
}
