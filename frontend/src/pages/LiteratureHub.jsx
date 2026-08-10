import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ScriptToggle from '../components/literature/ScriptToggle';
import { t, genreLabel, sourceLabel } from '../components/literature/litLabels';
import {
  getContinueBook,
  pickWriterName,
} from '../components/literature/litUtils';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchWriters } from '../api/literature';
import { fetchJumbaqCategories } from '../api/jumbaqlar';
import { fetchBooks } from '../api/books';
import { AnimIconDivider, AnimChevron, anim, PageEnter } from '../animations';
import { MotionDiv, Stagger } from '../animations/Motion';
import { slideUp, staggerFast } from '../animations/motionVariants';
import { getJumbaqRevealMeta, getContinueJumbaq } from '../lib/jumbaqProgress';
import { getReadingLessonMeta } from '../lib/readingProgress';
import {
  getReadingLessonSrsMeta,
  hydrateReadingLessonSrsFromServer,
} from '../lib/readingLessonSrs';
import { KAA } from '../i18n/kaa';
import useResumeTick from '../hooks/useResumeTick';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { useAuth } from '../contexts/AuthContext';
import { pickFeaturedBooks } from '../data/featuredBooks';

function bookDisplay(book, script) {
  if (!book) return { title: '', author: '' };
  if (script === 'latin') {
    return {
      title: book.titleLatin || book.title || '',
      author: book.authorLatin || book.author || '',
    };
  }
  return {
    title: book.titleCyrillic || book.titleOriginal || book.title || '',
    author: book.authorCyrillic || book.authorOriginal || book.author || '',
  };
}

const COVER_THEMES = {
  dastan: 'from-amber-200 via-orange-100 to-rose-200 text-amber-950',
  klassik: 'from-teal-200 via-emerald-50 to-cyan-200 text-teal-950',
  zamanagoy: 'from-teal-200 via-cyan-50 to-emerald-100 text-teal-950',
  roman: 'from-sky-200 via-teal-50 to-cyan-100 text-teal-950',
  ertek: 'from-orange-200 via-amber-50 to-yellow-100 text-amber-950',
  other: 'from-stone-200 via-neutral-50 to-zinc-200 text-stone-950',
};

function FeaturedBookCover({ book, script }) {
  const disp = bookDisplay(book, script);
  return (
    <div
      className={`relative h-40 w-full overflow-hidden rounded-2xl bg-gradient-to-br shadow-[0_18px_32px_-22px_rgba(28,42,36,0.55)] ${
        COVER_THEMES[book.genre] || COVER_THEMES.other
      }`}
    >
      <span className="absolute -right-8 -top-7 h-24 w-24 rounded-full border-[14px] border-white/25" />
      <span className="absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-white/25" />
      <span className="relative flex h-full flex-col justify-between p-4">
        <span className="text-[0.55rem] font-bold uppercase tracking-[0.18em] opacity-55">
          {t('litHeritageCover', script)}
        </span>
        <span>
          <span className="block font-display text-xl leading-tight">{disp.title}</span>
          {disp.author ? (
            <span className="mt-1.5 block text-[0.7rem] font-semibold opacity-65">{disp.author}</span>
          ) : null}
        </span>
        <span className="text-[0.55rem] font-bold uppercase tracking-[0.16em] opacity-50">
          {book.sourceType
            ? sourceLabel(book.sourceType, script)
            : genreLabel(book.genre, script) || book.genre}
        </span>
      </span>
    </div>
  );
}

/** Kitapxana eshikleri — sózlik tiykarǵı menyuda. */
const LINKS = [
  {
    to: '/books',
    titleKey: 'books',
    descKey: 'booksCardDesc',
    icon: 'book',
    tone: 'from-teal-600 to-emerald-700',
  },
  {
    to: '/literature/qaraqalpaq-tili',
    titleKey: 'qaraqalpaqTili',
    descKey: 'qaraqalpaqTiliCardDesc',
    icon: 'grammar',
    tone: 'from-amber-500 to-orange-600',
  },
  {
    to: '/writers',
    titleKey: 'writersBack',
    descKey: 'writersCardDesc',
    icon: 'users',
    tone: 'from-amber-500 to-orange-600',
  },
  {
    to: '/literature/ertekler',
    titleKey: 'ertekler',
    descKey: 'erteklerCardDesc',
    icon: 'book',
    tone: 'from-orange-500 to-amber-600',
  },
  {
    to: '/literature/naqillar',
    titleKey: 'naqillar',
    descKey: 'naqillarCardDesc',
    icon: 'scroll',
    tone: 'from-rose-500 to-orange-600',
  },
  {
    to: '/jumbaqlar',
    titleKey: 'jumbaqlar',
    descKey: 'jumbaqCardDesc',
    icon: 'sparkle',
    tone: 'from-sky-500 to-teal-600',
  },
];

