import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import Icon from '../components/Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { ABOUT } from '../data/siteInfo';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { AnimIconDivider, AnimChevron, anim } from '../animations';

export default function About() {
  const { text } = useUiScript();
  usePageMeta(text(KAA.aboutTitle), text(ABOUT.lead));

  return (
    <DictShell className="pt-24 pb-28">
      <section className="relative mx-auto max-w-2xl px-5 pt-8 sm:px-6 md:px-10">
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-teal-800/70">
          {text(ABOUT.eyebrow)}
        </p>
        <h1 className="mb-2 font-display text-3xl tracking-tight text-ink sm:text-5xl">
          {text(ABOUT.title)}
        </h1>
        <AnimIconDivider amber className="mb-4" />
        <p className="mb-10 max-w-xl text-lg leading-relaxed text-ink/60">{text(ABOUT.lead)}</p>

        <div className="mb-12">
          <h2 className="mb-2 font-display text-2xl text-ink">{text(ABOUT.missionTitle)}</h2>
          <p className="leading-relaxed text-ink/65">{text(ABOUT.mission)}</p>
        </div>

        <div className="mb-12">
          <h2 className="mb-4 font-display text-2xl text-ink">{text(ABOUT.sectionsTitle)}</h2>
          <ul className="space-y-3">
            {ABOUT.sections.map((s) => (
              <li key={s.to}>
                <Link
                  to={s.to}
                  className="group flex items-start justify-between gap-3 border-b border-ink/10 py-3 transition hover:border-teal-700/30"
                >
                  <span>
                    <span className="block font-display text-xl text-ink group-hover:text-teal-900">
                      {text(s.title)}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink/55">{text(s.body)}</span>
                  </span>
                  <AnimChevron count={2} className="mt-2 opacity-40 group-hover:opacity-90" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-12">
          <h2 className="mb-3 font-display text-2xl text-ink">{text(ABOUT.principlesTitle)}</h2>
          <ul className="space-y-2">
            {ABOUT.principles.map((p) => (
              <li key={p.text}>
                <Link
                  to={p.to}
                  className="group flex items-start gap-2.5 rounded-2xl border border-transparent px-2 py-2.5 text-sm leading-relaxed text-ink/70 transition hover:border-teal-700/20 hover:bg-teal-50/50 hover:text-teal-950 sm:text-base"
                >
                  <Icon
                    name={p.icon || 'check'}
                    className="mt-0.5 shrink-0 text-teal-800 group-hover:text-teal-900"
                  />
                  <span className="flex-1">{text(p.text)}</span>
                  <AnimChevron count={2} className="mt-1 opacity-35 group-hover:opacity-90" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-5 qp-surface px-4 py-4">
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/60">
              {text(ABOUT.freePlayEyebrow)}
            </p>
            <FreePlayCtaRow links={FOOTER_FREE_LINKS} showSoftProfile />
          </div>
        </div>

        <div className="mb-10 qp-surface px-5 py-5">
          <h2 className="mb-2 font-display text-xl text-ink">{text(ABOUT.privacyTitle)}</h2>
          <p className="text-sm leading-relaxed text-ink/60">{text(ABOUT.privacy)}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/faq#guest"
            className={`${anim.shine} qp-btn-primary`}
          >
            {text(KAA.faqTitle)}
          </Link>
          <Link
            to="/community"
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/30 px-5 py-2.5 text-sm font-semibold text-teal-900"
          >
            <Icon name="users" /> {text(KAA.jamiyet)}
          </Link>
          <Link
            to="/profile"
            className="inline-flex items-center gap-1.5 rounded-full border border-teal-700/30 px-5 py-2.5 text-sm font-semibold text-teal-900"
          >
            <Icon name="user" /> {text(KAA.profil)}
          </Link>
          <Link to="/" className="inline-flex items-center text-sm font-semibold text-teal-900 hover:underline">
            {text(KAA.basBet)}
          </Link>
        </div>
      </section>
    </DictShell>
  );
}
