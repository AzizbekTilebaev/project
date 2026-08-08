import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import useRecentWords from '../hooks/useRecentWords';
import { fetchWordOfDay } from '../api/tusindirme';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, AnimChevron, anim, PageEnter } from '../animations';
import SoftNextRow from '../components/SoftNextRow';
import { readReadingPractice } from '../lib/readingProgress';
import {
  readingPracticeHref,
  immersionPracticeHref,
  crosswordPracticeHref,
  favoritesPracticeHref,
  jumbaqPracticeHref,
  quizPracticeHref,
} from '../lib/readingPractice';
import {
  clearCrosswordContinue,
  readCrosswordPractice,
  getContinueCrossword,
} from '../lib/crosswordProgress';
import { clearDictGameContinue, getContinueDictGame } from '../lib/dictGameProgress';
import { clearTutorContinue, getContinueTutor } from '../lib/tutorProgress';
import { clearAdaptiveContinue, getContinueAdaptive } from '../lib/adaptiveProgress';
import { clearRememberedAttempt, getContinueQuiz } from '../lib/anonymousId';
import {
  clearJumbaqContinue,
  getContinueJumbaq,
  readJumbaqPractice,
} from '../lib/jumbaqProgress';
import {
  clearImmersionContinue,
  getContinueImmersion,
  readImmersionPractice,
} from '../lib/immersionProgress';
import { clearBookContinue, getContinueBook } from '../components/literature/litUtils';
import { readQuizPractice } from '../lib/quizProgress';
import { recentPracticeHref } from '../lib/recentPractice';
import { isWoDPracticedToday } from '../lib/dailyGoalProgress';
import useResumeTick from '../hooks/useResumeTick';
import { readFavoritesPractice } from '../lib/favoritesProgress';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { useAuth } from '../contexts/AuthContext';

function gameHref(ids, { source = 'recent', goal = null } = {}) {
  const list = [...new Set((ids || []).filter(Boolean).map(String))].slice(0, 40);
  if (!list.length) return null;
  const q = new URLSearchParams({ source, ids: list.join(',') });
  if (goal) q.set('goal', goal);
  return `/dictionary/game?${q.toString()}`;
}

/**
 * Búgin oyna — yengil lobby (dashboard / θ / due grid emas).
 */
