import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  claimWordOfDayCheckin,
  fetchCurated,
  fetchRandomWord,
  fetchWordOfDay,
  fetchWordOfDayCheckin,
} from '../api/tusindirme';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import SearchAutocomplete from '../components/dictionary/SearchAutocomplete';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import { KAA } from '../i18n/kaa';
import { anim, AnimMatrixRain, AnimIconDivider, AnimChevron, PageEnter } from '../animations';
import CountUp from '../components/CountUp';
import { MotionDiv, Stagger } from '../animations/Motion';
import { scaleIn, slideUp, staggerFast } from '../animations/motionVariants';
import { motion } from 'framer-motion';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import FirstRunPath, { ContinueLearning } from '../components/FirstRunPath';
import useResumeTick from '../hooks/useResumeTick';
import { getGuestLocalSummary } from '../lib/guestLocalSummary';
import { getDailyGoalStatus } from '../lib/dailyGoalProgress';

const PLAY_DOORS = [
  {
    to: '/literature',
    icon: 'scroll',
    titleKey: 'adebiyat',
    descKey: 'homeDoorLitDesc',
    tone: 'from-sky-400 via-cyan-500 to-teal-600',
    orb: 'bg-sky-200/45',
  },
  {
    to: '/games',
    icon: 'trophy',
    titleKey: 'oyinlar',
    descKey: 'homeDoorGamesDesc',
    tone: 'from-teal-400 via-emerald-500 to-teal-700',
    orb: 'bg-emerald-200/50',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const reduceMotion = usePrefersReducedMotion();
  const { has: hasFavorite, toggle: toggleFavorite } = useDictionaryFavorites();
  const [checkin, setCheckin] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimFlash, setClaimFlash] = useState(null);
  const [claimError, setClaimError] = useState(false);
  const resumeTick = useResumeTick();
  const localResume = useMemo(() => getGuestLocalSummary(), [resumeTick]);

  // Hech narsa majburiy emas: API o‘chsa ham bosh sahifa (ádebiyat/oyın/qoida) ochiladi.
  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle(
        {},
        {
          curated: async () => {
            const res = await fetchCurated();
            return res.data || [];
          },
          wordOfDay: async () => {
            const res = await fetchWordOfDay();
            return res?.data || null;
          },
        }
      ),
    { deps: [] }
  );

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWordOfDayCheckin()
        .then((res) => {
          if (!cancelled) setCheckin(res.checkin || null);
        })
        .catch(() => {
          if (!cancelled) setCheckin(null);
        });
    };
    load();
    const onAuth = () => load();
    window.addEventListener('qp:auth-changed', onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener('qp:auth-changed', onAuth);
    };
  }, [isAuthenticated]);

  const featured = (data?.curated || []).slice(0, 4);
  const wordOfDay = data?.wordOfDay || null;

  useEffect(() => {
    if (!wordOfDay || typeof window === 'undefined') return;
    if (window.location.hash !== '#kun-sozi') return;
    const el = document.getElementById('kun-sozi');
    if (!el) return;
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [wordOfDay]);

  const goRandom = async () => {
    try {
      const res = await fetchRandomWord();
      if (res.data?.id) navigate(`/dictionary/${res.data.id}`);
    } catch {
      navigate('/dictionary');
    }
  };

  const onClaimCheckin = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (claiming || checkin?.claimedToday) return;
    setClaiming(true);
    setClaimError(false);
    try {
      const res = await claimWordOfDayCheckin();
      setCheckin({
        day: res.day,
        claimedToday: true,
        streak: res.streak,
        pointsToday: res.points?.earned || res.points?.awardedEarlier || 0,
        canClaim: false,
        nextPoints: 0,
        titleId: res.titleId,
        nextMilestone: res.nextMilestone || null,
        milestoneToday: res.milestone || null,
        freeze: res.freeze || null,
        chest: res.chest || null,
      });
      if (res.points?.earned > 0) {
        setClaimFlash(
          `+${res.points.earned} · ${res.streak} ${text(KAA.kunSoziStreak).toLowerCase()}`
        );
      }
      const word =
        res.word ||
        (wordOfDay
          ? {
              id: wordOfDay.id,
              soz: wordOfDay.soz,
              birinshi_aniqlama: wordOfDay.birinshi_aniqlama,
            }
          : null);
      if (word?.id && !hasFavorite(word.id)) {
        toggleFavorite({
          id: word.id,
          soz: word.soz || '',
          birinshi_aniqlama: word.birinshi_aniqlama || null,
        });
      }
    } catch {
      setClaimError(true);
      setClaimFlash(text(KAA.kunSoziClaimError));
    } finally {
      setClaiming(false);
    }
  };

  const wodPlayHref = wordOfDay?.id
    ? `/dictionary/game?source=checkin&ids=${encodeURIComponent(wordOfDay.id)}&goal=wod`
    : '/dictionary/game';

  const todaySoft = useMemo(() => {
    const goal = getDailyGoalStatus({
      claimedToday: checkin?.claimedToday,
      titleId: checkin?.titleId || wordOfDay?.id,
    });
    if (!goal.claimed) {
      return { href: '/#kun-sozi', labelKey: 'homeTodayWod', icon: 'bolt' };
    }
    if (!goal.practiced && (checkin?.titleId || wordOfDay?.id)) {
      const id = checkin?.titleId || wordOfDay?.id;
      return {
        href: `/dictionary/game?source=checkin&ids=${encodeURIComponent(id)}&goal=wod`,
        labelKey: 'homeWodPlay',
        icon: 'gamepad',
      };
    }
    if (localResume.primary?.href) {
      return {
        href: localResume.primary.href,
        labelKey: localResume.primary.labelKey || 'dawamEtiw',
        icon: localResume.primary.icon || 'bolt',
      };
    }
    return { href: '/games', labelKey: 'homeTodayPlay', icon: 'trophy' };
  }, [checkin, wordOfDay?.id, localResume.primary]);

  return (
    <ProtectedContent>
    <PageGate status={status} error={error} onRetry={reload}>
      <main className="dict-shell relative min-h-screen overflow-hidden">
        <div className="dict-atmosphere pointer-events-none absolute inset-0 theme-focus-hide" aria-hidden />
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-sky-400/15 blur-3xl theme-focus-hide"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-40 -left-28 h-80 w-80 rounded-full bg-amber-400/12 blur-3xl theme-focus-hide"
          aria-hidden
        />

        {/* Hero — brand + soft playful glass (referens vibe, LMS emas) */}
        <section className="relative flex min-h-[78vh] flex-col justify-end px-6 pb-16 pt-24 md:px-10">
          <div
            className="absolute inset-0 theme-focus-hide"
            style={{
              background:
                'linear-gradient(145deg, #0f766e 0%, #0e7490 42%, #f59e0b 120%)',
            }}
            aria-hidden
          />
          <div
            className="motion-atmosphere-drift absolute inset-0 opacity-50 theme-focus-hide"
            style={{
              backgroundImage:
                'radial-gradient(circle at 18% 28%, rgba(255,236,179,0.45), transparent 42%), radial-gradient(circle at 88% 18%, rgba(125,211,252,0.35), transparent 40%), radial-gradient(circle at 70% 85%, rgba(255,255,255,0.18), transparent 45%)',
            }}
            aria-hidden
          />
          <AnimMatrixRain drops={12} />
          <PageEnter className="relative z-[1] mx-auto w-full max-w-3xl text-parchment">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/95">
              {text(KAA.qaraqalpaq)}
            </p>
            <h1 className="mb-5 font-display text-5xl tracking-tight sm:text-6xl md:text-7xl">
              {text(KAA.qaraqalpaq)}
            </h1>
            <div className="anim-breathe-line" style={{ ['--dbl-color']: 'rgba(254, 243, 199, 0.65)' }} />
            <p className="mb-8 max-w-lg text-lg leading-relaxed text-parchment/85">
              {text(KAA.homeHeroBody)}
            </p>
            <Stagger
              variants={staggerFast}
              className="qp-glass inline-flex flex-wrap items-center gap-3 rounded-[1.75rem] px-3 py-3"
            >
              <MotionDiv variants={slideUp}>
                <Link
                  to="/dictionary"
                  className={`${anim.shineParchment} inline-flex items-center gap-2 rounded-full bg-parchment px-6 py-3 text-sm font-bold text-teal-950`}
                >
                  {text(KAA.sozlik)}
                  <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#0f766e' }} />
                </Link>
              </MotionDiv>
              <MotionDiv variants={slideUp}>
                <Link
                  to="/games"
                  className={`${anim.underlineParchment} inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/15 px-6 py-3 text-sm font-semibold text-parchment`}
                >
                  {text(KAA.oyinlar)}
                  <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#fde68a' }} />
                </Link>
              </MotionDiv>
            </Stagger>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-parchment/75">
              <Link to="/qoidalar" className="underline-offset-4 hover:underline hover:text-parchment">
                {text(KAA.qoidalarShort)}
              </Link>
              <Link to="/english" className="underline-offset-4 hover:underline hover:text-parchment">
                {text(KAA.englishShort)}
              </Link>
            </p>
          </PageEnter>
        </section>

        {/* Play doors — soft SaaS / qp-play-card grid */}
        <section className="relative mx-auto max-w-5xl px-6 py-16 md:px-10 motion-rise">
          <div className="qp-section-head">
            <div>
              <p className="mb-2 text-[0.7rem] uppercase tracking-[0.22em] text-ink/40">
                {text(KAA.homePlayEyebrow)}
              </p>
              <h2 className="font-display text-4xl tracking-tight text-ink">
                {text(KAA.homePlayTitle)}
              </h2>
            </div>
            <Link to="/games" className="qp-chip text-teal-900 no-underline">
              {text(KAA.homePlaySeeAll)}
              <AnimChevron count={1} className="opacity-60" />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {PLAY_DOORS.map((m) => (
              <Link key={m.to} to={m.to} className="qp-play-card group">
                <div className={`qp-play-card__media bg-gradient-to-br ${m.tone}`}>
                  <span className="qp-play-card__badge">
                    <Icon name="bolt" className="text-[0.75rem]" />
                    {text(KAA.homeDoorBadge)}
                  </span>
                  <div
                    className={`pointer-events-none absolute -right-6 -bottom-8 h-28 w-28 rounded-full ${m.orb} blur-2xl`}
                    aria-hidden
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/25 text-3xl text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105">
                      <Icon name={m.icon} />
                    </span>
                  </div>
                </div>
                <div className="qp-play-card__body">
                  <p className="font-display text-lg tracking-tight text-ink">
                    {text(KAA[m.titleKey] || m.titleKey)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink/50">
                    {text(KAA[m.descKey] || m.descKey)}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink/[0.06] pt-3">
                    <span className="text-xs font-medium text-ink/40">{text(KAA.homePlayEyebrow)}</span>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-teal-700">
                      {text(KAA.homeDoorCta)}
                      <AnimChevron count={2} className="opacity-70" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Qiziqarli madaniy bilim */}
        <section className="relative mx-auto max-w-5xl px-6 pb-12 md:px-10">
          <motion.div
            className="qp-surface overflow-hidden p-6 md:p-8"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/65">
              {text(KAA.qaraqalpaqTili)}
            </p>
            <h2 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
              {text(KAA.qiziqarliTitle)}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink/55 md:text-base">
              {text(KAA.qiziqarliLede)}
            </p>
            <Link to="/facts" className="qp-btn-primary mt-5 inline-flex">
              <Icon name="sparkle" />
              {text(KAA.qiziqarliHomeCta)}
              <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
            </Link>
          </motion.div>
        </section>

        {/* Soft Bugun — glass welcome strip */}
        <section className="relative mx-auto max-w-3xl px-6 pb-4 md:px-10">
          <div className="qp-panel relative overflow-hidden">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-amber-300/25 blur-2xl"
              aria-hidden
            />
            <p className="relative mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-amber-800/65">
              {text(KAA.homeTodayEyebrow)}
            </p>
            <h2 className="relative font-display text-2xl tracking-tight text-ink sm:text-3xl">
              {text(KAA.homeTodayTitle)}
            </h2>
            <p className="relative mt-1 max-w-md text-sm text-ink/55">{text(KAA.homeTodayBody)}</p>
            <div className="relative mt-4 flex flex-wrap items-center gap-2">
              <Link
                to={todaySoft.href}
                className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
              >
                <Icon name={todaySoft.icon} />
                {text(KAA[todaySoft.labelKey] || todaySoft.labelKey)}
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              <Link to="/profile" className="qp-btn-ghost !px-4 !py-2 !text-xs">
                <Icon name="users" />
                {text(KAA.profil)}
              </Link>
            </div>
          </div>
        </section>

        {/* Dictionary + soft first-run / resume */}
        <section className="relative mx-auto max-w-3xl px-6 pb-12 md:px-10">
          <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-ink/40">{text(KAA.sozlik)}</p>
          <h2 className="mb-2 font-display text-4xl tracking-tight text-ink md:text-5xl">
            {text(KAA.homeDictTitle)}
          </h2>
          <AnimIconDivider amber className="mb-4" />
          <p className="mb-8 max-w-md text-lg text-ink/60">{text(KAA.homeDictBody)}</p>
          <div className="mb-6">
            <SearchAutocomplete />
          </div>
          <ContinueLearning wordOfDay={wordOfDay} checkin={checkin} className="mb-6" />
          <FirstRunPath wordOfDay={wordOfDay} checkin={checkin} className="mb-8" />
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/dictionary" className="font-semibold text-teal-900 underline underline-offset-4">
              {text(KAA.sozlik)}
            </Link>
            <button type="button" onClick={goRandom} className="text-ink/50 hover:text-teal-900">
              {text(KAA.homeRandomWord)}
            </button>
          </div>

          <div
            id="kun-sozi"
            className="qp-panel relative mt-10 scroll-mt-28 overflow-hidden motion-rise"
          >
            <div
              className="pointer-events-none absolute -left-6 top-0 h-28 w-28 rounded-full bg-amber-300/20 blur-2xl"
              aria-hidden
            />
            <p className="mb-2 text-[0.65rem] uppercase tracking-[0.18em] text-amber-800/70">
              {text(KAA.kunSozi)}
            </p>
            {wordOfDay ? (
              <>
                <Link to={`/dictionary/${wordOfDay.id}`} className="block">
                  <p className="font-display text-3xl text-ink hover:text-teal-900">
                    {text(wordOfDay.soz)}
                  </p>
                  {wordOfDay.birinshi_aniqlama && (
                    <p className="mt-2 line-clamp-2 text-ink/65">{text(wordOfDay.birinshi_aniqlama)}</p>
                  )}
                </Link>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {checkin?.claimedToday ? (
                    <MotionDiv
                      variants={scaleIn}
                      className={`${anim.checkinPop} qp-chip bg-teal-50 text-teal-900`}
                    >
                      <Icon name="check" /> {text(KAA.kunSoziBelgilegen)}
                      {!claimFlash && checkin.pointsToday ? (
                        <>
                          {' · +'}
                          <CountUp value={checkin.pointsToday} durationMs={500} />
                        </>
                      ) : null}
                    </MotionDiv>
                  ) : (
                    <button
                      type="button"
                      onClick={onClaimCheckin}
                      disabled={claiming}
                      className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-ink shadow-sm transition hover:bg-amber-400 disabled:opacity-60"
                    >
                      <Icon name="bolt" />
                      {claiming
                        ? text('…')
                        : `${text(KAA.kunSoziBelgilaw)}${
                            checkin?.nextPoints ? ` · +${checkin.nextPoints}` : ''
                          }`}
                    </button>
                  )}
                  {claimFlash && (
                    <span
                      className={
                        claimError
                          ? 'rounded-full border border-rose-400/30 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-900'
                          : anim.pointsFloat
                      }
                    >
                      {claimFlash}
                    </span>
                  )}
                  <Link
                    to={wodPlayHref}
                    className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                  >
                    <Icon name="gamepad" />
                    {text(KAA.homeWodPlay)}
                    <AnimChevron count={2} className="opacity-80" />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-ink/55">{text(KAA.kunSoziUnavailable)}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={reload}
                    className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
                  >
                    <Icon name="sparkle" /> {text(KAA.kunSoziRetry)}
                  </button>
                  <Link
                    to="/dictionary"
                    className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                  >
                    <Icon name="book" /> {text(KAA.sozlik)}
                  </Link>
                  <Link to="/games" className="qp-btn-ghost !px-4 !py-2 !text-xs">
                    <Icon name="trophy" /> {text(KAA.oyinlar)}
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        {!isAuthenticated && (
          <section className="relative mx-auto max-w-3xl px-6 pb-20 md:px-10">
            <div className="qp-panel overflow-hidden bg-gradient-to-br from-teal-900/95 via-teal-800 to-emerald-800 text-parchment">
              <div className="flex flex-col gap-6 md:flex-row md:items-center">
                <div className="flex-1">
                  <h3 className="mb-2 font-display text-2xl">{text(KAA.dizimJaqsiraw)}</h3>
                  <p className="text-sm text-parchment/75">{text(KAA.dizimBenefit)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Link
                    to="/profile"
                    className="rounded-full bg-amber-300 px-6 py-3 text-center text-sm font-bold text-ink"
                  >
                    {text(KAA.profileGuestLogin)}
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-full border border-parchment/35 bg-white/10 px-6 py-3 text-center text-sm font-semibold text-parchment/95 backdrop-blur-sm hover:bg-parchment/15"
                  >
                    {text(KAA.dizimAshiw)}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {featured.length > 0 && (
          <section className="relative mx-auto max-w-3xl px-6 pb-24 theme-focus-hide md:px-10">
            <div className="qp-section-head">
              <div>
                <p className="mb-1 text-[0.7rem] uppercase tracking-[0.22em] text-ink/40">
                  {text(KAA.homeFeatured)}
                </p>
                <AnimIconDivider compact className="mb-1" />
              </div>
              <Link to="/dictionary" className="qp-chip text-teal-900 no-underline">
                {text(KAA.homePlaySeeAll)}
                <AnimChevron count={1} className="opacity-60" />
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {featured.map((w) => (
                <li key={w.id}>
                  <Link
                    to={`/dictionary/${w.id}`}
                    className="qp-card flex items-center justify-between px-4 py-3.5 no-underline"
                  >
                    <span className="truncate pr-3 text-sm font-semibold text-ink">{text(w.soz)}</span>
                    <AnimChevron count={2} className="shrink-0 opacity-45" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </PageGate>
    </ProtectedContent>
  );
}
