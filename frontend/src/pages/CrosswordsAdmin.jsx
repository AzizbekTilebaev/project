import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import EditableCrossword from '../components/EditableCrossword';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  adminCreateCrossword,
  adminDeleteCrossword,
  adminGetCrossword,
  adminListCrosswords,
  adminUpdateCrossword,
  clearAdminToken,
  getAdminToken,
} from '../api/crosswords';
import AdminLoginForm from '../components/AdminLoginForm';

const DIFFICULTIES = ['Ápiwayı', 'Orta', 'Qıyın'];

function emptyMeta() {
  return {
    customId: '',
    title: '',
    description: '',
    difficulty: 'Ápiwayı',
    isPublished: true,
    sortOrder: 0,
    completionCount: 0,
  };
}

function buildConfig(words) {
  if (!words.length) {
    return { CrosswordWidth: 15, CrosswordHeight: 14, WordsData: [] };
  }
  const width = Math.max(
    ...words.map((w) => (w.direction === 'across' ? w.x + String(w.answer || '').length : w.x + 1)),
    5
  );
  const height = Math.max(
    ...words.map((w) => (w.direction === 'down' ? w.y + String(w.answer || '').length : w.y + 1)),
    5
  );
  return {
    CrosswordWidth: width,
    CrosswordHeight: height,
    WordsData: words,
  };
}

