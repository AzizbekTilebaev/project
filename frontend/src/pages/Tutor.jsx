import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import PageGate from '../components/PageGate';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import {
  answerDailyTutor,
  fetchDailyTutor,
  fetchMistakes,
  updateDailyTutorPlan,
  updateDailyTutorSchedule,
} from '../api/tutor';
import ProtectedContent from '../components/ProtectedContent';
import ShareResultButton from '../components/ShareResultButton';
import GuestSoftContinue from '../components/GuestSoftContinue';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { useAuth } from '../contexts/AuthContext';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, AnimChevron, anim, PageEnter, MotionDiv, motionVariants } from '../animations';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import SoftNextRow from '../components/SoftNextRow';
import { clearTutorContinue, touchTutorContinue } from '../lib/tutorProgress';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import { favoritesPracticeHref } from '../lib/readingPractice';
import { readFavoritesPractice } from '../lib/favoritesProgress';
import useResumeTick from '../hooks/useResumeTick';

const DAY_LABELS = ['Je', 'Dú', 'Si', 'Sá', 'Pi', 'Ju', 'Sh'];
const DEFAULT_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function Tutor() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  usePageMeta(
    text(KAA.uyretiwshi),
    text(KAA.tutorTush)
  );
  const reduceMotion = usePrefersReducedMotion();
  const [busy, setBusy] = useState(false);
  const [abandonedFlash, setAbandonedFlash] = useState(false);
  const skipTouchRef = useRef(false);
  const [msg, setMsg] = useState('');
  const [pickFeedback, setPickFeedback] = useState(null);
  const [localSession, setLocalSession] = useState(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [draggedId, setDraggedId] = useState(null);
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [scheduledDays, setScheduledDays] = useState(DEFAULT_DAYS);
  const [produceText, setProduceText] = useState('');
  const { items: favItems, count: favCount } = useDictionaryFavorites();
  const resumeTick = useResumeTick();

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle(
        { daily: () => fetchDailyTutor() },
        { mistakes: () => fetchMistakes().catch(() => ({ top: [], due: [] })) }
      ),
    { deps: [] }
  );

  const session = localSession || data?.daily;
  const top = data?.mistakes?.top || [];
  const due = data?.mistakes?.due || [];
  const hasBankMistakes = top.length > 0 || due.length > 0;
  const favoritesHref = useMemo(
    () =>
      favoritesPracticeHref(favItems, { practice: readFavoritesPractice() }) ||
      '/dictionary/favorites',
    [favItems, favCount, resumeTick]
  );
  const planItems = session?.items || [];

  useEffect(() => {
    if (session?.scheduledTime) setScheduledTime(session.scheduledTime);
    if (Array.isArray(session?.scheduledDays) && session.scheduledDays.length) {
      setScheduledDays(session.scheduledDays);
    }
  }, [session?.scheduledTime, session?.scheduledDays]);

  useEffect(() => {
    if (!session?.id) return;
    if (session.status === 'completed') {
      clearTutorContinue();
      skipTouchRef.current = false;
      return;
    }
    if (skipTouchRef.current) return;
    if (session.available && session.status !== 'completed') {
      const answered = Array.isArray(session.items)
        ? session.items.filter((i) => i.answered).length
        : Number(session.score) || 0;
      const total = Number(session.total) || (session.items?.length ?? 0) || null;
      touchTutorContinue({
        href: '/tutor',
        score: answered,
        total,
        scheduledTime: session.scheduledTime || null,
      });
    }
  }, [session]);

  function abandonSoft() {
    skipTouchRef.current = true;
    clearTutorContinue();
    setAbandonedFlash(true);
  }

  function laterSoft() {
    skipTouchRef.current = true;
    navigate('/tutor/practice?from=tutor');
  }

  const nextItem = useMemo(() => {
    if (!session?.items) return null;
    return session.items.find((it) => !it.answered) || null;
  }, [session]);

  useEffect(() => {
    setProduceText('');
  }, [nextItem?.mistakeId]);

  function moveItem(targetId) {
    if (!draggedId || draggedId === targetId || !session?.items) return;
    const items = [...session.items];
    const from = items.findIndex((item) => item.mistakeId === draggedId);
    const to = items.findIndex((item) => item.mistakeId === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    setLocalSession({ ...session, items });
  }

  function toggleDay(day) {
    if (!editingPlan) return;
    setScheduledDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  }

  async function savePlan() {
    if (busy) return;
    setBusy(true);
    setMsg('');
    try {
      if (session?.id && session.available !== false) {
        const refreshed = await updateDailyTutorPlan({
          sessionId: session.id,
          orderedMistakeIds: planItems.map((item) => item.mistakeId),
          scheduledTime,
          scheduledDays,
        });
        setLocalSession(refreshed);
        setScheduledTime(refreshed.scheduledTime || scheduledTime);
        setScheduledDays(refreshed.scheduledDays || scheduledDays);
      } else {
        const prefs = await updateDailyTutorSchedule({ scheduledTime, scheduledDays });
        setScheduledTime(prefs.scheduledTime || scheduledTime);
        setScheduledDays(prefs.scheduledDays || scheduledDays);
        setLocalSession((prev) =>
          prev
            ? {
                ...prev,
                scheduledTime: prefs.scheduledTime,
                scheduledDays: prefs.scheduledDays,
              }
            : prev
        );
        await reload();
      }
      setEditingPlan(false);
      setMsg('Dars tártibi, kúnler hám waqtı saqlandı.');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onPick(optionIndex) {
    if (!session?.id || !nextItem || busy) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await answerDailyTutor({
        sessionId: session.id,
        mistakeId: nextItem.mistakeId,
        optionIndex,
      });
      skipTouchRef.current = false;
      setAbandonedFlash(false);
      setPickFeedback({ index: optionIndex, correct: Boolean(res.correct) });
      setMsg(res.correct ? text(KAA.tutorCorrectMsg) : text(KAA.tutorWrongMsg));
      if (!reduceMotion) {
        await new Promise((r) => window.setTimeout(r, 650));
      }
      const refreshed = await fetchDailyTutor();
      setLocalSession(refreshed);
      setPickFeedback(null);
    } catch (err) {
      setMsg(err.message);
      setPickFeedback(null);
    } finally {
      setBusy(false);
    }
  }

  async function onProduceSubmit(event) {
    event?.preventDefault?.();
    if (!session?.id || !nextItem || busy) return;
    const answer = String(produceText || '').trim();
    if (!answer) {
      setMsg(text(KAA.tutorProduceHint));
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const res = await answerDailyTutor({
        sessionId: session.id,
        mistakeId: nextItem.mistakeId,
        answer,
      });
      skipTouchRef.current = false;
      setAbandonedFlash(false);
      setProduceText('');
      const refreshed = await fetchDailyTutor();
      setLocalSession(refreshed);
      setMsg(
        res.correct
          ? res.nearMiss
            ? text(KAA.tutorNearMissMsg)
            : text(KAA.tutorCorrectMsg)
          : text(KAA.tutorWrongMsg)
      );
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  const hubCards = [
    {
      to: hasBankMistakes ? '/tutor/practice' : '/dictionary/game',
      icon: 'bolt',
      title: hasBankMistakes ? KAA.practiceTitle : KAA.tutorEmptyGame,
      desc: hasBankMistakes ? KAA.practiceBody : KAA.practiceEmptyQueue,
      tone: 'from-teal-600 to-cyan-800',
    },
    {
      to: '/quiz',
      icon: 'trophy',
      title: 'Testler',
      desc: 'Jalǵız hám xona testleri',
      tone: 'from-teal-600 to-emerald-800',
    },
    {
      to: '/quiz/adaptive',
      icon: 'sparkle',
      title: 'Adaptiv',
      desc: 'Dáreje boyınsha sorawlar',
      tone: 'from-sky-600 to-teal-800',
    },
    {
      to: '/crossword',
      icon: 'grammar',
      title: 'Krossvord',
      desc: 'Sóz torı oyını',
      tone: 'from-amber-500 to-orange-700',
    },
    {
      to: '/dictionary/game',
      icon: 'gamepad',
      title: 'Sóz oyını',
      desc: 'Anıqlama tanlań',
      tone: 'from-teal-500 to-emerald-700',
    },
    {
      to: favoritesHref,
      icon: 'heart',
      title: 'Unatqanlar mashqı',
      desc:
        favCount === 0
          ? KAA.yoqtirilganlar
          : favCount < 3
            ? KAA.favNeedN.replace('{n}', String(3 - favCount))
            : 'Saqlanǵan sózler',
      tone: 'from-rose-500 to-pink-700',
    },
    {
      to: '/dictionary/immersion',
      icon: 'sparkle',
      title: 'Dawıslı sózler',
      desc: 'Tayyar immersiya audio',
      tone: 'from-cyan-600 to-teal-800',
    },
    {
      to: '/books',
      icon: 'book',
      title: 'Oqıw darsi',
      desc: 'Kitap + immersiya',
      tone: 'from-stone-600 to-teal-900',
    },
  ];

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref="/" backLabel="Bas bet">
      <DictShell className="pt-24 pb-28 md:pb-24">
        <section className="relative mx-auto max-w-2xl px-5 pt-6 sm:px-6 md:px-10 md:pt-8">
          <PageEnter>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-teal-800/70">
            {text(KAA.uyretiwshi)}
          </p>
          <h1 className="mb-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            {text(KAA.practiceTitle)}
          </h1>
          <AnimIconDivider amber className="mb-3" />
          <p className="mb-8 text-ink/55">
            {text(KAA.practiceBody)}
          </p>

          <div className="mb-12 grid grid-cols-2 gap-3 sm:grid-cols-3 motion-chip-stagger">
            {hubCards.map((c) => (
              <Link
                key={`${c.icon}-${c.title}`}
                to={c.to}
                className="group qp-card px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${c.tone} text-white shadow`}
                >
                  <Icon name={c.icon} />
                </span>
                <span className="block font-display text-lg text-ink">{text(c.title)}</span>
                <span className="mt-0.5 block text-xs text-ink/50">{text(c.desc)}</span>
                <AnimChevron className="mt-2 opacity-50 group-hover:opacity-90" count={2} />
              </Link>
            ))}
          </div>

          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70 mb-2">
            {text('Qáteler bankı')}
          </p>
          <h2 className="font-display text-3xl text-ink tracking-tight mb-2">
            {text('Kúndelikli úyretiwshi')}
          </h2>
          <div className={`${anim.breatheLine} mb-4`} />
          <p className="text-ink/60 mb-8">{text(KAA.tutorIntro)}</p>

          {session?.available && session.status !== 'completed' && planItems.length > 0 && (
            <div className="tutor-routine-panel mb-8 rounded-[2rem] border border-teal-600/15 bg-gradient-to-br from-teal-100/80 via-white/80 to-cyan-50/70 p-5 shadow-[0_28px_70px_-35px_rgba(13,148,136,0.45)] md:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.22em] text-teal-700/60">
                    {text('Kúndelikli reja')}
                  </p>
                  <h2 className="font-display text-2xl text-ink">{text('Mini-dars tártibi')}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <label className="rounded-full bg-teal-600 px-3 py-2 text-xs font-semibold text-white">
                    <Icon name="clock" className="mr-1" />
                    <input
                      type="time"
                      value={scheduledTime || session.scheduledTime || '08:00'}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      disabled={!editingPlan}
                      className="bg-transparent text-white outline-none disabled:opacity-90"
                      aria-label={text('Dars waqtı')}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingPlan) savePlan();
                      else {
                        setScheduledTime(session.scheduledTime || '08:00');
                        setScheduledDays(session.scheduledDays || DEFAULT_DAYS);
                        setEditingPlan(true);
                      }
                    }}
                    disabled={busy}
                    className="rounded-full bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {text(editingPlan ? 'Tayyar' : 'Ózgertiw')}
                  </button>
                </div>
              </div>

              <div className="mb-5 flex flex-wrap justify-center gap-2">
                {DAY_LABELS.map((label, day) => {
                  const on = scheduledDays.includes(day);
                  return (
                    <button
                      key={`${label}-${day}`}
                      type="button"
                      disabled={!editingPlan}
                      onClick={() => toggleDay(day)}
                      className={`h-10 w-10 rounded-full text-sm font-bold transition ${
                        on
                          ? 'bg-amber-300 text-ink shadow-sm'
                          : 'bg-white/70 text-ink/35 border border-teal-200'
                      } ${editingPlan ? 'hover:scale-105' : 'opacity-90'}`}
                      aria-pressed={on}
                      aria-label={text(label)}
                    >
                      {text(label)}
                    </button>
                  );
                })}
              </div>

              <div className="tutor-routine-track overflow-x-auto pb-2">
                <div className="flex min-w-max items-center gap-2">
                  {planItems.map((item, index) => (
                    <div key={item.mistakeId} className="flex items-center gap-2">
                      <button
                        type="button"
                        draggable={editingPlan}
                        onDragStart={() => setDraggedId(item.mistakeId)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => moveItem(item.mistakeId)}
                        onDragEnd={() => setDraggedId(null)}
                        className={`tutor-routine-item group w-24 shrink-0 rounded-2xl border px-2 py-3 text-center transition-all ${
                          item.answered
                            ? 'border-emerald-300 bg-emerald-50'
                            : draggedId === item.mistakeId
                              ? 'scale-105 border-teal-500 bg-white shadow-lg'
                              : 'border-teal-200 bg-white/80 hover:-translate-y-1 hover:shadow-md'
                        } ${editingPlan ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border-4 border-teal-200 bg-gradient-to-br from-amber-200 to-cyan-200 text-lg font-bold text-teal-900 shadow-sm">
                          {item.answered ? <Icon name="check-circle" /> : index + 1}
                        </span>
                        <span className="block truncate text-[11px] font-medium text-ink/65">
                          {text(item.prompt)}
                        </span>
                        {item.dictTitleId ? (
                          <Link
                            to={`/dictionary/${item.dictTitleId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 block truncate text-[10px] font-semibold text-teal-800 hover:underline"
                          >
                            {text('Sózlikte')}
                          </Link>
                        ) : null}
                      </button>
                      {index < planItems.length - 1 && (
                        <span className="h-0.5 w-5 rounded-full bg-teal-300" aria-hidden />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-center text-xs text-teal-900/50">
                {editingPlan
                  ? text('Kartalardı súyrep tártipleń, kún hám waqıttı saylań.')
                  : text(
                      `${planItems.length} tapsırma · ${scheduledDays.length} kún · ~${planItems.length * 3} minut`
                    )}
              </p>
            </div>
          )}

          {session && !session.available && session.reason === 'empty_bank' && (
            <div className="mb-8 motion-rise rounded-3xl border border-teal-200/70 bg-gradient-to-br from-teal-50/80 via-white/80 to-amber-50/50 px-6 py-8 text-center">
              <Icon name="grammar" className="mb-3 text-3xl text-teal-800" />
              <p className="mb-2 font-display text-2xl text-ink">{text(KAA.tutorEmptyTitle)}</p>
              <p className="mx-auto mb-6 max-w-md text-sm text-ink/55">{text(KAA.tutorEmptyBody)}</p>
              <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                {text(KAA.tutorEmptyFree)}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to={session.practiceLinks?.quiz || '/quiz'}
                  className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white`}
                >
                  <Icon name="trophy" />
                  {text(KAA.tutorEmptyQuiz)}
                  <AnimChevron count={2} className="opacity-80" />
                </Link>
                <Link
                  to={session.practiceLinks?.dictGame || '/dictionary/game'}
                  className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2.5 text-sm font-bold text-teal-900"
                >
                  <Icon name="gamepad" />
                  {text(KAA.tutorEmptyGame)}
                </Link>
                <Link
                  to={session.practiceLinks?.immersion || '/dictionary/immersion'}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-600/25 bg-cyan-50 px-5 py-2.5 text-sm font-bold text-cyan-950"
                >
                  <Icon name="sparkle" />
                  {text(KAA.tutorEmptyImmersion)}
                </Link>
                <Link
                  to={session.practiceLinks?.crossword || '/crossword'}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-50 px-5 py-2.5 text-sm font-bold text-amber-950"
                >
                  <Icon name="grammar" />
                  {text(KAA.tutorEmptyCrossword)}
                </Link>
                <Link
                  to={session.practiceLinks?.jumbaq || '/jumbaqlar'}
                  className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-50 px-5 py-2.5 text-sm font-bold text-sky-950"
                >
                  <Icon name="sparkle" />
                  {text(KAA.tutorEmptyJumbaq)}
                </Link>
              </div>
              <SoftNextRow
                className="mt-5"
                primaryTo="/games"
                primaryIcon="trophy"
                primaryLabelKey="oyinlar"
                secondaryTo="/literature"
                secondaryIcon="scroll"
                secondaryLabelKey="adebiyat"
              />
            </div>
          )}

          {session && !session.available && session.reason !== 'empty_bank' && (
            <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50/60 px-6 py-8">
              <div className="mb-5 text-center">
                <Icon name="clock" className="mb-3 text-3xl text-amber-700" />
                <p className="mb-2 font-display text-2xl text-ink">
                  {text(session.reason === 'wrong_day' ? 'Búgin dars joq' : 'Hále erte')}
                </p>
                <p className="text-sm text-ink/55">
                  {session.reason === 'wrong_day'
                    ? text('Saylanǵan kúnlerge sáykes emes. Tómende kúnlerdi ózgertiń.')
                    : text(
                        `Dars ${session.scheduledTime || `${session.opensAtHour}:00`} da ashıladı (házirgi saat: ${session.localHour}).`
                      )}
                </p>
                {(top.length > 0 || session.reviewNowAvailable) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setMsg('');
                      try {
                        const daily = await fetchDailyTutor({ force: true });
                        setLocalSession(daily);
                      } catch (e) {
                        setMsg(e.message || 'Ashıw múmkin bolmadı');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Icon name="bolt" />
                    {text(KAA.hozirQayta)}
                    <AnimChevron count={2} className="opacity-80" />
                  </button>
                )}
              </div>

              <div className="mx-auto max-w-md rounded-2xl border border-amber-200/80 bg-white/70 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                  <label className="rounded-full bg-teal-700 px-3 py-2 text-xs font-semibold text-white">
                    <Icon name="clock" className="mr-1" />
                    <input
                      type="time"
                      value={scheduledTime || session.scheduledTime || '08:00'}
                      onChange={(e) => {
                        setScheduledTime(e.target.value);
                        setEditingPlan(true);
                      }}
                      className="bg-transparent text-white outline-none"
                      aria-label={text('Dars waqtı')}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={savePlan}
                    disabled={busy || !editingPlan}
                    className={`${anim.shine} rounded-full bg-teal-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50`}
                  >
                    {text('Saqlaw')}
                  </button>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {DAY_LABELS.map((label, day) => {
                    const on = scheduledDays.includes(day);
                    return (
                      <button
                        key={`u-${label}-${day}`}
                        type="button"
                        onClick={() => {
                          setEditingPlan(true);
                          setScheduledDays((prev) => {
                            if (prev.includes(day)) {
                              if (prev.length <= 1) return prev;
                              return prev.filter((d) => d !== day);
                            }
                            return [...prev, day].sort((a, b) => a - b);
                          });
                        }}
                        className={`h-10 w-10 rounded-full text-sm font-bold transition ${
                          on
                            ? 'bg-amber-300 text-ink shadow-sm'
                            : 'border border-teal-200 bg-white/70 text-ink/35'
                        }`}
                        aria-pressed={on}
                        aria-label={text(label)}
                      >
                        {text(label)}
                      </button>
                    );
                  })}
                </div>
                {msg && <p className="mt-3 text-center text-sm text-teal-800">{text(msg)}</p>}
              </div>

              <div className="mx-auto mt-5 max-w-md rounded-2xl border border-teal-700/15 bg-white/80 px-4 py-4 text-center">
                <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                  {text(KAA.tutorWaitFree)}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Link
                    to="/tutor/practice"
                    className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
                  >
                    <Icon name="bolt" /> {text(KAA.practiceNav)}
                  </Link>
                  <Link
                    to="/quiz"
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-950"
                  >
                    <Icon name="trophy" /> {text(KAA.testler)}
                  </Link>
                  <Link
                    to="/quiz"
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
                  >
                    <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
                  </Link>
                  <Link
                    to="/crossword"
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
                  >
                    <Icon name="grammar" /> {text(KAA.faqTryCrossword)}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {session?.available && session.status === 'completed' && (
            <div className="rounded-3xl border border-teal-200 bg-teal-50/50 px-6 py-8 text-center mb-8">
              <Icon name="trophy" className="text-3xl text-teal-700 mb-3" />
              <p className={`font-display text-2xl ${anim.checkinPop}`}>
                {text('Búginki dars tamam!')}
              </p>
              <p className="text-ink/60 mt-2">
                {session.score}/{session.total}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link
                  to="/tutor/practice"
                  className={`inline-flex rounded-full bg-teal-800 px-5 py-2 text-sm font-semibold text-white ${anim.shine}`}
                >
                  {text(KAA.practiceTitle)}
                </Link>
                <Link
                  to="/profile"
                  className={`inline-flex rounded-full border border-teal-700/30 px-5 py-2 text-sm font-semibold text-teal-900 ${anim.underlineGrow}`}
                >
                  {text(KAA.profil)}
                </Link>
                <ShareResultButton
                  title={text(KAA.shareTutorTitle)}
                  text={text(KAA.shareTutorText)
                    .replace('{score}', String(session.score ?? 0))
                    .replace('{total}', String(session.total ?? 0))}
                  url={
                    typeof window !== 'undefined'
                      ? `${window.location.origin}/tutor`
                      : undefined
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-teal-700/25 bg-white px-5 py-2 text-sm font-semibold text-teal-950"
                />
              </div>
              {!isAuthenticated ? (
                <GuestSoftContinue className="mt-5 text-left" bodyKey="authGuestFreeBody" />
              ) : null}
              <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                {text(KAA.tutorFinishFree)}
              </p>
              <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-3" />
            </div>
          )}

          {session?.available && nextItem && (
            <ProtectedContent>
              <div className="qp-panel px-6 py-8 mb-8">
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-500"
                    style={{
                      width: `${
                        (session.items.filter((i) => i.answered).length / Math.max(1, session.total)) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <p className="text-xs uppercase tracking-widest text-ink/45 mb-3">
                  {session.items.filter((i) => i.answered).length + 1} / {session.total}
                </p>
                <h2 className="font-display text-2xl text-ink mb-4">{text(nextItem.prompt)}</h2>
                {nextItem.kind === 'listen_produce' && nextItem.audioUrl ? (
                  <div className="mb-5">
                    <audio
                      key={nextItem.audioUrl}
                      controls
                      preload="metadata"
                      className="w-full max-w-md"
                      src={nextItem.audioUrl}
                    >
                      <track kind="captions" />
                    </audio>
                  </div>
                ) : null}
                {nextItem.lesson && (
                  <div className="mb-6 rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-50/80 to-cyan-50/50 px-4 py-4">
                    <p className="mb-1 text-[0.65rem] uppercase tracking-[0.18em] text-teal-700/60">
                      {text(KAA.tutorEngineLabel)} · {nextItem.lesson.engine}
                    </p>
                    <p className="text-sm font-semibold text-teal-950 mb-2">
                      {text(nextItem.lesson.focus)}
                    </p>
                    <p className="text-sm text-ink/70 mb-2">{text(nextItem.lesson.tip)}</p>
                    {nextItem.lesson.example && (
                      <p className="text-sm italic text-ink/55 border-l-2 border-teal-300 pl-3">
                        {text(nextItem.lesson.example)}
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-ink/40">{text(nextItem.lesson.practice)}</p>
                    {nextItem.dictTitleId ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          to={`/dictionary/${nextItem.dictTitleId}`}
                          className="inline-flex rounded-full border border-teal-700/25 bg-white/80 px-3 py-1.5 text-xs font-semibold text-teal-900"
                        >
                          {text(KAA.sozlikteAshiw)}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                )}
                {!nextItem.lesson && nextItem.dictTitleId ? (
                  <Link
                    to={`/dictionary/${nextItem.dictTitleId}`}
                    className="mb-4 inline-flex rounded-full border border-teal-700/25 px-3 py-1.5 text-xs font-semibold text-teal-900"
                  >
                    {text(KAA.sozlikteAshiw)}
                  </Link>
                ) : null}
                {nextItem.options ? (
                  <div className="grid gap-3">
                    {nextItem.kind === 'sense_mcq' ? (
                      <p className="text-xs text-ink/50">{text(KAA.tutorSenseMcqHint)}</p>
                    ) : null}
                    {nextItem.options.map((opt, idx) => {
                      const fb = pickFeedback;
                      const isPicked = fb && fb.index === idx;
                      const wrongFade = fb && !fb.correct && isPicked;
                      const correctPop = fb && fb.correct && isPicked;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={busy}
                          onClick={() => onPick(idx)}
                          className={`rounded-2xl border px-4 py-3 text-left transition hover:border-teal-600/40 hover:-translate-y-0.5 disabled:opacity-50 ${
                            correctPop
                              ? 'border-emerald-500/50 bg-emerald-50 text-emerald-950 scale-[1.02]'
                              : wrongFade
                                ? 'border-rose-300/40 bg-rose-50/40 text-ink/45 line-through opacity-60'
                                : 'border-ink/10 bg-parchment/40'
                          }`}
                        >
                          {text(opt)}
                        </button>
                      );
                    })}
                  </div>
                ) : nextItem.kind === 'produce' ||
                  nextItem.kind === 'produce_reverse' ||
                  nextItem.kind === 'example_cloze' ||
                  nextItem.kind === 'listen_produce' ? (
                  <form onSubmit={onProduceSubmit} className="space-y-3">
                    <p className="text-xs text-ink/50">
                      {text(
                        nextItem.kind === 'example_cloze'
                          ? KAA.tutorExampleClozeHint
                          : nextItem.kind === 'listen_produce'
                            ? KAA.tutorListenProduceHint
                            : nextItem.kind === 'produce_reverse'
                              ? KAA.tutorProduceReverseHint
                              : KAA.tutorProduceHint
                      )}
                    </p>
                    <input
                      type="text"
                      value={produceText}
                      onChange={(e) => setProduceText(e.target.value)}
                      disabled={busy}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={text(
                        nextItem.kind === 'produce_reverse'
                          ? KAA.tutorProduceReversePlaceholder
                          : KAA.tutorProducePlaceholder
                      )}
                      className="w-full rounded-2xl border border-teal-700/25 bg-white/90 px-4 py-3 text-base text-ink outline-none ring-teal-600/30 focus:ring-2 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={busy || !String(produceText || '').trim()}
                      className={`${anim.shine} rounded-full bg-teal-800 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50`}
                    >
                      {text(KAA.tutorProduceSubmit)}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPick(0)}
                    className={`${anim.shine} rounded-full bg-teal-800 px-6 py-2.5 text-sm text-white`}
                  >
                    {text('Kórip shıqtım')}
                  </button>
                )}
                {msg ? (
                  <MotionDiv
                    key={msg}
                    variants={
                      pickFeedback && !pickFeedback.correct
                        ? motionVariants.shake
                        : motionVariants.slideUp
                    }
                    className={`mt-4 text-sm ${
                      pickFeedback && !pickFeedback.correct ? 'text-rose-700' : 'text-teal-800'
                    }`}
                  >
                    {text(msg)}
                  </MotionDiv>
                ) : null}
                {abandonedFlash ? (
                  <p className="mt-4 text-xs text-ink/50">{text(KAA.tutorAbandonedHint)}</p>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink/[0.06] pt-5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={abandonSoft}
                    className="px-4 py-2 text-sm text-ink/50 underline-offset-4 hover:text-teal-900 hover:underline disabled:opacity-40"
                  >
                    {text(KAA.tutorAbandon)}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={laterSoft}
                    className="qp-chip text-teal-950"
                  >
                    <Icon name="bolt" /> {text(KAA.tutorLater)}
                  </button>
                </div>
              </div>
            </ProtectedContent>
          )}

          {top.length > 0 && (
            <div className="qp-surface px-5 py-5">
              <p className="text-sm font-semibold text-ink/70 mb-3">{text('Top qáteler')}</p>
              <ul className="space-y-2 text-sm">
                {top.slice(0, 8).map((m) => (
                  <li key={m.id} className="flex justify-between gap-3">
                    {m.dictTitleId ? (
                      <Link
                        to={`/dictionary/${m.dictTitleId}`}
                        className="truncate text-teal-900 hover:underline"
                      >
                        {text(m.prompt || m.questionId || m.id)}
                      </Link>
                    ) : (
                      <span className="truncate text-ink/70">
                        {text(m.prompt || m.questionId || m.id)}
                      </span>
                    )}
                    <span className="shrink-0 text-rose-700 font-semibold">{m.wrongCount}×</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          </PageEnter>
        </section>
      </DictShell>
    </PageGate>
  );
}
