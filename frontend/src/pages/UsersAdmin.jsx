import { useCallback, useEffect, useState } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  clearAdminToken,
  getAdminToken,
  fetchAdminMe,
  fetchUsersOverview,
  fetchUsers,
  fetchUserDetail,
  deleteUserData,
  fetchAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  resetAdminAccountPassword,
  fetchAdminQuizAttempts,
  fetchAttemptReviewAdmin,
  forceExpireAttemptAdmin,
  voidAttemptAdmin,
} from '../api/admin';
import AdminLoginForm from '../components/AdminLoginForm';
import { formatDurationMs } from '../lib/formatDuration';

const ROLE_LABELS = {
  owner: 'Owner (hámmesi)',
  editor: 'Editor (kontent)',
  uploader: 'Uploader (júklew)',
  moderator: 'Moderator (jámiyet)',
};

const FLAG_LABELS = {
  low_time_perfect: 'Tez / mukemmel',
  many_unanswered: 'Kóp juwapsız',
  in_progress: 'Dáwam etip atır',
  voided: 'Biykarlangan',
};

const ATTEMPT_STATUS_OPTS = [
  { value: '', label: 'Barlıq status' },
  { value: 'in_progress', label: 'Dáwam etip atır' },
  { value: 'completed', label: 'Juwmaqlangan' },
  { value: 'partial', label: 'Shala' },
  { value: 'expired', label: 'Múddeti ótken' },
  { value: 'voided', label: 'Biykarlangan' },
];

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('kaa', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(v);
  }
}

function FlagChips({ flags }) {
  const { text } = useUiScript();
  if (!flags?.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1">
      {flags.map((f) => (
        <span
          key={f}
          className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-900"
        >
          {text(FLAG_LABELS[f] || f)}
        </span>
      ))}
    </span>
  );
}

