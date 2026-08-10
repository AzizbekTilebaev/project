import { Link } from 'react-router-dom';
import FreePlayCtaRow from './FreePlayCtaRow';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { FOOTER_FAQ_JUMPS, FOOTER_FREE_LINKS, FOOTER_NAV } from '../data/siteDeepLinks';

/**
 * Sayt pastı — learn/play/more + sheksiz strip + FAQ hash jumps.
 */
export default function SiteFooter() {
  const { text } = useUiScript();

  return (
    <footer className="theme-focus-hide border-t border-ink/10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-10 sm:px-6 md:px-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-xl tracking-tight text-ink">{text(KAA.platformName)}</p>
            <p className="mt-1 text-sm text-ink/50">{text(KAA.footerTagline)}</p>
            <div className="mt-4">
              <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
                {text(KAA.footerFreeEyebrow)}
              </p>
              <FreePlayCtaRow links={FOOTER_FREE_LINKS} />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1">
              {FOOTER_FAQ_JUMPS.map((j) => (
                <Link
                  key={j.to}
                  to={j.to}
                  className="text-xs font-semibold text-teal-900/80 hover:underline"
                >
                  {text(KAA[j.labelKey] || j.labelKey)}
                </Link>
              ))}
            </div>
          </div>

          <nav
            aria-label={text(KAA.footerNav)}
            className="grid flex-1 grid-cols-2 gap-6 sm:grid-cols-3"
          >
            {FOOTER_NAV.map((col) => (
              <div key={col.id}>
                <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-ink/40">
                  {text(KAA[col.titleKey] || col.titleKey)}
                </p>
                <ul className="space-y-1.5 text-sm">
                  {col.links.map((l) => (
                    <li key={l.to}>
                      <Link to={l.to} className="text-ink/65 hover:text-teal-900">
                        {text(KAA[l.labelKey] || l.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
      <div className="border-t border-ink/5 px-5 py-4 text-center text-[0.7rem] text-ink/35 sm:px-6">
        {text(KAA.footerCopy)}
      </div>
    </footer>
  );
}
