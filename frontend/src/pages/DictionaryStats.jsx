import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import useDictionaryFavorites from '../hooks/useDictionaryFavorites';
import useRecentWords from '../hooks/useRecentWords';
import PageGate from '../components/PageGate';
import ProtectedContent from '../components/ProtectedContent';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyQuotas } from '../api/quotas';
import { fetchDictQuizHistory, fetchDashboard } from '../api/tusindirme';
import { AnimChevron, anim } from '../animations';
import { KAA } from '../i18n/kaa';
import { recentPracticeHref } from '../lib/recentPractice';
import { getGuestLocalSummary } from '../lib/guestLocalSummary';
import useResumeTick from '../hooks/useResumeTick';
import GuestLocalWeekPanel from '../components/GuestLocalWeekPanel';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';

export default function DictionaryStats() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { items: favorites, count: favCount } = useDictionaryFavorites();
  const { items: recent, count: recentCount, clear: clearRecent } = useRecentWords();
  const recentPlayHref = recentPracticeHref(recent);
  const resumeTick = useResumeTick();
  const guestLocal = useMemo(() => getGuestLocalSummary(), [resumeTick]);

  usePageMeta(
    text('Sózlik statistikası'),
    text('Kórilgen sózler, unatqanlar hám oyın nátiyjeleri.')
  );

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle(
        {},
        {
          quotas: () => fetchMyQuotas(),
          dash: async () => {
            const res = await fetchDashboard();
            return res.data || null;
          },
          gameHistory: async () => {
            const res = await fetchDictQuizHistory(10);
            return res.rounds || res.history || res.data || [];
          },
        }
      ),
    { deps: [isAuthenticated] }
  );

  const quotas = data?.quotas || null;
  const dash = data?.dash || null;
  const gameHistory = Array.isArray(data?.gameHistory) ? data.gameHistory : [];
  const wordViews = Number(quotas?.wordViews) || 0;
  const topWords = dash?.topWords || dash?.top || [];
  const isTrueEmpty = !favCount && !recentCount && !gameHistory.length;

  return (
    <ProtectedContent>
      <PageGate
        status={status}
        error={error}
        onRetry={reload}
        backHref="/dictionary"
        backLabel={text('Sózlik')}
      >
        <DictShell className="pt-24 pb-24">
          <section className="relative mx-auto max-w-3xl px-6 md:px-10 pt-8">
            <Link
              to="/dictionary"
              className="mb-6 inline-flex items-center gap-2 text-sm text-ink/45 hover:text-teal-900 transition-colors"
            >
              ← {text('Sózlik')}
            </Link>

            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ink/40 mb-1">
                  {text('Sózlik')}
                </p>
                <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight">
                  {text('Statistika')}
                </h1>
                <p className="mt-2 text-ink/55">
                  {text('Sizdiń sózlik boyınsha iskerligińiz.')}
                </p>
              </div>
              <Link
                to="/quiz/statistics"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-900 hover:underline"
              >
                {text('Tolıq statistika')}
                <AnimChevron count={2} className="opacity-70" />
              </Link>
            </div>

            <div className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                tone="rose"
                icon="heart"
                label={text('Unatqanlar')}
                value={String(favCount)}
                href="/dictionary/favorites"
              />
              <StatCard
                tone="teal"
                icon="book"
                label={text('Jaqında')}
                value={String(recentCount)}
                href={recentPlayHref || undefined}
                hint={recentCount > 0 ? text(KAA.recentMashq) : undefined}
              />
              <StatCard
                tone="amber"
                icon="eye"
                label={text('Kórilgen sózler')}
                value={String(wordViews || '—')}
                hint={text('Sheksiz oqıw')}
              />
              <StatCard
                tone="cyan"
                icon="gamepad"
                label={text('Sóz oyını')}
                value={String(gameHistory.length)}
                href={recentPlayHref || '/dictionary/game'}
                hint={recentCount > 0 ? text(KAA.recentMashq) : text('Sońǵı 10')}
              />
            </div>

            {recentCount > 0 && (
              <section className="mb-12">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <h2 className="font-display text-2xl text-ink">{text('Jaqında kórilgen')}</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    {recentPlayHref && (
                      <Link
                        to={recentPlayHref}
                        className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white`}
                      >
                        <Icon name="bolt" /> {text(KAA.mashqEtiw)}
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="text-sm text-ink/40 hover:text-rose-800"
                    >
                      {text('Tazalaw')}
                    </button>
                  </div>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {recent.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={`/dictionary/${item.id}`}
                        className="inline-flex items-baseline gap-2 rounded-full border border-ink/10 bg-white/50 px-4 py-2 transition-colors hover:bg-teal-900 hover:text-parchment"
                      >
                        <span className="font-display text-lg">{text(item.soz)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {favCount > 0 && (
              <section className="mb-12">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <h2 className="font-display text-2xl text-ink">{text('Unatqanlar')}</h2>
                  <Link
                    to="/dictionary/favorites"
                    className="inline-flex items-center gap-1.5 text-sm text-teal-900 hover:underline"
                  >
                    {text('Hámmesi')}
                    <AnimChevron count={2} className="opacity-60" />
                  </Link>
                </div>
                <ul className="divide-y divide-ink/10 qp-card qp-card--static">
                  {favorites.slice(0, 8).map((item) => (
                    <li key={item.id}>
                      <Link
                        to={`/dictionary/${item.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-teal-50/50"
                      >
                        <span className="font-display text-xl text-ink">{text(item.soz)}</span>
                        {item.category && (
                          <span className="text-[0.65rem] uppercase tracking-wider text-ink/40">
                            {text(item.category)}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {Array.isArray(topWords) && topWords.length > 0 && (
              <section className="mb-12">
                <h2 className="mb-4 font-display text-2xl text-ink">{text('Kóp kórilgen (sayt)')}</h2>
                <ol className="space-y-2">
                  {topWords.slice(0, 8).map((w, i) => (
                    <li key={w.id || i}>
                      <Link
                        to={w.id ? `/dictionary/${w.id}` : '/dictionary'}
                        className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white/40 px-4 py-2.5 hover:border-teal-700/30"
                      >
                        <span className="w-6 text-sm font-bold text-ink/35">{i + 1}</span>
                        <span className="font-display text-lg text-ink">{text(w.soz || w.title)}</span>
                        {w.views_count != null && (
                          <span className="ml-auto text-xs text-ink/40">
                            {Number(w.views_count).toLocaleString('kk')}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {gameHistory.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-4 font-display text-2xl text-ink">{text('Oyın nátiyjeleri')}</h2>
                <ul className="space-y-2">
                  {gameHistory.slice(0, 8).map((round) => (
                    <li
                      key={round.id}
                      className="flex items-center justify-between rounded-xl border border-ink/10 bg-white/40 px-4 py-3 text-sm"
                    >
                      <span className="text-ink/70">
                        {round.completedAt || round.createdAt
                          ? new Date(round.completedAt || round.createdAt).toLocaleDateString('kk')
                          : '—'}
                      </span>
                      <span className="font-semibold text-ink">
                        {round.score ?? 0}/{round.total ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isTrueEmpty && (
              <div className="qp-surface border-dashed px-6 py-10 text-center">
                <Icon name="sparkle" className="mb-3 text-3xl text-teal-800" />
                <h2 className="mb-2 font-display text-2xl text-ink">{text(KAA.dictStatsEmptyTitle)}</h2>
                <p className="mx-auto mb-5 max-w-md text-sm text-ink/50">{text(KAA.dictStatsEmptyHint)}</p>

                {guestLocal.hasLocal ? (
                  <GuestLocalWeekPanel
                    local={guestLocal}
                    className="mb-5 text-left"
                    eyebrow={KAA.dictStatsEmptyLocal}
                  />
                ) : null}
                <FreePlayCtaRow
                  links={FOOTER_FREE_LINKS}
                  showSoftProfile
                  justify="center"
                  className={guestLocal.hasLocal ? 'mt-4' : ''}
                />
              </div>
            )}
          </section>
        </DictShell>
      </PageGate>
    </ProtectedContent>
  );
}

function StatCard({ tone, icon, label, value, href, hint }) {
  const tones = {
    rose: 'from-rose-50 to-pink-50/60 border-rose-200/60 text-rose-800',
    teal: 'from-teal-50 to-emerald-50/60 border-teal-200/60 text-teal-900',
    amber: 'from-amber-50 to-orange-50/60 border-amber-200/60 text-amber-900',
    cyan: 'from-cyan-50 to-teal-50/60 border-cyan-200/60 text-cyan-900',
  };
  const className = `qp-card block bg-gradient-to-br px-4 py-4 ${tones[tone] || tones.teal}`;
  const body = (
    <>
      <span className="mb-2 inline-flex text-xl opacity-80">
        <Icon name={icon} filled={icon === 'heart'} />
      </span>
      <p className="text-[0.65rem] uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="font-display text-3xl tracking-tight mt-1">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-60">{hint}</p>}
    </>
  );
  if (href) {
    return (
      <Link to={href} className={`${className} transition hover:-translate-y-0.5`}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}
