import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import usePageMeta from '../hooks/usePageMeta';
import { t } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  answerReadingQuestion,
  completeReadingSession,
  fetchReadingSession,
  startReadingSession,
} from '../api/reading';
import { fetchBookById } from '../api/books';
import { AnimChevron, anim } from '../animations';
import { recordReadingLessonComplete, getReadingLessonStreak } from '../lib/readingProgress';
import {
  applyServerLessonSrsEntry,
  recordLessonSrsComplete,
} from '../lib/readingLessonSrs';
import { readingPracticeHref } from '../lib/readingPractice';
import { KAA } from '../i18n/kaa';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import SoftNextRow from '../components/SoftNextRow';
import { useAuth } from '../contexts/AuthContext';

const CONFETTI_COLORS = ['#0d9488', '#7c3aed', '#f59e0b', '#e11d48', '#2563eb', '#16a34a'];

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-24 overflow-hidden">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="quiz-confetti"
          style={{
            left: `${(i * 100) / 18 + 2}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 6) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

function VocabCard({ item, index, script = 'cyrillic' }) {
  const { text } = useUiScript();
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className={`lesson-flip h-40 text-left ${open ? 'lesson-flip--open' : ''}`}
      aria-expanded={open}
    >
      <div className="lesson-flip-inner">
        <div className="lesson-flip-face items-center justify-center rounded-2xl border border-amber-700/10 bg-white/80 p-4 shadow-sm">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-amber-700/50">
            {index + 1}{t('wordTapHint', script)}
          </span>
          <h3 className="mt-2 font-display text-2xl text-ink">{text(item.word)}</h3>
          <span className="mt-3 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Icon name="sparkle" />
          </span>
        </div>
        <div className="lesson-flip-back overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-4 text-white shadow-md">
          <h3 className="font-display text-lg">{text(item.word)}</h3>
          <p className="mt-1 flex-1 overflow-y-auto text-sm leading-6 text-white/90">
            {text(item.description)}
          </p>
          {item.example && (
            <p className="mt-2 border-l-2 border-white/50 pl-2 text-xs italic text-white/75">
              {text(item.example)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function LessonSection({ number, label, title, children, tone = 'teal' }) {
  const tones = {
    teal: 'from-teal-50/90 to-emerald-50/60 border-teal-700/15 text-teal-900',
    amber: 'from-amber-50/90 to-orange-50/60 border-amber-700/15 text-amber-900',
    violet: 'from-teal-50/90 to-cyan-50/60 border-teal-700/15 text-teal-900',
  };
  return (
    <section className={`rounded-[2rem] border bg-gradient-to-br p-6 shadow-sm md:p-8 ${tones[tone]}`}>
      <div className="mb-5 flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 font-display text-xl shadow-sm">
          {number}
        </span>
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] opacity-55">{label}</p>
          <h2 className="font-display text-2xl tracking-tight text-ink md:text-3xl">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ReadingLesson() {
  const params = useParams();
  const bookId = params.bookId || params.id;
  const routeSectionIndex = params.sectionIndex;
  const [searchParams] = useSearchParams();
  const sectionIndex = Number(routeSectionIndex ?? searchParams.get('section') ?? 0);
  const { script, text } = useUiScript();
  const { isAuthenticated } = useAuth();
  usePageMeta(t('lessonTitle', script), t('lessonIntro', script));

  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [streak, setStreak] = useState(0);
  const [lessonDayStreak, setLessonDayStreak] = useState(() => getReadingLessonStreak());
  const [feedbackAnim, setFeedbackAnim] = useState('');
  const [sectionCount, setSectionCount] = useState(null);
  const [bookTitle, setBookTitle] = useState('');

  const load = async () => {
    setStatus('loading');
    setError('');
    setResult(null);
    try {
      if (!bookId || !Number.isInteger(sectionIndex) || sectionIndex < 0) {
        throw new Error(t('lessonNoSection', script));
      }
      const [data, bookRes] = await Promise.all([
        startReadingSession(bookId, sectionIndex),
        fetchBookById(bookId).catch(() => null),
      ]);
      setSession(data.session);
      const secs = bookRes?.book?.sections || bookRes?.sections || [];
      setSectionCount(Array.isArray(secs) && secs.length ? secs.length : null);
      setBookTitle(bookRes?.book?.title || bookRes?.title || '');
      setStatus('ready');
    } catch (loadError) {
      setError(loadError.message || t('lessonLoadFailed', script));
      setStatus('error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, sectionIndex]);

  const nextQuestion = useMemo(
    () => session?.lesson?.questions?.find((question) => !question.answered) || null,
    [session]
  );
  const answered = session?.lesson?.questions?.filter((question) => question.answered).length || 0;
  const isLastSection =
    sectionCount != null &&
    Number.isFinite(sectionCount) &&
    sectionCount > 0 &&
    sectionIndex >= sectionCount - 1;

  async function submitAnswer(answer) {
    if (!nextQuestion || busy) return;
    if (
      nextQuestion.type !== 'choice' &&
      nextQuestion.type !== 'sense_pick' &&
      !String(answer || '').trim()
    ) {
      return;
    }
    setBusy(true);
    setResult(null);
    setFeedbackAnim('');
    try {
      const graded = await answerReadingQuestion(session.id, nextQuestion.id, answer);
      setResult({
        correct: graded.correct,
        nearMiss: Boolean(graded.nearMiss),
        score: graded.score,
      });
      setStreak((prev) => (graded.correct ? prev + 1 : 0));
      setFeedbackAnim(graded.correct ? 'quiz-result-pop' : 'lesson-shake');
      const refreshed = await fetchReadingSession(session.id);
      setSession(refreshed.session);
      setDraft('');
      window.setTimeout(() => setFeedbackAnim(''), 650);
    } catch (submitError) {
      setResult({ error: submitError.message });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!session?.id || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const completed = await completeReadingSession(session.id);
      const refreshed = await fetchReadingSession(session.id);
      setSession(refreshed.session);
      const practice = completed.practice || null;
      const recorded = recordReadingLessonComplete({
        titleIds: practice?.titleIds || [],
        missedIds: practice?.missedIds || [],
        bookId,
        sectionIndex,
      });
      // Server SRS bar bolsa — local box qayta óspeydi (idempotent complete)
      if (completed.srs) {
        applyServerLessonSrsEntry(completed.srs);
      } else if (!completed.alreadyCompleted) {
        recordLessonSrsComplete({
          bookId,
          sectionIndex,
          score: completed.score,
          total: completed.total,
        });
      }
      setLessonDayStreak(recorded.streak);
      setResult({
        completed: true,
        score: completed.score,
        practice,
      });
    } catch (finishError) {
      setResult({ error: finishError.message });
    } finally {
      setBusy(false);
    }
  }

  const lesson = session?.lesson;
  return (
    <ProtectedContent>
    <PageGate
      status={status}
      error={error}
      onRetry={load}
      backHref="/books"
      backLabel={t('books', script)}
      loadingLabel={t('lessonLoading', script)}
    >
      <DictShell className="pb-24 pt-24">
        <main className="relative mx-auto max-w-3xl px-5 pt-7 sm:px-7 md:px-10">
          <nav className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <Link to="/books" className="inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline">
              <Icon name="left" /> {t('lessonBackToReader', script)}
            </Link>
            <span className="rounded-full border border-teal-600/15 bg-teal-50 px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800">
              Lokal AI · {lesson?.engine}
            </span>
          </nav>

          <header className="mb-9 qp-surface px-6 py-9 text-center shadow-[0_30px_75px_-42px_rgba(28,42,36,0.55)] md:px-10">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 text-2xl text-white shadow-lg">
              <Icon name="book" />
            </span>
            <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-teal-800/60">
              {lesson?.source?.sectionTitle || `${sectionIndex + 1}-${t('sections', script)}`}
            </p>
            <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
              {t('lessonTitle', script)}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink/55">
              {t('lessonIntro', script)}
            </p>
          </header>

          <div className="space-y-6">
            <LessonSection number="1" label={t('step1', script)} title={t('step1Title', script)}>
              <div className="space-y-3">
                {(lesson?.summary || []).map((sentence) => (
                  <p key={sentence} className="rounded-2xl bg-white/65 px-4 py-3 leading-7 text-ink/75">
                    {sentence}
                  </p>
                ))}
              </div>
              {lesson?.writerContext?.bio?.length > 0 && (
                <aside className="mt-5 border-l-2 border-teal-500/30 pl-4">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-60">
                    {lesson.writerContext.name || t('writerSingle', script)} · {t('importedBio', script)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink/60">
                    {lesson.writerContext.bio.join(' ')}
                  </p>
                </aside>
              )}
            </LessonSection>

            <LessonSection number="2" label={t('step2', script)} title={t('step2Title', script)} tone="amber">
              {lesson?.vocabulary?.length ? (
                <>
                  <p className="mb-4 text-sm text-ink/55">
                    {t('vocabHint', script)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {lesson.vocabulary.map((item, index) => (
                      <VocabCard
                        key={`${item.id || ''}-${item.word}`}
                        item={item}
                        index={index}
                        script={script}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <p className="rounded-2xl bg-white/65 px-4 py-4 text-sm text-ink/55">
                  {t(lesson?.lowVocab ? 'lowVocabHint' : 'noVocab', script)}
                </p>
              )}
            </LessonSection>

            <LessonSection number="3" label={t('step3', script)} title={t('step3Title', script)} tone="violet">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {Array.from({ length: session?.total || 0 }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2.5 w-2.5 rounded-full transition-all ${
                        i < answered
                          ? 'scale-100 bg-gradient-to-r from-teal-600 to-cyan-500'
                          : i === answered && session?.status !== 'completed'
                            ? 'scale-125 bg-teal-300 ring-2 ring-teal-400/40'
                            : 'bg-white/80'
                      }`}
                    />
                  ))}
                </div>
                {streak >= 2 && session?.status !== 'completed' && (
                  <span className="quiz-result-pop rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow">
                    🔥 {streak} {t('inARow', script)}
                  </span>
                )}
              </div>
              <div className="mb-5 qp-progress">
                <div
                  className="qp-progress__bar"
                  style={{ width: `${(answered / Math.max(1, session?.total || 1)) * 100}%` }}
                />
              </div>

              {session?.status === 'completed' ? (
                <div className="quiz-result-pop relative overflow-hidden qp-surface px-5 py-8 text-center">
                  <Confetti />
                  <Icon name="trophy" className="mb-3 text-4xl text-amber-600" />
                  <h3 className="font-display text-3xl text-ink">{t('lessonDone', script)}</h3>
                  <p className="mt-2 text-ink/60">{session.score} / {session.total} {t('points', script)}</p>
                  <p className="mt-1 text-sm font-semibold text-teal-800">
                    {session.score === session.total
                      ? t('resultPerfect', script)
                      : session.score >= session.total / 2
                        ? t('resultGood', script)
                        : t('resultRetry', script)}
                  </p>
                  <p className="mt-2 text-xs text-ink/45">{text(KAA.readingLessonScheduled)}</p>
                  {lessonDayStreak > 0 && (
                    <Link
                      to="/tutor/practice?from=reading"
                      className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 hover:underline ${anim.streakFlame}`}
                    >
                      <span className={anim.streakDot} aria-hidden />
                      {text(KAA.readingBrowseStreakCta).replace('{n}', String(lessonDayStreak))}
                      <AnimChevron count={2} className="opacity-70" />
                    </Link>
                  )}
                  {(() => {
                    const practiceHref =
                      readingPracticeHref({
                        ids:
                          result?.practice?.titleIds ||
                          (lesson?.vocabulary || []).map((v) => v.id).filter(Boolean),
                        missedIds: result?.practice?.missedIds || [],
                      }) || '/tutor/practice?from=reading';
                    return (
                      <>
                      <div className="mt-5 flex flex-wrap justify-center gap-3">
                        <Link
                          to={practiceHref}
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-700 to-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110"
                        >
                          <Icon name="bolt" />
                          {lessonDayStreak > 0
                            ? text(KAA.readingBrowseStreakCta).replace(
                                '{n}',
                                String(lessonDayStreak)
                              )
                            : t('practiceVocab', script)}
                          <AnimChevron count={2} style={{ ['--dch-color']: '#ecfdf5' }} />
                        </Link>
                        <Link
                          to={`/books/${encodeURIComponent(bookId)}/read?section=${sectionIndex}`}
                          className="rounded-full border border-teal-700/20 bg-white px-5 py-2.5 text-sm font-semibold text-teal-900 transition hover:bg-teal-50"
                        >
                          {t('rereadSection', script)}
                        </Link>
                        {isLastSection ? (
                          <>
                            <p className="mt-2 w-full text-center text-sm font-semibold text-teal-900">
                              {t('bookCompleteTitle', script)}
                            </p>
                            <p className="w-full text-center text-xs text-ink/50">
                              {t('bookCompleteBody', script)}
                            </p>
                            <Link
                              to="/tutor/practice?from=reading"
                              className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-bold text-white`}
                            >
                              <Icon name="bolt" /> {t('practiceHub', script)}
                              <AnimChevron count={2} style={{ ['--dch-color']: '#ecfdf5' }} />
                            </Link>
                            <Link
                              to="/books"
                              className="rounded-full border border-teal-700/20 bg-white px-5 py-2.5 text-sm font-semibold text-teal-900 transition hover:bg-teal-50"
                            >
                              {t('seeAllBooks', script)}
                            </Link>
                            <Link
                              to="/literature"
                              className="qp-btn-ghost"
                            >
                              {t('litCenter', script)}
                            </Link>
                          </>
                        ) : (
                          <Link
                            to={`/books/${encodeURIComponent(bookId)}/read?section=${sectionIndex + 1}`}
                            className="inline-flex items-center gap-2 rounded-full border border-cyan-700/20 bg-cyan-50/80 px-5 py-2.5 text-sm font-bold text-cyan-950 transition hover:bg-cyan-50"
                          >
                            {t('readerNextSectionRead', script)}
                            <AnimChevron count={2} />
                          </Link>
                        )}
                        <ShareResultButton
                          title={text(KAA.shareReadingTitle)}
                          text={text(KAA.shareReadingText)
                            .replace('{title}', bookTitle || 'Kitap')
                            .replace('{section}', String(sectionIndex + 1))}
                          url={
                            typeof window !== 'undefined' && bookId
                              ? `${window.location.origin}/books/${encodeURIComponent(bookId)}/learn?section=${sectionIndex}`
                              : undefined
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-semibold text-teal-950"
                        />
                      </div>
                      <SoftNextRow
                        className="mt-4"
                        primaryTo="/games"
                        primaryIcon="trophy"
                        primaryLabelKey="oyinlar"
                        secondaryTo="/literature"
                        secondaryIcon="scroll"
                        secondaryLabelKey="adebiyat"
                      />
                      {!isAuthenticated ? (
                        <GuestSoftContinue className="mt-5 text-left" bodyKey="authGuestFreeBody" />
                      ) : null}
                      </>
                    );
                  })()}
                </div>
              ) : nextQuestion ? (
                <div className={`qp-panel ${feedbackAnim}`}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-teal-700/55">
                    {answered + 1} / {session.total}
                  </p>
                  <h3 className="mb-5 font-display text-2xl leading-snug text-ink">
                    {nextQuestion.prompt}
                  </h3>
                  {nextQuestion.type === 'choice' || nextQuestion.type === 'sense_pick' ? (
                    <div className="grid gap-3">
                      {nextQuestion.type === 'sense_pick' ? (
                        <p className="mb-1 text-xs text-ink/45">{t('sensePickHint', script)}</p>
                      ) : null}
                      {nextQuestion.options.map((option, index) => (
                        <button
                          key={`${index}-${option.slice(0, 24)}`}
                          type="button"
                          disabled={busy}
                          onClick={() => submitAnswer(index)}
                          className="quiz-option rounded-2xl border border-teal-800/10 bg-teal-50/45 px-4 py-3 text-left text-sm leading-6 text-ink/75 hover:border-teal-500/40 hover:bg-teal-50 disabled:opacity-50"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitAnswer(draft);
                      }}
                      className="flex flex-col gap-3"
                    >
                      {nextQuestion.type === 'produce_reverse' ? (
                        <p className="text-xs text-ink/45">{t('senseReverseHint', script)}</p>
                      ) : null}
                      <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        disabled={busy}
                        autoComplete="off"
                        placeholder={t(
                          nextQuestion.type === 'sense'
                            ? 'sensePlaceholder'
                            : nextQuestion.type === 'produce_reverse'
                              ? 'senseReversePlaceholder'
                              : 'answerPlaceholder',
                          script
                        )}
                        className="min-w-0 flex-1 rounded-2xl border border-teal-800/15 bg-white px-4 py-3 text-ink outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                      />
                      <button
                        type="submit"
                        disabled={busy || !draft.trim()}
                        className="rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-700 px-6 py-3 text-sm font-bold text-white shadow-md disabled:opacity-45"
                      >
                        {t('checkBtn', script)}
                      </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={finish}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-4 font-bold text-white shadow-lg disabled:opacity-50"
                >
                  <Icon name="check-circle" /> {t('finishLesson', script)}
                </button>
              )}

              {result && (
                <p
                  className={`quiz-result-pop mt-4 rounded-2xl px-4 py-3 text-center text-sm font-semibold ${
                    result.error
                      ? 'bg-rose-100 text-rose-800'
                      : result.correct === false
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}
                  role="status"
                >
                  {result.error
                    ? result.error
                    : result.completed
                      ? t('lessonSaved', script)
                      : result.correct
                        ? result.nearMiss
                          ? t('nearMissMsg', script)
                          : t('correctMsg', script)
                        : t('wrongMsg', script)}
                </p>
              )}
            </LessonSection>
          </div>

          <footer className="mt-9">
            <SoftNextRow
              primaryTo="/games"
              primaryIcon="trophy"
              primaryLabelKey="oyinlar"
              secondaryTo="/literature"
              secondaryIcon="scroll"
              secondaryLabelKey="adebiyat"
            />
          </footer>
        </main>
      </DictShell>
    </PageGate>
    </ProtectedContent>
  );
}
