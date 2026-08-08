import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { LEGAL } from '../data/legalContent';

export default function Privacy() {
  const { text } = useUiScript();
  usePageMeta(text(LEGAL.privacyTitle), text(LEGAL.privacyLead));

  return (
    <DictShell className="pt-24 pb-28">
      <article className="mx-auto max-w-2xl px-5 pt-8 sm:px-6 md:px-10">
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-teal-800/70">
          {text(LEGAL.eyebrow)}
        </p>
        <h1 className="mb-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
          {text(LEGAL.privacyTitle)}
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-ink/55">{text(LEGAL.privacyLead)}</p>

        <div className="space-y-8">
          {LEGAL.privacySections.map((s) => (
            <section key={s.heading}>
              <h2 className="mb-2 font-display text-xl text-ink">{text(s.heading)}</h2>
              <p className="text-sm leading-relaxed text-ink/65">{text(s.body)}</p>
            </section>
          ))}
        </div>

        <p className="mt-10 text-sm text-ink/50">
          {text(LEGAL.seeAlso)}{' '}
          <Link to="/terms" className="font-semibold text-teal-900 hover:underline">
            {text(LEGAL.termsTitle)}
          </Link>
          {' · '}
          <Link to="/faq" className="font-semibold text-teal-900 hover:underline">
            {text(KAA.faqShort)}
          </Link>
        </p>
      </article>
    </DictShell>
  );
}
