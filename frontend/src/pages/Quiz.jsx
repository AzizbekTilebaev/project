import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import {
  answerAttemptQuestion,
  fetchActiveAttempt,
  fetchAttempt,
  fetchAnswerReview,
  fetchMyAttempts,
  fetchQuizzes,
  finalizeAttempt,
  startQuizAttempt,
  unlockAnswerReview,
  viewAttemptQuestion,
  abandonAdaptiveQuiz,
} from '../api/quizzes';
import {
  clearRememberedAttempt,
  getAgeConsent,
  getRememberedAttempt,
  getContinueQuiz,
  rememberAttempt,
  setAgeConsentLocal,
} from '../lib/anonymousId';
import { clearAdaptiveContinue, getContinueAdaptive } from '../lib/adaptiveProgress';
import Icon from '../components/Icon';
import ProtectedContent from '../components/ProtectedContent';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { useGuestQuota } from '../hooks/useGuestQuota';
import { AnimIconDivider, AnimChevron, anim, PageEnter } from '../animations';
import { KAA } from '../i18n/kaa';
import { formatDurationMs, formatCountdownSec } from '../lib/formatDuration';
import useResumeTick from '../hooks/useResumeTick';
import { recordQuizPracticeComplete, readQuizPractice } from '../lib/quizProgress';
import { markFirstRunPathComplete } from '../lib/firstRunProgress';
import { quizPracticeHref } from '../lib/readingPractice';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import SoftNextRow from '../components/SoftNextRow';
import { useAuth } from '../contexts/AuthContext';
import {
  dueRemediationPrimaryHref,
  dueRemediationSecondaryHref,
  dueRemediationDictHref,
} from '../lib/dueRemediation';

const LEVEL_LABELS = {
  beginner: 'Baslawısh',
  intermediate: 'Orta',
  advanced: 'Joqarı',
};

const CATEGORY_THEMES = {
  history: {
    label: 'Tariyx',
    icon: 'scroll',
    medallion: 'bg-gradient-to-br from-amber-500 to-orange-600',
    chip: 'bg-amber-100 text-amber-900',
    bar: 'from-amber-400 to-orange-500',
    ring: 'group-hover:border-amber-500/50',
  },
  grammar: {
    label: 'Grammatika',
    icon: 'grammar',
    medallion: 'bg-gradient-to-br from-teal-600 to-emerald-700',
    chip: 'bg-emerald-100 text-emerald-900',
    bar: 'from-teal-500 to-emerald-500',
    ring: 'group-hover:border-teal-600/50',
  },
  vocabulary: {
    label: 'Sózlik qorı',
    icon: 'book',
    medallion: 'bg-gradient-to-br from-sky-500 to-teal-700',
    chip: 'bg-sky-100 text-sky-900',
    bar: 'from-sky-400 to-teal-500',
    ring: 'group-hover:border-sky-500/50',
  },
};

const DEFAULT_THEME = {
  label: 'Test',
  icon: 'sparkle',
  medallion: 'bg-gradient-to-br from-teal-600 to-teal-800',
  chip: 'bg-teal-100 text-teal-900',
  bar: 'from-teal-500 to-teal-700',
  ring: 'group-hover:border-teal-600/50',
};

const themeFor = (category) => CATEGORY_THEMES[category] || DEFAULT_THEME;

// Har bir variant harfiga o'z rangi
const OPTION_STYLES = [
  {
    badge: 'bg-teal-700/10 text-teal-800 border-teal-700/40',
    hover: 'hover:border-teal-600/60 hover:bg-teal-50/70',
  },
  {
    badge: 'bg-amber-500/10 text-amber-700 border-amber-600/40',
    hover: 'hover:border-amber-500/60 hover:bg-amber-50/70',
  },
  {
    badge: 'bg-teal-500/10 text-teal-700 border-teal-500/40',
    hover: 'hover:border-teal-500/60 hover:bg-teal-50/70',
  },
  {
    badge: 'bg-rose-500/10 text-rose-700 border-rose-500/40',
    hover: 'hover:border-rose-500/60 hover:bg-rose-50/70',
  },
  {
    badge: 'bg-sky-500/10 text-sky-700 border-sky-500/40',
    hover: 'hover:border-sky-500/60 hover:bg-sky-50/70',
  },
];

function ScoreRing({ score, total, status }) {
  const { text } = useUiScript();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 120);
    return () => clearTimeout(t);
  }, []);
  const R = 56;
  const C = 2 * Math.PI * R;
  const ratio = total > 0 ? score / total : 0;
  const pct = Math.round(ratio * 100);
  const stroke =
    pct >= 80 ? '#0f9d8a' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative inline-flex items-center justify-center quiz-result-pop">
      <svg width="150" height="150" viewBox="0 0 150 150" className="quiz-score-ring -rotate-90">
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(28,42,36,0.08)" strokeWidth="11" />
        <circle
          cx="75"
          cy="75"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={shown ? C * (1 - ratio) : C}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl text-ink tracking-tight leading-none">
          {score}
          <span className="text-lg text-ink/45">/{total}</span>
        </span>
        <span className="text-xs font-semibold mt-1" style={{ color: stroke }}>
          {status === 'partial' ? text('Shala') : `${pct}%`}
        </span>
      </div>
    </div>
  );
}

function remainingLabel(deadlineIso, serverSkewMs) {
  if (!deadlineIso) return null;
  const left = new Date(deadlineIso).getTime() - (Date.now() + serverSkewMs);
  return Math.max(0, Math.ceil(left / 1000));
}

