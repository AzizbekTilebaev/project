import { Link } from 'react-router-dom';
import usePageMeta from '../hooks/usePageMeta';
import DictShell from '../components/dictionary/DictShell';
import SearchAutocomplete from '../components/dictionary/SearchAutocomplete';
import FreePlayCtaRow from '../components/FreePlayCtaRow';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';

export default function NotFound() {
  const { text } = useUiScript();
  usePageMeta(text(KAA.notFoundTitle), text(KAA.notFoundMeta));

  return (
    <DictShell className="pt-24 pb-24">
      <section className="relative mx-auto max-w-3xl px-6 pt-16 text-center md:px-10">
        <div
          className="pointer-events-none absolute left-1/2 top-8 h-56 w-56 -translate-x-1/2 rounded-full bg-teal-400/15 blur-3xl"
          aria-hidden
        />
        <p className="relative mb-2 select-none bg-gradient-to-br from-teal-700 via-emerald-600 to-amber-500 bg-clip-text font-display text-[7rem] leading-none text-transparent opacity-30 md:text-[9rem]">
          404
        </p>
        <h1 className="mb-3 font-display text-3xl tracking-tight text-ink md:text-4xl">
          {text(KAA.notFoundTitle)}
        </h1>
        <p className="mx-auto mb-10 max-w-md text-lg leading-relaxed text-ink/60">
          {text(KAA.notFoundBody)}
        </p>

        <div className="mb-10 text-left">
          <SearchAutocomplete autoFocus />
        </div>

        <div className="mb-8 qp-surface px-4 py-5 text-left sm:text-center">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/60">
            {text(KAA.notFoundFreeEyebrow)}
          </p>
          <FreePlayCtaRow
            links={FOOTER_FREE_LINKS}
            showSoftProfile
            justify="center"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-3 text-sm">
          <Link
            to="/dictionary"
            className="qp-btn-primary uppercase tracking-wide"
          >
            {text(KAA.sozlik)}
          </Link>
          <Link
            to="/faq#guest"
            className="qp-btn-ghost font-semibold uppercase tracking-wide text-teal-900"
          >
            {text(KAA.faqShort)}
          </Link>
          <Link
            to="/"
            className="qp-btn-ghost font-semibold uppercase tracking-wide text-teal-900"
          >
            {text(KAA.basBet)}
          </Link>
        </div>
      </section>
    </DictShell>
  );
}
