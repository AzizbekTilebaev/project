import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DictShell from '../components/dictionary/DictShell';
import PageGate from '../components/PageGate';
import AdminLoginForm from '../components/AdminLoginForm';
import usePageMeta from '../hooks/usePageMeta';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  cleanupAdminLogs,
  clearAdminToken,
  deleteAdminLog,
  deleteAdminLesson,
  fetchAdminDashboard,
  fetchAdminLessons,
  fetchAdminLogs,
  fetchAdminMe,
  fetchModeratorSuggestions,
  getAdminToken,
  moderateSuggestion,
  fetchGhostTitles,
  activateGhostTitles,
  updateGhostDescription,
  createDictionaryTitle,
  reactivateDictionaryTitle,
  fetchAdminExitFeedback,
} from '../api/admin';

const MODULES = [
  {
    path: '/admin/users',
    title: 'Paydalanıwshılar',
    description: 'Paydalanıwshı aktivligi, test urınıwları hám maǵlıwmat basqarıwı.',
    permission: ['view_users', 'manage_users'],
    color: 'bg-sky-50 border-sky-200 text-sky-900',
    icon: '👥',
  },
  {
    path: '/admin/users',
    title: 'Adminler hám rollar',
    description: 'Admin akkauntları, rollar, ruxsatlar hám qupıya sózler.',
    permission: ['manage_admins'],
    color: 'bg-slate-50 border-slate-200 text-slate-900',
    icon: '🛡️',
  },
  {
    path: '/admin/books',
    title: 'Kitaplar',
    description: 'Kitap qosıw, redaktorlaw, fayl júklew hám óshiriw.',
    permission: ['manage_books'],
    color: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: '📚',
  },
  {
    path: '/admin/lessons',
    title: 'Oqıw darsları',
    description: 'Bólim boyınsha dars generate, pin hám soraw redaktorlaw.',
    permission: ['manage_lessons'],
    color: 'bg-lime-50 border-lime-200 text-lime-900',
    icon: '📖',
  },
  {
    path: '/admin/crosswords',
    title: 'Krossvordlar',
    description: 'Krossvord jaratıw, sózlerdi jaylastırıw hám járiyalaw.',
    permission: ['manage_crosswords'],
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: '🧩',
  },
  {
    path: '/admin/quizzes',
    title: 'Testler',
    description: 'Test hám sorawlardı jaratıw, redaktorlaw hám óshiriw.',
    permission: ['manage_quizzes'],
    color: 'bg-teal-50 border-teal-200 text-teal-900',
    icon: '📝',
  },
  {
    path: '/admin/writers',
    title: 'Shayırlar',
    description: 'Shayır ómirbayánı, dóretiwshilik jumısları — eki alifbada.',
    permission: ['manage_writers'],
    color: 'bg-orange-50 border-orange-200 text-orange-900',
    icon: '✍️',
  },
  {
    path: '/admin/jumbaqlar',
    title: 'Jumbaqlar',
    description: 'Jumbaq qosıw, redaktorlaw, toparlaw hám óshiriw.',
    permission: ['manage_jumbaqlar'],
    color: 'bg-cyan-50 border-cyan-200 text-cyan-900',
    icon: '❓',
  },
  {
    path: '/admin/immersion',
    title: 'Media fayllar',
    description: 'Video, audio hám 3D fayllardı júklew hám basqarıw.',
    permission: ['manage_immersion'],
    color: 'bg-rose-50 border-rose-200 text-rose-900',
    icon: '🎬',
  },
  {
    path: '/admin/dictionary',
    title: 'Sózlik',
    description: 'Sóz izlew, jańa sóz, atın ózgertiw, jasıriw / qaytarıw.',
    permission: ['moderate_community'],
    color: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    icon: '📕',
  },
];