function TimerPill({ icon, label, seconds, danger }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        danger
          ? 'bg-red-600 text-white quiz-timer--danger'
          : 'bg-white/70 border border-ink/10 text-ink/70'
      }`}
    >
      <Icon name={icon} className={danger ? 'text-white' : 'text-teal-800'} />
      {label}: {formatDurationMs(Math.max(0, Number(seconds) || 0) * 1000)}
    </span>
  );
}

/** Soraw waqti — namunadagidek aylana bo'ylab kamayadigan countdown ring */
function CountdownRing({ seconds, limit }) {
  const { text } = useUiScript();
  const R = 30;
  const C = 2 * Math.PI * R;
  const safeLimit = limit && limit > 0 ? limit : Math.max(seconds, 1);
  const ratio = Math.max(0, Math.min(1, seconds / safeLimit));
  const danger = seconds <= 10;
  const stroke = danger ? '#ef4444' : ratio <= 0.5 ? '#f59e0b' : '#0f9d8a';
  return (
    <div
      className={`relative inline-flex h-[86px] w-[86px] items-center justify-center rounded-full bg-white shadow-[0_14px_35px_-15px_rgba(28,42,36,0.45)] ${
        danger ? 'quiz-timer--danger' : ''
      }`}
      role="timer"
      aria-label={text(`Soraw waqtı: ${formatDurationMs(seconds * 1000)} qaldı`)}
    >
      <svg width="86" height="86" viewBox="0 0 86 86" className="quiz-countdown -rotate-90">
        <circle cx="43" cy="43" r={R} fill="none" stroke="rgba(28,42,36,0.08)" strokeWidth="7" />
        <circle
          cx="43"
          cy="43"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - ratio)}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-display font-bold tracking-tight ${
          seconds >= 60 ? 'text-lg' : 'text-2xl'
        }`}
        style={{ color: danger ? '#ef4444' : '#1c2a24' }}
      >
        {seconds >= 60 ? formatCountdownSec(seconds) : seconds}
      </span>
    </div>
  );
}

