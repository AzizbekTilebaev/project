import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import ScriptPreview from '../components/admin/ScriptPreview';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  clearAdminToken,
  getAdminToken,
  fetchAdminMe,
  fetchAdminJumbaqlar,
  createAdminJumbaq,
  updateAdminJumbaq,
  deleteAdminJumbaq,
} from '../api/admin';
import AdminLoginForm from '../components/AdminLoginForm';

function emptyForm() {
  return { id: null, jumbaq: '', juwap: '', topar: 0, utopar: 0, status: 'published' };
}

export default function JumbaqlarAdmin() {
  const { text } = useUiScript();
  usePageMeta(text('Jumbaqlar admin'), text('Jumbaq qosıw, redaktorlaw hám óshiriw.'));

  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));

  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      await fetchAdminMe();
      const res = await fetchAdminJumbaqlar({ q, status: statusFilter, page, limit: 20 });
      setData(res);
    } catch (err) {
      setError(err.message || 'Júklew qátesi');
      if (!getAdminToken()) setAuthed(false);
    }
  }, [q, statusFilter, page]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const payload = {
        jumbaq: form.jumbaq.trim(),
        juwap: form.juwap.trim(),
        topar: Number(form.topar) || 0,
        utopar: Number(form.utopar) || 0,
        status: form.status,
      };
      if (form.id) {
        await updateAdminJumbaq(form.id, payload);
        setMsg(text('Jumbaq jańalandı'));
      } else {
        await createAdminJumbaq(payload);
        setMsg(text('Jumbaq qosıldı'));
      }
      setForm(null);
      await load();
    } catch (err) {
      setError(err.message || 'Saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(text(`#${item.id} jumbaq óshiriledi. Isenimlisiz be?`))) return;
    setBusy(true);
    setError('');
    try {
      await deleteAdminJumbaq(item.id);
      setMsg(text('Jumbaq óshirildi'));
      await load();
    } catch (err) {
      setError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="mx-auto max-w-md px-6 pt-8">
          <h1 className="mb-6 font-display text-3xl text-ink">{text('Jumbaqlar admin')}</h1>
          <AdminLoginForm onSuccess={() => setAuthed(true)} />
        </section>
      </DictShell>
    );
  }

  return (
    <DictShell className="pt-24 pb-24">
      <section className="mx-auto max-w-4xl px-6 pt-6">
        <div className="qp-section-head">
          <div>
            <h1 className="font-display text-3xl text-ink">{text('Jumbaqlar admin')}</h1>
            <Link to="/admin" className="text-sm text-teal-800 underline">{text('← Basqarıw paneli')}</Link>
          </div>
          <div className="flex gap-2">
            {!form && (
              <button
                onClick={() => { setForm(emptyForm()); setMsg(''); }}
                className="qp-btn-primary !px-5 !py-2.5 !text-sm"
              >
                {text('+ Jańa jumbaq')}
              </button>
            )}
            <button
              onClick={() => { clearAdminToken(); setAuthed(false); }}
              className="qp-btn-ghost !px-5 !py-2.5 !text-sm"
            >
              {text('Shıǵıw')}
            </button>
          </div>
        </div>

        {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{text(error)}</p>}
        {msg && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{text(msg)}</p>}

        {form ? (
          <form onSubmit={handleSubmit} className="space-y-4 qp-panel p-6">
            <h2 className="font-display text-xl text-ink">
              {text(form.id ? `Jumbaqtı redaktorlaw: #${form.id}` : 'Jańa jumbaq')}
            </h2>
            <label className="block text-sm">
              {text('Jumbaq teksti (latın)')}
              <textarea
                value={form.jumbaq}
                onChange={(e) => setForm((f) => ({ ...f, jumbaq: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                required
              />
            </label>
            <ScriptPreview value={form.jumbaq} label={text('Jumbaq — eki alifba')} multiline />
            <label className="block text-sm">
              {text('Juwap (latın)')}
              <input
                value={form.juwap}
                onChange={(e) => setForm((f) => ({ ...f, juwap: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                required
              />
            </label>
            <ScriptPreview value={form.juwap} label={text('Juwap — eki alifba')} />
            <p className="text-xs text-ink/50">{text('Kirill versiyası avtomat esaplanadı.')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">
                {text('Topar')}
                <input
                  type="number"
                  min="0"
                  value={form.topar}
                  onChange={(e) => setForm((f) => ({ ...f, topar: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                {text('Úlken topar')}
                <input
                  type="number"
                  min="0"
                  value={form.utopar}
                  onChange={(e) => setForm((f) => ({ ...f, utopar: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                {text('Status')}
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-2"
                >
                  <option value="published">{text('Járiyalanǵan')}</option>
                  <option value="draft">{text('Qaralama')}</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="qp-btn-primary !px-6 !py-2.5 !text-sm disabled:opacity-50">
                {text(busy ? 'Saqlanıp atır…' : 'Saqlaw')}
              </button>
              <button type="button" onClick={() => setForm(null)} className="rounded-full border border-ink/15 px-6 py-2.5 text-sm">
                {text('Biykarlaw')}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder={text('Izlew…')}
                className="flex-1 min-w-48 rounded-2xl border border-ink/10 bg-white/70 px-4 py-2 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="rounded-2xl border border-ink/10 bg-white/70 px-3 py-2 text-sm"
              >
                <option value="">{text('Barlıq status')}</option>
                <option value="published">{text('Járiyalanǵan')}</option>
                <option value="draft">{text('Qaralama')}</option>
              </select>
            </div>
            <p className="mb-3 text-xs text-ink/50">
              {text('Jámi')}: {data.total} · {text('Bet')} {data.page}/{data.pages}
            </p>
            <div className="space-y-2">
              {data.items.map((item) => (
                <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 qp-card qp-card--static p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{item.jumbaqLatin}</p>
                    <p className="mt-1 text-xs text-ink/55">
                      {text('Juwap')}: <span className="font-semibold text-teal-900">{item.juwapLatin}</span>
                      {' · '}#{item.id} · {text('topar')} {item.topar}
                      {item.status !== 'published' && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{text('Qaralama')}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setForm({ id: item.id, jumbaq: item.jumbaqLatin, juwap: item.juwapLatin, topar: item.topar, utopar: item.utopar, status: item.status }); setMsg(''); }}
                      disabled={busy}
                      className="rounded-full border border-teal-800 px-4 py-1.5 text-xs font-semibold text-teal-800"
                    >
                      {text('Redaktorlaw')}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={busy}
                      className="rounded-full border border-rose-300 px-4 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      {text('Óshiriw')}
                    </button>
                  </div>
                </article>
              ))}
              {!data.items.length && (
                <p className="rounded-2xl bg-white/60 p-8 text-center text-sm text-ink/50">{text('Jumbaqlar tabılmadı.')}</p>
              )}
            </div>
            {data.pages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-sm disabled:opacity-30"
                >
                  ←
                </button>
                <span className="text-sm text-ink/60">{data.page} / {data.pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  disabled={page >= data.pages}
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-sm disabled:opacity-30"
                >
                  →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </DictShell>
  );
}
