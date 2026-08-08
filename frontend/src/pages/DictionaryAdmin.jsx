import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import PageGate from '../components/PageGate';
import AdminLoginForm from '../components/AdminLoginForm';
import { useUiScript } from '../contexts/UiScriptContext';
import { searchWords } from '../api/tusindirme';
import {
  clearAdminToken,
  createDictionaryTitle,
  deactivateDictionaryTitle,
  fetchAdminMe,
  getAdminToken,
  reactivateDictionaryTitle,
  renameDictionaryTitle,
} from '../api/admin';

function Login({ onSuccess }) {
  const { text } = useUiScript();
  return (
    <DictShell className="pt-24 pb-24">
      <section className="mx-auto max-w-md px-6 pt-10">
        <div className="mb-7 text-center">
          <h1 className="font-display text-4xl text-ink">{text('Sózlik admin')}</h1>
          <p className="mt-2 text-sm text-ink/55">{text('Moderator yamasa yuqorı rol kerek.')}</p>
        </div>
        <AdminLoginForm subtitle="" onSuccess={onSuccess} />
      </section>
    </DictShell>
  );
}

export default function DictionaryAdmin() {
  const { text } = useUiScript();
  usePageMeta(text('Sózlik admin'), text('Sóz izlew, qosıw, atın ózgertiw, jasıriw.'));

  const [authenticated, setAuthenticated] = useState(() => Boolean(getAdminToken()));
  const [me, setMe] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);

  const [newWord, setNewWord] = useState({ word: '', description: '', category: '' });
  const [created, setCreated] = useState(null);

  const [renameId, setRenameId] = useState('');
  const [renameWord, setRenameWord] = useState('');
  const [reactivateId, setReactivateId] = useState('');
  const [flash, setFlash] = useState('');

  const canModerate = Boolean(me?.permissions?.includes('moderate_community'));

  const bootstrap = useCallback(async () => {
    try {
      const profile = await fetchAdminMe();
      setMe(profile);
      setAuthenticated(true);
      setError('');
    } catch (err) {
      clearAdminToken();
      setAuthenticated(false);
      setMe(null);
      setError(err.message || 'Admin sessiyası yaramas');
    }
  }, []);

  useEffect(() => {
    if (authenticated) bootstrap();
  }, [authenticated, bootstrap]);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setHits([]);
      return undefined;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchWords(q, 20);
        if (!cancelled) setHits(Array.isArray(res.data) ? res.data : []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [searchQ]);

  async function submitNew(e) {
    e?.preventDefault?.();
    const word = String(newWord.word || '').trim();
    const description = String(newWord.description || '').trim();
    if (!word || !description) {
      setError('Sóz hám anıqlama kerek');
      return;
    }
    setBusy(true);
    setError('');
    setCreated(null);
    try {
      const res = await createDictionaryTitle({
        word,
        description,
        category: String(newWord.category || '').trim() || null,
      });
      setCreated({ id: res.id, word: res.word || word });
      setNewWord({ word: '', description: '', category: '' });
      setFlash('Sóz jaratıldı');
    } catch (err) {
      setError(err.message || 'Sóz jaratıw qátesi');
      const existingId = err.payload?.titleId;
      if (existingId) {
        setCreated({
          id: existingId,
          word: err.payload?.word || word,
          existing: true,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitRename(e) {
    e?.preventDefault?.();
    const id = String(renameId || '').trim();
    const word = String(renameWord || '').trim();
    if (!id || !word) {
      setError('Title id hám jańa sóz kerek');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await renameDictionaryTitle(id, { word });
      setFlash(`Atı ózgertildi: ${word}`);
      setRenameWord('');
    } catch (err) {
      setError(err.message || 'Atın ózgertiw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate(id, word) {
    if (!id) return;
    if (!window.confirm(`${word || id} — jasıraladı (status=0). Dawam?`)) return;
    setBusy(true);
    setError('');
    try {
      await deactivateDictionaryTitle(id);
      setFlash('Jasıırıldı');
      setHits((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      setError(err.message || 'Jasıriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function submitReactivate(e) {
    e?.preventDefault?.();
    const id = String(reactivateId || '').trim();
    if (!id) {
      setError('Title id kerek');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await reactivateDictionaryTitle(id);
      setFlash(`Aktivlestirildi: ${res.word || id}`);
      setReactivateId('');
    } catch (err) {
      setError(err.message || 'Aktivlestiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearAdminToken();
    setAuthenticated(false);
    setMe(null);
  }

  if (!authenticated) {
    return (
      <PageGate>
        <Login onSuccess={() => setAuthenticated(true)} />
      </PageGate>
    );
  }

  if (me && !canModerate) {
    return (
      <PageGate>
        <DictShell className="pt-24 pb-24">
          <section className="mx-auto max-w-lg px-6 pt-10 text-center">
            <h1 className="font-display text-3xl text-ink">{text('Ruxsat joq')}</h1>
            <p className="mt-2 text-sm text-ink/55">
              {text('Sózlik CRUD ushın moderator yamasa editor roli kerek.')}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/admin" className="qp-btn-primary !px-5 !py-2.5 !text-sm">
                {text('Admin panel')}
              </Link>
              <button type="button" onClick={logout} className="rounded-xl border px-4 py-2 text-sm">
                {text('Shıǵıw')}
              </button>
            </div>
          </section>
        </DictShell>
      </PageGate>
    );
  }

  return (
    <PageGate>
      <DictShell className="pt-24 pb-24">
        <section className="mx-auto max-w-3xl px-6 pt-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/55">
                Admin
              </p>
              <h1 className="font-display text-4xl text-ink">{text('Sózlik')}</h1>
              <p className="mt-1 text-sm text-ink/50">
                {text('Izlew · jańa sóz · atın ózgertiw · jasıriw / qaytarıw')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin" className="rounded-xl border border-ink/15 bg-white px-4 py-2 text-sm font-semibold">
                {text('← Panel')}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl bg-teal-900 px-4 py-2 text-sm font-semibold text-white"
              >
                {text('Shıǵıw')}
              </button>
            </div>
          </header>

          {error ? (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{text(error)}</p>
          ) : null}
          {flash ? (
            <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{text(flash)}</p>
          ) : null}

          <div className="mt-8 qp-panel p-5">
            <h2 className="font-display text-xl text-ink">{text('Sóz izlew')}</h2>
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={text('Keminde 2 belgi…')}
              className="mt-3 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm"
            />
            {searching ? <p className="mt-2 text-xs text-ink/40">{text('Izlenip atır…')}</p> : null}
            <ul className="mt-3 divide-y divide-ink/8">
              {hits.map((hit) => (
                <li key={hit.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link
                      to={`/dictionary/${encodeURIComponent(hit.id)}`}
                      className="font-semibold text-teal-950 hover:underline"
                    >
                      {text(hit.soz)}
                    </Link>
                    {hit.birinshi_aniqlama ? (
                      <p className="truncate text-xs text-ink/45">
                        {text(String(hit.birinshi_aniqlama).slice(0, 100))}
                      </p>
                    ) : null}
                    <p className="font-mono text-[0.65rem] text-ink/35">{hit.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-semibold"
                      onClick={() => {
                        setRenameId(hit.id);
                        setRenameWord(hit.soz || '');
                      }}
                    >
                      {text('Atın ózgertiw')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800"
                      onClick={() => onDeactivate(hit.id, hit.soz)}
                    >
                      {text('Jasıriw')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 qp-panel p-5">
            <h2 className="font-display text-xl text-ink">{text('Jańa sóz qosıw')}</h2>
            <p className="mt-1 text-xs text-ink/50">
              {text('Public sózlikke status=1 menen shıǵadı. Birinshi anıqlama májburiy.')}
            </p>
            <form onSubmit={submitNew} className="mx-auto mt-4 max-w-xl space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                  {text('Sóz')}
                </span>
                <input
                  type="text"
                  value={newWord.word}
                  onChange={(e) => setNewWord((p) => ({ ...p, word: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm"
                  maxLength={255}
                  disabled={busy}
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                  {text('Anıqlama')}
                </span>
                <textarea
                  rows={4}
                  value={newWord.description}
                  onChange={(e) => setNewWord((p) => ({ ...p, description: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm"
                  disabled={busy}
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                  {text('Kategoriya (ixtiyarıy)')}
                </span>
                <input
                  type="text"
                  value={newWord.category}
                  onChange={(e) => setNewWord((p) => ({ ...p, category: e.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm"
                  maxLength={64}
                  disabled={busy}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !newWord.word.trim() || !newWord.description.trim()}
                className="qp-btn-primary !px-6 !py-2.5 !text-sm disabled:opacity-50"
              >
                {text('Jaratıw')}
              </button>
            </form>
            {created?.id ? (
              <p className="mt-4 text-sm text-emerald-900">
                {text(created.existing ? 'Aldınnan bar' : 'Jaratıldı')}:{' '}
                <Link
                  to={`/dictionary/${encodeURIComponent(created.id)}`}
                  className="font-semibold underline"
                >
                  {created.word || created.id}
                </Link>
              </p>
            ) : null}
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="qp-panel p-5">
              <h2 className="font-display text-lg text-ink">{text('Atın ózgertiw')}</h2>
              <form onSubmit={submitRename} className="mt-3 space-y-3">
                <input
                  value={renameId}
                  onChange={(e) => setRenameId(e.target.value)}
                  placeholder="title id"
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 font-mono text-xs"
                  disabled={busy}
                />
                <input
                  value={renameWord}
                  onChange={(e) => setRenameWord(e.target.value)}
                  placeholder={text('Jańa sóz')}
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !renameId.trim() || !renameWord.trim()}
                  className="qp-btn-primary !px-5 !py-2 !text-sm disabled:opacity-50"
                >
                  {text('Saqlaw')}
                </button>
              </form>
            </div>
            <div className="qp-panel p-5">
              <h2 className="font-display text-lg text-ink">{text('Jasıırılǵan sózdi qaytarıw')}</h2>
              <form onSubmit={submitReactivate} className="mt-3 space-y-3">
                <input
                  value={reactivateId}
                  onChange={(e) => setReactivateId(e.target.value)}
                  placeholder="title id"
                  className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 font-mono text-xs"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !reactivateId.trim()}
                  className="qp-btn-primary !px-5 !py-2 !text-sm disabled:opacity-50"
                >
                  {text('Aktivlestiriw')}
                </button>
              </form>
            </div>
          </div>
        </section>
      </DictShell>
    </PageGate>
  );
}
