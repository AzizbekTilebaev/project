import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import PageGate from '../components/PageGate';
import usePageData from '../hooks/usePageData';
import Icon from '../components/Icon';
import AdminLoginForm from '../components/AdminLoginForm';
import { useUiScript } from '../contexts/UiScriptContext';
import { searchWords } from '../api/tusindirme';
import {
  adminDeleteImmersion,
  adminListImmersion,
  adminReattachImmersion,
  adminUploadImmersion,
  clearAdminToken,
  getAdminToken,
} from '../api/immersion';

const ROLES = [
  { value: 'primary', label: 'Primary' },
  { value: 'alt', label: 'Alt' },
  { value: 'subtitle', label: 'Subtitle' },
];

function WordPicker({ value, onPick, text }) {
  const [searchQ, setSearchQ] = useState('');
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (value) return undefined;
    const q = searchQ.trim();
    if (q.length < 2) {
      setHits([]);
      return undefined;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchWords(q, 8);
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
  }, [searchQ, value]);

  if (value) {
    return (
      <div>
        <p className="rounded-2xl border border-teal-200 bg-teal-50/80 px-4 py-2.5 text-sm">
          <span className="font-semibold text-ink">{text(value.soz)}</span>
          <span className="ml-2 font-mono text-[0.65rem] text-ink/40">{value.id}</span>
        </p>
        <button
          type="button"
          className="mt-1 text-xs text-teal-900 underline"
          onClick={() => {
            onPick(null);
            setSearchQ('');
          }}
        >
          {text('Basqa sóz saylaw')}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        value={searchQ}
        onChange={(e) => setSearchQ(e.target.value)}
        placeholder={text('Sózdi izleń…')}
        className="w-full rounded-2xl border border-ink/10 px-4 py-2.5"
      />
      {searching ? <p className="mt-1 text-xs text-ink/40">{text('Izlenip atır…')}</p> : null}
      {hits.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto qp-surface shadow-lg">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                className="block w-full px-4 py-2.5 text-left hover:bg-teal-50"
                onClick={() => {
                  onPick(hit);
                  setHits([]);
                  setSearchQ('');
                }}
              >
                <span className="font-semibold text-ink">{text(hit.soz)}</span>
                {hit.birinshi_aniqlama ? (
                  <span className="mt-0.5 block truncate text-xs text-ink/45">
                    {text(String(hit.birinshi_aniqlama).slice(0, 80))}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function AssetReattachRow({ asset, text, onDone, onCancel }) {
  const [picked, setPicked] = useState(
    asset.soz && asset.titleId && !asset.isOrphan
      ? { id: asset.titleId, soz: asset.soz }
      : null
  );
  const [manualId, setManualId] = useState(false);
  const [titleId, setTitleId] = useState(asset.isOrphan ? '' : asset.titleId || '');
  const [role, setRole] = useState(asset.role || 'primary');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const resolvedTitleId = manualId ? titleId.trim() : picked?.id || '';

  async function onSave(e) {
    e.preventDefault();
    if (!resolvedTitleId) {
      setErr(text('Sóz saylań'));
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await adminReattachImmersion(asset.id, {
        titleId: resolvedTitleId,
        role,
      });
      onDone();
    } catch (ex) {
      setErr(ex.message || text('Saqlaw ámelge aspadı'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="qp-card qp-card--static border-teal-300/40 bg-teal-50/40 px-4 py-3">
      <form onSubmit={onSave} className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
          {text('Sózge baylanıstırıw')} · #{asset.id}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setManualId((v) => !v);
              setErr('');
            }}
            className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-teal-900"
          >
            {text(manualId ? 'Izlew rejimi' : 'Qol menen ID')}
          </button>
        </div>
        {manualId ? (
          <input
            value={titleId}
            onChange={(e) => setTitleId(e.target.value)}
            placeholder={text('title_id')}
            className="w-full rounded-2xl border border-ink/10 px-4 py-2.5 font-mono text-sm"
            required
          />
        ) : (
          <WordPicker value={picked} onPick={setPicked} text={text} />
        )}
        <label className="block text-sm text-ink/60">
          {text('Rol')}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="ml-2 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        {err ? <p className="text-sm text-rose-700">{text(err)}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy || !resolvedTitleId}
            className="qp-btn-primary !px-4 !py-2 !text-sm disabled:opacity-50"
          >
            {text(busy ? '…' : 'Saqlaw')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="qp-btn-ghost !px-4 !py-2 !text-sm"
          >
            {text('Biykar')}
          </button>
        </div>
      </form>
    </li>
  );
}

export default function ImmersionAdmin() {
  const { text } = useUiScript();
  usePageMeta(text('Immersion admin'), text('3D / video / audio assetler'));
  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [picked, setPicked] = useState(null);
  const [manualId, setManualId] = useState(false);
  const [titleId, setTitleId] = useState('');
  const [role, setRole] = useState('primary');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [listQ, setListQ] = useState('');
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [listFilter, setListFilter] = useState({ q: '', orphansOnly: false });
  const [editingId, setEditingId] = useState(null);

  const { status, data, error, reload } = usePageData(
    async () => {
      const res = await adminListImmersion({
        q: listFilter.q,
        orphansOnly: listFilter.orphansOnly,
      });
      return { assets: res.assets || [] };
    },
    { deps: [authed, listFilter.q, listFilter.orphansOnly], enabled: authed }
  );

  const resolvedTitleId = manualId ? titleId.trim() : picked?.id || '';

  async function onUpload(e) {
    e.preventDefault();
    if (!file || !resolvedTitleId) return;
    setBusy(true);
    setMsg('');
    try {
      await adminUploadImmersion({
        titleId: resolvedTitleId,
        role,
        file,
      });
      setFile(null);
      setMsg('Júklendi');
      reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  const applyListFilter = useCallback(() => {
    setListFilter({ q: listQ.trim(), orphansOnly });
  }, [listQ, orphansOnly]);

  if (!authed) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-md px-6 pt-10">
          <h1 className="mb-6 font-display text-3xl">{text('Immersion admin')}</h1>
          <AdminLoginForm onSuccess={() => setAuthed(true)} />
        </section>
      </DictShell>
    );
  }

  return (
    <PageGate status={status} error={error} onRetry={reload}>
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-3xl px-6 pt-8">
          <div className="qp-section-head !mb-4">
            <div>
              <h1 className="font-display text-3xl mb-2">{text('Immersion assetler')}</h1>
              <p className="mb-2 text-xs text-ink/45">
                {text('Sózdi izleń → fayl júkleń. Video/audio/3D (glb/gltf).')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearAdminToken();
                setAuthed(false);
              }}
              className="qp-btn-ghost !px-4 !py-2 !text-sm"
            >
              {text('Shıǵıw')}
            </button>
          </div>

          <form onSubmit={onUpload} className="mb-8 space-y-3 qp-panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                {text('Sóz')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setManualId((v) => !v);
                  setMsg('');
                }}
                className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-teal-900"
              >
                {text(manualId ? 'Izlew rejimi' : 'Qol menen ID')}
              </button>
            </div>

            {manualId ? (
              <input
                value={titleId}
                onChange={(e) => setTitleId(e.target.value)}
                placeholder={text('title_id')}
                className="w-full rounded-2xl border border-ink/10 px-4 py-2.5 font-mono text-sm"
                required
              />
            ) : (
              <WordPicker value={picked} onPick={setPicked} text={text} />
            )}

            <div className="flex flex-wrap gap-3">
              <label className="text-sm text-ink/60">
                {text('Rol')}
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="ml-2 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm text-ink"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            {msg && <p className="text-sm text-teal-800">{text(msg)}</p>}
            <button
              type="submit"
              disabled={busy || !resolvedTitleId || !file}
              className="qp-btn-primary !px-5 !py-2.5 !text-sm disabled:opacity-50"
            >
              {text(busy ? '…' : 'Júklew')}
            </button>
          </form>

          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1">
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-ink/45">
                {text('Tizimde izlew')}
              </span>
              <input
                type="search"
                value={listQ}
                onChange={(e) => setListQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyListFilter();
                  }
                }}
                placeholder={text('Sóz yamasa title id…')}
                className="mt-1 w-full rounded-full border border-ink/15 bg-white px-3 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-ink/60">
              <input
                type="checkbox"
                checked={orphansOnly}
                onChange={(e) => setOrphansOnly(e.target.checked)}
              />
              {text('Tek orphan')}
            </label>
            <button
              type="button"
              onClick={applyListFilter}
              className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold"
            >
              {text('Süzew')}
            </button>
          </div>

          <ul className="space-y-2">
            {(data?.assets || []).map((a) =>
              editingId === a.id ? (
                <AssetReattachRow
                  key={a.id}
                  asset={a}
                  text={text}
                  onCancel={() => setEditingId(null)}
                  onDone={() => {
                    setEditingId(null);
                    reload();
                  }}
                />
              ) : (
                <li
                  key={a.id}
                  className={`flex items-center justify-between gap-3 qp-card qp-card--static px-4 py-3 ${
                    a.isOrphan
                      ? 'border-rose-300/50 bg-rose-50/60'
                      : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {a.soz ? text(a.soz) : text('Atı joq')}
                      <span className="ml-2 text-ink/45">
                        · {a.kind} · {a.role || 'primary'}
                      </span>
                      {a.isOrphan ? (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-rose-800">
                          {text('Orphan')}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.65rem] text-ink/40">
                      #{a.id} · {a.titleId || '—'}
                    </p>
                    {a.titleId && !a.isOrphan ? (
                      <Link
                        to={`/dictionary/${encodeURIComponent(a.titleId)}`}
                        className="text-xs text-teal-800 hover:underline"
                      >
                        {text('Sóz beti')} <Icon name="right" />
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      className="text-xs font-semibold text-teal-800"
                      onClick={() => setEditingId(a.id)}
                    >
                      {text(a.isOrphan ? 'Baglaw' : 'Ózgertiw')}
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-700"
                      onClick={async () => {
                        if (!window.confirm(text('Asset óshiriledi. Dawam etesiz be?'))) return;
                        await adminDeleteImmersion(a.id);
                        reload();
                      }}
                    >
                      {text('Óshiriw')}
                    </button>
                  </div>
                </li>
              )
            )}
            {!data?.assets?.length ? (
              <li className="rounded-2xl bg-white/50 p-6 text-center text-sm text-ink/45">
                {text('Asset joq')}
              </li>
            ) : null}
          </ul>
        </section>
      </DictShell>
    </PageGate>
  );
}
