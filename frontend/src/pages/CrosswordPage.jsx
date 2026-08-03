import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Crossword from '../components/Crossword';
import ProtectedContent from '../components/ProtectedContent';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { useGuestQuota } from '../hooks/useGuestQuota';
import { completeCrossword, fetchCrosswordById, guessCrossword } from '../api/crosswords';
import { KAA } from '../i18n/kaa';
import SoftNextRow from '../components/SoftNextRow';
import { anim, AnimChevron } from '../animations';
import {
  queueCrosswordAnswer,
  queueCrosswordMiss,
  recordCrosswordComplete,
  touchCrosswordContinue,
  clearCrosswordContinue,
  readCrosswordContinueCells,
  readCrosswordPractice,
} from '../lib/crosswordProgress';
import { crosswordPracticeHref } from '../lib/readingPractice';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';

const DIFFICULTY_META = {
  Ápiwayı: {
    chip: 'bg-emerald-100 text-emerald-800',
    medallion: 'bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-900/25',
  },
  Orta: {
    chip: 'bg-amber-100 text-amber-800',
    medallion: 'bg-gradient-to-br from-amber-400 to-orange-600 shadow-amber-900/25',
  },
  Qıyın: {
    chip: 'bg-rose-100 text-rose-700',
    medallion: 'bg-gradient-to-br from-rose-500 to-pink-700 shadow-rose-900/25',
  },
};

