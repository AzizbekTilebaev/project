import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';
import { getGuestLocalWeekCells } from '../lib/guestLocalSummary';

/**
 * Guest local week grid + one primary CTA.
 * Stats empty / WeeklyReview — free-strip dump o‘rnına.
 */
export default function GuestLocalWeekPanel({
  local,
  className = '',
  dense = false,
  showPrimary = true,
  eyebrow = null,
}) {
  const { text } = useUiScript();
  const cells = useMemo(() => getGuestLocalWeekCells(local), [local]);

  if (!cells.length && !local?.primary) return null;

  return (
    <div className={className}>
      {eyebrow != null && cells.length > 0 && (
        <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-teal-800/55">
          {text(eyebrow)}
        </p>
      )}
      {cells.length > 0 && (
        <div
          className={`grid gap-2 ${
            dense ? 'grid-cols-3 sm:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {cells.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-ink/[0.06] bg-white/70 px-3 py-3 text-left"
            >
              <p className="mb-1 inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-wide text-ink/45">
                <Icon name={c.icon} className="text-teal-700/70" />
                {text(KAA[c.labelKey] || c.labelKey)}
              </p>
              <p className="font-display text-xl text-ink tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
      )}
      {showPrimary && local?.primary && (
        <div className={cells.length ? 'mt-4' : ''}>
          <Link
            to={local.primary.href}
            className={`${anim.shine} inline-flex items-center gap-2 rounded-full bg-teal-800 px-4 py-2.5 text-sm font-bold text-white`}
          >
            <Icon name={local.primary.icon} />
            {text(KAA[local.primary.labelKey] || local.primary.labelKey)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
        </div>
      )}
    </div>
  );
}
