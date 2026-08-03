import { Link } from 'react-router-dom';
import { useState } from 'react';
import DictShell from '../components/dictionary/DictShell';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import { THEMES, QUIZ_ADVANCE_MODES, useAppSettings } from '../contexts/AppSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/Icon';
import AuthPrepPanel from '../components/AuthPrepPanel';
import { changePassword, revokeOtherSessions } from '../api/auth';
import { KAA } from '../i18n/kaa';
import GuestSoftContinue from '../components/GuestSoftContinue';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';

const THEME_META = {
  day: { label: KAA.kundiz, hint: KAA.kundizHint, swatch: 'linear-gradient(135deg, #f7f2e9, #efe8db 60%, #0f5c56)' },
  night: { label: KAA.tun, hint: KAA.tunHint, swatch: 'linear-gradient(135deg, #151c1e, #1e282a 55%, #3d8b84)' },
  sepia: { label: KAA.sepiya, hint: KAA.sepiyaHint, swatch: 'linear-gradient(135deg, #f5ebd8, #ebe0c8 55%, #8b6914)' },
  focus: { label: KAA.aljawisiz, hint: KAA.aljawisizHint, swatch: 'linear-gradient(135deg, #f7f7f5, #fff 55%, #1a1a1a)' },
};

const ADVANCE_META = {
  confirm: { label: KAA.tastiyiqlaw, hint: KAA.tastiyiqlawHint, icon: 'check-circle' },
  next: { label: KAA.avtoOtiw, hint: KAA.avtoOtiwHint, icon: 'right' },
};

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-ink/12 bg-white/80 px-4 py-2.5 text-sm text-ink outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15';

