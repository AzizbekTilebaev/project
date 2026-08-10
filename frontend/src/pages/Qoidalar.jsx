import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, AnimChevron, anim, PageEnter, TabCrossfade } from '../animations';
import { GRAMMAR_BOOKS, JOQARI_BOOKS, grammarBookHtml } from '../lib/grammarContent';
import { MORPH_EXAMPLES } from '../data/morphExamples';

const PROSE =
  [
    'qoidalar-prose max-w-none text-[1.05rem] leading-relaxed text-ink/80',
    '[&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-ink',
    '[&_h3]:mt-8 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-xl [&_h3]:text-ink',
    '[&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:font-display [&_h4]:text-lg [&_h4]:text-ink',
    '[&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5',
    '[&_li]:my-1.5 [&_li]:marker:text-teal-800/50',
    '[&_strong]:font-semibold [&_strong]:text-ink',
    '[&_em]:text-ink/70',
    '[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-teal-800/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-ink/60',
    '[&_code]:rounded [&_code]:bg-teal-900/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-teal-950',
    '[&_hr]:my-8 [&_hr]:border-ink/10',
    '[&_a]:font-semibold [&_a]:text-teal-900 [&_a]:underline-offset-2 hover:[&_a]:underline',
    '[&_table]:my-4 [&_table]:w-full [&_table]:text-left [&_table]:text-sm',
    '[&_th]:border-b [&_th]:border-ink/15 [&_th]:py-2 [&_th]:pr-3 [&_th]:font-semibold',
    '[&_td]:border-b [&_td]:border-ink/8 [&_td]:py-2 [&_td]:pr-3',
  ].join(' ');

function tabBtn(active) {
  return `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
    active
      ? 'bg-teal-900 text-white shadow-sm'
      : 'border border-ink/10 text-ink/65 hover:border-teal-700/30 hover:text-teal-900'
  }`;
}

