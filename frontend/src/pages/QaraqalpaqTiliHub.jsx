import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import ScriptToggle from '../components/literature/ScriptToggle';
import { t } from '../components/literature/litLabels';
import { useUiScript } from '../contexts/UiScriptContext';
import { AnimIconDivider, AnimChevron, anim, PageEnter } from '../animations';
import { KAA } from '../i18n/kaa';

const DOORS = [
  {
    to: '/literature/qagiydalar',
    titleKey: 'qagiydalar',
    descKey: 'qagiydalarCardDesc',
    icon: 'grammar',
    tone: 'from-amber-500 to-orange-600',
  },
];

/**
 * Kitapxana → Qaraqalpaq tili — til qaǵıydaları hám keyingi bólimler.
 */
export default function QaraqalpaqTiliHub() {
  const { script, setScript, text } = useUiScript();

  usePageMeta(t('qaraqalpaqTili', script), t('qaraqalpaqTiliIntro', script));

  return (
    <DictShell className="pt-24 pb-24">
      <section className="relative mx-auto max-w-3xl px-6 pt-8 md:px-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/literature"
            className="inline-flex items-center gap-1.5 text-sm text-ink/45 transition-colors hover:text-teal-900"
          >
            <Icon name="left" /> {t('literatureBack', script)}
          </Link>
          <ScriptToggle value={script} onChange={setScript} />
        </div>

        <PageEnter>
          <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-teal-800/60">
            {t('litCenter', script)}
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink md:text-5xl">
            {t('qaraqalpaqTili', script)}
          </h1>
          <AnimIconDivider amber className="mt-3 mb-1" />
          <p className="mt-4 max-w-xl text-base leading-7 text-ink/60">
            {t('qaraqalpaqTiliIntro', script)}
          </p>

          <div className="mt-10 space-y-4">
            {DOORS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="qp-door group relative block overflow-hidden rounded-[1.75rem] p-6 no-underline"
              >
                <span className={`qp-icon-tile mb-5 bg-gradient-to-br ${item.tone}`}>
                  <Icon name={item.icon} />
                </span>
                <h2 className="font-display text-2xl tracking-tight text-ink group-hover:text-teal-900">
                  {t(item.titleKey, script)}
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink/55">{t(item.descKey, script)}</p>
                <span
                  className={`${anim.shine} mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-800/70`}
                >
                  {text(KAA.qoidalarShort)}
                  <AnimChevron count={2} className="opacity-70" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-2">
            <Link
              to="/dictionary"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
            >
              <Icon name="book" /> {text(KAA.sozlik)}
            </Link>
            <Link
              to="/quiz"
              className={`${anim.shine} qp-btn-primary !px-4 !py-2 !text-xs`}
            >
              <Icon name="trophy" /> {text(KAA.faqTryQuiz)}
            </Link>
          </div>
        </PageEnter>
      </section>
    </DictShell>
  );
}
