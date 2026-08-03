import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { resetPassword } from '../api/auth';
import { KAA } from '../i18n/kaa';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { postAuthDestination } from '../lib/postAuthDestination';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-ink/12 bg-white/80 px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink/30 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15 sm:text-sm';

function readResetTokenOnce() {
  if (typeof window === 'undefined') return '';
  const q = new URLSearchParams(window.location.search).get('token');
  if (q) return String(q).trim();
  const hash = String(window.location.hash || '').replace(/^#/, '');
  return String(new URLSearchParams(hash).get('token') || '').trim();
}

export default function ResetPasswordPage() {
  const { text } = useUiScript();
  const { loginSuccess } = useAuth();
  const navigate = useNavigate();
  const [token] = useState(readResetTokenOnce);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  usePageMeta(text(KAA.jańaQupiya), text(KAA.jańaQupiyaTush));

  // Query string dan tokenni olib, hash ga ko‘chirish (Referer sizroq)
  useEffect(() => {
    if (!token || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('token')) {
      url.searchParams.delete('token');
      url.hash = `token=${encodeURIComponent(token)}`;
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError(KAA.qupiyaSáykesEmes);
      return;
    }
    if (!token) {
      setError(KAA.tiklewSiltemeJoq);
      return;
    }
    setBusy(true);
    try {
      const data = await resetPassword({ token, newPassword: password });
      loginSuccess(data);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', window.location.pathname);
      }
      navigate(postAuthDestination(null), { replace: true });
    } catch (err) {
      setError(err.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <DictShell className="pt-24 pb-28 md:pb-24">
        <section className="mx-auto max-w-sm px-5 pt-8 sm:max-w-md sm:px-6">
          <h1 className="font-display text-3xl tracking-tight text-ink">{text(KAA.jańaQupiya)}</h1>
          <p className="mt-4 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
            {text(KAA.tiklewSiltemeJoq)}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/forgot-password"
              className="qp-btn-primary"
            >
              {text(KAA.qupiyaTiklew)}
            </Link>
            <Link
              to="/login"
              className="inline-flex rounded-full border border-ink/15 px-5 py-2.5 text-sm font-semibold text-ink/70"
            >
              {text(KAA.kiriw)}
            </Link>
          </div>
          <GuestSoftContinue
            className="mt-6 qp-surface px-4 py-4"
            bodyKey="authGuestFreeBody"
            showHome
          />
        </section>
      </DictShell>
    );
  }

  return (
    <DictShell className="pt-24 pb-28 md:pb-24">
      <section className="mx-auto max-w-sm px-5 pt-8 sm:max-w-md sm:px-6">
        <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
          {text(KAA.jańaQupiya)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/50">{text(KAA.jańaQupiyaTush)}</p>

        <GuestSoftContinue
          className="mt-6 qp-surface px-4 py-4"
          bodyKey="authGuestFreeBody"
          showHome
        />

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink/50">{text(KAA.jańaQupiya)}</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className={fieldClass}
            />
            <span className="mt-1 block text-[0.7rem] text-ink/35">{text(KAA.keminde8)}</span>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink/50">{text(KAA.qupiyaQayta)}</span>
            <input
              type="password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={fieldClass}
            />
          </label>

          {error && (
            <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800" role="alert">
              {text(error)}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="qp-btn-primary w-full !py-3.5 disabled:opacity-50"
          >
            {text(busy ? KAA.kutilipAtir : KAA.saqlaw)}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-ink/50">
          <Link to="/profile" className="font-semibold text-teal-900 hover:underline">
            {text(KAA.profileGuestNav)}
          </Link>
        </p>
      </section>
    </DictShell>
  );
}
