import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { inScript } from '../utils/qqScript';

export const UI_SCRIPT_KEY = 'literature:script';
export const UI_SCRIPT_EVENT = 'qaraqalpaq:script-change';

const UiScriptContext = createContext(null);

function readStoredScript() {
  try {
    return localStorage.getItem(UI_SCRIPT_KEY) === 'latin' ? 'latin' : 'cyrillic';
  } catch {
    return 'cyrillic';
  }
}

export function UiScriptProvider({ children }) {
  const [script, setScriptState] = useState(readStoredScript);

  const setScript = useCallback((value) => {
    const next = value === 'latin' ? 'latin' : 'cyrillic';
    setScriptState(next);
    try {
      localStorage.setItem(UI_SCRIPT_KEY, next);
      const prefs = JSON.parse(localStorage.getItem('literature:readerPrefs') || '{}');
      localStorage.setItem('literature:readerPrefs', JSON.stringify({ ...prefs, script: next }));
      window.dispatchEvent(new CustomEvent(UI_SCRIPT_EVENT, { detail: next }));
    } catch {
      /* localStorage jabıq bolsa da UI islewi kerek */
    }
  }, []);

  useEffect(() => {
    const sync = (event) => {
      const next = event?.detail || readStoredScript();
      setScriptState(next === 'latin' ? 'latin' : 'cyrillic');
    };
    const storage = (event) => {
      if (event.key === UI_SCRIPT_KEY) sync();
    };
    window.addEventListener(UI_SCRIPT_EVENT, sync);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(UI_SCRIPT_EVENT, sync);
      window.removeEventListener('storage', storage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = script === 'latin' ? 'kaa-Latn' : 'kaa-Cyrl';
    document.documentElement.dataset.script = script;
  }, [script]);

  const text = useCallback(
    (value) => {
      if (value == null) return '';
      if (typeof value === 'object' && !Array.isArray(value)) {
        return value[script] ?? value.latin ?? value.cyrillic ?? '';
      }
      return inScript(String(value), script);
    },
    [script]
  );

  const value = useMemo(
    () => ({ script, setScript, text, isLatin: script === 'latin' }),
    [script, setScript, text]
  );

  return <UiScriptContext.Provider value={value}>{children}</UiScriptContext.Provider>;
}

export function useUiScript() {
  const context = useContext(UiScriptContext);
  if (!context) throw new Error('useUiScript UiScriptProvider ishinde qollanılıwı kerek');
  return context;
}
