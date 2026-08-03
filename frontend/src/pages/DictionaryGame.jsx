import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  checkDictQuizAnswer,
  fetchDictQuizHistory,
  fetchQuiz,
  fetchWordOfDay,
  fetchWordOfDayCheckin,
  finalizeDictQuiz,
} from '../api/tusindirme';
import usePageMeta from '../hooks/usePageMeta';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ProtectedContent from '../components/ProtectedContent';
import { useUiScript } from '../contexts/UiScriptContext';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import useRecentWords from '../hooks/useRecentWords';
import { KAA } from '../i18n/kaa';
import { anim, AnimIconDivider, AnimChevron } from '../animations';
import {
  armGoalCelebration,
  getDailyGoalStatus,
  markWoDPracticedIfCorrect,
} from '../lib/dailyGoalProgress';
import { sourceExitHref, sourceExitLabelKey } from '../lib/recentPractice';
import { favoritesPracticeHref } from '../lib/readingPractice';
import { applyImmersionPracticeResults } from '../lib/immersionProgress';
import { applyReadingPracticeResults } from '../lib/readingProgress';
import { applyCrosswordPracticeResults } from '../lib/crosswordProgress';
import { applyJumbaqPracticeResults } from '../lib/jumbaqProgress';
import { applyQuizPracticeResults } from '../lib/quizProgress';
import {
  applyFavoritesPracticeResults,
  seedFavoritesPractice,
  readFavoritesPractice,
} from '../lib/favoritesProgress';
import {
  clearDictGameContinue,
  dictGameSessionKey,
  getContinueDictGame,
  touchDictGameContinue,
} from '../lib/dictGameProgress';
import useResumeTick from '../hooks/useResumeTick';
import { emitResumeChanged } from '../lib/resumeEvents';
import { markFirstRunPathComplete } from '../lib/firstRunProgress';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import SoftNextRow from '../components/SoftNextRow';
import { useAuth } from '../contexts/AuthContext';

const QUESTION_COUNT = 10;
const BEST_KEY = 'dict_game_best';
const MIN_FOCUS = 3;
const WRITEBACK_EXITS = new Set([
  'immersion',
  'reading',
  'crossword',
  'jumbaq',
  'favorites',
  'quiz',
]);

function isTypedProduceKind(kind) {
  return kind === 'produce' || kind === 'produce_reverse';
}

// Quiz sahifasidagi kabi — har harfga o'z rangi
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
];