export default function CrosswordPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { requireCrossword, openGate, GateModal } = useGuestQuota();
  const [cellData, setCellData] = useState({});
  const [completed, setCompleted] = useState(null);
  const [freshFlash, setFreshFlash] = useState(false);
  const startedAtRef = useRef(Date.now());
  const completedRef = useRef(false);
  const skipTouchRef = useRef(false);

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        crossword: async () => {
          const res = await fetchCrosswordById(id);
          return res.crossword;
        },
      }),
    { deps: [id] }
  );

  const crossword = data?.crossword || null;
  const hasProgress = useMemo(
    () => !completed && Object.keys(cellData || {}).length > 0,
    [cellData, completed]
  );

  usePageMeta(
    crossword ? text(crossword.title) : text('Krossvord'),
    text(crossword?.description || 'Qaraqalpaq tili boyınsha krossvord.')
  );

  useEffect(() => {
    setCompleted(null);
    setFreshFlash(false);
    startedAtRef.current = Date.now();
    completedRef.current = false;
    skipTouchRef.current = false;
    const saved = readCrosswordContinueCells(id);
    setCellData(saved && typeof saved === 'object' ? saved : {});
  }, [id]);

  useEffect(() => {
    if (!crossword?.id || completed || skipTouchRef.current) return;
    touchCrosswordContinue({
      id: crossword.id,
      title: crossword.title,
      difficulty: crossword.difficulty,
      wordCount: crossword.config?.WordsData?.length || 0,
      cellData,
    });
  }, [crossword, cellData, completed]);

  useEffect(() => {
    if (Object.keys(cellData || {}).length > 0) {
      skipTouchRef.current = false;
      setFreshFlash(false);
    }
  }, [cellData]);

  useEffect(() => {
    if (!completed) return;
    clearCrosswordContinue(id);
  }, [completed, id]);

  const resetFresh = useCallback(() => {
    skipTouchRef.current = true;
    clearCrosswordContinue(id);
    setCellData({});
    setCompleted(null);
    completedRef.current = false;
    startedAtRef.current = Date.now();
    setFreshFlash(true);
  }, [id]);

  const laterSoft = useCallback(() => {
    skipTouchRef.current = true;
    navigate('/tutor/practice?from=crossword');
  }, [navigate]);

  const handleGuess = useCallback(
    async ({ wordIndex, answer }) => {
      if (!requireCrossword()) {
        return { correct: false, blocked: true };
      }
      try {
        const result = await guessCrossword(id, { wordIndex, answer });
        const fill =
          String(result.fillAnswer || answer)
            .trim()
            .replace(/\s+/g, '')
            .toUpperCase() || '';
        if (result.correct) {
          queueCrosswordAnswer(fill || answer).catch(() => null);
        } else if (result.dictTitleId) {
          queueCrosswordMiss(result.dictTitleId);
        }
        if (result.correct && crossword?.config?.WordsData) {
          const word = crossword.config.WordsData[wordIndex];
          const len = result.length || word.length;
          const letters = fill;
          setCellData((prev) => {
            const next = { ...prev };
            for (let i = 0; i < len; i++) {
              const x = word.direction === 'across' ? word.x + i : word.x;
              const y = word.direction === 'across' ? word.y : word.y + i;
              next[`${x}-${y}`] = letters[i];
            }
            const solved = crossword.config.WordsData.filter((w) => {
              const l = w.length ?? w.answer?.length ?? 0;
              return Array.from({ length: l }, (_, j) => {
                const cx = w.direction === 'across' ? w.x + j : w.x;
                const cy = w.direction === 'across' ? w.y : w.y + j;
                return next[`${cx}-${cy}`];
              }).every(Boolean);
            }).length;
            if (solved >= crossword.config.WordsData.length && !completedRef.current) {
              completedRef.current = true;
              const seconds = Math.round((Date.now() - startedAtRef.current) / 1000);
              completeCrossword(id, { seconds, score: solved }).catch(() => null);
              const streakInfo = recordCrosswordComplete();
              queueMicrotask(() =>
                setCompleted({ seconds, score: solved, streak: streakInfo.streak || 0 })
              );
            }
            return next;
          });
        }
        return {
          correct: result.correct,
          nearMiss: Boolean(result.nearMiss),
          fillAnswer: result.fillAnswer || (result.correct ? fill : null),
        };
      } catch (err) {
        if (err.code === 'GUEST_CROSSWORD_BLOCK' || err.status === 403) {
          openGate('crossword');
          return { correct: false, blocked: true };
        }
        throw err;
      }
    },
    [id, crossword, requireCrossword, openGate]
  );

  if (!crossword && status === 'ready') {
    return (
      <PageGate
        status="error"
        error="Krossvord tabılmadı"
        backHref="/crossword"
        backLabel="Krossvordlarǵa qaytıw"
      />
    );
  }

  if (!crossword) {
    return (
      <PageGate
        status={status}
        error={error}
        onRetry={reload}
        backHref="/crossword"
        backLabel="Krossvordlar"
      />
    );
  }

  const meta = DIFFICULTY_META[crossword.difficulty] || DIFFICULTY_META.Ápiwayı;
  const wordCount = crossword.config?.WordsData?.length || 0;

  return (
    <>
      {GateModal}
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-5xl px-6 pt-8 md:px-10">
          <Link
            to="/crossword"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4"
          >
            <Icon name="left" /> {text('Krossvordlar')}
          </Link>

          <div className="mb-6 flex items-start gap-4">
            <span
              className={`hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:inline-flex ${meta.medallion}`}
            >
              <Icon name="grammar" className="text-2xl" />
            </span>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.chip}`}>
                  {text(crossword.difficulty)}
                </span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                  {wordCount} {text('sóz')}
                </span>
              </div>
              <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
                {text(crossword.title)}
              </h1>
            </div>
          </div>
          {crossword.description && (
            <p className="mb-6 max-w-xl text-lg leading-relaxed text-ink/60">
              {text(crossword.description)}
            </p>
          )}

          {!isAuthenticated && !completed && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-600/20 bg-teal-50/70 px-4 py-3">
              <p className="text-sm text-teal-950">{text(KAA.crosswordGuestHint)}</p>
              <Link
                to="/profile"
                className="shrink-0 rounded-full border border-teal-800/25 bg-white px-4 py-2 text-xs font-semibold text-teal-900"
              >
                {text(KAA.profileGuestNav)}
              </Link>
            </div>
          )}

          {hasProgress && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-700/15 bg-sky-50/60 px-4 py-3">
              <p className="text-xs text-sky-950/75">{text(KAA.crosswordResumeHint)}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={resetFresh}
                  className="rounded-full border border-sky-800/25 bg-white px-3.5 py-1.5 text-xs font-bold text-sky-950"
                >
                  {text(KAA.continueCrosswordFresh)}
                </button>
                <button
                  type="button"
                  onClick={laterSoft}
                  className="qp-chip text-teal-950"
                >
                  <Icon name="bolt" /> {text(KAA.crosswordLater)}
                </button>
              </div>
            </div>
          )}

          {freshFlash && !hasProgress && !completed && (
            <p className="mb-4 text-xs text-ink/50">{text(KAA.continueCrosswordFresh)}</p>
          )}

          {completed && (
            <div
              className="mb-6 quiz-result-pop rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/90 via-white/80 to-amber-50/50 px-6 py-7 text-center"
            >
              <Icon name="trophy" className="mx-auto mb-3 text-3xl text-amber-600" />
              <h2 className="font-display text-3xl tracking-tight text-ink">
                {text(KAA.crosswordComplete)}
              </h2>
              <p className="mt-2 text-sm text-ink/60">{text(KAA.crosswordCompleteBody)}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">
                  {completed.score}/{wordCount} {text('sóz')}
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950">
                  {text(KAA.crosswordSeconds).replace('{n}', String(completed.seconds))}
                </span>
                {completed.streak > 0 && (
                  <span className={`rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-950 ${anim.streakFlame}`}>
                    <span className={anim.streakDot} aria-hidden />
                    {text(KAA.crosswordStreak)} {completed.streak}
                  </span>
                )}
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  to="/crossword"
                  className={`${anim.shine} qp-btn-primary`}
                >
                  {text(KAA.crosswordNext)}
                  <AnimChevron count={2} style={{ ['--dch-color']: '#ecfdf5' }} />
                </Link>
                <Link
                  to={
                    crosswordPracticeHref(readCrosswordPractice()) ||
                    '/tutor/practice?from=crossword'
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-teal-700/30 bg-white px-5 py-3 text-sm font-semibold text-teal-900"
                >
                  <Icon name="bolt" />{' '}
                  {completed.streak > 0
                    ? text(KAA.crosswordStreakCta).replace('{n}', String(completed.streak))
                    : text(KAA.crosswordToMashq)}
                </Link>
                <ShareResultButton
                  title={text(KAA.shareCrosswordTitle)}
                  text={text(KAA.shareCrosswordText)
                    .replace('{title}', text(crossword?.title || KAA.krossvord))
                    .replace('{score}', String(completed.score))
                    .replace('{total}', String(wordCount))
                    .replace('{seconds}', String(completed.seconds))}
                  url={
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/crossword/${encodeURIComponent(crossword?.id || '')}`
                      : undefined
                  }
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
            </div>
          )}

          <ProtectedContent className="qp-surface p-4 md:p-6">
            <Crossword
              config={crossword.config}
              cellData={cellData}
              onCellDataChange={setCellData}
              onGuess={handleGuess}
              hideReset
            />
          </ProtectedContent>
        </section>
      </DictShell>
    </>
  );
}
