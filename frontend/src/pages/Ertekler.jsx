import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ScriptToggle from '../components/literature/ScriptToggle';
import { t, genreLabel, sourceLabel } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchBooks } from '../api/books';
import { KAA } from '../i18n/kaa';

const TYPE_TABS = [
  { id: '', labelKey: 'erteklerAll' },
  { id: 'Qıyalıy ertekler', labelKey: 'erteklerQiyaliy' },
  { id: 'Turmıslıq ertekler', labelKey: 'erteklerTurmislq' },
  { id: 'Haywanlar haqqında ertekler', labelKey: 'erteklerHaywan' },
  { id: 'pdf', labelKey: 'erteklerPdf' },
];

function bookDisplay(book, script) {
  if (!book) return { title: '', author: '', description: '' };
  if (script === 'latin') {
    return {
      title: book.titleLatin || book.title || '',
      author: book.authorLatin || book.author || '',
      description: book.descriptionLatin || book.description || '',
    };
  }
  return {
    title: book.titleCyrillic || book.titleOriginal || book.title || '',
    author: book.authorCyrillic || book.authorOriginal || book.author || '',
    description: book.descriptionCyrillic || book.descriptionOriginal || book.description || '',
  };
}

function storyType(book) {
  return String(book?.note || book?.description || '').trim();
}

export default function Ertekler() {
  const { script, setScript, text } = useUiScript();
  const navigate = useNavigate();
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');

  usePageMeta(t('ertekler', script), t('erteklerIntro', script));

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        books: async () => {
          const res = await fetchBooks();
          return (res.books || []).filter((b) => b.genre === 'ertek');
        },
      }),
    { deps: [] }
  );

  const books = data?.books || [];

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return books.filter((b) => {
      if (tab === 'pdf') {
        if (b.sourceType !== 'pdf') return false;
      } else if (tab) {
        if (storyType(b) !== tab) return false;
      }
      if (!needle) return true;
      const d = bookDisplay(b, script);
      return `${d.title} ${d.author} ${storyType(b)}`.toLowerCase().includes(needle);
    });
  }, [books, tab, q, script]);

  const counts = useMemo(() => {
    const map = { '': books.length, pdf: 0 };
    for (const b of books) {
      if (b.sourceType === 'pdf') map.pdf += 1;
      const ty = storyType(b);
      if (ty) map[ty] = (map[ty] || 0) + 1;
    }
    return map;
  }, [books]);

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref="/literature" backLabel={t('litCenter', script)}>
      <DictShell className="pt-24 pb-24">
        <div className="relative mx-auto max-w-5xl px-5 md:px-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link to="/literature" className="text-sm text-ink/45 hover:text-teal-900">
              ← {t('litCenter', script)}
            </Link>
            <ScriptToggle script={script} onChange={setScript} />
          </div>

          <header className="mb-8">
            <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/65">
              {text(KAA.qaraqalpaqTili)}
            </p>
            <h1 className="font-display text-4xl md:text-5xl tracking-tight text-ink">
              {t('ertekler', script)}
            </h1>
            <p className="mt-3 max-w-2xl text-base text-ink/60 leading-relaxed">
              {t('erteklerIntro', script)}
            </p>
            <p className="mt-2 text-sm text-ink/45">
              {filtered.length} / {books.length} · {genreLabel('ertek', script)}
            </p>
          </header>

          <div className="mb-4 flex flex-wrap gap-2">
            {TYPE_TABS.map((tb) => {
              const active = tab === tb.id;
              const n = counts[tb.id] ?? 0;
              return (
                <button
                  key={tb.id || 'all'}
                  type="button"
                  onClick={() => setTab(tb.id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-teal-800 text-white'
                      : 'border border-ink/10 bg-white/70 text-ink/65 hover:text-teal-900'
                  }`}
                >
                  {t(tb.labelKey, script)}
                  {tb.id !== '' ? ` (${n})` : ''}
                </button>
              );
            })}
          </div>

          <form
            className="mb-8 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('erteklerSearch', script)}
              className="min-w-0 flex-1 rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-sm outline-none focus:border-teal-600/40"
            />
          </form>

          <ul className="grid gap-3 sm:grid-cols-2">
            {filtered.map((book) => {
              const d = bookDisplay(book, script);
              const type = storyType(book);
              const href =
                book.sourceType === 'text' ? `/books/${book.id}/read` : `/books/${book.id}`;
              return (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => navigate(href)}
                    className="qp-card flex h-full w-full flex-col items-start gap-2 p-5 text-left"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <h2 className="font-display text-xl text-ink tracking-tight">{d.title}</h2>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[0.65rem] font-bold text-amber-900">
                        {sourceLabel(book.sourceType, script)}
                      </span>
                    </div>
                    <p className="text-sm text-ink/50">{d.author}</p>
                    {type ? <p className="text-xs font-semibold text-teal-800/80">{type}</p> : null}
                    <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-teal-800">
                      {book.sourceType === 'text' ? t('erteklerRead', script) : t('erteklerOpen', script)}{' '}
                      <Icon name="right" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {!filtered.length ? (
            <p className="mt-8 text-sm text-ink/45">{t('erteklerEmpty', script)}</p>
          ) : null}
        </div>
      </DictShell>
    </PageGate>
  );
}
