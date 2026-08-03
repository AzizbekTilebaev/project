import { Link } from 'react-router-dom';
import Icon from '../Icon';
import { t } from './litLabels';
import { AnimChevron, anim } from '../../animations';

/**
 * Ijod inventarı: kutubxonada / atalǵan / bos.
 */
export default function CreativeWorksPanel({
  creativeWorks = [],
  books = [],
  script = 'cyrillic',
  readingPracticeCount = 0,
}) {
  const STATUS = {
    in_library: {
      label: t('statusInLibrary', script),
      className: 'bg-emerald-100/90 text-emerald-900',
    },
    mentioned_only: {
      label: t('statusMentioned', script),
      className: 'bg-amber-100/90 text-amber-950',
    },
    not_imported: {
      label: t('statusMentioned', script),
      className: 'bg-amber-100/90 text-amber-950',
    },
  };

  const libraryBooks = Array.isArray(books) ? books : [];
  const bookTitleKeys = new Set(
    libraryBooks.flatMap((b) =>
      [b.titleOriginal, b.titleCyrillic, b.titleLatin, b.title]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase().replace(/\s+/g, ' ').trim())
    )
  );
  const works = (Array.isArray(creativeWorks) ? creativeWorks : []).filter((w) => {
    const keys = [w.titleOriginal, w.titleCyrillic, w.titleLatin, w.title]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase().replace(/\s+/g, ' ').trim());
    return !keys.some((k) => bookTitleKeys.has(k));
  });

  if (!works.length && !libraryBooks.length) {
    return (
      <section className="mt-10" aria-label={t('works', script)}>
        <h2 className="mb-4 font-display text-2xl tracking-tight text-ink">
          {t('works', script)}
        </h2>
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white/40 px-5 py-8 text-center">
          <p className="text-sm text-ink/45">{t('noWorks', script)}</p>
          <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
            {t('worksEmptyFree', script)}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/books"
              className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-4 py-2 text-xs font-bold text-white`}
            >
              <Icon name="book" /> {t('writerNextBrowse', script)}
            </Link>
            <Link
              to="/tutor/practice?from=reading"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
            >
              <Icon name="bolt" /> {t('practiceVocab', script)}
            </Link>
            <Link
              to="/jumbaqlar"
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-950"
            >
              <Icon name="sparkle" /> {t('writerNextJumbaq', script)}
            </Link>
            <Link
              to="/quiz"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
            >
              <Icon name="trophy" /> {t('worksEmptyQuiz', script)}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const firstId = libraryBooks[0]?.id || libraryBooks[0]?.bookId;

  return (
    <section className="mt-10" aria-label={t('works', script)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl tracking-tight text-ink">{t('works', script)}</h2>
        <div className="flex flex-wrap gap-2">
          {firstId ? (
            <Link
              to={`/books/${encodeURIComponent(firstId)}`}
              className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white`}
            >
              <Icon name="book" /> {t('startReading', script)}
              <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
            </Link>
          ) : null}
          {readingPracticeCount > 0 ? (
            <Link
              to="/tutor/practice?from=reading"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-950"
            >
              <Icon name="bolt" /> {t('practiceVocab', script)}
              <span className="rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[0.65rem]">
                {readingPracticeCount}
              </span>
            </Link>
          ) : (
            <Link
              to="/tutor/practice?from=reading"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
            >
              <Icon name="bolt" /> {t('practiceVocab', script)}
            </Link>
          )}
          <Link
            to="/quiz"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50/80 px-3.5 py-1.5 text-xs font-bold text-amber-950"
          >
            <Icon name="trophy" /> {t('worksEmptyQuiz', script)}
          </Link>
        </div>
      </div>

      {libraryBooks.length > 0 ? (
        <div className="mb-6">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-ink/40">
            {t('inLibrary', script)}
          </h3>
          <ul className="space-y-2.5">
            {libraryBooks.map((book, idx) => {
              const id = book.id || book.bookId;
              const title =
                script === 'latin'
                  ? book.titleLatin || book.title
                  : book.titleCyrillic || book.titleOriginal || book.title;
              const primary = idx === 0;
              return (
                <li key={id}>
                  <Link
                    to={`/books/${encodeURIComponent(id)}`}
                    className={`group flex items-center gap-4 rounded-2xl border px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-teal-600/30 hover:bg-teal-50/40 ${
                      primary
                        ? 'border-teal-600/25 bg-teal-50/50 ring-1 ring-teal-500/15'
                        : 'border-ink/[0.07] bg-white/55'
                    }`}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                      <Icon name="book" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg text-ink group-hover:text-teal-900">
                        {title}
                      </span>
                      <span className="mt-1 inline-flex rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-[0.65rem] font-bold text-emerald-900">
                        {t('statusInLibrary', script)}
                      </span>
                    </span>
                    <AnimChevron count={2} className="opacity-35 group-hover:opacity-90 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {works.length > 0 ? (
        <ul className="space-y-2.5">
          {works.map((w) => {
            const title =
              script === 'latin'
                ? w.titleLatin || w.title
                : w.titleCyrillic || w.titleOriginal || w.title;
            const st = STATUS[w.availability] || STATUS.mentioned_only;
            const yearLabel =
              script === 'latin'
                ? w.yearLabelLatin || w.yearLabel
                : w.yearLabelCyrillic || w.yearLabel;
            const workType =
              script === 'latin'
                ? w.workTypeLatin || w.workType
                : w.workTypeCyrillic || w.workType;
            const href =
              w.availability === 'in_library' && w.linkedBookId
                ? w.linkedSectionIndex != null
                  ? `/books/${encodeURIComponent(w.linkedBookId)}/read?section=${w.linkedSectionIndex}`
                  : `/books/${encodeURIComponent(w.linkedBookId)}`
                : null;
            const inner = (
              <>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-ink/[0.06] text-ink/55">
                  <Icon name="book" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg text-ink">{title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold ${st.className}`}
                    >
                      {st.label}
                    </span>
                    {yearLabel ? (
                      <span className="text-xs text-ink/40">{yearLabel}</span>
                    ) : null}
                    {workType ? (
                      <span className="text-xs text-ink/35">{workType}</span>
                    ) : null}
                  </span>
                </span>
                {href ? <AnimChevron count={2} className="opacity-35 group-hover:opacity-90 shrink-0" /> : null}
              </>
            );
            return (
              <li key={w.id || w.slug || title}>
                {href ? (
                  <Link
                    to={href}
                    className="group flex items-center gap-4 rounded-2xl border border-ink/[0.07] bg-white/55 px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-teal-600/30 hover:bg-teal-50/40"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 rounded-2xl border border-ink/[0.07] bg-white/45 px-4 py-3.5">
                    {inner}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
