import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../Icon';
import {
  createRoom,
  joinRoom,
  leaveRoom,
  listOpenRooms,
  setRoomReady,
  startRoom,
} from '../../api/gameRooms';
import { getGameSocket, mergeRoomState, subscribeRoom } from '../../lib/gameSocket';
import { useUiScript } from '../../contexts/UiScriptContext';
import { anim } from '../../animations';
import { KAA } from '../../i18n/kaa';

const SEAT_OPTIONS = [2, 3, 4];

function buildInviteUrl(basePath, code) {
  const path = `${basePath || ''}/${code}`.replace(/\/{2,}/g, '/');
  const safe = path.startsWith('/') ? path : `/${path}`;
  if (typeof window === 'undefined') return safe;
  return `${window.location.origin}${safe}`;
}

export function LobbyInviteBar({ code, basePath, text }) {
  const [flash, setFlash] = useState('');

  const flashOk = (key) => {
    setFlash(key);
    window.setTimeout(() => setFlash(''), 1600);
  };

  const copyText = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      flashOk(key);
    } catch {
      /* ignore */
    }
  };

  const shareInvite = async () => {
    const url = buildInviteUrl(basePath, code);
    if (navigator.share) {
      try {
        await navigator.share({
          title: text(KAA.practiceMultiplayer),
          text: code,
          url,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    await copyText(url, 'link');
  };

  return (
    <div className="mt-4 rounded-2xl border border-teal-700/15 bg-teal-50/40 px-3.5 py-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copyText(code, 'code')}
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
        >
          <Icon name="layers" /> {text(KAA.lobbyInviteCopyCode)}
        </button>
        <button
          type="button"
          onClick={() => copyText(buildInviteUrl(basePath, code), 'link')}
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
        >
          <Icon name="link" /> {text(KAA.lobbyInviteCopyLink)}
        </button>
        <button
          type="button"
          onClick={shareInvite}
          className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white`}
        >
          <Icon name="share" /> {text(KAA.lobbyInviteShare)}
        </button>
      </div>
      {flash ? (
        <p className="mt-2 text-xs font-semibold text-teal-900" role="status">
          {text(KAA.lobbyInviteCopied)}
          {flash === 'code' ? ` · ${code}` : ''}
        </p>
      ) : null}
    </div>
  );
}

function OpenLobbiesPanel({
  gameType,
  text,
  displayName,
  persistName,
  guardPlay,
  handlePlayError,
  onJoined,
  goToRoomUrl,
  busy,
  setBusy,
  setError,
}) {
  const [lobbies, setLobbies] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listOpenRooms({ gameType, limit: 12 });
      setLobbies(res.lobbies || []);
    } catch {
      setLobbies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameType]);

  const joinOpen = async (code) => {
    if (!guardPlay()) return;
    setError('');
    setBusy(true);
    try {
      const name = await persistName(displayName);
      const data = await joinRoom({ code, displayName: name });
      onJoined?.(data.room);
      goToRoomUrl?.(data.room?.code);
    } catch (err) {
      handlePlayError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 rounded-2xl border border-ink/[0.07] bg-parchment/40 px-4 py-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink/45">
          {text(KAA.lobbyOpenTitle)}
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs font-bold text-teal-900 hover:underline disabled:opacity-50"
        >
          {text(KAA.lobbyOpenRefresh)}
        </button>
      </div>
      {loading && !lobbies.length ? (
        <p className="inline-flex items-center gap-2 text-sm text-ink/45">
          <Icon name="loader" className="animate-spin" /> {text(KAA.juklenipDot)}
        </p>
      ) : !lobbies.length ? (
        <p className="text-sm text-ink/45">{text(KAA.lobbyOpenEmpty)}</p>
      ) : (
        <ul className="space-y-2">
          {lobbies.map((lobby) => (
            <li
              key={lobby.code}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-ink/10 bg-white/80 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-display text-lg tracking-wider text-teal-900">{lobby.code}</p>
                <p className="truncate text-xs text-ink/50">
                  {lobby.hostName ? `${lobby.hostName} · ` : ''}
                  {lobby.mode}
                  {lobby.contentId ? ` · ${String(lobby.contentId).slice(0, 10)}` : ''}
                  {' · '}
                  {text(KAA.lobbyOpenSeats).replace('{n}', String(lobby.seatsLeft))}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => joinOpen(lobby.code)}
                className="shrink-0 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {text(KAA.lobbyOpenJoin)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LobbyFreeStrip({ gameType, text }) {
  const soloPrimary =
    gameType === 'crossword'
      ? { to: '/crossword', icon: 'grammar', label: KAA.faqTryCrossword }
      : { to: '/quiz', icon: 'trophy', label: KAA.faqTryQuiz };
  const secondary =
    gameType === 'crossword'
      ? [
          { to: '/tutor/practice?from=crossword', icon: 'bolt', label: KAA.practiceNav },
          { to: '/quiz', icon: 'trophy', label: KAA.faqTryQuiz },
        ]
      : [
          { to: '/tutor/practice?from=quiz', icon: 'bolt', label: KAA.practiceNav },
          { to: '/crossword', icon: 'grammar', label: KAA.faqTryCrossword },
        ];

  return (
    <div className="mt-5 rounded-2xl border border-teal-700/15 bg-gradient-to-br from-teal-50/70 via-white to-amber-50/35 px-4 py-3.5">
      <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-teal-800/55">
        {text(KAA.lobbySoloFree)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to={soloPrimary.to}
          className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white`}
        >
          <Icon name={soloPrimary.icon} /> {text(soloPrimary.label)}
        </Link>
        {secondary.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/20 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-950"
          >
            <Icon name={link.icon} /> {text(link.label)}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function GameLobby({
  gameType,
  modes = [],
  contentId,
  contentLabel,
  initialCode = '',
  initialRoom = null,
  initialMode = '',
  basePath = '',
  onBeforePlay,
  onQuotaBlocked,
  onRoomChange,
  onStarted,
  className = '',
}) {
  const { text } = useUiScript();
  const navigate = useNavigate();
  const [phase, setPhase] = useState(() => {
    if (initialRoom?.youMemberId) return 'lobby';
    if (initialCode || initialRoom?.code) return 'join';
    return 'create';
  });
  const [displayName, setDisplayName] = useState(() => {
    try {
      return localStorage.getItem('qp_display_name') || '';
    } catch {
      return '';
    }
  });
  const [mode, setMode] = useState(() => {
    if (initialMode && modes.some((m) => m.id === initialMode)) return initialMode;
    return modes[0]?.id || '';
  });
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [joinCode, setJoinCode] = useState(initialCode || initialRoom?.code || '');
  const [room, setRoom] = useState(initialRoom?.youMemberId ? initialRoom : null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!initialMode) return;
    if (modes.some((m) => m.id === initialMode)) setMode(initialMode);
  }, [initialMode, modes]);

  useEffect(() => {
    if (!initialRoom?.code) return;
    if (initialRoom.youMemberId) {
      setRoom(initialRoom);
      setPhase('lobby');
    } else {
      setJoinCode(initialRoom.code);
      setPhase('join');
    }
  }, [initialRoom]);

  useEffect(() => {
    const s = getGameSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    setConnected(s.connected);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
    };
  }, []);

  useEffect(() => {
    if (!room?.code || !room?.youMemberId) return undefined;
    return subscribeRoom(room.code, (next) => {
      if (!(next?.code || next?.status)) return;
      setRoom((prev) => {
        const merged = mergeRoomState(prev, next);
        queueMicrotask(() => {
          onRoomChange?.(merged);
          if (merged.status === 'starting' || merged.status === 'in_progress') {
            onStarted?.(merged);
          }
        });
        return merged;
      });
    });
  }, [room?.code, room?.youMemberId, onRoomChange, onStarted]);

  const myMember = useMemo(() => {
    if (!room?.members || !room.youMemberId) return null;
    return room.members.find((m) => m.memberId === room.youMemberId) || null;
  }, [room]);

  const isHost = myMember?.role === 'host';
  const canStart =
    isHost &&
    room?.status === 'lobby' &&
    room.members?.length >= room.minPlayers &&
    room.members.every((m) => m.ready);

  function goToRoomUrl(code) {
    if (basePath && code) {
      navigate(`${basePath}/${code}`, { replace: true });
    }
  }

  async function persistName(name) {
    const n = name.trim().slice(0, 24);
    try {
      localStorage.setItem('qp_display_name', n);
    } catch {
      /* ignore */
    }
    return n || 'Oyınshı';
  }

  function guardPlay() {
    if (typeof onBeforePlay === 'function' && !onBeforePlay()) {
      onQuotaBlocked?.();
      return false;
    }
    return true;
  }

  function handlePlayError(err) {
    if (err?.code === 'GUEST_QUIZ_LIMIT' || err?.code === 'GUEST_CROSSWORD_BLOCK' || err?.status === 403) {
      onQuotaBlocked?.(err.code === 'GUEST_CROSSWORD_BLOCK' ? 'crossword' : 'quiz');
      return;
    }
    setError(err.message);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!guardPlay()) return;
    setError('');
    setBusy(true);
    try {
      const name = await persistName(displayName);
      const data = await createRoom({
        gameType,
        mode,
        contentId,
        displayName: name,
        maxPlayers,
      });
      setRoom(data.room);
      onRoomChange?.(data.room);
      setPhase('lobby');
      goToRoomUrl(data.room?.code);
    } catch (err) {
      handlePlayError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!guardPlay()) return;
    setError('');
    setBusy(true);
    try {
      const name = await persistName(displayName);
      const data = await joinRoom({ code: joinCode.trim().toUpperCase(), displayName: name });
      setRoom(data.room);
      onRoomChange?.(data.room);
      setPhase('lobby');
      goToRoomUrl(data.room?.code);
    } catch (err) {
      handlePlayError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleReady() {
    if (!room?.youMemberId) return;
    setBusy(true);
    setError('');
    try {
      const data = await setRoomReady(room.code, !myMember?.ready);
      setRoom(data.room);
      onRoomChange?.(data.room);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    if (!room?.youMemberId) return;
    if (!guardPlay()) return;
    setBusy(true);
    setError('');
    try {
      const data = await startRoom(room.code);
      setRoom(data.room);
      onStarted?.(data.room);
    } catch (err) {
      handlePlayError(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!room) return;
    try {
      await leaveRoom(room.code);
    } catch {
      /* ignore */
    }
    setRoom(null);
    setPhase('create');
    onRoomChange?.(null);
    if (basePath) navigate(basePath, { replace: true });
  }

  if (phase === 'lobby' && room?.youMemberId) {
    return (
      <div className={`rounded-3xl border border-teal-800/15 bg-white/80 p-6 shadow-sm ${className}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-teal-800/60">{text('Bólme kodı')}</p>
            <p className="font-display text-4xl tracking-[0.2em] text-teal-900">{room.code}</p>
            <p className="mt-1 text-sm text-ink/60">
              {text(contentLabel || contentId)} · {room.mode} · {room.members.length}/{room.maxPlayers}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {connected ? text('Onlayn') : text('Qayta baylanısıw...')}
          </span>
        </div>

        <LobbyInviteBar code={room.code} basePath={basePath} text={text} />

        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {room.members.map((m) => (
            <li
              key={m.memberId}
              className="flex items-center justify-between rounded-2xl border border-ink/10 bg-parchment/60 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Icon name={m.role === 'host' ? 'sparkle' : 'users'} className="h-4 w-4 text-teal-700" />
                <span className="font-medium text-ink">{m.displayName}</span>
                {m.role === 'host' && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">
                    {text('Basqarıwshı')}
                  </span>
                )}
                {m.memberId === room.youMemberId && (
                  <span className="text-[10px] uppercase text-teal-700">{text('Siz')}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={m.connected ? 'text-emerald-700' : 'text-ink/40'}>
                  {m.connected ? '●' : '○'}
                </span>
                <span className={m.ready ? 'text-teal-800 font-semibold' : 'text-ink/40'}>
                  {m.ready ? text('Tayyar') : text('Kútıp tur')}
                </span>
              </div>
            </li>
          ))}
          {Array.from({ length: Math.max(0, room.maxPlayers - room.members.length) }).map((_, i) => (
            <li
              key={`empty-${i}`}
              className="rounded-2xl border border-dashed border-ink/15 px-4 py-3 text-sm text-ink/35"
            >
              {text('Bos orın')}
            </li>
          ))}
        </ul>

        {error && <p className="mt-4 text-sm text-rose-700">{text(error)}</p>}
        {error && <LobbyFreeStrip gameType={gameType} text={text} />}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={toggleReady}
            className="rounded-full bg-teal-800 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {myMember?.ready ? text('Tayyarlıqtı biykar etiw') : text('Tayyarman')}
          </button>
          {isHost && (
            <button
              type="button"
              disabled={busy || !canStart}
              onClick={handleStart}
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            >
              {text('Bastaw')}
            </button>
          )}
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm text-ink/70"
          >
            {text('Shıǵıw')}
          </button>
        </div>
        {!canStart && isHost && (
          <p className="mt-3 text-xs text-ink/50">
            {text(`Bastaw ushın keminde ${room.minPlayers} oyınshı hám hámmesi tayyar bolıwı kerek.`)}
          </p>
        )}
        {!canStart && isHost && <LobbyFreeStrip gameType={gameType} text={text} />}
      </div>
    );
  }

  return (
    <div className={`rounded-3xl border border-teal-800/15 bg-white/80 p-6 shadow-sm ${className}`}>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setPhase('create')}
          className={`rounded-full px-4 py-1.5 text-sm ${
            phase === 'create' ? 'bg-teal-800 text-white' : 'bg-teal-50 text-teal-900'
          }`}
        >
          {text('Bólme jaratıw')}
        </button>
        <button
          type="button"
          onClick={() => setPhase('join')}
          className={`rounded-full px-4 py-1.5 text-sm ${
            phase === 'join' ? 'bg-teal-800 text-white' : 'bg-teal-50 text-teal-900'
          }`}
        >
          {text('Kod penen qosılıw')}
        </button>
      </div>

      <label className="mb-3 block text-sm">
        <span className="text-ink/60">{text('Laqabıńız')}</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={24}
          placeholder={text('Mısalı: Aziza')}
          className="mt-1 w-full rounded-2xl border border-ink/10 bg-parchment/50 px-4 py-2.5 outline-none focus:border-teal-600/40"
        />
        <Link
          to="/profile"
          className="mt-1.5 inline-flex text-xs font-semibold text-teal-900 hover:underline"
        >
          {text(KAA.lobbyProfileSoft)}
        </Link>
      </label>

      {phase === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-3">
          {modes.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm text-ink/60">{text('Rejim')}</legend>
              <div className="flex flex-wrap gap-2">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-2xl border px-3 py-2 text-left text-sm ${
                      mode === m.id
                        ? 'border-teal-700 bg-teal-50 text-teal-900'
                        : 'border-ink/10 text-ink/70'
                    }`}
                  >
                    <span className="font-medium">{text(m.label)}</span>
                    {m.hint && <span className="mt-0.5 block text-xs text-ink/45">{text(m.hint)}</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <label className="block text-sm">
            <span className="text-ink/60">{text('Orınlar (2–4)')}</span>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="mt-1 w-full rounded-2xl border border-ink/10 bg-parchment/50 px-4 py-2.5"
            >
              {SEAT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {text(`${n} oyınshı`)}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-rose-700">{text(error)}</p>}
          <button
            type="submit"
            disabled={busy || !contentId || !mode}
            className="rounded-full bg-teal-800 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {text('Bólme jaratıw')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin} className="space-y-3">
          <label className="block text-sm">
            <span className="text-ink/60">{text('Bólme kodı')}</span>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              className="mt-1 w-full rounded-2xl border border-ink/10 bg-parchment/50 px-4 py-2.5 tracking-[0.3em] outline-none focus:border-teal-600/40"
            />
          </label>
          {error && <p className="text-sm text-rose-700">{text(error)}</p>}
          <button
            type="submit"
            disabled={busy || joinCode.trim().length < 4}
            className="rounded-full bg-teal-800 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {text('Qosılıw')}
          </button>
        </form>
      )}

      <OpenLobbiesPanel
        gameType={gameType}
        text={text}
        displayName={displayName}
        persistName={persistName}
        guardPlay={guardPlay}
        handlePlayError={handlePlayError}
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        goToRoomUrl={goToRoomUrl}
        onJoined={(next) => {
          setRoom(next);
          onRoomChange?.(next);
          setPhase('lobby');
        }}
      />

      <LobbyFreeStrip gameType={gameType} text={text} />
    </div>
  );
}
