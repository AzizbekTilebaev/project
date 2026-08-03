import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import usePageData, { loadPageBundle } from '../hooks/usePageData';
import PageGate from '../components/PageGate';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { fetchCrosswords, fetchMyCrosswordStats } from '../api/crosswords';
import { useGuestQuota } from '../hooks/useGuestQuota';
import { AnimIconDivider, AnimChevron, anim } from '../animations';
import { KAA } from '../i18n/kaa';
import { useMemo } from 'react';
import {
  clearCrosswordContinue,
  getCrosswordPracticeMeta,
  getContinueCrossword,
} from '../lib/crosswordProgress';
import useResumeTick from '../hooks/useResumeTick';
import GuestSoftContinue from '../components/GuestSoftContinue';
import { useAuth } from '../contexts/AuthContext';

const DIFFICULTY_META = {
  'Ápiwayı': {
    chip: 'bg-emerald-100 text-emerald-800',
    medallion: 'bg-gradient-to-br from-teal-500 to-emerald-600',
    bar: 'from-teal-400 to-emerald-500',
    ring: 'hover:border-teal-600/40',
  },
  Orta: {
    chip: 'bg-amber-100 text-amber-800',
    medallion: 'bg-gradient-to-br from-amber-400 to-orange-600',
    bar: 'from-amber-400 to-orange-500',
    ring: 'hover:border-amber-500/40',
  },
  Qıyın: {
    chip: 'bg-rose-100 text-rose-700',
    medallion: 'bg-gradient-to-br from-rose-500 to-pink-700',
    bar: 'from-rose-400 to-pink-600',
    ring: 'hover:border-rose-500/40',
  },
};

const DEFAULT_META = DIFFICULTY_META['Ápiwayı'];

