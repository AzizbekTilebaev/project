import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import GameLobby from '../components/game/GameLobby';
import Icon from '../components/Icon';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import SoftNextRow from '../components/SoftNextRow';
import { fetchQuizzes } from '../api/quizzes';
import { answerRoomQuiz, fetchRoom, fetchRoomQuiz } from '../api/gameRooms';
import { mergeRoomState, subscribeRoom } from '../lib/gameSocket';
import ProtectedContent from '../components/ProtectedContent';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { useGuestQuota } from '../hooks/useGuestQuota';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';

const QUIZ_MODES = [
  { id: 'sync', label: 'Bir waqıtta', hint: 'Barlıq sorawlar birge — waqıt birge' },
  { id: 'race', label: 'Jarıs', hint: 'Hár kim óz temposında' },
];

const OPTION_STYLES = [
  { badge: 'bg-teal-700/10 text-teal-800 border-teal-700/40', hover: 'hover:border-teal-600/60 hover:bg-teal-50/70' },
  { badge: 'bg-amber-500/10 text-amber-700 border-amber-600/40', hover: 'hover:border-amber-500/60 hover:bg-amber-50/70' },
  { badge: 'bg-teal-500/10 text-teal-700 border-teal-500/40', hover: 'hover:border-teal-500/60 hover:bg-teal-50/70' },
  { badge: 'bg-rose-500/10 text-rose-700 border-rose-500/40', hover: 'hover:border-rose-500/60 hover:bg-rose-50/70' },
];

function remainingSeconds(deadlineIso) {
  if (!deadlineIso) return null;
  return Math.max(0, Math.ceil((new Date(deadlineIso).getTime() - Date.now()) / 1000));
}

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
            {m.memberId === youMemberId && (
              <span className="text-[10px] uppercase text-teal-700">{text('Siz')}</span>
            )}
          </span>
          <span className="font-semibold text-teal-900">{m.score ?? 0}</span>
        </li>
      ))}
    </ul>
  );
}