function formatNumber(value) {
  return new Intl.NumberFormat('kaa').format(Number(value) || 0);
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function StatCard({ label, value, detail }) {
  const { text } = useUiScript();
  return (
    <article className="qp-card qp-card--static p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">{text(label)}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
      {detail && <p className="mt-1 text-xs text-ink/50">{text(detail)}</p>}
    </article>
  );
}

function Login({ onSuccess }) {
  const { text } = useUiScript();
  return (
    <DictShell className="pt-24 pb-24">
      <section className="mx-auto max-w-md px-6 pt-10">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-teal-900 text-3xl text-white">⚙</div>
          <h1 className="font-display text-4xl text-ink">{text('Basqarıw paneli')}</h1>
          <p className="mt-2 text-sm text-ink/55">{text('Qáwipsiz admin akkauntı menen kiriń.')}</p>
        </div>
        <AdminLoginForm subtitle="" onSuccess={onSuccess} />
      </section>
    </DictShell>
  );
}

export default function AdminPanel() {
  const { text } = useUiScript();
  usePageMeta(text('Basqarıw paneli'), text('Platformanıń oraylıq basqarıw paneli.'));

  const [authenticated, setAuthenticated] = useState(() => Boolean(getAdminToken()));
  const [me, setMe] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [logs, setLogs] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [logLevel, setLogLevel] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [moderationStatus, setModerationStatus] = useState('pending');
  const [moderationType, setModerationType] = useState('');
  const [moderationPage, setModerationPage] = useState(1);
  const [moderationMeta, setModerationMeta] = useState({ total: 0, pages: 1 });
  const [modNotes, setModNotes] = useState({});
  const [lastApprove, setLastApprove] = useState(null);
  const [ghosts, setGhosts] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [ghostQ, setGhostQ] = useState('');
  const [ghostDrafts, setGhostDrafts] = useState({});
  const [newWord, setNewWord] = useState({ word: '', description: '', category: '' });
  const [createdTitle, setCreatedTitle] = useState(null);
  const [reactivateId, setReactivateId] = useState('');
  const [reactivatedTitle, setReactivatedTitle] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [feedback, setFeedback] = useState({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
    summary: { helpful: 0, total: 0, helpfulRate: null },
  });
  const [feedbackFilter, setFeedbackFilter] = useState('');
  const [feedbackDays, setFeedbackDays] = useState(30);

  const permissions = useMemo(() => new Set(me?.permissions || []), [me]);
  const canViewDashboard = permissions.has('view_stats');
  const canViewLogs = permissions.has('view_logs');
  const canManageLogs = permissions.has('manage_logs');
  const canModerate = permissions.has('moderate_community');
  const canManageLessons = permissions.has('manage_lessons');
  const availableModules = MODULES.filter((module) =>
    module.permission.some((permission) => permissions.has(permission))
  );

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const profile = await fetchAdminMe();
      setMe(profile);
      if (profile.permissions?.includes('view_stats')) {
        const result = await fetchAdminDashboard();
        setDashboard(result.dashboard);
      } else {
        setDashboard(null);
      }
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Maǵlıwmatlardı júklew múmkin bolmadı');
      setAuthenticated(false);
      setStatus('error');
    }
  }, []);

  const loadLogs = useCallback(async () => {
    if (!canViewLogs) return;
    setBusy(true);
    setError('');
    try {
      const result = await fetchAdminLogs({ level: logLevel, search: logSearch });
      setLogs(result);
    } catch (err) {
      setError(err.message || 'Qátelik jazıwların júklew múmkin bolmadı');
    } finally {
      setBusy(false);
    }
  }, [canViewLogs, logLevel, logSearch]);

  useEffect(() => {
    if (authenticated) load();
  }, [authenticated, load]);

  useEffect(() => {
    if (tab === 'logs' && canViewLogs) loadLogs();
  }, [tab, canViewLogs, loadLogs]);

  const loadSuggestions = useCallback(async () => {
    if (!canModerate) return;
    setBusy(true);
    try {
      const res = await fetchModeratorSuggestions({
        status: moderationStatus,
        type: moderationType,
        page: moderationPage,
        limit: 30,
      });
      setSuggestions(res.items || []);
      setModerationMeta({
        total: res.total || 0,
        pages: res.pages || 1,
      });
    } catch (err) {
      setError(err.message || 'Usınıslardı júklew múmkin bolmadı');
    } finally {
      setBusy(false);
    }
  }, [canModerate, moderationStatus, moderationType, moderationPage]);

  const loadGhosts = useCallback(async (page = 1) => {
    if (!canModerate) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetchGhostTitles({ page, limit: 25, q: ghostQ });
      const items = res.items || [];
      setGhosts({
        items,
        total: res.total || 0,
        page: res.page || page,
        pages: res.pages || 1,
      });
      setGhostDrafts((prev) => {
        const next = { ...prev };
        for (const g of items) {
          if (g.descriptionId && next[g.descriptionId] === undefined) {
            next[g.descriptionId] = g.description || '';
          }
        }
        return next;
      });
    } catch (err) {
      setError(err.message || 'Ghost titlelardı júklew múmkin bolmadı');
    } finally {
      setBusy(false);
    }
  }, [canModerate, ghostQ]);

  const loadLessons = useCallback(async () => {
    if (!canManageLessons) return;
    setBusy(true);
    try {
      const res = await fetchAdminLessons();
      setLessons(res.lessons || []);
    } catch (err) {
      setError(err.message || 'Darslardı júklew múmkin bolmadı');
    } finally {
      setBusy(false);
    }
  }, [canManageLessons]);

  const loadFeedback = useCallback(
    async (page = 1) => {
      if (!canViewDashboard) return;
      setBusy(true);
      try {
        const res = await fetchAdminExitFeedback({
          helpful: feedbackFilter,
          page,
          limit: 30,
          days: feedbackDays,
        });
        setFeedback({
          items: res.items || [],
          total: res.total || 0,
          page: res.page || 1,
          pages: res.pages || 1,
          summary: res.summary || { helpful: 0, total: 0, helpfulRate: null },
        });
      } catch (err) {
        setError(err.message || 'Feedback júklew múmkin bolmadı');
      } finally {
        setBusy(false);
      }
    },
    [canViewDashboard, feedbackFilter, feedbackDays]
  );

  useEffect(() => {
    if (tab === 'moderation') loadSuggestions();
    if (tab === 'ghosts') loadGhosts(1);
    if (tab === 'lessons') loadLessons();
    if (tab === 'feedback') loadFeedback(1);
  }, [tab, loadSuggestions, loadGhosts, loadLessons, loadFeedback]);

  async function decideSuggestion(id, approve) {
    setBusy(true);
    setError('');
    setLastApprove(null);
    try {
      const note = String(modNotes[id] || '').trim().slice(0, 255);
      const res = await moderateSuggestion(id, { approve, note });
      if (approve && res.titleId) {
        setLastApprove({ titleId: res.titleId, word: suggestions.find((s) => s.id === id)?.suggestedWord });
      }
      setModNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await loadSuggestions();
    } catch (err) {
      setError(err.message || 'Moderatsiya qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function activateGhost(ids) {
    const titleIds = Array.isArray(ids) ? ids : [ids];
    if (!titleIds.length) return;
    setBusy(true);
    setError('');
    try {
      await activateGhostTitles(titleIds);
      await loadGhosts(ghosts.page);
    } catch (err) {
      setError(err.message || 'Aktivlestiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function saveGhostSense(g, { activate = true } = {}) {
    const descriptionId = g.descriptionId;
    if (!descriptionId) {
      setError('descriptionId joq');
      return;
    }
    const textBody = String(ghostDrafts[descriptionId] ?? '').trim();
    if (!textBody) {
      setError('Túsindirme tekstin jazıń');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await updateGhostDescription(descriptionId, { description: textBody, activate });
      setGhostDrafts((prev) => {
        const next = { ...prev };
        delete next[descriptionId];
        return next;
      });
      await loadGhosts(ghosts.page);
    } catch (err) {
      setError(err.message || 'Saqlaw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function submitNewWord(e) {
    e?.preventDefault?.();
    const word = String(newWord.word || '').trim();
    const description = String(newWord.description || '').trim();
    if (!word || !description) {
      setError('Sóz hám anıqlama kerek');
      return;
    }
    setBusy(true);
    setError('');
    setCreatedTitle(null);
    try {
      const res = await createDictionaryTitle({
        word,
        description,
        category: String(newWord.category || '').trim() || null,
      });
      setCreatedTitle({ id: res.id, word: res.word || word });
      setNewWord({ word: '', description: '', category: '' });
    } catch (err) {
      setError(err.message || 'Sóz jaratıw qátesi');
      const existingId = err.payload?.titleId;
      if (existingId) {
        setCreatedTitle({
          id: existingId,
          word: err.payload?.word || word,
          existing: true,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitReactivate(e) {
    e?.preventDefault?.();
    const id = String(reactivateId || '').trim();
    if (!id) {
      setError('Title id kerek');
      return;
    }
    setBusy(true);
    setError('');
    setReactivatedTitle(null);
    try {
      const res = await reactivateDictionaryTitle(id);
      setReactivatedTitle({ id: res.id, word: res.word });
      setReactivateId('');
    } catch (err) {
      setError(err.message || 'Aktivlestiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  async function removeLesson(id) {
    if (!window.confirm(text('Bul dars óshiriledi (keyingi soralǵanda avtomat qayta dúziledi). Dawam etesiz be?'))) return;
    setBusy(true);
    try {
      await deleteAdminLesson(id);
      await loadLessons();
    } catch (err) {
      setError(err.message || 'Óshiriw qátesi');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearAdminToken();
    setAuthenticated(false);
    setMe(null);
    setDashboard(null);
  }

  async function removeLog(id) {
    if (!window.confirm(text('Bul qátelik jazıwın óshiresiz be?'))) return;
    setBusy(true);
    try {
      await deleteAdminLog(id);
      await loadLogs();
    } catch (err) {
      setError(err.message || 'Óshiriw múmkin bolmadı');
    } finally {
      setBusy(false);
    }
  }

  async function cleanupLogs() {
    const raw = window.prompt(text('Neshe kúnnen eski qátelik jazıwları óshirilsin?'), '30');
    if (!raw) return;
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 1) return;
    if (!window.confirm(text(`${days} kúnnen eski qátelik jazıwları tolıq óshiriledi. Dawam etesiz be?`))) return;
    setBusy(true);
    try {
      await cleanupAdminLogs(days);
      await Promise.all([loadLogs(), load()]);
    } catch (err) {
      setError(err.message || 'Tazalaw múmkin bolmadı');
    } finally {
      setBusy(false);
    }
  }

  if (!authenticated) return <Login onSuccess={() => setAuthenticated(true)} />;

  return (
    <PageGate status={status} error={error} onRetry={load}>
      <DictShell className="pt-24 pb-24">
        <section className="mx-auto max-w-6xl px-5 pt-6 md:px-8">
          <header className="flex flex-col gap-4 rounded-3xl bg-teal-950 p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-teal-200">{text('Oraylıq basqarıw')}</p>
              <h1 className="mt-2 font-display text-3xl md:text-4xl">{text('Basqarıw paneli')}</h1>
              <p className="mt-2 text-sm text-teal-100/70">
                {me?.admin?.email || text('Eskishe basqarıwshı')} · {me?.admin?.role || '—'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={load} className="rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/10">
                {text('Jańalaw')}
              </button>
              <button onClick={logout} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-teal-950">
                {text('Shıǵıw')}
              </button>
            </div>
          </header>

          <nav className="mt-5 flex gap-2 overflow-x-auto qp-surface p-2">
            {[
              ['overview', 'Ulıwma'],
              ['databases', 'Bazalar'],
              ...(canModerate
                ? [
                    ['moderation', 'Moderatsiya'],
                    ['ghosts', 'Ghost sózler'],
                    ['new-word', 'Jańa sóz'],
                  ]
                : []),
              ...(canManageLessons ? [['lessons', 'Darslar']] : []),
              ...(canViewDashboard ? [['feedback', 'Feedback']] : []),
              ...(canViewLogs ? [['logs', 'Qátelikler']] : []),
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${
                  tab === value ? 'bg-teal-100 text-teal-900 shadow-sm' : 'text-ink/55 hover:bg-teal-50/70'
                }`}
              >
                {text(label)}
              </button>
            ))}
          </nav>

          {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{text(error)}</p>}

          {tab === 'overview' && (
            <div className="mt-6 space-y-8">
              {canViewDashboard && dashboard && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard
                    label="Paydalanıwshılar"
                    value={formatNumber(dashboard.summary.users)}
                    detail={`Háptede aktiv: ${formatNumber(dashboard.summary.activeWeek)}`}
                  />
                  <StatCard
                    label="Test urınıwları"
                    value={formatNumber(dashboard.summary.quizAttempts)}
                    detail={`Juwmaqlanǵan: ${formatNumber(dashboard.summary.completedAttempts)}`}
                  />
                  <StatCard
                    label="Jıynalǵan ball"
                    value={formatNumber(dashboard.summary.pointsEarned)}
                    detail={`Sarplanǵan: ${formatNumber(dashboard.summary.pointsSpent)}`}
                  />
                  <StatCard
                    label="Sistema jaǵdayı"
                    value={`${dashboard.summary.healthyDatabases}/${dashboard.summary.databaseCount}`}
                    detail={`24 saatta qátelik: ${formatNumber(dashboard.summary.errorsLast24Hours)}`}
                  />
                  <StatCard
                    label="Exit feedback (30k)"
                    value={
                      dashboard.summary.exitFeedbackRate != null
                        ? `${dashboard.summary.exitFeedbackRate}%`
                        : '—'
                    }
                    detail={`Paydalı: ${formatNumber(dashboard.summary.exitFeedbackHelpful)} / ${formatNumber(dashboard.summary.exitFeedbackTotal)}`}
                  />
                  <StatCard
                    label="Funnel 7k · check-in"
                    value={formatNumber(dashboard.summary.funnelCheckin)}
                    detail={
                      dashboard.summary.funnelCheckinToGamePct != null
                        ? `→ oyın: ${dashboard.summary.funnelCheckinToGamePct}% (${formatNumber(dashboard.summary.funnelWodGame)})`
                        : `Oyın start: ${formatNumber(dashboard.summary.funnelWodGame)}`
                    }
                  />
                  <StatCard
                    label="Funnel 7k · quiz"
                    value={formatNumber(dashboard.summary.funnelQuiz)}
                    detail="quiz_completed event"
                  />
                </div>
              )}
              {canViewDashboard && dashboard?.funnel?.daily?.length > 0 && (
                <div className="qp-card qp-card--static overflow-x-auto p-4">
                  <h3 className="mb-3 font-display text-lg text-ink">Funnel — sońǵı 7 kún</h3>
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-ink/40">
                      <tr>
                        <th className="pb-2 pr-3">Kún</th>
                        <th className="pb-2 pr-3">Check-in</th>
                        <th className="pb-2 pr-3">WoD oyın</th>
                        <th className="pb-2">Quiz</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.funnel.daily.map((row) => (
                        <tr key={String(row.day)} className="border-t border-ink/5">
                          <td className="py-2 pr-3 font-mono text-xs">
                            {String(row.day).slice(0, 10)}
                          </td>
                          <td className="py-2 pr-3">{formatNumber(row.checkinDone)}</td>
                          <td className="py-2 pr-3">{formatNumber(row.wodGameStarted)}</td>
                          <td className="py-2">{formatNumber(row.quizCompleted)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <div className="qp-section-head !mb-3">
                  <div>
                    <h2 className="font-display text-2xl text-ink">{text('Basqarıw bólimleri')}</h2>
                    <p className="mt-1 text-sm text-ink/50">{text('Sizdiń rolińizge ashıq bólimler.')}</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {availableModules.map((module) => (
                    <Link
                      key={`${module.path}-${module.title}`}
                      to={module.path}
                      className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md ${module.color}`}
                    >
                      <span className="text-2xl" aria-hidden>{module.icon}</span>
                      <h3 className="mt-3 font-display text-xl">{text(module.title)}</h3>
                      <p className="mt-1 text-sm opacity-70">{text(module.description)}</p>
                      <p className="mt-4 text-sm font-semibold">{text('Ashıw')} →</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'databases' && (
            <div className="mt-6">
              {!canViewDashboard ? (
                <p className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-900">
                  {text('Baza statistikasın kóriw ushın ruxsat jeterli emes.')}
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {(dashboard?.databases || []).map((database) => (
                    <details key={database.key} className="qp-card qp-card--static p-5">
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-mono text-sm font-bold text-ink">{database.name}</p>
                            <p className="mt-1 text-xs text-ink/50">
                              {database.tableCount} {text('keste')} · {formatNumber(database.estimatedRows)} {text('qatar')} · {formatBytes(database.sizeBytes)}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            database.healthy ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {text(database.healthy ? `Islep tur · ${database.latencyMs} ms` : 'Baylanıs joq')}
                          </span>
                        </div>
                      </summary>
                      <div className="mt-4 max-h-72 overflow-auto border-t border-ink/10 pt-3">
                        {database.tables.map((table) => (
                          <div key={table.name} className="flex justify-between gap-4 py-1.5 text-xs">
                            <span className="font-mono text-ink/70">{table.name}</span>
                            <span className="text-ink/45">{formatNumber(table.estimatedRows)} · {formatBytes(table.sizeBytes)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'moderation' && canModerate && (
            <div className="mt-6 qp-panel p-5">
              <div className="qp-section-head !mb-4">
                <h2 className="font-display text-xl text-ink">{text('Jámiyet usınısları')}</h2>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={moderationStatus}
                    onChange={(e) => {
                      setModerationStatus(e.target.value);
                      setModerationPage(1);
                    }}
                    className="rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                  >
                    <option value="pending">{text('Kútilip turǵan')}</option>
                    <option value="approved">{text('Maǵullangan')}</option>
                    <option value="rejected">{text('Biykarlanǵan')}</option>
                    <option value="all">{text('Barlıǵı')}</option>
                  </select>
                  <select
                    value={moderationType}
                    onChange={(e) => {
                      setModerationType(e.target.value);
                      setModerationPage(1);
                    }}
                    className="rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                  >
                    <option value="">{text('Barlıq túr')}</option>
                    <option value="synonym">{text('Sinonim')}</option>
                    <option value="antonym">{text('Antoním')}</option>
                    <option value="compound">{text('Qospa')}</option>
                  </select>
                  <button
                    type="button"
                    onClick={loadSuggestions}
                    disabled={busy}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
                  >
                    {text('Jańalaw')}
                  </button>
                </div>
              </div>

              {lastApprove?.titleId ? (
                <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  {text('Maǵullandı')}:{' '}
                  <Link
                    to={`/dictionary/${encodeURIComponent(lastApprove.titleId)}`}
                    className="font-semibold underline"
                  >
                    {text(lastApprove.word || lastApprove.titleId)}
                  </Link>
                </p>
              ) : null}

              <div className="space-y-3">
                {suggestions.map((s) => (
                  <article key={s.id} className="qp-card qp-card--static p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">
                          {s.suggestedWord}
                          <span className="ml-2 rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink/55">
                            {s.suggestionType}
                          </span>
                          {s.status && s.status !== 'pending' ? (
                            <span
                              className={`ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${
                                s.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {s.status}
                            </span>
                          ) : null}
                        </p>
                        {s.sourceWord || s.mainWord ? (
                          <p className="mt-1.5 text-sm text-ink/70">
                            {s.suggestionType === 'compound' ? (
                              <>
                                {text('Tiykar')}:{' '}
                                {s.mainTitleId ? (
                                  <Link
                                    to={`/dictionary/${encodeURIComponent(s.mainTitleId)}`}
                                    className="font-semibold text-teal-900 hover:underline"
                                  >
                                    {s.mainWord || s.mainTitleId}
                                  </Link>
                                ) : (
                                  s.mainWord
                                )}
                              </>
                            ) : (
                              <>
                                {text('Manba')}:{' '}
                                {s.sourceTitleId ? (
                                  <Link
                                    to={`/dictionary/${encodeURIComponent(s.sourceTitleId)}`}
                                    className="font-semibold text-teal-900 hover:underline"
                                  >
                                    {s.sourceWord}
                                  </Link>
                                ) : (
                                  s.sourceWord
                                )}
                              </>
                            )}
                          </p>
                        ) : null}
                        {s.senseSnippet ? (
                          <p className="mt-1 text-xs italic leading-relaxed text-ink/50">
                            {s.senseSnippet}
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-ink/45">
                          👍 {s.upvotes} · 👎 {s.downvotes} · {new Date(s.createdAt).toLocaleString()}
                          {s.resolvedAt
                            ? ` · ${text('sheshildi')}: ${new Date(s.resolvedAt).toLocaleString()}`
                            : ''}
                        </p>
                        {s.moderatorNote ? (
                          <p className="mt-1 text-xs text-ink/55">
                            {text('Nota')}: {text(s.moderatorNote)}
                          </p>
                        ) : null}
                        {s.status === 'pending' ? (
                          <>
                            <label className="mt-3 block text-xs text-ink/55">
                              {text('Moderator notası (ixtıyarıy)')}
                              <input
                                value={modNotes[s.id] || ''}
                                onChange={(e) =>
                                  setModNotes((prev) => ({
                                    ...prev,
                                    [s.id]: e.target.value.slice(0, 255),
                                  }))
                                }
                                className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                                placeholder={text('Sebep yamasa esletpe…')}
                              />
                            </label>
                            <p className="mt-1 text-[0.65rem] text-teal-800/70">
                              {text('Maǵullaw — sóz public sózlikke shıǵadı')}
                            </p>
                          </>
                        ) : null}
                      </div>
                      {s.status === 'pending' ? (
                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => decideSuggestion(s.id, true)}
                            disabled={busy}
                            className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
                          >
                            {text('Maǵullaw')}
                          </button>
                          <button
                            type="button"
                            onClick={() => decideSuggestion(s.id, false)}
                            disabled={busy}
                            className="rounded-full border border-rose-300 px-4 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                          >
                            {text('Biykarlaw')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
                {!suggestions.length && (
                  <p className="rounded-2xl bg-white/60 p-8 text-center text-sm text-ink/50">
                    {text('Usınıslar joq.')}
                  </p>
                )}
              </div>

              {moderationMeta.pages > 1 ? (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={busy || moderationPage <= 1}
                    onClick={() => setModerationPage((p) => Math.max(1, p - 1))}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                  >
                    ←
                  </button>
                  <span className="text-xs text-ink/55">
                    {moderationPage} / {moderationMeta.pages} · {moderationMeta.total}
                  </span>
                  <button
                    type="button"
                    disabled={busy || moderationPage >= moderationMeta.pages}
                    onClick={() => setModerationPage((p) => p + 1)}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {tab === 'new-word' && canModerate && (
            <div className="mt-6 qp-panel p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-ink">{text('Jańa sóz qosıw')}</h2>
                  <p className="mt-1 text-xs text-ink/50">
                    {text('Public sózlikke status=1 menen shıǵadı. Birinshi anıqlama májburiy.')}
                  </p>
                </div>
                <Link
                  to="/admin/dictionary"
                  className="rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                >
                  {text('Tolıq sózlik admin →')}
                </Link>
              </div>
              <form onSubmit={submitNewWord} className="mx-auto max-w-xl space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    {text('Sóz')}
                  </span>
                  <input
                    type="text"
                    value={newWord.word}
                    onChange={(e) => setNewWord((prev) => ({ ...prev, word: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink"
                    maxLength={255}
                    disabled={busy}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    {text('Anıqlama')}
                  </span>
                  <textarea
                    rows={4}
                    value={newWord.description}
                    onChange={(e) =>
                      setNewWord((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm leading-relaxed text-ink"
                    disabled={busy}
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                    {text('Kategoriya (ixtıyarıy)')}
                  </span>
                  <input
                    type="text"
                    value={newWord.category}
                    onChange={(e) => setNewWord((prev) => ({ ...prev, category: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm text-ink"
                    maxLength={64}
                    disabled={busy}
                    placeholder={text('mısalı: zat, feyil…')}
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !newWord.word.trim() || !newWord.description.trim()}
                  className="qp-btn-primary !px-6 !py-2.5 !text-sm disabled:opacity-50"
                >
                  {text('Jaratıw')}
                </button>
              </form>
              {createdTitle?.id && (
                <div
                  className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                    createdTitle.existing
                      ? 'border-amber-300 bg-amber-50 text-amber-950'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-950'
                  }`}
                >
                  <p>
                    {text(
                      createdTitle.existing
                        ? 'Bul sóz aldınnan bar — ashıń yamasa WordDetail da redaktorlań.'
                        : 'Sóz jaratıldı — public sózlikte.'
                    )}
                  </p>
                  <Link
                    to={`/dictionary/${encodeURIComponent(createdTitle.id)}`}
                    className="mt-2 inline-flex font-semibold text-teal-900 underline"
                  >
                    {createdTitle.word || createdTitle.id} →
                  </Link>
                </div>
              )}

              <div className="mt-8 border-t border-ink/10 pt-6">
                <h3 className="font-display text-lg text-ink">{text('Jasıırılǵan sózdi qaytarıw')}</h3>
                <p className="mt-1 text-xs text-ink/50">
                  {text('WordDetail «Jasıriw» yamasa status=0 — title id menen qayta aktivlestiriń.')}
                </p>
                <form onSubmit={submitReactivate} className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
                  <label className="min-w-[16rem] flex-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink/45">
                      {text('Title id')}
                    </span>
                    <input
                      type="text"
                      value={reactivateId}
                      onChange={(e) => setReactivateId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 font-mono text-xs text-ink"
                      disabled={busy}
                      placeholder="uuid…"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy || !reactivateId.trim()}
                    className="qp-btn-primary !px-5 !py-2.5 !text-sm disabled:opacity-50"
                  >
                    {text('Aktivlestiriw')}
                  </button>
                </form>
                {reactivatedTitle?.id && (
                  <p className="mt-3 text-sm text-emerald-900">
                    {text('Aktivlestirildi')}:{' '}
                    <Link
                      to={`/dictionary/${encodeURIComponent(reactivatedTitle.id)}`}
                      className="font-semibold underline"
                    >
                      {reactivatedTitle.word || reactivatedTitle.id}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'ghosts' && canModerate && (
            <div className="mt-6 qp-panel p-5">
              <div className="qp-section-head !mb-4">
                <div>
                  <h2 className="font-display text-xl text-ink">{text('Jasıryn (status=0) jámiyet sózleri')}</h2>
                  <p className="mt-1 text-xs text-ink/50">
                    {text('Stubtı haqıyqıy túsindirme menen almastırıń, soń publicqa shıǵarıń.')}
                    {ghosts.total ? ` · ${ghosts.total}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={ghostQ}
                    onChange={(e) => setGhostQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadGhosts(1);
                    }}
                    placeholder={text('Izlew…')}
                    className="rounded-full border border-ink/15 bg-white px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => loadGhosts(1)}
                    disabled={busy}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
                  >
                    {text('Jańalaw')}
                  </button>
                  {ghosts.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => activateGhost(ghosts.items.map((g) => g.id))}
                      disabled={busy}
                      className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
                    >
                      {text('Betti aktivlestiriw')}
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                {ghosts.items.map((g) => (
                  <article key={g.id} className="qp-card qp-card--static p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{g.word}</p>
                        <label className="mt-2 block">
                          <span className="sr-only">{text('Túsindirme')}</span>
                          <textarea
                            rows={3}
                            value={ghostDrafts[g.descriptionId] ?? g.description ?? ''}
                            onChange={(e) =>
                              setGhostDrafts((prev) => ({
                                ...prev,
                                [g.descriptionId]: e.target.value,
                              }))
                            }
                            placeholder={text('Ámeliy mániler tekstin jazıń…')}
                            className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm leading-relaxed text-ink"
                          />
                        </label>
                        <p className="mt-2 text-xs text-ink/45">
                          {g.createdAt ? new Date(g.createdAt).toLocaleString() : '—'}
                          {' · '}
                          <span className="font-mono text-[0.65rem]">{g.id}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                        <Link
                          to={`/dictionary/${encodeURIComponent(g.id)}`}
                          className="rounded-full border border-ink/15 px-4 py-1.5 text-center text-xs font-semibold text-ink/70"
                        >
                          {text('Ashıw')}
                        </Link>
                        <button
                          type="button"
                          onClick={() => saveGhostSense(g, { activate: true })}
                          disabled={
                            busy ||
                            !String(ghostDrafts[g.descriptionId] ?? g.description ?? '').trim()
                          }
                          className="qp-btn-primary !px-4 !py-1.5 !text-xs disabled:opacity-50"
                        >
                          {text('Saqlaw + Aktivlestiriw')}
                        </button>
                        <button
                          type="button"
                          onClick={() => activateGhost(g.id)}
                          disabled={busy}
                          className="rounded-full border border-emerald-700/40 px-4 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-50"
                        >
                          {text('Tek aktivlestiriw')}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {!ghosts.items.length && (
                  <p className="rounded-2xl bg-white/60 p-8 text-center text-sm text-ink/50">
                    {text('Ghost sózler joq — kezek bos.')}
                  </p>
                )}
              </div>
              {ghosts.pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={busy || ghosts.page <= 1}
                    onClick={() => loadGhosts(ghosts.page - 1)}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                  >
                    ←
                  </button>
                  <span className="text-xs text-ink/55">
                    {ghosts.page} / {ghosts.pages}
                  </span>
                  <button
                    type="button"
                    disabled={busy || ghosts.page >= ghosts.pages}
                    onClick={() => loadGhosts(ghosts.page + 1)}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'lessons' && canManageLessons && (
            <div className="mt-6 qp-panel p-5">
              <div className="qp-section-head !mb-4">
                <h2 className="font-display text-xl text-ink">{text('Oqıw darsları')}</h2>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/admin/lessons"
                    className="qp-btn-primary !px-4 !py-1.5 !text-xs"
                  >
                    {text('Generate / pin')}
                  </Link>
                  <button onClick={loadLessons} disabled={busy} className="rounded-full border border-ink/15 px-4 py-1.5 text-xs">
                    {text('Jańalaw')}
                  </button>
                </div>
              </div>
              <p className="mb-4 text-xs text-ink/50">
                {text('Pin saqlansa oqıw usı darsdı aladı. Óshirilse — keyin avtomat dúziledi.')}
              </p>
              <div className="space-y-2">
                {lessons.map((lesson) => (
                  <article key={lesson.id} className="flex flex-wrap items-center justify-between gap-3 qp-card qp-card--static p-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {text(lesson.bookTitle || lesson.bookId)} · {text('Bólim')} #{lesson.sectionIndex + 1}
                        {lesson.sectionTitle ? ` — ${lesson.sectionTitle}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-ink/50">
                        {lesson.questionCount || lesson.lesson?.questions?.length || 0} {text('soraw')} · {text('jańalanǵan')}:{' '}
                        {new Date(lesson.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to="/admin/lessons"
                        className="rounded-full border border-teal-700/30 px-4 py-1.5 text-xs font-semibold text-teal-900"
                      >
                        {text('Ózgertiw')}
                      </Link>
                      <button
                        onClick={() => removeLesson(lesson.id)}
                        disabled={busy}
                        className="rounded-full border border-rose-300 px-4 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50"
                      >
                        {text('Óshiriw')}
                      </button>
                    </div>
                  </article>
                ))}
                {!lessons.length && (
                  <p className="rounded-2xl bg-white/60 p-8 text-center text-sm text-ink/50">{text('Darslar joq.')}</p>
                )}
              </div>
            </div>
          )}

          {tab === 'feedback' && canViewDashboard && (
            <div className="mt-6 qp-panel p-5">
              <div className="qp-section-head !mb-4">
                <div>
                  <h2 className="font-display text-xl text-ink">{text('Exit feedback')}</h2>
                  <p className="mt-1 text-xs text-ink/50">
                    {text('Paydalı')} {feedback.summary.helpfulRate != null ? `${feedback.summary.helpfulRate}%` : '—'} ·{' '}
                    {formatNumber(feedback.summary.helpful)}/{formatNumber(feedback.summary.total)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={feedbackFilter}
                    onChange={(e) => setFeedbackFilter(e.target.value)}
                    className="rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                  >
                    <option value="">{text('Barlıǵı')}</option>
                    <option value="1">{text('Paydalı')}</option>
                    <option value="0">{text('Paydalı emes')}</option>
                  </select>
                  <select
                    value={feedbackDays}
                    onChange={(e) => setFeedbackDays(Number(e.target.value))}
                    className="rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                  >
                    <option value={7}>{text('7 kún')}</option>
                    <option value={30}>{text('30 kún')}</option>
                    <option value={90}>{text('90 kún')}</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => loadFeedback(1)}
                    disabled={busy}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs"
                  >
                    {text('Jańalaw')}
                  </button>
                </div>
              </div>
              <ul className="space-y-2">
                {feedback.items.map((row) => (
                  <li
                    key={row.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      row.helpful
                        ? 'border-emerald-200/60 bg-emerald-50/40'
                        : 'border-rose-200/50 bg-rose-50/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] ${
                          row.helpful ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {text(row.helpful ? 'Paydalı' : 'Paydalı emes')}
                      </span>
                      <span className="text-xs text-ink/45">
                        {row.createdAt ? new Date(row.createdAt).toLocaleString() : ''}
                      </span>
                    </div>
                    {row.note ? (
                      <p className="mt-2 text-sm text-ink">{text(row.note)}</p>
                    ) : (
                      <p className="mt-2 text-xs text-ink/40">{text('Nota joq')}</p>
                    )}
                    <p className="mt-1 font-mono text-[0.65rem] text-ink/35">
                      #{row.id}
                      {row.actorId != null ? ` · actor ${row.actorId}` : ''}
                      {row.userId != null ? ` · user ${row.userId}` : ''}
                    </p>
                  </li>
                ))}
                {!feedback.items.length ? (
                  <li className="rounded-2xl bg-white/60 p-8 text-center text-sm text-ink/50">
                    {text('Feedback joq.')}
                  </li>
                ) : null}
              </ul>
              {feedback.pages > 1 ? (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={busy || feedback.page <= 1}
                    onClick={() => loadFeedback(feedback.page - 1)}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                  >
                    ←
                  </button>
                  <span className="text-xs text-ink/55">
                    {feedback.page} / {feedback.pages}
                  </span>
                  <button
                    type="button"
                    disabled={busy || feedback.page >= feedback.pages}
                    onClick={() => loadFeedback(feedback.page + 1)}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-xs disabled:opacity-40"
                  >
                    →
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {tab === 'logs' && canViewLogs && (
            <div className="mt-6">
              <div className="flex flex-col gap-3 qp-card qp-card--static p-4 md:flex-row">
                <input
                  value={logSearch}
                  onChange={(event) => setLogSearch(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && loadLogs()}
                  placeholder={text('Xabar, jol yamasa derek boyınsha izlew')}
                  className="min-w-0 flex-1 rounded-xl border border-ink/15 px-4 py-2.5"
                />
                <select
                  value={logLevel}
                  onChange={(event) => setLogLevel(event.target.value)}
                  className="rounded-xl border border-ink/15 px-4 py-2.5"
                >
                  <option value="">{text('Barlıq dáreje')}</option>
                  <option value="error">error</option>
                  <option value="warn">warn</option>
                  <option value="info">info</option>
                </select>
                <button onClick={loadLogs} disabled={busy} className="qp-btn-primary !px-5 !py-2.5 !text-sm">
                  {text('Izlew')}
                </button>
                {canManageLogs && (
                  <button onClick={cleanupLogs} disabled={busy} className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm text-rose-800">
                    {text('Eski jazıwlardı tazalaw')}
                  </button>
                )}
              </div>
              <p className="my-3 text-sm text-ink/50">{formatNumber(logs.total)} {text('jazıw')}</p>
              <div className="space-y-3">
                {logs.items.map((item) => (
                  <article key={item.id} className="qp-card qp-card--static p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2.5 py-1 font-bold ${
                        item.level === 'error' ? 'bg-rose-100 text-rose-800' :
                        item.level === 'warn' ? 'bg-amber-100 text-amber-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>{item.level}</span>
                      <span className="font-mono text-ink/55">{item.method} {item.path}</span>
                      <span className="ml-auto text-ink/40">{new Date(item.createdAt).toLocaleString('kaa')}</span>
                    </div>
                    <p className="mt-3 break-words text-sm text-ink">{item.message || '—'}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-ink/40">{item.source || 'server'} · HTTP {item.statusCode || '—'}</span>
                      {canManageLogs && (
                        <button onClick={() => removeLog(item.id)} className="text-xs font-semibold text-rose-700">
                          {text('Óshiriw')}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {!busy && logs.items.length === 0 && (
                  <p className="rounded-2xl bg-emerald-50 p-6 text-center text-sm text-emerald-800">
                    {text('Qátelik jazıwları tabılmadı.')}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </DictShell>
    </PageGate>
  );
}
