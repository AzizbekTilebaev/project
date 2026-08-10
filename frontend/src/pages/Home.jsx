import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  claimWordOfDayCheckin,
  fetchCurated,
  fetchWordOfDay,
  fetchWordOfDayCheckin,
} from '../api/tusindirme';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import Icon from '../components/Icon';
import LottieMark from '../components/LottieMark';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import { KAA } from '../i18n/kaa';
import { anim, AnimMatrixRain, AnimIconDivider, AnimChevron, PageEnter } from '../animations';
import CountUp from '../components/CountUp';
import { MotionDiv } from '../animations/Motion';
import { scaleIn } from '../animations/motionVariants';
import useRecentPages from '../hooks/useRecentPages';
import holyBibleBookLottie from '../assets/lottie/holy-bible-book.json';

const PLAY_DOORS = [
  {
    to: '/dictionary',
    icon: 'book',
    titleKey: 'sozlik',
    descKey: 'homeDoorDictDesc',
    tone: 'from-cyan-400 via-sky-500 to-indigo-600',
    orb: 'bg-sky-200/50',
  },
  {
    to: '/literature',
    icon: 'scroll',
    titleKey: 'kitapxana',
    descKey: 'homeDoorLitDesc',
    tone: 'from-sky-400 via-cyan-500 to-teal-600',
    orb: 'bg-sky-200/45',
    lottie: holyBibleBookLottie,
  },
  {
    to: '/games',
    icon: 'trophy',
    titleKey: 'oyinlar',
    descKey: 'homeDoorGamesDesc',
    tone: 'from-teal-400 via-emerald-500 to-teal-700',
    orb: 'bg-emerald-200/50',
  },
  {
    to: '/facts',
    icon: 'sparkle',
    titleKey: 'qiziqarliTitle',
    descKey: 'homeDoorFactsDesc',
    tone: 'from-amber-400 via-orange-500 to-rose-500',
    orb: 'bg-amber-200/50',
  },
];

