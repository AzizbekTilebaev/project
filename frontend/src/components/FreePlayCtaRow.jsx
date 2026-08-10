import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';
import { FOOTER_FREE_LINKS } from '../data/siteDeepLinks';

function toneClass(tone, compact, variant) {
  const pad = compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-xs';
  if (variant === 'ink') {
    if (tone === 'primary') {
      return `${anim.shineParchment} inline-flex items-center gap-1.5 rounded-xl bg-parchment ${pad} font-bold text-teal-950`;
    }
    if (tone === 'amber') {
      return `inline-flex items-center gap-1.5 rounded-xl border border-parchment/35 bg-white/10 ${pad} font-bold text-parchment`;
    }
    if (tone === 'soft') {
      return `inline-flex items-center gap-1.5 rounded-xl border border-parchment/25 ${pad} font-semibold text-parchment/80`;
    }
    return `inline-flex items-center gap-1.5 rounded-xl border border-parchment/35 bg-white/10 ${pad} font-bold text-parchment`;
  }
  if (tone === 'primary') {
    return `${anim.shine} inline-flex items-center gap-1.5 rounded-xl bg-teal-800 ${pad} font-bold text-white`;
  }
  if (tone === 'amber') {
    return `inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-50 ${pad} font-bold text-amber-950`;
  }
  if (tone === 'soft') {
    return `inline-flex items-center gap-1.5 rounded-xl border border-ink/15 bg-white/80 ${pad} font-semibold text-ink/70`;
  }
  return `inline-flex items-center gap-1.5 rounded-xl border border-teal-700/25 bg-white ${pad} font-bold text-teal-950`;
}

/**
 * Shared free-start CTA row — FAQ / Footer / recovery / Home / gates.
 * @param {{ to: string, labelKey: string, icon?: string, tone?: string }[]} [links]
 * @param {'default'|'ink'} [variant]
 * @param {() => void} [onNavigate]
 */
export default function FreePlayCtaRow({
  links = FOOTER_FREE_LINKS,
  showSoftProfile = false,
  showStats = false,
  className = '',
  compact = false,
  justify = 'start',
  variant = 'default',
  onNavigate,
}) {
  const { text } = useUiScript();
  const row = Array.isArray(links) ? links : FOOTER_FREE_LINKS;
  if (!row.length && !showSoftProfile && !showStats) return null;

  const justifyClass =
    justify === 'center' ? 'justify-center' : justify === 'end' ? 'justify-end' : '';

  const linkProps = onNavigate ? { onClick: onNavigate } : {};

  return (
    <div className={`flex flex-wrap gap-2 ${justifyClass} ${className}`.trim()}>
      {row.map((c) => (
        <Link
          key={`${c.to}-${c.labelKey}`}
          to={c.to}
          className={toneClass(c.tone, compact, variant)}
          {...linkProps}
        >
          {c.icon ? <Icon name={c.icon} /> : null}
          {text(KAA[c.labelKey] || c.labelKey)}
          {c.tone === 'primary' && !compact && variant !== 'ink' ? (
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          ) : null}
        </Link>
      ))}
      {showStats ? (
        <Link
          to="/profile"
          className={toneClass('soft', compact, variant)}
          {...linkProps}
        >
          <Icon name="user" /> {text(KAA.profil)}
        </Link>
      ) : null}
      {showSoftProfile ? (
        <Link to="/profile" className={toneClass('soft', compact, variant)} {...linkProps}>
          {text(KAA.profileGuestNav)}
        </Link>
      ) : null}
    </div>
  );
}
