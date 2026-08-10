import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import Icon from '../components/Icon';
import ScriptToggle from '../components/literature/ScriptToggle';
import { t } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import { inScript, toLatin } from '../utils/qqScript';

async function loadNaqillar() {
  const res = await fetch('/data/naqillar.json');
  if (!res.ok) throw new Error('Naqillar júklenbedi');
  return res.json();
}

function displayText(value, script) {
  if (!value) return '';
  return inScript(value, script);
}

const CHIP = [
  'from-teal-400 to-cyan-500',
  'from-amber-400 to-orange-400',
  'from-sky-400 to-indigo-400',
  'from-rose-400 to-pink-400',
  'from-lime-400 to-emerald-500',
  'from-fuchsia-400 to-violet-400',
];

function NaqillarBody({ data }) {
  const { script, setScript } = useUiScript();
  const [sectionId, setSectionId] = useState(null);
  const [q, setQ] = useState('');

  const sections = data?.sections || [];
  const activeId = sectionId || sections[0]?.id || null;
  const active = useMemo(
    () => sections.find((s) => s.id === activeId) || sections[0] || null,
    [sections, activeId]
  );
  const total = data?.total ?? sections.reduce((n, s) => n + (s.count || 0), 0);

  const filtered = useMemo(() => {
    const items = active?.items || [];
    const needle = q.trim().toLocaleLowerCase('kk');
    if (!needle) return items;
    return items.filter((it) => {
      const cyr = it.toLocaleLowerCase('kk');
      const lat = toLatin(it).toLocaleLowerCase('kk');
      return cyr.includes(needle) || lat.includes(needle);
    });
  }, [active, q]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[var(--color-parchment)] pt-16 md:pt-20">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-16 top-10 h-52 w-52 rounded-full bg-teal-300/30 blur-3xl" />
        <div className="absolute right-0 top-20 h-56 w-56 rounded-full bg-amber-300/25 blur-3xl" />
        <div className="absolute bottom-24 left-1/3 h-40 w-40 rounded-full bg-rose-300/20 blur-3xl" />
      </div>

      {/* Fixed top chrome — does not scroll */}
      <header className="relative z-10 shrink-0 border-b border-ink/5 bg-[var(--color-parchment)]/85 px-4 pb-3 pt-3 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/literature"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm text-ink/55 shadow-sm transition hover:text-teal-900"
          >
            <Icon name="left" /> {t('literatureBack', script)}
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-2xl bg-ink px-2.5 py-1 text-[0.7rem] font-bold text-white sm:inline">
              {total} {t('naqilUnit', script)}
            </span>
            <ScriptToggle value={script} onChange={setScript} />
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl">
              {t('naqillar', script)}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-ink/50 sm:text-base">
              {t('naqillarIntro', script)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2.5 shadow-sm">
          <Icon name="search" className="shrink-0 text-teal-700/70" />
          <input
            id="naqil-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('naqilSearch', script)}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/35"
          />
        </div>

        <div
          className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 snap-x"
          role="tablist"
          aria-label={t('naqillar', script)}
        >
          {sections.map((s, idx) => {
            const on = s.id === active?.id;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setSectionId(s.id);
                  setQ('');
                }}
                className={`snap-start shrink-0 rounded-2xl px-3 py-2 text-left transition ${
                  on
                    ? 'bg-ink text-white shadow-md'
                    : 'bg-white/80 text-ink/70 ring-1 ring-ink/5 hover:bg-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br text-[0.65rem] font-black text-white ${CHIP[idx % CHIP.length]}`}
                  >
                    {idx + 1}
                  </span>
                  <span className="max-w-[10rem] truncate text-sm font-semibold sm:max-w-[14rem]">
                    {displayText(s.title, script)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {active ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg tracking-tight text-ink sm:text-xl">
              {displayText(active.title, script)}
            </h2>
            <p className="rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900">
              {filtered.length}
              {q.trim() ? ` / ${active.count}` : ''} {t('naqilUnit', script)}
            </p>
          </div>
        ) : null}
      </header>

      {/* Only this area scrolls */}
      <div
        className="relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 md:pb-8 lg:px-8"
        role="tabpanel"
      >
        {active ? (
          <>
            <ul className="mx-auto grid max-w-6xl gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item, i) => (
                <li
                  key={`${active.id}-${i}`}
                  className="rounded-2xl border border-white/80 bg-white/75 p-4 shadow-[0_8px_24px_-20px_rgba(15,60,50,0.55)] backdrop-blur"
                >
                  <div className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-400/30 to-amber-300/40 text-[0.7rem] font-bold text-teal-950">
                      {i + 1}
                    </span>
                    <p className="font-display text-[1.02rem] leading-relaxed text-ink/90 whitespace-pre-line">
                      {displayText(item, script)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {!filtered.length ? (
              <p className="mt-10 text-center text-sm text-ink/45">{t('notFound', script)}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ink/45">{t('notFound', script)}</p>
        )}
      </div>
    </div>
  );
}

export default function Naqillar() {
  const { script } = useUiScript();
  usePageMeta(t('naqillar', script), t('naqillarIntro', script));

  const { status, data, error, reload } = usePageData(() => loadNaqillar(), { deps: [] });

  return (
    <ProtectedContent>
      <PageGate
        status={status}
        error={error}
        onRetry={reload}
        backHref="/literature"
        backLabel={t('literatureBack', script)}
        className="pt-16 md:pt-20"
      >
        <NaqillarBody data={data} />
      </PageGate>
    </ProtectedContent>
  );
}
