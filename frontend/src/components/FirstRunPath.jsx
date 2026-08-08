import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import useRecentWords from '../hooks/useRecentWords';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim, fmMotion } from '../animations';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { getDailyGoalStatus } from '../lib/dailyGoalProgress';
import { getGuestLocalSummary } from '../lib/guestLocalSummary';
import useResumeTick from '../hooks/useResumeTick';
import {
  DISMISS_KEY,
  clearFirstRunPathSelection,
  dismissFirstRun,
  hasAnyPathComplete,
  isFirstRunDismissed,
  readCelebratePending,
  readFirstRunPaths,
  selectFirstRunPath,
  setCelebratePending,
  syncDetectedCompletions,
} from '../lib/firstRunProgress';

/** 3 o‘yin eshigi — LMS / mashq checklist yo‘q. */
const PATH_META = [
  {
    id: 'quiz',
    icon: 'trophy',
    title: 'firstRunPathQuiz',
    hint: 'firstRunPathQuizHint',
    href: '/quiz',
  },
  {
    id: 'crossword',
    icon: 'layers',
    title: 'firstRunPathCrossword',
    hint: 'firstRunPathCrosswordHint',
    href: '/crossword',
  },
  {
    id: 'play',
    icon: 'gamepad',
    title: 'firstRunPathWord',
    hint: 'firstRunPathWordHint',
    href: '/dictionary/game',
  },
];

/**
 * Yangi mehman: 3 o‘yin eshigi. Soft-exit Practice link yo‘q.
 */
