import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import usePageMeta from '../hooks/usePageMeta';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchAdamAtariById, searchAdamAtlari } from '../api/dicts';
import StructuredSenses from '../components/dictionary/StructuredSenses';

const PAGE_SIZE = 40;

function GenderBadge({ gender, text }) {
  if (!gender) return null;
  const label = gender === 'ul' ? text('Ul') : gender === 'qiz' ? text('Qız') : gender;
  return (
    <span className="shrink-0 rounded-full bg-teal-50 px-2 py-1 text-[0.65rem] font-bold text-teal-800">
      {label}
    </span>
  );
}

export function AdamAtlariDetail() {
  const { id } = useParams();
  const { text } = useUiScript();
  const { status, data, error, reload } = usePageData(
    () => loadPageBundle({ entry: () => fetchAdamAtariById(id).then((r) => r.data) }),
    { deps: [id] }
  );
  const entry = data?.entry;
  usePageMeta(entry?.name || 'Adam atları', entry?.gloss?.slice(0, 120));

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref="/dictionary/adam-atlari">
      {entry && (
        <DictShell className="pt-24 pb-24">
          <div className="relative mx-auto max-w-3xl px-5 md:px-8">
            <Link to="/dictionary/adam-atlari" className="text-sm text-ink/45 hover:text-teal-900">
              ← {text('Adam atları')}
            </Link>
            <header className="mt-8 mb-6 flex flex-wrap items-start gap-3">
              <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">{entry.name}</h1>
              <GenderBadge gender={entry.gender} text={text} />
            </header>
            <section className="qp-surface p-6 md:p-8">
              <StructuredSenses senses={entry.senses} showEmpty />
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

export default function AdamAtlariPage() {
  const { text } = useUiScript();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [gender, setGender] = useState('');
  const [page, setPage] = useState(1);
  const offset = (page - 1) * PAGE_SIZE;

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        list: () =>
          searchAdamAtlari({
            q: submitted,
            gender,
            limit: PAGE_SIZE,
            offset,
          }),
      }),
    { deps: [submitted, gender, page] }
  );

  usePageMeta('Adam atları', 'Qaraqalpaqsha atlar hám mánisi');

  const rows = data?.list?.items || [];
  const total = data?.list?.total || 0;
  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const genderTabs = [
    { id: '', label: text('Hámmesi') },
    { id: 'ul', label: text('Ul') },
    { id: 'qiz', label: text('Qız') },
  ];

  return (
    <PageGate status={status} error={error} onRetry={reload}>
      <DictShell className="pt-24 pb-24">
        <div className="relative mx-auto max-w-4xl px-5 md:px-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            <Link to="/dictionary" className="text-ink/45 hover:text-teal-900">
              ← {text('Túsindirme')}
            </Link>
            <span className="text-ink/25">/</span>
            <span className="font-medium text-ink/70">{text('Adam atları')}</span>
          </div>

          <header className="mb-8">
            <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/65">
              {text('Qaraqalpaq tili')}
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
              {text('Adam atları')}
            </h1>
            <p className="mt-2 text-sm text-ink/50">
              {total} {text('jazba')}
              {' · '}
              {text('Atlar hám olardıń mánisi')}
            </p>
          </header>

          <div className="mb-4 flex flex-wrap gap-2">
            {genderTabs.map((t) => {
              const active = gender === t.id;
              return (
                <button
                  key={t.id || 'all'}
                  type="button"
                  onClick={() => {
                    setGender(t.id);
                    setPage(1);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-teal-800 text-white'
                      : 'border border-ink/10 bg-white/70 text-ink/65 hover:text-teal-900'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

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
              placeholder={text('At yamasa mánisi…')}
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
                  onClick={() => navigate(`/dictionary/adam-atlari/${row.id}`)}
                  className="qp-card flex w-full items-start justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{row.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink/55">
                      {row.senses?.[0]?.text || row.gloss}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <GenderBadge gender={row.gender} text={text} />
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
