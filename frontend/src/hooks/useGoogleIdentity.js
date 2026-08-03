import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAuthConfig } from '../api/auth';

const SCRIPT_ID = 'google-gsi-client';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise = null;

function loadGsiScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      const check = () => {
        if (window.google?.accounts?.id) resolve();
        else setTimeout(check, 50);
      };
      check();
      return;
    }
    const s = document.createElement('script');
    s.id = SCRIPT_ID;
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.google?.accounts?.id) resolve();
      else reject(new Error('GSI loaded but API missing'));
    };
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('GSI script failed'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

function makeNonce() {
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Google Identity Services (Sign-In) — OAuth 2.0 / OpenID Connect ID token.
 */
export function useGoogleIdentity({
  text = 'signin_with',
  onCredential,
  onError,
  enabled = true,
  promptOneTap = false,
} = {}) {
  const [clientId, setClientId] = useState('');
  const [ready, setReady] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [scriptError, setScriptError] = useState('');
  const nonceRef = useRef('');
  const containerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    let cancelled = false;
    setLoadingConfig(true);
    fetchAuthConfig()
      .then((c) => {
        if (cancelled) return;
        setClientId(c.googleEnabled ? c.googleClientId || '' : '');
      })
      .catch(() => {
        if (!cancelled) setClientId('');
      })
      .finally(() => {
        if (!cancelled) setLoadingConfig(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCredential = useCallback(async (response) => {
    try {
      await onCredentialRef.current?.({
        credential: response.credential,
        nonce: nonceRef.current || null,
      });
    } catch (err) {
      onErrorRef.current?.(err);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !clientId || !containerRef.current) {
      setReady(false);
      return undefined;
    }

    let cancelled = false;
    let resizeObserver = null;

    (async () => {
      try {
        await loadGsiScript();
        if (cancelled || !containerRef.current) return;

        nonceRef.current = makeNonce();
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          nonce: nonceRef.current,
          auto_select: false,
          cancel_on_tap_outside: true,
          context: text === 'signup_with' ? 'signup' : 'signin',
          ux_mode: 'popup',
        });

        const render = () => {
          const el = containerRef.current;
          if (!el || cancelled || !window.google?.accounts?.id) return;
          el.innerHTML = '';
          // Explicit width — clientWidth can be 0 before layout in some shells
          const width = Math.min(360, Math.max(280, el.clientWidth || 320));
          window.google.accounts.id.renderButton(el, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text,
            width,
            logo_alignment: 'left',
          });
          // Force visible box if GIS iframe collapses
          const iframe = el.querySelector('iframe');
          if (iframe) {
            iframe.style.minWidth = `${width}px`;
            iframe.style.minHeight = '44px';
          }
          setReady(true);
          setScriptError('');
        };

        // Wait a frame so flex layout has width
        requestAnimationFrame(() => {
          if (cancelled) return;
          render();
          resizeObserver = new ResizeObserver(() => render());
          if (containerRef.current) resizeObserver.observe(containerRef.current);

          if (promptOneTap) {
            try {
              window.google.accounts.id.prompt();
            } catch {
              /* One Tap optional */
            }
          }
        });
      } catch (err) {
        if (!cancelled) {
          setScriptError(err.message || 'GSI');
          setReady(false);
          onErrorRef.current?.(err);
        }
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      try {
        window.google?.accounts?.id?.cancel?.();
      } catch {
        /* ignore */
      }
    };
  }, [clientId, enabled, text, promptOneTap, handleCredential]);

  return {
    containerRef,
    clientId,
    googleEnabled: Boolean(clientId),
    ready,
    loadingConfig,
    scriptError,
  };
}
