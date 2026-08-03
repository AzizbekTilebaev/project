import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import GameLobby from '../components/game/GameLobby';
import Crossword from '../components/Crossword';
import ProtectedContent from '../components/ProtectedContent';
import Icon from '../components/Icon';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import SoftNextRow from '../components/SoftNextRow';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchCrosswords, fetchCrosswordById } from '../api/crosswords';
import { guessRoomCrossword, fetchRoom } from '../api/gameRooms';
import { mergeRoomState, subscribeRoom } from '../lib/gameSocket';
import { useGuestQuota } from '../hooks/useGuestQuota';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';
import {
  getCrosswordCompleteStreak,
  queueCrosswordAnswer,
  queueCrosswordMiss,
  recordCrosswordComplete,
} from '../lib/crosswordProgress';

const CROSSWORD_MODES = [
  { id: 'coop', label: 'Birgelik', hint: 'Barlıq oyınshılar bir maydanda' },
  { id: 'competitive', label: 'Jarıs', hint: 'Hár kim óz maydanında' },
];

function Standings({ members, youMemberId }) {
  const { text } = useUiScript();
  const sorted = [...(members || [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return (
    <ul className="space-y-2">
      {sorted.map((m, i) => (
        <li
          key={m.memberId}
          className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm ${
            m.memberId === youMemberId ? 'border-teal-600/30 bg-teal-50/60' : 'border-ink/10 bg-white/60'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="font-bold text-ink/40 w-5">{i + 1}</span>
            <span className="font-medium text-ink">{text(m.displayName)}</span>
          </span>
          <span className="font-semibold text-teal-900">{m.score ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CrosswordRoom() {
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { requireCrossword, openGate, GateModal } = useGuestQuota();
  usePageMeta(
    text('Krossvord xonası'),
    text('Kóp oyınshılı krossvord — birgelik yamasa jarys.')
  );

  const [rematchSeed] = useState(() => location.state?.rematch || null);

  const [crosswords, setCrosswords] = useState([]);
  const { status: listStatus, data: listData, error: listLoadError, reload: reloadList } =
    usePageData(
      () =>
        loadPageBundle({
          crosswords: async () => {
            const res = await fetchCrosswords();
            return res.crosswords || [];
          },
        }),
      { deps: [] }
    );
  const [selectedId, setSelectedId] = useState(() =>
    rematchSeed?.contentId ? String(rematchSeed.contentId) : ''
  );
  const [rematchMode, setRematchMode] = useState(() =>
    rematchSeed?.mode ? String(rematchSeed.mode) : ''
  );
  const [room, setRoom] = useState(null);
  const [puzzle, setPuzzle] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!location.state?.rematch) return;
    navigate(location.pathname, { replace: true, state: {} });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const modes = useMemo(
    () =>
      CROSSWORD_MODES.map((m) => ({
        ...m,
        label: text(m.label),
        hint: text(m.hint),
      })),
    [text]
  );

  useEffect(() => {
    const loaded = listData?.crosswords;
    if (!loaded?.length) return;
    setCrosswords(loaded);
    setSelectedId((prev) => prev || String(loaded[0].id));
  }, [listData]);

  useEffect(() => {
    if (!room?.contentId) return;
    const found = crosswords.find((c) => String(c.id) === String(room.contentId));
    if (found) {
      setPuzzle(found);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCrosswordById(room.contentId);
        if (!cancelled) setPuzzle(data.crossword);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [room?.contentId, crosswords]);

  useEffect(() => {
    if (!routeCode) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchRoom(routeCode.toUpperCase());
        if (!cancelled) setRoom(data.room);
      } catch {
        /* lobby via GameLobby */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeCode]);

  useEffect(() => {
    if (!room?.code || !room.youMemberId) return undefined;
    return subscribeRoom(room.code, (next) => {
      if (!next?.code && !next?.status) return;
      setRoom((prev) => mergeRoomState(prev, next));
    });
  }, [room?.code, room?.youMemberId]);

  const handleStarted = useCallback(
    (nextRoom) => {
      setRoom(nextRoom);
      if (nextRoom?.code) {
        navigate(`/crossword/room/${nextRoom.code}`, { replace: true });
      }
    },
    [navigate]
  );

  const cellData = useMemo(() => {
    if (!room || room.status !== 'in_progress') return {};
    if (room.mode === 'coop') return room.sharedState?.board || {};
    const me = room.members?.find((m) => m.memberId === room.youMemberId);
    return me?.progress?.board || {};
  }, [room]);

  const handleGuess = useCallback(
    async ({ wordIndex, answer }) => {
      if (!room?.code) throw new Error('Bólme joq');
      try {
        const data = await guessRoomCrossword(room.code, { wordIndex, answer });
        if (data.correct) {
          queueCrosswordAnswer(data.fillAnswer || answer).catch(() => null);
        } else if (data.dictTitleId) {
          queueCrosswordMiss(data.dictTitleId);
        }
        setRoom((prev) => {
          const next = mergeRoomState(prev, data.room);
          if (next?.status === 'finished' && prev?.status !== 'finished') {
            recordCrosswordComplete();
          }
          return next;
        });
        return {
          correct: data.correct,
          nearMiss: Boolean(data.nearMiss),
          fillAnswer: data.fillAnswer || null,
        };
      } catch (err) {
        if (err.code === 'GUEST_CROSSWORD_BLOCK' || err.status === 403) {
          openGate('crossword');
        }
        throw err;
      }
    },
    [room?.code, openGate]
  );

  const rematch = () => {
    const contentId = room?.contentId || selectedId;
    const mode = room?.mode || '';
    setRoom(null);
    setPuzzle(null);
    setError('');
    if (contentId) setSelectedId(String(contentId));
    if (mode) setRematchMode(String(mode));
    navigate('/crossword/room', {
      replace: true,
      state: {
        rematch: {
          contentId: contentId || '',
          mode: mode || '',
        },
      },
    });
  };

  const selected = crosswords.find((c) => String(c.id) === String(selectedId));
  const finished = room?.status === 'finished';
  const inProgress = room?.status === 'in_progress';
  const standings = room?.sharedState?.standings || room?.members;
  const finishMeta = useMemo(() => {
    if (!finished || !room) return null;
    const sorted = [...(standings || [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const place = Math.max(1, sorted.findIndex((m) => m.memberId === room.youMemberId) + 1);
    const you = sorted.find((m) => m.memberId === room.youMemberId);
    const title =
      puzzle?.title ||
      crosswords.find((c) => String(c.id) === String(room.contentId))?.title ||
      text(KAA.krossvordlar);
    return {
      title,
      place,
      score: you?.score ?? 0,
      code: room.code,
      shareUrl:
        typeof window !== 'undefined'
          ? `${window.location.origin}/crossword/room/${encodeURIComponent(room.code)}`
          : `/crossword/room/${room.code}`,
    };
  }, [finished, room, standings, puzzle?.title, crosswords, text]);

  if (finished && room && finishMeta) {
    const streak = getCrosswordCompleteStreak();
    return (
      <DictShell className="pt-24 pb-24">
        {GateModal}
        <section className="relative mx-auto max-w-2xl px-6 pt-8 md:px-10">
          <Link
            to="/crossword"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4"
          >
            <Icon name="left" /> {text('Krossvordlar')}
          </Link>
          <div className="qp-surface px-7 py-10 text-center shadow-lg">
            <Icon name="trophy" className="mx-auto mb-4 text-4xl text-amber-600" />
            <h1 className="font-display text-3xl text-ink mb-2">{text(KAA.crosswordComplete)}</h1>
            <p className="text-ink/60 mb-2">
              {text('Bólme')}: {room.code}
            </p>
            {streak > 0 && (
              <p className={`mb-3 text-sm font-bold text-orange-950 ${anim.streakFlame}`}>
                <span className={anim.streakDot} aria-hidden />
                {text(KAA.crosswordStreak)} {streak}
              </p>
            )}
            <Standings members={standings} youMemberId={room.youMemberId} />
            <p className="mt-8 mb-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/55">
              {text(KAA.quizRoomNext)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/tutor/practice?from=crossword"
                className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-6 py-3.5 text-sm font-bold text-white`}
              >
                <Icon name="bolt" />{' '}
                {streak > 0
                  ? text(KAA.crosswordStreakCta).replace('{n}', String(streak))
                  : text(KAA.crosswordToMashq)}
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              <button
                type="button"
                onClick={rematch}
                className="inline-flex items-center gap-2 rounded-full border border-teal-700/30 bg-white px-6 py-3.5 text-sm font-bold text-teal-900"
              >
                {text(KAA.roomRematchCta)}
              </button>
              <ShareResultButton
                title={text(KAA.shareRoomCrosswordTitle)}
                text={text(KAA.shareRoomCrosswordText)
                  .replace('{title}', text(finishMeta.title))
                  .replace('{place}', String(finishMeta.place))
                  .replace('{score}', String(finishMeta.score))
                  .replace('{code}', String(finishMeta.code))}
                url={finishMeta.shareUrl}
                className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-3.5 text-sm font-bold text-teal-950"
              />
              <Link
                to="/crossword"
                className="qp-btn-ghost"
              >
                {text(KAA.crosswordNext)}
                <AnimChevron count={2} className="opacity-60" />
              </Link>
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
        </section>
      </DictShell>
    );
  }

  if (room?.status === 'lobby') {
    return (
      <DictShell className="pt-24 pb-24">
        {GateModal}
        <section className="relative mx-auto max-w-2xl px-6 pt-8 md:px-10">
          <Link
            to="/crossword"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4"
          >
            <Icon name="left" /> {text('Krossvordlar')}
          </Link>
          <GameLobby
            gameType="crossword"
            modes={modes}
            contentId={room.contentId || selectedId}
            contentLabel={selected?.title ? text(selected.title) : undefined}
            initialCode={routeCode || ''}
            initialRoom={room}
            initialMode={rematchMode}
            basePath="/crossword/room"
            onBeforePlay={requireCrossword}
            onQuotaBlocked={() => openGate('crossword')}
            onRoomChange={setRoom}
            onStarted={handleStarted}
          />
        </section>
      </DictShell>
    );
  }

  if (inProgress && puzzle) {
    return (
      <DictShell className="pt-24 pb-24">
        <section className="relative mx-auto max-w-5xl px-6 pt-8 md:px-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-teal-800/60">
                {text('Bólme')} {room.code} ·{' '}
                {text(room.mode === 'coop' ? 'Birgelik' : 'Jarıs')}
              </p>
              <h1 className="font-display text-2xl text-ink">{text(puzzle.title)}</h1>
            </div>
            <span className="rounded-full bg-teal-100 px-4 py-1.5 text-sm font-semibold text-teal-900">
              {room.sharedState?.solved ?? 0} / {room.sharedState?.totalWords ?? '—'} {text('sóz')}
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
            <ProtectedContent className="qp-surface p-6">
              <Crossword
                config={puzzle.config}
                cellData={cellData}
                onGuess={handleGuess}
                hideReset
              />
            </ProtectedContent>
            <aside className="qp-panel p-5 h-fit">
              <p className="mb-4 text-xs uppercase tracking-widest text-ink/50">{text('Reyting')}</p>
              <Standings members={room.members} youMemberId={room.youMemberId} />
            </aside>
          </div>
          {error && <p className="mt-4 text-sm text-rose-700">{text(error)}</p>}
        </section>
      </DictShell>
    );
  }

  return (
    <PageGate
      status={listStatus}
      error={listLoadError}
      onRetry={reloadList}
      backHref="/crossword"
      backLabel="Krossvordlar"
    >
    <DictShell className="pt-24 pb-24">
      <section className="relative mx-auto max-w-2xl px-6 pt-8 md:px-10">
        <Link
          to="/crossword"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4"
        >
          <Icon name="left" /> {text('Krossvordlar')}
        </Link>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70 mb-2">
          {text('Kóp oyınshılı')}
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight mb-3">{text('Krossvord xonası')}</h1>
        <p className="text-ink/60 text-lg mb-8">
          {text('Doslar menen birge krossvord shesiń — birgelik yamasa jarys rejiminde.')}
        </p>

        {rematchMode || rematchSeed ? (
          <p className="mb-4 rounded-2xl border border-teal-700/15 bg-teal-50/70 px-4 py-3 text-sm font-semibold text-teal-950">
            {text(KAA.roomRematchHint)}
          </p>
        ) : null}

        <label className="mb-6 block">
          <span className="text-sm text-ink/60">{text('Krossvord saylań')}</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mt-1 w-full qp-card qp-card--static px-4 py-3"
          >
            {crosswords.map((c) => (
              <option key={c.id} value={c.id}>
                {text(c.title)}
              </option>
            ))}
          </select>
        </label>

        <GameLobby
          gameType="crossword"
          modes={modes}
          contentId={selectedId}
          contentLabel={selected?.title ? text(selected.title) : undefined}
          initialCode={routeCode || ''}
          initialMode={rematchMode}
          basePath="/crossword/room"
          onBeforePlay={requireCrossword}
          onQuotaBlocked={() => openGate('crossword')}
          onRoomChange={setRoom}
          onStarted={handleStarted}
        />
        {error && <p className="mt-4 text-sm text-rose-700">{text(error)}</p>}
        {GateModal}
      </section>
    </DictShell>
    </PageGate>
  );
}
