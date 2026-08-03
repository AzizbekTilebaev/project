import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import PageGate from '../components/PageGate';
import usePageData from '../hooks/usePageData';
import Icon from '../components/Icon';
import ProtectedContent from '../components/ProtectedContent';
import { useUiScript } from '../contexts/UiScriptContext';
import { useGuestQuota } from '../hooks/useGuestQuota';
import {
  abandonAdaptiveQuiz,
  answerAdaptiveQuiz,
  fetchAbility,
  startAdaptiveQuiz,
} from '../api/quizzes';
import { AnimIconDivider, AnimChevron, anim } from '../animations';
import { KAA } from '../i18n/kaa';
import {
  clearAdaptiveContinue,
  getContinueAdaptive,
  touchAdaptiveContinue,
} from '../lib/adaptiveProgress';
import { recordQuizPracticeComplete, readQuizPractice } from '../lib/quizProgress';
import { quizPracticeHref } from '../lib/readingPractice';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { useAuth } from '../contexts/AuthContext';
import {
  DUE_TUTOR_HREF,
  dueRemediationPrimaryHref,
  dueRemediationSecondaryHref,
  dueRemediationDictHref,
} from '../lib/dueRemediation';
import useResumeTick from '../hooks/useResumeTick';

const OPTION_STYLES = [
  { badge: 'bg-teal-700/10 text-teal-800 border-teal-700/40' },
  { badge: 'bg-amber-500/10 text-amber-700 border-amber-600/40' },
  { badge: 'bg-sky-500/10 text-sky-700 border-sky-500/40' },
  { badge: 'bg-rose-500/10 text-rose-700 border-rose-500/40' },
];

const HINT_COPY = {
  harder: 'Keyingi soraw biraz qıyınlaw',
  easier: 'Keyingi soraw biraz ańsatlaw',
  similar: 'Keyingi soraw uqsas dárejede',
};