export default function FirstRunPath({ wordOfDay = null, checkin = null, className = '' }) {
  const { text } = useUiScript();
  const reduceMotion = usePrefersReducedMotion();
  const resumeTick = useResumeTick();
  const local = useMemo(() => getGuestLocalSummary(), [resumeTick]);

  const [dismissed, setDismissed] = useState(isFirstRunDismissed);
  const [paths, setPaths] = useState(readFirstRunPaths);
  const [celebrate, setCelebrate] = useState(readCelebratePending);

  useEffect(() => {
    setDismissed(isFirstRunDismissed());
    setPaths(readFirstRunPaths());
    setCelebrate(readCelebratePending());
  }, [resumeTick]);

  useEffect(() => {
    const next = syncDetectedCompletions({});
    setPaths(next);
  }, [resumeTick]);

  useEffect(() => {
    if (dismissed) return;
    if (hasAnyPathComplete(paths.completed) && readCelebratePending()) {
      setCelebrate(true);
    }
  }, [paths.completed, dismissed, resumeTick]);

  const dailyGoal = useMemo(
    () =>
      getDailyGoalStatus({
        claimedToday: checkin?.claimedToday,
        titleId: checkin?.titleId || wordOfDay?.id,
      }),
    [checkin?.claimedToday, checkin?.titleId, wordOfDay?.id]
  );

  const dismiss = useCallback(() => {
    dismissFirstRun();
    setCelebrate(false);
    setDismissed(true);
  }, []);

  const pickPath = useCallback((id) => {
    setPaths(selectFirstRunPath(id));
  }, []);

  const backToPicker = useCallback(() => {
    setCelebratePending(false);
    setCelebrate(false);
    setPaths(clearFirstRunPathSelection());
  }, []);

  const handoff =
    local.primary ||
    (dailyGoal.complete
      ? { href: '/games', labelKey: 'oyinlar', icon: 'trophy' }
      : wordOfDay?.id
        ? {
            href: `/dictionary/game?source=checkin&ids=${encodeURIComponent(wordOfDay.id)}&goal=wod`,
            labelKey: 'sozOyinlari',
            icon: 'gamepad',
          }
        : { href: '/games', labelKey: 'oyinlar', icon: 'trophy' });

  if (dismissed) return null;

  const anyComplete = hasAnyPathComplete(paths.completed);

  if (celebrate && anyComplete) {
    return (
      <div
        className={`rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/90 via-white/85 to-teal-50/50 px-5 py-5 ${className} ${anim.checkinPop}`}
      >
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-emerald-800/60">
          {text(KAA.firstRunEyebrow)}
        </p>
        <h2 className="mt-1 font-display text-xl text-ink sm:text-2xl">{text(KAA.firstRunDoneTitle)}</h2>
        <p className="mt-1 text-sm text-ink/55">{text(KAA.firstRunDoneBody)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to={handoff.href}
            onClick={dismiss}
            className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white`}
          >
            <Icon name={handoff.icon || 'bolt'} />
            {text(KAA[handoff.labelKey] || handoff.labelKey || KAA.firstRunDoneCta)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
          <Link
            to="/profile"
            onClick={dismiss}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/25 bg-white px-4 py-2 text-xs font-bold text-teal-950"
          >
            <Icon name="tutor" />
            {text(KAA.firstRunSoftProfile)}
          </Link>
          <button
            type="button"
            onClick={backToPicker}
            className="text-xs font-semibold text-ink/45 hover:text-ink/70"
          >
            {text(KAA.firstRunOtherPath)}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-semibold text-ink/35 hover:text-ink/60"
          >
            {text(KAA.keyinirek)}
          </button>
        </div>
      </div>
    );
  }

  const selected = paths.selected;
  const selectedMeta = PATH_META.find((p) => p.id === selected);

  if (!selected) {
    return (
      <div
        className={`rounded-3xl border border-teal-700/15 bg-gradient-to-br from-teal-50/80 via-white/85 to-amber-50/50 px-5 py-5 ${className}`}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
              {text(KAA.firstRunEyebrow)}
            </p>
            <h2 className="font-display text-xl text-ink sm:text-2xl">{text(KAA.firstRunTitle)}</h2>
            <p className="mt-1 text-sm text-ink/55">{text(KAA.firstRunBody)}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-semibold text-ink/40 hover:text-ink/70"
          >
            {text(KAA.keyinirek)}
          </button>
        </div>

        <ul className="grid gap-2 sm:grid-cols-3">
          {PATH_META.map((p) => {
            const done = Boolean(paths.completed[p.id]);
            const Btn = reduceMotion ? 'button' : fmMotion.button;
            return (
              <li key={p.id}>
                <Btn
                  type="button"
                  onClick={() => pickPath(p.id)}
                  whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
                    done
                      ? 'border-emerald-300/60 bg-emerald-50/70'
                      : 'border-teal-500/25 bg-white shadow-sm hover:border-teal-500/45'
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      done ? 'bg-emerald-600 text-white' : 'bg-teal-800 text-white'
                    }`}
                  >
                    {done ? <Icon name="check" /> : <Icon name={p.icon} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{text(KAA[p.title])}</span>
                    <span className="mt-0.5 block text-xs text-ink/50">{text(KAA[p.hint])}</span>
                  </span>
                </Btn>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (selectedMeta && !paths.completed[selected]) {
    return (
      <div
        className={`rounded-3xl border border-teal-700/15 bg-gradient-to-br from-teal-50/80 via-white/85 to-amber-50/50 px-5 py-5 ${className}`}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-teal-800/60">
              {text(KAA[selectedMeta.title])}
            </p>
            <h2 className="font-display text-xl text-ink sm:text-2xl">{text(KAA.firstRunActiveTitle)}</h2>
            <p className="mt-1 text-sm text-ink/55">{text(KAA[selectedMeta.hint])}</p>
          </div>
          <button
            type="button"
            onClick={backToPicker}
            className="text-xs font-semibold text-ink/40 hover:text-ink/70"
          >
            {text(KAA.firstRunOtherPath)}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={selectedMeta.href}
            className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white`}
          >
            <Icon name={selectedMeta.icon} />
            {text(KAA.firstRunPathGo)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs font-semibold text-ink/40 hover:text-ink/70"
          >
            {text(KAA.keyinirek)}
          </button>
        </div>

        <p className="mt-4 text-xs text-ink/45">{text(KAA.firstRunFinishHint)}</p>
      </div>
    );
  }

  if (selected && paths.completed[selected]) {
    return (
      <div
        className={`rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-50/90 via-white/85 to-teal-50/50 px-5 py-5 ${className}`}
      >
        <h2 className="font-display text-xl text-ink">{text(KAA.firstRunDoneTitle)}</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to={handoff.href}
            onClick={dismiss}
            className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-5 py-2.5 text-sm font-bold text-white`}
          >
            {text(KAA.firstRunDoneCta)}
          </Link>
          <button type="button" onClick={backToPicker} className="text-xs font-semibold text-ink/45">
            {text(KAA.firstRunOtherPath)}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/** Qaytıp kelgenler: bir soft resume — daily-goal chip yo‘q. */
export function ContinueLearning({
  wordOfDay = null,
  checkin = null,
  tutorDue = false,
  className = '',
}) {
  const { text } = useUiScript();
  const { items: recent } = useRecentWords();
  const last = recent[0] || null;
  const resumeTick = useResumeTick();
  const local = useMemo(() => getGuestLocalSummary(), [resumeTick]);

  const firstRunGone = (() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  })();

  const dailyGoal = getDailyGoalStatus({
    claimedToday: checkin?.claimedToday,
    titleId: checkin?.titleId || wordOfDay?.id,
  });
  const preferWoDPractice =
    Boolean(wordOfDay?.id) && dailyGoal.claimed && !dailyGoal.practiced;
  const preferWoDCheckin = !dailyGoal.claimed;
  const wodPlayHref = wordOfDay?.id
    ? `/dictionary/game?source=checkin&ids=${encodeURIComponent(wordOfDay.id)}&goal=wod`
    : '/dictionary/game';

  if (!firstRunGone) return null;

  const hasResume = Boolean(
    local.hasLocal || local.primary || last || preferWoDCheckin || wordOfDay || tutorDue
  );

  if (!hasResume) return null;

  let primary = null;
  if (preferWoDCheckin) {
    primary = {
      href: '/#kun-sozi',
      label: KAA.kunSoziBelgilaw,
      icon: null,
      tone: 'amber',
    };
  } else if (preferWoDPractice) {
    primary = {
      href: wodPlayHref,
      label: KAA.homeWodPlay,
      icon: 'gamepad',
      tone: 'teal',
    };
  } else if (local.primary) {
    primary = {
      href: local.primary.href,
      label: KAA[local.primary.labelKey] || local.primary.labelKey,
      icon: local.primary.icon || 'bolt',
      tone: 'teal',
    };
  } else if (last) {
    primary = {
      href: `/dictionary/${last.id}`,
      label: last.soz,
      icon: null,
      tone: 'soft',
    };
  } else if (wordOfDay) {
    primary = {
      href: `/dictionary/${wordOfDay.id}`,
      label: `${text(KAA.kunSozi)}: ${wordOfDay.soz}`,
      icon: null,
      tone: 'softAmber',
    };
  }

  if (!primary) return null;

  const primaryClass =
    primary.tone === 'amber'
      ? 'inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-sm font-semibold text-ink'
      : primary.tone === 'soft'
        ? 'inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900'
        : primary.tone === 'softAmber'
          ? 'inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-950'
          : `${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3 py-1.5 text-sm font-semibold text-white`;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-2xl border border-ink/[0.07] bg-white/70 px-4 py-3 ${className}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/40">
        {text(KAA.dawamEtiw)}
      </p>
      <Link to={primary.href} className={primaryClass}>
        {primary.icon ? <Icon name={primary.icon} /> : null}
        {text(primary.label)}
        <AnimChevron
          count={2}
          className="opacity-80"
          style={
            primary.tone === 'amber' || primary.tone === 'soft' || primary.tone === 'softAmber'
              ? undefined
              : { ['--dch-color']: '#ecfdf5' }
          }
        />
      </Link>
    </div>
  );
}
