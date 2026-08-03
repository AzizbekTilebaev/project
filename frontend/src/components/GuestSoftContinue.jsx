import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';
import { getGuestLocalSummary } from '../lib/guestLocalSummary';
import useResumeTick from '../hooks/useResumeTick';

/**
 * Auth / Settings / Header / Profile — bitta soft primary (free-strip dump emas).
 */
export default function GuestSoftContinue({
  className = '',
  titleKey = 'authGuestFreeTitle',
  bodyKey = null,
  showHome = false,
  compact = false,
  onNavigate,
  tabIndex,
}) {
  const { text } = useUiScript();
  const resumeTick = useResumeTick();
  const local = useMemo(() => getGuestLocalSummary(), [resumeTick]);
  const href = local.primary?.href || '/tutor/practice';
  const icon = local.primary?.icon || 'bolt';
  const labelKey = local.primary?.labelKey || 'practiceNav';

  return (
    <div
      className={
        className ||
        (compact
          ? ''
          : 'rounded-2xl border border-teal-700/15 bg-gradient-to-br from-teal-50/80 via-white to-amber-50/40 px-4 py-4')
      }
    >
      {titleKey ? (
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/60">
          {text(KAA[titleKey] || titleKey)}
        </p>
      ) : null}
      {bodyKey ? (
        <p className="mt-1 text-xs leading-relaxed text-ink/55">{text(KAA[bodyKey] || bodyKey)}</p>
      ) : null}
      <div className={`flex flex-wrap gap-2 ${titleKey || bodyKey ? 'mt-3' : ''}`}>
        <Link
          to={href}
          tabIndex={tabIndex}
          onClick={onNavigate}
          className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-3.5 py-1.5 text-xs font-bold text-white`}
        >
          <Icon name={icon} />
          {text(KAA[labelKey] || labelKey)}
          <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
        </Link>
        {showHome ? (
          <Link
            to="/"
            tabIndex={tabIndex}
            onClick={onNavigate}
            className="inline-flex items-center gap-1 rounded-full border border-ink/10 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-ink/65"
          >
            {text(KAA.authContinueGuest)}
            <AnimChevron count={2} className="opacity-60" />
          </Link>
        ) : null}
        <Link
          to="/profile"
          tabIndex={tabIndex}
          onClick={onNavigate}
          className="inline-flex items-center gap-1 rounded-full border border-teal-700/20 bg-white px-3.5 py-1.5 text-xs font-semibold text-teal-950"
        >
          {text(KAA.profileGuestNav)}
        </Link>
      </div>
    </div>
  );
}