export default function CrosswordsAdmin() {
  const { text } = useUiScript();
  usePageMeta(text('Krossvord admin'), text('Krossvord qosıw hám redaktorlaw.'));

  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [items, setItems] = useState([]);
  const [listMeta, setListMeta] = useState({ total: 0, pages: 1, page: 1 });
  const [listQ, setListQ] = useState('');
  const [listDifficulty, setListDifficulty] = useState('');
  const [listPublished, setListPublished] = useState('');
  const [filter, setFilter] = useState({
    q: '',
    difficulty: '',
    published: '',
    page: 1,
  });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [meta, setMeta] = useState(emptyMeta());
  const [words, setWords] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await adminListCrosswords({
        q: filter.q,
        difficulty: filter.difficulty,
        published: filter.published,
        page: filter.page,
        limit: 40,
      });
      setItems(res.crosswords || res.items || []);
      setListMeta({
        total: res.total || 0,
        pages: res.pages || 1,
        page: res.page || 1,
      });
    } catch (err) {
      setError(err.message || text('Júklew qáteligi'));
      if (!getAdminToken()) setAuthed(false);
    }
  }, [filter, text]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  function handleLogout() {
    clearAdminToken();
    setAuthed(false);
    setItems([]);
    setShowBuilder(false);
  }

  function startCreate() {
    setEditingId(null);
    setMeta(emptyMeta());
    setWords([]);
    setShowBuilder(true);
    setShowManual(false);
    setMsg('');
    setError('');
  }

  async function startEdit(id) {
    setBusy(true);
    setError('');
    try {
      const res = await adminGetCrossword(id);
      const cw = res.crossword;
      setEditingId(cw.id);
      setMeta({
        customId: '',
        title: cw.title || '',
        description: cw.description || '',
        difficulty: cw.difficulty || 'Ápiwayı',
        isPublished: cw.isPublished !== false,
        sortOrder: cw.sortOrder ?? 0,
        completionCount: cw.completionCount || 0,
      });
      setWords(
        (cw.words || []).map((w) => ({
          answer: String(w.answer || '').toUpperCase(),
          clue: w.clue || '',
          x: Number(w.x) || 0,
          y: Number(w.y) || 0,
          direction: w.direction === 'down' ? 'down' : 'across',
        }))
      );
      setShowBuilder(true);
      setShowManual(false);
      setMsg('');
    } catch (err) {
      setError(err.message || text('Ashıw qáteligi'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    const wordsLocked = Boolean(editingId && meta.completionCount > 0);
    if (!wordsLocked) {
      if (!words.length) {
        setError(text('Keminde bir sóz kerek'));
        return;
      }
      if (words.some((w) => !String(w.answer || '').trim() || !String(w.clue || '').trim())) {
        setError(text('Hár sózde juwap hám kórsetpe kerek'));
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const payload = {
        title: meta.title,
        description: meta.description,
        difficulty: meta.difficulty,
        isPublished: meta.isPublished,
        sortOrder: Number(meta.sortOrder) || 0,
      };
      if (!wordsLocked) {
        payload.words = words;
        payload.config = buildConfig(words);
      }
      if (editingId) {
        await adminUpdateCrossword(editingId, payload);
        setMsg(text('Jańalandı'));
      } else {
        if (meta.customId.trim()) payload.id = meta.customId.trim().toLowerCase();
        await adminCreateCrossword(payload);
        setMsg(text('Qosıldı'));
      }
      setShowBuilder(false);
      await load();
    } catch (err) {
      setError(err.message || text('Saqlaw qáteligi'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cw) {
    const warning =
      cw.completionCount > 0
        ? `"${cw.title}" krossvordında ${cw.completionCount} tamamlanıw bar — hámmesi óshiriledi. Isenimlińiz be?`
        : `"${cw.title}" óshiriledi. Isenimlińiz be?`;
    if (!window.confirm(text(warning))) return;
    setBusy(true);
    try {
      await adminDeleteCrossword(cw.id);
      setMsg(text('Óshirildi'));
      await load();
    } catch (err) {
      setError(err.message || text('Óshiriw qáteligi'));
    } finally {
      setBusy(false);
    }
  }

  function addWordRow() {
    setWords((prev) => [...prev, { answer: '', clue: '', x: 0, y: 0, direction: 'across' }]);
  }

  function applyListFilter() {
    setFilter({
      q: listQ.trim(),
      difficulty: listDifficulty,
      published: listPublished,
      page: 1,
    });
  }

  if (!authed) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="mx-auto max-w-md px-6 pt-8">
          <h1 className="mb-6 font-display text-3xl text-ink">{text('Krossvord admin')}</h1>
          <AdminLoginForm onSuccess={() => setAuthed(true)} />
        </section>
      </DictShell>
    );
  }

  const wordsLocked = Boolean(editingId && meta.completionCount > 0);

  return (
    <DictShell className="pt-24 pb-24">
      <section className="mx-auto max-w-5xl px-6 pt-8 md:px-10">
        <div className="qp-section-head">
          <div>
            <p className="text-xs uppercase tracking-widest text-teal-800/60">{text('Admin')}</p>
            <h1 className="font-display text-4xl text-ink">{text('Krossvordlar')}</h1>
            <Link to="/admin" className="text-sm text-teal-800 underline">
              {text('← Basqarıw paneli')}
            </Link>
          </div>
          <div className="flex gap-2">
            {!showBuilder && (
              <button
                type="button"
                onClick={startCreate}
                className="qp-btn-primary !px-5 !py-2.5 !text-sm"
              >
                {text('Jańa krossvord')}
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="qp-btn-ghost !px-5 !py-2.5 !text-sm"
            >
              {text('Shıǵıw')}
            </button>
          </div>
        </div>

        {msg && <p className="mb-4 text-sm text-emerald-700">{text(msg)}</p>}
        {error && <p className="mb-4 text-sm text-rose-700">{text(error)}</p>}

        {showBuilder ? (
          <form
            onSubmit={handleSave}
            className="mb-10 qp-panel p-6 shadow-sm"
          >
            <h2 className="mb-4 font-display text-2xl text-ink">
              {text(editingId ? `Redaktorlaw: ${editingId}` : 'Jańa krossvord')}
            </h2>
            {wordsLocked ? (
              <p className="mb-4 rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-900">
                {text(
                  'Tamamlanıwlar bar — sózlerdi ózgertip bolmaydı. Meta, nashr hám tártip saqlanadı.'
                )}
              </p>
            ) : null}
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              {!editingId ? (
                <label className="block text-sm sm:col-span-2">
                  <span className="text-ink/60">{text('ID (ixtıyarıy)')}</span>
                  <input
                    value={meta.customId}
                    onChange={(e) =>
                      setMeta((m) => ({
                        ...m,
                        customId: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      }))
                    }
                    placeholder="mısalı: animals-1"
                    maxLength={32}
                    className="mt-1 w-full rounded-2xl border border-ink/10 px-4 py-2.5 font-mono text-sm"
                  />
                </label>
              ) : null}
              <label className="block text-sm sm:col-span-2">
                <span className="text-ink/60">{text('At')}</span>
                <input
                  required
                  value={meta.title}
                  onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-ink/10 px-4 py-2.5"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="text-ink/60">{text('Sıpatlama')}</span>
                <textarea
                  value={meta.description}
                  onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-2xl border border-ink/10 px-4 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink/60">{text('Qıyınlıq')}</span>
                <select
                  value={meta.difficulty}
                  onChange={(e) => setMeta((m) => ({ ...m, difficulty: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-ink/10 px-4 py-2.5"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {text(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-ink/60">{text('Tártip')}</span>
                <input
                  type="number"
                  min="0"
                  value={meta.sortOrder}
                  onChange={(e) => setMeta((m) => ({ ...m, sortOrder: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-ink/10 px-4 py-2.5"
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={meta.isPublished}
                  onChange={(e) => setMeta((m) => ({ ...m, isPublished: e.target.checked }))}
                />
                {text('Nashr etilgen')}
              </label>
            </div>

            {!wordsLocked ? (
              <>
                <div className="mb-4 qp-card qp-card--static p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    {text('Vizual redaktor')} · {words.length} {text('sóz')}
                  </p>
                  <EditableCrossword words={words} onChange={setWords} compact />
                </div>

                <details
                  className="mb-6"
                  open={showManual}
                  onToggle={(e) => setShowManual(e.target.open)}
                >
                  <summary className="cursor-pointer text-sm font-medium text-teal-900">
                    {text('Qol menen qatorlar (ixtıyarıy)')}
                  </summary>
                  <div className="mt-3">
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={addWordRow}
                        className="text-sm text-teal-800 underline underline-offset-4"
                      >
                        {text('+ Qator')}
                      </button>
                    </div>
                    <ul className="max-h-64 space-y-3 overflow-y-auto">
                      {words.map((w, i) => (
                        <li
                          key={i}
                          className="grid gap-2 qp-card qp-card--static p-3 sm:grid-cols-6"
                        >
                          <input
                            placeholder={text('Juwap')}
                            value={w.answer}
                            onChange={(e) => {
                              const next = [...words];
                              next[i] = { ...w, answer: e.target.value.toUpperCase() };
                              setWords(next);
                            }}
                            className="rounded-xl border border-ink/10 px-3 py-2 text-sm uppercase sm:col-span-1"
                          />
                          <input
                            placeholder={text('Soraw')}
                            value={w.clue}
                            onChange={(e) => {
                              const next = [...words];
                              next[i] = { ...w, clue: e.target.value };
                              setWords(next);
                            }}
                            className="rounded-xl border border-ink/10 px-3 py-2 text-sm sm:col-span-2"
                          />
                          <input
                            type="number"
                            placeholder="X"
                            aria-label={text('X koordinatı')}
                            value={w.x}
                            onChange={(e) => {
                              const next = [...words];
                              next[i] = { ...w, x: Number(e.target.value) };
                              setWords(next);
                            }}
                            className="rounded-xl border border-ink/10 px-3 py-2 text-sm"
                          />
                          <input
                            type="number"
                            placeholder="Y"
                            aria-label={text('Y koordinatı')}
                            value={w.y}
                            onChange={(e) => {
                              const next = [...words];
                              next[i] = { ...w, y: Number(e.target.value) };
                              setWords(next);
                            }}
                            className="rounded-xl border border-ink/10 px-3 py-2 text-sm"
                          />
                          <select
                            value={w.direction}
                            onChange={(e) => {
                              const next = [...words];
                              next[i] = { ...w, direction: e.target.value };
                              setWords(next);
                            }}
                            className="rounded-xl border border-ink/10 px-3 py-2 text-sm"
                            aria-label={text('Baǵıt')}
                          >
                            <option value="across">{text('Gorizontal')}</option>
                            <option value="down">{text('Vertikal')}</option>
                          </select>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              </>
            ) : (
              <p className="mb-6 text-sm text-ink/55">
                {words.length} {text('sóz')} · {meta.completionCount} {text('tamamlanıw')}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy || (!wordsLocked && !words.length)}
                className="qp-btn-primary !px-6 !py-2.5 !text-sm disabled:opacity-50"
              >
                {text(busy ? 'Saqlanıp atır…' : 'Saqlaw')}
              </button>
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="rounded-full border border-ink/15 px-6 py-2.5 text-sm text-ink/70"
              >
                {text('Biykarlaw')}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-2 qp-card qp-card--static p-3">
              <label className="min-w-[10rem] flex-1 text-xs text-ink/55">
                {text('Izlew')}
                <input
                  value={listQ}
                  onChange={(e) => setListQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      applyListFilter();
                    }
                  }}
                  placeholder={text('Atı / id…')}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-ink/55">
                {text('Qıyınlıq')}
                <select
                  value={listDifficulty}
                  onChange={(e) => setListDifficulty(e.target.value)}
                  className="mt-1 block rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                >
                  <option value="">{text('Barlıǵı')}</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {text(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-ink/55">
                {text('Nashr')}
                <select
                  value={listPublished}
                  onChange={(e) => setListPublished(e.target.value)}
                  className="mt-1 block rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                >
                  <option value="">{text('Barlıǵı')}</option>
                  <option value="1">{text('Nashr')}</option>
                  <option value="0">{text('Qaralama')}</option>
                </select>
              </label>
              <button
                type="button"
                onClick={applyListFilter}
                className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold"
              >
                {text('Süzew')}
              </button>
            </div>

            <ul className="space-y-3">
              {items.map((cw) => (
                <li
                  key={cw.id}
                  className="flex flex-wrap items-center justify-between gap-3 qp-card qp-card--static px-5 py-4"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {text(cw.title)}
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${
                          cw.isPublished
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-ink/10 text-ink/55'
                        }`}
                      >
                        {text(cw.isPublished ? 'Nashr' : 'Qaralama')}
                      </span>
                    </p>
                    <p className="text-xs text-ink/45">
                      #{cw.sortOrder ?? 0} · {text(cw.difficulty)} · id {cw.id} ·{' '}
                      {cw.wordCount ?? 0} {text('sóz')} · {cw.completionCount ?? 0}{' '}
                      {text('tamamlanıw')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(cw.id)}
                      className="qp-chip text-teal-900 disabled:opacity-50"
                    >
                      {text('Redaktor')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(cw)}
                      className="rounded-full bg-rose-50 px-4 py-1.5 text-sm text-rose-700 disabled:opacity-50"
                    >
                      {text('Óshiriw')}
                    </button>
                  </div>
                </li>
              ))}
              {!items.length && (
                <li className="rounded-2xl bg-white/60 p-8 text-center text-sm text-ink/50">
                  {text('Krossvordlar joq. Birinshisin qosıń.')}
                </li>
              )}
            </ul>

            {listMeta.pages > 1 ? (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={listMeta.page <= 1}
                  onClick={() =>
                    setFilter((f) => ({ ...f, page: Math.max(1, listMeta.page - 1) }))
                  }
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  ←
                </button>
                <span className="text-xs text-ink/55">
                  {listMeta.page} / {listMeta.pages} · {listMeta.total}
                </span>
                <button
                  type="button"
                  disabled={listMeta.page >= listMeta.pages}
                  onClick={() => setFilter((f) => ({ ...f, page: listMeta.page + 1 }))}
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                >
                  →
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </DictShell>
  );
}
