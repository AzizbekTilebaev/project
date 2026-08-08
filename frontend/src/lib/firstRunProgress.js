/**
 * Guest first-run multi-path — selected path + real completion signals.
 */

import { emitResumeChanged } from './resumeEvents';

export const DISMISS_KEY = 'qp_first_run_dismiss';
export const STEPS_KEY = 'qp_first_run_steps';
export const PATHS_KEY = 'qp_first_run_paths';
export const CELEBRATE_KEY = 'qp_first_run_celebrate';
export const GAME_BEST_KEY = 'dict_game_best';

export const PATH_IDS = ['quiz', 'crossword', 'play'];

const emptyCompleted = () => ({
  quiz: false,
  crossword: false,
  play: false,
});
export function isFirstRunDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissFirstRun() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
    localStorage.removeItem(CELEBRATE_KEY);
  } catch {
    /* ignore */
  }
  emitResumeChanged();
}

export function readDictSteps() {
  try {
    const raw = JSON.parse(localStorage.getItem(STEPS_KEY) || '{}');
    return {
      viewedWod: Boolean(raw.viewedWod),
      practiced: Boolean(raw.practiced),
    };
  } catch {
    return { viewedWod: false, practiced: false };
  }
}

export function writeDictSteps(patch) {
  try {
    const next = { ...readDictSteps(), ...patch };
    localStorage.setItem(STEPS_KEY, JSON.stringify(next));
    emitResumeChanged();
    return next;
  } catch {
    return readDictSteps();
  }
}

export function hasPlayedDictGame() {
  try {
    const v = parseInt(localStorage.getItem(GAME_BEST_KEY) || '0', 10);
    return Number.isFinite(v) && v > 0;
  } catch {
    return false;
  }
}

export function readFirstRunPaths() {
  try {
    const raw = JSON.parse(localStorage.getItem(PATHS_KEY) || '{}');
    const completed = { ...emptyCompleted(), ...(raw.completed || {}) };
    const selected =
      raw.selected && PATH_IDS.includes(String(raw.selected)) ? String(raw.selected) : null;
    return {
      selected,
      completed: {
        quiz: Boolean(completed.quiz),
        crossword: Boolean(completed.crossword),
        play: Boolean(completed.play || completed.dict),
      },
    };
  } catch {
    return { selected: null, completed: emptyCompleted() };
  }
}

function writePaths(next) {
  try {
    localStorage.setItem(
      PATHS_KEY,
      JSON.stringify({
        selected: next.selected || null,
        completed: { ...emptyCompleted(), ...next.completed },
      })
    );
  } catch {
    /* ignore */
  }
  emitResumeChanged();
  return readFirstRunPaths();
}

export function selectFirstRunPath(pathId) {
  if (!PATH_IDS.includes(pathId)) return readFirstRunPaths();
  const cur = readFirstRunPaths();
  return writePaths({ ...cur, selected: pathId });
}

export function clearFirstRunPathSelection() {
  const cur = readFirstRunPaths();
  return writePaths({ ...cur, selected: null });
}

/** Settings: first-run eshik tanlovini qayta ko‘rsatish. */
export function resetFirstRunExperience() {
  try {
    localStorage.removeItem(DISMISS_KEY);
    localStorage.removeItem(CELEBRATE_KEY);
    localStorage.removeItem(STEPS_KEY);
  } catch {
    /* ignore */
  }
  writePaths({ selected: null, completed: emptyCompleted() });
  emitResumeChanged();
  return readFirstRunPaths();
}

export function readCelebratePending() {
  try {
    return localStorage.getItem(CELEBRATE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCelebratePending(on) {
  try {
    if (on) localStorage.setItem(CELEBRATE_KEY, '1');
    else localStorage.removeItem(CELEBRATE_KEY);
  } catch {
    /* ignore */
  }
  emitResumeChanged();
}

export function hasAnyPathComplete(completed = readFirstRunPaths().completed) {
  return PATH_IDS.some((id) => Boolean(completed?.[id]));
}

/**
 * Real finish signal — bir jol tamam. Celebrate flag qoýadı (dismiss bolmasa).
 */
export function markFirstRunPathComplete(pathId) {
  if (!PATH_IDS.includes(pathId)) return readFirstRunPaths();
  const cur = readFirstRunPaths();
  if (cur.completed[pathId]) return cur;
  const next = {
    ...cur,
    completed: { ...cur.completed, [pathId]: true },
  };
  writePaths(next);
  if (!isFirstRunDismissed()) {
    try {
      if (localStorage.getItem(CELEBRATE_KEY) !== '0') {
        localStorage.setItem(CELEBRATE_KEY, '1');
      }
    } catch {
      /* ignore */
    }
    emitResumeChanged();
  }
  return readFirstRunPaths();
}

function localHas(key) {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return false;
  }
}

/**
 * Ávvilden bar local signallardı sync (hooksiz tamamlanǵanlar).
 */
export function syncDetectedCompletions() {
  const cur = readFirstRunPaths();
  let changed = false;
  const completed = { ...cur.completed };

  if (!completed.quiz && localHas('qp_quiz_practice')) {
    completed.quiz = true;
    changed = true;
  }
  if (!completed.crossword && localHas('qp_crossword_complete_day')) {
    completed.crossword = true;
    changed = true;
  }
  if (!completed.play && hasPlayedDictGame()) {
    completed.play = true;
    changed = true;
  }

  if (!changed) return cur;

  writePaths({ ...cur, completed });
  if (!isFirstRunDismissed() && hasAnyPathComplete(completed)) {
    try {
      if (localStorage.getItem(CELEBRATE_KEY) !== '0') {
        localStorage.setItem(CELEBRATE_KEY, '1');
      }
    } catch {
      /* ignore */
    }
    emitResumeChanged();
  }
  return readFirstRunPaths();
}
