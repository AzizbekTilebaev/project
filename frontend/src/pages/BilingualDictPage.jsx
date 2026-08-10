import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import usePageMeta from '../hooks/usePageMeta';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  fetchBilingualById,
  fetchUzbKaaById,
  listBilingual,
  listUzbKaa,
  searchBilingual,
  searchUzbKaa,
} from '../api/dicts';
import StructuredSenses from '../components/dictionary/StructuredSenses';
import OrnamentFrame from '../components/dictionary/OrnamentFrame';

/** БЕСПРИЗОРН//ЫЙ → БЕСПРИЗОРНЫЙ (rus sózlik stem belgisi) */
function displayHeadword(word) {
  return String(word || '')
    .replace(/([А-ЯЁа-яёA-Za-z])\/{1,2}([А-ЯЁа-яёA-Za-z])/g, '$1$2')
    .trim();
}

const META = {
  uzb: {
    title: 'Ózbeksha–Qaraqalpaqsha sózlik',
    searchHint: 'Ózbeksha yamasa qaraqalpaqsha sóz…',
    list: listUzbKaa,
    search: searchUzbKaa,
    detail: fetchUzbKaaById,
  },
  en: {
    title: 'Qaraqalpaqsha–English dictionary',
    searchHint: 'Karakalpak or English…',
    list: (opts) => listBilingual('en', opts),
    search: (q, limit) => searchBilingual('en', q, limit),
    detail: (id) => fetchBilingualById('en', id),
  },
  ru: {
    title: 'Русско–каракалпакский словарь',
    searchHint: 'Русское слово…',
    list: (opts) => listBilingual('ru', opts),
    search: (q, limit) => searchBilingual('ru', q, limit),
    detail: (id) => fetchBilingualById('ru', id),
  },
};

function SenseBlock({ entry, scripted = true }) {
  return <StructuredSenses senses={entry?.senses} scripted={scripted} />;
}

export function BilingualDictDetail({ kind }) {
  const { id } = useParams();
  const { text } = useUiScript();
  const cfg = META[kind];
  const { status, data, error, reload } = usePageData(
    () => loadPageBundle({ entry: () => cfg.detail(id).then((r) => r.data) }),
    { deps: [id, kind] }
  );
  const entry = data?.entry;
  usePageMeta(entry?.word || cfg.title, entry?.gloss?.slice(0, 120));
  // en: headword = KAA; uzb/ru: headword = chet til, gloss/senses = KAA
  const headwordIsKaa = kind === 'en';
  const sensesAreKaa = kind !== 'en';
  const head = displayHeadword(entry?.word);
  const shownHead = headwordIsKaa ? text(head) : head;

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref={`/dictionary/${kind}`}>
      {entry && (
        <DictShell className="pt-24 pb-24">
          <div className="relative mx-auto max-w-3xl px-5 md:px-8">
            <Link to={`/dictionary/${kind}`} className="text-sm text-ink/45 hover:text-teal-900">
              ← {text(cfg.title)}
            </Link>
            <header className="mt-8 mb-6">
              <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
                {shownHead}
              </h1>
              {entry.pos && <p className="mt-2 text-sm italic text-ink/50">{entry.pos}</p>}
              {entry.primary && (
                <p className="mt-2 text-base text-teal-900">
                  {text('Tiypkarı')}: <strong>{text(entry.primary)}</strong>
                </p>
              )}
              {entry.direction && <p className="mt-1 text-xs text-ink/40">{entry.direction}</p>}
            </header>
            <OrnamentFrame>
              <SenseBlock entry={entry} scripted={sensesAreKaa} />
              {entry.titleId && (
                <Link
                  to={`/dictionary/${entry.titleId}`}
                  className="qp-btn-primary mt-6 inline-flex"
                >
                  {text('Túsindirme sózlikte ashıw')}
                </Link>
              )}
            </OrnamentFrame>
            {Array.isArray(entry.lexicon) && entry.lexicon.length > 0 && (
              <section className="qp-card qp-card--static mt-6 p-5">
                <h2 className="font-display text-lg text-ink mb-3">{text('Lexikon juwapları')}</h2>
                <ul className="space-y-1.5 text-sm text-ink/70">
                  {entry.lexicon.map((r) => (
                    <li key={`${r.uzb}-${r.kaa}`}>
                      <strong>{r.uzb}</strong> ↔ {text(r.kaa)}
                      <span className="ml-2 text-[0.65rem] text-ink/35">{r.source}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </DictShell>
      )}
    </PageGate>
  );
}

export default function BilingualDictPage({ kind }) {
  const cfg = META[kind];
  const { text } = useUiScript();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [page, setPage] = useState(1);

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        list: async () => {
          if (submitted.trim().length >= 1) {
            const res = await cfg.search(submitted.trim(), 40);
            return { data: res.data || [], total: res.count || 0, searching: true };
          }
          return cfg.list({ page, limit: 40 });
        },
      }),
    { deps: [kind, submitted, page] }
  );

  usePageMeta(cfg.title, text('Tarjima sózlik'));

  const rows = data?.list?.data || [];
  const total = data?.list?.total || 0;
  const searching = data?.list?.searching;

  const pages = useMemo(() => Math.max(1, Math.ceil(total / 40)), [total]);

  return (
    <PageGate status={status} error={error} onRetry={reload}>
      <DictShell className="pt-24 pb-24">
        <div className="relative mx-auto max-w-4xl px-5 md:px-8">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            <Link to="/dictionary" className="text-ink/45 hover:text-teal-900">
              ← {text('Túsindirme')}
            </Link>
            <span className="text-ink/25">/</span>
            <span className="font-medium text-ink/70">{text(cfg.title)}</span>
          </div>

          <header className="mb-8">
            <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/65">
              {text('Qaraqalpaq tili')}
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">{text(cfg.title)}</h1>
            <p className="mt-2 text-sm text-ink/50">
              {searching ? text(`${rows.length} nátiyje`) : text(`${total} jazba`)}
              {' · '}
              {text('Qaraqalpaqsha baylanıslı sózlik')}
            </p>
          </header>

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
              placeholder={text(cfg.searchHint)}
              className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-teal-600/40"
            />
            <button type="submit" className="qp-btn-primary shrink-0">
              {text('Izlew')}
            </button>
            {submitted && (
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
            )}
          </form>

          <OrnamentFrame>
            <ul className="qp-entry-list">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/dictionary/${kind}/${row.id}`)}
                    className="flex w-full items-start justify-between gap-3 text-left transition-colors hover:text-teal-950"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {kind === 'en'
                          ? text(displayHeadword(row.word))
                          : displayHeadword(row.word)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-ink/55">
                        {kind === 'en'
                          ? row.primary || row.senses?.[0]?.text || row.gloss
                          : text(row.primary || row.senses?.[0]?.text || row.gloss || '')}
                      </p>
                    </div>
                    {row.titleId && (
                      <span className="shrink-0 rounded-full bg-teal-50 px-2 py-1 text-[0.65rem] font-bold text-teal-800">
                        KAA
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </OrnamentFrame>

          {!searching && pages > 1 && (
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
          )}
        </div>
      </DictShell>
    </PageGate>
  );
}
