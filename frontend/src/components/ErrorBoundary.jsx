import { Component } from 'react';
import { Link } from 'react-router-dom';
import { KAA } from '../i18n/kaa';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';
import FreePlayCtaRow from './FreePlayCtaRow';

/**
 * Route / UI qulawlarini ushlaydi — bo‘sh oq ekran o‘rniga qayta urinish + free mashq.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message ? String(error.message).slice(0, 180) : '',
    };
  }

  componentDidCatch(error, info) {
    try {
      console.error('[ErrorBoundary]', error, info?.componentStack);
    } catch {
      /* ignore */
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = this.props.text || ((s) => s);
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-rose-800/70">
          {t(KAA.qatelik)}
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-ink">
          {t(KAA.betQuladi)}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/55">{t(KAA.betQuladiTush)}</p>
        {this.state.message ? (
          <p className="mt-3 max-w-sm break-words rounded-xl bg-ink/[0.04] px-3 py-2 font-mono text-[11px] text-ink/45">
            {this.state.message}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-full bg-teal-900 px-5 py-2.5 text-sm font-semibold text-white"
          >
            {t(KAA.qaytaUriniw)}
          </button>
          <Link
            to="/"
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink/70 hover:text-teal-900"
            onClick={this.handleRetry}
          >
            {t(KAA.basBet)}
          </Link>
        </div>

        <div className="mt-8 w-full max-w-sm rounded-2xl border border-teal-700/15 bg-gradient-to-br from-teal-50/80 via-white to-amber-50/40 px-4 py-4">
          <p className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/60">
            {t(KAA.errorTryFree)}
          </p>
          <FreePlayCtaRow
            links={FOOTER_FREE_LINKS}
            justify="center"
            onNavigate={this.handleRetry}
          />
        </div>
      </div>
    );
  }
}
