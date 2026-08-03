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

/** Run required + optional fetchers; optional never blocks. */
export async function loadPageBundle(required = {}, optional = {}) {
  const reqKeys = Object.keys(required);
  const optKeys = Object.keys(optional);

  const reqPromises = reqKeys.map((k) => Promise.resolve().then(() => required[k]()));
  const optPromises = optKeys.map((k) =>
    Promise.resolve()
      .then(() => optional[k]())
      .catch(() => null)
  );

  const [reqResults, optResults] = await Promise.all([
    Promise.all(reqPromises),
    Promise.all(optPromises),
  ]);

  const out = {};
  reqKeys.forEach((k, i) => {
    out[k] = reqResults[i];
  });
  optKeys.forEach((k, i) => {
    out[k] = optResults[i];
  });
  return out;
}
