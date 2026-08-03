import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';

const DEFAULT_PLAY = [
  { to: '/games', icon: 'trophy', labelKey: 'oyinlar' },
  { to: '/literature', icon: 'scroll', labelKey: 'adebiyat' },
];

/**
 * O‘yin tugashi — 1 asosiy play + ixtiyoriy secondary + Profil.
 * Adaptive/stats deep CTA yo‘q.
 */
export default function SoftNextRow({
  primaryTo = '/games',
  primaryIcon = 'trophy',
  primaryLabelKey = 'oyinlar',
  secondaryTo = '/literature',
  secondaryIcon = 'scroll',
  secondaryLabelKey = 'adebiyat',
  showProfile = true,
  extras = null,
  className = '',
}) {
  const { text } = useUiScript();

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${className}`.trim()}>
      <Link
        to={primaryTo}
        className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-4 py-2 text-xs font-bold text-white`}
      >
        <Icon name={primaryIcon} />
        {text(KAA[primaryLabelKey] || primaryLabelKey)}
        <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
      </Link>
      {secondaryTo ? (
        <Link
          to={secondaryTo}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
        >
          <Icon name={secondaryIcon} />
          {text(KAA[secondaryLabelKey] || secondaryLabelKey)}
        </Link>
      ) : null}
      {showProfile ? (
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
        >
          <Icon name="user" />
          {text(KAA.profil)}
        </Link>
      ) : null}
      {extras}
    </div>
  );
}

export { DEFAULT_PLAY };
