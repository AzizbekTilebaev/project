import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import {
  bookFileUrl,
  fetchBookById,
  fetchBooks,
  fetchMyBookProgress,
} from '../api/books';
import ScriptToggle from '../components/literature/ScriptToggle';
import { t, genreLabel, sourceLabel } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import { AnimChevron, anim, PageEnter } from '../animations';
import { KAA } from '../i18n/kaa';
import { getReadingLessonMeta } from '../lib/readingProgress';
import { clearBookContinue, getContinueBook } from '../components/literature/litUtils';
import { emitResumeChanged } from '../lib/resumeEvents';
import useResumeTick from '../hooks/useResumeTick';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { useAuth } from '../contexts/AuthContext';
import { pickFeaturedBooks } from '../data/featuredBooks';

const PROGRESS_KEY = 'books:progress';

/** Latin / Cyrillic juftlik — title, author, description. */
function bookDisplay(book, script) {
  if (!book) return { title: '', author: '', description: '' };
  if (script === 'latin') {
    return {
      title: book.titleLatin || book.title,
      author: book.authorLatin || book.author,
      description: book.descriptionLatin || book.description || '',
    };
  }
  return {
    title: book.titleCyrillic || book.titleOriginal || book.title,
    author: book.authorCyrillic || book.authorOriginal || book.author,
    description: book.descriptionCyrillic || book.descriptionOriginal || book.description || '',
  };
}

function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

