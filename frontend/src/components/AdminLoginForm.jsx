import { useState } from 'react';
import { useUiScript } from '../contexts/UiScriptContext';
import { adminLogin } from '../api/admin';

/**
 * Barcha admin panellar uchun bir xil email + qupıya sóz kiriw.
 * Email bo‘sh bo‘lsa — legacy owner (faqat development).
 */
export default function AdminLoginForm({
  title,
  subtitle = 'Email + qupıya sóz menen kiriń. Productionda legacy tek parol óshirip qoyılǵan.',
  onSuccess,
  className = '',
}) {
  const { text } = useUiScript();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminLogin({ email: email.trim(), password });
      setPassword('');
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Kiriw múmkin bolmadı');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className={`space-y-4 rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm ${className}`}
    >
      {title ? <h2 className="font-display text-xl text-ink">{text(title)}</h2> : null}
      {subtitle ? <p className="text-sm text-ink/55">{text(subtitle)}</p> : null}
      <label className="block text-sm font-medium text-ink/70">
        {text('Email')}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          placeholder={text('Akkaunt email (legacy ushın bos qaldırıw múmkin)')}
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal-700"
        />
      </label>
      <label className="block text-sm font-medium text-ink/70">
        {text('Qupıya sóz')}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          minLength={8}
          className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 outline-none focus:border-teal-700"
        />
      </label>
      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {text(error)}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-teal-900 px-5 py-3 font-semibold text-white disabled:opacity-50"
      >
        {text(busy ? 'Tekserilip atır…' : 'Kiriw')}
      </button>
    </form>
  );
}