export default function Settings() {
  const { text } = useUiScript();
  const { isAuthenticated, user, loginSuccess } = useAuth();
  const { theme, setTheme, quizAdvanceMode, setQuizAdvanceMode } = useAppSettings();
  usePageMeta(text(KAA.sazlawlar), text(KAA.sazlawlarTush));

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [sessMsg, setSessMsg] = useState('');
  const [sessErr, setSessErr] = useState('');
  const [sessBusy, setSessBusy] = useState(false);

  const hasPassword = Boolean(user?.hasPassword);

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwOk('');
    if (newPassword !== confirmPassword) {
      setPwError(KAA.qupiyaSáykesEmes);
      return;
    }
    setPwBusy(true);
    try {
      const data = await changePassword({
        currentPassword: hasPassword ? currentPassword : undefined,
        newPassword,
      });
      if (data.user) loginSuccess({ user: data.user });
      setPwOk(KAA.qupiyaÓzgertildi);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err.message || KAA.qatelik);
    } finally {
      setPwBusy(false);
    }
  };

  const onRevokeOtherSessions = async () => {
    setSessMsg('');
    setSessErr('');
    setSessBusy(true);
    try {
      await revokeOtherSessions();
      setSessMsg(KAA.basqaSessiyalarJawıldı);
    } catch (err) {
      setSessErr(err.message || KAA.qatelik);
    } finally {
      setSessBusy(false);
    }
  };

  return (
    <DictShell className="pt-24 pb-28 md:pb-24">
      <section className="mx-auto max-w-lg px-5 pt-6 sm:px-6 md:px-8">
        <header className="mb-8">
          <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
            {text(KAA.sazlawlar)}
          </h1>
          <p className="mt-2 text-sm text-ink/50">{text(KAA.sazlawlarTush)}</p>
        </header>

        <div className="space-y-8">
          {!isAuthenticated && (
            <div className="space-y-3">
              <GuestSoftContinue
                className="qp-surface px-4 py-4"
                titleKey="settingsGuestFreeTitle"
                bodyKey="settingsGuestFreeBody"
              />
              <div className="qp-card qp-card--static px-4 py-3">
                <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                  {text(KAA.footerFreeEyebrow)}
                </p>
                <FreePlayCtaRow links={FOOTER_FREE_LINKS} compact />
              </div>
            </div>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">{text(KAA.mavzu)}</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {THEMES.map((t) => {
                const meta = THEME_META[t];
                const active = theme === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    aria-pressed={active}
                    className={`p-2.5 text-left transition ${
                      active
                        ? 'qp-card qp-card--static border-teal-700/50 bg-teal-50/80 ring-2 ring-teal-700/20'
                        : 'qp-card qp-card--static hover:border-ink/20'
                    }`}
                  >
                    <span
                      className="mb-2 block h-10 rounded-xl border border-ink/10"
                      style={{ background: meta.swatch }}
                      aria-hidden
                    />
                    <span className="block text-sm font-semibold text-ink">{text(meta.label)}</span>
                    <span className="text-[0.7rem] text-ink/40">{text(meta.hint)}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-ink/40">{text(KAA.kirillLatinHint)}</p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-ink">{text(KAA.testJuwabi)}</h2>
            <div className="overflow-hidden qp-card qp-card--static">
              {QUIZ_ADVANCE_MODES.map((m, i) => {
                const meta = ADVANCE_META[m];
                const active = quizAdvanceMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setQuizAdvanceMode(m)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${
                      i > 0 ? 'border-t border-ink/10' : ''
                    } ${active ? 'bg-teal-50/70' : 'hover:bg-ink/[0.03]'}`}
                  >
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        active ? 'bg-teal-900 text-white' : 'bg-ink/[0.06] text-ink/45'
                      }`}
                    >
                      <Icon name={meta.icon} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{text(meta.label)}</span>
                      <span className="text-xs text-ink/45">{text(meta.hint)}</span>
                    </span>
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                        active ? 'border-teal-800 bg-teal-800' : 'border-ink/25'
                      }`}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          </section>

          {isAuthenticated && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                {text(hasPassword ? KAA.qupiyaÓzgertiw : KAA.qupiyaOrnatiw)}
              </h2>
              <form
                onSubmit={submitPassword}
                className="space-y-3 qp-card qp-card--static p-4"
              >
                {hasPassword && (
                  <label className="block">
                    <span className="text-xs font-medium text-ink/50">{text(KAA.házirgiQupiya)}</span>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className={fieldClass}
                    />
                  </label>
                )}
                <label className="block">
                  <span className="text-xs font-medium text-ink/50">{text(KAA.jańaQupiya)}</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={fieldClass}
                  />
                </label>
                {pwError && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                    {text(pwError)}
                  </p>
                )}
                {pwOk && (
                  <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900" role="status">
                    {text(pwOk)}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={pwBusy}
                  className="rounded-full bg-teal-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {text(pwBusy ? KAA.kutilipAtir : KAA.saqlaw)}
                </button>
              </form>
            </section>
          )}

          {isAuthenticated && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink">{text(KAA.basqaSessiyalardiJawiw)}</h2>
              <div className="space-y-3 qp-card qp-card--static p-4">
                <p className="text-xs text-ink/50">{text(KAA.basqaSessiyalarTush)}</p>
                {sessErr ? (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
                    {text(sessErr)}
                  </p>
                ) : null}
                {sessMsg ? (
                  <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900" role="status">
                    {text(sessMsg)}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={sessBusy}
                  onClick={onRevokeOtherSessions}
                  className="rounded-full border border-rose-300 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-800 disabled:opacity-50"
                >
                  {text(sessBusy ? KAA.kutilipAtir : KAA.basqaSessiyalardiJawiw)}
                </button>
              </div>
            </section>
          )}

          <AuthPrepPanel />

          <nav className="flex flex-wrap gap-4 border-t border-ink/10 pt-6 text-sm">
            <Link
              to="/profile"
              className="font-semibold text-teal-900 hover:underline"
            >
              {text(isAuthenticated ? KAA.profil : KAA.profileGuestNav)}
            </Link>
            <Link to="/quiz/statistics" className="text-ink/50 hover:text-teal-900 hover:underline">
              {text(KAA.statistika)}
            </Link>
            <Link to="/faq" className="text-ink/50 hover:text-teal-900 hover:underline">
              {text(KAA.faqShort)}
            </Link>
            <Link to="/about" className="text-ink/50 hover:text-teal-900 hover:underline">
              {text(KAA.aboutShort)}
            </Link>
            <Link to="/" className="text-ink/50 hover:text-teal-900 hover:underline">
              {text(KAA.basBet)}
            </Link>
          </nav>
        </div>
      </section>
    </DictShell>
  );
}
