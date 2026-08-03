import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DictShell from './dictionary/DictShell';
import Icon from './Icon';
import FreePlayCtaRow from './FreePlayCtaRow';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import { BACK_ONLINE_EVENT } from '../lib/networkRecovery';

/**
 * Full-page gate: content only renders when status === 'ready'.
 * Loading / error replace the page body so partial data never flashes.
 */
export default function PageGate({
  status = 'loading',
  error = null,
  onRetry,
  children,
  className = 'pt-24 pb-24',
  loadingLabel = 'Júklenip atır…',
  errorTitle = 'Maǵlıwmat júklenbedi',
  backHref,
  backLabel,
}) {
  const { text } = useUiScript();
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    if (status !== 'error') {
      setBackOnline(false);
      return undefined;
    }
    const onBack = () => setBackOnline(true);
    window.addEventListener(BACK_ONLINE_EVENT, onBack);
    return () => window.removeEventListener(BACK_ONLINE_EVENT, onBack);
  }, [status]);

  // usePageData BACK_ONLINE da o‘zi reload qiladi; bu yerda faqat hint

  if (status === 'loading') {
    return (
      <DictShell className={className}>
        <div className="relative mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 text-center">
          <div className="qp-surface w-full max-w-sm px-6 py-10">
          <span className="qp-icon-tile mb-5 bg-gradient-to-br from-teal-600 to-emerald-700">
            <Icon name="loader" className="animate-spin" />
          </span>
          <p className="font-display text-2xl tracking-tight text-ink">{text(loadingLabel)}</p>
          <p className="mt-2 text-sm text-ink/45">
            {text('Tolıq maǵlıwmat kelgennen keyin ashıladı')}
          </p>
          </div>
        </div>
      </DictShell>
    );
  }

  if (status === 'error') {
    return (
      <DictShell className={className}>
        <div className="relative mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 text-center">
          <div className="qp-surface w-full max-w-sm px-6 py-8">
          <span className="qp-icon-tile mb-5 bg-rose-100 !text-rose-700 !shadow-none">
            <Icon name="x-circle" />
          </span>
          <p className="mb-2 font-display text-2xl tracking-tight text-ink">{text(errorTitle)}</p>
          <p className="mb-2 text-sm text-ink/55">{text(error || 'Belgisiz qátelik')}</p>
          {backOnline && (
            <p className="mb-6 rounded-full border border-emerald-600/25 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950">
              {text(KAA.offlineRetryHint)}
            </p>
          )}
          {!backOnline && <div className="mb-6" />}
          <div className="flex flex-wrap justify-center gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="qp-btn-primary"
              >
                {text(KAA.qaytaUriniw)}
              </button>
            )}
            {backHref && (
              <Link
                to={backHref}
                className="qp-btn-ghost"
              >
                {text(backLabel || 'Artqa')}
              </Link>
            )}
          </div>

          <div className="mt-8 w-full qp-card qp-card--static px-4 py-4">
            <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/60">
              {text(KAA.errorTryFree)}
            </p>
            <FreePlayCtaRow links={FOOTER_FREE_LINKS} justify="center" />
          </div>
          </div>
        </div>
      </DictShell>
    );
  }

  return children;
}
