/**
 * Búginniń maqseti: belgilaw + kún sózi mashqı (localStorage).
 */

export const DAILY_GOAL_KEY = 'qp_daily_goal';
export const GOAL_CELEBRATE_KEY = 'qp_daily_goal_celebrate';

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function readDailyGoal() {
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_GOAL_KEY) || 'null');
    if (!raw || raw.day !== todayKey()) return { day: todayKey(), practicedId: null };
    return {
      day: raw.day,
      practicedId: raw.practicedId ? String(raw.practicedId) : null,
    };
  } catch {
    return { day: todayKey(), practicedId: null };
  }
}

export function isWoDPracticedToday(titleId) {
  if (!titleId) return false;
  const g = readDailyGoal();
  return Boolean(g.practicedId && String(g.practicedId) === String(titleId));
}

/**
 * Mashq tamamlanǵanda shaqırıń (baslanǵanda emes).
 * Tek WoD sózi durıs juwap berilgende belgilaw — raund tamamı jetkiliksiz.
 * @returns {{ day: string, practicedId: string|null, newlyMarked: boolean }}
 */
export function markWoDPracticed(titleId) {
  const id = String(titleId || '').trim();
  const prev = readDailyGoal();
  if (!id) return { ...prev, newlyMarked: false };
  if (prev.practicedId === id) return { ...prev, newlyMarked: false };
  // Basqa sóz belgilengen bolsa — WoD progressın ózgertpeń
  if (prev.practicedId && prev.practicedId !== id) {
    return { ...prev, newlyMarked: false };
  }
  const next = { day: todayKey(), practicedId: id };
  try {
    localStorage.setItem(DAILY_GOAL_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return { ...next, newlyMarked: true };
}

/**
 * Outcome map: titleId → correct?
 * WoD id juwapı durıs bolsa ǵana markWoDPracticed.
 */
export function markWoDPracticedIfCorrect(titleId, outcomes = {}) {
  const id = String(titleId || '').trim();
  if (!id) {
    return { ...readDailyGoal(), newlyMarked: false };
  }
  if (outcomes[id] !== true && outcomes[String(titleId)] !== true) {
    return { ...readDailyGoal(), newlyMarked: false };
  }
  return markWoDPracticed(id);
}

/** Mashq tamam → bas bette bir ret flash. */
export function armGoalCelebration() {
  try {
    sessionStorage.setItem(GOAL_CELEBRATE_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

/** @returns {boolean} */
export function consumeGoalCelebration() {
  try {
    const v = sessionStorage.getItem(GOAL_CELEBRATE_KEY);
    if (!v || v !== todayKey()) return false;
    sessionStorage.removeItem(GOAL_CELEBRATE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * @returns {{ claimed: boolean, practiced: boolean, doneCount: number, total: 2, complete: boolean }}
 */
export function getDailyGoalStatus({ claimedToday = false, titleId = null } = {}) {
  const practiced = isWoDPracticedToday(titleId);
  const claimed = Boolean(claimedToday);
  const doneCount = (claimed ? 1 : 0) + (practiced ? 1 : 0);
  return {
    claimed,
    practiced,
    doneCount,
    total: 2,
    complete: doneCount >= 2,
  };
}