export default function CrosswordsList() {
  const { text } = useUiScript();
  const { isAuthenticated } = useAuth();
  const { requireCrossword, GateModal } = useGuestQuota();
  usePageMeta(
    text('Krossvordlar'),
    text('Qaraqalpaq tili boyınsha krossvordlar — sózlerdi tabıń.')
  );

  const { status, data, error, reload } = usePageData(
    () =>
      loadPageBundle(
        {
          crosswords: async () => {
            const res = await fetchCrosswords();
            return res.crosswords || [];
          },
        },
        {
          stats: async () => {
            const res = await fetchMyCrosswordStats(12);
            return res.stats || [];
          },
        }
      ),
    { deps: [] }
  );

  const crosswords = data?.crosswords || [];
  const stats = data?.stats || [];

  const soloDone = stats.filter((s) => s.mode === 'solo' && s.completed).length;
  const coopDone = stats.filter((s) => s.mode === 'coop').length;
  const competitiveWins = stats.filter((s) => s.mode === 'competitive' && s.completed).length;
  const crosswordMeta = useMemo(() => getCrosswordPracticeMeta(), []);
  const resumeTick = useResumeTick();
  const continueCrossword = useMemo(() => getContinueCrossword(), [resumeTick]);

  return (
    <>
    {GateModal}
    <PageGate status={status} error={error} onRetry={reload} backHref="/games" backLabel={text(KAA.oyinlar)}>
      <DictShell className="pt-24 pb-24">
        <section className="relative max-w-3xl mx-auto px-6 md:px-10 pt-8">
          <p className="text-[0.7rem] uppercase tracking-[0.22em] text-teal-800/70 mb-2">
            {text('Sóz oyınları')}
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-ink tracking-tight mb-2">
            {text('Krossvordlar')}
          </h1>
          <AnimIconDivider className="mb-4" />
          <p className="mb-8 max-w-xl text-lg leading-relaxed text-ink/55">
            {text(KAA.guestCrossword)}. {text('Sorawlar boyınsha sózlerdi tabıń.')}
          </p>

          {continueCrossword && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <Link
                to={continueCrossword.href}
                onClick={(e) => {
                  if (!requireCrossword()) e.preventDefault();
                }}
                className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-sky-800 px-4 py-2.5 text-sm font-bold text-white`}
              >
                <Icon name="grammar" />{' '}
                {text(KAA.continueCrossword)}
                {continueCrossword.title ? (
                  <span className="max-w-[10rem] truncate font-semibold opacity-90">
                    · {text(continueCrossword.title)}
                  </span>
                ) : null}
                {continueCrossword.solvedCells > 0 ? (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                    {text(KAA.continueCrosswordCells).replace(
                      '{n}',
                      String(continueCrossword.solvedCells)
                    )}
                  </span>
                ) : null}
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
              <button
                type="button"
                onClick={() => clearCrosswordContinue(continueCrossword.id)}
                className="rounded-full border border-ink/15 bg-white px-3.5 py-2 text-xs font-semibold text-ink/55 hover:text-teal-900"
              >
                {text(KAA.crosswordAbandon)}
              </button>
            </div>
          )}

          {crosswordMeta.practiceCount > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {crosswordMeta.streak > 0 && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-50 px-3.5 py-2 text-xs font-bold text-orange-950 ${anim.streakFlame}`}>
                  <span className={anim.streakDot} aria-hidden />
                  {text(KAA.crosswordStreak)} {crosswordMeta.streak}
                </span>
              )}
              <Link
                to="/games"
                className={`${anim.shine} qp-btn-primary`}
              >
                <Icon name="trophy" /> {text(KAA.oyinlar)}
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {crosswordMeta.practiceCount}
                </span>
                <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
              </Link>
            </div>
          )}

          {crosswordMeta.practiceCount === 0 && crosswordMeta.streak > 0 && (
            <div className="mb-6">
              <span className={`inline-flex items-center gap-1.5 rounded-full border border-orange-400/35 bg-orange-50 px-4 py-2.5 text-sm font-bold text-orange-950 ${anim.streakFlame}`}>
                <span className={anim.streakDot} aria-hidden />
                {text(KAA.crosswordStreak)} {crosswordMeta.streak}
              </span>
            </div>
          )}

          {crosswordMeta.practiceCount === 0 &&
            crosswordMeta.streak === 0 &&
            !continueCrossword &&
            crosswords.length > 0 && (
            <div className="mb-6">
              <a
                href="#crossword-list"
                className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
              >
                <Icon name="grammar" /> {text(KAA.crosswordColdPick)}
              </a>
            </div>
          )}

          <div className="mb-8 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-teal-800/10 bg-teal-50/40 px-3 py-3 text-center">
              <p className="font-display text-xl text-teal-900">{soloDone}</p>
              <p className="text-[0.65rem] text-ink/50">{text('Jalǵız')}</p>
            </div>
            <div className="rounded-2xl border border-teal-800/10 bg-teal-50/30 px-3 py-3 text-center">
              <p className="font-display text-xl text-teal-900">{coopDone}</p>
              <p className="text-[0.65rem] text-ink/50">{text('Birgelik')}</p>
            </div>
            <div className="rounded-2xl border border-amber-600/10 bg-amber-50/40 px-3 py-3 text-center">
              <p className="font-display text-xl text-amber-900">{competitiveWins}</p>
              <p className="text-[0.65rem] text-ink/50">{text('Jarıs')}</p>
            </div>
          </div>

          <div className="mb-10">
            <Link
              to="/crossword/room"
              onClick={(e) => {
                if (!requireCrossword()) e.preventDefault();
              }}
              className="inline-flex items-center gap-3 rounded-2xl border border-teal-800/15 bg-teal-50/50 px-5 py-4 transition-colors hover:bg-teal-50"
            >
              <Icon name="users" className="text-2xl text-teal-800/80" />
              <span>
                <span className="block font-display text-xl tracking-tight text-ink">
                  {text('Kóp oyınshılı xona')}
                </span>
                <span className="block text-sm text-ink/55">
                  {text('Birgelik yamasa jarıs rejiminde')}
                </span>
              </span>
              <AnimChevron count={2} className="ml-auto opacity-60" />
            </Link>
          </div>

          {crosswords.length === 0 && (
            <div className="mb-8 qp-surface border-dashed px-6 py-10 text-center">
              <p className="text-ink/55">{text('Házirshe krossvord joq.')}</p>
              <p className="mt-2 text-sm text-ink/45">{text(KAA.crosswordColdEmptyHint)}</p>
              <Link
                to="/games"
                className={`${anim.shine} mt-5 qp-btn-primary !px-4 !py-2 !text-xs`}
              >
                <Icon name="trophy" /> {text(KAA.oyinlar)}
              </Link>
              {!isAuthenticated ? (
                <GuestSoftContinue
                  className="mx-auto mt-3 max-w-md text-left"
                  titleKey={null}
                  bodyKey="authGuestFreeBody"
                  compact
                />
              ) : null}
            </div>
          )}

          <div id="crossword-list" className="grid scroll-mt-28 gap-5">
            {crosswords.map((cw, i) => {
              const meta = DIFFICULTY_META[cw.difficulty] || DEFAULT_META;
              const wordCount = cw.config?.WordsData?.length || 0;
              return (
                <Link
                  key={cw.id}
                  to={`/crossword/${cw.id}`}
                  style={{ animationDelay: `${i * 0.08}s` }}
                  className={`quiz-card-shine animate-dict-row group text-left qp-panel px-6 py-6 md:px-8 transition-all duration-300 hover:-translate-y-1 hover:bg-white/85 hover:shadow-[0_24px_60px_-25px_rgba(28,42,36,0.5)] ${meta.ring}`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`shrink-0 w-14 h-14 rounded-2xl ${meta.medallion} text-white inline-flex items-center justify-center text-2xl shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                    >
                      <Icon name="grammar" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 mb-2.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] ${meta.chip}`}
                        >
                          {text(cw.difficulty)}
                        </span>
                        <span className="rounded-full bg-ink/[0.06] px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink/60">
                          {wordCount} {text('sóz')}
                        </span>
                      </span>
                      <span className="block font-display text-2xl text-ink tracking-tight group-hover:text-teal-900 transition-colors mb-1.5">
                        {text(cw.title)}
                      </span>
                      <span className="block text-ink/55 leading-relaxed">{text(cw.description)}</span>
                      <span
                        className={`mt-4 block h-1 w-16 rounded-full bg-gradient-to-r ${meta.bar} transition-all duration-300 group-hover:w-28`}
                        aria-hidden
                      />
                    </span>
                    <AnimChevron
                      count={2}
                      className="hidden sm:inline-flex shrink-0 self-center opacity-40 group-hover:opacity-90"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </DictShell>
    </PageGate>
    </>
  );
}