const COVER_THEMES = {
  dastan: 'from-amber-200 via-orange-100 to-rose-200 text-amber-950',
  klassik: 'from-teal-200 via-emerald-50 to-cyan-200 text-teal-950',
  zamanagoy: 'from-teal-200 via-cyan-50 to-emerald-100 text-teal-950',
  roman: 'from-sky-200 via-teal-50 to-cyan-100 text-teal-950',
  ertek: 'from-orange-200 via-amber-50 to-yellow-100 text-amber-950',
  other: 'from-stone-200 via-neutral-50 to-zinc-200 text-stone-950',
};

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function BookCover({ book, compact = false, script = 'cyrillic' }) {
  const disp = bookDisplay(book, script);
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br ${
        COVER_THEMES[book.genre] || COVER_THEMES.other
      } ${compact ? 'h-44 w-28' : 'h-64 w-44'} shadow-[0_20px_35px_-20px_rgba(28,42,36,0.55)]`}
    >
      <span className="absolute -right-8 -top-7 h-24 w-24 rounded-full border-[14px] border-white/25" />
      <span className="absolute -bottom-12 -left-9 h-32 w-32 rounded-full bg-white/25" />
      <span className="relative flex h-full flex-col justify-between p-4">
        <span className="text-[0.55rem] font-bold uppercase tracking-[0.22em] opacity-60">
          {t('litHeritageCover', script)}
        </span>
        <span>
          <span className={`${compact ? 'text-xl' : 'text-3xl'} block font-display leading-tight`}>
            {disp.title}
          </span>
          <span className="mt-2 block text-[0.65rem] font-semibold opacity-65">{disp.author}</span>
        </span>
        <span className="text-[0.55rem] font-bold uppercase tracking-[0.18em] opacity-50">
          {book.sourceType ? sourceLabel(book.sourceType, script) : genreLabel(book.genre, script) || book.genre}
        </span>
      </span>
    </div>
  );
}

function PdfViewer({ book, onClose, script = 'cyrillic' }) {
  const src = bookFileUrl(book.id, { fileAccess: book.fileAccess });
  const downloadSrc = bookFileUrl(book.id, { download: true, fileAccess: book.fileAccess });

  return (
    <DictShell className="pt-24 pb-10">
      <section className="relative mx-auto max-w-5xl px-4 pt-6 md:px-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 qp-chip text-ink/65 hover:text-teal-900"
          >
            <Icon name="left" /> {bookDisplay(book, script).title}
          </button>
          <div className="flex flex-wrap gap-2">
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="qp-chip text-teal-900"
            >
              {t('openNewTab', script)}
            </a>
            <a
              href={downloadSrc}
              className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-900"
            >
              {t('download', script)}
            </a>
          </div>
        </div>
        <div className="overflow-hidden qp-card qp-card--static shadow-lg">
          <iframe
            title={book.title}
            src={src}
            className="h-[75vh] w-full bg-white"
            sandbox="allow-same-origin allow-scripts allow-downloads"
            referrerPolicy="no-referrer"
          />
        </div>
        <p className="mt-3 text-center text-xs text-ink/40">
          {t('pdfHint', script)}
        </p>
      </section>
    </DictShell>
  );
}

export default function Books() {
  const { script, setScript, text } = useUiScript();
  const { isAuthenticated } = useAuth();
  usePageMeta(t('books', script), t('booksIntro', script));

  const [query, setQuery] = useState('');
  const [searchParams] = useSearchParams();
  const [genre, setGenre] = useState(() => String(searchParams.get('genre') || ''));
  const { status, data, error: listError, reload } = usePageData(
    () =>
      loadPageBundle(
        {
          books: async () => {
            const res = await fetchBooks();
            return res.books || [];
          },
        },
        {
          remoteProgress: async () => {
            const res = await fetchMyBookProgress();
            return res.progress || [];
          },
        }
      ),
    { deps: [] }
  );
  const books = data?.books || [];
  const navigate = useNavigate();
  const listRef = useRef(null);
  const [error, setError] = useState('');
  const [selectedBook, setSelectedBook] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('about');
  const [viewingPdf, setViewingPdf] = useState(null);
  const [progress, setProgress] = useState(readProgress);

  // Oqıw — script-aware /books/:id/read betine ótemiz (dual-script pieces sonda)
  const openReader = (bookId, sectionIdx = 0) => {
    navigate(
      `/books/${encodeURIComponent(bookId)}/read${sectionIdx ? `?section=${sectionIdx}` : ''}`
    );
  };

  useEffect(() => {
    const remote = data?.remoteProgress;
    if (!remote?.length) return;
    const all = readProgress();
    for (const p of remote) {
      const local = all[p.bookId];
      const remoteTs = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
      if (!local || (local.updatedAt || 0) < remoteTs) {
        all[p.bookId] = {
          section: p.sectionIndex,
          done: p.completed,
          percent: p.percent,
          updatedAt: remoteTs || Date.now(),
        };
      }
    }
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
      emitResumeChanged();
    } catch {
      /* ignore */
    }
    setProgress(all);
  }, [data?.remoteProgress]);

  const openBook = async (book) => {
    setDetailLoading(true);
    setDetailTab('about');
    setError('');
    try {
      const data = await fetchBookById(book.id);
      setSelectedBook({ ...data.book, fileAccess: data.fileAccess || null });
    } catch (err) {
      setError(err.message || t('bookNotOpened', script));
      setSelectedBook(book);
    } finally {
      setDetailLoading(false);
    }
  };

  const resumeTick = useResumeTick();
  const continueBook = useMemo(() => getContinueBook(), [progress, resumeTick]);
  const readingMeta = useMemo(() => getReadingLessonMeta(), [resumeTick]);

  const keepStreakHref = useMemo(() => {
    if (continueBook?.href) return continueBook.href;
    const first = Object.entries(progress).find(([, bp]) => bp && !bp.done);
    if (first?.[0]) return `/books/${encodeURIComponent(first[0])}`;
    return '/books';
  }, [progress, continueBook]);

  const abandonBookContinue = () => {
    if (!continueBook?.bookId) return;
    clearBookContinue(continueBook.bookId);
    setProgress((prev) => {
      const next = { ...prev };
      delete next[continueBook.bookId];
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const genres = useMemo(() => [...new Set(books.map((b) => b.genre).filter(Boolean))], [books]);
  const featuredBooks = useMemo(() => pickFeaturedBooks(books, 6), [books]);
  const showFeaturedStrip = !query.trim() && !genre && featuredBooks.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      if (genre && b.genre !== genre) return false;
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        (b.titleLatin || '').toLowerCase().includes(q) ||
        (b.authorLatin || '').toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q)
      );
    });
  }, [books, query, genre]);

  if (viewingPdf) {
    return <PdfViewer book={viewingPdf} onClose={() => setViewingPdf(null)} script={script} />;
  }

  if (selectedBook) {
    const bookProgress = progress[selectedBook.id];
    const sections = selectedBook.sections || [];
    const isText = selectedBook.sourceType === 'text' || (!selectedBook.sourceType && sections.length);
    const isPdf = selectedBook.sourceType === 'pdf';
    const isDoc =
      selectedBook.sourceType === 'doc' || selectedBook.sourceType === 'docx';

    return (
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-3xl px-6 pt-8 md:px-10">
          <button
            type="button"
            onClick={() => setSelectedBook(null)}
            className="mb-8 qp-chip text-ink/65 hover:text-teal-900"
          >
            <Icon name="left" /> {t('books', script)}
          </button>

          {detailLoading && (
            <p className="mb-4 text-center text-sm text-ink/45">{t('loadingFull', script)}</p>
          )}

          <article className="animate-dict-rise overflow-hidden qp-surface shadow-[0_28px_70px_-35px_rgba(28,42,36,0.45)]">
            <div className="relative bg-gradient-to-b from-white/80 to-teal-50/40 px-7 pb-8 pt-10 text-center md:px-10">
              <div className="mx-auto mb-7 flex w-fit transition-transform duration-300 hover:-translate-y-1">
                <BookCover book={selectedBook} script={script} />
              </div>
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-900">
                  {genreLabel(selectedBook.genre, script) || selectedBook.genre}
                </span>
                <span className="inline-flex rounded-full qp-chip text-teal-900">
                  {sourceLabel(selectedBook.sourceType, script)}
                </span>
              </div>
              <h1 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
                {bookDisplay(selectedBook, script).title}
              </h1>
              <p className="mt-2 font-medium text-teal-900">{bookDisplay(selectedBook, script).author}</p>
              <Link
                to={`/books/${encodeURIComponent(selectedBook.id)}`}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-teal-700/20 bg-white/70 px-4 py-2 text-xs font-semibold text-teal-900 transition hover:bg-teal-50"
              >
                {t('fullBookPage', script)} <AnimChevron count={2} className="opacity-70" />
              </Link>

              <div className="mx-auto mt-7 grid max-w-md grid-cols-3 divide-x divide-ink/10 qp-card qp-card--static py-4">
                <span className="px-2">
                  <Icon name="eye" className="mb-1 text-teal-700" />
                  <span className="block text-xs text-ink/45">{t('era', script)}</span>
                  <strong className="mt-0.5 block text-xs text-ink/75">
                    {selectedBook.years || '—'}
                  </strong>
                </span>
                <span className="px-2">
                  <Icon name="book" className="mb-1 text-teal-600" />
                  <span className="block text-xs text-ink/45">{t('type', script)}</span>
                  <strong className="mt-0.5 block text-xs text-ink/75">
                    {sourceLabel(selectedBook.sourceType, script)}
                  </strong>
                </span>
                <span className="px-2">
                  <Icon name="scroll" className="mb-1 text-amber-600" />
                  <span className="block text-xs text-ink/45">{t('size', script)}</span>
                  <strong className="mt-0.5 block text-xs text-ink/75">
                    {selectedBook.hasFile
                      ? formatSize(selectedBook.fileSize)
                      : `${sections.length} ${t('sections', script)}`}
                  </strong>
                </span>
              </div>
            </div>

            <div className="px-7 py-8 md:px-10">
              {isText ? (
                <>
                  <div className="mb-5 flex gap-6 border-b border-ink/10">
                    <button
                      type="button"
                      onClick={() => setDetailTab('about')}
                      className={`pb-3 text-sm transition-colors ${
                        detailTab === 'about'
                          ? 'border-b-2 border-teal-700 font-bold text-teal-900'
                          : 'text-ink/40 hover:text-ink/70'
                      }`}
                    >
                      {t('contentsTab', script)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailTab('sections')}
                      className={`pb-3 text-sm transition-colors ${
                        detailTab === 'sections'
                          ? 'border-b-2 border-teal-700 font-bold text-teal-900'
                          : 'text-ink/40 hover:text-ink/70'
                      }`}
                    >
                      {t('sectionsTab', script)} ({sections.length})
                    </button>
                  </div>

                  {detailTab === 'about' ? (
                    <>
                      <p className="text-base leading-8 text-ink/68">{bookDisplay(selectedBook, script).description}</p>
                      {selectedBook.note && (
                        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <Icon name="sparkle" className="mr-2" />
                          {selectedBook.note}
                        </p>
                      )}
                    </>
                  ) : (
                    <ul className="space-y-3">
                      {sections.map((s, i) => {
                        const isDone =
                          bookProgress && (bookProgress.done || bookProgress.section > i);
                        const isCurrent =
                          bookProgress && !bookProgress.done && bookProgress.section === i;
                        return (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => openReader(selectedBook.id, i)}
                              className="group flex w-full items-center gap-4 qp-card px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-teal-600/30 hover:bg-teal-50/50 hover:shadow-md"
                            >
                              <span
                                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                                  isDone
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                                    : isCurrent
                                      ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                                      : 'bg-ink/[0.06] text-ink/50'
                                }`}
                              >
                                {isDone ? <Icon name="check" /> : i + 1}
                              </span>
                              <span className="flex-1">
                                <span className="block font-display text-lg text-ink group-hover:text-teal-900">
                                  {s.title}
                                </span>
                                <span className="block text-xs text-ink/45">
                                  {(s.paragraphs || []).length} {t('paragraphUnit', script)}
                                  {isCurrent
                                    ? ` · ${t('readingNow', script)}`
                                    : isDone
                                      ? ` · ${t('readDone', script)}`
                                      : ''}
                                </span>
                              </span>
                              <AnimChevron count={2} className="opacity-35 group-hover:opacity-90 shrink-0" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      openReader(
                        selectedBook.id,
                        bookProgress && !bookProgress.done ? bookProgress.section : 0
                      )
                    }
                    disabled={!sections.length}
                    className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-teal-900/20 transition-all hover:-translate-y-0.5 disabled:opacity-40"
                  >
                    <Icon name="book" className="text-xl" />
                    {bookProgress?.done
                      ? t('readAgain', script)
                      : bookProgress
                        ? `${t('continueReading', script)} — ${bookProgress.section + 1}-${t('sections', script)}`
                        : t('startReading', script)}
                  </button>
                  {bookProgress?.done && (
                    <p className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-center text-xs font-semibold text-emerald-700">
                      <Icon name="trophy" /> {t('bookFinished', script)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-base leading-8 text-ink/68">{bookDisplay(selectedBook, script).description}</p>
                  {selectedBook.note && (
                    <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <Icon name="sparkle" className="mr-2" />
                      {selectedBook.note}
                    </p>
                  )}
                  {selectedBook.originalName && (
                    <p className="mt-4 text-sm text-ink/50">
                      {t('fileLabel', script)}: <strong>{selectedBook.originalName}</strong>
                      {selectedBook.fileSize != null
                        ? ` · ${formatSize(selectedBook.fileSize)}`
                        : ''}
                    </p>
                  )}

                  {isPdf && (
                    <>
                      <button
                        type="button"
                        onClick={() => setViewingPdf(selectedBook)}
                        className="mt-8 inline-flex w-full items-center justify-center gap-2 qp-btn-primary !rounded-2xl uppercase tracking-wide"
                      >
                        <Icon name="book" className="text-xl" /> {t('readPdf', script)}
                      </button>
                      <a
                        href={bookFileUrl(selectedBook.id, {
                          download: true,
                          fileAccess: selectedBook.fileAccess,
                        })}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 qp-btn-ghost text-teal-900"
                      >
                        {t('downloadPdf', script)}
                      </a>
                    </>
                  )}

                  {isDoc && (
                    <>
                      <a
                        href={bookFileUrl(selectedBook.id, {
                          download: true,
                          fileAccess: selectedBook.fileAccess,
                        })}
                        className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-700 px-6 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-sky-900/20 transition-all hover:-translate-y-0.5"
                      >
                        <Icon name="scroll" className="text-xl" /> {t('downloadDoc', script)}
                      </a>
                      <p className="mt-3 text-center text-xs text-ink/45">
                        {t('docHint', script)}
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          </article>
        </section>
      </DictShell>
    );
  }

  return (
    <PageGate status={status} error={listError} onRetry={reload} backHref="/" backLabel={t('homeBack', script)}>
    <DictShell className="pt-24 pb-24">
      <section className="relative mx-auto max-w-5xl px-6 pt-8 md:px-10">
        <PageEnter>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70">
              {t('litHeritage', script)}
            </p>
            <h1 className="mb-3 font-display text-4xl tracking-tight text-ink md:text-5xl">
              {t('books', script)}
            </h1>
          </div>
          <ScriptToggle
            value={script}
            onChange={setScript}
            className="mt-2"
          />
        </div>
        <p className="mb-8 max-w-xl text-lg leading-relaxed text-ink/60">
          {t('booksIntro', script)}
        </p>

        {showFeaturedStrip ? (
          <div className="mb-10">
            <div className="qp-section-head mb-3">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-teal-800/65">
                  {t('featuredBooks', script)}
                </p>
                <p className="mt-1 text-sm text-ink/50">{t('featuredBooksDesc', script)}</p>
              </div>
              <Link to="/literature" className="qp-chip text-teal-900 no-underline">
                {t('literatureBack', script)}
                <AnimChevron count={2} className="opacity-50" />
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredBooks.map((book) => {
                const disp = bookDisplay(book, script);
                return (
                  <li key={book.id}>
                    <button
                      type="button"
                      onClick={() => openBook(book)}
                      className="group flex w-full items-center gap-3 qp-card p-3 text-left transition hover:-translate-y-0.5 hover:border-teal-700/25"
                    >
                      <BookCover book={book} compact script={script} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-lg text-ink group-hover:text-teal-900">
                          {disp.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink/45">{disp.author}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wide text-teal-800/70">
                          {t('startThisBook', script)}
                          <AnimChevron count={2} className="opacity-60" />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {(continueBook || readingMeta.streak > 0) && (
          <div className="mb-8 rounded-2xl border border-sky-600/15 bg-sky-50/50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {continueBook ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Link
                    to={continueBook.href}
                    className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-sky-800 px-4 py-2 text-sm font-semibold text-white`}
                  >
                    <Icon name="book" />
                    {text(KAA.continueBook)}
                    {continueBook.percent != null ? (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                        {text(KAA.continueBookPct).replace(
                          '{n}',
                          String(Math.round(continueBook.percent))
                        )}
                      </span>
                    ) : null}
                    <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                  </Link>
                  <button
                    type="button"
                    onClick={abandonBookContinue}
                    className="rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink/55 hover:text-teal-900"
                  >
                    {text(KAA.bookAbandon)}
                  </button>
                </span>
              ) : null}
              {readingMeta.streak > 0 && (
                <Link
                  to={continueBook?.href || keepStreakHref}
                  className={`inline-flex items-center gap-1.5 rounded-full border border-amber-400/60 bg-amber-100 px-3.5 py-1.5 text-xs font-bold text-amber-950 ${anim.streakFlame}`}
                >
                  <span className={anim.streakDot} aria-hidden />
                  {text(KAA.readingBrowseStreakCta).replace('{n}', String(readingMeta.streak))}
                </Link>
              )}
            </div>
            {continueBook ? (
              <>
                <p className="mb-2 mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                  {text(KAA.readingFinishFree)}
                </p>
                <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="start" className="mt-0" compact />
                {!isAuthenticated ? (
                  <GuestSoftContinue
                    className="mt-3 text-left"
                    titleKey={null}
                    bodyKey="authGuestFreeBody"
                    compact
                  />
                ) : null}
              </>
            ) : null}
          </div>
        )}

        {!continueBook && readingMeta.streak === 0 && books.length > 0 && (
          <div className="mb-8 qp-surface px-4 py-4">
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/60">
              {text(KAA.readingColdEyebrow)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-4 py-2 text-xs font-bold text-white`}
              >
                <Icon name="book" /> {text(KAA.readingColdPick)}
              </button>
              <Link
                to="/jumbaqlar"
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-950"
              >
                <Icon name="sparkle" /> {t('jumbaqlar', script)}
              </Link>
            </div>
            <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
              {text(KAA.readingFinishFree)}
            </p>
            <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="start" className="mt-2" compact />
          </div>
        )}

        <label className="relative mb-6 block max-w-2xl">
          <span className="sr-only">{t('searchBook', script)}</span>
          <Icon
            name="search"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-ink/40"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchBookPlaceholder', script)}
            className="w-full qp-card qp-card--static py-4 pl-12 pr-4 text-ink shadow-sm placeholder:text-ink/45 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-600/10"
            autoComplete="off"
          />
        </label>

        <div className="mb-10 flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenre(genre === g ? '' : g)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                genre === g
                  ? 'bg-teal-900 text-parchment'
                  : 'border border-ink/[0.06] bg-white/40 text-ink/65 hover:bg-white/70'
              }`}
            >
              {genreLabel(g, script) || g}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-center text-sm text-rose-800">
            {error}
          </p>
        )}

        {filtered.length === 0 && (
          <div className="mb-8 qp-surface border-dashed px-6 py-10 text-center">
            <p className="text-ink/55">
              {query
                ? `“${query}” ${t('nothingByQuery', script)}`
                : t('booksNotFound', script)}
            </p>
            <p className="mt-2 text-sm text-ink/45">
              {text(query ? KAA.booksQueryEmptyFree : KAA.readingColdEmptyHint)}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-900 px-4 py-2 text-xs font-bold text-white`}
                >
                  {text(KAA.booksClearSearch)}
                </button>
              )}
              <Link
                to="/tutor/practice?from=reading"
                className={`${query ? '' : anim.shine} inline-flex items-center gap-1.5 rounded-full ${
                  query
                    ? 'border border-teal-700/25 bg-white text-teal-950'
                    : 'bg-teal-900 text-white'
                } px-4 py-2 text-xs font-bold`}
              >
                <Icon name="bolt" /> {text(KAA.practiceNav)}
              </Link>
            </div>
            <FreePlayCtaRow
              links={FOOTER_FREE_LINKS}
              justify="center"
              className="mt-3"
              compact
            />
            {!isAuthenticated ? (
              <GuestSoftContinue
                className="mx-auto mt-3 max-w-md text-left"
                titleKey={null}
                bodyKey="authGuestFreeBody"
                compact
              />
            ) : null}
          </div>
        )}

        <div ref={listRef} className="grid scroll-mt-28 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((book, index) => {
            const bp = progress[book.id];
            const disp = bookDisplay(book, script);
            return (
              <button
                key={book.id}
                type="button"
                onClick={() => openBook(book)}
                style={{ animationDelay: `${index * 0.07}s` }}
                className="quiz-card-shine animate-dict-row group qp-card p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:bg-white/85 hover:shadow-[0_24px_55px_-28px_rgba(28,42,36,0.5)]"
              >
                <div className="mb-5 flex justify-center transition-transform duration-300 group-hover:-translate-y-1">
                  <BookCover book={book} compact script={script} />
                </div>
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex rounded-full bg-teal-100/80 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.13em] text-teal-900">
                    {genreLabel(book.genre, script) || book.genre}
                  </span>
                  <span className="inline-flex qp-chip text-teal-900">
                    {sourceLabel(book.sourceType, script)}
                  </span>
                  {book.sourceType === 'text' && bp?.done && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.13em] text-emerald-800">
                      <Icon name="check" /> {t('readDoneBadge', script)}
                    </span>
                  )}
                  {book.sourceType === 'text' && bp && !bp.done && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.13em] text-amber-800">
                      <Icon name="clock" /> {bp.section + 1}{t('inSectionSuffix', script)}
                    </span>
                  )}
                </span>
                <h2 className="mt-3 font-display text-2xl tracking-tight text-ink transition-colors group-hover:text-teal-900">
                  {disp.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-teal-900">{disp.author}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink/55">
                  {disp.description}
                </p>
                <span className="mt-5 flex items-center justify-between border-t border-ink/[0.07] pt-4 text-xs text-ink/45">
                  <span>{book.years || '—'}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-teal-800">
                    {t('fullView', script)} <AnimChevron count={2} className="opacity-70" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-12 text-sm leading-relaxed text-ink/55">
          {t('booksFooterHint', script)}
        </p>
        </PageEnter>
      </section>
    </DictShell>
    </PageGate>
  );
}
