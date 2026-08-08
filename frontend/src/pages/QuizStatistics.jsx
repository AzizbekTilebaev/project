import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import PageGate from '../components/PageGate';
import ActivityHeatmap from '../components/ActivityHeatmap';
import usePageData from '../hooks/usePageData';
import usePageMeta from '../hooks/usePageMeta';
import useRecentWords from '../hooks/useRecentWords';
import { deleteMyData, fetchQuizStatistics } from '../api/quizzes';
import { fetchMyPoints, fetchPointsHistory, fetchLeaderboard, saveLeaderboardProfile } from '../api/points';
import { fetchMyActivity } from '../api/stats';
import { clearRememberedAttempt } from '../lib/anonymousId';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, anim, AnimChevron } from '../animations';
import { formatDurationMs } from '../lib/formatDuration';
import { recentPracticeHref } from '../lib/recentPractice';
import { getGuestLocalSummary } from '../lib/guestLocalSummary';
import useResumeTick from '../hooks/useResumeTick';
import GuestLocalWeekPanel from '../components/GuestLocalWeekPanel';
import PointsLedger from '../components/PointsLedger';
import ShareProgressButton from '../components/ShareProgressButton';
import { buildStatsDemoPreview, DEMO_USERS } from '../data/statsDemoPreview';

const STATS_PERIODS = [
  ['day', KAA.kun],
  ['week', KAA.hapte],
  ['15d', KAA.onBesKun],
  ['month', KAA.ay],
];

const MODE_LABELS = {
  solo: 'Jalǵız',
  sync: 'Birge',
  race: 'Jarıs',
  adaptive: 'Adaptiv',
};

function clearLocalPrivacyKeys() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('qp_') || k === 'books:progress' || k === 'favorites') keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  clearRememberedAttempt();
}

function StatTile({ label, value, note, accent = 'bg-teal-500' }) {
  return (
    <article className="qp-card qp-card--static px-5 py-4 transition-colors hover:bg-white">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink/45">
        <span className={`h-4 w-1 rounded-full ${accent}`} aria-hidden />
        {label}
      </p>
      <p className="mt-2 font-display text-4xl tracking-tight text-ink">{value}</p>
      {note && <p className="mt-1 text-xs text-ink/40">{note}</p>}
    </article>
  );
}

function ProgressRing({ percent = 0, label, sub }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <article className="flex flex-col items-center justify-center qp-card qp-card--static px-5 py-6 text-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="qpStatRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="60%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(31,41,55,0.08)" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="url(#qpStatRing)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-4xl tracking-tight text-ink">{pct}%</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-ink/70">{label}</p>
      {sub && <p className="mt-1 text-xs text-ink/40">{sub}</p>}
    </article>
  );
}

