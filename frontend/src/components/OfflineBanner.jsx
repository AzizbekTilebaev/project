import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import FreePlayCtaRow from './FreePlayCtaRow';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { dispatchBackOnline } from '../lib/networkRecovery';

/**
 * Offline sticky banner + back-online recovery CTA + local free play.
 */
export default function OfflineBanner() {
  const { text } = useUiScript();
  const [mode, setMode] = useState(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'ok'
  );
  const wasOfflineRef = useRef(mode === 'offline');
  const dismissTimer = useRef(null);

  useEffect(() => {
    const clearDismiss = () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    };

    const goOffline = () => {
      clearDismiss();
      wasOfflineRef.current = true;
      setMode('offline');
    };

    const goOnline = () => {
      if (!wasOfflineRef.current) {
        setMode('ok');
        return;
      }
      wasOfflineRef.current = false;
      setMode('back');
      dispatchBackOnline();
      clearDismiss();
      dismissTimer.current = setTimeout(() => setMode('ok'), 14000);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    if (navigator.onLine === false) {
      wasOfflineRef.current = true;
      setMode('offline');
    }
    return () => {
      clearDismiss();
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (mode === 'ok') return null;

  if (mode === 'offline') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[60] border-b border-amber-800/20 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950"
      >
        <p>{text(KAA.offlineBanner)}</p>
        <p className="mt-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-amber-900/60">
          {text(KAA.offlineLocalHint)}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <FreePlayCtaRow links={FOOTER_FREE_LINKS} compact justify="center" />
          <Link
            to="/dictionary/favorites"
            className="inline-flex items-center gap-1 rounded-full border border-amber-900/25 bg-white/70 px-3 py-1 text-xs font-bold text-amber-950"
          >
            <Icon name="heart" /> {text(KAA.yoqtirilganlar)}
          </Link>
          <Link
            to="/profile"
            className="inline-flex items-center gap-1 rounded-full border border-amber-900/20 bg-white/50 px-3 py-1 text-xs font-semibold text-amber-950/80"
          >
            {text(KAA.profileGuestNav)}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] border-b border-emerald-800/20 bg-emerald-100 px-4 py-2 text-center text-sm font-medium text-emerald-950"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span>{text(KAA.offlineBackOnline)}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex rounded-full bg-emerald-800 px-3.5 py-1 text-xs font-bold text-white transition hover:bg-emerald-900"
        >
          {text(KAA.offlineReloadCta)}
        </button>
        <FreePlayCtaRow links={FOOTER_FREE_LINKS} compact />
        <button
          type="button"
          onClick={() => setMode('ok')}
          className="inline-flex rounded-full border border-emerald-800/25 bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-950"
        >
          {text(KAA.offlineDismiss)}
        </button>
      </div>
    </div>
  );
}
