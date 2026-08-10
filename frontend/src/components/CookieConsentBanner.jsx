import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';

const STORAGE_KEY = 'qp_cookie_consent';

function readConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.accepted === 'boolean') return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function getCookieConsent() {
  return readConsent();
}

/**
 * Cookie / localStorage haqqında xabar — 1 kúnlik session token.
 */
export default function CookieConsentBanner() {
  const { text } = useUiScript();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readConsent());
  }, []);

  const save = (accepted) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ accepted, at: Date.now(), sessionDays: 1 })
      );
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={text(KAA.cookieConsentTitle)}
      className="fixed inset-x-0 bottom-0 z-[80] p-4 md:p-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4 rounded-2xl border border-ink/10 bg-white/95 p-4 shadow-xl backdrop-blur-md md:flex-row md:items-center md:p-5">
        <div className="min-w-0 flex-1">
          <p className="font-display text-base text-ink">{text(KAA.cookieConsentTitle)}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/65">
            {text(KAA.cookieConsentBody)}{' '}
            <Link to="/privacy" className="font-semibold text-teal-800 underline underline-offset-2">
              {text(KAA.privacyShort)}
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save(false)}
            className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-semibold text-ink/70"
          >
            {text(KAA.cookieConsentDecline)}
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            className="rounded-full bg-teal-800 px-4 py-2 text-sm font-bold text-white"
          >
            {text(KAA.cookieConsentAccept)}
          </button>
        </div>
      </div>
    </div>
  );
}
