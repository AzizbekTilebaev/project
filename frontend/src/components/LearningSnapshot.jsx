import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchMyPoints } from '../api/points';
import { fetchMyActivity } from '../api/stats';
import { fetchTutorReminder } from '../api/tutor';
import { fetchWordOfDayCheckin } from '../api/tusindirme';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, anim, AnimChevron } from '../animations';
import WeeklyReview from './WeeklyReview';
import { consumeGoalCelebration, getDailyGoalStatus } from '../lib/dailyGoalProgress';
import { getGuestLocalSummary } from '../lib/guestLocalSummary';
import { getContinueTutor } from '../lib/tutorProgress';
import { getContinueAdaptive } from '../lib/adaptiveProgress';
import useResumeTick from '../hooks/useResumeTick';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import { favoritesPracticeHref } from '../lib/readingPractice';
import { readFavoritesPractice } from '../lib/favoritesProgress';
import { formatDurationMs } from '../lib/formatDuration';
import ShareProgressButton from './ShareProgressButton';

/**
 * Profil / statistika uchun qısqa oqıw snapshotı.
 * dense=true — statistika betinde qısqaraq qator.
 */
export default function LearningSnapshot({ dense = false, favoritesCount = null }) {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { items: favItems } = useDictionaryFavorites();
  const [points, setPoints] = useState(null);
  const [activity, setActivity] = useState(null);
  const [reminder, setReminder] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const [goalFlash, setGoalFlash] = useState(null);
  const resumeTick = useResumeTick();
  const local = useMemo(() => getGuestLocalSummary(), [resumeTick]);
  const mashqHref = useMemo(
    () =>
      favoritesPracticeHref(favItems, { practice: readFavoritesPractice() }) ||
      '/dictionary/favorites',
    [favItems, resumeTick]
  );
  const links = useMemo(
    () => [
      { to: '/literature', icon: 'book', label: KAA.adebiyat },
      { to: '/games', icon: 'trophy', label: KAA.oyinlar },
      { to: '/dictionary/favorites', icon: 'heart', label: KAA.yoqtirilganlar },
      { to: mashqHref, icon: 'gamepad', label: KAA.mashqEtiw },
    ],
    [mashqHref]
  );

  useEffect(() => {
    let alive = true;
    const load = () => {
      Promise.all([
        fetchMyPoints().catch(() => null),
        fetchMyActivity({ days: 7, period: 'week' }).catch(() => null),
        fetchTutorReminder().catch(() => null),
        fetchWordOfDayCheckin().catch(() => null),
      ]).then(([p, a, r, c]) => {
        if (!alive) return;
        setPoints(p);
        setActivity(a);
        setReminder(r?.reminder || null);
        setCheckin(c?.checkin || null);
      });
    };
    load();
    const onAuth = () => load();
    window.addEventListener('qp:auth-changed', onAuth);
    return () => {
      alive = false;
      window.removeEventListener('qp:auth-changed', onAuth);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!consumeGoalCelebration()) return undefined;
    setGoalFlash(`${text(KAA.dailyGoalCelebrate)} · ${text(KAA.dailyGoalFull)}`);
    const t = window.setTimeout(() => setGoalFlash(null), 4500);
    return () => window.clearTimeout(t);
  }, [text]);

  const balance = points?.wallet?.balance ?? '—';
  const level = points?.wallet?.level ?? '—';
  const quizzes = activity?.quiz?.completes ?? 0;
  const crosswords = activity?.crossword?.completes ?? 0;
  const totalMs = Number(activity?.timeSpent?.totalMs) || 0;
  const progress = Math.round(Number(points?.wallet?.levelProgress || 0) * 100);
  const streakDisplay = checkin?.claimedToday
    ? Number(checkin.streak) || 0
    : Number(checkin?.streak) || 0;
  const activityStreak = Number(activity?.streak?.current) || 0;
  const dailyGoal = getDailyGoalStatus({
    claimedToday: checkin?.claimedToday,
    titleId: checkin?.titleId,
  });
  const continueTutor = useMemo(() => getContinueTutor(), [resumeTick]);
  const continueAdaptive = useMemo(() => getContinueAdaptive(), [resumeTick]);
  const tutorHref =
    reminder?.reason === 'completed'
      ? '/tutor/practice?from=tutor'
      : continueTutor?.href || reminder?.deepLink || '/tutor';
  const adaptiveHref = continueAdaptive?.href || '/quiz/adaptive';
  const wodPracticeHref = checkin?.titleId
    ? `/dictionary/game?source=checkin&ids=${encodeURIComponent(checkin.titleId)}&goal=wod`
    : '/';
  const goalDoneHref = local.primary?.href || '/quiz';
  const goalDoneLabel = local.primary
    ? KAA[local.primary.labelKey] || local.primary.labelKey
    : KAA.dailyGoalNextQuiz;
  const goalDoneIcon = local.primary?.icon || 'trophy';
  const secondaryHref =
    local.primary?.href !== '/crossword' && local.primary?.labelKey !== 'continueCrossword'
      ? '/crossword'
      : null;

  const serverQuiet = quizzes === 0 && crosswords === 0 && activityStreak === 0 && totalMs === 0;
  const showLocalStrip = Boolean(
    goalFlash || local.hasLocal || (dense && serverQuiet) || (!isAuthenticated && serverQuiet)
  );

  return (
    <section
      className={`rounded-[1.75rem] border border-teal-700/15 bg-gradient-to-br from-teal-50/80 via-white/85 to-amber-50/50 ${
        dense ? 'px-4 py-4' : 'px-5 py-5 sm:px-6'
      }`}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
            {text(KAA.oqiwHub)}
          </p>
          {!dense && (
            <>
              <h2 className="mt-1 font-display text-2xl tracking-tight text-ink">
                {text(KAA.oqiwHubTitle)}
              </h2>
              <AnimIconDivider compact className="mt-2" />
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {goalFlash && (
            <span
              className={`${anim.checkinPop} ${anim.pointsFloat} rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900`}
            >
              {goalFlash}
            </span>
          )}
          <ShareProgressButton
            compact={dense}
            review={
              quizzes > 0 || crosswords > 0 || activityStreak > 0
                ? {
                    activeDays: activityStreak > 0 ? Math.min(7, activityStreak) : 0,
                    quizCompletes: quizzes,
                    crosswordCompletes: crosswords,
                    wordViews: 0,
                    dictGames: 0,
                  }
                : null
            }
            streak={
              activityStreak > 0 || streakDisplay > 0
                ? {
                    current: Math.max(activityStreak, streakDisplay),
                    best: Number(activity?.streak?.best) || Math.max(activityStreak, streakDisplay),
                  }
                : null
            }
            local={serverQuiet ? local : null}
            claimedToday={Boolean(checkin?.claimedToday)}
            url={
              typeof window !== 'undefined'
                ? `${window.location.origin}/profile`
                : undefined
            }
          />
          {!dense && (
            <Link
              to="/quiz/statistics"
              className={`text-sm font-semibold text-teal-900 ${anim.underlineGrow}`}
            >
              {text(KAA.tolıqStatistika)}
            </Link>
          )}
        </div>
      </div>

      {reminder && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 ${
            reminder.due
              ? 'border-teal-600/25 bg-teal-50/90'
              : 'border-ink/8 bg-white/70'
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{text(KAA.buginkiDars)}</p>
            <p className="text-xs text-ink/55">
              {reminder.due
                ? reminder.reason === 'in_progress'
                  ? `${text(KAA.darsYarimda)}${
                      reminder.total != null
                        ? ` · ${reminder.score ?? 0}/${reminder.total}`
                        : ''
                    }`
                  : text(KAA.darsTayyar)
                : reminder.reason === 'wrong_day'
                  ? text(KAA.buginDarsJoq)
                  : reminder.reason === 'completed'
                    ? text(KAA.buginkiDarsTamam)
                    : text(KAA.darsErte)}
            </p>
          </div>
          <Link
            to={tutorHref}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${anim.shine} ${
              reminder.due || reminder.reason === 'completed'
                ? 'bg-teal-900 text-white'
                : 'border border-teal-800/20 text-teal-900'
            }`}
          >
            {text(
              reminder.due && reminder.reason === 'in_progress'
                ? KAA.dawamEt
                : reminder.reason === 'completed'
                  ? KAA.tutorDonePractice
                  : KAA.ashiw
            )}
          </Link>
        </div>
      )}

      {continueAdaptive && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-600/20 bg-teal-50/80 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{text(KAA.continueAdaptive)}</p>
            <p className="text-xs text-ink/55">
              {text(KAA.continueAdaptiveProgress)
                .replace('{a}', String((continueAdaptive.currentIndex || 0) + 1))
                .replace('{b}', String(continueAdaptive.total || 10))}
            </p>
          </div>
          <Link
            to={adaptiveHref}
            className={`${anim.shine} shrink-0 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white`}
          >
            {text(KAA.dawamEt)}
          </Link>
        </div>
      )}

      {checkin && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3.5 py-3 ${
            checkin.claimedToday
              ? 'border-amber-500/20 bg-amber-50/80'
              : 'border-amber-600/25 bg-gradient-to-r from-amber-50/90 to-teal-50/50'
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{text(KAA.kunSozi)}</p>
            <p className="text-xs text-ink/55">
              {checkin.claimedToday
                ? `${text(KAA.kunSoziBelgilegen)}${
                    streakDisplay ? ` · ${streakDisplay} ${text(KAA.kunSoziStreak).toLowerCase()}` : ''
                  }`
                : checkin.nextPoints
                  ? `${text(KAA.kunSoziBelgilaw)} · +${checkin.nextPoints}`
                  : text(KAA.kunSoziBelgilaw)}
            </p>
            <p className="mt-0.5 text-[0.7rem] text-ink/45">
              {text(
                dailyGoal.complete
                  ? KAA.dailyGoalFull
                  : dailyGoal.doneCount === 1
                    ? KAA.dailyGoalHalf
                    : KAA.dailyGoalEmpty
              )}
              {checkin.claimedToday
                ? dailyGoal.practiced
                  ? ` · ${text(KAA.dailyGoalPracticeDone)}`
                  : ` · ${text(KAA.dailyGoalPracticeTodo)}`
                : ''}
            </p>
            {checkin.nextMilestone ? (
              <p className="mt-0.5 text-[0.7rem] text-ink/45">
                {text(KAA.keyingiMarra)} {checkin.nextMilestone.day}: +{checkin.nextMilestone.bonus} ·{' '}
                {checkin.nextMilestone.remaining} {text(KAA.kungaQaldy)}
              </p>
            ) : null}
            {checkin.freeze ? (
              <p className="mt-0.5 text-[0.7rem] text-ink/45">
                {text(KAA.streakFreeze)}:{' '}
                {checkin.freeze.available ? text(KAA.freezeTayyar) : text(KAA.freezeQollanildi)}
                {checkin.freeze.usedNow ? (
                  <>
                    {' · '}
                    <Link to="/tutor/practice" className="font-semibold text-sky-900 hover:underline">
                      {text(KAA.freezeUsedNext)}
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
            {checkin.chest?.pending?.length ? (
              <p className="mt-0.5 text-[0.7rem] font-semibold text-violet-800">
                {text(KAA.comboChestKutilip)} · +{checkin.chest.pending[0].rewardPoints}
              </p>
            ) : checkin.chest?.next ? (
              <p className="mt-0.5 text-[0.7rem] text-ink/45">
                {text(KAA.comboChestKeyin)} {checkin.chest.next.at}: +
                {checkin.chest.next.reward?.points || 40}
              </p>
            ) : null}
          </div>
          {checkin.chest?.pending?.length ? (
            <Link
              to="/profile#profile-chest"
              className={`${anim.shine} shrink-0 rounded-full bg-violet-700 px-3.5 py-1.5 text-xs font-bold text-white`}
            >
              {text(KAA.comboChestAshiw)}
            </Link>
          ) : checkin.claimedToday && checkin.titleId ? (
            dailyGoal.complete ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Link
                  to={goalDoneHref}
                  className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white`}
                >
                  <Icon name={goalDoneIcon} />
                  {text(goalDoneLabel)}
                </Link>
                {secondaryHref && goalDoneHref !== secondaryHref ? (
                  <Link
                    to={secondaryHref}
                    className="rounded-full border border-amber-500/35 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-950"
                  >
                    {text(KAA.dailyGoalNextCrossword)}
                  </Link>
                ) : null}
              </div>
            ) : (
              <Link
                to={wodPracticeHref}
                className={`${anim.shine} shrink-0 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white`}
              >
                {text(KAA.dailyGoalPractice)}
              </Link>
            )
          ) : (
            <Link
              to="/#kun-sozi"
              className={`shrink-0 ${
                checkin.claimedToday
                  ? anim.streakFlame
                  : `${anim.shine} rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-ink`
              }`}
            >
              {checkin.claimedToday ? (
                <>
                  <span className={anim.streakDot} aria-hidden />
                  {streakDisplay || 1} {text(KAA.kun).toLowerCase()}
                </>
              ) : (
                text(KAA.kunSoziBelgilaw)
              )}
            </Link>
          )}
        </div>
      )}

      <div className={`mb-4 grid gap-2 ${dense ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
        <Link
          to="/quiz/statistics#wallet"
          className="rounded-2xl border border-amber-500/15 bg-amber-50/70 px-3 py-3 transition hover:border-amber-500/35"
        >
          <p className="text-[0.65rem] uppercase tracking-wide text-amber-800/60">
            {text(KAA.tangalar)}
          </p>
          <p className="font-display text-2xl text-ink">{balance}</p>
        </Link>
        <div className="rounded-2xl border border-teal-700/10 bg-teal-50/60 px-3 py-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-teal-800/55">
            {text(KAA.dareje)}
          </p>
          <p className="font-display text-2xl text-ink">{level}</p>
          {Number.isFinite(progress) && (
            <div
              className={`mt-2 ${anim.progressFill}`}
              style={{ ['--lpr-value']: `${Math.min(100, Math.max(0, progress))}%` }}
            >
              <div className={anim.progressBar} />
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-ink/8 bg-white/70 px-3 py-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-ink/45">{text(KAA.testler)}</p>
          <p className="font-display text-2xl text-ink">{quizzes}</p>
          <p className="text-[0.65rem] text-ink/40">{text(KAA.hapte)}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/60 bg-rose-50/70 px-3 py-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-rose-800/60">
            {text(KAA.faolliqQatari)}
          </p>
          <p className="font-display text-2xl text-ink">{activityStreak}</p>
          <p className="text-[0.65rem] text-ink/40">{text(KAA.kun)}</p>
        </div>
        <div className="rounded-2xl border border-ink/8 bg-white/70 px-3 py-3">
          <p className="text-[0.65rem] uppercase tracking-wide text-ink/45">
            {text(KAA.krossvord)}
          </p>
          <p className="font-display text-2xl text-ink">{crosswords}</p>
          {favoritesCount != null && (
            <p className="text-[0.65rem] text-ink/40">
              {favoritesCount} {text(KAA.yoqtirilganlar)}
            </p>
          )}
        </div>
        <Link
          to="/quiz/statistics"
          className="rounded-2xl border border-sky-700/12 bg-sky-50/60 px-3 py-3 transition hover:border-sky-700/30"
        >
          <p className="text-[0.65rem] uppercase tracking-wide text-sky-900/55">
            {text(KAA.oqiwWaqti)}
          </p>
          <p className="font-display text-2xl text-ink tabular-nums">
            {formatDurationMs(totalMs)}
          </p>
          <p className="text-[0.65rem] text-ink/40">{text(KAA.hapte)}</p>
        </Link>
      </div>

      {local.primary &&
        (showLocalStrip || dense) &&
        !(dailyGoal.complete && checkin?.claimedToday && checkin?.titleId) && (
        <div className="mb-4">
          <Link
            to={local.primary.href}
            className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2 text-sm font-bold text-white`}
          >
            <Icon name={local.primary.icon} />
            {text(KAA[local.primary.labelKey] || local.primary.labelKey)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-800/12 bg-white/80 px-3.5 py-2 text-xs font-semibold text-teal-950 transition hover:-translate-y-0.5 hover:border-teal-700/30"
          >
            <Icon name={item.icon} />
            {text(item.label)}
            <AnimChevron count={2} className="opacity-50" />
          </Link>
        ))}
      </div>

      {!dense && <WeeklyReview dense className="mt-4" />}
    </section>
  );
}
