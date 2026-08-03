import DictShell from '../components/dictionary/DictShell';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import { requestPasswordReset } from '../api/auth';
import { safeResetDevUrl } from '../lib/safeUrl';
import { KAA } from '../i18n/kaa';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-ink/12 bg-white/80 px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink/30 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15 sm:text-sm';

export default function ForgotPasswordPage() {
  const { text } = useUiScript();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [devUrl, setDevUrl] = useState('');

  usePageMeta(text(KAA.qupiyaTiklew), text(KAA.qupiyaTiklewTush));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    setDevUrl('');
    try {
      const data = await requestPasswordReset(email);
      setDone(true);
      if (data.resetUrl) setDevUrl(safeResetDevUrl(data.resetUrl));
    } catch (err) {
      setError(err.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  return (
    <DictShell className="pt-24 pb-28 md:pb-24">
      <section className="mx-auto max-w-sm px-5 pt-8 sm:max-w-md sm:px-6">
        <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
          {text(KAA.qupiyaTiklew)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/50">{text(KAA.qupiyaTiklewTush)}</p>

        <GuestSoftContinue
          className="mt-6 qp-surface px-4 py-4"
          bodyKey="authGuestFreeBody"
          showHome
        />

        {done ? (
          <div className="mt-8 space-y-4">
            <p className="rounded-xl bg-teal-50 px-3.5 py-3 text-sm text-teal-900" role="status">
              {text(KAA.qupiyaTiklewJiberildi)}
            </p>
            {devUrl ? (
              <p className="break-all rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-950">
                <span className="mb-1 block font-semibold">{text(KAA.jetilistiruwSilteme)}</span>
                <a href={devUrl} className="underline">
                  {devUrl}
                </a>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link to="/login" className="text-sm font-semibold text-teal-900 hover:underline">
                {text(KAA.kiriw)}
              </Link>
              <GuestSoftContinue compact titleKey={null} showHome={false} />
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-ink/50">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
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
              {text(busy ? KAA.kutilipAtir : KAA.siltemeJiberiw)}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm text-ink/50">
          <Link to="/login" className="font-semibold text-teal-900 hover:underline">
            {text(KAA.kiriw)}
          </Link>
          {' · '}
          <Link to="/profile" className="font-semibold text-teal-900 hover:underline">
            {text(KAA.profileGuestNav)}
          </Link>
        </p>
      </section>
    </DictShell>
  );
}
