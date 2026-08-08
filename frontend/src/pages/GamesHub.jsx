import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimIconDivider, AnimChevron, anim, PageEnter } from '../animations';

const FEATURED = [
  {
    to: '/quiz',
    icon: 'trophy',
    titleKey: 'testler',
    descKey: 'homeDoorQuizDesc',
    tone: 'from-teal-500 via-teal-600 to-emerald-700',
    orb: 'bg-teal-200/50',
  },
  {
    to: '/crossword',
    icon: 'grammar',
    titleKey: 'krossvord',
    descKey: 'homeDoorCrossDesc',
    tone: 'from-amber-400 via-orange-500 to-amber-600',
    orb: 'bg-amber-200/45',
  },
];

const MORE = [
  {
    to: '/dictionary/game',
    icon: 'gamepad',
    titleKey: 'sozOyinlari',
    descKey: 'homeDoorWordDesc',
    tone: 'from-sky-500 to-teal-600',
  },
  {
    to: '/tutor/practice',
    icon: 'bolt',
    titleKey: 'practiceNav',
    descKey: 'practiceBody',
    tone: 'from-teal-600 to-teal-800',
  },
  {
    to: '/quiz/adaptive',
    icon: 'chart',
    titleKey: 'adaptiv',
    descKey: 'hubTestlerDesc',
    tone: 'from-emerald-500 to-teal-700',
  },
];

/**
 * O‘yinlar hub — test + krossvord + sóz oyını.
 * Primary chrome’da alohida eshiklar yo‘q; hammasi shu yerdan.
 */
export default function GamesHub() {
  const { text } = useUiScript();
  usePageMeta(text(KAA.oyinlar), text(KAA.oyinlarHubBody));

  return (
    <DictShell className="pt-24 pb-24">
      <section className="relative mx-auto max-w-5xl px-6 pt-8 md:px-10">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink/45 transition-colors hover:text-teal-900"
        >
          <Icon name="left" /> {text(KAA.basBet)}
        </Link>

        <PageEnter>
        <div className="qp-section-head mb-10">
          <div>
            <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-teal-800/60">
              {text(KAA.oyinlarEyebrow)}
            </p>
            <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
              {text(KAA.oyinlar)}
            </h1>
            <AnimIconDivider amber className="mt-3 mb-1" />
            <p className="mt-4 max-w-xl text-base leading-7 text-ink/60">
              {text(KAA.oyinlarHubBody)}
            </p>
          </div>
          <Link to="/literature" className="qp-chip text-teal-900 no-underline">
            {text(KAA.adebiyat)}
            <AnimChevron count={1} className="opacity-60" />
          </Link>
        </div>

        {/* Featured doors */}
        <div className="qp-section-head">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/40">
              {text(KAA.homePlayEyebrow)}
            </p>
            <h2 className="font-display text-2xl tracking-tight text-ink">
              {text(KAA.homePlayTitle)}
            </h2>
          </div>
          <span className="qp-chip text-ink/55">{text(KAA.homeDoorBadge)}</span>
        </div>

        <div className="mb-12 grid gap-5 sm:grid-cols-2">
          {FEATURED.map((d) => (
            <Link
              key={d.to}
              to={d.to}
              className="qp-play-card group"
            >
              <div className={`qp-play-card__media bg-gradient-to-br ${d.tone}`}>
                <span className="qp-play-card__badge">
                  <Icon name="bolt" className="text-[0.75rem]" />
                  {text(KAA.homeDoorBadge)}
                </span>
                <div
                  className={`pointer-events-none absolute -right-6 -bottom-8 h-28 w-28 rounded-full ${d.orb} blur-2xl`}
                  aria-hidden
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/25 text-3xl text-white shadow-lg backdrop-blur-sm transition group-hover:scale-105">
                    <Icon name={d.icon} />
                  </span>
                </div>
              </div>
              <div className="qp-play-card__body">
                <p className="font-display text-xl tracking-tight text-ink group-hover:text-teal-900">
                  {text(KAA[d.titleKey] || d.titleKey)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink/55">
                  {text(KAA[d.descKey] || d.descKey)}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-ink/[0.06] pt-3">
                  <span className="text-xs font-medium text-ink/40">
                    {text(KAA.oyinlarEyebrow)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-teal-700">
                    {text(KAA.homeDoorCta)}
                    <AnimChevron count={2} className="opacity-70" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* More games grid */}
        <div className="qp-section-head">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink/40">
              {text(KAA.sozOyinlari)}
            </p>
            <h2 className="font-display text-2xl tracking-tight text-ink">
              {text(KAA.homePlaySeeAll)}
            </h2>
          </div>
          <Link to="/tutor/practice" className="qp-chip text-teal-900 no-underline">
            {text(KAA.practiceNav)}
            <AnimChevron count={1} className="opacity-60" />
          </Link>
        </div>

        <div className="motion-chip-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MORE.map((d) => (
            <Link
              key={d.to}
              to={d.to}
              className="qp-card group flex flex-col p-5 no-underline"
            >
              <span className={`qp-icon-tile mb-4 bg-gradient-to-br ${d.tone}`}>
                <Icon name={d.icon} />
              </span>
              <span className="font-display text-lg tracking-tight text-ink group-hover:text-teal-900">
                {text(KAA[d.titleKey] || d.titleKey)}
              </span>
              <span className="mt-1 flex-1 text-sm leading-relaxed text-ink/55">
                {text(KAA[d.descKey] || d.descKey)}
              </span>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-teal-800/70">
                {text(KAA.homeDoorCta)}
                <AnimChevron count={2} className="opacity-70" />
              </span>
            </Link>
          ))}
        </div>

        <div className="qp-panel mt-12 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/40">
              {text(KAA.adebiyat)}
            </p>
            <p className="mt-1 font-display text-xl text-ink">{text(KAA.homeDoorLitDesc)}</p>
          </div>
          <Link to="/literature" className={`${anim.shine} qp-btn-primary`}>
            {text(KAA.adebiyat)}
            <AnimChevron count={2} style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
        </div>
        </PageEnter>
      </section>
    </DictShell>
  );
}