function ProgressRow({ label, value, count, color = 'from-teal-500 to-emerald-500' }) {
  const { text } = useUiScript();
  return (
    <li className="group">
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-ink/70">{label}</span>
        <span className="text-ink/50">
          {value}% · {count} {text('ret')}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className={`stats-grow-bar h-full rounded-full bg-gradient-to-r ${color}`}
          style={{ '--stats-width': `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </li>
  );
}

export default function QuizStatistics() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  usePageMeta(text('Statistika'), text('Tolıq progress, sózlik hám test statistikası.'));
  const [statsPeriod, setStatsPeriod] = useState('week');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [deleting, setDeleting] = useState(false);
  const [privacyMsg, setPrivacyMsg] = useState('');
  const [activity, setActivity] = useState(null);
  const { items: recentWords } = useRecentWords();
  const recentPlayHref = recentPracticeHref(recentWords, { limit: 8 });
  const resumeTick = useResumeTick();
  const guestLocal = useMemo(() => getGuestLocalSummary(), [resumeTick]);
  const { status, data, error, reload } = usePageData(() => fetchQuizStatistics(), {
    deps: [isAuthenticated],
  });

  const [points, setPoints] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [nickname, setNickname] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const demoPreview = useMemo(() => buildStatsDemoPreview(), []);
  const liveEmpty = (data?.statistics?.summary?.attempts ?? 0) === 0;
  const demoMode =
    searchParams.get('demo') === '1' ||
    (searchParams.get('demo') !== '0' && liveEmpty && status === 'ready');

  const setDemoMode = (on) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set('demo', '1');
    else next.set('demo', '0');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let alive = true;
    setHistoryLoading(true);
    Promise.all([
      fetchMyPoints().catch(() => null),
      fetchPointsHistory(50).catch(() => null),
      fetchLeaderboard(10).catch(() => null),
    ]).then(([p, hist, lb]) => {
      if (!alive) return;
      if (p) {
        setPoints(p);
        setNickname(p.profile?.nickname || '');
        setOptIn(Boolean(p.profile?.leaderboardOptIn));
      }
      setHistory(hist?.history || []);
      if (lb) setLeaderboard(lb.leaderboard || []);
      setHistoryLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (window.location.hash !== '#wallet') return undefined;
    const t = window.setTimeout(() => {
      document.getElementById('wallet')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [points, historyLoading]);

  useEffect(() => {
    let alive = true;
    fetchMyActivity({ days: 90, period: statsPeriod })
      .catch(() => null)
      .then((act) => {
        if (!alive) return;
        setActivity(act);
      });
    return () => {
      alive = false;
    };
  }, [statsPeriod, isAuthenticated]);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await saveLeaderboardProfile({ nickname, optIn });
      setProfileMsg('Saqlandı');
      const lb = await fetchLeaderboard(10).catch(() => null);
      if (lb) setLeaderboard(lb.leaderboard || []);
    } catch (err) {
      setProfileMsg(err.message || 'Saqlaw qáteligi');
    } finally {
      setSavingProfile(false);
    }
  }

  const liveStats = data?.statistics || {
    summary: {
      attempts: 0,
      completed: 0,
      multiplayer: 0,
      adaptive: 0,
      avgPercent: 0,
      bestPercent: 0,
    },
    categories: [],
    modes: [],
    trend: [],
    recent: [],
    ability: null,
    mistakes: { active: 0, totalWrong: 0 },
  };

  const stats = demoMode ? demoPreview.statistics : liveStats;
  const viewActivity = demoMode ? demoPreview.activity : activity;
  const viewPoints = demoMode ? demoPreview.points : points;
  const viewLeaderboard = demoMode ? demoPreview.leaderboard : leaderboard;
  const viewHistory = demoMode ? demoPreview.history : history;
  const viewRecentWords = demoMode ? demoPreview.recentWords : recentWords;
  const community = demoMode ? demoPreview.community : null;

  const filteredRecent = useMemo(() => {
    const recent = stats?.recent || [];
    if (historyFilter === 'all') return recent;
    if (historyFilter === 'adaptive') return recent.filter((a) => a.isAdaptive);
    return recent.filter((a) => (a.playMode || 'solo') === historyFilter);
  }, [stats?.recent, historyFilter]);

  const maxTrend = Math.max(1, ...(stats?.trend || []).map((d) => d.avgPercent || 0));

  async function handleDeleteData() {
    if (
      !window.confirm(
        text('Barlıq statistika hám lokal maǵlıwmat óshiriledi. Dawam etesiz be?')
      )
    )
      return;
    setDeleting(true);
    setPrivacyMsg('');
    try {
      await deleteMyData();
      clearLocalPrivacyKeys();
      setPrivacyMsg('Maǵlıwmat óshirildi.');
      reload();
    } catch (err) {
      setPrivacyMsg(err.message || 'Óshiriw múmkin bolmadı.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <PageGate
      status={demoMode ? 'ready' : status}
      error={demoMode ? null : error}
      onRetry={reload}
      backHref="/games"
      backLabel={text(KAA.oyinlar)}
    >
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-5xl px-5 pt-6 sm:px-6 md:px-10 md:pt-8 pb-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl tracking-tight text-ink sm:text-4xl md:text-5xl">
                {text(KAA.statistika)}
              </h1>
              <AnimIconDivider compact className="mt-2 mb-1" />
              <p className="mt-2 max-w-xl text-sm text-ink/50 sm:text-base">
                {text(KAA.faolliq)}
              </p>
              {isAuthenticated && (
                <Link
                  to="/profile"
                  className={`mt-2 inline-flex text-sm font-semibold text-teal-900 ${anim.underlineGrow}`}
                >
                  {text(KAA.profil)}
                  <AnimChevron count={2} className="ml-1 opacity-70" />
                </Link>
              )}
            </div>
            <div
              className="inline-flex flex-wrap gap-0.5 qp-chip !rounded-full p-1"
              role="group"
              aria-label={text(KAA.dawir)}
            >
              {STATS_PERIODS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStatsPeriod(id)}
                  aria-pressed={statsPeriod === id}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                    statsPeriod === id
                      ? 'bg-teal-900 text-white'
                      : 'text-ink/45 hover:text-ink'
                  }`}
                >
                  {text(label)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-700/15 bg-teal-50/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-teal-950">
                {demoMode
                  ? text(`Demo · ${DEMO_USERS} paydalanıwshı menen kórinis`)
                  : text('Haqıyqıy statistika')}
              </p>
              <p className="mt-0.5 text-xs text-ink/50">
                {demoMode
                  ? text('20–25 adam oynaganda bet qalay tolısatın kóriń. Maǵlıwmat úlgisi.')
                  : text('Sizdiń akkauntıńızdaǵı haqıyqıy nátiyjeler.')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDemoMode(!demoMode)}
              className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                demoMode
                  ? 'border border-teal-800/25 bg-white text-teal-950'
                  : 'bg-teal-900 text-white'
              }`}
            >
              {demoMode ? text('Haqıyqıyǵa ótiw') : text('Demo kórsetiw')}
            </button>
          </div>

          {community ? (
            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label={text('Aktiv paydalanıwshılar')}
                value={community.activeUsers}
                note={text('házirgi demo')}
                accent="bg-teal-600"
              />
              <StatTile
                label={text('Háptelik sessiyalar')}
                value={community.weekSessions}
                note={text('test + oyın')}
                accent="bg-sky-500"
              />
              <StatTile
                label={text('Sóz kóriniwleri')}
                value={community.weekWords}
                note={text('sózlik')}
                accent="bg-emerald-500"
              />
              <StatTile
                label={text('Oyınlar')}
                value={community.weekGames}
                note={text('háptede')}
                accent="bg-amber-500"
              />
            </div>
          ) : null}

          {/* Hero — yengil: bitta halqa + 4 tile (referens uslubi) */}
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,16rem)_1fr]">
            <ProgressRing
              percent={stats.summary.avgPercent}
              label={text('Ortasha nátiyje')}
              sub={`${text('Eń jaqsı')} ${stats.summary.bestPercent}%`}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTile
                label={text('Urınıslar')}
                value={stats.summary.attempts}
                note={`${stats.summary.completed} ${text('tamam')}`}
                accent="bg-teal-500"
              />
              <StatTile
                label={text(KAA.faolliqQatari)}
                value={viewActivity?.streak?.current ?? 0}
                note={`${text(KAA.eńJoqariQatar)}: ${viewActivity?.streak?.best ?? 0} ${text(KAA.kun).toLowerCase()}`}
                accent="bg-amber-500"
              />
              <StatTile
                label={text(KAA.tangalar)}
                value={viewPoints?.wallet?.balance ?? '—'}
                note={text(KAA.hazirgiBalans)}
                accent="bg-orange-400"
              />
              <StatTile
                label={text('Kóp oyınshılı')}
                value={stats.summary.multiplayer}
                note={`${stats.summary.adaptive} ${text('adaptiv')}`}
                accent="bg-sky-500"
              />
            </div>
          </div>

          {/* Vaqt — kichik tile qatori */}
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label={text(KAA.testWaqti)}
              value={formatDurationMs(viewActivity?.timeSpent?.quizMs)}
              accent="bg-teal-400"
            />
            <StatTile
              label={text(KAA.sozlikWaqti)}
              value={formatDurationMs(viewActivity?.timeSpent?.dictionaryMs)}
              accent="bg-emerald-400"
            />
            <StatTile
              label={text(KAA.krossvordWaqti)}
              value={formatDurationMs(viewActivity?.timeSpent?.crosswordMs)}
              accent="bg-rose-400"
            />
            <StatTile
              label={text(KAA.adebiyatWaqti)}
              value={formatDurationMs(viewActivity?.timeSpent?.literatureMs)}
              accent="bg-cyan-400"
            />
          </div>

          <div className="mb-8 flex justify-end">
            <ShareProgressButton
              compact
              streak={{
                current: viewActivity?.streak?.current ?? 0,
                best: viewActivity?.streak?.best ?? 0,
              }}
              review={
                viewActivity?.review ||
                (viewActivity?.quiz?.completes || viewActivity?.crossword?.completes
                  ? {
                      activeDays: viewActivity?.streak?.current
                        ? Math.min(7, viewActivity.streak.current)
                        : 0,
                      quizCompletes: viewActivity?.quiz?.completes ?? 0,
                      crosswordCompletes: viewActivity?.crossword?.completes ?? 0,
                      wordViews: 0,
                      dictGames: 0,
                    }
                  : null)
              }
              local={
                !demoMode && !(viewActivity?.streak?.current > 0) && guestLocal.hasLocal
                  ? guestLocal
                  : null
              }
              url={
                typeof window !== 'undefined'
                  ? `${window.location.origin}/quiz/statistics`
                  : undefined
              }
            />
          </div>

          <div className="mb-10 qp-card qp-card--static p-4 sm:p-5 md:p-6">
            <ActivityHeatmap days={viewActivity?.heatmap || []} />
          </div>

          {!demoMode && stats.summary.attempts === 0 && (
            <div className="mb-10 qp-surface border-dashed px-6 py-10 text-center">
              <Icon name="sparkle" className="mb-3 text-3xl text-teal-800" />
              <h2 className="mb-2 font-display text-2xl text-ink">{text(KAA.eleTestJoq)}</h2>
              <p className="mb-5 text-sm text-ink/50">{text(KAA.eleTestHint)}</p>
              {guestLocal.hasLocal && (
                <GuestLocalWeekPanel
                  local={guestLocal}
                  className="mb-5 text-left"
                  eyebrow={KAA.haptaliqReviewLocal}
                  showPrimary={false}
                />
              )}
              <div className="flex flex-wrap justify-center gap-3">
                {guestLocal.primary && (
                  <Link
                    to={guestLocal.primary.href}
                    className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-900 px-5 py-2.5 text-sm font-bold text-white`}
                  >
                    <Icon name={guestLocal.primary.icon} />
                    {text(KAA[guestLocal.primary.labelKey] || guestLocal.primary.labelKey)}
                    <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
                  </Link>
                )}
                <Link
                  to="/quiz"
                  className="rounded-full border border-teal-700/30 px-5 py-2.5 text-sm font-semibold text-teal-950"
                >
                  {text(KAA.testkeOtiw)}
                </Link>
                <Link
                  to="/quiz/adaptive"
                  className="rounded-full border border-teal-700/30 px-5 py-2.5 text-sm font-semibold text-teal-950"
                >
                  {text(KAA.adaptiv)}
                </Link>
              </div>
            </div>
          )}

          {viewPoints && (
            <div className="mb-10 grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-amber-300/50 bg-gradient-to-br from-amber-50/90 to-yellow-50/60 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-2xl text-ink">⭐ {text('Ballarım')}</h2>
                  <span className="rounded-full bg-amber-200/70 px-3 py-1 text-xs font-bold text-amber-900">
                    {text('Dáreje')} {viewPoints.wallet.level}
                  </span>
                </div>
                <p className="font-display text-4xl text-ink">{viewPoints.wallet.balance}</p>
                <p className="mt-1 text-sm text-ink/55">
                  {text('Jámi islengen')}: {viewPoints.wallet.totalEarned} · {text('Sarplanǵan')}:{' '}
                  {viewPoints.wallet.totalSpent} · {text('Reyting')}: #{viewPoints.rank}
                </p>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amber-200/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-500"
                    style={{
                      width: `${Math.round((viewPoints.wallet.levelProgress || 0) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-ink/45">
                  {text('Kelesi dáreje')}: {viewPoints.wallet.levelNextAt} {text('ball')}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to="/quiz"
                    className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white`}
                  >
                    <Icon name="trophy" /> {text(KAA.statsEarnBall)}
                  </Link>
                  <Link
                    to="/games"
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                  >
                    <Icon name="bolt" /> {text(KAA.oyinlar)}
                  </Link>
                </div>

                <PointsLedger
                  history={viewHistory}
                  loading={!demoMode && historyLoading}
                  className="mt-5 border-t border-amber-200/60 pt-5"
                />

                {!demoMode ? (
                <form onSubmit={handleSaveProfile} className="mt-5 space-y-3">
                  <label className="block text-sm">
                    <span className="text-ink/60">{text('Reyting taxallusı')}</span>
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      maxLength={40}
                      placeholder={text('mısalı: Batir_2026')}
                      className="mt-1 w-full rounded-2xl border border-ink/10 bg-white/80 px-4 py-2.5"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink/70">
                    <input
                      type="checkbox"
                      checked={optIn}
                      onChange={(e) => setOptIn(e.target.checked)}
                    />
                    {text('Reytingde kóriniwge ruxsat beremen')}
                  </label>
                  {profileMsg && <p className="text-xs text-teal-800">{text(profileMsg)}</p>}
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-full bg-amber-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {text('Saqlaw')}
                  </button>
                </form>
                ) : null}
              </article>

              <article className="qp-panel p-6">
                <h2 className="mb-4 font-display text-2xl text-ink">🏆 {text('Reyting (top 10)')}</h2>
                <ol className="space-y-2">
                  {viewLeaderboard.map((row) => (
                    <li
                      key={row.rank}
                      className="flex items-center justify-between rounded-2xl bg-parchment/40 px-4 py-2.5"
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            row.rank <= 3
                              ? 'bg-amber-400 text-white'
                              : 'bg-ink/10 text-ink/60'
                          }`}
                        >
                          {row.rank}
                        </span>
                        <span className="font-semibold text-ink">{text(row.nickname)}</span>
                      </span>
                      <span className="text-sm text-ink/55">
                        {row.totalEarned} {text('ball')} · D{row.level}
                      </span>
                    </li>
                  ))}
                  {!viewLeaderboard.length && (
                    <li className="space-y-3 text-sm text-ink/45">
                      <p>{text(KAA.statsEmptyBoard)}</p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to="/quiz"
                          className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                        >
                          <Icon name="trophy" /> {text(KAA.statsEarnBall)}
                        </Link>
                        <Link
                          to="/quiz/adaptive"
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                        >
                          <Icon name="sparkle" /> {text(KAA.adaptiv)}
                        </Link>
                      </div>
                    </li>
                  )}
                </ol>
              </article>
            </div>
          )}

          {viewRecentWords.length > 0 && (
            <div className="mb-10 qp-panel px-5 py-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink/70">{text('Sońǵı sózler')}</p>
                <div className="flex flex-wrap items-center gap-3">
                  {!demoMode && recentPlayHref && (
                    <Link
                      to={recentPlayHref}
                      className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white`}
                    >
                      <Icon name="bolt" /> {text(KAA.mashqEtiw)}
                    </Link>
                  )}
                  <Link
                    to="/dictionary"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline"
                  >
                    {text('Sózlik')}
                    <AnimChevron count={2} className="opacity-60" />
                  </Link>
                </div>
              </div>
              <ul className="flex flex-wrap gap-2">
                {viewRecentWords.slice(0, 8).map((w) => (
                  <li key={w.id}>
                    <Link
                      to={demoMode ? '/dictionary' : `/dictionary/${w.id}`}
                      className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-900 hover:bg-teal-100"
                    >
                      {text(w.soz)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-10 grid gap-6 lg:grid-cols-2">
            <article className="qp-panel p-6">
              <h2 className="mb-5 font-display text-2xl text-ink">{text('Kategoriyalar')}</h2>
              <ul className="space-y-5">
                {stats.categories.map((row, index) => (
                  <ProgressRow
                    key={row.category}
                    label={text(row.category || 'Basqa')}
                    value={row.avgPercent}
                    count={row.attempts}
                    color={[
                      'from-teal-500 to-emerald-500',
                      'from-teal-500 to-cyan-500',
                      'from-amber-400 to-orange-500',
                    ][index % 3]}
                  />
                ))}
                {!stats.categories.length && (
                  <li className="text-sm text-ink/45">{text('Maǵlıwmat joq.')}</li>
                )}
              </ul>
            </article>

            <article className="qp-panel p-6">
              <h2 className="mb-5 font-display text-2xl text-ink">{text('Oyın rejimleri')}</h2>
              <ul className="space-y-5">
                {stats.modes.map((row, index) => (
                  <ProgressRow
                    key={row.mode}
                    label={text(MODE_LABELS[row.mode] || row.mode)}
                    value={row.avgPercent}
                    count={row.attempts}
                    color={[
                      'from-sky-500 to-teal-500',
                      'from-rose-400 to-pink-500',
                      'from-teal-500 to-teal-600',
                    ][index % 3]}
                  />
                ))}
                {!stats.modes.length && (
                  <li className="text-sm text-ink/45">{text('Maǵlıwmat joq.')}</li>
                )}
              </ul>
            </article>
          </div>

          <article className="mb-10 qp-panel p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink">{text('30 kúnlik trend')}</h2>
              <span className="text-xs text-ink/40">{text('Ortasha %')}</span>
            </div>
            <div className="flex h-48 items-end gap-2 overflow-x-auto border-b border-ink/10 pb-1">
              {(stats.trend || []).map((day) => (
                <div
                  key={String(day.day)}
                  className="group flex min-w-8 flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-[10px] font-bold text-teal-800 opacity-0 transition group-hover:opacity-100">
                    {day.avgPercent}%
                  </span>
                  <div
                    className="stats-rise-column w-full max-w-12 rounded-t-xl bg-gradient-to-t from-teal-600 to-emerald-300 transition hover:brightness-110"
                    style={{
                      '--stats-height': `${Math.max(6, (day.avgPercent / maxTrend) * 145)}px`,
                    }}
                  />
                  <span className="text-[9px] text-ink/35">
                    {new Date(day.day).toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                </div>
              ))}
              {!stats.trend.length && (
                <p className="m-auto text-sm text-ink/45">
                  {text('Trend ushın maǵlıwmat joq.')}
                </p>
              )}
            </div>
          </article>

          <article className="mb-10 qp-panel p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">{text('Sońǵı urınıslar')}</h2>
              <div className="flex flex-wrap gap-1.5">
                {['all', 'solo', 'adaptive', 'sync', 'race'].map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setHistoryFilter(mode)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      historyFilter === mode
                        ? 'bg-teal-700 text-white'
                        : 'bg-teal-50 text-teal-900 hover:bg-teal-100'
                    }`}
                  >
                    {mode === 'all' ? text('Hámmesi') : text(MODE_LABELS[mode] || mode)}
                  </button>
                ))}
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {filteredRecent.map((attempt, index) => {
                const percent = attempt.total
                  ? Math.round((attempt.score / attempt.total) * 100)
                  : 0;
                return (
                  <li
                    key={attempt.id}
                    style={{ animationDelay: `${index * 0.05}s` }}
                    className="animate-dict-row qp-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{text(attempt.title)}</p>
                        <p className="mt-1 text-xs text-ink/45">
                          {attempt.isAdaptive
                            ? text('Adaptiv')
                            : text(MODE_LABELS[attempt.playMode] || 'Jalǵız')}
                        </p>
                      </div>
                      <span className="font-display text-2xl text-teal-900">{percent}%</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {!filteredRecent.length && (
                <li className="text-sm text-ink/45">{text('Bul filterde urınıs joq.')}</li>
              )}
            </ul>
          </article>

          <div className="rounded-3xl border border-rose-200/60 bg-rose-50/40 px-5 py-5">
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-ink/80">
              <Icon name="lock" className="text-rose-600" /> {text('Jeke maǵlıwmat')}
            </p>
            <p className="mb-4 text-sm text-ink/55">
              {text(
                'Serverdegi statistika hám lokal saqlanǵan maǵlıwmatlardı (qp_*, kitap progressi, unatqanlar) óshiriw.'
              )}
            </p>
            {privacyMsg && <p className="mb-3 text-sm text-teal-800">{text(privacyMsg)}</p>}
            <button
              type="button"
              disabled={deleting}
              onClick={handleDeleteData}
              className="rounded-full border border-rose-300 bg-white px-5 py-2.5 text-sm font-medium text-rose-800 hover:bg-rose-50 disabled:opacity-50"
            >
              {deleting ? text('Óshirilip atır...') : text('Maǵlıwmatımı óshiriw')}
            </button>
          </div>
        </section>
      </DictShell>
    </PageGate>
  );
}