export default function LiteratureHub() {
  const { script, setScript, text } = useUiScript();
  const { isAuthenticated } = useAuth();

  usePageMeta(t('litCenter', script), t('litHubIntro', script));

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle(
        {
          books: async () => {
            const res = await fetchBooks();
            return res.books || [];
          },
          writers: async () => {
            const res = await fetchWriters({ page: 1, limit: 8 });
            return {
              items: res.writers || res.items || [],
              total: res.total ?? res.writers?.length ?? 0,
            };
          },
        },
        {
          jumbaq: async () => {
            const res = await fetchJumbaqCategories();
            const cats = res.categories || res.items || [];
            const sum = cats.reduce((n, c) => n + (Number(c.count) || 0), 0);
            return { cats, total: sum || res.total || cats.length };
          },
        }
      ),
    { deps: [] }
  );

  const books = data?.books || [];
  const featuredBooks = useMemo(() => pickFeaturedBooks(books, 6), [books]);
  const primaryBook = featuredBooks[0] || null;
  const writersBundle = data?.writers || { items: [], total: 0 };
  const featuredWriters = (writersBundle.items || []).slice(0, 6);
  const writerCount = writersBundle.total;
  const jumbaqBundle = data?.jumbaq || { cats: [], total: null };
  const jumbaqCats = (jumbaqBundle.cats || []).slice(0, 4);
  const jumbaqCount = jumbaqBundle.total;
  const bookCount = books.length;
  const jumbaqMeta = useMemo(() => getJumbaqRevealMeta(), []);
  const resumeTick = useResumeTick();
  const continueJumbaq = useMemo(() => getContinueJumbaq(), [resumeTick]);
  const readingMeta = useMemo(() => getReadingLessonMeta(), [resumeTick]);
  const readingSrs = useMemo(() => getReadingLessonSrsMeta(), [resumeTick]);
  const continueBook = useMemo(() => getContinueBook(), [resumeTick]);

  useEffect(() => {
    hydrateReadingLessonSrsFromServer().catch(() => {});
  }, []);

  const continueLearnHref =
    readingMeta.bookId &&
    `/books/${encodeURIComponent(readingMeta.bookId)}/learn${
      readingMeta.sectionIndex != null ? `?section=${readingMeta.sectionIndex}` : ''
    }`;
  const dueLearnHref = readingSrs.href;
  const primaryReadHref = primaryBook
    ? `/books/${encodeURIComponent(primaryBook.id)}/read`
    : '/books';
  const cold = Boolean(
    readingMeta.practiceCount === 0 &&
      readingMeta.streak === 0 &&
      jumbaqMeta.streak === 0 &&
      jumbaqMeta.todayCount === 0 &&
      !continueBook &&
      !continueLearnHref &&
      !dueLearnHref &&
      !continueJumbaq
  );

  const heroCta = (() => {
    if (continueBook) {
      return {
        href: continueBook.href,
        icon: 'book',
        label: text(KAA.continueBook),
        detail:
          continueBook.percent != null
            ? text(KAA.continueBookPct).replace(
                '{n}',
                String(Math.round(continueBook.percent))
              )
            : null,
      };
    }
    if (continueJumbaq) {
      return {
        href: continueJumbaq.href,
        icon: 'sparkle',
        label: text(KAA.continueJumbaq),
        detail: continueJumbaq.label || null,
      };
    }
    if (primaryBook) {
      return {
        href: primaryReadHref,
        icon: 'book',
        label: t('hubPrimaryCta', script),
        detail: bookDisplay(primaryBook, script).title || null,
      };
    }
    return {
      href: '/books',
      icon: 'book',
      label: t('hubPrimaryCta', script),
      detail: null,
    };
  })();

  return (
    <ProtectedContent>
    <PageGate status={status} error={error} onRetry={reload} backHref="/" backLabel={t('homeBack', script)}>
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-4xl px-6 pt-8 md:px-10">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink/45 transition-colors hover:text-teal-900"
            >
              <Icon name="left" /> {t('homeBack', script)}
            </Link>
            <ScriptToggle value={script} onChange={setScript} />
          </div>

          <PageEnter>
          <div className="mb-12">
            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-teal-800/60">
              {t('litHeritageCover', script)}
            </p>
            <h1 className="font-display text-4xl tracking-tight text-ink md:text-6xl">
              {t('litCenter', script)}
            </h1>
            <AnimIconDivider amber className="mt-3 mb-1" />
            <p className="mt-4 max-w-xl text-base leading-7 text-ink/60">
              {t('litHubIntro', script)}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-2">
              <Link
                to={heroCta.href}
                className={`${anim.shine} qp-btn-primary`}
              >
                <Icon name={heroCta.icon} />
                <span className="truncate">{heroCta.label}</span>
                {heroCta.detail ? (
                  <span className="max-w-[11rem] truncate opacity-90">· {heroCta.detail}</span>
                ) : null}
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              <Link
                to="/tutor/practice?from=reading"
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-5 py-3 text-sm font-bold text-teal-950"
              >
                <Icon name="bolt" /> {text(KAA.practiceNav)}
              </Link>
            </div>

            {!cold && !isAuthenticated ? (
              <GuestSoftContinue
                className="mt-6 text-left"
                titleKey={null}
                bodyKey="authGuestFreeBody"
                compact
              />
            ) : null}
          </div>

          {bookCount === 0 && featuredWriters.length === 0 && jumbaqCats.length === 0 && (
            <div className="mb-10 qp-surface motion-rise border-dashed px-6 py-10 text-center">
              <p className="font-display text-xl text-ink/60">{text(KAA.litHubEmpty)}</p>
              <p className="mt-2 text-sm text-ink/45">{text(KAA.learnPracticeBody)}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link
                  to="/dictionary"
                  className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                >
                  <Icon name="book" /> {text(KAA.sozlik)}
                </Link>
                <Link
                  to="/games"
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                >
                  <Icon name="trophy" /> {text(KAA.oyinlar)}
                </Link>
                <Link
                  to="/tutor/practice"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                >
                  <Icon name="bolt" /> {text(KAA.practiceNav)}
                </Link>
              </div>
            </div>
          )}

          {/* Below fold — soft counts + book/jumbaq resume (no dars/tutor) */}
          <div className="mb-10 flex flex-wrap gap-3 text-xs font-semibold text-ink/50">
            <span className="qp-chip">
              {bookCount} {t('bookUnit', script)}
            </span>
            {writerCount != null && (
              <span className="qp-chip">
                {writerCount} {t('writerUnit', script)}
              </span>
            )}
            {jumbaqCount != null && (
              <span className="qp-chip">
                {jumbaqCount} {t('jumbaqUnit', script)}
              </span>
            )}
            {continueBook && heroCta.href !== continueBook.href && (
              <Link
                to={continueBook.href}
                className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full border border-sky-600/30 bg-sky-50 px-3 py-1.5 text-sky-950`}
              >
                <Icon name="book" />
                {text(KAA.continueBook)}
              </Link>
            )}
            {continueJumbaq && heroCta.href !== continueJumbaq.href && (
              <Link
                to={continueJumbaq.href}
                className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full border border-sky-600/30 bg-sky-50 px-3 py-1.5 text-sky-950`}
              >
                <Icon name="sparkle" />
                {text(KAA.continueJumbaq)}
              </Link>
            )}
            {(jumbaqMeta.streak > 0 || jumbaqMeta.todayCount > 0) && (
              <Link
                to={continueJumbaq?.href || '/jumbaqlar'}
                className={`inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-50 px-3 py-1.5 text-amber-950 ${anim.streakFlame}`}
              >
                <span className={anim.streakDot} aria-hidden />
                {t('jumbaqStreakCta', script).replace(
                  '{n}',
                  String(jumbaqMeta.streak || jumbaqMeta.todayCount || 1)
                )}
              </Link>
            )}
            {readingMeta.streak > 0 && !continueBook && (
              <Link
                to="/books"
                className={`inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-50 px-3 py-1.5 text-amber-950 ${anim.streakFlame}`}
              >
                <span className={anim.streakDot} aria-hidden />
                {text(KAA.readingBrowseStreakCta).replace('{n}', String(readingMeta.streak))}
              </Link>
            )}
          </div>

          {featuredBooks.length > 0 && (
            <div className="mb-12">
              <div className="qp-section-head mb-2">
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-teal-800/65">
                    {t('featuredBooks', script)}
                  </p>
                  <p className="mt-1 max-w-md text-sm text-ink/50">
                    {t('featuredBooksDesc', script)}
                  </p>
                </div>
                <Link to="/books" className="qp-chip text-teal-900 no-underline">
                  {t('seeAllBooks', script)}
                  <AnimChevron count={2} className="opacity-50" />
                </Link>
              </div>
              <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredBooks.map((book) => {
                  const disp = bookDisplay(book, script);
                  return (
                    <li key={book.id}>
                      <Link
                        to={`/books/${encodeURIComponent(book.id)}`}
                        className="group block qp-card p-3.5 no-underline transition hover:-translate-y-0.5 hover:border-teal-700/25 hover:bg-white/90"
                      >
                        <FeaturedBookCover book={book} script={script} />
                        <span className="mt-3 flex items-center justify-between gap-2 px-0.5">
                          <span className="min-w-0">
                            <span className="block truncate font-display text-lg text-ink group-hover:text-teal-900">
                              {disp.title}
                            </span>
                            {disp.author ? (
                              <span className="text-xs text-ink/45">{disp.author}</span>
                            ) : null}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 text-[0.65rem] font-bold uppercase tracking-wide text-teal-800/70">
                            {t('startThisBook', script)}
                            <AnimChevron count={2} className="opacity-60" />
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="mb-4">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink/40">
              {t('librarySections', script)}
            </p>
          </div>

          <Stagger variants={staggerFast} className="mb-12 grid gap-4 sm:grid-cols-2">
            {LINKS.map((item) => (
              <MotionDiv key={item.titleKey || item.to} variants={slideUp}>
                <Link
                  to={item.to}
                  className="qp-door group relative block overflow-hidden rounded-[1.75rem] p-6"
                >
                  <span className={`qp-icon-tile mb-5 bg-gradient-to-br ${item.tone}`}>
                    <Icon name={item.icon} />
                  </span>
                  <h2 className="font-display text-2xl tracking-tight text-ink group-hover:text-teal-900">
                    {t(item.titleKey, script)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink/55">{t(item.descKey, script)}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-800/70">
                    {t('openWord', script)}
                    <AnimChevron count={2} className="opacity-70" />
                  </span>
                </Link>
              </MotionDiv>
            ))}
          </Stagger>

          {featuredWriters.length > 0 && (
            <div className="mb-10">
              <div className="qp-section-head mb-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-800/60">
                  {t('featuredWriters', script)}
                </p>
                <Link
                  to="/writers"
                  className="qp-chip text-amber-950 no-underline"
                >
                  {t('seeAllWriters', script)}
                  <AnimChevron count={2} className="opacity-50" />
                </Link>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {featuredWriters.map((w) => {
                  const name = pickWriterName(w, script);
                  const slug = w.slug || w.id;
                  return (
                    <li key={slug}>
                      <Link
                        to={`/writers/${encodeURIComponent(slug)}`}
                        className="group flex items-center gap-3 qp-card px-4 py-3 transition hover:-translate-y-0.5 hover:border-amber-600/25 hover:bg-amber-50/40"
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 font-display text-lg text-white">
                          {(name || '?').charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-display text-lg text-ink group-hover:text-amber-950">
                          {name}
                        </span>
                        <AnimChevron count={2} className="opacity-40 group-hover:opacity-90" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {jumbaqCats.length > 0 && (
            <div className="mb-4">
              <div className="qp-section-head mb-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sky-900/55">
                  {t('jumbaqPeek', script)}
                </p>
                <Link
                  to="/jumbaqlar"
                  className="qp-chip text-sky-950 no-underline"
                >
                  {t('jumbaqlar', script)}
                  <AnimChevron count={2} className="opacity-50" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {jumbaqCats.map((c) => {
                  const label = c.name || c.title || c.topar || c.label || c.slug || c.id;
                  const catKey = c.topar ?? c.slug ?? c.id ?? label;
                  const href = `/jumbaqlar?cat=${encodeURIComponent(String(catKey))}`;
                  return (
                    <Link
                      key={String(catKey)}
                      to={href}
                      className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-50/80 px-3.5 py-1.5 text-xs font-bold text-sky-950"
                    >
                      <Icon name="sparkle" />
                      {label}
                      {c.count != null ? (
                        <span className="rounded-full bg-sky-200/70 px-1.5 py-0.5 text-[0.65rem]">
                          {c.count}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          </PageEnter>
        </section>
      </DictShell>
    </PageGate>
    </ProtectedContent>
  );
}
