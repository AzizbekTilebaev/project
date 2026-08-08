import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import LearningSnapshot from '../components/LearningSnapshot';
import GuestLocalWeekPanel from '../components/GuestLocalWeekPanel';
import GuestSoftContinue from '../components/GuestSoftContinue';
import Icon from '../components/Icon';
import usePageMeta from '../hooks/usePageMeta';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { removeAvatar, updateProfile, uploadAvatar, linkGoogle, unlinkGoogle } from '../api/auth';
import GoogleSignInButton from '../components/GoogleSignInButton';
import LoyaltyBadge from '../components/LoyaltyBadge';
import { fetchWordOfDayCheckin, claimComboChest } from '../api/tusindirme';
import { fetchMyPoints, fetchPointsHistory } from '../api/points';
import { KAA } from '../i18n/kaa';
import { AnimChevron, AnimChevronToggle, anim } from '../animations';
import CountUp from '../components/CountUp';
import { safeMediaUrl } from '../lib/safeUrl';
import { getGuestLocalSummary } from '../lib/guestLocalSummary';
import useResumeTick from '../hooks/useResumeTick';
import PointsLedger from '../components/PointsLedger';
import CommunityProfileStrip from '../components/CommunityProfileStrip';
import ShareProgressButton from '../components/ShareProgressButton';
import { labelForPointsKind, formatPointsDelta } from '../lib/pointsLabels';
import { getDailyGoalStatus } from '../lib/dailyGoalProgress';

const fieldClass =
  'mt-2 w-full border-0 border-b border-ink/15 bg-transparent px-0 py-3 text-base text-ink outline-none transition placeholder:text-ink/30 focus:border-teal-700 sm:text-[0.95rem]';

const PRIMARY_FIELDS = [
  ['displayName', KAA.atiniz, 'text'],
  ['bio', KAA.bio, 'textarea'],
];

const EXTRA_FIELDS = [
  ['location', KAA.jaylasqan, 'text'],
  ['phone', KAA.telefon, 'text'],
  ['birthday', KAA.tuwilgan, 'date'],
  ['interests', KAA.qizigiwlar, 'text'],
  ['schools', KAA.mektep, 'text'],
];

function goalLabel(text, goal) {
  return text(
    goal.complete
      ? KAA.dailyGoalFull
      : goal.doneCount === 1
        ? KAA.dailyGoalHalf
        : KAA.dailyGoalEmpty
  );
}

function ProgressCard({ to, eyebrow, title, meta, tone = 'teal', children }) {
  const barTone = tone === 'amber' ? 'qp-progress--amber' : '';
  return (
    <Link to={to} className="qp-card qp-card--static block p-5 no-underline transition hover:-translate-y-0.5 hover:border-teal-700/20">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-ink/40">{eyebrow}</p>
      <p className="mt-2 font-display text-xl tracking-tight text-ink sm:text-2xl">{title}</p>
      {meta ? <p className="mt-1 text-sm text-ink/50">{meta}</p> : null}
      {children ? <div className={`mt-4 qp-progress ${barTone}`}>{children}</div> : null}
    </Link>
  );
}

