import { useCallback, useEffect, useRef, useState } from 'react';
import { BACK_ONLINE_EVENT } from '../lib/networkRecovery';

/**
 * Abort-safe page data loader.
 * All required fetchers must resolve before status becomes 'ready'.
 * Optional fetchers never block the gate (failures become fallbacks).
 *
 * @param {() => Promise<object>} loader - async function returning page data
 * @param {object} [options]
 * @param {any[]} [options.deps] - reload when deps change
 * @param {boolean} [options.enabled=true]
 */
export default function usePageData(loader, { deps = [], enabled = true } = {}) {
  const [status, setStatus] = useState(enabled ? 'loading' : 'ready');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const loaderRef = useRef(loader);
  const statusRef = useRef(status);
  loaderRef.current = loader;
  statusRef.current = status;

  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    const onBackOnline = () => {
      if (statusRef.current === 'error') reload();
    };
    window.addEventListener(BACK_ONLINE_EVENT, onBackOnline);
    return () => window.removeEventListener(BACK_ONLINE_EVENT, onBackOnline);
  }, [reload]);

  useEffect(() => {
    if (!enabled) {
      setStatus('ready');
      return undefined;
    }

    let cancelled = false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;

    setStatus('loading');
    setError(null);

    (async () => {
      try {
        const result = await loaderRef.current({ signal: controller?.signal });
        if (cancelled) return;
        setData(result);
        setStatus('ready');
      } catch (err) {
        if (cancelled || err?.name === 'AbortError') return;
        setError(err?.message || 'Júklew qáteligi');
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      controller?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps]);

  return { status, data, error, reload, loading: status === 'loading', ready: status === 'ready' };
}

/**
 * Run required + optional fetchers.
 * Optional: failures → null; waits up to `optBudgetMs` so Aiven cold start
 * does not hold the whole page (default 400ms).
 */
export async function loadPageBundle(required = {}, optional = {}, optBudgetMs = 400) {
  const reqKeys = Object.keys(required);
  const optKeys = Object.keys(optional);

  const reqResults = await Promise.all(
    reqKeys.map((k) => Promise.resolve().then(() => required[k]()))
  );

  const out = {};
  reqKeys.forEach((k, i) => {
    out[k] = reqResults[i];
  });
  optKeys.forEach((k) => {
    out[k] = null;
  });

  if (!optKeys.length) return out;

  const optWork = Promise.all(
    optKeys.map((k) =>
      Promise.resolve()
        .then(() => optional[k]())
        .catch(() => null)
    )
  );

  if (optBudgetMs <= 0) {
    optWork.then((optResults) => {
      optKeys.forEach((k, i) => {
        out[k] = optResults[i];
      });
    });
    return out;
  }

  const optResults = await Promise.race([
    optWork,
    new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), optBudgetMs);
      t.unref?.();
    }),
  ]);

  if (Array.isArray(optResults)) {
    optKeys.forEach((k, i) => {
      out[k] = optResults[i];
    });
  }
  return out;
}
