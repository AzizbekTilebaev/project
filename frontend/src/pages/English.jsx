import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, AnimChevron, anim, PageEnter, TabCrossfade } from '../animations';
import { ENGLISH_BOOKS, englishBookHtml } from '../lib/englishContent';

const PROSE = [
  'qoidalar-prose max-w-none text-[1.05rem] leading-relaxed text-ink/80',
  '[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-ink',
  '[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-xl [&_h3]:text-ink',
  '[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:font-display [&_h4]:text-lg [&_h4]:text-ink',
  '[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-1.5 [&_li]:marker:text-teal-800/50',
  '[&_strong]:font-semibold [&_strong]:text-ink',
  '[&_em]:text-ink/70',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-sky-700/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink/60',
  '[&_code]:rounded [&_code]:bg-sky-900/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-sky-950',
  '[&_hr]:my-8 [&_hr]:border-ink/10',
  '[&_table]:my-4 [&_table]:w-full [&_table]:text-left [&_table]:text-sm',
  '[&_th]:border-b [&_th]:border-ink/15 [&_th]:py-2 [&_th]:pr-3 [&_th]:font-semibold',
  '[&_td]:border-b [&_td]:border-ink/8 [&_td]:py-2 [&_td]:pr-3',
].join(' ');

function tabBtn(active) {
  return `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
    active
      ? 'bg-sky-800 text-white shadow-sm'
      : 'border border-ink/10 text-ink/65 hover:border-sky-700/30 hover:text-sky-900'
  }`;
}

export default function English() {
  const { text } = useUiScript();
  const [bookId, setBookId] = useState(ENGLISH_BOOKS[0].id);
  const book = ENGLISH_BOOKS.find((b) => b.id === bookId) || ENGLISH_BOOKS[0];
  const html = useMemo(() => englishBookHtml(book), [bookId]);

  usePageMeta(text(KAA.englishTitle), text(KAA.englishLead));

  return (
    <DictShell className="pt-24 pb-24">
      <section className="relative mx-auto max-w-3xl px-5 md:px-8">
        <PageEnter>
        <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-sky-800/65">
          {text(KAA.englishEyebrow)}
        </p>
        <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
          {text(KAA.englishTitle)}
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-ink/55">
          {text(KAA.englishLead)}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            to="/quiz"
            className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
          >
            <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
          <Link
            to="/dictionary/game"
            className="inline-flex items-center gap-1.5 rounded-full border border-sky-700/25 bg-white px-4 py-2 text-xs font-bold text-sky-950"
          >
            <Icon name="gamepad" /> {text(KAA.dictStatsStartGame)}
          </Link>
        </div>

        <AnimIconDivider className="my-8" />

        <div
          className="mb-6 flex flex-wrap gap-2"
          role="tablist"
          aria-label={text(KAA.englishTitle)}
        >
          {ENGLISH_BOOKS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={b.id === book.id}
              onClick={() => setBookId(b.id)}
              className={tabBtn(b.id === book.id)}
            >
              {text(b.label)}
            </button>
          ))}
        </div>

        <TabCrossfade tabKey={book.id}>
          <article className="qp-surface p-6 md:p-8">
            <header className="mb-6 border-b border-ink/10 pb-5">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-sky-800/60">
                {text(book.label)}
              </p>
              <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
                {text(book.title)}
              </h2>
              {book.subtitle ? (
                <p className="mt-1 text-ink/55">{text(book.subtitle)}</p>
              ) : null}
            </header>
            <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
            <div className="mt-10 border-t border-ink/10 pt-6">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sky-800/55">
                {text(KAA.learnPracticeHint)}
              </p>
              <p className="mb-4 text-sm text-ink/55">{text(KAA.learnPracticeBody)}</p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/quiz"
                  className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                >
                  <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
                </Link>
                <Link
                  to="/crossword"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                >
                  <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                </Link>
              </div>
            </div>
          </article>
        </TabCrossfade>
        </PageEnter>
      </section>
    </DictShell>
  );
}
