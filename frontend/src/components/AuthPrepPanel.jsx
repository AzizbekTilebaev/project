import { useEffect, useState } from 'react';
import {
  beginTotpSetup,
  confirmTotpSetup,
  disableTotp,
  fetchAuthConfig,
  requestPhoneVerifyOtp,
  verifyPhoneVerifyOtp,
} from '../api/auth';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { KAA } from '../i18n/kaa';

const fieldClass =
  'mt-1.5 w-full rounded-lg border border-ink/12 bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15';

/**
 * Kelajakdagi Google People / 2FA / telefon — tayyor, lekin default o‘chirilgan.
 * AUTH_TOTP_2FA=1 / AUTH_PHONE_LOGIN=1 bo‘lsa UI ishlaydi.
 */
export default function AuthPrepPanel() {
  const { text } = useUiScript();
  const { isAuthenticated, user, loginSuccess, refresh } = useAuth();
  const [features, setFeatures] = useState(null);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneDevCode, setPhoneDevCode] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchAuthConfig()
      .then((c) => setFeatures(c.features || null))
      .catch(() => setFeatures(null));
  }, []);

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

  if (!features?.showPrepUi) return null;

  const totpOn = Boolean(features.totp2fa);
  const totpEnabled = Boolean(user?.totpEnabled);
  const phoneOn = Boolean(features.phoneLogin);
  const phoneVerified = Boolean(user?.phoneVerified);

  const applyUser = async (data) => {
    if (data?.user) {
      loginSuccess({ user: data.user });
    } else {
      await refresh();
    }
  };

  const onBeginTotp = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const data = await beginTotpSetup();
      setTotpSecret(data.secret || '');
      setTotpUri(data.otpauthUrl || '');
      setTotpCode('');
      setMsg(KAA.prepTotpScan);
    } catch (e) {
      setErr(e.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  const onConfirmTotp = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const data = await confirmTotpSetup(totpCode);
      await applyUser(data);
      setTotpSecret('');
      setTotpUri('');
      setTotpCode('');
      setMsg(KAA.prepTotpActive);
    } catch (e2) {
      setErr(e2.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  const onDisableTotp = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const data = await disableTotp(totpCode);
      await applyUser(data);
      setTotpCode('');
      setMsg(KAA.prepTotpDisabled);
    } catch (e2) {
      setErr(e2.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  const onSendPhoneOtp = async () => {
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const data = await requestPhoneVerifyOtp(phone);
      setPhoneSent(true);
      setPhoneDevCode(data.devCode || '');
      setMsg(KAA.prepPhoneSent);
    } catch (e) {
      setErr(e.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  const onVerifyPhone = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      const data = await verifyPhoneVerifyOtp({ phone, code: phoneCode });
      await applyUser(data);
      setPhoneCode('');
      setPhoneDevCode('');
      setPhoneSent(false);
      setMsg(KAA.prepPhoneVerified);
    } catch (e2) {
      setErr(e2.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  const rows = [
    {
      id: 'people',
      title: KAA.prepGooglePeople,
      body: KAA.prepGooglePeopleTush,
      on: Boolean(features.googlePeopleSync),
    },
    {
      id: 'totp',
      title: KAA.prepTotp,
      body: KAA.prepTotpTush,
      on: totpOn,
      extra: totpEnabled ? KAA.prepTotpActive : null,
    },
    {
      id: 'phone',
      title: KAA.prepPhone,
      body: KAA.prepPhoneTush,
      on: phoneOn,
      extra: phoneVerified ? KAA.prepPhoneVerified : null,
    },
  ];

  return (
    <section className="rounded-2xl border border-dashed border-ink/15 bg-white/40 p-4">
      <h2 className="text-sm font-semibold text-ink">{text(KAA.prepTitle)}</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink/50">{text(KAA.prepTush)}</p>
      <ul className="mt-4 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-ink/8 bg-parchment/60 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink">{text(r.title)}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  r.on ? 'bg-emerald-100 text-emerald-800' : 'bg-ink/5 text-ink/45'
                }`}
              >
                {text(r.on ? KAA.prepOn : KAA.prepOff)}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink/50">{text(r.body)}</p>
            {isAuthenticated && r.extra ? (
              <p className="mt-1 text-xs font-medium text-teal-800">{text(r.extra)}</p>
            ) : null}

            {r.id === 'totp' && isAuthenticated && totpOn ? (
              <div className="mt-3 space-y-2 border-t border-ink/8 pt-3">
                {!totpEnabled && !totpSecret ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onBeginTotp}
                    className="rounded-full bg-teal-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {text(busy ? KAA.kutilipAtir : KAA.prepTotpStart)}
                  </button>
                ) : null}

                {!totpEnabled && totpSecret ? (
                  <form onSubmit={onConfirmTotp} className="space-y-2">
                    <p className="break-all rounded-lg bg-ink/[0.04] px-2.5 py-2 font-mono text-[11px] text-ink/80">
                      {totpSecret}
                    </p>
                    {totpUri ? (
                      <a
                        href={totpUri}
                        className="block text-[11px] font-medium text-teal-900 underline"
                      >
                        {text(KAA.prepTotpOpenApp)}
                      </a>
                    ) : null}
                    <label className="block">
                      <span className="text-[11px] font-medium text-ink/50">Authenticator</span>
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-full bg-teal-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {text(busy ? KAA.kutilipAtir : KAA.prepTotpConfirm)}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setTotpSecret('');
                          setTotpUri('');
                          setTotpCode('');
                        }}
                        className="rounded-full px-3 py-2 text-xs text-ink/50 hover:underline"
                      >
                        {text(KAA.biykarlaw)}
                      </button>
                    </div>
                  </form>
                ) : null}

                {totpEnabled ? (
                  <form onSubmit={onDisableTotp} className="space-y-2">
                    <label className="block">
                      <span className="text-[11px] font-medium text-ink/50">{text(KAA.prepTotpDisableHint)}</span>
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
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 disabled:opacity-50"
                    >
                      {text(busy ? KAA.kutilipAtir : KAA.prepTotpDisable)}
                    </button>
                  </form>
                ) : null}

                {err ? (
                  <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800" role="alert">
                    {text(err)}
                  </p>
                ) : null}
                {msg ? (
                  <p className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs text-teal-900" role="status">
                    {text(msg)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {r.id === 'phone' && isAuthenticated && phoneOn && !phoneVerified ? (
              <div className="mt-3 space-y-2 border-t border-ink/8 pt-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-ink/50">{text(KAA.telefon)}</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={fieldClass}
                    placeholder={text(KAA.prepPhoneHint)}
                  />
                </label>
                {!phoneSent ? (
                  <button
                    type="button"
                    disabled={busy || !phone.trim()}
                    onClick={onSendPhoneOtp}
                    className="rounded-full bg-teal-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {text(busy ? KAA.kutilipAtir : KAA.prepPhoneSend)}
                  </button>
                ) : (
                  <form onSubmit={onVerifyPhone} className="space-y-2">
                    {phoneDevCode ? (
                      <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-mono text-amber-950">
                        {text(KAA.prepPhoneDevCode)}: {phoneDevCode}
                      </p>
                    ) : null}
                    <label className="block">
                      <span className="text-[11px] font-medium text-ink/50">{text(KAA.prepPhoneCodeHint)}</span>
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-full bg-teal-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {text(busy ? KAA.kutilipAtir : KAA.prepPhoneConfirm)}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onSendPhoneOtp}
                        className="rounded-full px-3 py-2 text-xs text-ink/50 hover:underline"
                      >
                        {text(KAA.prepPhoneSend)}
                      </button>
                    </div>
                  </form>
                )}
                {err ? (
                  <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-800" role="alert">
                    {text(err)}
                  </p>
                ) : null}
                {msg ? (
                  <p className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs text-teal-900" role="status">
                    {text(msg)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.7rem] text-ink/40">{text(KAA.prepSmsCost)}</p>
    </section>
  );
}
