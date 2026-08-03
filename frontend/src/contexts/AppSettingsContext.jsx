import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const THEME_KEY = 'app:theme';
export const QUIZ_ADVANCE_KEY = 'app:quizAdvanceMode';

export const THEMES = ['day', 'night', 'sepia', 'focus'];
export const QUIZ_ADVANCE_MODES = ['confirm', 'next'];

const AppSettingsContext = createContext(null);

function readTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.includes(v) ? v : 'day';
  } catch {
    return 'day';
  }
}

function readQuizAdvance() {
  try {
    const v = localStorage.getItem(QUIZ_ADVANCE_KEY);
    return QUIZ_ADVANCE_MODES.includes(v) ? v : 'confirm';
  } catch {
    return 'confirm';
  }
}

export function AppSettingsProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme);
  const [quizAdvanceMode, setQuizAdvanceState] = useState(readQuizAdvance);

  const setTheme = useCallback((value) => {
    const next = THEMES.includes(value) ? value : 'day';
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const setQuizAdvanceMode = useCallback((value) => {
    const next = QUIZ_ADVANCE_MODES.includes(value) ? value : 'confirm';
    setQuizAdvanceState(next);
    try {
      localStorage.setItem(QUIZ_ADVANCE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_KEY) setThemeState(readTheme());
      if (e.key === QUIZ_ADVANCE_KEY) setQuizAdvanceState(readQuizAdvance());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      quizAdvanceMode,
      setQuizAdvanceMode,
    }),
    [theme, setTheme, quizAdvanceMode, setQuizAdvanceMode]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings AppSettingsProvider ishinde qollanılıwı kerek');
  return ctx;
}