export default function Home() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { has: hasFavorite, toggle: toggleFavorite } = useDictionaryFavorites();
  const [checkin, setCheckin] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimFlash, setClaimFlash] = useState(null);
  const [claimError, setClaimError] = useState(false);
  const recentPages = useRecentPages(3);

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

  const featured = (data?.curated || []).slice(0, 5);
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

          {/* Hero — brand; 5-shi bola = sońǵı 3 sahifa */}
          <section className="relative flex min-h-[78vh] flex-col justify-end px-6 pb-16 pt-24 md:px-10">
            <div
              className="absolute inset-0 theme-focus-hide"
              style={{
                background: 'linear-gradient(145deg, #0f766e 0%, #0e7490 42%, #f59e0b 120%)',
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
            <PageEnter className="relative z-[1] mx-auto w-full max-w-3xl text-white">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-amber-100">
                {text(KAA.qaraqalpaq)}
              </p>
              <h1 className="mb-5 font-display text-5xl tracking-tight text-white sm:text-6xl md:text-7xl">
                {text(KAA.qaraqalpaq)}
              </h1>
              <div className="anim-breathe-line" style={{ ['--dbl-color']: 'rgba(254, 243, 199, 0.65)' }} />
              <p className="mb-8 max-w-lg text-lg leading-relaxed text-white/85">
                {text(KAA.homeHeroBody)}
              </p>
              {/* nth-child(5) — sońǵı kirilgen 3 sahifa (hero ustida anıq kontrast) */}
              <div className="rounded-[1.75rem] border border-white/35 bg-black/25 px-4 py-4 shadow-lg backdrop-blur-md">
                <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-amber-100">
                  {text(KAA.homeRecentPages)}
                </p>
                {recentPages.length > 0 ? (
                  <ul className="grid gap-2 sm:grid-cols-3">
                    {recentPages.map((page) => (
                      <li key={`${page.group}-${page.path}`}>
                        <Link
                          to={page.path}
                          className="flex items-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-3 py-2.5 text-sm font-semibold text-white no-underline transition hover:bg-white/25"
                        >
                          <Icon name={page.icon || 'bolt'} className="shrink-0 text-amber-100" />
                          <span className="truncate">{text(KAA[page.labelKey] || page.labelKey)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/dictionary"
                      className="inline-flex items-center gap-2 rounded-full bg-amber-200 px-4 py-2 text-xs font-bold text-teal-950 no-underline"
                    >
                      {text(KAA.sozlik)}
                    </Link>
                    <Link
                      to="/literature"
                      className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-4 py-2 text-xs font-semibold text-white no-underline"
                    >
                      {text(KAA.kitapxana)}
                    </Link>
                    <Link
                      to="/games"
                      className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/15 px-4 py-2 text-xs font-semibold text-white no-underline"
                    >
                      {text(KAA.oyinlar)}
                    </Link>
                    <p className="basis-full text-xs text-white/70">{text(KAA.homeRecentPagesEmpty)}</p>
                  </div>
                )}
              </div>
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/75">
                <Link to="/dictionary" className="underline-offset-4 hover:underline hover:text-white">
                  {text(KAA.sozlik)}
                </Link>
                <Link to="/english" className="underline-offset-4 hover:underline hover:text-white">
                  {text(KAA.englishShort)}
                </Link>
              </p>
            </PageEnter>
          </section>

          {/* 1) Kún sózi */}
          <section className="relative mx-auto max-w-3xl px-6 py-12 md:px-10">
            <div
              id="kun-sozi"
              className="qp-panel relative scroll-mt-28 overflow-hidden motion-rise"
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
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 2) Sózlik · Kitapxana · Oyınlar · Qızıqlı — ixcham (~50%) */}
          <section className="relative mx-auto max-w-2xl px-6 pb-12 md:px-10 motion-rise">
            <div className="qp-section-head mb-4">
              <div>
                <p className="mb-1 text-[0.65rem] uppercase tracking-[0.22em] text-ink/40">
                  {text(KAA.homePlayEyebrow)}
                </p>
                <h2 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">
                  {text(KAA.homePlayTitle)}
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PLAY_DOORS.map((m) => (
                <Link key={m.to} to={m.to} className="qp-play-card qp-play-card--compact group no-underline">
                  <div className={`qp-play-card__media bg-gradient-to-br ${m.tone}`}>
                    <span className="qp-play-card__badge">
                      <Icon name="bolt" className="text-[0.6rem]" />
                      {text(KAA.homeDoorBadge)}
                    </span>
                    <div
                      className={`pointer-events-none absolute -right-4 -bottom-6 h-16 w-16 rounded-full ${m.orb} blur-xl`}
                      aria-hidden
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      {m.lottie ? (
                        <span className="pointer-events-none flex h-[78%] w-[78%] max-h-[5.5rem] max-w-[5.5rem] items-center justify-center bg-transparent transition group-hover:scale-105">
                          <LottieMark
                            animationData={m.lottie}
                            speed={0.4}
                            loop={false}
                            restartOnScroll
                            className="h-full w-full bg-transparent [&_svg]:bg-transparent"
                          />
                        </span>
                      ) : (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 text-lg text-white shadow-md backdrop-blur-sm transition group-hover:scale-105">
                          <Icon name={m.icon} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="qp-play-card__body">
                    <p className="font-display text-sm tracking-tight text-ink sm:text-base">
                      {text(KAA[m.titleKey] || m.titleKey)}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-ink/45 sm:text-xs">
                      {text(KAA[m.descKey] || m.descKey)}
                    </p>
                    <div className="mt-2 flex items-center justify-end border-t border-ink/[0.06] pt-2">
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-teal-700">
                        {text(KAA.homeDoorCta)}
                        <AnimChevron count={1} className="opacity-70" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* 3) Tańlanǵan sózler — 5 */}
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

          {!isAuthenticated && (
            <section className="relative mx-auto max-w-3xl px-6 pb-24 md:px-10">
              <div className="overflow-hidden rounded-[1.75rem] border border-teal-800/30 bg-gradient-to-br from-teal-900 via-teal-800 to-emerald-800 px-6 py-6 text-white shadow-lg md:px-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                  <div className="flex-1">
                    <h3 className="mb-2 font-display text-2xl text-white">{text(KAA.dizimJaqsiraw)}</h3>
                    <p className="text-sm text-white/80">{text(KAA.dizimBenefit)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Link
                      to="/profile"
                      className="rounded-full bg-amber-300 px-6 py-3 text-center text-sm font-bold text-teal-950 no-underline"
                    >
                      {text(KAA.profileGuestLogin)}
                    </Link>
                    <Link
                      to="/register"
                      className="rounded-full border border-white/40 bg-white/15 px-6 py-3 text-center text-sm font-semibold text-white no-underline backdrop-blur-sm hover:bg-white/25"
                    >
                      {text(KAA.dizimAshiw)}
                    </Link>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </PageGate>
    </ProtectedContent>
  );
}
