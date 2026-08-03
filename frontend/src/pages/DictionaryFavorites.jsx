import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import usePageMeta from '../hooks/usePageMeta';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import useRecentWords from '../hooks/useRecentWords';
import DictShell from '../components/dictionary/DictShell';
import ProtectedContent from '../components/ProtectedContent';
import WordCard from '../components/dictionary/WordCard';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { AnimChevron, anim } from '../animations';
import { KAA } from '../i18n/kaa';
import { favoritesPracticeHref, favoritesEmptySoftHref } from '../lib/readingPractice';
import { readFavoritesPractice } from '../lib/favoritesProgress';
import useResumeTick from '../hooks/useResumeTick';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import GuestSoftContinue from '../components/GuestSoftContinue';

export default function DictionaryFavorites() {
  const { text } = useUiScript();
  const { items, count, toggle, clear, has } = useDictionaryFavorites();
  const { items: recentItems } = useRecentWords();
  const { isAuthenticated } = useAuth();
  const resumeTick = useResumeTick();
  const favPractice = useMemo(() => readFavoritesPractice(), [resumeTick, count, items]);
  const softHref = favoritesPracticeHref(items, { practice: favPractice });
  const emptySoftHref = favoritesEmptySoftHref(recentItems, { practice: favPractice });
  const needN = Math.max(0, 3 - count);

  usePageMeta(
    text('Unatqanlar'),
    text(
      isAuthenticated
        ? 'Saqlanǵan sózler — akkauntıńızda sinxronlanadı.'
        : 'Saqlanǵan sózler — qurılmańızda saqlanadı.'
    )
  );

  return (
    <ProtectedContent>
    <DictShell className="pt-24 pb-20">
      <section className="relative max-w-3xl mx-auto px-6 md:px-10 pt-8 md:pt-12">
        <Link
          to="/dictionary"
          className="inline-flex items-center gap-2 text-sm text-ink/45 hover:text-teal-900 mb-6 transition-colors"
        >
          ← {text('Sózlik')}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-pink-600 text-2xl text-white shadow-lg shadow-rose-900/20">
                <Icon name="heart" filled />
              </span>
              <p className="font-display text-4xl md:text-5xl text-ink tracking-tight">
                {text('Unatqanlar')}
              </p>
            </div>
            <p className="text-ink/55">
              {count === 0
                ? text('Ele hesh nárse saqlanbaǵan')
                : text(
                    isAuthenticated
                      ? `${count} sóz · akkauntıńızda`
                      : `${count} sóz · qurılmańızda saqlanadı`
                  )}
            </p>
          </div>
          {count > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {count >= 3 && softHref && (
                <Link
                  to={softHref}
                  className={`${anim.shine} inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-900/15 transition hover:-translate-y-0.5`}
                >
                  <Icon name="gamepad" /> {text(KAA.mashqEtiw)}
                </Link>
              )}
              <button
                type="button"
                onClick={clear}
                className="text-sm text-ink/45 hover:text-red-800 underline underline-offset-4"
              >
                {text('Hámmesin tazalaw')}
              </button>
            </div>
          )}
        </div>

        {!isAuthenticated && (
          <div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-50/70 px-4 py-3 text-sm text-rose-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>{text(KAA.favGuestDevice)}</p>
              <Link to="/profile" className="shrink-0 font-bold text-teal-900 hover:underline">
                {text(KAA.favGuestSync)}
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/tutor/practice?from=wod"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-white px-3.5 py-1.5 text-xs font-bold text-amber-950"
              >
                <Icon name="bolt" /> {text(KAA.practiceNav)}
              </Link>
            </div>
            <GuestSoftContinue
              className="mt-3 text-left"
              titleKey={null}
              bodyKey="authGuestFreeBody"
              compact
            />
            <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="start" className="mt-2" compact />
          </div>
        )}

        {count > 0 && count < 3 && (
          <div className="mb-8 flex flex-wrap items-center gap-3 qp-card qp-card--static px-4 py-3.5">
            <span className="qp-chip text-amber-950">
              {text(KAA.favProgress).replace('{count}', String(count))}
            </span>
            <p className="text-sm text-amber-950/80">
              {text(KAA.favNeedN).replace('{n}', String(needN))}
            </p>
            <div className="ml-auto flex flex-wrap gap-2">
              <Link
                to="/dictionary/all"
                className="qp-btn-primary !px-4 !py-2 !text-xs"
              >
                {text(KAA.favAddMore)}
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              {softHref && (
                <Link
                  to={softHref}
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-white px-4 py-2 text-xs font-bold text-rose-900"
                >
                  <Icon name="gamepad" /> {text(KAA.favSoftPractice)}
                </Link>
              )}
            </div>
          </div>
        )}

        {count === 0 ? (
          <div className="rounded-3xl border border-dashed border-rose-300/40 qp-surface px-8 py-16 text-center">
            <span className="qp-icon-tile mx-auto mb-5 !h-16 !w-16 !rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-3xl">
              <Icon name="heart" />
            </span>
            <p className="font-display text-2xl text-ink/70 mb-3">{text(KAA.favEmptyTitle)}</p>
            <p className="text-ink/50 mb-8 max-w-sm mx-auto leading-relaxed">
              {text(emptySoftHref ? KAA.favEmptySoftBody : KAA.favEmptyBody)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {emptySoftHref ? (
                <Link
                  to={emptySoftHref}
                  className={`${anim.shine} qp-btn-primary`}
                >
                  <Icon name="gamepad" /> {text(KAA.favSoftPractice)}
                  <AnimChevron count={2} className="opacity-90" style={{ ['--dch-color']: '#fff' }} />
                </Link>
              ) : (
                <Link
                  to="/tutor/practice?from=wod"
                  className={`${anim.shine} qp-btn-primary`}
                >
                  <Icon name="bolt" /> {text(KAA.checkinMashq)}
                  <AnimChevron count={2} className="opacity-90" style={{ ['--dch-color']: '#fff' }} />
                </Link>
              )}
              <Link
                to="/dictionary/all"
                className="qp-btn-ghost"
              >
                {text(KAA.favEmptyBrowse)}
                <AnimChevron count={2} className="opacity-70" />
              </Link>
            </div>
            <p className="mt-6 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-rose-800/50">
              {text(KAA.favEmptyFree)}
            </p>
            <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" className="mt-3" compact />
            {!isAuthenticated ? (
              <GuestSoftContinue
                className="mx-auto mt-3 max-w-md text-left"
                titleKey={null}
                bodyKey="authGuestFreeBody"
                compact
              />
            ) : null}
          </div>
        ) : (
          <ul className="space-y-6">
            {items.map((entry, idx) => (
              <li
                key={entry.id}
                style={{ animationDelay: `${Math.min(idx, 10) * 45}ms` }}
                className="animate-dict-row"
              >
                <WordCard
                  entry={entry}
                  favoriteActive={has(entry.id)}
                  onFavoriteToggle={toggle}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </DictShell>
    </ProtectedContent>
  );
}
