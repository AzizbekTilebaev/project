import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import usePageMeta from '../hooks/usePageMeta';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchImlaById, fetchImlaLetters, fetchImlaSources, searchImla } from '../api/dicts';

const PAGE_SIZE = 40;

const SOURCE_META = {
  '2020': { label: '2020', sub: 'Dawletov · Abdinazimov' },
  github: { label: 'GitHub', sub: 'Allaniyaz · apertium-kaa' },
  ozimizdan: { label: 'Ózimizdiń', sub: 'Platforma sózlikleri' },
};

function sourceLabel(source, text) {
  if (source === '2020') return '2020';
  if (source === 'github') return 'GitHub';
  if (source === 'ozimizdan') return text('Ózimizdiń');
  return source || '';
}

export function ImlaDetail() {
  const { id } = useParams();
  const { text } = useUiScript();
  const { status, data, error, reload } = usePageData(
    () => loadPageBundle({ entry: () => fetchImlaById(id).then((r) => r.data) }),
    { deps: [id] }
  );
  const entry = data?.entry;
  usePageMeta(entry?.word || 'Imla sózligi', entry?.entryText?.slice(0, 120));

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref="/dictionary/imla">
      {entry && (
        <DictShell className="pt-24 pb-24">
          <div className="relative mx-auto max-w-3xl px-5 md:px-8">
            <Link to="/dictionary/imla" className="text-sm text-ink/45 hover:text-teal-900">
              ← {text('Imla sózligi')}
            </Link>
            <header className="mt-8 mb-6">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[0.65rem] font-bold text-teal-800">
                  {sourceLabel(entry.source, text)}
                </span>
                {entry.pageNum ? (
                  <span className="text-xs text-ink/40">
                    {text('Bet')} {entry.pageNum}
                  </span>
                ) : null}
              </div>
              <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">{entry.word}</h1>
            </header>
            <section className="qp-surface p-6 md:p-8">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-teal-800/65">
                {text('Durıs jazılıwı')}
              </p>
              <p className="mt-3 text-lg leading-relaxed text-ink">{entry.entryText}</p>
              {entry.tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-ink/5 px-2.5 py-1 text-[0.7rem] font-semibold text-ink/55"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {entry.titleId ? (
                <Link to={`/dictionary/${entry.titleId}`} className="qp-btn-primary mt-6 inline-flex">
                  {text('Túsindirme sózlikte ashıw')}
                </Link>
              ) : null}
            </section>
          </div>
        </DictShell>
      )}
    </PageGate>
  );
}

export default function ImlaPage() {
  const { text } = useUiScript();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [letter, setLetter] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const offset = (page - 1) * PAGE_SIZE;

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        list: () =>
          searchImla({
            q: submitted,
            letter,
            source,
            limit: PAGE_SIZE,
            offset,
          }),
        letters: () => fetchImlaLetters(source).then((r) => r.data || []),
        sources: () => fetchImlaSources().then((r) => r.data || {}),
      }),
    { deps: [submitted, letter, source, page] }
  );

  usePageMeta('Imla sózligi', 'Qaraqalpaq tiliniń orfografiyalıq sózligi');

  const rows = data?.list?.items || [];
  const total = data?.list?.total || 0;
  const letters = data?.letters || [];
  const sourceStats = data?.sources || {};
  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const sourceTabs = [
    { id: '', label: text('Hámmesi'), n: Object.values(sourceStats).reduce((a, b) => a + Number(b || 0), 0) },
    ...Object.keys(SOURCE_META).map((id) => ({
      id,
      label: sourceLabel(id, text),
      n: sourceStats[id] || 0,
    })),
  ];

  const activeMeta = SOURCE_META[source] || null;

  return (
    <PageGate status={status} error={error} onRetry={reload}>
      <DictShell className="pt-24 pb-24">
        <div className="relative mx-auto max-w-4xl px-5 md:px-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            <Link to="/dictionary" className="text-ink/45 hover:text-teal-900">
              ← {text('Túsindirme')}
            </Link>
            <span className="text-ink/25">/</span>
            <span className="font-medium text-ink/70">{text('Imla')}</span>
          </div>

          <header className="mb-8">
            <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/65">
              {text('Qaraqalpaq tili')}
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
              {text('Imla sózligi')}
            </h1>
            <p className="mt-2 text-sm text-ink/50">
              {total} {text('jazba')}
              {activeMeta ? ` · ${activeMeta.sub}` : ` · ${text('Úsh manba · bir sózlik')}`}
            </p>
          </header>

          <div className="mb-4 flex flex-wrap gap-2">
            {sourceTabs.map((t) => {
              const active = source === t.id;
              return (
                <button
                  key={t.id || 'all'}
                  type="button"
                  onClick={() => {
                    setSource(t.id);
                    setLetter('');
                    setPage(1);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-teal-800 text-white'
                      : 'border border-ink/10 bg-white/70 text-ink/65 hover:text-teal-900'
                  }`}
                >
                  {t.label}
                  {t.n ? <span className="ml-1.5 opacity-70">{t.n}</span> : null}
                </button>
              );
            })}
          </div>

          {letters.length ? (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setLetter('');
                  setPage(1);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  !letter
                    ? 'bg-ink text-white'
                    : 'border border-ink/10 bg-white/70 text-ink/65 hover:text-teal-900'
                }`}
              >
                A–Z
              </button>
              {letters.map((row) => {
                const active = letter === row.letter;
                return (
                  <button
                    key={row.letter}
                    type="button"
                    onClick={() => {
                      setLetter(row.letter);
                      setPage(1);
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase transition ${
                      active
                        ? 'bg-ink text-white'
                        : 'border border-ink/10 bg-white/70 text-ink/65 hover:text-teal-900'
                    }`}
                  >
                    {row.letter}
                  </button>
                );
              })}
            </div>
          ) : null}

          <form
            className="mb-8 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSubmitted(q.trim());
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={text('Sózdiń jazılıwın izleń…')}
              className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-teal-600/40"
            />
            <button type="submit" className="qp-btn-primary shrink-0">
              {text('Izlew')}
            </button>
            {submitted ? (
              <button
                type="button"
                className="qp-btn-ghost shrink-0"
                onClick={() => {
                  setQ('');
                  setSubmitted('');
                  setPage(1);
                }}
              >
                {text('Tazalaw')}
              </button>
            ) : null}
          </form>

          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/dictionary/imla/${row.id}`)}
                  className="qp-card flex w-full items-start justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{row.word}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink/55">{row.entryText}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full bg-teal-50 px-2 py-1 text-[0.65rem] font-bold text-teal-800">
                      {sourceLabel(row.source, text)}
                    </span>
                    {row.titleId ? (
                      <span className="rounded-full bg-ink/5 px-2 py-1 text-[0.65rem] font-bold text-ink/50">
                        KAA
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {pages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="qp-btn-ghost disabled:opacity-40"
              >
                ←
              </button>
              <span className="text-sm text-ink/50">
                {page} / {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="qp-btn-ghost disabled:opacity-40"
              >
                →
              </button>
            </div>
          ) : null}
        </div>
      </DictShell>
    </PageGate>
  );
}