function formatDelta(delta) {
  const n = Number(delta);
  if (!Number.isFinite(n) || Math.abs(n) < 0.0005) return '0.00';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}`;
}

export default function AdaptiveQuiz() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { requireQuiz, openGate, GateModal, reload: reloadQuota } = useGuestQuota();
  usePageMeta(text('Adaptiv test'), text('IRT tiykarında moslanatuǵın sorawlar.'));
  const [phase, setPhase] = useState('ready');
  const [attemptId, setAttemptId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(10);
  const [theta, setTheta] = useState(0);
  const [picked, setPicked] = useState(null);
  const [lastCorrect, setLastCorrect] = useState(null);
  const [thetaDelta, setThetaDelta] = useState(null);
  const [nextHint, setNextHint] = useState(null);
  const [feedbackAnim, setFeedbackAnim] = useState('');
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emptyState, setEmptyState] = useState(null);
  const [abandonedFlash, setAbandonedFlash] = useState(false);
  const questionStartedAt = useRef(Date.now());
  const resumeTick = useResumeTick();
  const continueAdaptive = useMemo(
    () => getContinueAdaptive(),
    [phase, resumeTick]
  );

  const { status, data, error: loadError, reload } = usePageData(
    async () => {
      const res = await fetchAbility('global');
      return { ability: res.ability };
    },
    { deps: [] }
  );

  useEffect(() => {
    if (phase === 'play' && question?.id) {
      questionStartedAt.current = Date.now();
    }
  }, [phase, question?.id]);

  useEffect(() => {
    if (phase === 'done') clearAdaptiveContinue();
  }, [phase]);

  function applyAttempt(attempt) {
    setAttemptId(attempt.attemptId);
    setQuestion(attempt.question);
    setIndex(attempt.currentIndex || 0);
    setTotal(attempt.total);
    setTheta(attempt.theta || 0);
    setPicked(null);
    setLastCorrect(null);
    setThetaDelta(null);
    setNextHint(null);
    setFeedbackAnim('');
    setScore(Number(attempt.score) || 0);
    setResult(null);
    setAbandonedFlash(false);
    setPhase('play');
    questionStartedAt.current = Date.now();
    touchAdaptiveContinue({
      attemptId: attempt.attemptId,
      skill: attempt.skill || 'global',
      currentIndex: attempt.currentIndex || 0,
      total: attempt.total || 10,
    });
  }

  async function start({ forceNew = false } = {}) {
    if (!requireQuiz()) return;
    setBusy(true);
    setError('');
    setEmptyState(null);
    try {
      const res = await startAdaptiveQuiz({
        skill: 'global',
        maxItems: 10,
        forceNew,
      });
      applyAttempt(res.attempt);
    } catch (err) {
      if (err.code === 'GUEST_QUIZ_LIMIT' || err.status === 403) {
        openGate('quiz');
        reloadQuota();
        return;
      }
      if (
        err.code === 'ADAPTIVE_EMPTY_BANK' ||
        err.payload?.reason === 'empty_bank' ||
        err.payload?.code === 'ADAPTIVE_EMPTY_BANK'
      ) {
        setEmptyState({
          reason: err.payload?.reason || 'empty_bank',
          remediation: err.payload?.remediation || 'seed',
          practiceLinks: err.payload?.practiceLinks || {
            primary: '/quiz',
            mistakes: DUE_TUTOR_HREF,
            practice: '/tutor/practice?from=adaptive',
            tutor: DUE_TUTOR_HREF,
            quiz: '/quiz',
            dictGame: '/dictionary/game',
            immersion: '/dictionary/immersion',
            crossword: '/crossword',
            books: '/books',
            jumbaq: '/jumbaqlar',
          },
        });
        setPhase('empty');
        if (forceNew) clearAdaptiveContinue();
        return;
      }
      setError(err.message);
      if (forceNew) clearAdaptiveContinue();
    } finally {
      setBusy(false);
    }
  }

  async function abandonSoft() {
    if (!attemptId || busy) return;
    setBusy(true);
    setError('');
    try {
      await abandonAdaptiveQuiz(attemptId);
      clearAdaptiveContinue();
      setAttemptId(null);
      setQuestion(null);
      setPicked(null);
      setLastCorrect(null);
      setThetaDelta(null);
      setNextHint(null);
      setFeedbackAnim('');
      setResult(null);
      setAbandonedFlash(true);
      setPhase('ready');
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function pick(optionIndex) {
    if (picked !== null || busy || !attemptId || !question) return;
    setPicked(optionIndex);
    setBusy(true);
    const timeSpentMs = Math.max(0, Date.now() - questionStartedAt.current);
    try {
      const res = await answerAdaptiveQuiz(attemptId, {
        questionId: question.id,
        optionIndex,
        timeSpentMs,
      });
      const ok = Boolean(res.correct);
      setLastCorrect(ok);
      setThetaDelta(res.thetaDelta);
      setNextHint(res.nextDifficultyHint || null);
      setFeedbackAnim(ok ? 'quiz-result-pop' : 'lesson-shake');
      if (ok) setScore((s) => s + 1);
      setTheta(res.theta ?? theta);

      const pauseMs = ok ? 700 : 1100;
      if (res.done) {
        clearAdaptiveContinue();
        const recorded = recordQuizPracticeComplete({
          titleIds: res.practice?.titleIds || [],
          missedIds: res.practice?.missedIds || [],
        });
        setResult({
          ...res,
          practice: {
            titleIds: recorded.ids,
            missedIds: recorded.missedIds,
            ids: recorded.ids,
          },
        });
        setTimeout(() => setPhase('done'), pauseMs);
      } else {
        touchAdaptiveContinue({
          attemptId: res.attemptId || attemptId,
          skill: 'global',
          currentIndex: res.currentIndex,
          total,
        });
        setTimeout(() => {
          setQuestion(res.question);
          setIndex(res.currentIndex);
          setPicked(null);
          setLastCorrect(null);
          setThetaDelta(null);
          setNextHint(null);
          setFeedbackAnim('');
          questionStartedAt.current = Date.now();
        }, pauseMs);
      }
    } catch (err) {
      setError(err.message);
      setPicked(null);
      setLastCorrect(null);
      setThetaDelta(null);
      setNextHint(null);
      setFeedbackAnim('');
    } finally {
      setBusy(false);
    }
  }

  const progressPct = total ? ((index + (picked !== null ? 1 : 0)) / total) * 100 : 0;
  const deltaLabel =
    thetaDelta == null
      ? null
      : Number(thetaDelta) > 0.001
        ? text('Qábilet ósti')
        : Number(thetaDelta) < -0.001
          ? text('Qábilet tústi')
          : text('Qábilet turıqlı');

  return (
    <>
      {GateModal}
      <PageGate status={status} error={loadError} onRetry={reload} backHref="/quiz" backLabel="Testler">
        <DictShell className="pt-24 pb-24">
          <section className="relative mx-auto max-w-2xl px-6 pt-8 md:px-10">
            <Link
              to="/quiz"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline"
            >
              <Icon name="left" /> {text('Testler')}
            </Link>

            {phase === 'empty' && emptyState && (
              <div className="qp-surface px-7 py-10 text-center">
                <Icon name="sparkle" className="mb-3 text-3xl text-amber-700" />
                <h1 className="mb-2 font-display text-3xl text-ink">
                  {text(KAA.adaptiveEmptyTitle)}
                </h1>
                <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-ink/60">
                  {text(
                    emptyState.remediation === 'mistakes'
                      ? KAA.adaptiveEmptyBodyMistakes
                      : KAA.adaptiveEmptyBodySeed
                  )}
                </p>
                <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                  {text(KAA.tutorEmptyFree)}
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Link
                    to={
                      emptyState.remediation === 'mistakes'
                        ? emptyState.practiceLinks?.primary ||
                          emptyState.practiceLinks?.mistakes ||
                          DUE_TUTOR_HREF
                        : emptyState.practiceLinks?.quiz || '/quiz'
                    }
                    className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white`}
                  >
                    <Icon name={emptyState.remediation === 'mistakes' ? 'tutor' : 'trophy'} />
                    {text(
                      emptyState.remediation === 'mistakes'
                        ? KAA.adaptiveEmptyPrimaryMistakes
                        : KAA.adaptiveEmptyPrimaryQuiz
                    )}
                    <AnimChevron count={2} className="opacity-80" />
                  </Link>
                  {emptyState.remediation === 'mistakes' ? (
                    <Link
                      to={
                        emptyState.practiceLinks?.practice ||
                        '/tutor/practice?from=adaptive'
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-bold text-teal-900"
                    >
                      <Icon name="bolt" /> {text(KAA.practiceNav)}
                    </Link>
                  ) : (
                    <Link
                      to={emptyState.practiceLinks?.tutor || DUE_TUTOR_HREF}
                      className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-bold text-teal-900"
                    >
                      <Icon name="tutor" /> {text(KAA.adaptiveEmptyTutor)}
                    </Link>
                  )}
                  <Link
                    to={emptyState.practiceLinks?.dictGame || '/dictionary/game'}
                    className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-bold text-teal-900"
                  >
                    <Icon name="gamepad" /> {text(KAA.tutorEmptyGame)}
                  </Link>
                  <Link
                    to={emptyState.practiceLinks?.crossword || '/crossword'}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-950"
                  >
                    <Icon name="grammar" /> {text(KAA.tutorEmptyCrossword)}
                  </Link>
                  <Link
                    to={emptyState.practiceLinks?.books || '/books'}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-500/25 bg-stone-50 px-5 py-2.5 text-sm font-bold text-stone-900"
                  >
                    <Icon name="book" /> {text(KAA.readingLandingCta)}
                  </Link>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEmptyState(null);
                    setPhase('ready');
                  }}
                  className="mt-6 text-sm text-ink/45 underline-offset-4 hover:text-teal-900 hover:underline"
                >
                  {text('Artqa')}
                </button>
              </div>
            )}

            {phase === 'ready' && (
              <div className="qp-surface px-7 py-10">
                <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-2xl text-white">
                  <Icon name="sparkle" />
                </span>
                <h1 className="mb-2 font-display text-4xl text-ink">{text('Adaptiv test')}</h1>
                <AnimIconDivider className="mb-4" />
                <p className="mb-2 text-sm font-semibold text-teal-900/70">{text(KAA.guestQuizLimit)}</p>
                <p className="mb-6 leading-relaxed text-ink/60">
                  {text(
                    'Hárbir juwapdan keyin keyingi soraw qıyınlasadı yamasa ańsatlasadı (IRT). Juwaplar serverde bahalanadı — durıs variant kórsetilmeydi.'
                  )}
                </p>
                <div className="mb-6 qp-card qp-card--static px-4 py-3 text-sm">
                  {text('Házirgi qábilet (θ)')}:{' '}
                  <strong>{Number(data?.ability?.theta || 0).toFixed(2)}</strong>
                  <span className="ml-2 text-ink/40">
                    SE {Number(data?.ability?.thetaSe || 1).toFixed(2)}
                  </span>
                </div>
                {error && <p className="mb-3 text-sm text-rose-700">{text(error)}</p>}
                {continueAdaptive ? (
                  <p className="mb-3 text-xs text-sky-900/70">{text(KAA.adaptiveResumeHint)}</p>
                ) : abandonedFlash ? (
                  <p className="mb-3 text-xs text-ink/55">{text(KAA.adaptiveAbandonedHint)}</p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => start()}
                    className={`${anim.shine} inline-flex items-center gap-2 rounded-full ${
                      continueAdaptive
                        ? 'bg-sky-800 shadow-sky-900/20'
                        : 'bg-gradient-to-r from-teal-600 to-teal-800 shadow-teal-900/20'
                    } px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5`}
                  >
                    <Icon name="sparkle" />{' '}
                    {text(continueAdaptive ? KAA.continueAdaptive : 'Bastaw')}
                    {continueAdaptive ? (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold normal-case tracking-normal">
                        {text(KAA.continueAdaptiveProgress)
                          .replace('{a}', String((continueAdaptive.currentIndex || 0) + 1))
                          .replace('{b}', String(continueAdaptive.total || 10))}
                      </span>
                    ) : null}
                    {continueAdaptive ? (
                      <AnimChevron
                        count={2}
                        className="opacity-80"
                        style={{ ['--dch-color']: '#ecfdf5' }}
                      />
                    ) : null}
                  </button>
                  {continueAdaptive ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => start({ forceNew: true })}
                      className="inline-flex items-center gap-2 rounded-full border border-teal-700/30 bg-white px-5 py-3 text-sm font-semibold text-teal-950 transition hover:bg-teal-50 disabled:opacity-50"
                    >
                      {text(KAA.continueAdaptiveFresh)}
                    </button>
                  ) : null}
                  <Link
                    to="/tutor"
                    className="inline-flex rounded-full border border-teal-300 px-5 py-3 text-sm text-teal-900"
                  >
                    {text(KAA.uyretiwshi)}
                  </Link>
                </div>

                <div className="mt-8 border-t border-teal-700/10 pt-5">
                  <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                    {text(KAA.adaptiveReadyFree)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/tutor/practice?from=adaptive"
                      className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                    >
                      <Icon name="bolt" /> {text(KAA.practiceNav)}
                    </Link>
                    <Link
                      to="/quiz"
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                    >
                      <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
                    </Link>
                    <Link
                      to="/crossword"
                      className="qp-chip text-ink/70"
                    >
                      <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {phase === 'play' && question && (
              <ProtectedContent>
                <div className={feedbackAnim || undefined}>
                  <div className="mb-3 flex justify-between text-sm text-ink/50">
                    <span>
                      {index + 1} / {total}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-900">
                        θ {Number(theta).toFixed(2)}
                        {thetaDelta != null && (
                          <span
                            className={`ml-1 ${
                              Number(thetaDelta) > 0
                                ? 'text-emerald-700'
                                : Number(thetaDelta) < 0
                                  ? 'text-rose-700'
                                  : 'text-ink/50'
                            }`}
                          >
                            {formatDelta(thetaDelta)}
                          </span>
                        )}
                      </span>
                      <span className="text-xs">
                        {score} {text('durıs')}
                      </span>
                    </span>
                  </div>
                  <div className="mb-6 h-2.5 overflow-hidden rounded-full bg-ink/[0.07]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, progressPct)}%` }}
                    />
                  </div>
                  <h2 className="mb-8 font-display text-3xl text-ink">{text(question.question)}</h2>
                  <div className="grid gap-3">
                    {question.options.map((opt, idx) => {
                      const style = OPTION_STYLES[idx % OPTION_STYLES.length];
                      const isPicked = idx === picked;
                      let stateClass =
                        'rounded-2xl border-2 border-ink/[0.08] bg-white/60 px-5 py-4 text-left transition hover:-translate-y-0.5';
                      if (isPicked && lastCorrect === true) {
                        stateClass =
                          'rounded-2xl border-2 border-emerald-600 bg-emerald-700 px-5 py-4 text-left text-white';
                      } else if (isPicked && lastCorrect === false) {
                        stateClass =
                          'rounded-2xl border-2 border-rose-500 bg-rose-600 px-5 py-4 text-left text-white';
                      } else if (isPicked) {
                        stateClass =
                          'rounded-2xl border-2 border-teal-600 bg-teal-800 px-5 py-4 text-left text-parchment';
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={picked !== null || busy}
                          onClick={() => pick(idx)}
                          className={stateClass}
                        >
                          <span className="inline-flex items-center gap-3">
                            <span
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border-2 text-sm font-bold ${
                                isPicked && lastCorrect != null
                                  ? 'border-white/40 bg-white/15 text-white'
                                  : style.badge
                              }`}
                            >
                              {String.fromCharCode(65 + idx)}
                            </span>
                            {text(opt)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {lastCorrect != null && (
                    <div
                      className={`quiz-result-pop mt-4 rounded-2xl px-4 py-3 text-sm ${
                        lastCorrect
                          ? 'bg-emerald-50 text-emerald-900'
                          : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      <p className="font-semibold">
                        {lastCorrect ? text('Durıs!') : text('Qáte — keyingi soraw moslanadı')}
                      </p>
                      {deltaLabel && (
                        <p className="mt-1 text-xs opacity-80">
                          {deltaLabel}: θ {formatDelta(thetaDelta)}
                        </p>
                      )}
                      {nextHint && HINT_COPY[nextHint] && (
                        <p className="mt-1 text-xs opacity-75">{text(HINT_COPY[nextHint])}</p>
                      )}
                    </div>
                  )}
                  {error && (
                    <div className="mt-4">
                      <p className="text-sm text-rose-700">{text(error)}</p>
                      <p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                        {text(KAA.adaptivePlayErrorFree)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          to="/tutor/practice?from=adaptive"
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-950"
                        >
                          <Icon name="bolt" /> {text(KAA.practiceNav)}
                        </Link>
                        <Link
                          to="/quiz"
                          className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
                        >
                          <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
                        </Link>
                        <Link
                          to="/crossword"
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-white px-3.5 py-1.5 text-xs font-bold text-amber-950"
                        >
                          <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                        </Link>
                      </div>
                    </div>
                  )}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/[0.06] pt-5">
                    <button
                      type="button"
                      disabled={busy || picked !== null}
                      onClick={abandonSoft}
                      className="px-4 py-2 text-sm text-ink/50 underline-offset-4 hover:text-teal-900 hover:underline disabled:opacity-40"
                    >
                      {text(KAA.adaptiveAbandon)}
                    </button>
                    <Link
                      to="/tutor/practice?from=adaptive"
                      className="qp-chip text-teal-950"
                    >
                      <Icon name="bolt" /> {text(KAA.adaptiveLater)}
                    </Link>
                  </div>
                </div>
              </ProtectedContent>
            )}

            {phase === 'done' && result && (
              <div className="quiz-result-pop qp-surface px-7 py-10 text-center">
                <Icon name="trophy" className="mb-4 text-4xl text-amber-600" />
                <h2 className="mb-2 font-display text-3xl">{text('Tamamlandı')}</h2>
                <p className="mb-2 text-ink/60">
                  {result.score}/{result.total} · θ {Number(result.theta).toFixed(2)}
                  {result.sessionThetaDelta != null && (
                    <span className="ml-1 text-ink/45">
                      ({formatDelta(result.sessionThetaDelta)})
                    </span>
                  )}
                </p>
                {result.earlyEnd || result.reason === 'bank_exhausted' ? (
                  <p className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                    {text(KAA.adaptiveBankExhausted)}
                  </p>
                ) : null}
                {result.points && (
                  <div className="mx-auto mb-4 max-w-xs rounded-2xl border border-amber-400/40 bg-amber-50/80 px-4 py-3">
                    <p className="text-sm font-bold text-amber-800">
                      ⭐ +{result.points.earned} {text('ball islendi')}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/55">
                      {text('Balans')}: <b>{result.points.balance}</b> · {text('Dáreje')}:{' '}
                      <b>{result.points.level}</b>
                    </p>
                    {result.points.leveledUp && (
                      <div className={`mt-3 rounded-xl border border-teal-400/25 bg-teal-50/80 px-3 py-2 ${anim.checkinPop}`}>
                        <p className="text-xs font-bold text-teal-950">{text(KAA.levelUpTitle)}</p>
                        <p className="mt-0.5 text-[0.7rem] text-teal-900/70">
                          {text(KAA.levelUpBody)
                            .replace('{from}', String(result.points.previousLevel || '?'))
                            .replace('{to}', String(result.points.level))}
                        </p>
                        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                          <Link
                            to="/quiz"
                            className="inline-flex items-center gap-1 rounded-full bg-teal-700 px-3 py-1 text-[0.65rem] font-bold text-white"
                          >
                            {text(KAA.faqTryQuiz)}
                          </Link>
                          <Link
                            to="/profile"
                            className="inline-flex items-center gap-1 rounded-full border border-teal-400/30 bg-white px-3 py-1 text-[0.65rem] font-bold text-teal-950"
                          >
                            {text(KAA.profil)}
                          </Link>
                          <Link
                            to="/crossword"
                            className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-50 px-3 py-1 text-[0.65rem] font-bold text-amber-950"
                          >
                            <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                          </Link>
                          <Link
                            to="/dictionary/game"
                            className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-white px-3 py-1 text-[0.65rem] font-bold text-teal-950"
                          >
                            <Icon name="gamepad" /> {text(KAA.dictStatsStartGame)}
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {(() => {
                  const wrong = Math.max(0, (result.total || 0) - (result.score || 0));
                  const hasMistakes = wrong > 0;
                  const focusHref = quizPracticeHref(result.practice || readQuizPractice());
                  const primaryHref = dueRemediationPrimaryHref({ hasMistakes });
                  const secondaryHref = dueRemediationSecondaryHref({
                    focusHref,
                    hasMistakes,
                  });
                  return (
                    <>
                      {hasMistakes ? (
                        <p className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-50/70 px-4 py-3 text-sm text-rose-950">
                          {text(`${wrong} qáte · ${KAA.practiceFromQuizTutor}`)}
                        </p>
                      ) : (
                        <p className="mb-4 text-sm text-ink/50">
                          {text(KAA.practiceFromQuizPerfect)}
                        </p>
                      )}
                      <p className="mb-6 text-xs text-ink/40">
                        {text(
                          'Adaptiv rejimde juwap analizı kórsetilmeydi — sorawlar bankı jasırın qaladı.'
                        )}
                      </p>
                      <div className="flex flex-wrap justify-center gap-3">
                        {hasMistakes ? (
                          <>
                            <Link
                              to={primaryHref || '/tutor'}
                              className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-700 to-emerald-700 px-6 py-2.5 text-sm font-semibold text-white`}
                            >
                              <Icon name="tutor" /> {text(KAA.hozirQayta)}
                            </Link>
                            {secondaryHref ? (
                              <Link
                                to={secondaryHref}
                                className="rounded-full border border-teal-700/40 px-6 py-2.5 text-sm font-semibold text-teal-900"
                              >
                                <Icon name="gamepad" /> {text(KAA.qateMashq)}
                              </Link>
                            ) : null}
                            <Link
                              to="/tutor/practice?from=adaptive"
                              className="rounded-full border border-teal-700/40 px-6 py-2.5 text-sm font-semibold text-teal-900"
                            >
                              {text(KAA.practiceTitle)}
                            </Link>
                          </>
                        ) : (
                          <Link
                            to="/tutor/practice?from=adaptive"
                            className={`${anim.shine} rounded-full bg-teal-800 px-6 py-2.5 text-sm font-semibold text-white`}
                          >
                            {text(KAA.practiceTitle)}
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPhase('ready');
                            reload();
                          }}
                          className="rounded-full border border-teal-700/40 px-6 py-2.5 text-sm font-semibold text-teal-900"
                        >
                          {text('Jáne')}
                        </button>
                        <Link
                          to="/profile"
                          className="rounded-full border border-ink/15 px-6 py-2.5 text-sm text-ink/70"
                        >
                          {text(KAA.profil)}
                        </Link>
                        <ShareResultButton
                          title={text(KAA.shareAdaptiveTitle)}
                          text={text(KAA.shareAdaptiveText)
                            .replace('{score}', String(result.score ?? 0))
                            .replace('{total}', String(result.total ?? 0))
                            .replace('{theta}', Number(result.theta).toFixed(2))}
                          url={
                            typeof window !== 'undefined'
                              ? `${window.location.origin}/quiz/adaptive`
                              : undefined
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-6 py-2.5 text-sm font-semibold text-teal-950"
                        />
                      </div>
                      {!isAuthenticated ? (
                        <GuestSoftContinue className="mt-5 text-left" bodyKey="authGuestFreeBody" />
                      ) : null}
                      <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                        {text(KAA.adaptiveDoneFree)}
                      </p>
                      <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-3" />
                    </>
                  );
                })()}
              </div>
            )}
          </section>
        </DictShell>
      </PageGate>
    </>
  );
}