function AttemptReviewPanel({
  attemptReview,
  onClose,
  canManage = false,
  busy = false,
  onForceExpire,
  onVoid,
}) {
  const { text } = useUiScript();
  const summary = attemptReview.summary || {};
  const status = attemptReview.status;
  return (
    <div className="mt-6 qp-panel border-teal-200 bg-teal-50/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-xl text-ink">
          {text('Juwaplar')}: {text(attemptReview.title)}{' '}
          <span className="text-sm text-ink/50">
            ({attemptReview.score ?? '—'}/{attemptReview.total ?? '—'} · {attemptReview.status})
            {attemptReview.actorId != null ? ` · #${attemptReview.actorId}` : ''}
          </span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {canManage && status === 'in_progress' && onForceExpire ? (
            <button
              type="button"
              disabled={busy}
              onClick={onForceExpire}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 disabled:opacity-50"
            >
              {text('Force-expire')}
            </button>
          ) : null}
          {canManage && ['completed', 'partial'].includes(status) && onVoid ? (
            <button
              type="button"
              disabled={busy}
              onClick={onVoid}
              className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 disabled:opacity-50"
            >
              {text('Biykarlaw (void)')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink/60"
          >
            {text('Jabıw')}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-ink/55">
        {text('Juwap berilgen')}: {summary.answered ?? '—'} · {text('Kórilgen')}:{' '}
        {summary.viewed ?? '—'} · {text('Juwapsız')}: {summary.unanswered ?? '—'}
        {summary.totalTimeMs != null ? ` · ${formatDurationMs(summary.totalTimeMs)}` : ''}
        <FlagChips flags={summary.flags} />
      </p>
      <ol className="max-h-96 space-y-3 overflow-y-auto">
        {(attemptReview.results || []).map((r, i) => {
          const unanswered = r.givenIndex == null;
          const tone = unanswered
            ? 'qp-card qp-card--static'
            : r.correct
              ? 'rounded-xl border border-emerald-300/60 bg-emerald-50/60'
              : 'rounded-xl border border-rose-300/60 bg-rose-50/50';
          return (
            <li key={r.id} className={`${tone} px-4 py-3 text-sm`}>
              <p className="mb-1 font-semibold text-ink">
                {i + 1}. {text(r.question)}
                {!r.viewed ? (
                  <span className="ml-2 text-[0.65rem] font-semibold uppercase text-ink/40">
                    {text('kórilmegen')}
                  </span>
                ) : null}
              </p>
              {Array.isArray(r.options) && r.options.length ? (
                <ul className="mb-2 space-y-0.5 text-xs text-ink/55">
                  {r.options.map((opt, oi) => (
                    <li
                      key={oi}
                      className={
                        oi === r.correctIndex
                          ? 'font-semibold text-emerald-800'
                          : oi === r.givenIndex
                            ? 'font-semibold text-ink'
                            : ''
                      }
                    >
                      {oi === r.givenIndex ? '→ ' : '· '}
                      {text(opt)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-ink/70">
                {text('Juwabı')}: <b>{text(r.given ?? '—')}</b>
                {!r.correct && r.correctAnswer != null && (
                  <>
                    {' '}
                    · {text('Durısı')}:{' '}
                    <b className="text-emerald-800">{text(r.correctAnswer)}</b>
                  </>
                )}
                {r.timeSpentMs != null && (
                  <span className="text-ink/45"> · {formatDurationMs(r.timeSpentMs)}</span>
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StatCard({ label, value }) {
  const { text } = useUiScript();
  return (
    <div className="qp-card qp-card--static px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-ink/45">{text(label)}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}

export default function UsersAdmin() {
  const { text } = useUiScript();
  usePageMeta(
    text('Paydalanıwshılar admin'),
    text('Paydalanıwshılar hám rollar basqarıwı.')
  );

  const [authed, setAuthed] = useState(() => Boolean(getAdminToken()));
  const [me, setMe] = useState(null);

  const [tab, setTab] = useState('users'); // users | attempts | accounts
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userQ, setUserQ] = useState('');
  const [userQApplied, setUserQApplied] = useState('');
  const [activeDays, setActiveDays] = useState('');
  const [sort, setSort] = useState('last_seen');
  const [detail, setDetail] = useState(null);
  const [attemptReview, setAttemptReview] = useState(null);
  const [attemptReviewBusy, setAttemptReviewBusy] = useState(false);
  const [attempts, setAttempts] = useState([]);
  const [attemptsMeta, setAttemptsMeta] = useState({ total: 0, pages: 1, page: 1 });
  const [attFilter, setAttFilter] = useState({
    q: '',
    status: '',
    actorId: '',
    page: 1,
  });
  const [attDraft, setAttDraft] = useState({ q: '', status: '', actorId: '' });
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const [newAcc, setNewAcc] = useState({ email: '', password: '', role: 'editor' });

  const limit = 25;
  const isOwner = me?.admin?.role === 'owner';
  const canManageUsers = Boolean(me?.permissions?.includes('manage_users'));

  const loadMe = useCallback(async () => {
    try {
      const res = await fetchAdminMe();
      setMe(res);
      return res;
    } catch {
      setAuthed(false);
      setMe(null);
      return null;
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setError('');
    try {
      const [ov, list] = await Promise.all([
        fetchUsersOverview(),
        fetchUsers({ page, limit, activeDays, sort, q: userQApplied }),
      ]);
      setOverview(ov);
      setUsers(list.users || []);
      setTotal(list.total || 0);
    } catch (err) {
      setError(err.message || 'Júklew qáteligi');
    }
  }, [page, activeDays, sort, userQApplied]);

  const loadAttempts = useCallback(async () => {
    setError('');
    try {
      const res = await fetchAdminQuizAttempts({
        page: attFilter.page,
        limit,
        status: attFilter.status,
        actorId: attFilter.actorId,
        q: attFilter.q,
      });
      setAttempts(res.items || []);
      setAttemptsMeta({
        total: res.total || 0,
        pages: res.pages || 1,
        page: res.page || 1,
      });
    } catch (err) {
      setError(err.message || 'Urınıwlardı júklew qáteligi');
    }
  }, [attFilter]);

  const loadAccounts = useCallback(async () => {
    setError('');
    try {
      const res = await fetchAdminAccounts();
      setAccounts(res.accounts || []);
    } catch (err) {
      setError(err.message || 'Júklew qáteligi');
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadMe();
  }, [authed, loadMe]);

  useEffect(() => {
    if (!authed || !me) return;
    if (tab === 'users') loadUsers();
    if (tab === 'attempts') loadAttempts();
    if (tab === 'accounts' && isOwner) loadAccounts();
  }, [authed, me, tab, loadUsers, loadAttempts, loadAccounts, isOwner]);

  async function openAttemptReview(attemptId) {
    setAttemptReviewBusy(true);
    setError('');
    try {
      const data = await fetchAttemptReviewAdmin(attemptId);
      setAttemptReview(data);
    } catch (e) {
      setError(e.message || 'Juwaplardı júklew qáteligi');
    } finally {
      setAttemptReviewBusy(false);
    }
  }

  async function handleForceExpire(attemptId) {
    if (
      !window.confirm(
        text('Bul urınıwdı force-expire qılasız ba? Ball berilmeydi; jańadan baslaw múmkin boladı.')
      )
    ) {
      return;
    }
    setAttemptReviewBusy(true);
    setError('');
    setMsg('');
    try {
      await forceExpireAttemptAdmin(attemptId);
      setMsg(text('Urınıw expire qılındı'));
      if (tab === 'attempts') await loadAttempts();
      if (detail) {
        const res = await fetchUserDetail(detail.user.id);
        setDetail(res);
      }
      const data = await fetchAttemptReviewAdmin(attemptId);
      setAttemptReview(data);
    } catch (e) {
      setError(e.message || 'Force-expire qáteligi');
    } finally {
      setAttemptReviewBusy(false);
    }
  }

  async function handleVoidAttempt(attemptId) {
    const reason =
      window.prompt(text('Biykarlaw sebebi (ixtiyarıy):'), '') ?? null;
    if (reason === null) return;
    if (
      !window.confirm(
        text(
          'Urınıw void qılınadı hám berilgen ball qaytarıladı (múmkin bolsa). Dawam?'
        )
      )
    ) {
      return;
    }
    setAttemptReviewBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await voidAttemptAdmin(attemptId, { reason });
      const clawed = res.clawback?.amount || 0;
      setMsg(
        text(
          clawed > 0
            ? `Urınıw biykarlandı · ${clawed} ball qaytarıldı`
            : 'Urınıw biykarlandı'
        )
      );
      if (tab === 'attempts') await loadAttempts();
      if (detail) {
        const d = await fetchUserDetail(detail.user.id);
        setDetail(d);
      }
      const data = await fetchAttemptReviewAdmin(attemptId);
      setAttemptReview(data);
    } catch (e) {
      setError(e.message || 'Void qáteligi');
    } finally {
      setAttemptReviewBusy(false);
    }
  }

  async function handleLoginSuccess() {
    setAuthed(true);
  }

  function handleLogout() {
    clearAdminToken();
    setAuthed(false);
    setMe(null);
    setUsers([]);
    setOverview(null);
    setDetail(null);
    setAttempts([]);
    setAttemptReview(null);
  }

  async function openDetail(id) {
    setBusy(true);
    setError('');
    setAttemptReview(null);
    try {
      const res = await fetchUserDetail(id);
      setDetail(res);
    } catch (err) {
      setError(err.message || 'Detal qáteligi');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteUser(id) {
    if (
      !window.confirm(
        text(`#${id} paydalanıwshınıń barlıq maǵlıwmatları óshiriledi. Isenimlińiz be?`)
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await deleteUserData(id);
      setMsg(`#${id} óshirildi`);
      setDetail(null);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Óshiriw qáteligi');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAccount(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMsg('');
    try {
      await createAdminAccount(newAcc);
      setMsg(`${newAcc.email} jaratıldı (${newAcc.role})`);
      setNewAcc({ email: '', password: '', role: 'editor' });
      await loadAccounts();
    } catch (err) {
      setError(err.message || 'Jaratıw qáteligi');
    } finally {
      setBusy(false);
    }
  }

  async function handleRoleChange(acc, role) {
    setBusy(true);
    setError('');
    try {
      await updateAdminAccount(acc.id, { role });
      setMsg(`${acc.email} → ${role}`);
      await loadAccounts();
    } catch (err) {
      setError(err.message || 'Rol qáteligi');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(acc) {
    setBusy(true);
    setError('');
    try {
      await updateAdminAccount(acc.id, { active: !acc.active });
      setMsg(`${acc.email} ${acc.active ? 'óshirildi' : 'aktivlestirildi'}`);
      await loadAccounts();
    } catch (err) {
      setError(err.message || 'Qáte');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(acc) {
    const newPassword = window.prompt(
      text(`${acc.email} ushın jańa qupıya sóz (keminde 8 belgi):`)
    );
    if (!newPassword) return;
    setBusy(true);
    setError('');
    try {
      await resetAdminAccountPassword(acc.id, newPassword);
      setMsg(`${acc.email} qupıya sózi jańalandı`);
    } catch (err) {
      setError(err.message || 'Qupıya sóz qáte');
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="mx-auto max-w-md px-6 pt-8">
          <h1 className="mb-2 font-display text-3xl text-ink">{text('Paydalanıwshılar admin')}</h1>
          <AdminLoginForm
            subtitle="Akkaunt penen kiriń (email + qupıya sóz). Productionda legacy tek parol óshirip qoyılǵan."
            onSuccess={handleLoginSuccess}
          />
        </section>
      </DictShell>
    );
  }

  return (
    <DictShell className="pt-24 pb-24">
      <section className="mx-auto max-w-6xl px-6 pt-8 md:px-10">
        <div className="qp-section-head">
          <div>
            <p className="text-xs uppercase tracking-widest text-teal-800/60">
              {text('Admin')}
              {me?.admin?.role
                ? ` · ${text(ROLE_LABELS[me.admin.role] || me.admin.role)}`
                : ''}
            </p>
            <h1 className="font-display text-4xl text-ink">{text('Paydalanıwshılar')}</h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setTab('users');
                setAttemptReview(null);
              }}
              className={`rounded-full px-5 py-2.5 text-sm font-medium ${
                tab === 'users' ? 'bg-teal-100 text-teal-900 shadow-sm' : 'border border-ink/10 text-ink/55 hover:bg-teal-50/70'
              }`}
            >
              {text('Paydalanıwshılar')}
            </button>
            {canManageUsers || me?.permissions?.includes('view_users') ? (
              <button
                type="button"
                onClick={() => {
                  setTab('attempts');
                  setDetail(null);
                  setAttemptReview(null);
                }}
                className={`rounded-full px-5 py-2.5 text-sm font-medium ${
                  tab === 'attempts' ? 'bg-teal-100 text-teal-900 shadow-sm' : 'border border-ink/10 text-ink/55 hover:bg-teal-50/70'
                }`}
              >
                {text('Urınıwlar')}
              </button>
            ) : null}
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setTab('accounts');
                  setAttemptReview(null);
                }}
                className={`rounded-full px-5 py-2.5 text-sm font-medium ${
                  tab === 'accounts' ? 'bg-teal-100 text-teal-900 shadow-sm' : 'border border-ink/10 text-ink/55 hover:bg-teal-50/70'
                }`}
              >
                {text('Admin akkauntlar')}
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="qp-btn-ghost !px-5 !py-2.5 !text-sm"
            >
              {text('Shıǵıw')}
            </button>
          </div>
        </div>

        {msg && <p className="mb-4 text-sm text-emerald-700">{text(msg)}</p>}
        {error && <p className="mb-4 text-sm text-rose-700">{text(error)}</p>}

        {tab === 'users' && (
          <>
            {overview && (
              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Barlıǵı" value={overview.totals.totalUsers} />
                <StatCard label="Búgin aktiv" value={overview.totals.activeToday} />
                <StatCard label="Háptede" value={overview.totals.activeWeek} />
                <StatCard label="Ayda" value={overview.totals.activeMonth} />
                <StatCard label="Jańa (hápte)" value={overview.totals.newWeek} />
                <StatCard label="Quiz urınıwlar" value={overview.activity.quizAttempts} />
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                value={userQ}
                onChange={(e) => setUserQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setUserQApplied(userQ.trim());
                    setPage(1);
                  }
                }}
                placeholder={text('ID yamasa actor key…')}
                className="min-w-[12rem] flex-1 rounded-2xl border border-ink/10 px-4 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setUserQApplied(userQ.trim());
                  setPage(1);
                }}
                className="rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold"
              >
                {text('Izlew')}
              </button>
              <select
                value={activeDays}
                onChange={(e) => {
                  setActiveDays(e.target.value);
                  setPage(1);
                }}
                className="rounded-2xl border border-ink/10 px-4 py-2 text-sm"
                aria-label={text('Aktivlik filtri')}
              >
                <option value="">{text('Barlıq paydalanıwshılar')}</option>
                <option value="1">{text('Búgin aktiv')}</option>
                <option value="7">{text('Háptede aktiv')}</option>
                <option value="30">{text('Ayda aktiv')}</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-2xl border border-ink/10 px-4 py-2 text-sm"
                aria-label={text('Tártiplew')}
              >
                <option value="last_seen">{text('Aqırǵı aktivlik')}</option>
                <option value="created">{text('Jańa qosılǵanlar')}</option>
                <option value="attempts">{text('Quiz sanı')}</option>
              </select>
              <span className="text-sm text-ink/50">
                {text('Jámi')}: {total}
              </span>
            </div>

            <div className="overflow-x-auto qp-panel">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/45">
                    <th className="px-4 py-3">{text('ID')}</th>
                    <th className="px-4 py-3">{text('Jası')}</th>
                    <th className="px-4 py-3">{text('Quiz')}</th>
                    <th className="px-4 py-3">{text('Eventler')}</th>
                    <th className="px-4 py-3">{text('Kitap')}</th>
                    <th className="px-4 py-3">{text('Krossvord')}</th>
                    <th className="px-4 py-3">{text('Qosılǵan')}</th>
                    <th className="px-4 py-3">{text('Aqırǵı')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-ink/5 last:border-0">
                      <td className="px-4 py-3 font-mono">#{u.id}</td>
                      <td className="px-4 py-3">{u.ageConsent ? (u.ageYears ?? '—') : '—'}</td>
                      <td className="px-4 py-3">{u.quizAttempts}</td>
                      <td className="px-4 py-3">{u.events}</td>
                      <td className="px-4 py-3">{u.booksInProgress}</td>
                      <td className="px-4 py-3">{u.crosswordsDone}</td>
                      <td className="px-4 py-3 text-ink/55">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-ink/55">{fmtDate(u.lastSeenAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openDetail(u.id)}
                            className="qp-chip text-teal-900"
                          >
                            {text('Detal')}
                          </button>
                          {canManageUsers && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDeleteUser(u.id)}
                              className="rounded-full bg-rose-50 px-3 py-1 text-xs text-rose-700"
                            >
                              {text('Óshiriw')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-ink/45">
                        {text('Paydalanıwshı tabılmadı')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full border border-ink/15 px-4 py-1.5 text-sm disabled:opacity-40"
              >
                {text('← Aldıńǵı')}
              </button>
              <span className="text-sm text-ink/55">
                {page} / {Math.max(1, Math.ceil(total / limit))}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(total / limit)}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full border border-ink/15 px-4 py-1.5 text-sm disabled:opacity-40"
              >
                {text('Keyingi →')}
              </button>
            </div>

            {detail && (
              <div className="mt-8 qp-panel p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-2xl text-ink">
                    {text('Paydalanıwshı')} #{detail.user.id}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="rounded-full border border-ink/15 px-4 py-1.5 text-sm text-ink/60"
                  >
                    {text('Jabıw')}
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-ink/45">
                      {text('Profil')}
                    </p>
                    <ul className="space-y-1 text-sm text-ink/75">
                      <li>
                        {text('Qosılǵan')}: {fmtDate(detail.user.createdAt)}
                      </li>
                      <li>
                        {text('Aqırǵı aktivlik')}: {fmtDate(detail.user.lastSeenAt)}
                      </li>
                      <li>
                        {text('Jas')}:{' '}
                        {detail.user.ageConsent
                          ? (detail.user.ageYears ?? '—')
                          : text('kelisim joq')}
                      </li>
                      <li>
                        {text('Qátelikler bankı')}: {detail.mistakes.total} (
                        {text('ózlestirilgen')}: {detail.mistakes.mastered})
                      </li>
                    </ul>
                    {detail.ability?.length > 0 && (
                      <>
                        <p className="mb-1 mt-4 text-xs uppercase tracking-wide text-ink/45">
                          {text('Qábilet (IRT)')}
                        </p>
                        <ul className="space-y-1 text-sm text-ink/75">
                          {detail.ability.map((a) => (
                            <li key={a.skill}>
                              {text(a.skill)}: θ={Number(a.theta).toFixed(2)} (±
                              {Number(a.thetaSe).toFixed(2)}), {a.attempts} {text('urınıw')}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-ink/45">
                      {text('Aqırǵı quiz urınıwları')}
                    </p>
                    <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-ink/75">
                      {detail.quizAttempts.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-2">
                          <span>
                            {a.quizId} — {a.status}
                            {a.score != null ? ` (${a.score}/${a.total})` : ''} ·{' '}
                            {fmtDate(a.startedAt)}
                          </span>
                          <button
                            type="button"
                            disabled={attemptReviewBusy}
                            onClick={() => openAttemptReview(a.id)}
                            className="qp-chip shrink-0 text-teal-800 hover:bg-teal-100 disabled:opacity-50"
                          >
                            {text('Juwaplar')}
                          </button>
                          {canManageUsers && a.status === 'in_progress' ? (
                            <button
                              type="button"
                              disabled={attemptReviewBusy}
                              onClick={() => handleForceExpire(a.id)}
                              className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900 disabled:opacity-50"
                            >
                              {text('Expire')}
                            </button>
                          ) : null}
                          {canManageUsers && ['completed', 'partial'].includes(a.status) ? (
                            <button
                              type="button"
                              disabled={attemptReviewBusy}
                              onClick={() => handleVoidAttempt(a.id)}
                              className="shrink-0 rounded-full border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-50"
                            >
                              {text('Void')}
                            </button>
                          ) : null}
                        </li>
                      ))}
                      {detail.quizAttempts.length === 0 && (
                        <li className="text-ink/40">{text('Joq')}</li>
                      )}
                    </ul>
                    <p className="mb-2 mt-4 text-xs uppercase tracking-wide text-ink/45">
                      {text('Event túrleri')}
                    </p>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-ink/75">
                      {detail.eventSummary.map((e) => (
                        <li key={e.eventType}>
                          {e.eventType}: {e.count} ({text('aqırǵısı')} {fmtDate(e.lastAt)})
                        </li>
                      ))}
                      {detail.eventSummary.length === 0 && (
                        <li className="text-ink/40">{text('Joq')}</li>
                      )}
                    </ul>
                  </div>
                </div>

                {attemptReview && (
                  <AttemptReviewPanel
                    attemptReview={attemptReview}
                    onClose={() => setAttemptReview(null)}
                    canManage={canManageUsers}
                    busy={attemptReviewBusy}
                    onForceExpire={() => handleForceExpire(attemptReview.attemptId)}
                    onVoid={() => handleVoidAttempt(attemptReview.attemptId)}
                  />
                )}
              </div>
            )}
          </>
        )}

        {tab === 'attempts' && (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-2 qp-card qp-card--static p-3">
              <label className="min-w-[10rem] flex-1 text-xs text-ink/55">
                {text('Izlew')}
                <input
                  value={attDraft.q}
                  onChange={(e) => setAttDraft((d) => ({ ...d, q: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setAttFilter({ ...attDraft, page: 1 });
                    }
                  }}
                  placeholder={text('Test atı / id…')}
                  className="mt-1 w-full rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-ink/55">
                {text('Status')}
                <select
                  value={attDraft.status}
                  onChange={(e) => setAttDraft((d) => ({ ...d, status: e.target.value }))}
                  className="mt-1 block rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                >
                  {ATTEMPT_STATUS_OPTS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>
                      {text(o.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-ink/55">
                {text('Actor ID')}
                <input
                  value={attDraft.actorId}
                  onChange={(e) =>
                    setAttDraft((d) => ({
                      ...d,
                      actorId: e.target.value.replace(/\D/g, ''),
                    }))
                  }
                  placeholder="#"
                  className="mt-1 w-24 rounded-xl border border-ink/15 px-3 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={() => setAttFilter({ ...attDraft, page: 1 })}
                className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-semibold"
              >
                {text('Süzew')}
              </button>
              <span className="pb-1 text-xs text-ink/50">
                {text('Jámi')}: {attemptsMeta.total}
              </span>
            </div>

            <div className="overflow-x-auto qp-panel">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/45">
                    <th className="px-4 py-3">{text('Test')}</th>
                    <th className="px-4 py-3">{text('Actor')}</th>
                    <th className="px-4 py-3">{text('Status')}</th>
                    <th className="px-4 py-3">{text('Ball')}</th>
                    <th className="px-4 py-3">{text('Waqıt')}</th>
                    <th className="px-4 py-3">{text('Baslanǵan')}</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-b border-ink/5 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">{text(a.title)}</div>
                        <div className="font-mono text-[0.65rem] text-ink/40">{a.quizId}</div>
                        <FlagChips flags={a.flags} />
                      </td>
                      <td className="px-4 py-3 font-mono">#{a.actorId}</td>
                      <td className="px-4 py-3">
                        {a.status}
                        <div className="text-[0.65rem] text-ink/45">
                          {a.answeredCount}/{a.total ?? '—'} {text('juwap')} · {a.viewedCount}{' '}
                          {text('kórilgen')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.score != null ? `${a.score}/${a.total}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-ink/55">
                        {a.totalTimeMs ? formatDurationMs(a.totalTimeMs) : '—'}
                      </td>
                      <td className="px-4 py-3 text-ink/55">{fmtDate(a.startedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={attemptReviewBusy}
                            onClick={() => openAttemptReview(a.id)}
                            className="qp-chip text-teal-800 disabled:opacity-50"
                          >
                            {text('Juwaplar')}
                          </button>
                          {canManageUsers && a.status === 'in_progress' ? (
                            <button
                              type="button"
                              disabled={attemptReviewBusy}
                              onClick={() => handleForceExpire(a.id)}
                              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 disabled:opacity-50"
                            >
                              {text('Expire')}
                            </button>
                          ) : null}
                          {canManageUsers && ['completed', 'partial'].includes(a.status) ? (
                            <button
                              type="button"
                              disabled={attemptReviewBusy}
                              onClick={() => handleVoidAttempt(a.id)}
                              className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 disabled:opacity-50"
                            >
                              {text('Void')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setTab('users');
                              openDetail(a.actorId);
                            }}
                            className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink/60"
                          >
                            {text('Paydalanıwshı')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!attempts.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-ink/40">
                        {text('Urınıwlar joq')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {attemptsMeta.pages > 1 ? (
              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  disabled={attemptsMeta.page <= 1}
                  onClick={() =>
                    setAttFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))
                  }
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-sm disabled:opacity-40"
                >
                  {text('← Aldıńǵı')}
                </button>
                <span className="text-sm text-ink/55">
                  {attemptsMeta.page} / {attemptsMeta.pages}
                </span>
                <button
                  type="button"
                  disabled={attemptsMeta.page >= attemptsMeta.pages}
                  onClick={() => setAttFilter((f) => ({ ...f, page: f.page + 1 }))}
                  className="rounded-full border border-ink/15 px-4 py-1.5 text-sm disabled:opacity-40"
                >
                  {text('Keyingi →')}
                </button>
              </div>
            ) : null}

            {attemptReview && (
              <AttemptReviewPanel
                attemptReview={attemptReview}
                onClose={() => setAttemptReview(null)}
                canManage={canManageUsers}
                busy={attemptReviewBusy}
                onForceExpire={() => handleForceExpire(attemptReview.attemptId)}
                onVoid={() => handleVoidAttempt(attemptReview.attemptId)}
              />
            )}
          </>
        )}

        {tab === 'accounts' && isOwner && (
          <>
            <form
              onSubmit={handleCreateAccount}
              className="mb-8 grid gap-4 qp-panel p-6 sm:grid-cols-4"
            >
              <label className="block text-sm">
                <span className="text-ink/60">{text('Email')}</span>
                <input
                  type="email"
                  required
                  value={newAcc.email}
                  onChange={(e) => setNewAcc((v) => ({ ...v, email: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-ink/10 px-4 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink/60">{text('Qupıya sóz (≥8)')}</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newAcc.password}
                  onChange={(e) => setNewAcc((v) => ({ ...v, password: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-ink/10 px-4 py-2.5"
                />
              </label>
              <label className="block text-sm">
                <span className="text-ink/60">{text('Rol')}</span>
                <select
                  value={newAcc.role}
                  onChange={(e) => setNewAcc((v) => ({ ...v, role: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-ink/10 px-4 py-2.5"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {text(label)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full qp-btn-primary !py-2.5 !text-sm disabled:opacity-50"
                >
                  {text('Akkaunt jaratıw')}
                </button>
              </div>
            </form>

            <ul className="space-y-3">
              {accounts.map((acc) => (
                <li
                  key={acc.id}
                  className="flex flex-wrap items-center justify-between gap-3 qp-card qp-card--static px-5 py-4"
                >
                  <div>
                    <p className="font-semibold text-ink">
                      {acc.email}{' '}
                      {!acc.active && (
                        <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-xs text-rose-700">
                          {text('óshirilgen')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink/45">
                      {text('Jaratılǵan')}: {fmtDate(acc.createdAt)} · {text('Aqırǵı kiriw')}:{' '}
                      {fmtDate(acc.lastLoginAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={acc.role}
                      disabled={busy}
                      onChange={(e) => handleRoleChange(acc, e.target.value)}
                      className="rounded-2xl border border-ink/10 px-3 py-1.5 text-sm"
                      aria-label={text('Rol')}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {text(label)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleResetPassword(acc)}
                      className="qp-chip text-teal-900"
                    >
                      {text('Qupıya sózdi jańalaw')}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleActive(acc)}
                      className={`rounded-full px-4 py-1.5 text-sm ${
                        acc.active ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {text(acc.active ? 'Óshiriw' : 'Aktivlew')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </DictShell>
  );
}
