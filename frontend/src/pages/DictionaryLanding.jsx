import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchDashboard, fetchRandomWord, fetchWordOfDayCheckin } from '../api/tusindirme';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import useRecentWords from '../hooks/useRecentWords';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import DictShell from '../components/dictionary/DictShell';
import AlphabetCalendar from '../components/dictionary/AlphabetCalendar';
import SearchAutocomplete from '../components/dictionary/SearchAutocomplete';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useUiScript } from '../contexts/UiScriptContext';
import { AnimIconDivider, anim, AnimChevron } from '../animations';
import { ContinueLearning } from '../components/FirstRunPath';
import { KAA } from '../i18n/kaa';
import {
  clearImmersionContinue,
  getImmersionListenMeta,
  getContinueImmersion,
} from '../lib/immersionProgress';
import { getReadingLessonMeta } from '../lib/readingProgress';
import { recentPracticeHref } from '../lib/recentPractice';
import { favoritesEmptySoftHref } from '../lib/readingPractice';
import { readFavoritesPractice } from '../lib/favoritesProgress';
import { DictHubCards } from '../components/dictionary/LinkedDictPanels';
import useResumeTick from '../hooks/useResumeTick';

export default function DictionaryLanding() {
  const navigate = useNavigate();
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { count: favCount } = useDictionaryFavorites();
  const { items: recentWords, clear: clearRecent } = useRecentWords();
  const [checkin, setCheckin] = useState(null);

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle({
        dash: async () => {
          const res = await fetchDashboard();
          return res.data || null;
        },
      }),
    { deps: [] }
  );

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchWordOfDayCheckin()
        .then((res) => {
          if (!cancelled) setCheckin(res.checkin || null);
        })
        .catch(() => {
          if (!cancelled) setCheckin(null);
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

  usePageMeta(
    null,
    text('Qaraqalpaq tiliniń túsindirme sózligi — álipbe, túrkimler hám temalar.')
  );

  const dash = data?.dash;

  const goRandom = async () => {
    try {
      const data = await fetchRandomWord();
      if (data.data?.id) navigate(`/dictionary/${data.data.id}`);
    } catch {
      navigate('/dictionary/all');
    }
  };

  const wordOfDay = dash?.wordOfDay;
  const totalWords = dash?.totalWords ?? 0;
  const immersionMeta = useMemo(() => getImmersionListenMeta(), []);
  const resumeTick = useResumeTick();
  const continueImmersion = useMemo(() => getContinueImmersion(), [resumeTick]);
  const readingMeta = useMemo(() => getReadingLessonMeta(), []);
  const recentPlayHref = recentPracticeHref(recentWords);
  const favEmptySoftHref = useMemo(
    () => favoritesEmptySoftHref(recentWords, { practice: readFavoritesPractice() }),
    [recentWords, resumeTick]
  );

  return (
    <ProtectedContent>
    <PageGate status={status} error={error} onRetry={reload} backHref="/literature" backLabel={text(KAA.adebiyat)}>
    <DictShell className="pt-24 pb-24">
      <section className="relative max-w-4xl mx-auto px-6 md:px-10 pt-8 md:pt-12">
        <h1 className="font-display text-5xl md:text-7xl text-ink tracking-tight mb-3 animate-dict-rise">
          {text('Sózlik')}
        </h1>
        <p className="max-w-xl text-ink/65 text-lg md:text-xl leading-relaxed mb-8 animate-dict-rise-delay">
          {text('Álipbe, sóz túrkimleri hám temalar — izleń hám oynań.')}
        </p>

        <div className="mb-6 animate-dict-rise-delay-2">
          <SearchAutocomplete />
        </div>

        <div className="mb-10 animate-dict-rise-delay-2">
          <DictHubCards />
        </div>

        <ContinueLearning wordOfDay={wordOfDay} checkin={checkin} className="mb-8" />

        {(continueImmersion || immersionMeta.practiceCount > 0 || immersionMeta.streak > 0) && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {continueImmersion ? (
              <>
                <Link
                  to={continueImmersion.href}
                  className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-cyan-800 px-4 py-2 text-sm font-semibold text-white`}
                >
                  <Icon name="sparkle" /> {text(KAA.continueImmersion)}
                  {continueImmersion.soz ? (
                    <span className="max-w-[8rem] truncate opacity-90">{text(continueImmersion.soz)}</span>
                  ) : null}
                </Link>
                <button
                  type="button"
                  onClick={() => clearImmersionContinue(continueImmersion.id)}
                  className="rounded-full border border-cyan-800/20 bg-white px-3.5 py-2 text-xs font-semibold text-ink/55 hover:text-teal-900"
                >
                  {text(KAA.immersionAbandon)}
                </button>
              </>
            ) : null}
            {immersionMeta.practiceCount > 0 ? (
              <Link
                to="/games"
                className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-900 px-4 py-2 text-sm font-semibold text-white`}
              >
                {text(KAA.oyinlar)}
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {immersionMeta.practiceCount}
                </span>
              </Link>
            ) : !continueImmersion ? (
              <Link
                to="/dictionary/immersion"
                className="inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2 text-sm font-semibold text-white"
              >
                {text(KAA.immersionKeepStreak)}
              </Link>
            ) : null}
            {immersionMeta.streak > 0 && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold text-amber-950 ${anim.streakFlame}`}
              >
                <span className={anim.streakDot} aria-hidden />
                {text(KAA.immersionStreak)} {immersionMeta.streak}
              </span>
            )}
            <Link
              to="/dictionary/immersion"
              className="ml-auto text-sm font-semibold text-teal-900 hover:underline"
            >
              {text(KAA.immersionLandingCta)}
            </Link>
          </div>
        )}

        {(readingMeta.practiceCount > 0 || readingMeta.streak > 0) && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Link
              to={
                readingMeta.bookId
                  ? `/books/${encodeURIComponent(readingMeta.bookId)}`
                  : '/books'
              }
              className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white`}
            >
              {readingMeta.practiceCount > 0
                ? text(KAA.readingBrowsePractice)
                : text(KAA.readingKeepStreak)}
              {readingMeta.practiceCount > 0 ? (
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {readingMeta.practiceCount}
                </span>
              ) : null}
            </Link>
            {readingMeta.streak > 0 && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold text-amber-950 ${anim.streakFlame}`}
              >
                <span className={anim.streakDot} aria-hidden />
                {text(KAA.readingStreak)} {readingMeta.streak}
              </span>
            )}
            <Link
              to="/literature"
              className="ml-auto text-sm font-semibold text-teal-900 hover:underline"
            >
              {text(KAA.adebiyat)}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-14">
          <Link
            to={wordOfDay ? `/dictionary/${wordOfDay.id}` : '/dictionary/all'}
            className="group qp-card px-5 py-5"
          >
            <span className="qp-icon-tile mb-3 !h-9 !w-9 !rounded-xl !text-lg bg-gradient-to-br from-teal-500 to-emerald-700 transition-transform duration-300 group-hover:scale-110">
              <Icon name="sparkle" />
            </span>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-teal-800/80 mb-1.5">{text('Kún sózi')}</p>
            <p className="font-display text-2xl text-ink tracking-tight truncate inline-flex items-center gap-2 max-w-full">
              <span className="truncate">{wordOfDay?.soz ? text(wordOfDay.soz) : '—'}</span>
              <AnimChevron count={2} className="opacity-45 shrink-0" />
            </p>
          </Link>
          <Link
            to="/dictionary/all"
            className="group qp-card px-5 py-5"
          >
            <span className="qp-icon-tile mb-3 !h-9 !w-9 !rounded-xl !text-lg bg-gradient-to-br from-teal-600 to-emerald-700 transition-transform duration-300 group-hover:scale-110">
              <Icon name="book" />
            </span>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-teal-800/80 mb-1.5">{text('Barlıq sózler')}</p>
            <p className="font-display text-2xl text-ink tracking-tight inline-flex items-center gap-2">
              {totalWords.toLocaleString('kk')}
              <AnimChevron count={2} className="opacity-45" />
            </p>
          </Link>
          <div className="group qp-card px-5 py-5">
            <Link to="/dictionary/favorites" className="block">
              <span className="qp-icon-tile mb-3 !h-9 !w-9 !rounded-xl !text-lg bg-gradient-to-br from-amber-400 to-orange-500 transition-transform duration-300 group-hover:scale-110">
                <Icon name="heart" filled />
              </span>
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-rose-700/80 mb-1.5">{text('Unatqanlar')}</p>
              <p className="font-display text-2xl text-ink tracking-tight inline-flex items-center gap-2">
                {favCount} <span className="text-base text-ink/40 font-sans">{text('sóz')}</span>
                <AnimChevron count={2} className="opacity-45" style={{ ['--dch-color']: '#e11d48' }} />
              </p>
            </Link>
            {favCount === 0 && favEmptySoftHref && (
              <Link
                to={favEmptySoftHref}
                className={`${anim.shine} mt-3 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-white px-3 py-1 text-xs font-bold text-rose-900`}
              >
                <Icon name="gamepad" /> {text(KAA.favLandingMashq)}
              </Link>
            )}
          </div>
          <Link
            to="/dictionary/stats"
            className="group qp-card px-5 py-5"
          >
            <span className="qp-icon-tile mb-3 !h-9 !w-9 !rounded-xl !text-lg bg-gradient-to-br from-teal-600 to-cyan-700 transition-transform duration-300 group-hover:scale-110">
              <Icon name="trophy" />
            </span>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-teal-800/80 mb-1.5">{text('Statistika')}</p>
            <p className="font-display text-2xl text-ink tracking-tight inline-flex items-center gap-2">
              {text('Ashıw')}{' '}
              <AnimChevron count={2} className="opacity-70" />
            </p>
          </Link>
          <Link
            to="/games"
            className="group qp-card px-5 py-5 col-span-2 lg:col-span-1"
          >
            <span className="qp-icon-tile mb-3 !h-9 !w-9 !rounded-xl !text-lg bg-gradient-to-br from-amber-400 to-orange-600 transition-transform duration-300 group-hover:scale-110">
              <Icon name="trophy" />
            </span>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-amber-700/80 mb-1.5">{text(KAA.oyinlar)}</p>
            <p className="font-display text-2xl text-ink tracking-tight inline-flex items-center gap-2">
              {text(KAA.homeDoorCta)}{' '}
              <AnimChevron count={2} className="opacity-70" style={{ ['--dch-color']: '#b45309' }} />
            </p>
          </Link>
        </div>
      </section>

      <section className="relative max-w-4xl mx-auto px-6 md:px-10 mb-16">
        <div className="qp-section-head">
          <div>
            <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/40 mb-1">{text('Álipbe')}</p>
            <p className="font-display text-2xl md:text-3xl text-ink tracking-tight">
              {text('Háripti tańlań')}
            </p>
            <AnimIconDivider compact className="mt-2" />
          </div>
          <button
            type="button"
            onClick={goRandom}
            className="qp-chip text-teal-900"
          >
            {text('Qálegen sóz')}
          </button>
        </div>
        <AlphabetCalendar letters={dash?.alphabet} />
      </section>

      {recentWords.length > 0 && (
        <section className="relative max-w-4xl mx-auto px-6 md:px-10 mb-16">
          <div className="qp-section-head">
            <div>
              <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/40 mb-1">{text('Tariyx')}</p>
              <p className="font-display text-2xl md:text-3xl text-ink tracking-tight">
                {text('Jaqında kórilgen')}
              </p>
              <AnimIconDivider compact amber className="mt-2" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {recentPlayHref && (
                <Link
                  to={recentPlayHref}
                  className={`${anim.shine} qp-btn-primary !px-3.5 !py-1.5 !text-xs`}
                >
                  <Icon name="bolt" /> {text(KAA.mashqEtiw)}
                </Link>
              )}
              <button
                type="button"
                onClick={clearRecent}
                className="qp-chip text-ink/50 hover:text-red-800"
              >
                {text('Tazalaw')}
              </button>
            </div>
          </div>
          <ul className="flex flex-wrap gap-2.5">
            {recentWords.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/dictionary/${item.id}`}
                  className="group inline-flex items-baseline gap-2 rounded-full border border-ink/[0.1] bg-white/45 hover:bg-teal-900 hover:text-parchment px-4 py-2 transition-colors"
                >
                  <span className="font-display text-lg tracking-tight">{text(item.soz)}</span>
                  {item.category && (
                    <span className="text-[0.6rem] uppercase tracking-[0.14em] text-teal-800/70 group-hover:text-parchment/60">
                      {text(item.category)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {wordOfDay && (
        <section className="relative max-w-4xl mx-auto px-6 md:px-10 mb-16">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-amber-700/80 mb-5 inline-flex items-center gap-2">
            <Icon name="sparkle" className="text-amber-500" /> {text('Búgin')}
          </p>
          <Link
            to={`/dictionary/${wordOfDay.id}`}
            className="group relative block overflow-hidden qp-surface px-7 py-8 md:px-10 md:py-10 transition-all duration-300 hover:shadow-[0_22px_55px_-25px_rgba(180,120,40,0.45)]"
          >
            <span
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/15 blur-2xl"
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-4 mb-4">
              <span className="font-display text-4xl md:text-5xl text-ink tracking-tight group-hover:text-teal-900 transition-colors">
                {text(wordOfDay.soz)}
              </span>
              {wordOfDay.category && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-amber-800">
                  {text(wordOfDay.category)}
                </span>
              )}
            </div>
            {wordOfDay.birinshi_aniqlama && (
              <p className="text-ink/75 text-lg leading-relaxed mb-5 max-w-2xl">
                {text(wordOfDay.birinshi_aniqlama)}
              </p>
            )}
            {wordOfDay.birinshi_misal?.example && (
              <figure className="pl-5 border-l-2 border-teal-800/25">
                <blockquote>
                  <p className="font-display italic text-ink/70 leading-relaxed">
                    “{text(wordOfDay.birinshi_misal.example)}”
                  </p>
                </blockquote>
                {wordOfDay.birinshi_misal.author && (
                  <figcaption className="mt-2 text-sm text-teal-900/70">
                    — {text(wordOfDay.birinshi_misal.author)}
                  </figcaption>
                )}
              </figure>
            )}
          </Link>
        </section>
      )}

      {(dash?.topWords || []).length > 0 && (
        <section className="relative max-w-4xl mx-auto px-6 md:px-10 mb-16">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/40 mb-2">{text('Reyting')}</p>
          <p className="font-display text-2xl md:text-3xl text-ink tracking-tight mb-2">
            {text('Kóp kórilgen sózler')}
          </p>
          <AnimIconDivider className="mb-6" />
          <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
            {dash.topWords.map((item, idx) => {
              const rankCls =
                idx === 0
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md'
                  : idx === 1
                    ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-md'
                    : idx === 2
                      ? 'bg-gradient-to-br from-orange-300 to-amber-600 text-white shadow-md'
                      : 'bg-ink/[0.05] text-ink/50';
              return (
                <li key={item.id}>
                  <Link
                    to={`/dictionary/${item.id}`}
                    className="group flex items-center gap-3.5 py-2.5 border-b border-ink/[0.07] hover:border-teal-800/30 transition-colors"
                  >
                    <span
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${rankCls}`}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-display text-xl text-ink tracking-tight group-hover:text-teal-900 transition-colors truncate">
                      {text(item.soz)}
                    </span>
                    <span className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                      <Icon name="eye" /> {item.views_count}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="relative max-w-4xl mx-auto px-6 md:px-10 mb-16">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/40 mb-2">{text('Sóz túrkimleri')}</p>
        <p className="font-display text-2xl md:text-3xl text-ink tracking-tight mb-6">
          {text('Grammatikalıq bólim')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {(dash?.pos || []).map((p, i) => {
            const accents = [
              'hover:bg-teal-800 border-t-teal-500',
              'hover:bg-amber-600 border-t-amber-500',
              'hover:bg-cyan-700 border-t-cyan-500',
              'hover:bg-emerald-700 border-t-emerald-500',
              'hover:bg-sky-700 border-t-sky-500',
              'hover:bg-teal-700 border-t-teal-600',
            ];
            return (
              <Link
                key={p.slug}
                to={`/dictionary/all?pos=${encodeURIComponent(p.slug)}`}
                className={`group qp-card border-t-4 px-5 py-5 hover:text-parchment ${
                  accents[i % accents.length]
                }`}
              >
                <p className="font-display text-xl tracking-tight">{text(p.label)}</p>
                <p className="text-sm mt-1 text-ink/45 group-hover:text-parchment/70">
                  {p.count.toLocaleString('kk')} {text('sóz')}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="relative max-w-4xl mx-auto px-6 md:px-10">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-ink/40 mb-2">{text('Temalar')}</p>
        <p className="font-display text-2xl md:text-3xl text-ink tracking-tight mb-6">
          {text('Avtomatik toparlar')}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {(dash?.themes || []).map((t, i) => {
            const accents = [
              'border-l-teal-500 hover:border-teal-600/40',
              'border-l-amber-500 hover:border-amber-500/40',
              'border-l-cyan-500 hover:border-cyan-500/40',
              'border-l-emerald-500 hover:border-emerald-500/40',
            ];
            const chips = [
              'bg-teal-100 text-teal-900',
              'bg-amber-100 text-amber-800',
              'bg-cyan-100 text-cyan-900',
              'bg-emerald-100 text-emerald-800',
            ];
            return (
              <Link
                key={t.slug}
                to={`/dictionary/all?theme=${encodeURIComponent(t.slug)}`}
                className={`qp-card border-l-4 px-5 py-5 ${
                  accents[i % accents.length]
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-xl text-ink tracking-tight">{text(t.label)}</p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${chips[i % chips.length]}`}
                  >
                    {t.count}
                  </span>
                </div>
                {t.blurb && <p className="text-sm text-ink/55 mt-2 leading-relaxed">{text(t.blurb)}</p>}
              </Link>
            );
          })}
        </div>
      </section>
    </DictShell>
    </PageGate>
    </ProtectedContent>
  );
}