function MorphExamples({ text }) {
  return (
    <div className="space-y-8">
      <header className="mb-2 border-b border-ink/10 pb-5">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
          {text(KAA.morphEyebrow)}
        </p>
        <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
          {text(KAA.morphTitle)}
        </h2>
        <p className="mt-1 text-ink/55">{text(KAA.morphLead)}</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/15 text-[0.7rem] uppercase tracking-wider text-ink/45">
              <th className="py-2 pr-3 font-semibold">{text(KAA.morphColWord)}</th>
              <th className="py-2 pr-3 font-semibold">{text(KAA.morphColSplit)}</th>
              <th className="py-2 pr-3 font-semibold">{text(KAA.morphColRoot)}</th>
              <th className="py-2 pr-3 font-semibold">{text(KAA.morphColAffix)}</th>
              <th className="py-2 font-semibold">{text(KAA.morphColRule)}</th>
            </tr>
          </thead>
          <tbody>
            {MORPH_EXAMPLES.map((ex) => (
              <tr key={ex.word} className="border-b border-ink/8 align-top">
                <td className="py-3 pr-3 font-display text-base font-semibold text-ink">
                  {ex.word}
                </td>
                <td className="py-3 pr-3 font-mono text-[0.85rem] text-teal-900">
                  {ex.parts.join(' + ')}
                </td>
                <td className="py-3 pr-3">
                  <span className="font-semibold text-ink">{ex.root}</span>
                  {ex.lemma && ex.lemma !== ex.root ? (
                    <span className="mt-0.5 block text-xs text-ink/45">
                      {text(KAA.morphLemma)}: {ex.lemma}
                    </span>
                  ) : null}
                </td>
                <td className="py-3 pr-3">
                  <ul className="space-y-1">
                    {ex.affixes.map((a) => (
                      <li key={`${ex.word}-${a.form}`}>
                        <span className="font-mono text-teal-900">{a.form}</span>
                        <span className="text-ink/55"> — {a.role}</span>
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="py-3 text-ink/65">
                  <p>{ex.rule}</p>
                  <p className="mt-1 text-xs text-teal-800/70">{ex.level}</p>
                  {ex.note ? (
                    <p className="mt-1 text-xs italic text-ink/45">{ex.note}</p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-ink/10 pt-6">
        <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/60">
          {text(KAA.morphTreeTitle)}
        </p>
        <pre className="overflow-x-auto rounded-2xl border border-ink/10 bg-teal-900/[0.04] px-4 py-4 font-mono text-sm leading-relaxed text-ink/80">
{`kitaplardıń
├─ kitap     ← ${text(KAA.morphColRoot).toLowerCase()}
├─ -lar      ← kóplik
└─ -dıń      ← iyelik seplik`}
        </pre>
      </div>
    </div>
  );
}

function BookView({ book, eyebrow, html }) {
  return (
    <>
      <header className="mb-6 border-b border-ink/10 pb-5">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
          {eyebrow}
        </p>
        <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">{book.title}</h2>
        <p className="mt-1 text-ink/55">{book.subtitle}</p>
      </header>
      <article className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

export default function Qoidalar() {
  const { text } = useUiScript();
  const [mode, setMode] = useState('books');
  const [bookId, setBookId] = useState(GRAMMAR_BOOKS[0].id);
  const [joqariId, setJoqariId] = useState(JOQARI_BOOKS[0].id);

  usePageMeta(text(KAA.qoidalarTitle), text(KAA.qoidalarLead));

  const schoolBook = GRAMMAR_BOOKS.find((b) => b.id === bookId) || GRAMMAR_BOOKS[0];
  const joqariBook = JOQARI_BOOKS.find((b) => b.id === joqariId) || JOQARI_BOOKS[0];
  const schoolHtml = useMemo(() => grammarBookHtml(schoolBook), [bookId]);
  const joqariHtml = useMemo(() => grammarBookHtml(joqariBook), [joqariId]);

  return (
    <DictShell className="pt-24 pb-28">
      <section className="relative mx-auto max-w-3xl px-5 pt-8 sm:px-6 md:px-10">
        <PageEnter>
        <Link
          to="/literature/qaraqalpaq-tili"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink/45 transition-colors hover:text-teal-900"
        >
          <Icon name="left" /> {text(KAA.qoidalarEyebrow)}
        </Link>
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-teal-800/70">
          {text(KAA.qoidalarEyebrow)}
        </p>
        <h1 className="mb-2 font-display text-3xl tracking-tight text-ink sm:text-5xl">
          {text(KAA.qoidalarTitle)}
        </h1>
        <AnimIconDivider amber className="mb-4" />
        <p className="mb-5 max-w-xl text-lg leading-relaxed text-ink/60">
          {text(KAA.qoidalarLead)}
        </p>
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <Link
            to="/quiz"
            className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
          >
            <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
          <Link
            to="/tutor/practice"
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
          >
            <Icon name="bolt" /> {text(KAA.practiceNav)}
          </Link>
        </div>

        <div
          className="sticky top-[4.5rem] z-10 -mx-1 mb-3 flex flex-wrap gap-1.5 bg-parchment/90 px-1 py-2 backdrop-blur-md"
          role="tablist"
          aria-label={text(KAA.qoidalarTitle)}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'morph'}
            onClick={() => setMode('morph')}
            className={tabBtn(mode === 'morph')}
          >
            {text(KAA.morphShort)}
          </button>
          {GRAMMAR_BOOKS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={mode === 'books' && b.id === schoolBook.id}
              onClick={() => {
                setMode('books');
                setBookId(b.id);
              }}
              className={tabBtn(mode === 'books' && b.id === schoolBook.id)}
            >
              {b.label}
            </button>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'joqari'}
            onClick={() => setMode('joqari')}
            className={tabBtn(mode === 'joqari')}
          >
            {text(KAA.joqariShort)}
          </button>
        </div>

        {mode === 'joqari' ? (
          <div
            className="mb-8 flex flex-wrap gap-1.5"
            role="tablist"
            aria-label={text(KAA.joqariShort)}
          >
            {JOQARI_BOOKS.map((b) => (
              <button
                key={b.id}
                type="button"
                role="tab"
                aria-selected={b.id === joqariBook.id}
                onClick={() => setJoqariId(b.id)}
                className={tabBtn(b.id === joqariBook.id)}
              >
                {b.label}
              </button>
            ))}
          </div>
        ) : null}

        <TabCrossfade
          tabKey={
            mode === 'morph'
              ? 'morph'
              : mode === 'joqari'
                ? `joqari-${joqariBook.id}`
                : `books-${schoolBook.id}`
          }
        >
          {mode === 'morph' ? (
            <MorphExamples text={text} />
          ) : mode === 'joqari' ? (
            <BookView
              book={joqariBook}
              eyebrow={text(KAA.joqariEyebrow)}
              html={joqariHtml}
            />
          ) : (
            <BookView
              book={schoolBook}
              eyebrow={`${schoolBook.label} klass`}
              html={schoolHtml}
            />
          )}
        </TabCrossfade>

        <div className="mt-10 qp-panel motion-rise px-5 py-5">
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
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
            <Link
              to="/dictionary"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
            >
              <Icon name="book" /> {text(KAA.sozlik)}
            </Link>
          </div>
        </div>
        </PageEnter>
      </section>
    </DictShell>
  );
}