export default function QuizRoom() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { requireQuiz, openGate, GateModal } = useGuestQuota();
  usePageMeta(
    text('Test xonası'),
    text('Kóp oyınshılı test — sinxron yamasa jarıs rejimi.')
  );

  const [rematchSeed] = useState(() => location.state?.rematch || null);

  const [quizzes, setQuizzes] = useState([]);
  const { status: listStatus, data: listData, error: listLoadError, reload: reloadList } =
    usePageData(
      () =>
        loadPageBundle({
          quizzes: async () => {
            const res = await fetchQuizzes();
            return res.quizzes || [];
          },
        }),
      { deps: [] }
    );
  const [selectedQuizId, setSelectedQuizId] = useState(() =>
    rematchSeed?.contentId ? String(rematchSeed.contentId) : ''
  );
  const [rematchMode, setRematchMode] = useState(() =>
    rematchSeed?.mode ? String(rematchSeed.mode) : ''
  );
  const [room, setRoom] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [picked, setPicked] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const questionStartedRef = useRef(null);

  useEffect(() => {
    if (!location.state?.rematch) return;
    navigate(location.pathname, { replace: true, state: {} });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loaded = listData?.quizzes;
    if (!loaded?.length) return;
    setQuizzes(loaded);
    setSelectedQuizId((prev) => prev || String(loaded[0].id));
  }, [listData]);


  const loadGame = useCallback(async (code) => {
    try {
      const data = await fetchRoomQuiz(code);
      setRoom(data.room);
      setAttempt(data.attempt);
      const idx =
        data.room?.mode === 'sync'
          ? data.room?.sharedState?.currentIndex ?? 0
          : data.attempt?.currentIndex ?? 0;
      const q = data.attempt?.questions?.[idx];
      const existing = q ? data.attempt?.answers?.[q.id] : null;
      setPicked(existing != null ? existing : null);
      questionStartedRef.current = Date.now();
    } catch {
      try {
        const data = await fetchRoom(code);
        setRoom(data.room);
      } catch (err) {
        setError(err.message || 'Oyın maǵlıwmatın júklew múmkin bolmadı.');
      }
    }
  }, []);

  useEffect(() => {
    if (!room?.code || !room.youMemberId || room.status !== 'in_progress') return undefined;
    return subscribeRoom(room.code, (next) => {
      if (!next?.code) return;
      setRoom((prev) => {
        const merged = mergeRoomState(prev, next);
        if (merged.status === 'finished' || merged.status === 'in_progress') {
          queueMicrotask(() => loadGame(merged.code));
        }
        return merged;
      });
    });
  }, [room?.code, room?.youMemberId, room?.status, loadGame]);

  useEffect(() => {
    if (room?.status !== 'in_progress') return undefined;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [room?.status]);

  const handleStarted = useCallback(
    (nextRoom) => {
      setRoom(nextRoom);
      if (nextRoom?.code) {
        navigate(`/quiz/room/${nextRoom.code}`, { replace: true });
        loadGame(nextRoom.code);
      }
    },
    [navigate, loadGame]
  );

  useEffect(() => {
    if (routeCode) {
      loadGame(routeCode.toUpperCase());
    }
  }, [routeCode, loadGame]);

  const selectedQuiz = quizzes.find((q) => String(q.id) === String(selectedQuizId));
  const questionIndex =
    room?.mode === 'sync'
      ? room?.sharedState?.currentIndex ?? 0
      : attempt?.currentIndex ?? 0;
  const question = attempt?.questions?.[questionIndex] || null;
  const syncDeadline = room?.sharedState?.questionDeadlineAt;
  const questionLeft = useMemo(
    () => (room?.mode === 'sync' ? remainingSeconds(syncDeadline) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [syncDeadline, tick, room?.mode]
  );

  const pick = async (optionIndex) => {
    if (picked !== null || !question || !room || submitting) return;
    if (room.mode === 'sync' && questionLeft === 0) {
      setError('Soraw waqtı túsdi.');
      return;
    }
    setSubmitting(true);
    setError('');
    const spent = Date.now() - (questionStartedRef.current || Date.now());
    try {
      const data = await answerRoomQuiz(room.code, {
        questionId: question.id,
        optionIndex,
        timeSpentMs: spent,
      });
      setRoom(data.room);
      setAttempt(data.attempt);
      setPicked(optionIndex);
      questionStartedRef.current = Date.now();
      const nextIdx =
        data.room?.mode === 'sync'
          ? data.room?.sharedState?.currentIndex ?? 0
          : data.attempt?.currentIndex ?? 0;
      const nextQ = data.attempt?.questions?.[nextIdx];
      const existing = nextQ ? data.attempt?.answers?.[nextQ.id] : null;
      if (nextIdx !== questionIndex) {
        setPicked(existing != null ? existing : null);
      }
    } catch (err) {
      setError(err.message || 'Juwap saqlanmadı.');
    } finally {
      setSubmitting(false);
    }
  };

  const rematch = () => {
    const contentId = room?.contentId || selectedQuizId;
    const mode = room?.mode || '';
    setRoom(null);
    setAttempt(null);
    setPicked(null);
    setError('');
    if (contentId) setSelectedQuizId(String(contentId));
    if (mode) setRematchMode(String(mode));
    navigate('/quiz/room', {
      replace: true,
      state: {
        rematch: {
          contentId: contentId || '',
          mode: mode || '',
        },
      },
    });
  };

  const finished = room?.status === 'finished';
  const standings = room?.sharedState?.standings || room?.members;
  const finishMeta = useMemo(() => {
    if (!finished || !room) return null;
    const sorted = [...(standings || [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const place = Math.max(1, sorted.findIndex((m) => m.memberId === room.youMemberId) + 1);
    const you = sorted.find((m) => m.memberId === room.youMemberId);
    const title =
      attempt?.title ||
      quizzes.find((q) => String(q.id) === String(room.contentId))?.title ||
      text(KAA.testler);
    return {
      title,
      place,
      score: you?.score ?? 0,
      players: sorted.length || room.members?.length || 1,
      code: room.code,
      shareUrl:
        typeof window !== 'undefined'
          ? `${window.location.origin}/quiz/room/${encodeURIComponent(room.code)}`
          : `/quiz/room/${room.code}`,
    };
  }, [finished, room, standings, attempt?.title, quizzes, text]);

  const modesForLobby = useMemo(
    () =>
      QUIZ_MODES.map((m) => ({
        ...m,
        label: text(m.label),
        hint: text(m.hint),
      })),
    [text]
  );

  if (finished && room && finishMeta) {
    return (
      <DictShell className="pt-24 pb-24">
        {GateModal}
        <section className="relative mx-auto max-w-2xl px-6 pt-8 md:px-10">
          <Link
            to="/quiz"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4"
          >
            <Icon name="left" /> {text(KAA.testler)}
          </Link>
          <div className="qp-surface px-7 py-10 text-center shadow-lg">
            <Icon name="trophy" className="mx-auto mb-4 text-4xl text-amber-600" />
            <h1 className="font-display text-3xl text-ink mb-2">{text(KAA.quizRoomDone)}</h1>
            <p className="text-ink/60 mb-2">
              {text('Bólme')}: {room.code}
            </p>
            <p className="mb-6 text-sm text-ink/50">{text(KAA.practiceFromQuizPerfect)}</p>
            <Standings members={standings} youMemberId={room.youMemberId} />
            <p className="mt-8 mb-3 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-teal-800/55">
              {text(KAA.quizRoomNext)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/tutor/practice?from=quiz"
                className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-6 py-3.5 text-sm font-bold text-white`}
              >
                <Icon name="bolt" /> {text(KAA.quizRoomToMashq)}
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
                title={text(KAA.shareRoomQuizTitle)}
                text={text(KAA.shareRoomQuizText)
                  .replace('{title}', text(finishMeta.title))
                  .replace('{place}', String(finishMeta.place))
                  .replace('{score}', String(finishMeta.score))
                  .replace('{code}', String(finishMeta.code))}
                url={finishMeta.shareUrl}
                className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-3.5 text-sm font-bold text-teal-950"
              />
              <Link
                to="/quiz"
                className="qp-btn-ghost"
              >
                {text(KAA.quizRoomOtherTests)}
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

  if (room?.status === 'lobby' || (routeCode && room && !room.youMemberId && room.status === 'lobby')) {
    return (
      <DictShell className="pt-24 pb-24">
        {GateModal}
        <section className="relative mx-auto max-w-2xl px-6 pt-8 md:px-10">
          <Link
            to="/quiz"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4"
          >
            <Icon name="left" /> {text('Testler')}
          </Link>
          <GameLobby
            gameType="quiz"
            modes={modesForLobby}
            contentId={room.contentId || selectedQuizId}
            contentLabel={selectedQuiz?.title ? text(selectedQuiz.title) : selectedQuiz?.title}
            initialCode={routeCode || ''}
            initialRoom={room}
            basePath="/quiz/room"
            onBeforePlay={requireQuiz}
            onQuotaBlocked={() => openGate('quiz')}
            onRoomChange={setRoom}
            onStarted={handleStarted}
          />
        </section>
      </DictShell>
    );
  }

  if (room?.status === 'in_progress' && attempt && question) {
    return (
      <DictShell className="pt-24 pb-24">
        <ProtectedContent>
        <section className="relative mx-auto max-w-3xl px-6 pt-8 md:px-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-teal-800/60">
                {text('Bólme')} {room.code}
              </p>
              <p className="font-display text-xl text-ink">{text(attempt.title)}</p>
            </div>
            {room.mode === 'sync' && questionLeft != null && (
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  questionLeft <= 10 ? 'bg-red-600 text-white' : 'bg-white/70 border border-ink/10'
                }`}
              >
                <Icon name="clock" className="mr-1" /> {questionLeft}s
              </span>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            <div>
              <p className="mb-4 text-sm text-ink/50">
                {text('Soraw')} {questionIndex + 1} / {attempt.questions.length}
                {room.mode === 'sync' && ` · ${text('Bir waqıtta rejim')}`}
              </p>
              <h2 className="font-display text-3xl text-ink mb-8">{text(question.question)}</h2>
              <div className="grid gap-3">
                {question.options.map((option, idx) => {
                  const isPicked = idx === picked;
                  const style = OPTION_STYLES[idx % OPTION_STYLES.length];
                  return (
                    <button
                      key={`${question.id}-${idx}`}
                      type="button"
                      disabled={picked !== null || submitting}
                      onClick={() => pick(idx)}
                      className={
                        isPicked
                          ? 'rounded-2xl border-2 border-teal-600 bg-gradient-to-r from-teal-800 to-emerald-800 px-5 py-4 text-left text-parchment shadow-lg'
                          : `rounded-2xl border-2 border-ink/[0.08] bg-white/60 px-5 py-4 text-left ${style.hover} disabled:opacity-50`
                      }
                    >
                      <span className="inline-flex items-start gap-3">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-bold ${
                            isPicked ? 'border-parchment/40 bg-white/15' : style.badge
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        {text(option)}
                      </span>
                    </button>
                  );
                })}
              </div>
              {error && <p className="mt-4 text-sm text-rose-700">{text(error)}</p>}
            </div>
            <aside className="qp-panel p-5">
              <p className="mb-4 text-xs uppercase tracking-widest text-ink/50">{text('Reyting')}</p>
              <Standings members={room.members} youMemberId={room.youMemberId} />
            </aside>
          </div>
        </section>
        </ProtectedContent>
      </DictShell>
    );
  }

  return (
    <PageGate
      status={listStatus}
      error={listLoadError}
      onRetry={reloadList}
      backHref="/quiz"
      backLabel="Testler"
    >
    <DictShell className="pt-24 pb-24">
      <section className="relative mx-auto max-w-2xl px-6 pt-8 md:px-10">
        <Link
          to="/quiz"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline underline-offset-4"
        >
          <Icon name="left" /> {text('Testler')}
        </Link>
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70 mb-2">
          {text('Kóp oyınshılı')}
        </p>
        <h1 className="font-display text-4xl text-ink tracking-tight mb-3">{text('Test xonası')}</h1>
        <p className="text-ink/60 text-lg mb-8">
          {text('Doslar menen birge test isleń — sinxron yamasa jarıs rejiminde.')}
        </p>

        {rematchMode || rematchSeed ? (
          <p className="mb-4 rounded-2xl border border-teal-700/15 bg-teal-50/70 px-4 py-3 text-sm font-semibold text-teal-950">
            {text(KAA.roomRematchHint)}
          </p>
        ) : null}

        <label className="mb-6 block">
          <span className="text-sm text-ink/60">{text('Test saylań')}</span>
          <select
            value={selectedQuizId}
            onChange={(e) => setSelectedQuizId(e.target.value)}
            className="mt-1 w-full qp-card qp-card--static px-4 py-3"
          >
            {quizzes.map((q) => (
              <option key={q.id} value={q.id}>
                {text(q.title)} ({q.questionCount} {text('soraw')})
              </option>
            ))}
          </select>
        </label>

        <GameLobby
          gameType="quiz"
          modes={modesForLobby}
          contentId={selectedQuizId}
          contentLabel={selectedQuiz?.title ? text(selectedQuiz.title) : selectedQuiz?.title}
          initialCode={routeCode || ''}
          initialMode={rematchMode}
          basePath="/quiz/room"
          onBeforePlay={requireQuiz}
          onQuotaBlocked={() => openGate('quiz')}
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
