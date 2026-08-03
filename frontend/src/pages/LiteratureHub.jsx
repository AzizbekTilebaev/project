import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ScriptToggle from '../components/literature/ScriptToggle';
import { t } from '../components/literature/litLabels';
import {
  getContinueBook,
  pickWriterName,
} from '../components/literature/litUtils';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchWriters } from '../api/literature';
import { fetchJumbaqCategories } from '../api/jumbaqlar';
import { fetchBooks } from '../api/books';
import { AnimIconDivider, AnimChevron, anim } from '../animations';
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

const LINKS = [
  {
    to: '/dictionary',
    titleKey: 'dictCard',
    descKey: 'dictCardDesc',
    icon: 'book',
    tone: 'from-teal-600 to-cyan-700',
    delay: '',
  },
  {
    to: '/books',
    titleKey: 'books',
    descKey: 'booksCardDesc',
    icon: 'book',
    tone: 'from-teal-600 to-emerald-700',
    delay: 'animate-dict-rise-delay',
  },
  {
    to: '/writers',
    titleKey: 'writersBack',
    descKey: 'writersCardDesc',
    icon: 'users',
    tone: 'from-amber-500 to-orange-600',
    delay: 'animate-dict-rise-delay-2',
  },
  {
    to: '/jumbaqlar',
    titleKey: 'jumbaqlar',
    descKey: 'jumbaqCardDesc',
    icon: 'sparkle',
    tone: 'from-sky-500 to-teal-600',
    delay: 'animate-dict-rise-delay-2',
  },
  {
    to: '/literature/naqillar',
    titleKey: 'naqillar',
    descKey: 'naqillarCardDesc',
    icon: 'scroll',
    tone: 'from-rose-500 to-orange-600',
    delay: 'animate-dict-rise-delay-2',
  },
  {
    to: '/literature/ertekler',
    titleKey: 'ertekler',
    descKey: 'erteklerCardDesc',
    icon: 'book',
    tone: 'from-orange-500 to-amber-600',
    delay: 'animate-dict-rise-delay-2',
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
  const featuredBooks = books.slice(0, 6);
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

          <div className="animate-dict-rise mb-12">
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

            <div className="mt-7">
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
            <div className="mb-10">
              <div className="qp-section-head mb-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
                  {t('featuredBooks', script)}
                </p>
                <Link
                  to="/books"
                  className="qp-chip text-teal-900 no-underline"
                >
                  {t('seeAllBooks', script)}
                  <AnimChevron count={2} className="opacity-50" />
                </Link>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {featuredBooks.map((book) => {
                  const disp = bookDisplay(book, script);
                  return (
                    <li key={book.id}>
                      <Link
                        to={`/books/${encodeURIComponent(book.id)}`}
                        className="group flex items-center justify-between gap-3 qp-card px-4 py-3.5 transition hover:-translate-y-0.5 hover:border-teal-700/25 hover:bg-white/90"
                      >
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
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

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
            <div className="mb-10">
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

          <div className="grid gap-4 sm:grid-cols-2">
            {LINKS.map((item) => (
              <Link
                key={item.titleKey || item.to}
                to={item.to}
                className={`qp-door group animate-dict-rise ${item.delay} relative overflow-hidden rounded-[1.75rem] p-6`}
              >
                <span
                  className={`qp-icon-tile mb-5 bg-gradient-to-br ${item.tone}`}
                >
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
            ))}
          </div>
        </section>
      </DictShell>
    </PageGate>
    </ProtectedContent>
  );
}