export default function PracticeHub() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const fromWod = searchParams.get('from') === 'wod';
  const fromAuth = searchParams.get('from') === 'auth';
  const { items: favItems } = useDictionaryFavorites();
  const { items: recentItems } = useRecentWords();
  const resumeTick = useResumeTick();

  usePageMeta(text(KAA.practiceTitle), text(KAA.practiceBody));

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        wordOfDay: async () => {
          try {
            const res = await fetchWordOfDay();
            return res.data || null;
          } catch {
            return null;
          }
        },
      }),
    { deps: [] }
  );

  const wordOfDay = data?.wordOfDay || null;
  const wodId = wordOfDay?.id ? String(wordOfDay.id) : null;
  const wodPracticed = wodId ? isWoDPracticedToday(wodId) : false;
  const wodHref = wodId ? gameHref([wodId], { source: 'checkin', goal: 'wod' }) : null;

  const continueCrossword = useMemo(() => getContinueCrossword(), [resumeTick]);
  const continueDictGame = useMemo(() => getContinueDictGame(), [resumeTick]);
  const continueTutor = useMemo(() => getContinueTutor(), [resumeTick]);
  const continueAdaptive = useMemo(() => getContinueAdaptive(), [resumeTick]);
  const continueQuiz = useMemo(() => getContinueQuiz(), [resumeTick]);
  const continueJumbaq = useMemo(() => getContinueJumbaq(), [resumeTick]);
  const continueBook = useMemo(() => getContinueBook(), [resumeTick]);
  const continueImmersion = useMemo(() => getContinueImmersion(), [resumeTick]);

  const primaryContinue = useMemo(() => {
    const candidates = [
      continueQuiz && {
        href: continueQuiz.href,
        label: KAA.continueQuiz,
        icon: 'trophy',
        clear: () => clearRememberedAttempt(),
      },
      continueCrossword && {
        href: continueCrossword.href,
        label: KAA.continueCrossword,
        icon: 'grammar',
        clear: () => clearCrosswordContinue(continueCrossword.id),
      },
      continueDictGame && {
        href: continueDictGame.href,
        label: KAA.continueDictGame,
        icon: 'gamepad',
        clear: () => clearDictGameContinue(),
      },
      continueJumbaq && {
        href: continueJumbaq.href,
        label: KAA.continueJumbaq,
        icon: 'sparkle',
        clear: () => clearJumbaqContinue(),
      },
      continueImmersion && {
        href: continueImmersion.href,
        label: KAA.continueImmersion,
        icon: 'sparkle',
        clear: () => clearImmersionContinue(continueImmersion.id),
      },
      continueBook && {
        href: continueBook.href,
        label: KAA.continueBook,
        icon: 'book',
        clear: () => clearBookContinue(continueBook.bookId),
      },
      continueTutor && {
        href: continueTutor.href,
        label: KAA.continueTutor,
        icon: 'tutor',
        clear: () => clearTutorContinue(),
      },
      continueAdaptive && {
        href: continueAdaptive.href,
        label: KAA.continueAdaptive,
        icon: 'sparkle',
        clear: () => clearAdaptiveContinue(),
      },
    ].filter(Boolean);
    return candidates[0] || null;
  }, [
    continueQuiz,
    continueCrossword,
    continueDictGame,
    continueJumbaq,
    continueImmersion,
    continueBook,
    continueTutor,
    continueAdaptive,
  ]);

  const startHref =
    fromWod && wodHref && !wodPracticed
      ? wodHref
      : primaryContinue?.href ||
        recentPracticeHref(recentItems) ||
        favoritesPracticeHref(favItems, { practice: readFavoritesPractice() }) ||
        '/games';

  const playCards = [
    { to: '/games', icon: 'trophy', title: KAA.oyinlar, desc: KAA.homeDoorGamesDesc },
    { to: '/literature', icon: 'scroll', title: KAA.adebiyat, desc: KAA.homeDoorLitDesc },
  ];

  const deepLinks = useMemo(() => {
    const links = [];
    const quizHref = quizPracticeHref(readQuizPractice());
    const crossHref = crosswordPracticeHref(readCrosswordPractice());
    const jumbaqHref = jumbaqPracticeHref(readJumbaqPractice());
    const immersionHref = immersionPracticeHref(readImmersionPractice());
    const readingHref = readingPracticeHref(readReadingPractice());
    const favHref = favoritesPracticeHref(favItems, { practice: readFavoritesPractice() });
    const recentHref = recentPracticeHref(recentItems);
    if (quizHref) links.push({ to: quizHref, label: KAA.practiceQuizShort || KAA.testler });
    if (crossHref) links.push({ to: crossHref, label: KAA.practiceCrosswordShort || KAA.krossvord });
    if (jumbaqHref) links.push({ to: jumbaqHref, label: KAA.practiceJumbaqShort || KAA.haptaliqCtaJumbaq });
    if (immersionHref) links.push({ to: immersionHref, label: KAA.practiceImmersionShort || KAA.dawisliSozler });
    if (readingHref) links.push({ to: readingHref, label: KAA.practiceReadingShort || KAA.adebiyat });
    if (favHref) links.push({ to: favHref, label: KAA.practiceFavs || KAA.yoqtirilganlar });
    if (recentHref) links.push({ to: recentHref, label: KAA.practiceRecent || KAA.dawamEtiw });
    if (wodHref && !wodPracticed) links.push({ to: wodHref, label: KAA.kunSozi });
    links.push({ to: '/tutor', label: KAA.uyretiwshi });
    links.push({ to: '/profile', label: KAA.profil });
    return links;
  }, [favItems, recentItems, wodHref, wodPracticed]);

  return (
    <PageGate status={status} error={error} onRetry={reload} backHref="/" backLabel={text(KAA.basBet)}>
      <DictShell className="pt-24 pb-28">
        <section className="relative mx-auto max-w-2xl px-5 pt-6 sm:px-6 md:px-10 md:pt-8">
          <PageEnter>
          <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-teal-800/70">
            {text(KAA.practiceEyebrow)}
          </p>
          <h1 className="mb-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">
            {text(KAA.practiceTitle)}
          </h1>
          <AnimIconDivider amber className="mb-3" />
          <p className="mb-8 max-w-lg text-ink/55">{text(KAA.practiceBody)}</p>

          {fromWod && wodId && (
            <p className="mb-4 rounded-2xl border border-amber-500/25 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              {text(KAA.practiceFromWodBanner || KAA.kunSozi)}
            </p>
          )}
          {fromAuth && !isAuthenticated && (
            <div className="mb-4">
              <GuestSoftContinue compact titleKey="authGuestFreeTitle" />
            </div>
          )}

          {primaryContinue && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link
                to={primaryContinue.href}
                className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-sky-800 px-4 py-2 text-sm font-bold text-white`}
              >
                <Icon name={primaryContinue.icon} /> {text(primaryContinue.label)}
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              <button
                type="button"
                onClick={() => primaryContinue.clear?.()}
                className="rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink/55 hover:text-teal-900"
              >
                {text(KAA.keyinirek)}
              </button>
            </div>
          )}

          <Link
            to={startHref}
            className={`${anim.shine} qp-btn-primary mb-8 w-full sm:w-auto`}
          >
            <Icon name="bolt" />
            {text(KAA.practiceStart)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>

          <div className="motion-chip-stagger grid gap-3 sm:grid-cols-2">
            {playCards.map((card) => (
              <Link
                key={card.to}
                to={card.to}
                className="qp-card flex flex-col px-4 py-5 no-underline"
              >
                <Icon name={card.icon} className="mb-2 text-xl text-teal-800" />
                <span className="block font-display text-lg text-ink">{text(card.title)}</span>
                <span className="mt-1 block text-sm text-ink/55">{text(card.desc)}</span>
              </Link>
            ))}
          </div>

          <div className="mt-10 border-t border-ink/10 pt-6">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45 hover:text-teal-900"
            >
              {text(KAA.navMore)} {moreOpen ? '▴' : '▾'}
            </button>
            {moreOpen && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {deepLinks.map((l) => (
                  <li key={`${l.to}-${l.label}`}>
                    <Link
                      to={l.to}
                      className="inline-flex rounded-full qp-chip text-ink/70 hover:text-teal-900"
                    >
                      {text(l.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="mt-8 text-center text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
            {text(KAA.learnPracticeHint)}
          </p>
          <SoftNextRow
            className="mt-3"
            primaryTo="/games"
            primaryIcon="trophy"
            primaryLabelKey="oyinlar"
            secondaryTo="/literature"
            secondaryIcon="scroll"
            secondaryLabelKey="adebiyat"
          />

          {!isAuthenticated && (
            <div className="mt-8">
              <GuestSoftContinue titleKey="authGuestFreeTitle" />
            </div>
          )}
          </PageEnter>
        </section>
      </DictShell>
    </PageGate>
  );
}
