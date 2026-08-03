import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import Icon from './Icon';
import GoogleSignInButton from './GoogleSignInButton';
import { loginWithGoogle } from '../api/auth';
import { AnimChevron, anim } from '../animations';
import { KAA } from '../i18n/kaa';
import { getGuestLocalSummary } from '../lib/guestLocalSummary';
import { postAuthDestination } from '../lib/postAuthDestination';
import useResumeTick from '../hooks/useResumeTick';

const REASON_COPY = {
  quiz: {
    titleKey: 'gateQuizTitle',
    bodyKey: 'gateQuizBody',
  },
  word: {
    titleKey: 'gateWordTitle',
    bodyKey: 'gateWordBody',
  },
  crossword: {
    titleKey: 'gateCrosswordTitle',
    bodyKey: 'gateCrosswordBody',
  },
};

const FALLBACK_CONTINUE = {
  quiz: { to: '/games', icon: 'trophy', labelKey: 'oyinlar' },
  word: { to: '/literature', icon: 'book', labelKey: 'adebiyat' },
  crossword: { to: '/games', icon: 'trophy', labelKey: 'oyinlar' },
};

/**
 * Soft sync prompt — quotas unlimited; invite profile sync, not a hard gate.
 */
export default function GuestGateModal({ open, reason = 'quiz', onClose }) {
  const { text } = useUiScript();
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const resumeTick = useResumeTick();
  const local = useMemo(() => getGuestLocalSummary(), [resumeTick]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const resumeFrom = local.primary?.href || `${location.pathname}${location.search || ''}` || '/';

  const onGoogle = useCallback(
    async ({ credential, nonce }) => {
      setError('');
      setBusy(true);
      try {
        const data = await loginWithGoogle(credential, nonce);
        loginSuccess(data);
        onClose?.();
        navigate(postAuthDestination(resumeFrom), { replace: true });
      } catch (err) {
        setError(err.message || KAA.googleSatsiz);
      } finally {
        setBusy(false);
      }
    },
    [loginSuccess, onClose, navigate, resumeFrom]
  );

  if (!open) return null;
  const copy = REASON_COPY[reason] || REASON_COPY.quiz;
  const fallback = FALLBACK_CONTINUE[reason] || FALLBACK_CONTINUE.quiz;
  const continueHref = local.primary?.href || fallback.to;
  const continueIcon = local.primary?.icon || fallback.icon;
  const continueLabel = local.primary
    ? KAA[local.primary.labelKey] || local.primary.labelKey
    : KAA[fallback.labelKey] || fallback.labelKey;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        aria-label={text(KAA.jabiw)}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-3xl border border-ink/10 bg-parchment px-6 py-7 shadow-2xl"
      >
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <Icon name="sparkle" />
        </span>
        <h2 className="mb-2 font-display text-2xl tracking-tight text-ink">
          {text(KAA[copy.titleKey] || copy.titleKey)}
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-ink/65">
          {text(KAA[copy.bodyKey] || copy.bodyKey)}
        </p>

        <div className="mb-5 rounded-2xl border border-teal-700/15 bg-gradient-to-br from-teal-50/80 via-white to-amber-50/40 px-4 py-4">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/60">
            {text(KAA.gateFreeEyebrow)}
          </p>
          <Link
            to={continueHref}
            onClick={onClose}
            className={`${anim.shine} mb-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white`}
          >
            <Icon name={continueIcon} />
            {text(continueLabel)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-teal-700/20 bg-white px-4 py-2 text-xs font-bold text-teal-950"
          >
            {text(KAA.gateContinueFree)}
          </button>
        </div>

        <div className={`mb-4 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
          <p className="mb-2 text-center text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/35">
            {text(KAA.gateSyncHint)}
          </p>
          <GoogleSignInButton
            mode="signin"
            onCredential={onGoogle}
            onError={(e) => setError(e?.message || KAA.googleSatsiz)}
            showFallbackHint={false}
          />
        </div>

        {error ? (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
            {text(error)}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            to="/profile"
            className="inline-flex rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-semibold text-teal-950"
            onClick={onClose}
          >
            {text(KAA.gateSyncCta)}
          </Link>
          <Link
            to="/register"
            state={{ from: resumeFrom }}
            className="inline-flex rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/70"
            onClick={onClose}
          >
            {text(KAA.dizimnenOtiw)}
          </Link>
          <Link
            to="/login"
            state={{ from: resumeFrom }}
            className="inline-flex px-3 py-2.5 text-sm font-semibold text-teal-900 hover:underline"
            onClick={onClose}
          >
            {text(KAA.kiriw)}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex px-3 py-2.5 text-sm text-ink/45 hover:text-ink"
          >
            {text(KAA.keyinirek)}
          </button>
        </div>
      </div>
    </div>
  );
}