export default function Quiz() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { quizAdvanceMode } = useAppSettings();
  const { requireQuiz, GateModal, reload: reloadQuota } = useGuestQuota();
  usePageMeta(
    text('Testler'),
    text('Qaraqalpaq tili boyınsha testler — bilimińizdi sınań.')
  );

  const { id: routeId } = useParams();
  const navigate = useNavigate();

  const {
    status: listStatus,
    data: listData,
    error: listLoadError,
    reload: reloadList,
  } = usePageData(
    () =>
      loadPageBundle(
        {
          quizzes: async () => {
            const res = await fetchQuizzes();
            return res.quizzes || [];
          },
        },
        {
          stats: async () => {
            const res = await fetchMyAttempts(20, { detailed: true });
            return res.attempts || [];
          },
        }
      ),
    { enabled: !routeId, deps: [] }
  );

  const quizzes = listData?.quizzes || [];
  const statsAttempts = listData?.stats || [];
  const resumeTick = useResumeTick();
  const [abandonedFlash, setAbandonedFlash] = useState(false);
  const [abandonBusy, setAbandonBusy] = useState(false);
  const continueQuiz = useMemo(() => {
    const raw = getContinueQuiz();
    if (!raw) return null;
    const fromList = quizzes.find((q) => String(q.id) === String(raw.quizId));
    return {
      ...raw,
      title: raw.title || fromList?.title || '',
    };
  }, [quizzes, resumeTick]);
  const continueAdaptive = useMemo(() => getContinueAdaptive(), [resumeTick]);

  const [error, setError] = useState(null);

  const [consentStep, setConsentStep] = useState(null); // { quizId }
  const [ageInput, setAgeInput] = useState('');

  const [attempt, setAttempt] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null); // { isCorrect, correctIndex, givenIndex }
  const [submitting, setSubmitting] = useState(false);
  const [report, setReport] = useState(null); // natija
  const [review, setReview] = useState(null); // ochilgan javoblar tahlili
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setReview(null);
    setReviewErr('');
  }, [report?.attemptId]);

  useEffect(() => {
    if (!report?.attemptId) return;
    if (report.status === 'partial') return;
    markFirstRunPathComplete('quiz');
    if (!report.practice) return;
    recordQuizPracticeComplete({
      titleIds: report.practice.titleIds || [],
      missedIds: report.practice.missedIds || [],
    });
  }, [report?.attemptId, report?.practice, report?.status]);

  const questionStartedRef = useRef(null);
  const serverSkewRef = useRef(0);
  const goNextRef = useRef(null);

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [attempt]);

  const applyAttempt = useCallback((state) => {
    if (!state) return;
    if (state.serverNow) {
      serverSkewRef.current = new Date(state.serverNow).getTime() - Date.now();
    }
    setAttempt(state);
    setIndex(state.currentIndex || 0);
    const q = state.questions?.[state.currentIndex || 0];
    const existing = q ? state.answers?.[q.id] : null;
    setPicked(existing != null ? existing : null);
    questionStartedRef.current = Date.now();
    rememberAttempt(state.quizId, state.attemptId, {
      title: state.title,
      currentIndex: state.currentIndex || 0,
      total: state.questions?.length || 0,
    });
  }, []);

  const beginWithConsent = async (quizId, { ageConsent, ageYears }) => {
    setError(null);
    setReport(null);
    setStatusMsg('');
    setConsentStep(null);
    try {
      setAgeConsentLocal({ consent: ageConsent, ageYears: ageYears ?? null });
      const data = await startQuizAttempt(quizId, { ageConsent, ageYears });
      applyAttempt(data.attempt);
      navigate(`/quiz/${quizId}`, { replace: false });
      window.scrollTo({ top: 0, behavior: 'instant' });
    } catch (e) {
      if (e.code === 'GUEST_QUIZ_LIMIT' || e.status === 403) {
        requireQuiz();
        reloadQuota();
        return;
      }
      setError(e.message || 'Testti ashıw múmkin bolmadı.');
    }
  };

  const openQuiz = async (id, { syncRoute = true } = {}) => {
    try {
      setError(null);
      setReport(null);
      setStatusMsg('');

      const active = await fetchActiveAttempt(id);
      if (active.attempt && active.attempt.status === 'in_progress') {
        applyAttempt(active.attempt);
        if (syncRoute) navigate(`/quiz/${id}`, { replace: false });
        return;
      }

      if (!requireQuiz()) return;

      const remembered = getRememberedAttempt();
      if (remembered?.quizId === id && remembered.attemptId) {
        try {
          const resumed = await fetchAttempt(remembered.attemptId);
          if (resumed.attempt?.status === 'in_progress') {
            applyAttempt(resumed.attempt);
            if (syncRoute) navigate(`/quiz/${id}`, { replace: false });
            return;
          }
          clearRememberedAttempt();
        } catch {
          clearRememberedAttempt();
        }
      }

      const saved = getAgeConsent();
      if (saved.consent === true && saved.ageYears) {
        await beginWithConsent(id, { ageConsent: true, ageYears: saved.ageYears });
        return;
      }
      if (saved.consent === false) {
        await beginWithConsent(id, { ageConsent: false, ageYears: null });
        return;
      }
      setConsentStep({ quizId: id });
      if (syncRoute) navigate(`/quiz/${id}`, { replace: false });
    } catch {
      setError('Testti ashıw múmkin bolmadı yamasa sorawlar joq.');
    }
  };

  useEffect(() => {
    if (!routeId) return;
    if (attempt?.quizId === routeId || report?.quizId === routeId || consentStep?.quizId === routeId) {
      return;
    }
    openQuiz(routeId, { syncRoute: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const question = attempt?.questions?.[index] || null;
  const isLast = attempt ? index === attempt.questions.length - 1 : false;

  const totalLeft = useMemo(
    () => remainingLabel(attempt?.totalDeadlineAt, serverSkewRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt?.totalDeadlineAt, tick]
  );
  const questionLeft = useMemo(
    () => remainingLabel(attempt?.questionDeadlineAt, serverSkewRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempt?.questionDeadlineAt, tick]
  );

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;
    if (totalLeft === 0) {
      (async () => {
        try {
          setSubmitting(true);
          const data = await finalizeAttempt(attempt.attemptId, { partial: true });
          setReport(data);
          setAttempt(null);
          clearRememberedAttempt();
          setStatusMsg('Waqıt túsdi — nátiyje saqlandı');
        } catch {
          setError('Waqıt túsdi, biraq nátiyjeni saqlaw múmkin bolmadı.');
        } finally {
          setSubmitting(false);
        }
      })();
    }
  }, [totalLeft, attempt]);

  const pick = async (optionIndex) => {
    if (picked !== null || !question || !attempt) return;
    if (questionLeft === 0) {
      setError('Bul soraw waqtı túsdi.');
      return;
    }
    setPicked(optionIndex);
    setLastAnswer(null);
    setStatusMsg(`Juwap saqlandı: ${String.fromCharCode(65 + optionIndex)}`);
    const spent = Date.now() - (questionStartedRef.current || Date.now());
    try {
      const data = await answerAttemptQuestion(attempt.attemptId, {
        questionId: question.id,
        optionIndex,
        timeSpentMs: spent,
      });
      applyAttempt(data.attempt);
      setPicked(optionIndex);
      const feedback = data.lastAnswer || null;
      setLastAnswer(feedback);
      if (feedback) {
        setStatusMsg(
          feedback.isCorrect
            ? text('Durıs!')
            : text(`Qáte — durıs: ${feedback.correctAnswer || ''}`)
        );
      }
      if (quizAdvanceMode === 'next') {
        const delay = feedback && !feedback.isCorrect ? 1400 : 550;
        window.setTimeout(() => {
          goNextRef.current?.();
        }, delay);
      }
    } catch (e) {
      setPicked(null);
      setLastAnswer(null);
      setError(e.message || 'Juwaptı saqlaw múmkin bolmadı.');
    }
  };

  const goNext = async () => {
    if (!question || picked === null || !attempt) return;
    if (isLast) {
      setSubmitting(true);
      try {
        const data = await finalizeAttempt(attempt.attemptId, { partial: false });
        setReport(data);
        setAttempt(null);
        clearRememberedAttempt();
        setStatusMsg(`Nátiyje: ${data.score}/${data.total}`);
      } catch (e) {
        setError(e.message || 'Nátiyjedi esaplaw múmkin bolmadı.');
      } finally {
        setSubmitting(false);
      }
      return;
    }
    const next = index + 1;
    try {
      const data = await viewAttemptQuestion(attempt.attemptId, next);
      applyAttempt(data.attempt);
      setPicked(null);
      setLastAnswer(null);
      setStatusMsg('');
    } catch (e) {
      setError(e.message || 'Keyingi sorawǵa ótiw múmkin bolmadı.');
    }
  };
  goNextRef.current = goNext;

  const finishPartial = async () => {
    if (!attempt) return;
    setSubmitting(true);
    try {
      const data = await finalizeAttempt(attempt.attemptId, { partial: true });
      setReport(data);
      setAttempt(null);
      clearRememberedAttempt();
      setAbandonedFlash(true);
    } catch (e) {
      setError(
        e.message ||
          'Shala juwmaqlaw múmkin bolmadı — kórilgen sorawlardıń bárine juwap beriń.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const abandonQuizContinue = async () => {
    const snap = getContinueQuiz();
    if (!snap?.attemptId || abandonBusy) {
      clearRememberedAttempt();
      return;
    }
    setAbandonBusy(true);
    setError(null);
    try {
      await finalizeAttempt(snap.attemptId, { partial: true });
    } catch {
      /* local clear anyway */
    } finally {
      clearRememberedAttempt();
      setAbandonedFlash(true);
      setAbandonBusy(false);
      reloadList();
    }
  };

  const abandonAdaptiveContinue = async () => {
    const snap = getContinueAdaptive();
    if (!snap?.attemptId || abandonBusy) {
      clearAdaptiveContinue();
      return;
    }
    setAbandonBusy(true);
    setError(null);
    try {
      await abandonAdaptiveQuiz(snap.attemptId);
    } catch {
      /* local clear anyway */
    } finally {
      clearAdaptiveContinue();
      setAbandonedFlash(true);
      setAbandonBusy(false);
    }
  };

  const backToList = () => {
    setAttempt(null);
    setReport(null);
    setError(null);
    setStatusMsg('');
    setConsentStep(null);
    navigate('/quiz');
  };

  return (
    <>
    {GateModal}
    <DictShell className="pt-24 pb-24">
      <section className="relative max-w-3xl mx-auto px-6 md:px-10 pt-8">
        <div className="sr-only" aria-live="polite">
          {text(statusMsg)}
        </div>

        {consentStep && !attempt && !report && (
          <div className="quiz-result-pop relative overflow-hidden qp-surface px-7 py-10 md:px-10 shadow-[0_24px_60px_-30px_rgba(15,92,86,0.35)]">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-teal-500/10 blur-2xl" aria-hidden />
            <div className="absolute -bottom-12 -left-8 w-44 h-44 rounded-full bg-amber-400/10 blur-2xl" aria-hidden />
            <span className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white items-center justify-center mb-5 shadow-lg shadow-teal-900/20">
              <Icon name="users" className="text-2xl" />
            </span>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70 mb-3">
              {text('Statistika')}
            </p>
            <h1 className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-4">
              {text('Jasıńızdı qosasız ba?')}
            </h1>
            <p className="text-ink/65 leading-relaxed mb-6 max-w-lg">
              {text(
                'Eger jasıńızdı qosıwdı qálemeseniz, statistikanı kóriw múmkinshiligi bolmaydı. Jas tek topar salıstırıwları ushın isletiledi; jeke maǵlıwmat saqlanbaydı.'
              )}
            </p>
            <label className="block text-sm text-ink/60 mb-2" htmlFor="age-input">
              {text('Jas (ixtiyarıy, razılıq penen)')}
            </label>
            <input
              id="age-input"
              type="number"
              min={5}
              max={120}
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value)}
              className="w-full max-w-xs rounded-xl border border-teal-800/20 bg-white/90 px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
              placeholder={text('Mısalı: 16')}
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  const age = Number(ageInput);
                  if (!Number.isInteger(age) || age < 5 || age > 120) {
                    setError('Jas 5–120 aralıǵında bolıwı kerek.');
                    return;
                  }
                  beginWithConsent(consentStep.quizId, { ageConsent: true, ageYears: age });
                }}
                className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 text-white text-sm font-semibold tracking-wide uppercase hover:from-teal-800 hover:to-emerald-800 transition-all shadow-lg shadow-teal-900/20 hover:shadow-teal-900/30 hover:-translate-y-0.5"
              >
                {text('Awa, jasımdı qosaman')}
              </button>
              <button
                type="button"
                onClick={() =>
                  beginWithConsent(consentStep.quizId, { ageConsent: false, ageYears: null })
                }
                className="px-7 py-3.5 rounded-xl border border-teal-800/40 text-teal-900 text-sm font-semibold tracking-wide uppercase hover:bg-teal-900 hover:text-parchment transition-colors"
              >
                {text('Joq, statistikasız dawam')}
              </button>
              <button
                type="button"
                onClick={backToList}
                className="px-5 py-3.5 text-sm text-ink/50 hover:text-ink"
              >
                {text('Biykarlaw')}
              </button>
            </div>
            {error && <p className="mt-4 text-red-800/80">{text(error)}</p>}

            <div className="mt-8 border-t border-teal-700/10 pt-5">
              <SoftNextRow
                primaryTo="/games"
                primaryIcon="trophy"
                primaryLabelKey="oyinlar"
                secondaryTo="/literature"
                secondaryIcon="scroll"
                secondaryLabelKey="adebiyat"
              />
            </div>
          </div>
        )}

        {routeId && !attempt && !report && !consentStep && !error && (
          <p className="py-16 text-center text-ink/55">
            <Icon name="loader" className="mr-2 animate-spin" />
            {text('Test júklenip atır...')}
          </p>
        )}

        {routeId && !attempt && !report && !consentStep && error && (
          <div className="py-16 text-center">
            <p className="mb-6 text-red-800/80">{text(error)}</p>
            <button
              type="button"
              onClick={backToList}
              className="mb-6 border border-teal-800/40 px-7 py-3.5 text-sm font-semibold uppercase tracking-wide text-teal-900 transition-colors hover:bg-teal-900 hover:text-parchment"
            >
              {text('Testlerge qaytıw')}
            </button>
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
              {text(KAA.quizStartErrorFree)}
            </p>
            <SoftNextRow
              primaryTo="/games"
              primaryIcon="trophy"
              primaryLabelKey="oyinlar"
              secondaryTo="/literature"
              secondaryIcon="scroll"
              secondaryLabelKey="adebiyat"
            />
          </div>
        )}

        {!attempt && !report && !routeId && !consentStep && (
          <PageGate
            status={listStatus}
            error={listLoadError}
            onRetry={reloadList}
            backHref="/games"
            backLabel={text(KAA.oyinlar)}
          >
          <PageEnter>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70 mb-2">
              {text('Oynaw')}
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight mb-2">
              {text('Testler')}
            </h1>
            <AnimIconDivider amber className="mb-4" />
            <p className="text-ink/60 text-lg leading-relaxed mb-6 max-w-xl">
              {text(
                'Qaraqalpaq tili boyınsha qısqa testler — tariyx, grammatika hám sózlik. Bir testti ashıń hám oynań.'
              )}
            </p>
            <p className="mb-8 text-sm font-semibold text-teal-900/70">{text(KAA.guestQuizLimit)}</p>

            {continueQuiz && (
              <div className="mb-6">
                <p className="mb-2 text-xs text-emerald-900/65">{text(KAA.quizResumeHint)}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={continueQuiz.href}
                    className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white`}
                  >
                    <Icon name="trophy" /> {text(KAA.continueQuiz)}
                    {continueQuiz.title ? (
                      <span className="max-w-[12rem] truncate font-semibold opacity-90">
                        · {text(continueQuiz.title)}
                      </span>
                    ) : null}
                    {continueQuiz.total != null && continueQuiz.currentIndex != null ? (
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                        {text(KAA.continueQuizProgress)
                          .replace('{a}', String(continueQuiz.currentIndex + 1))
                          .replace('{b}', String(continueQuiz.total))}
                      </span>
                    ) : null}
                    <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                  </Link>
                  <button
                    type="button"
                    disabled={abandonBusy}
                    onClick={abandonQuizContinue}
                    className="rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink/55 hover:text-teal-900 disabled:opacity-50"
                  >
                    {text(KAA.quizAbandon)}
                  </button>
                </div>
              </div>
            )}

            {continueAdaptive && (
              <div className="mb-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={continueAdaptive.href}
                    className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-sky-800 px-4 py-2.5 text-sm font-bold text-white`}
                  >
                    <Icon name="sparkle" /> {text(KAA.continueAdaptive)}
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                      {text(KAA.continueAdaptiveProgress)
                        .replace('{a}', String((continueAdaptive.currentIndex || 0) + 1))
                        .replace('{b}', String(continueAdaptive.total || 10))}
                    </span>
                    <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                  </Link>
                  <button
                    type="button"
                    disabled={abandonBusy}
                    onClick={abandonAdaptiveContinue}
                    className="rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink/55 hover:text-teal-900 disabled:opacity-50"
                  >
                    {text(KAA.quizDiscard)}
                  </button>
                </div>
              </div>
            )}

            {!continueQuiz && !continueAdaptive && abandonedFlash && (
              <p className="mb-6 text-xs text-ink/50">{text(KAA.quizAbandonedHint)}</p>
            )}

            {quizzes.length > 0 && statsAttempts.length === 0 && !continueQuiz && !continueAdaptive && (
              <div className="mb-8">
                <a
                  href="#quiz-list"
                  className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                >
                  <Icon name="trophy" /> {text(KAA.quizColdPick)}
                </a>
              </div>
            )}

            <div className="mb-10">
              <Link
                to="/quiz/room"
                className="inline-flex w-full items-center gap-3 rounded-2xl border border-teal-700/20 bg-teal-50/60 px-5 py-4 transition-colors hover:bg-teal-50 sm:w-auto"
              >
                <Icon name="users" className="text-2xl text-teal-700/80" />
                <span>
                  <span className="block font-display text-xl tracking-tight text-ink">
                    {text('Kóp oyınshılı test')}
                  </span>
                  <span className="block text-sm text-ink/55">
                    {text('Bólme jaratıw yamasa qosılıw')}
                  </span>
                </span>
                <AnimChevron count={2} className="ml-auto opacity-60" />
              </Link>
            </div>

            {quizzes.length === 0 && (
              <div className="mb-8 qp-surface motion-rise border-dashed px-6 py-10 text-center">
                <p className="text-ink/55">{text('Házirshe test joq.')}</p>
                <p className="mt-2 text-sm text-ink/45">{text(KAA.quizColdEmptyHint)}</p>
                <Link
                  to="/games"
                  className={`${anim.shine} mt-5 qp-btn-primary !px-4 !py-2 !text-xs`}
                >
                  <Icon name="trophy" /> {text(KAA.oyinlar)}
                </Link>
              </div>
            )}

            <div id="quiz-list" className="grid scroll-mt-28 gap-5">
              {quizzes.map((quiz, qi) => {
                const theme = themeFor(quiz.category);
                return (
                  <button
                    key={quiz.id}
                    type="button"
                    onClick={() => openQuiz(quiz.id)}
                    style={{ animationDelay: `${qi * 0.08}s` }}
                    className={`quiz-card-shine animate-dict-row group text-left qp-panel px-6 py-6 md:px-8 transition-all duration-300 hover:-translate-y-1 hover:bg-white/85 hover:shadow-[0_24px_60px_-25px_rgba(15,92,86,0.45)] ${theme.ring}`}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={`shrink-0 w-14 h-14 rounded-2xl ${theme.medallion} text-white inline-flex items-center justify-center text-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                      >
                        <Icon name={theme.icon} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2 mb-2.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] ${theme.chip}`}
                          >
                            {text(theme.label)}
                          </span>
                          <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink/60">
                            {text(LEVEL_LABELS[quiz.level] || quiz.level)}
                          </span>
                          <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink/60">
                            {quiz.questionCount} {text('soraw')}
                          </span>
                          {quiz.timeMode === 'timed' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-red-700">
                              <Icon name="clock" /> {text('Waqıtlı')}
                            </span>
                          )}
                        </span>
                        <span className="block font-display text-2xl text-ink tracking-tight group-hover:text-teal-900 transition-colors mb-1.5">
                          {text(quiz.title)}
                        </span>
                        <span className="block text-ink/55 leading-relaxed">
                          {text(quiz.description)}
                        </span>
                        <span
                          className={`mt-4 block h-1 w-16 rounded-full bg-gradient-to-r ${theme.bar} transition-all duration-300 group-hover:w-28`}
                          aria-hidden
                        />
                      </span>
                      <AnimChevron
                        count={2}
                        className="hidden sm:inline-flex shrink-0 self-center opacity-40 group-hover:opacity-90"
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-14 qp-panel px-6 py-6">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/55 inline-flex items-center gap-2">
                  <Icon name="trophy" className="text-teal-600" /> {text('Statistika')}
                </p>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline underline-offset-4"
                >
                  {text(KAA.profil)}
                  <AnimChevron count={2} className="opacity-60" />
                </Link>
              </div>
              {statsAttempts.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-sm text-ink/50">{text(KAA.eleTestJoq)}</p>
                  <p className="mt-1 text-xs text-ink/40">{text(KAA.eleTestHint)}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    {quizzes.length > 0 ? (
                      <a
                        href="#quiz-list"
                        className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                      >
                        <Icon name="trophy" /> {text(KAA.quizColdPick)}
                      </a>
                    ) : (
                      <Link
                        to="/games"
                        className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                      >
                        <Icon name="trophy" /> {text(KAA.oyinlar)}
                      </Link>
                    )}
                  </div>
                </div>
              )}
              <ul className="space-y-3">
                {statsAttempts.slice(0, 8).map((a) => {
                  const pctVal = a.total ? Math.round((a.score / a.total) * 100) : 0;
                  const cat = CATEGORY_THEMES[a.category] || DEFAULT_THEME;
                  return (
                    <li
                      key={a.id}
                      className="qp-card qp-card--static px-4 py-3"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-ink truncate">{text(a.title)}</span>
                        <span className="text-sm font-bold text-ink/70">
                          {a.score}/{a.total} ({pctVal}%)
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink/45">
                        <span className={`rounded-full px-2 py-0.5 font-bold uppercase ${cat.chip}`}>
                          {text(cat.label)}
                        </span>
                        {a.playMode && (
                          <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 uppercase">
                            {text(a.playMode)}
                          </span>
                        )}
                        {a.completedAt && (
                          <span>{new Date(a.completedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${cat.bar}`}
                          style={{ width: `${pctVal}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </PageEnter>
          </PageGate>
        )}

        {attempt && !report && question && (
          <ProtectedContent>
          <div>
            <button
              type="button"
              onClick={backToList}
              className="inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4 mb-8"
            >
              <Icon name="left" /> {text('Testler')}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70">
                {text(attempt.title)}
              </p>
              {totalLeft != null && (
                <TimerPill
                  icon="clock"
                  label={text('Jámi')}
                  seconds={totalLeft}
                  danger={totalLeft <= 30}
                />
              )}
            </div>

            {/* Nomerlangan qadamlar — berilgan GIF namunasidagi progress */}
            <div
              className="relative flex items-center justify-between mb-3 px-1"
              aria-label={text('Test progressi')}
            >
              <span
                className="absolute left-5 right-5 top-1/2 h-2 -translate-y-1/2 rounded-full bg-ink/10"
                aria-hidden
              />
              <span
                className="absolute left-5 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-400 transition-[width] duration-500 ease-out"
                style={{
                  width:
                    attempt.questions.length > 1
                      ? `calc((100% - 2.5rem) * ${index / (attempt.questions.length - 1)})`
                      : 'calc(100% - 2.5rem)',
                }}
                aria-hidden
              />
              {attempt.questions.map((q, qi) => {
                const answered = attempt.answers?.[q.id] != null;
                const isCurrent = qi === index;
                const complete = qi < index || answered;
                return (
                  <span
                    key={q.id}
                    className={`relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                      isCurrent
                        ? 'scale-110 bg-teal-950 text-white shadow-lg shadow-teal-900/30 ring-4 ring-teal-200/60'
                        : complete
                          ? 'bg-teal-600 text-white shadow-md'
                          : 'bg-teal-100 text-teal-700 border-2 border-white/80'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {complete && !isCurrent ? <Icon name="check" /> : qi + 1}
                  </span>
                );
              })}
            </div>
            <p className="text-sm text-ink/50 mb-8">
              <span className="font-bold text-teal-900">{index + 1}</span> / {attempt.questions.length}{' '}
              {text('soraw')}
              {' · '}
              <span className="text-emerald-700 font-semibold">
                {Object.keys(attempt.answers || {}).length} {text('juwap berildi')}
              </span>
            </p>

            {questionLeft != null && (
              <div className="flex justify-center mb-6">
                <CountdownRing seconds={questionLeft} limit={question.timeLimitSeconds} />
              </div>
            )}

            <div key={question.id} className="quiz-question-enter">
              <h2 className="font-display text-3xl md:text-4xl text-ink tracking-tight mb-8 text-center">
                {text(question.question)}
              </h2>

              <div className="grid gap-3" role="group" aria-label={text('Juwap variantları')}>
                {question.options.map((option, idx) => {
                  const isPicked = idx === picked;
                  const isCorrectOpt =
                    lastAnswer && lastAnswer.correctIndex != null && idx === lastAnswer.correctIndex;
                  const isWrongPick =
                    lastAnswer && isPicked && lastAnswer.isCorrect === false;
                  const style = OPTION_STYLES[idx % OPTION_STYLES.length];
                  let cls = `quiz-option rounded-2xl border-2 border-ink/[0.08] bg-white/60 cursor-pointer px-5 py-4 text-left leading-relaxed ${style.hover} disabled:opacity-50 disabled:cursor-not-allowed`;
                  if (isCorrectOpt && lastAnswer) {
                    cls =
                      'quiz-option quiz-option--picked quiz-option--correct-pop rounded-2xl border-2 border-emerald-600 bg-gradient-to-r from-emerald-700 to-teal-700 text-parchment px-5 py-4 text-left shadow-lg shadow-emerald-900/25';
                  } else if (isWrongPick) {
                    cls =
                      'quiz-option quiz-option--picked quiz-option--wrong rounded-2xl border-2 border-rose-500 bg-gradient-to-r from-rose-700 to-rose-800 text-parchment px-5 py-4 text-left shadow-lg shadow-rose-900/25';
                  } else if (isPicked && !lastAnswer) {
                    cls =
                      'quiz-option quiz-option--picked rounded-2xl border-2 border-teal-600 bg-gradient-to-r from-teal-800 to-emerald-800 text-parchment px-5 py-4 text-left shadow-lg shadow-teal-900/25';
                  }
                  return (
                    <button
                      key={`${question.id}-${idx}`}
                      type="button"
                      disabled={picked !== null || questionLeft === 0}
                      aria-pressed={isPicked}
                      onClick={() => pick(idx)}
                      className={cls}
                    >
                      <span className="inline-flex items-start gap-3.5 w-full">
                        <span
                          className={`shrink-0 w-8 h-8 rounded-xl border-2 inline-flex items-center justify-center text-sm font-bold transition-colors ${
                            isCorrectOpt || isWrongPick || isPicked
                              ? 'border-parchment/40 bg-white/15 text-parchment'
                              : style.badge
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="pt-1">
                          {text(option)}
                          {isCorrectOpt && lastAnswer && (
                            <span className="sr-only"> — {text('durıs')}</span>
                          )}
                          {isWrongPick && <span className="sr-only"> — {text('qáte')}</span>}
                        </span>
                        {isCorrectOpt && lastAnswer ? (
                          <Icon name="check-circle" className="ml-auto self-center text-xl text-emerald-200" />
                        ) : isWrongPick ? (
                          <Icon name="x-circle" className="ml-auto self-center text-xl text-rose-200" />
                        ) : isPicked ? (
                          <Icon name="check-circle" className="ml-auto self-center text-xl text-emerald-300" />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              {lastAnswer && (
                <p
                  className={`mt-4 text-center text-sm font-semibold ${
                    lastAnswer.isCorrect ? 'text-emerald-800' : 'text-rose-800'
                  }`}
                  aria-live="polite"
                >
                  {lastAnswer.isCorrect
                    ? text('Durıs juwap!')
                    : text('Qáte — jasıl variant durıs juwap.')}
                </p>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={finishPartial}
                  disabled={submitting}
                  className="px-5 py-3 text-sm text-ink/55 hover:text-teal-900 underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {text(KAA.quizAbandon)}
                </button>
                <Link
                  to="/games"
                  className="qp-chip text-teal-950"
                >
                  <Icon name="trophy" /> {text(KAA.quizLater)}
                </Link>
              </div>
              {picked !== null && (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={submitting}
                  className="quiz-result-pop inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 text-white text-sm font-bold tracking-wide uppercase hover:from-teal-800 hover:to-emerald-800 transition-all shadow-lg shadow-teal-900/25 hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Icon name="loader" className="animate-spin" /> {text('Esaplanıp atır...')}
                    </>
                  ) : isLast ? (
                    <>
                      <Icon name="trophy" /> {text('Nátiyje')}
                    </>
                  ) : (
                    <>
                      {text('Keyingi')} <Icon name="right" />
                    </>
                  )}
                </button>
              )}
            </div>
            {error && <p className="text-red-800/80 mt-4">{text(error)}</p>}
          </div>
          </ProtectedContent>
        )}

        {report && (
          <div>
            <div className="relative overflow-hidden qp-surface motion-success px-7 py-10 md:px-10 text-center mb-10 shadow-[0_28px_70px_-32px_rgba(15,92,86,0.4)]">
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/55 mb-5">
                {text(report.title)}
              </p>

              <ScoreRing score={report.score} total={report.total} status={report.status} />

              <p className="font-display text-2xl text-ink tracking-tight mt-4 mb-2">
                {report.status === 'partial'
                  ? text('Shala juwmaqlandı')
                  : report.score === report.total
                    ? text('Ájayıp! Barlıǵı durıs! 🏆')
                    : report.score >= report.total * 0.6
                      ? text('Júdá jaqsı nátiyje!')
                      : text('Jáne bir urınıp kóriń.')}
              </p>

              <div className="flex flex-wrap justify-center gap-2.5 mt-5 mb-7">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-3.5 py-1.5 text-sm font-semibold">
                  <Icon name="check-circle" /> {report.score} {text('durıs')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 text-rose-700 px-3.5 py-1.5 text-sm font-semibold">
                  <Icon name="x-circle" />{' '}
                  {report.wrongCount ?? Math.max(0, report.total - report.score)} {text('qáte')}
                </span>
                {report.analytics?.available && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                      report.analytics.percentVsCohort >= 0
                        ? 'bg-teal-100 text-teal-900'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    <Icon name="users" /> {report.analytics.age} {text('jaslılardan')}{' '}
                    {Math.abs(report.analytics.percentVsCohort)}%{' '}
                    {report.analytics.percentVsCohort >= 0 ? text('joqarı') : text('tómen')}
                  </span>
                )}
              </div>

              {report.points && (
                <div className="mx-auto mb-7 max-w-md rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-50/90 to-yellow-50/70 px-5 py-4">
                  <p className="text-sm font-bold text-amber-800">
                    ⭐ +{report.points.earned} {text('ball islendi')}
                    {report.points.breakdown?.multiplier < 1 && (
                      <span className="ml-1 text-xs font-medium text-amber-700/70">
                        ({text('qayta urınıw')} ×{report.points.breakdown.multiplier})
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink/55">
                    {text('Balans')}: <b>{report.points.balance}</b> {text('ball')} · {text('Dáreje')}:{' '}
                    <b>{report.points.level}</b>
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-500"
                      style={{ width: `${Math.round((report.points.levelProgress || 0) * 100)}%` }}
                    />
                  </div>
                  {report.points.leveledUp && (
                    <div
                      className={`mt-4 rounded-2xl border border-teal-400/30 bg-gradient-to-br from-teal-50/90 to-white px-4 py-3 ${anim.checkinPop}`}
                    >
                      <p className="text-sm font-bold text-teal-950">{text(KAA.levelUpTitle)}</p>
                      <p className="mt-0.5 text-xs text-teal-900/70">
                        {text(KAA.levelUpBody)
                          .replace('{from}', String(report.points.previousLevel || '?'))
                          .replace('{to}', String(report.points.level))}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <Link
                          to="/quiz"
                          className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white`}
                        >
                          <Icon name="trophy" /> {text(KAA.testler)}
                        </Link>
                        <Link
                          to="/profile"
                          className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
                        >
                          <Icon name="user" /> {text(KAA.profil)}
                        </Link>
                        <Link
                          to="/crossword"
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-950"
                        >
                          <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {report.analytics?.available && (
                <p className="text-sm text-ink/50 mb-6">
                  {text('Topar')}: {report.analytics.cohortSize} {text('adam')} · {text('ortasha')}{' '}
                  {report.analytics.avgScore}
                </p>
              )}
              {report.analytics && !report.analytics.available && report.ageConsent && (
                <p className="text-ink/50 text-sm mb-6">
                  {text('Statistika ushın jetkilikli maǵlıwmat joq (keminde 5 adam kerek).')}
                </p>
              )}
              {!report.ageConsent && (
                <p className="text-ink/50 text-sm mb-6">
                  {text('Jas razılıǵı berilmegen — tek test nátiyjesi kórsetiledi.')}
                </p>
              )}

              {(() => {
                const wrong =
                  report.wrongCount ?? Math.max(0, (report.total || 0) - (report.score || 0));
                const hasMistakes = wrong > 0;
                const focusHref = quizPracticeHref(report.practice || readQuizPractice());
                const primaryHref = dueRemediationPrimaryHref({ hasMistakes });
                const secondaryHref = dueRemediationSecondaryHref({
                  focusHref,
                  hasMistakes,
                });
                return (
                  <>
                    {hasMistakes && (
                      <p className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-50/70 px-4 py-3 text-sm text-rose-950">
                        {text(`${wrong} qáte · ${KAA.practiceFromQuizTutor}`)}
                      </p>
                    )}
                    {!hasMistakes && report.score === report.total && (
                      <p className="mb-4 text-sm text-ink/50">{text(KAA.practiceFromQuizPerfect)}</p>
                    )}
                    <div className="flex flex-wrap justify-center gap-3">
                      {hasMistakes ? (
                        <>
                          <Link
                            to={primaryHref || '/games'}
                            className={`${anim.shine} inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold tracking-wide uppercase text-white shadow-lg bg-gradient-to-r from-teal-700 to-emerald-700 shadow-teal-900/25 transition-all hover:-translate-y-0.5`}
                          >
                            <Icon name="trophy" /> {text(KAA.hozirQayta)}
                          </Link>
                          {secondaryHref ? (
                            <Link
                              to={secondaryHref}
                              className="inline-flex items-center gap-2 rounded-xl border border-teal-800/40 px-7 py-3.5 text-sm font-semibold tracking-wide uppercase text-teal-900 transition-all hover:-translate-y-0.5 hover:bg-teal-900 hover:text-parchment"
                            >
                              <Icon name="gamepad" /> {text(KAA.qateMashq)}
                            </Link>
                          ) : null}
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openQuiz(report.quizId)}
                        className={`inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold tracking-wide uppercase transition-all hover:-translate-y-0.5 ${
                          hasMistakes
                            ? 'border border-teal-800/40 text-teal-900 hover:bg-teal-900 hover:text-parchment'
                            : 'bg-gradient-to-r from-teal-700 to-emerald-700 text-white shadow-lg shadow-teal-900/25 hover:from-teal-800 hover:to-emerald-800'
                        }`}
                      >
                        <Icon name="bolt" /> {text('Jáne sınaw')}
                      </button>
                      <Link
                        to="/profile"
                        className="inline-flex items-center gap-2 rounded-xl border border-ink/15 px-6 py-3.5 text-sm font-semibold tracking-wide uppercase text-ink/70 transition hover:border-teal-700/30 hover:text-teal-900"
                      >
                        <Icon name="user" /> {text(KAA.profil)}
                      </Link>
                      <ShareResultButton
                        title={text(KAA.shareQuizTitle)}
                        text={text(KAA.shareQuizText)
                          .replace('{title}', text(report.title || KAA.testler))
                          .replace('{score}', String(report.score ?? 0))
                          .replace('{total}', String(report.total ?? 0))}
                        url={
                          report.quizId && typeof window !== 'undefined'
                            ? `${window.location.origin}/quiz/${encodeURIComponent(report.quizId)}`
                            : undefined
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-teal-700/25 bg-white px-6 py-3.5 text-sm font-semibold tracking-wide uppercase text-teal-950 transition hover:-translate-y-0.5"
                      />
                      <button
                        type="button"
                        onClick={backToList}
                        className="rounded-xl border border-ink/10 px-6 py-3.5 text-sm font-semibold tracking-wide uppercase text-ink/55 transition hover:text-teal-900"
                      >
                        {text('Basqa testler')}
                      </button>
                    </div>
                    {!isAuthenticated ? (
                      <GuestSoftContinue className="mt-6 text-left" bodyKey="authGuestFreeBody" />
                    ) : null}
                    <SoftNextRow
                      className="mt-6"
                      primaryTo="/games"
                      primaryIcon="trophy"
                      primaryLabelKey="oyinlar"
                      secondaryTo="/literature"
                      secondaryIcon="scroll"
                      secondaryLabelKey="adebiyat"
                    />
                  </>
                );
              })()}
            </div>

            {report.analytics?.available && report.analytics.ageGroups?.length > 0 && (
              <div className="mb-10 qp-card qp-card--static px-6 py-6">
                <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/55 mb-5 inline-flex items-center gap-2">
                  <Icon name="users" className="text-teal-800" /> {text('Jas toparları boyınsha')}
                </p>
                <ul className="space-y-3">
                  {report.analytics.ageGroups.map((g) => {
                    const isMine = g.age === report.analytics.age;
                    return (
                      <li key={g.age} className="flex items-center gap-3 text-sm">
                        <span
                          className={`w-12 font-semibold ${
                            isMine ? 'text-teal-900' : 'text-ink/50'
                          }`}
                        >
                          {g.age} {text('jas')}
                        </span>
                        <div className="flex-1 h-3.5 rounded-full bg-ink/[0.07] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isMine
                                ? 'bg-gradient-to-r from-teal-500 to-emerald-500'
                                : 'bg-gradient-to-r from-ink/20 to-ink/30'
                            }`}
                            style={{
                              width: `${Math.min(100, (g.avgScore / report.total) * 100)}%`,
                            }}
                          />
                        </div>
                        <span
                          className={`w-20 text-right ${
                            isMine ? 'font-bold text-teal-900' : 'text-ink/60'
                          }`}
                        >
                          {g.avgScore} ({g.count})
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {review ? (
              <div className="qp-panel px-6 py-8">
                <h2 className="font-display text-2xl text-ink mb-1 inline-flex items-center gap-2">
                  <Icon name="check-circle" className="text-teal-800" /> {text('Juwaplar analizı')}
                </h2>
                <p className="text-sm text-ink/50 mb-6">
                  {text('Hár soraw boyınsha siziń juwabıńız hám durıs juwap.')}
                </p>
                <ol className="space-y-4">
                  {review.results.map((r, i) => (
                    <li
                      key={r.id}
                      className={`rounded-2xl border px-5 py-4 ${
                        r.correct
                          ? 'border-emerald-300/50 bg-emerald-50/50'
                          : 'border-rose-300/50 bg-rose-50/40'
                      }`}
                    >
                      <p className="font-semibold text-ink mb-2">
                        {i + 1}. {text(r.question)}
                      </p>
                      <ul className="space-y-1.5 text-sm">
                        {r.options.map((opt, oi) => {
                          const isCorrect = oi === r.correctIndex;
                          const isGiven = oi === r.givenIndex;
                          return (
                            <li
                              key={oi}
                              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ${
                                isCorrect
                                  ? 'bg-emerald-100 text-emerald-900 font-semibold'
                                  : isGiven
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'text-ink/60'
                              }`}
                            >
                              {isCorrect ? (
                                <Icon name="check-circle" />
                              ) : isGiven ? (
                                <Icon name="x-circle" />
                              ) : (
                                <span className="inline-block w-4" />
                              )}
                              {text(opt)}
                              {isGiven && !isCorrect && (
                                <span className="ml-auto text-xs font-bold uppercase">
                                  {text('siz')}
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      {r.givenIndex == null && (
                        <p className="mt-2 text-xs text-ink/45">{text('Juwap berilmegen')}</p>
                      )}
                      {r.timeSpentMs != null && (
                        <p className="mt-2 text-xs text-ink/40">
                          {text('Waqıt')}: {formatDurationMs(r.timeSpentMs)}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                <div className="mt-6">
                  <SoftNextRow
                    primaryTo="/games"
                    primaryIcon="trophy"
                    primaryLabelKey="oyinlar"
                    secondaryTo="/literature"
                    secondaryIcon="scroll"
                    secondaryLabelKey="adebiyat"
                  />
                </div>
              </div>
            ) : report.reviewAccess?.available ? (
              <div className="relative overflow-hidden qp-surface px-6 py-8 text-center">
                <span className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-teal-400/15 blur-2xl" aria-hidden />
                <span className="relative mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-600 text-2xl text-white shadow-lg">
                  <Icon name={report.reviewAccess.unlocked ? 'check-circle' : 'lock'} />
                </span>
                <h2 className="relative font-display text-2xl text-ink">
                  {text('Juwaplardı tekseriw')}
                </h2>
                <p className="relative mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink/55">
                  {report.reviewAccess.unlocked
                    ? text('Juwaplar ashılǵan — tolıq analizdı kóriwińiz múmkin.')
                    : text(
                        `Qáteler hám durıs juwaplar analizi ${report.reviewAccess.cost} ballǵa ashıladı. Balansıńız: ${report.reviewAccess.balance ?? 0} ball.`
                      )}
                </p>
                {reviewErr && (
                  <p className="relative mt-3 text-sm text-rose-700">{text(reviewErr)}</p>
                )}
                <div className="relative mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    disabled={reviewBusy}
                    onClick={async () => {
                      setReviewBusy(true);
                      setReviewErr('');
                      try {
                        if (!report.reviewAccess.unlocked) {
                          await unlockAnswerReview(report.attemptId);
                          setReport((r) => ({
                            ...r,
                            reviewAccess: { ...r.reviewAccess, unlocked: true, cost: 0 },
                          }));
                        }
                        const data = await fetchAnswerReview(report.attemptId);
                        setReview(data);
                      } catch (e) {
                        setReviewErr(e.message || 'Ashıw múmkin bolmadı');
                      } finally {
                        setReviewBusy(false);
                      }
                    }}
                    className="rounded-full bg-teal-700 px-6 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                  >
                    {reviewBusy
                      ? text('Júklenip atır...')
                      : report.reviewAccess.unlocked
                        ? text('Juwaplardı kóriw')
                        : text(`${report.reviewAccess.cost} ballǵa ashıw`)}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </DictShell>
    </>
  );
}
