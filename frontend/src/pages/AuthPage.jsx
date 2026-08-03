import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import GoogleSignInButton from '../components/GoogleSignInButton';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import {
  completeTotpLogin,
  fetchAuthConfig,
  loginWithEmail,
  loginWithGoogle,
  loginWithPhoneOtp,
  registerWithEmail,
  requestPhoneLoginOtp,
} from '../api/auth';
import { postAuthDestination } from '../lib/postAuthDestination';
import { KAA } from '../i18n/kaa';
import GuestSoftContinue from '../components/GuestSoftContinue';

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-ink/12 bg-white/80 px-4 py-3 text-base text-ink outline-none transition placeholder:text-ink/30 focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15 sm:text-sm';

export default function AuthPage({ mode = 'login' }) {
  const isRegister = mode === 'register';
  const { text } = useUiScript();
  const { loginSuccess, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [totpChallenge, setTotpChallenge] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [authMethod, setAuthMethod] = useState('email');
  const [phoneLoginOn, setPhoneLoginOn] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneDevCode, setPhoneDevCode] = useState('');

  usePageMeta(
    text(isRegister ? KAA.dizimnenOtiw : KAA.kiriw),
    text(KAA.socialLoginTush)
  );

  useEffect(() => {
    if (isRegister) return undefined;
    fetchAuthConfig()
      .then((c) => setPhoneLoginOn(Boolean(c.features?.phoneLogin)))
      .catch(() => setPhoneLoginOn(false));
    return undefined;
  }, [isRegister]);

  const authDest = useCallback(
    () => postAuthDestination(location.state?.from),
    [location.state?.from]
  );

  useEffect(() => {
    if (isAuthenticated) navigate(authDest(), { replace: true });
  }, [isAuthenticated, navigate, authDest]);

  const afterAuth = useCallback(
    (data) => {
      if (data?.requiresTotp && data?.challengeToken) {
        setTotpChallenge(data.challengeToken);
        setTotpCode('');
        setError('');
        return;
      }
      loginSuccess(data);
      navigate(authDest(), { replace: true });
    },
    [loginSuccess, navigate, authDest]
  );

  const onGoogle = useCallback(
    async ({ credential, nonce }) => {
      setError('');
      setBusy(true);
      try {
        const data = await loginWithGoogle(credential, nonce);
        afterAuth(data);
      } catch (e) {
        setError(e.message || KAA.googleSatsiz);
      } finally {
        setBusy(false);
      }
    },
    [afterAuth]
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (totpChallenge) {
        const data = await completeTotpLogin({
          challengeToken: totpChallenge,
          code: totpCode,
        });
        afterAuth(data);
        return;
      }
      if (!isRegister && authMethod === 'phone') {
        if (!phoneSent) {
          const data = await requestPhoneLoginOtp(phone);
          setPhoneSent(true);
          setPhoneDevCode(data.devCode || '');
          return;
        }
        const data = await loginWithPhoneOtp({ phone, code: phoneCode });
        afterAuth(data);
        return;
      }
      const data = isRegister
        ? await registerWithEmail({ email, password, displayName })
        : await loginWithEmail({ email, password });
      afterAuth(data);
    } catch (err) {
      setError(err.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  const showPhone = !isRegister && phoneLoginOn && !totpChallenge;

  return (
    <DictShell className="pt-24 pb-28 md:pb-24">
      <section className="mx-auto max-w-sm px-5 pt-8 sm:max-w-md sm:px-6">
        <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
          {text(totpChallenge ? KAA.prepTotp : isRegister ? KAA.dizimnenOtiw : KAA.kiriw)}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/50">
          {text(
            totpChallenge
              ? KAA.prepTotpTush
              : showPhone && authMethod === 'phone'
                ? KAA.phoneLoginBody
                : KAA.socialLoginTush
          )}
        </p>
        {!totpChallenge && (
          <p className="mt-1 text-sm leading-relaxed text-ink/50">{text(KAA.anonimQosıladı)}</p>
        )}

        {!totpChallenge && (
          <GuestSoftContinue
            className="mt-6 qp-surface px-4 py-4"
            bodyKey="authGuestFreeBody"
            showHome
          />
        )}

        {!totpChallenge && (
          <>
            <div className="mt-8">
              <p className="mb-3 text-center text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/35">
                {text(KAA.googleSignIn)}
              </p>
              <GoogleSignInButton
                mode={isRegister ? 'signup' : 'signin'}
                onCredential={onGoogle}
                onError={(e) => setError(e?.message || KAA.googleSatsiz)}
                promptOneTap={!isRegister}
                showFallbackHint
              />
            </div>

            <div className="my-6 flex items-center gap-3 text-[0.65rem] uppercase tracking-wider text-ink/30">
              <span className="h-px flex-1 bg-ink/10" />
              {text(KAA.yamasaEmail)}
              <span className="h-px flex-1 bg-ink/10" />
            </div>
          </>
        )}

        {showPhone && (
          <div className="mb-4 flex gap-1 qp-chip !rounded-full p-1">
            <button
              type="button"
              onClick={() => setAuthMethod('email')}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                authMethod === 'email' ? 'bg-teal-900 text-white' : 'text-ink/50'
              }`}
            >
              {text(KAA.phoneLoginEmailTab)}
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('phone')}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                authMethod === 'phone' ? 'bg-teal-900 text-white' : 'text-ink/50'
              }`}
            >
              {text(KAA.phoneLoginTab)}
            </button>
          </div>
        )}

        <form onSubmit={submit} className={`space-y-4 ${totpChallenge ? 'mt-8' : ''}`}>
          {totpChallenge ? (
            <label className="block">
              <span className="text-xs font-medium text-ink/50">Authenticator</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
                maxLength={8}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ''))}
                className={fieldClass}
                placeholder="123456"
              />
            </label>
          ) : showPhone && authMethod === 'phone' ? (
            <>
              <label className="block">
                <span className="text-xs font-medium text-ink/50">{text(KAA.telefon)}</span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldClass}
                  placeholder={text(KAA.prepPhoneHint)}
                />
              </label>
              {phoneSent ? (
                <>
                  {phoneDevCode ? (
                    <p className="rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-mono text-amber-950">
                      {text(KAA.prepPhoneDevCode)}: {phoneDevCode}
                    </p>
                  ) : null}
                  <label className="block">
                    <span className="text-xs font-medium text-ink/50">{text(KAA.prepPhoneCodeHint)}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      required
                      pattern="[0-9]{6}"
                      maxLength={8}
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\s/g, ''))}
                      className={fieldClass}
                      placeholder="123456"
                    />
                  </label>
                </>
              ) : null}
            </>
          ) : (
            <>
              {isRegister && (
                <label className="block">
                  <span className="text-xs font-medium text-ink/50">{text(KAA.atiniz)}</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    autoComplete="name"
                    className={fieldClass}
                  />
                </label>
              )}
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
              <label className="block">
                <span className="text-xs font-medium text-ink/50">{text(KAA.qupiyaSoz)}</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  className={fieldClass}
                />
                {isRegister && (
                  <span className="mt-1 block text-[0.7rem] text-ink/35">{text(KAA.keminde8)}</span>
                )}
                {!isRegister && (
                  <Link
                    to="/forgot-password"
                    className="mt-2 inline-block text-xs font-medium text-teal-900 hover:underline"
                  >
                    {text(KAA.qupiyaUmyttinizba)}
                  </Link>
                )}
              </label>
            </>
          )}

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
            {text(
              busy
                ? KAA.kutilipAtir
                : totpChallenge
                  ? KAA.kiriw
                  : showPhone && authMethod === 'phone'
                    ? phoneSent
                      ? KAA.kiriw
                      : KAA.prepPhoneSend
                    : isRegister
                      ? KAA.dizimAshiw
                      : KAA.kiriw
            )}
          </button>

          {totpChallenge && (
            <button
              type="button"
              className="w-full text-sm text-ink/50 hover:underline"
              onClick={() => {
                setTotpChallenge('');
                setTotpCode('');
              }}
            >
              ← {text(KAA.kiriw)}
            </button>
          )}
        </form>

        {!totpChallenge && (
          <p className="mt-8 text-center text-sm text-ink/50">
            {isRegister ? (
              <>
                {text(KAA.dizimBarMa)}{' '}
                <Link
                  to="/login"
                  state={location.state}
                  className="font-semibold text-teal-900 hover:underline"
                >
                  {text(KAA.kiriw)}
                </Link>
              </>
            ) : (
              <>
                {text(KAA.janaMisin)}{' '}
                <Link
                  to="/register"
                  state={location.state}
                  className="font-semibold text-teal-900 hover:underline"
                >
                  {text(KAA.dizim)}
                </Link>
              </>
            )}
          </p>
        )}
      </section>
    </DictShell>
  );
}