function readBest() {
  try {
    const v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

export default function DictionaryGame() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceRaw = String(searchParams.get('source') || 'all').toLowerCase();
  const source =
    sourceRaw === 'favorites' ||
    sourceRaw === 'mistakes' ||
    sourceRaw === 'checkin' ||
    sourceRaw === 'recent' ||
    sourceRaw === 'focused'
      ? sourceRaw
      : 'all';
  const idsParam = String(searchParams.get('ids') || '');
  const idsFromQuery = useMemo(
    () =>
      idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40),
    [idsParam]
  );
  const { items: favItems, count: favCount } = useDictionaryFavorites();
  const { items: recentItems } = useRecentWords();
  const autoStarted = useRef(false);

  usePageMeta(
    text(
      source === 'favorites'
        ? KAA.unatqanMashq
        : source === 'mistakes'
          ? KAA.qateMashq
          : source === 'focused'
            ? KAA.practiceReading
            : source === 'recent'
              ? KAA.recentMashq
              : source === 'checkin'
                ? KAA.checkinMashq
                : 'Sóz oyını'
    ),
    text(
      source === 'favorites'
        ? KAA.unatqanMashqTush
        : source === 'mistakes'
          ? KAA.qateMashqTush
          : source === 'focused'
            ? KAA.practiceReadingDesc
            : source === 'recent'
              ? KAA.practiceRecentDesc
              : source === 'checkin'
                ? KAA.checkinMashqTush
                : 'Sózdiń durıs anıqlamasın tabıń — sózlik boyınsha oyın.'
    )
  );

  const [phase, setPhase] = useState(
    source === 'favorites' ||
      source === 'mistakes' ||
      source === 'checkin' ||
      source === 'recent' ||
      source === 'focused'
      ? 'loading'
      : 'start'
  ); // start | loading | play | done | error | needMore
  const [questions, setQuestions] = useState([]);
  const [roundId, setRoundId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [outcomeById, setOutcomeById] = useState({});
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [correctIndex, setCorrectIndex] = useState(null);
  const [correctLemma, setCorrectLemma] = useState(null);
  const [correctGloss, setCorrectGloss] = useState(null);
  const [nearMiss, setNearMiss] = useState(false);
  const [produceText, setProduceText] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [best, setBest] = useState(readBest);
  const [history, setHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const [pointsAward, setPointsAward] = useState(null);
  const [softGoal, setSoftGoal] = useState(null);
  const [abandonedFlash, setAbandonedFlash] = useState(false);
  const resumeTick = useResumeTick();
  const continueSnap = useMemo(() => getContinueDictGame(), [resumeTick, phase]);
  const goalParam = searchParams.get('goal');
  const currentSessionKey = useMemo(
    () =>
      dictGameSessionKey({
        source,
        ids: idsFromQuery,
        goal: goalParam,
      }),
    [source, idsFromQuery, goalParam]
  );

  useEffect(() => {
    fetchDictQuizHistory(8)
      .then((d) => setHistory(d.rounds || []))
      .catch(() => setHistory([]));
  }, [phase]);

  const applyContinue = useCallback((snap) => {
    if (!snap?.questions?.length || !snap.roundId) return false;
    setQuestions(snap.questions);
    setRoundId(snap.roundId);
    setAnswers(snap.answers || {});
    setIndex(Math.min(snap.index || 0, snap.questions.length - 1));
    setScore(snap.score || 0);
    setStreak(snap.streak || 0);
    setBestStreak(snap.bestStreak || 0);
    setPicked(snap.picked != null ? snap.picked : null);
    setCorrectIndex(snap.correctIndex != null ? snap.correctIndex : null);
    setCorrectLemma(snap.correctLemma || null);
    setCorrectGloss(snap.correctGloss || null);
    setNearMiss(Boolean(snap.nearMiss));
    setProduceText('');
    setPointsAward(null);
    setErrorMsg('');
    setAbandonedFlash(false);
    setPhase('play');
    return true;
  }, []);

  const abandonSoft = useCallback(() => {
    clearDictGameContinue();
    setQuestions([]);
    setRoundId(null);
    setAnswers({});
    setOutcomeById({});
    setIndex(0);
    setPicked(null);
    setCorrectIndex(null);
    setCorrectLemma(null);
    setCorrectGloss(null);
    setNearMiss(false);
    setProduceText('');
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setPointsAward(null);
    setErrorMsg('');
    setAbandonedFlash(true);
    setPhase('start');
  }, []);

  const start = useCallback(async () => {
    if (source === 'favorites' && favCount < MIN_FOCUS) {
      setPhase('needMore');
      return;
    }
    clearDictGameContinue();
    setAbandonedFlash(false);
    setPhase('loading');
    setErrorMsg('');
    setPointsAward(null);
    setIndex(0);
    setPicked(null);
    setCorrectIndex(null);
    setCorrectLemma(null);
    setCorrectGloss(null);
    setNearMiss(false);
    setProduceText('');
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setAnswers({});
    setOutcomeById({});
    try {
      let opts = {};
      if (source === 'favorites') {
        opts = {
          source: 'favorites',
          titleIds: favItems.map((x) => x.id).filter(Boolean),
        };
      } else if (source === 'mistakes') {
        opts = { source: 'mistakes' };
      } else if (source === 'focused') {
        if (searchParams.get('exit') === 'favorites' && idsFromQuery.length) {
          seedFavoritesPractice(idsFromQuery);
        }
        opts = {
          source: 'focused',
          titleIds: idsFromQuery,
        };
      } else if (source === 'checkin' || source === 'recent') {
        const seed = [
          ...idsFromQuery,
          ...recentItems.map((x) => x.id),
          ...favItems.map((x) => x.id),
        ].filter(Boolean);
        opts = {
          source,
          titleIds: [...new Set(seed)].slice(0, 40),
        };
      }
      const res = await fetchQuiz(QUESTION_COUNT, opts);
      if (!res.data?.length) throw new Error('empty');
      setQuestions(res.data);
      setRoundId(res.roundId);
      setPhase('play');
    } catch (err) {
      setErrorMsg(err?.message || '');
      setPhase('error');
    }
  }, [source, favCount, favItems, recentItems, idsFromQuery, searchParams]);

  useEffect(() => {
    autoStarted.current = false;
  }, [source, idsParam, goalParam]);

  useEffect(() => {
    if (
      source !== 'favorites' &&
      source !== 'mistakes' &&
      source !== 'checkin' &&
      source !== 'recent' &&
      source !== 'focused'
    ) {
      return undefined;
    }
    if (autoStarted.current) return undefined;
    if (source === 'favorites' && favCount < MIN_FOCUS) {
      setPhase('needMore');
      return undefined;
    }
    if (source === 'focused' && idsFromQuery.length < 1) {
      setPhase('needMore');
      return undefined;
    }
    autoStarted.current = true;
    const snap = getContinueDictGame();
    if (snap && snap.sessionKey === currentSessionKey && applyContinue(snap)) {
      return undefined;
    }
    start();
    return undefined;
  }, [source, favCount, start, idsParam, goalParam, currentSessionKey, applyContinue]);

  const isWodGoal = source === 'checkin' && goalParam === 'wod';
  const exitHint = searchParams.get('exit');
  const exitHref = sourceExitHref(source, { isWodGoal, exit: exitHint });
  const exitLabelKey = sourceExitLabelKey(source, { isWodGoal, exit: exitHint });
  const exitLabel = KAA[exitLabelKey] || exitLabelKey;
  const softFavHref = favoritesPracticeHref(favItems, {
    practice: readFavoritesPractice(),
  });

  useEffect(() => {
    if (phase !== 'play' || !roundId || !questions.length) return;
    touchDictGameContinue({
      roundId,
      questions,
      answers,
      index,
      score,
      streak,
      bestStreak,
      picked,
      correctIndex,
      correctLemma,
      correctGloss,
      nearMiss,
      source,
      ids: idsFromQuery,
      goal: goalParam,
      exit: exitHint,
    });
  }, [
    phase,
    roundId,
    questions,
    answers,
    index,
    score,
    streak,
    bestStreak,
    picked,
    correctIndex,
    correctLemma,
    correctGloss,
    nearMiss,
    source,
    idsFromQuery,
    goalParam,
    exitHint,
  ]);

  useEffect(() => {
    if (phase === 'done') clearDictGameContinue();
  }, [phase]);

  const question = questions[index] || null;
  const isLast = index === questions.length - 1;

  const pick = async (optionIdx) => {
    if (picked !== null || !question || !roundId || isTypedProduceKind(question.kind)) return;
    setPicked(optionIdx);
    try {
      const res = await checkDictQuizAnswer(roundId, {
        questionId: question.id,
        optionIndex: optionIdx,
      });
      setCorrectIndex(res.correctIndex);
      setCorrectLemma(null);
      setCorrectGloss(null);
      setNearMiss(false);
      setAnswers((prev) => ({ ...prev, [question.id]: optionIdx }));
      setOutcomeById((prev) => ({ ...prev, [question.id]: Boolean(res.correct) }));
      if (res.correct) {
        setScore((s) => s + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        setStreak(0);
      }
    } catch {
      // Round waqıtı ótken bolsa — jańadan baslaw
      clearDictGameContinue();
      setPicked(null);
      setCorrectIndex(null);
      setErrorMsg('');
      setPhase('error');
    }
  };

  const submitProduce = async (event) => {
    event?.preventDefault?.();
    if (picked !== null || !question || !roundId || !isTypedProduceKind(question.kind)) return;
    const answer = String(produceText || '').trim();
    if (!answer) return;
    setPicked(answer);
    try {
      const res = await checkDictQuizAnswer(roundId, {
        questionId: question.id,
        answer,
      });
      setCorrectIndex(null);
      setCorrectLemma(res.correctLemma || null);
      setCorrectGloss(res.correctGloss || null);
      setNearMiss(Boolean(res.nearMiss));
      setAnswers((prev) => ({ ...prev, [question.id]: answer }));
      setOutcomeById((prev) => ({ ...prev, [question.id]: Boolean(res.correct) }));
      if (res.correct) {
        setScore((s) => s + 1);
        setStreak((s) => {
          const next = s + 1;
          setBestStreak((b) => Math.max(b, next));
          return next;
        });
      } else {
        setStreak(0);
      }
    } catch {
      clearDictGameContinue();
      setPicked(null);
      setCorrectLemma(null);
      setCorrectGloss(null);
      setNearMiss(false);
      setErrorMsg('');
      setPhase('error');
    }
  };

  useEffect(() => {
    if (phase !== 'done' || isWodGoal) {
      setSoftGoal(null);
      return undefined;
    }
    let cancelled = false;
    Promise.all([
      fetchWordOfDay().catch(() => null),
      fetchWordOfDayCheckin().catch(() => null),
    ]).then(([wodRes, cinRes]) => {
      if (cancelled) return;
      const titleId = cinRes?.checkin?.titleId || wodRes?.data?.id || null;
      const status = getDailyGoalStatus({
        claimedToday: cinRes?.checkin?.claimedToday,
        titleId,
      });
      setSoftGoal({ ...status, wodId: titleId ? String(titleId) : null });
    });
    return () => {
      cancelled = true;
    };
  }, [phase, isWodGoal]);

  const goNext = async () => {
    if (isLast) {
      try {
        if (roundId) {
          const res = await finalizeDictQuiz(roundId, {
            ...answers,
            [question.id]: picked,
          });
          if (res?.points) setPointsAward(res.points);
        }
      } catch {
        /* ignore */
      }
      const finalOutcomes = {
        ...outcomeById,
        [question.id]:
          outcomeById[question.id] != null
            ? outcomeById[question.id]
            : isTypedProduceKind(question.kind)
              ? false
              : picked === correctIndex,
      };
      if (isWodGoal && idsFromQuery[0]) {
        const marked = markWoDPracticedIfCorrect(idsFromQuery[0], finalOutcomes);
        if (marked.newlyMarked) armGoalCelebration();
      }
      if (WRITEBACK_EXITS.has(exitHint)) {
        const results = questions.map((q) => ({
          id: q.id,
          correct: Boolean(finalOutcomes[q.id]),
        }));
        if (exitHint === 'immersion') applyImmersionPracticeResults(results);
        else if (exitHint === 'reading') applyReadingPracticeResults(results);
        else if (exitHint === 'crossword') applyCrosswordPracticeResults(results);
        else if (exitHint === 'jumbaq') applyJumbaqPracticeResults(results);
        else if (exitHint === 'favorites') applyFavoritesPracticeResults(results);
        else if (exitHint === 'quiz') applyQuizPracticeResults(results);
      }
      setPhase('done');
      return;
    }
    setPicked(null);
    setCorrectIndex(null);
    setCorrectLemma(null);
    setCorrectGloss(null);
    setNearMiss(false);
    setProduceText('');
    setIndex((i) => i + 1);
  };

  // O'yin tugaganda rekordni saqlash
  useEffect(() => {
    if (phase !== 'done') return;
    markFirstRunPathComplete('play');
    setBest((prev) => {
      const next = Math.max(prev, score);
      try {
        localStorage.setItem(BEST_KEY, String(next));
        emitResumeChanged();
      } catch {
        // localStorage yopiq bo'lsa ham o'yin ishlashda davom etadi
      }
      return next;
    });
  }, [phase, score]);

  return (
    <DictShell className="pt-24 pb-24">
      <section className="relative max-w-3xl mx-auto px-6 md:px-10 pt-8">
        <div className="mb-8">
          <Link
            to={exitHref}
            className="inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4"
          >
            <Icon name="left" /> {text(exitLabel)}
          </Link>
        </div>

        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70 mb-2">
          {text(
            source === 'favorites'
              ? KAA.unatqanMashq
              : source === 'mistakes'
                ? KAA.qateMashq
                : source === 'recent'
                  ? KAA.recentMashq
                  : source === 'checkin'
                    ? KAA.checkinMashq
                    : 'Sóz oyını'
          )}
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight mb-2">
          {text('Durıs anıqlamanı tabıń')}
        </h1>
        <AnimIconDivider amber className="mb-8" />

        {phase === 'needMore' && (
          <div className="rounded-3xl border border-dashed border-rose-300/50 bg-rose-50/40 px-7 py-12 text-center">
            <Icon name="heart" className="mx-auto mb-4 text-3xl text-rose-500" />
            <p className="mb-2 font-display text-2xl text-ink">{text(KAA.unatqanAz)}</p>
            <p className="mb-2 text-sm font-semibold text-rose-900/80">
              {text(KAA.favProgress).replace('{count}', String(favCount))}
            </p>
            <p className="mb-6 text-ink/55">
              {text(KAA.favNeedN).replace('{n}', String(Math.max(0, MIN_FOCUS - favCount)))}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                to="/dictionary/all"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-900 px-6 py-3 text-sm font-bold text-white"
              >
                {text(KAA.favAddMore)}
                <AnimChevron count={2} style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              {softFavHref && (
                <Link
                  to={softFavHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-3 text-sm font-bold text-white"
                >
                  <Icon name="gamepad" /> {text(KAA.favSoftPractice)}
                </Link>
              )}
              <Link
                to="/dictionary/favorites"
                className="rounded-xl border border-teal-800/30 px-6 py-3 text-sm font-semibold text-teal-900"
              >
                {text(KAA.yoqtirilganlar)}
              </Link>
              <Link
                to="/dictionary/game"
                className="rounded-xl border border-teal-800/30 px-6 py-3 text-sm font-semibold text-teal-900"
              >
                {text(KAA.umumiyOyin)}
              </Link>
            </div>
            <p className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-rose-800/50">
              {text(KAA.dictGameNeedFree)}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                to="/tutor/practice"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
              >
                <Icon name="bolt" /> {text(KAA.practiceNav)}
              </Link>
              <Link
                to="/quiz"
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
              >
                <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
              </Link>
              <Link
                to="/crossword"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-white px-4 py-2 text-xs font-bold text-amber-950"
              >
                <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
              </Link>
              <Link
                to="/jumbaqlar"
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-950"
              >
                <Icon name="sparkle" /> {text(KAA.haptaliqCtaJumbaq)}
              </Link>
            </div>
          </div>
        )}

        {phase === 'start' && (
          <div className="quiz-result-pop relative overflow-hidden qp-surface px-7 py-9 md:px-10">
            <span
              className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-400/15 blur-2xl"
              aria-hidden
            />
            <span className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white items-center justify-center mb-5 text-2xl shadow-lg shadow-amber-900/20">
              <Icon name="gamepad" />
            </span>
            <p className="text-ink/70 text-lg leading-relaxed mb-3 max-w-xl">
              {text(
                `${QUESTION_COUNT} sóz beriledi — hár birine 4 anıqlama. Durısın tańlań, upaý jıynań hám rekord ornatıń.`
              )}
            </p>
            {favCount >= MIN_FOCUS && (
              <p className="mb-4">
                <Link
                  to="/dictionary/game?source=favorites"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-800 hover:underline"
                >
                  {text(KAA.unatqanMashq)} ({favCount})
                  <AnimChevron count={2} className="opacity-70" style={{ ['--dch-color']: '#9f1239' }} />
                </Link>
              </p>
            )}
            {best > 0 && (
              <p className="mb-7 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3.5 py-1.5 text-sm font-semibold text-amber-900">
                <Icon name="trophy" /> {text(`Sizdiń rekord: ${best}/${QUESTION_COUNT}`)}
              </p>
            )}
            {continueSnap ? (
              <p className="mb-4 text-xs text-sky-900/70">{text(KAA.dictGameResumeHint)}</p>
            ) : abandonedFlash ? (
              <p className="mb-4 text-xs text-ink/50">{text(KAA.dictGameAbandonedHint)}</p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {continueSnap && (
                <button
                  type="button"
                  onClick={() => {
                    const snap = getContinueDictGame() || continueSnap;
                    if (!snap) {
                      start();
                      return;
                    }
                    if (snap.sessionKey !== currentSessionKey) {
                      navigate(snap.href);
                      return;
                    }
                    if (!applyContinue(snap)) start();
                  }}
                  className={`${anim.shine} inline-flex items-center gap-2 rounded-xl bg-sky-800 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-sky-900/25 transition-all hover:-translate-y-0.5`}
                >
                  <Icon name="gamepad" /> {text(KAA.continueDictGame)}
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs normal-case tracking-normal">
                    {text(KAA.continueDictGameProgress)
                      .replace('{a}', String((continueSnap.index || 0) + 1))
                      .replace('{b}', String(continueSnap.total || QUESTION_COUNT))}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={start}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-amber-900/25 transition-all hover:-translate-y-0.5 hover:from-amber-600 hover:to-orange-700"
              >
                <Icon name="bolt" />{' '}
                {text(continueSnap ? KAA.continueDictGameFresh : 'Baslaw')}
              </button>
              {continueSnap && (
                <button
                  type="button"
                  onClick={abandonSoft}
                  className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-white px-5 py-4 text-sm font-semibold text-ink/55 hover:text-teal-900"
                >
                  {text(KAA.dictGameAbandon)}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <PageGate status="loading" loadingLabel="Sorawlar tayarlanıp atır..." />
        )}

        {phase === 'error' && (
          <div className="qp-surface px-7 py-12 text-center">
            <p className="text-ink/60 mb-2">{text('Sorawlardı júklew múmkin bolmadı.')}</p>
            {errorMsg ? (
              <p className="mb-5 text-sm text-ink/45">{text(errorMsg)}</p>
            ) : null}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={start}
                className="px-6 py-3 border border-teal-800/40 text-teal-900 text-sm font-medium uppercase tracking-wide hover:bg-teal-900 hover:text-parchment transition-colors"
              >
                {text('Qaytadan')}
              </button>
              {source !== 'all' && (
                <Link
                  to="/dictionary/game"
                  className="px-6 py-3 text-sm font-semibold text-teal-900 hover:underline"
                >
                  {text(KAA.umumiyOyin)}
                </Link>
              )}
            </div>
            <p className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
              {text(KAA.dictGameErrorFree)}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Link
                to="/tutor/practice"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
              >
                <Icon name="bolt" /> {text(KAA.practiceNav)}
              </Link>
              <Link
                to="/quiz"
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
              >
                <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
              </Link>
              <Link
                to="/crossword"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-white px-4 py-2 text-xs font-bold text-amber-950"
              >
                <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
              </Link>
              <Link
                to="/books"
                className="qp-chip text-ink/70"
              >
                <Icon name="book" /> {text(KAA.readingLandingCta)}
              </Link>
            </div>
          </div>
        )}

        {history.length > 0 && phase === 'start' && (
          <div className="mb-8 qp-panel p-5">
            <p className="text-xs uppercase tracking-widest text-ink/45 mb-3">
              {text('Sońǵı oyınlar')}
            </p>
            <ul className="space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between text-ink/70">
                  <span>
                    {h.score}/{h.total}
                  </span>
                  <span className="text-ink/40">
                    {h.completedAt ? new Date(h.completedAt).toLocaleDateString() : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase === 'start' && (best > 0 || history.length > 0) && (
          <div className="mb-8">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
              {text(KAA.dictGameStartFree)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/quiz"
                className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
              >
                <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
              </Link>
              <Link
                to="/crossword"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-950"
              >
                <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
              </Link>
              <Link
                to="/jumbaqlar"
                className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-950"
              >
                <Icon name="sparkle" /> {text(KAA.haptaliqCtaJumbaq)}
              </Link>
              <Link
                to="/dictionary/immersion"
                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-600/25 bg-cyan-50 px-3.5 py-1.5 text-xs font-bold text-cyan-950"
              >
                <Icon name="sparkle" /> {text(KAA.dawisliSozler)}
              </Link>
              <Link
                to="/books"
                className="qp-chip text-ink/70"
              >
                <Icon name="book" /> {text(KAA.readingLandingCta)}
              </Link>
            </div>
          </div>
        )}

        {phase === 'play' && questions.length > 0 && question && (
          <ProtectedContent label="dict-game">
          <div>
            {/* Progress */}
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-ink/50">
                <span className="font-bold text-teal-900">{index + 1}</span> / {questions.length}
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-800">
                  <Icon name="check-circle" /> {score}
                </span>
                {streak >= 2 && (
                  <span className="quiz-result-pop inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">
                    <Icon name="flame" filled /> {text(`${streak} qatar`)}
                  </span>
                )}
              </span>
            </div>
            <div className="h-2 rounded-full bg-ink/10 mb-8 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 transition-all duration-500"
                style={{ width: `${((index + (picked !== null ? 1 : 0)) / questions.length) * 100}%` }}
              />
            </div>

            <div key={question.id} className="quiz-question-enter">
              {isTypedProduceKind(question.kind) ? (
                <>
                  <div className="mb-7">
                    <p className="mb-2 text-[0.65rem] uppercase tracking-[0.18em] text-amber-800/70">
                      {text(
                        question.kind === 'produce_reverse'
                          ? KAA.dictGameProduceReverseLabel
                          : KAA.dictGameProduceLabel
                      )}
                    </p>
                    <p className="font-display text-2xl md:text-3xl text-ink tracking-tight leading-snug">
                      {text(question.prompt)}
                    </p>
                    <p className="text-ink/50 mt-3">
                      {text(
                        question.kind === 'produce_reverse'
                          ? KAA.dictGameProduceReverseHint
                          : KAA.dictGameProduceHint
                      )}
                    </p>
                  </div>
                  {picked === null ? (
                    <form onSubmit={submitProduce} className="space-y-3">
                      <input
                        type="text"
                        value={produceText}
                        onChange={(e) => setProduceText(e.target.value)}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={text(
                          question.kind === 'produce_reverse'
                            ? KAA.tutorProduceReversePlaceholder
                            : KAA.tutorProducePlaceholder
                        )}
                        className="w-full rounded-2xl border border-amber-600/25 bg-white/90 px-4 py-3.5 text-base text-ink outline-none ring-amber-500/30 focus:ring-2"
                      />
                      <button
                        type="submit"
                        disabled={!String(produceText || '').trim()}
                        className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {text(KAA.tutorProduceSubmit)}
                      </button>
                    </form>
                  ) : (
                    <div
                      className={`quiz-result-pop rounded-2xl px-4 py-3 text-sm font-semibold ${
                        outcomeById[question.id]
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-50 text-rose-900'
                      }`}
                      role="status"
                    >
                      {outcomeById[question.id]
                        ? nearMiss
                          ? text(KAA.tutorNearMissMsg)
                          : text(KAA.tutorCorrectMsg)
                        : text(KAA.tutorWrongMsg)}
                      {correctGloss || correctLemma ? (
                        <span className="mt-1 block font-display text-lg text-ink">
                          {text(correctGloss || correctLemma)}
                        </span>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <>
              <div className="mb-7">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-display text-4xl md:text-5xl text-ink tracking-tight">
                    {text(question.soz)}
                  </span>
                  {question.category && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-amber-800">
                      {text(question.category)}
                    </span>
                  )}
                </div>
                <p className="text-ink/50 mt-2">{text(KAA.dictGameMcqHint)}</p>
              </div>

              <div className="grid gap-3">
                {(question.options || []).map((option, idx) => {
                  const isCorrect = correctIndex != null && idx === correctIndex;
                  const isPicked = idx === picked;
                  const style = OPTION_STYLES[idx % OPTION_STYLES.length];
                  let cls = 'quiz-option rounded-2xl border-2 px-5 py-4 text-left leading-relaxed ';
                  if (picked === null) {
                    cls += `border-ink/[0.08] bg-white/60 cursor-pointer ${style.hover}`;
                  } else if (isCorrect) {
                    cls +=
                      'quiz-option--picked border-teal-600 bg-gradient-to-r from-teal-800 to-emerald-800 text-parchment shadow-lg shadow-teal-900/25';
                  } else if (isPicked) {
                    cls += 'border-rose-400/70 bg-rose-50 text-rose-900/80';
                  } else {
                    cls += 'border-ink/[0.06] bg-white/30 text-ink/40';
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={picked !== null}
                      aria-pressed={isPicked}
                      onClick={() => pick(idx)}
                      className={cls}
                    >
                      <span className="inline-flex items-start gap-3.5 w-full">
                        <span
                          className={`shrink-0 w-8 h-8 rounded-xl border-2 inline-flex items-center justify-center text-sm font-bold transition-colors ${
                            picked !== null && isCorrect
                              ? 'border-parchment/40 bg-white/15 text-parchment'
                              : picked !== null && isPicked
                                ? 'border-rose-400/60 bg-rose-100 text-rose-700'
                                : style.badge
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="pt-1">
                          {text(option)}
                          {picked !== null && isCorrect && (
                            <span className="sr-only"> {text('— durıs')}</span>
                          )}
                          {picked !== null && isPicked && !isCorrect && (
                            <span className="sr-only"> {text('— qáte')}</span>
                          )}
                        </span>
                        {picked !== null && isCorrect && (
                          <Icon
                            name="check-circle"
                            className="ml-auto self-center text-xl text-emerald-300"
                          />
                        )}
                        {picked !== null && isPicked && !isCorrect && (
                          <Icon
                            name="x-circle"
                            className="ml-auto self-center text-xl text-rose-500"
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
                </>
              )}
            </div>

            {picked !== null && (
              <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
                <Link
                  to={`/dictionary/${question.id}`}
                  className="text-sm text-teal-900 hover:underline underline-offset-4 inline-flex items-center gap-1.5"
                >
                  <Icon name="book" />{' '}
                  {text(`«${correctLemma || question.prompt || question.soz || ''}» sózin kóriw`)}
                </Link>
                <button
                  type="button"
                  onClick={goNext}
                  className="quiz-result-pop inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-amber-900/25 transition-all hover:-translate-y-0.5 hover:from-amber-600 hover:to-orange-700"
                >
                  {isLast ? (
                    <>
                      <Icon name="trophy" /> {text('Nátiyje')}
                    </>
                  ) : (
                    <>
                      {text('Keyingi')} <Icon name="right" />
                    </>
                  )}
                </button>
              </div>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-ink/[0.06] pt-5">
              <button
                type="button"
                disabled={picked !== null}
                onClick={abandonSoft}
                className="px-4 py-2 text-sm text-ink/50 underline-offset-4 hover:text-teal-900 hover:underline disabled:opacity-40"
              >
                {text(KAA.dictGameAbandon)}
              </button>
              <Link
                to={exitHref || '/tutor/practice'}
                className="qp-chip text-teal-950"
              >
                <Icon name="bolt" /> {text(KAA.dictGameLater)}
              </Link>
            </div>
          </div>
          </ProtectedContent>
        )}

        {phase === 'done' && (
          <div className="quiz-result-pop relative overflow-hidden qp-surface px-7 py-10 md:px-10 text-center">
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/40 mb-4">
              {text('Nátiyje')}
            </p>
            <p className="font-display text-6xl text-ink tracking-tight mb-2">
              {score}
              <span className="text-2xl text-ink/40">/{questions.length}</span>
            </p>
            <p className="text-ink/60 mb-4">
              {score === questions.length
                ? text('Ájayıp! Barlıǵı durıs!')
                : score >= questions.length * 0.7
                  ? text('Júdá jaqsı nátiyje!')
                  : score >= questions.length * 0.4
                    ? text('Jaman emes — jáne bir urınıp kóriń.')
                    : text('Sózlikti oqıp, jáne oynap kóriń.')}
            </p>
            {pointsAward && (pointsAward.earned > 0 || pointsAward.balance != null) && (
              <div className="mb-5 inline-flex flex-col items-center gap-1 rounded-2xl border border-amber-500/20 bg-amber-50/80 px-5 py-3">
                {pointsAward.earned > 0 ? (
                  <p className={`text-sm font-bold text-amber-900 ${anim.pointsFloat}`}>
                    {text(`+${pointsAward.earned} ball islendi`)}
                    {pointsAward.breakdown?.multiplier < 1 && (
                      <span className="ml-1 font-medium text-amber-800/70">
                        ({text('búgin qayta')} ×{pointsAward.breakdown.multiplier})
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-ink/55">
                    {text('Ball aldın berilgen')}
                  </p>
                )}
                {pointsAward.balance != null && (
                  <p className="text-xs text-ink/50">
                    {text('Balans')}: {pointsAward.balance} · {text('Dáreje')}:{' '}
                    {pointsAward.level ?? '—'}
                  </p>
                )}
              </div>
            )}
            {pointsAward?.leveledUp && (
              <div
                className={`mb-5 inline-flex flex-col items-center gap-2 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-50/90 to-teal-50/60 px-5 py-4 ${anim.checkinPop}`}
              >
                <p className="text-sm font-bold text-teal-950">{text(KAA.levelUpTitle)}</p>
                <p className="text-xs text-teal-900/70">
                  {text(KAA.levelUpBody)
                    .replace('{from}', String(pointsAward.previousLevel || '?'))
                    .replace('{to}', String(pointsAward.level))}
                </p>
                <div className="mt-1 flex flex-wrap justify-center gap-2">
                  <Link
                    to="/quiz"
                    className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-4 py-2 text-xs font-bold text-white`}
                  >
                    <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
                  </Link>
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                  >
                    <Icon name="user" /> {text(KAA.profil)}
                  </Link>
                  <Link
                    to="/crossword"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                  >
                    <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                  </Link>
                </div>
              </div>
            )}
            {isWodGoal && (
              <div
                className={`mb-5 inline-flex flex-col items-center gap-1 rounded-2xl border border-emerald-500/25 bg-emerald-50/90 px-5 py-3 ${anim.checkinPop}`}
              >
                <p className="text-sm font-bold text-emerald-900">
                  {text(KAA.dailyGoalFull)} · {text(KAA.dailyGoalDone)}
                </p>
                <p className="text-xs text-emerald-800/70">{text(KAA.dailyGoalCelebrate)}</p>
              </div>
            )}
            {!isWodGoal && softGoal && !softGoal.complete && (
              <div className="mb-5 rounded-2xl border border-amber-400/25 bg-amber-50/80 px-5 py-3 text-center">
                <p className="text-sm font-bold text-amber-950">{text(KAA.dailyGoalAfterPractice)}</p>
                <p className="mt-0.5 text-xs text-amber-900/65">
                  {text(softGoal.doneCount === 1 ? KAA.dailyGoalHalf : KAA.dailyGoalEmpty)}
                </p>
              </div>
            )}
            <div className="mb-8 flex flex-wrap justify-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-sm font-semibold text-amber-800">
                <Icon name="flame" filled /> {text(`Eń uzın qatar: ${bestStreak}`)}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3.5 py-1.5 text-sm font-semibold text-teal-800">
                <Icon name="trophy" />{' '}
                {text(`Rekord: ${Math.max(best, score)}/${questions.length}`)}
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {isWodGoal ? (
                <Link
                  to="/quiz"
                  className={`${anim.shine} inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-teal-900/25 transition-all hover:-translate-y-0.5`}
                >
                  <Icon name="trophy" /> {text(KAA.dailyGoalNextQuiz)}
                  <AnimChevron count={2} className="opacity-90" style={{ ['--dch-color']: '#ecfdf5' }} />
                </Link>
              ) : softGoal && !softGoal.complete ? (
                <Link
                  to={
                    softGoal.claimed && softGoal.wodId
                      ? `/dictionary/game?source=checkin&ids=${encodeURIComponent(softGoal.wodId)}&goal=wod`
                      : '/#kun-sozi'
                  }
                  className={`${anim.shine} inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-amber-900/25 transition-all hover:-translate-y-0.5`}
                >
                  <Icon name="bolt" />{' '}
                  {text(
                    softGoal.claimed ? KAA.dailyGoalNextPractice : KAA.dailyGoalNextCheckin
                  )}
                  <AnimChevron count={2} className="opacity-90" style={{ ['--dch-color']: '#fff7ed' }} />
                </Link>
              ) : softGoal?.complete ? (
                <Link
                  to="/quiz"
                  className={`${anim.shine} inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-teal-900/25 transition-all hover:-translate-y-0.5`}
                >
                  <Icon name="trophy" /> {text(KAA.dailyGoalNextQuiz)}
                  <AnimChevron count={2} className="opacity-90" style={{ ['--dch-color']: '#ecfdf5' }} />
                </Link>
              ) : null}
              {isWodGoal && (
                <Link
                  to="/#kun-sozi"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-700/25 bg-white/80 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-teal-900 transition hover:bg-teal-50"
                >
                  <Icon name="check" /> {text(KAA.dailyGoalBackHome)}
                </Link>
              )}
              <button
                type="button"
                onClick={start}
                className={`inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold uppercase tracking-wide transition-all hover:-translate-y-0.5 ${
                  isWodGoal || softGoal?.complete || (softGoal && !softGoal.complete)
                    ? 'border border-amber-600/35 bg-white/80 text-amber-950 hover:bg-amber-50'
                    : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-900/25 hover:from-amber-600 hover:to-orange-700'
                }`}
              >
                <Icon name="bolt" /> {text('Jáne oynaw')}
              </button>
              {source === 'favorites' ? (
                <Link
                  to="/dictionary/favorites"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-800/40 px-7 py-3.5 text-sm font-semibold uppercase tracking-wide text-teal-900 transition-colors hover:bg-teal-900 hover:text-parchment"
                >
                  {text(KAA.yoqtirilganlar)}
                  <AnimChevron count={2} className="opacity-70" />
                </Link>
              ) : source === 'recent' ? (
                <Link
                  to="/dictionary"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-800/40 px-7 py-3.5 text-sm font-semibold uppercase tracking-wide text-teal-900 transition-colors hover:bg-teal-900 hover:text-parchment"
                >
                  {text(KAA.mashqDoneBackRecent)}
                  <AnimChevron count={2} className="opacity-70" />
                </Link>
              ) : source === 'mistakes' ? (
                <Link
                  to="/tutor/practice"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-800/40 px-7 py-3.5 text-sm font-semibold uppercase tracking-wide text-teal-900 transition-colors hover:bg-teal-900 hover:text-parchment"
                >
                  {text(KAA.mashqDoneBackMistakes)}
                  <AnimChevron count={2} className="opacity-70" />
                </Link>
              ) : source === 'focused' ? (
                <Link
                  to={exitHref || '/tutor/practice?from=reading'}
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-800/40 px-7 py-3.5 text-sm font-semibold uppercase tracking-wide text-teal-900 transition-colors hover:bg-teal-900 hover:text-parchment"
                >
                  {text(exitLabel)}
                  <AnimChevron count={2} className="opacity-70" />
                </Link>
              ) : isWodGoal || softGoal?.complete || (softGoal && !softGoal.complete) ? (
                <Link
                  to="/crossword"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-teal-900/70 hover:underline"
                >
                  {text(KAA.dailyGoalNextCrossword)}
                </Link>
              ) : (
                <Link
                  to="/dictionary"
                  className="inline-flex items-center gap-2 rounded-xl border border-teal-800/40 px-7 py-3.5 text-sm font-semibold uppercase tracking-wide text-teal-900 transition-colors hover:bg-teal-900 hover:text-parchment"
                >
                  {text(KAA.sozlik)}
                  <AnimChevron count={2} className="opacity-70" />
                </Link>
              )}
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <ShareResultButton
                title={text(KAA.shareDictGameTitle)}
                text={text(KAA.shareDictGameText)
                  .replace('{score}', String(score))
                  .replace('{total}', String(questions.length))
                  .replace('{streak}', String(bestStreak))}
                url={
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/dictionary/game`
                    : undefined
                }
                className="inline-flex items-center gap-2 rounded-xl border border-teal-700/25 bg-white px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-teal-950"
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
              <GuestSoftContinue className="mt-6 text-left" bodyKey="authGuestFreeBody" />
            ) : null}
          </div>
        )}
      </section>
    </DictShell>
  );
}
