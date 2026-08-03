import { Link, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ProtectedContent from '../components/ProtectedContent';
import ScriptToggle from '../components/literature/ScriptToggle';
import SectionTape from '../components/literature/SectionTape';
import {
  pickWriterName,
  readBookProgressMap,
} from '../components/literature/litUtils';
import { t, genreLabel } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchBookById, bookFileUrl } from '../api/books';
import { fetchBookLiterature } from '../api/literature';
import { AnimChevron, anim } from '../animations';
import { KAA } from '../i18n/kaa';
import { getReadingLessonMeta } from '../lib/readingProgress';
import {
  getReadingLessonSrsMeta,
  hydrateReadingLessonSrsFromServer,
  readingLessonHref,
} from '../lib/readingLessonSrs';
import { useEffect, useMemo } from 'react';
import useResumeTick from '../hooks/useResumeTick';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { useAuth } from '../contexts/AuthContext';

export default function BookDetail() {
  const { id } = useParams();
  const { script, setScript, text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const resumeTick = useResumeTick();
  const readingMeta = useMemo(() => getReadingLessonMeta(), [resumeTick]);
  const dueLesson = useMemo(
    () => getReadingLessonSrsMeta({ bookId: id }).nextDue,
    [id, resumeTick]
  );
  const dueLearnHref = dueLesson ? readingLessonHref(dueLesson) : null;
  const showReadingMashq =
    readingMeta.practiceCount > 0 &&
    (!readingMeta.bookId || String(readingMeta.bookId) === String(id));

  // Cross-device due CTA — hub/Books menen bir xil hydrate
  useEffect(() => {
    hydrateReadingLessonSrsFromServer().catch(() => {});
  }, [id]);

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle(
        {
          bookPayload: () => fetchBookById(id),
        },
        {
          literature: () => fetchBookLiterature(id, { script }),
        }
      ),
    { deps: [id, script], enabled: Boolean(id) }
  );

  const book = data?.bookPayload?.book
    ? { ...data.bookPayload.book, fileAccess: data.bookPayload.fileAccess || null }
    : null;
  const lit = data?.literature || {};
  const pieces = lit.pieces || [];
  const writers = lit.writers || book?.writers || [];
  const sections = book?.sections || [];
  const work = lit.work || null;

  const foldTitleKey = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['’ʻ`'´]/g, '')
      .replace(/а/g, 'a')
      .replace(/ә/g, 'a')
      .replace(/б/g, 'b')
      .replace(/в/g, 'v')
      .replace(/г/g, 'g')
      .replace(/ғ/g, 'g')
      .replace(/д/g, 'd')
      .replace(/е/g, 'e')
      .replace(/ё/g, 'e')
      .replace(/ж/g, 'j')
      .replace(/з/g, 'z')
      .replace(/и/g, 'i')
      .replace(/й/g, 'y')
      .replace(/к/g, 'k')
      .replace(/қ/g, 'q')
      .replace(/л/g, 'l')
      .replace(/м/g, 'm')
      .replace(/н/g, 'n')
      .replace(/ң/g, 'n')
      .replace(/о/g, 'o')
      .replace(/ө/g, 'o')
      .replace(/п/g, 'p')
      .replace(/р/g, 'r')
      .replace(/с/g, 's')
      .replace(/т/g, 't')
      .replace(/у/g, 'u')
      .replace(/ү/g, 'u')
      .replace(/ў/g, 'w')
      .replace(/ф/g, 'f')
      .replace(/х/g, 'x')
      .replace(/ҳ/g, 'h')
      .replace(/ц/g, 'c')
      .replace(/ч/g, 'ch')
      .replace(/ш/g, 'sh')
      .replace(/щ/g, 'sh')
      .replace(/ъ|ь/g, '')
      .replace(/ы/g, 'i')
      .replace(/э/g, 'e')
      .replace(/ю/g, 'yu')
      .replace(/я/g, 'ya')
      .replace(/[^a-z0-9]+/g, '');

  const toc = pieces.length
    ? pieces.map((p, i) => {
        const rawTitle = p.titleOriginal || p.title || p.name || '';
        const raw = foldTitleKey(rawTitle);
        const isAbout =
          i === 0 &&
          (/kitap haqqında|muqova|обложка|kitap haqqinda/i.test(rawTitle) ||
            (work &&
              [work.titleOriginal, work.titleLatin, work.title]
                .map(foldTitleKey)
                .filter((c) => c && c.length >= 4)
                .some((c) => c === raw || raw.includes(c) || c.includes(raw))));
        return {
          key: p.id || i,
          title: isAbout
            ? t('aboutBook', script)
            : script === 'latin'
              ? p.titleLatin || p.title || `${t('section', script)} ${i + 1}`
              : p.titleCyrillic ||
                p.titleOriginal ||
                p.title ||
                `${t('section', script)} ${i + 1}`,
          index: p.sectionIndex ?? p.sortOrder ?? i,
          kind: isAbout ? 'about' : 'piece',
        };
      })
    : sections.map((s, i) => ({
        key: i,
        title: s.title || `${t('section', script)} ${i + 1}`,
        index: i,
        kind: 'section',
      }));

  const progress = readBookProgressMap()[id] || null;
  const isText =
    book &&
    (book.sourceType === 'text' || (!book.sourceType && (sections.length || pieces.length)));

  // Latin / original juftlik — title_original haqiqiy asl
  const displayTitle =
    script === 'latin'
      ? work?.titleLatin || work?.title || book?.title
      : work?.titleCyrillic || work?.titleOriginal || work?.title || book?.title;
  const displayAuthor =
    script === 'latin'
      ? work?.authorLatin || work?.author || book?.author
      : work?.authorCyrillic || work?.authorOriginal || work?.author || book?.author;
  const displayDescription =
    script === 'latin'
      ? work?.descriptionLatin || work?.description || book?.description
      : work?.descriptionCyrillic ||
        work?.descriptionOriginal ||
        work?.description ||
        book?.description;

  usePageMeta(
    book?.title || text('Kitap'),
    book?.description || `${book?.author || ''} — ${text('oqıw hám mazmun')}`
  );

  const resumeSection =
    progress && !progress.done ? Number(progress.section ?? progress.sectionIndex) || 0 : 0;

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref="/books" backLabel={t('books', script)}>
      <DictShell className="pt-24 pb-24">
        <ProtectedContent>
          <section className="relative mx-auto max-w-3xl px-6 pt-8 md:px-10">
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <Link
                to="/books"
                className="inline-flex items-center gap-1.5 qp-chip text-ink/65 hover:text-teal-900"
              >
                <Icon name="left" /> {t('books', script)}
              </Link>
              <Link
                to="/literature"
                className="rounded-full border border-ink/10 bg-white/40 px-3 py-1.5 text-xs text-ink/45 hover:text-teal-900"
              >
                {t('literatureBack', script)}
              </Link>
              <ScriptToggle
                value={script}
                onChange={setScript}
                className="ml-auto"
              />
            </div>

            {!book ? (
              <div className="qp-surface border-dashed px-6 py-12 text-center">
                <p className="text-ink/55">{t('bookNotFound', script)}</p>
                <p className="mt-2 text-sm text-ink/45">{text(KAA.readingColdEmptyHint)}</p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <Link
                    to="/books"
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
                  >
                    <Icon name="book" /> {text(KAA.readingLandingCta)}
                  </Link>
                  <Link
                    to="/tutor/practice?from=reading"
                    className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                  >
                    <Icon name="bolt" /> {text(KAA.practiceNav)}
                  </Link>
                </div>
                {!isAuthenticated ? (
                  <GuestSoftContinue
                    className="mx-auto mt-4 max-w-md text-left"
                    titleKey={null}
                    bodyKey="authGuestFreeBody"
                    compact
                  />
                ) : null}
                <p className="mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                  {text(KAA.readingFinishFree)}
                </p>
                <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-2" compact />
              </div>
            ) : (
              <>
                <article className="animate-dict-rise overflow-hidden qp-surface shadow-[0_28px_70px_-35px_rgba(28,42,36,0.45)]">
                  <div className="bg-gradient-to-b from-white/80 to-teal-50/40 px-7 pb-8 pt-10 text-center md:px-10">
                    <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                      <span className="rounded-full bg-teal-100 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-900">
                        {genreLabel(book.genre, script) || book.genre || t('bookUnit', script)}
                      </span>
                      {book.workKind && (
                        <span className="rounded-full qp-chip text-teal-900">
                          {book.workKind}
                        </span>
                      )}
                    </div>
                    <h1 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
                      {displayTitle}
                    </h1>
                    <p className="mt-2 font-medium text-teal-900">{displayAuthor}</p>
                    {book.years ? (
                      <p className="mt-1 text-xs text-ink/45">{book.years}</p>
                    ) : null}
                  </div>

                  <div className="px-7 py-8 md:px-10">
                    {displayDescription ? (
                      <p className="text-base leading-8 text-ink/68">{displayDescription}</p>
                    ) : null}
                    {book.note ? (
                      <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <Icon name="sparkle" className="mr-2" />
                        {book.note}
                      </p>
                    ) : null}

                    {writers.length > 0 && (
                      <div className="mt-8">
                        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-ink/40">
                          {t('authors', script)}
                        </h2>
                        <ul className="flex flex-wrap gap-2">
                          {writers.map((w) => {
                            const slug = w.slug || w.id;
                            const label = pickWriterName(w, script);
                            return (
                              <li key={slug}>
                                <Link
                                  to={`/writers/${encodeURIComponent(slug)}`}
                                  className="inline-flex rounded-full border border-amber-600/20 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100"
                                >
                                  {label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {isText && (
                      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        {progress?.done ? (
                          <>
                            <Link
                              to={`/books/${encodeURIComponent(id)}/read${
                                resumeSection ? `?section=${resumeSection}` : ''
                              }`}
                              className={`${anim.shine} inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-teal-900/20 transition-all hover:-translate-y-0.5`}
                            >
                              <Icon name="book" className="text-xl" /> {t('readAgain', script)}
                            </Link>
                            {dueLearnHref ? (
                              <Link
                                to={dueLearnHref}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 transition hover:-translate-y-0.5"
                              >
                                <Icon name="grammar" /> {t('tutorNav', script)}
                              </Link>
                            ) : (
                              <Link
                                to={`/books/${encodeURIComponent(id)}/learn?section=${resumeSection || 0}`}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-teal-700/25 bg-teal-50/80 px-5 py-4 text-sm font-bold text-teal-950 transition hover:-translate-y-0.5"
                              >
                                <Icon name="grammar" /> {t('readerLearnCta', script)}
                              </Link>
                            )}
                            {showReadingMashq && (
                              <Link
                                to="/tutor/practice?from=reading"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 transition hover:-translate-y-0.5"
                              >
                                <Icon name="bolt" /> {text(KAA.readingBrowsePractice)}
                                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-xs">
                                  {readingMeta.practiceCount}
                                </span>
                              </Link>
                            )}
                          </>
                        ) : (
                          <>
                            <Link
                              to={`/books/${encodeURIComponent(id)}/read${
                                resumeSection ? `?section=${resumeSection}` : ''
                              }`}
                              className={`${anim.shine} inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-teal-900/20 transition-all hover:-translate-y-0.5`}
                            >
                              <Icon name="book" className="text-xl" />
                              {progress
                                ? `${t('continueReading', script)} — ${(resumeSection || 0) + 1}`
                                : t('startReading', script)}
                            </Link>
                            {dueLearnHref ? (
                              <Link
                                to={dueLearnHref}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 transition hover:-translate-y-0.5"
                              >
                                <Icon name="grammar" /> {t('tutorNav', script)}
                              </Link>
                            ) : (
                              <Link
                                to={`/books/${encodeURIComponent(id)}/learn?section=${resumeSection || 0}`}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-teal-700/25 bg-teal-50/80 px-5 py-4 text-sm font-bold text-teal-950 transition hover:-translate-y-0.5"
                              >
                                <Icon name="grammar" /> {t('tutorNav', script)}
                              </Link>
                            )}
                            {showReadingMashq && (
                              <Link
                                to="/tutor/practice?from=reading"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-50 px-5 py-4 text-sm font-bold text-amber-950 transition hover:-translate-y-0.5"
                              >
                                <Icon name="bolt" /> {text(KAA.readingBrowsePractice)}
                                <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-xs">
                                  {readingMeta.practiceCount}
                                </span>
                              </Link>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {book.hasFile && (
                      <div className="mt-6 flex flex-wrap gap-2">
                        <a
                          href={bookFileUrl(book.id, { fileAccess: book.fileAccess })}
                          target="_blank"
                          rel="noreferrer"
                          className="qp-chip text-teal-900"
                        >
                          {t('openFile', script)}
                        </a>
                        <a
                          href={bookFileUrl(book.id, {
                            download: true,
                            fileAccess: book.fileAccess,
                          })}
                          className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-900"
                        >
                          {t('download', script)}
                        </a>
                      </div>
                    )}
                  </div>
                </article>

                {toc.length > 0 && (
                  <section className="animate-dict-rise-delay mt-10">
                    <div className="mb-4 flex items-end justify-between gap-3">
                      <h2 className="font-display text-2xl tracking-tight text-ink">
                        {t('toc', script)}
                      </h2>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink/40">
                        <Icon name="film" /> {toc.length} {t('sectionsTape', script)}
                      </span>
                    </div>
                    <SectionTape
                      items={toc.map((item, i) => ({
                        key: item.key,
                        index: item.index ?? i,
                        title: item.title,
                        preview:
                          item.kind === 'about'
                            ? t('aboutBook', script)
                            : item.kind === 'piece'
                              ? t('kindWork', script)
                              : t('section', script),
                      }))}
                      progress={progress}
                      script={script}
                      getHref={(item) =>
                        `/books/${encodeURIComponent(id)}/read?section=${item.index}`
                      }
                    />
                    <Link
                      to={`/books/${encodeURIComponent(id)}/read?view=sections`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900 hover:underline"
                    >
                      {t('viewAllSections', script)} <AnimChevron count={2} className="opacity-70" />
                    </Link>
                  </section>
                )}
              </>
            )}
          </section>
        </ProtectedContent>
      </DictShell>
    </PageGate>
  );
}