export default function Profile() {
  const { text } = useUiScript();
  const { user, loading, logout, refresh, isAuthenticated, loginSuccess } = useAuth();
  usePageMeta(text(KAA.profil), text(KAA.jekeMagliwmat));
  const { items: favorites, count: favCount } = useDictionaryFavorites();
  const fileRef = useRef(null);
  const resumeTick = useResumeTick();
  const guestLocal = useMemo(() => getGuestLocalSummary(), [resumeTick]);

  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    location: '',
    phone: '',
    birthday: '',
    interests: '',
    schools: '',
  });
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState('ok');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [googleMsg, setGoogleMsg] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [loyalty, setLoyalty] = useState(null);
  const [guestCheckin, setGuestCheckin] = useState(null);
  const [claimingChest, setClaimingChest] = useState(false);
  const [chestMsg, setChestMsg] = useState('');
  const [chestJustOpened, setChestJustOpened] = useState(false);
  const [levelUpFlash, setLevelUpFlash] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [walletHistory, setWalletHistory] = useState([]);
  const [walletLoading, setWalletLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName: user.displayName || '',
      bio: user.bio || '',
      location: user.location || '',
      phone: user.phone || '',
      birthday: user.birthday ? String(user.birthday).slice(0, 10) : '',
      interests: (user.interests || []).join(', '),
      schools: (user.schools || []).join(', '),
    });
    const hasExtra =
      Boolean(user.location) ||
      Boolean(user.phone) ||
      Boolean(user.birthday) ||
      (user.interests || []).length > 0 ||
      (user.schools || []).length > 0;
    if (hasExtra) setShowExtra(true);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWordOfDayCheckin()
        .then((res) => {
          if (!cancelled) {
            setLoyalty(res.checkin?.chest || null);
            setGuestCheckin(res.checkin || null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoyalty(null);
            setGuestCheckin(null);
          }
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

  useEffect(() => {
    if (!isAuthenticated) {
      setWallet(null);
      setWalletHistory([]);
      return undefined;
    }
    let cancelled = false;
    setWalletLoading(true);
    Promise.all([
      fetchMyPoints().catch(() => null),
      fetchPointsHistory(8).catch(() => null),
    ]).then(([p, hist]) => {
      if (cancelled) return;
      setWallet(p?.wallet || null);
      setWalletHistory(hist?.history || []);
      setWalletLoading(false);
    });
    const onAuth = () => {
      setWalletLoading(true);
      Promise.all([
        fetchMyPoints().catch(() => null),
        fetchPointsHistory(8).catch(() => null),
      ]).then(([p, hist]) => {
        if (cancelled) return;
        setWallet(p?.wallet || null);
        setWalletHistory(hist?.history || []);
        setWalletLoading(false);
      });
    };
    window.addEventListener('qp:auth-changed', onAuth);
    return () => {
      cancelled = true;
      window.removeEventListener('qp:auth-changed', onAuth);
    };
  }, [isAuthenticated]);

  const onClaimChest = async (chestId) => {
    if (!chestId || claimingChest) return;
    setClaimingChest(true);
    setChestMsg('');
    try {
      const res = await claimComboChest(chestId);
      setLoyalty((prev) => {
        if (!prev) return prev;
        const pending = (prev.pending || []).filter((c) => c.id !== chestId);
        const history = res.chest
          ? [res.chest, ...(prev.history || []).filter((c) => c.id !== chestId)]
          : prev.history || [];
        return {
          ...prev,
          pending,
          history: history.slice(0, 8),
          next: res.next || prev.next,
        };
      });
      setChestJustOpened(true);
      setChestMsg(
        res.points?.earned > 0
          ? `${text(KAA.sandiqAshildiPop)} · +${res.points.earned}`
          : text(KAA.comboChestAshildi)
      );
      if (res.points?.leveledUp) {
        setLevelUpFlash({
          from: res.points.previousLevel,
          to: res.points.level,
        });
        window.setTimeout(() => setLevelUpFlash(null), 8000);
      }
      window.setTimeout(() => setChestMsg(''), 4500);
    } catch (err) {
      setChestMsg(err.message || text(KAA.qatelik));
    } finally {
      setClaimingChest(false);
    }
  };

  const goal = getDailyGoalStatus({
    claimedToday: guestCheckin?.claimedToday,
    titleId: guestCheckin?.titleId,
  });
  const goalHref = !goal.claimed
    ? '/#kun-sozi'
    : !goal.practiced && guestCheckin?.titleId
      ? `/dictionary/game?source=checkin&ids=${encodeURIComponent(guestCheckin.titleId)}&goal=wod`
      : guestLocal.primary?.href || '/quiz';

  if (loading) {
    return (
      <DictShell className="pt-28 pb-28">
        <div className="flex min-h-[40vh] flex-col items-center justify-center">
          <span className="qp-icon-tile mb-4 bg-gradient-to-br from-teal-600 to-teal-800">
            <Icon name="loader" className="animate-spin" />
          </span>
          <p className="font-display text-xl text-ink">{text(KAA.juklenipAtir)}</p>
        </div>
      </DictShell>
    );
  }

  if (!isAuthenticated) {
    const resume = guestLocal.primary;
    const goalPct = Math.min(100, Math.round((goal.doneCount / 2) * 100));

    return (
      <main className="dict-shell relative min-h-screen overflow-hidden pb-24">
        <div className="dict-atmosphere pointer-events-none absolute inset-0 theme-focus-hide" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-5 pt-28 sm:px-8 md:px-10">
          <header className="qp-section-head mb-8 animate-dict-rise">
            <div>
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-teal-800/55">
                {text(KAA.mehmonAkkaunt)}
              </p>
              <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
                {text(KAA.profileGuestTitle)}
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-ink/55">
                {text(KAA.profileGuestBody)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={resume?.href || '/tutor/practice'}
                className={`${anim.shine} qp-btn-primary`}
              >
                <Icon name={resume?.icon || 'bolt'} />
                {resume
                  ? text(KAA[resume.labelKey] || resume.labelKey)
                  : text(KAA.practiceNav)}
                <AnimChevron count={2} style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              <Link
                to="/login"
                state={{ from: resume?.href || '/' }}
                className="qp-btn-ghost"
              >
                {text(KAA.profileGuestLogin)}
              </Link>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 animate-dict-rise-delay">
                <ProgressCard
                  to={goalHref}
                  eyebrow={text(KAA.kunSozi || 'Kún sózi')}
                  title={goalLabel(text, goal)}
                  tone="amber"
                >
                  <i className="qp-progress__bar" style={{ width: `${goalPct}%` }} />
                </ProgressCard>
                <Link
                  to="/games"
                  className="qp-card group block overflow-hidden p-5 no-underline"
                >
                  <span className="qp-icon-tile mb-4 bg-gradient-to-br from-teal-500 to-teal-800">
                    <Icon name="trophy" />
                  </span>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-ink/40">
                    {text(KAA.oyinlar)}
                  </p>
                  <p className="mt-2 font-display text-2xl text-ink group-hover:text-teal-900">
                    {text(KAA.practiceNav)}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-teal-800/70">
                    {text(KAA.homeDoorCta)}
                    <AnimChevron count={2} className="opacity-70" />
                  </span>
                </Link>
              </div>

              {guestLocal.hasLocal ? (
                <div className="qp-panel animate-dict-rise">
                  <div className="qp-section-head mb-4">
                    <div>
                      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/40">
                        {text(KAA.haptaliqReviewLocal)}
                      </p>
                      <h2 className="font-display text-2xl tracking-tight text-ink">
                        {text(KAA.statistika)}
                      </h2>
                    </div>
                    <ShareProgressButton
                      compact
                      local={guestLocal}
                      claimedToday={Boolean(guestCheckin?.claimedToday)}
                      streak={
                        Number(guestCheckin?.streak) > 0
                          ? {
                              current: Number(guestCheckin.streak),
                              best: Number(guestCheckin.streak),
                            }
                          : null
                      }
                    />
                  </div>
                  <GuestLocalWeekPanel local={guestLocal} showPrimary eyebrow={null} />
                </div>
              ) : (
                <GuestSoftContinue
                  className="qp-panel"
                  bodyKey="authGuestFreeBody"
                />
              )}

              <div className="qp-panel">
                <LearningSnapshot dense favoritesCount={favCount} />
              </div>
              <div className="qp-panel">
                <CommunityProfileStrip />
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
              <div className="qp-panel text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/70 bg-gradient-to-br from-teal-600 to-teal-900 font-display text-3xl text-amber-50 shadow-lg">
                  ?
                </div>
                <p className="qp-chip mx-auto mb-2">{text(KAA.mehmonAkkaunt)}</p>
                <p className="font-display text-xl text-ink">{text(KAA.profileGuestTitle)}</p>
                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    to="/login"
                    state={{ from: resume?.href || '/' }}
                    className="qp-btn-primary w-full"
                  >
                    {text(KAA.profileGuestLogin)}
                  </Link>
                  <Link
                    to="/register"
                    state={{ from: resume?.href || '/' }}
                    className="qp-btn-ghost w-full"
                  >
                    {text(KAA.dizimAshiw)}
                  </Link>
                </div>
              </div>

              <div className="qp-panel">
                <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/40">
                  {text(KAA.dawamEtiw)}
                </p>
                <p className="mb-4 font-display text-lg text-ink">
                  {resume
                    ? text(KAA[resume.labelKey] || resume.labelKey)
                    : text(KAA.practiceNav)}
                </p>
                <Link
                  to={resume?.href || '/tutor/practice'}
                  className={`${anim.shine} qp-btn-primary w-full`}
                >
                  <Icon name={resume?.icon || 'bolt'} />
                  {text(KAA.dawamEtiw)}
                </Link>
              </div>

              <div className="qp-panel space-y-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/40">
                  {text(KAA.homeTodayEyebrow)}
                </p>
                <Link
                  to={goalHref}
                  className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white/50 px-3 py-3 transition hover:bg-white/80"
                >
                  <span className="qp-icon-tile !h-10 !w-10 !rounded-xl !text-base bg-gradient-to-br from-amber-400 to-amber-600">
                    <Icon name="bolt" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-ink">{goalLabel(text, goal)}</span>
                    <span className="block text-xs text-ink/45">{text(KAA.kunSozi || 'Kún sózi')}</span>
                  </span>
                </Link>
                <Link
                  to="/games"
                  className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white/50 px-3 py-3 transition hover:bg-white/80"
                >
                  <span className="qp-icon-tile !h-10 !w-10 !rounded-xl !text-base bg-gradient-to-br from-teal-500 to-teal-800">
                    <Icon name="gamepad" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-semibold text-ink">{text(KAA.oyinlar)}</span>
                    <span className="block text-xs text-ink/45">{text(KAA.oyinlarHubBody)}</span>
                  </span>
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await updateProfile({
        displayName: form.displayName,
        bio: form.bio,
        location: form.location,
        phone: form.phone,
        birthday: form.birthday || null,
        interests: form.interests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        schools: form.schools
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      await refresh();
      setMsgTone('ok');
      setMsg(KAA.saqlandi);
    } catch (err) {
      setMsgTone('err');
      setMsg(err.message || KAA.qatelik);
    } finally {
      setBusy(false);
    }
  };

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    setMsg('');
    try {
      await uploadAvatar(file);
      await refresh();
      setMsgTone('ok');
      setMsg(KAA.avatarJanalandi);
    } catch (err) {
      setMsgTone('err');
      setMsg(err.message || KAA.avatarJuklenbedi);
    } finally {
      setAvatarBusy(false);
    }
  };

  const onAvatarRemove = async () => {
    setAvatarBusy(true);
    setMsg('');
    try {
      await removeAvatar();
      await refresh();
      setMsgTone('ok');
      setMsg(KAA.avatarOshirildi);
    } catch (err) {
      setMsgTone('err');
      setMsg(err.message || KAA.qatelik);
    } finally {
      setAvatarBusy(false);
    }
  };

  const initial = (user.displayName || user.email || '?').slice(0, 1).toUpperCase();
  const displayTitle = user.displayName || text(KAA.paydalaniwshi);
  const resume = guestLocal.primary;
  const pendingChests = loyalty?.pending || [];
  const avatarSrc = safeMediaUrl(user.avatarUrl);
  const levelProgress = Math.min(100, Math.round(Number(wallet?.levelProgress || 0) * 100));
  const goalPct = Math.min(100, Math.round((goal.doneCount / 2) * 100));

  const badges = [];
  if (user.googleLinked) badges.push(text(KAA.googleBaylanǵan));
  if (user.totpEnabled) badges.push(text(KAA.totpQosılǵan));
  if (wallet?.level != null) badges.push(`${text(KAA.dareje)} ${wallet.level}`);

  const renderField = ([key, label, type]) => (
    <label key={key} className="block">
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/40">
        {text(label)}
      </span>
      {type === 'textarea' ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          rows={3}
          className={`${fieldClass} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          className={fieldClass}
        />
      )}
    </label>
  );

  return (
    <main className="dict-shell relative min-h-screen overflow-hidden pb-28">
      <div className="dict-atmosphere pointer-events-none absolute inset-0 theme-focus-hide" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 pt-28 sm:px-8 md:px-10">
        <header className="qp-section-head mb-8 animate-dict-rise">
          <div>
            <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-teal-800/55">
              {user.email || text(KAA.profil)}
            </p>
            <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
              {displayTitle}
            </h1>
            {badges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {badges.map((b) => (
                  <span key={b} className="qp-chip text-ink/70">
                    {b}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={resume?.href || goalHref}
              className={`${anim.shine} qp-btn-primary`}
            >
              <Icon name={resume?.icon || 'bolt'} />
              {resume
                ? text(KAA[resume.labelKey] || KAA.dawamEtiw)
                : text(KAA.practiceNav)}
              <AnimChevron count={2} style={{ ['--dch-color']: '#ecfdf5' }} />
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="qp-btn-ghost"
            >
              {text(KAA.shigiw)}
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          {/* —— Main column —— */}
          <div className="min-w-0 space-y-6">
            <section id="wallet-strip" className="scroll-mt-28 animate-dict-rise-delay">
              <div className="qp-section-head">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink/40">
                    {text(KAA.walletStripTitle)}
                  </p>
                  <h2 className="font-display text-3xl tracking-tight text-ink">
                    {walletLoading && wallet == null ? (
                      '…'
                    ) : (
                      <CountUp value={wallet?.balance ?? 0} durationMs={700} />
                    )}
                    <span className="ml-2 font-sans text-base font-semibold text-ink/40">
                      {text(KAA.dareje)} {wallet?.level ?? '—'}
                    </span>
                  </h2>
                </div>
                <Link to="/quiz/statistics#wallet" className="qp-chip text-teal-900 no-underline">
                  {text(KAA.walletSeeAll)}
                  <AnimChevron count={1} className="opacity-60" />
                </Link>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <ProgressCard
                  to={goalHref}
                  eyebrow={text(KAA.kunSozi || 'Máqset')}
                  title={goalLabel(text, goal)}
                  tone="amber"
                >
                  <i className="qp-progress__bar" style={{ width: `${goalPct}%` }} />
                </ProgressCard>

                <ProgressCard
                  to="/quiz/statistics#wallet"
                  eyebrow={text(KAA.walletSeeAll)}
                  title={
                    walletLoading && wallet == null ? (
                      '…'
                    ) : (
                      <CountUp value={wallet?.balance ?? 0} durationMs={700} />
                    )
                  }
                  meta={
                    walletHistory[0]
                      ? `${formatPointsDelta(walletHistory[0].amount)} · ${text(labelForPointsKind(walletHistory[0].kind))}`
                      : text(KAA.statistika)
                  }
                >
                  <i className="qp-progress__bar" style={{ width: `${levelProgress || 8}%` }} />
                </ProgressCard>

                <ProgressCard
                  to={pendingChests.length ? '#profile-chest' : '/#kun-sozi'}
                  eyebrow={text(KAA.comboChest)}
                  title={
                    pendingChests.length > 0
                      ? `${pendingChests.length} · ${text(KAA.comboChestAshiw)}`
                      : guestCheckin?.streak
                        ? (
                            <>
                              <CountUp value={guestCheckin.streak} durationMs={550} />{' '}
                              {text(KAA.kun).toLowerCase()}
                            </>
                          )
                        : text(KAA.comboChestKeepStreak)
                  }
                  tone="amber"
                >
                  <i
                    className="qp-progress__bar"
                    style={{
                      width: pendingChests.length
                        ? '100%'
                        : `${Math.min(100, ((Number(guestCheckin?.streak) || 0) % 7) * (100 / 7))}%`,
                    }}
                  />
                </ProgressCard>
              </div>

              {(wallet || walletLoading) && walletHistory.length > 0 ? (
                <div className="qp-panel mt-4">
                  <PointsLedger
                    history={walletHistory.slice(0, 3)}
                    loading={walletLoading}
                    compact
                  />
                </div>
              ) : null}
            </section>

            <section className="qp-panel">
              <LearningSnapshot favoritesCount={favorites.length} />
            </section>

            <section className="qp-panel">
              <CommunityProfileStrip />
            </section>

            {loyalty && (
              <section id="profile-chest" className="qp-panel scroll-mt-28 animate-dict-rise">
                <div className="qp-section-head">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-ink/40">
                      {text(KAA.comboChest)}
                    </p>
                    <h2 className="font-display text-2xl tracking-tight text-ink">
                      {pendingChests.length > 0
                        ? text(KAA.comboChestAshiw)
                        : text(KAA.comboChestKeepStreak)}
                    </h2>
                  </div>
                  {pendingChests.length > 0 ? (
                    <span className="qp-chip bg-amber-50 text-amber-900">
                      {pendingChests.length}
                    </span>
                  ) : null}
                </div>

                <LoyaltyBadge
                  history={loyalty.history || []}
                  pendingCount={pendingChests.length}
                  claimHref={pendingChests.length ? '#profile-chest' : ''}
                />

                {loyalty.next ? (
                  <p className="mt-3 text-sm text-ink/50">
                    {text(KAA.comboChestKeyin)} {loyalty.next.at}
                    {loyalty.next.remaining != null
                      ? ` · ${loyalty.next.remaining} ${text(KAA.kungaQaldy)}`
                      : ''}
                    {loyalty.next.reward?.points ? ` · +${loyalty.next.reward.points}` : ''}
                  </p>
                ) : null}

                {pendingChests.length > 0 ? (
                  <div className="mt-5 space-y-3">
                    {pendingChests.map((chest) => (
                      <div
                        key={chest.id}
                        className="qp-card qp-card--static flex flex-wrap items-center justify-between gap-4 p-4"
                      >
                        <div>
                          <p className="font-display text-xl text-ink">
                            {chest.streakAt} {text(KAA.kun).toLowerCase()}
                          </p>
                          <p className="text-sm text-ink/50">
                            +{chest.rewardPoints} {text(KAA.tangalar).toLowerCase()}
                            {chest.tier ? ` · ${chest.tier}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={claimingChest}
                          onClick={() => onClaimChest(chest.id)}
                          className={`${anim.shine} qp-btn-primary disabled:opacity-60`}
                        >
                          {claimingChest ? text('…') : text(KAA.comboChestAshiw)}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link to="/quiz" className={`${anim.shine} qp-btn-primary`}>
                      <Icon name="trophy" /> {text(KAA.dailyGoalNextQuiz)}
                    </Link>
                    <Link to="/tutor/practice" className="qp-btn-ghost">
                      <Icon name="bolt" /> {text(KAA.practiceNav)}
                    </Link>
                  </div>
                )}

                {chestMsg ? (
                  <p className={`mt-4 text-sm font-semibold text-teal-900 ${anim.pointsFloat}`}>
                    {chestMsg}
                  </p>
                ) : null}

                {chestJustOpened && !pendingChests.length ? (
                  <div className="mt-5">
                    <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/40">
                      {text(KAA.profileChestClaimed)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link to="/quiz" className={`${anim.shine} qp-btn-primary`}>
                        <Icon name="trophy" /> {text(KAA.dailyGoalNextQuiz)}
                      </Link>
                      <Link
                        to="/crossword"
                        className="qp-btn-ghost border-amber-500/35 bg-amber-50 text-amber-950"
                      >
                        <Icon name="grammar" /> {text(KAA.dailyGoalNextCrossword)}
                      </Link>
                    </div>
                  </div>
                ) : null}

                {levelUpFlash ? (
                  <div
                    className={`mt-5 rounded-[1.5rem] border border-teal-600/20 bg-gradient-to-br from-teal-50/90 to-amber-50/50 px-5 py-4 ${anim.checkinPop}`}
                  >
                    <p className="font-display text-xl text-teal-950">{text(KAA.levelUpTitle)}</p>
                    <p className="mt-1 text-sm text-teal-900/70">
                      {text(KAA.levelUpBody)
                        .replace('{from}', String(levelUpFlash.from || '?'))
                        .replace('{to}', String(levelUpFlash.to))}
                    </p>
                  </div>
                ) : null}
              </section>
            )}

            <section className="qp-surface p-6 md:p-8">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/40">
                {text(KAA.googleSignIn)}
              </p>
              <h2 className="mb-2 font-display text-2xl text-ink">{text(KAA.socialLoginTush)}</h2>
              {user.googleLinked ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="qp-chip bg-teal-50 text-teal-900">
                    {text(KAA.googleBaylanǵan)}
                  </span>
                  <button
                    type="button"
                    disabled={googleBusy || !user.hasPassword}
                    title={!user.hasPassword ? text(KAA.googleSınırıwHint) : undefined}
                    onClick={async () => {
                      setGoogleMsg('');
                      setGoogleBusy(true);
                      try {
                        const data = await unlinkGoogle();
                        if (data.user) loginSuccess({ user: data.user });
                        await refresh();
                      } catch (err) {
                        setGoogleMsg(err.message || KAA.qatelik);
                      } finally {
                        setGoogleBusy(false);
                      }
                    }}
                    className="text-xs font-medium text-rose-700 disabled:opacity-40"
                  >
                    {text(KAA.googleSınırıw)}
                  </button>
                  {!user.hasPassword ? (
                    <Link to="/settings" className="text-xs text-teal-900 underline">
                      {text(KAA.googleSınırıwHint)}
                    </Link>
                  ) : null}
                </div>
              ) : (
                <div className={`mt-4 ${googleBusy ? 'pointer-events-none opacity-60' : ''}`}>
                  <GoogleSignInButton
                    mode="signin"
                    showFallbackHint
                    onCredential={async ({ credential, nonce }) => {
                      setGoogleMsg('');
                      setGoogleBusy(true);
                      try {
                        const data = await linkGoogle(credential, nonce);
                        if (data.user) loginSuccess({ user: data.user });
                        await refresh();
                      } catch (err) {
                        setGoogleMsg(err.message || KAA.qatelik);
                      } finally {
                        setGoogleBusy(false);
                      }
                    }}
                    onError={(e) => setGoogleMsg(e?.message || KAA.googleSatsiz)}
                  />
                </div>
              )}
              {googleMsg ? (
                <p className="mt-2 text-sm text-rose-700" role="alert">
                  {text(googleMsg)}
                </p>
              ) : null}
            </section>

            <section className="qp-surface p-6 md:p-8">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/40">
                {text(KAA.jekeMagliwmat)}
              </p>
              <h2 className="mb-8 font-display text-3xl tracking-tight text-ink">
                {text(KAA.profil)}
              </h2>

              <form onSubmit={save} className="space-y-6">
                {PRIMARY_FIELDS.map(renderField)}

                <button
                  type="button"
                  onClick={() => setShowExtra((v) => !v)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-teal-900 hover:underline"
                  aria-expanded={showExtra}
                >
                  {text(showExtra ? KAA.qosimshaJasir : KAA.qosimsha)}
                  <AnimChevronToggle open={showExtra} />
                </button>

                {showExtra && <div className="space-y-6">{EXTRA_FIELDS.map(renderField)}</div>}

                {msg && (
                  <p
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      msgTone === 'err' ? 'bg-rose-50 text-rose-800' : 'bg-teal-50 text-teal-900'
                    }`}
                    role="status"
                  >
                    {text(msg)}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className={`${anim.shine} qp-btn-primary disabled:opacity-50`}
                >
                  {text(busy ? KAA.saqlanipAtir : KAA.saqlaw)}
                </button>
              </form>
            </section>

            <nav className="flex flex-wrap gap-x-6 gap-y-3 pt-2 text-sm">
              <Link to="/tutor" className="font-semibold text-teal-900 hover:underline">
                {text(KAA.uyretiwshi)}
              </Link>
              <Link to="/quiz/statistics" className="text-ink/50 hover:text-teal-900 hover:underline">
                {text(KAA.statistika)}
              </Link>
              <Link
                to="/dictionary/favorites"
                className="text-ink/50 hover:text-teal-900 hover:underline"
              >
                {text(KAA.yoqtirilganlar)}
              </Link>
              <Link to="/settings" className="text-ink/50 hover:text-teal-900 hover:underline">
                {text(KAA.sazlawlar)}
              </Link>
            </nav>
          </div>

          {/* —— Right utility sidebar —— */}
          <aside className="order-first space-y-4 lg:order-none lg:sticky lg:top-28 lg:self-start">
            <div className="qp-panel">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4 h-24 w-24 overflow-hidden rounded-[1.75rem] border-2 border-white/80 bg-teal-950/10 shadow-[0_18px_40px_-20px_rgba(15,118,110,0.55)]">
                  {avatarSrc ? (
                    <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-teal-600 to-teal-900 font-display text-4xl text-amber-50">
                      {initial}
                    </span>
                  )}
                </div>
                <p className="font-display text-xl tracking-tight text-ink">{displayTitle}</p>
                {user.email ? (
                  <p className="mt-1 truncate text-xs text-ink/45">{user.email}</p>
                ) : null}
                {badges.length > 0 ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {badges.slice(0, 2).map((b) => (
                      <span key={b} className="qp-chip !px-2 !py-0.5 text-[10px] text-ink/65">
                        {b}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={onAvatarPick}
              />
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}
                  className="qp-btn-primary !px-3.5 !py-2 !text-xs disabled:opacity-50"
                >
                  {text(avatarBusy ? '…' : KAA.suwret)}
                </button>
                {user.avatarUrl ? (
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={onAvatarRemove}
                    className="rounded-full px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-50"
                  >
                    {text(KAA.oshiriw)}
                  </button>
                ) : null}
              </div>

              <Link
                to="/dictionary/favorites"
                className="qp-chip mt-4 w-full justify-center text-teal-900 no-underline"
              >
                <Icon name="heart" filled /> {favCount} {text(KAA.yoqtirilganlar)}
              </Link>
            </div>

            <div className="qp-panel">
              <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/40">
                {text(KAA.dawamEtiw)}
              </p>
              <p className="mb-1 font-display text-lg text-ink">
                {resume
                  ? text(KAA[resume.labelKey] || KAA.dawamEtiw)
                  : text(KAA.practiceNav)}
              </p>
              <p className="mb-4 text-xs text-ink/45">{text(KAA.homeTodayBody)}</p>
              <Link
                to={resume?.href || goalHref}
                className={`${anim.shine} qp-btn-primary w-full`}
              >
                <Icon name={resume?.icon || 'bolt'} />
                {text(KAA.dawamEtiw)}
                <AnimChevron count={2} style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              <Link to="/tutor/practice" className="qp-btn-ghost mt-2 w-full">
                {text(KAA.practiceNav)}
              </Link>
            </div>

            <div className="qp-panel space-y-3">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/40">
                {text(KAA.homeTodayEyebrow)}
              </p>
              <Link
                to={goalHref}
                className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white/50 px-3 py-3 transition hover:bg-white/85"
              >
                <span className="qp-icon-tile !h-10 !w-10 !rounded-xl !text-base bg-gradient-to-br from-amber-400 to-amber-600">
                  <Icon name="bolt" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-ink">{goalLabel(text, goal)}</span>
                  <span className="block text-xs text-ink/45">{text(KAA.kunSozi || 'Máqset')}</span>
                </span>
              </Link>
              <Link
                to={pendingChests.length ? '#profile-chest' : '/#kun-sozi'}
                className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white/50 px-3 py-3 transition hover:bg-white/85"
              >
                <span className="qp-icon-tile !h-10 !w-10 !rounded-xl !text-base bg-gradient-to-br from-teal-500 to-sky-600">
                  <Icon name="sparkle" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-ink">
                    {pendingChests.length > 0
                      ? text(KAA.comboChestAshiw)
                      : text(KAA.comboChestKeepStreak)}
                  </span>
                  <span className="block text-xs text-ink/45">{text(KAA.comboChest)}</span>
                </span>
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white/50 px-3 py-3 transition hover:bg-white/85"
              >
                <span className="qp-icon-tile !h-10 !w-10 !rounded-xl !text-base bg-gradient-to-br from-teal-700 to-teal-900">
                  <Icon name="layers" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-semibold text-ink">{text(KAA.sazlawlar)}</span>
                  <span className="block text-xs text-ink/45">{text(KAA.jekeMagliwmat)}</span>
                </span>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
