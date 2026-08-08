import { Link } from 'react-router-dom';
import Icon from './Icon';
import { useUiScript } from '../contexts/UiScriptContext';
import { KAA } from '../i18n/kaa';
import { AnimChevron, anim } from '../animations';
import { MotionDiv, Stagger } from '../animations/Motion';
import { scaleIn, staggerFast, slideUp } from '../animations/motionVariants';

/**
 * O‘yin tugashi — SoftNext kartalar (konsistent stagger).
 */
const DEFAULT_PLAY = [
  { to: '/games', icon: 'trophy', labelKey: 'oyinlar' },
  { to: '/literature', icon: 'scroll', labelKey: 'adebiyat' },
];

export default function SoftNextCard({
  primaryTo = '/games',
  primaryIcon = 'trophy',
  primaryLabelKey = 'oyinlar',
  secondaryTo = '/literature',
  secondaryIcon = 'scroll',
  secondaryLabelKey = 'adebiyat',
  showProfile = true,
  extras = null,
  title,
  className = '',
}) {
  const { text } = useUiScript();

  return (
    <MotionDiv variants={scaleIn} className={`w-full max-w-md ${className}`.trim()}>
      {title ? (
        <p className="mb-3 text-center text-sm font-semibold text-ink/70">{title}</p>
      ) : null}
      <Stagger variants={staggerFast} className="flex flex-wrap items-center justify-center gap-2">
        <MotionDiv variants={slideUp}>
          <Link
            to={primaryTo}
            className={`${anim.shine} inline-flex items-center gap-1.5 rounded-full bg-teal-800 px-4 py-2 text-xs font-bold text-white`}
          >
            <Icon name={primaryIcon} />
            {text(KAA[primaryLabelKey] || primaryLabelKey)}
            <AnimChevron count={2} className="opacity-80" style={{ ['--dch-color']: '#ecfdf5' }} />
          </Link>
        </MotionDiv>
        {secondaryTo ? (
          <MotionDiv variants={slideUp}>
            <Link
              to={secondaryTo}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-950"
            >
              <Icon name={secondaryIcon} />
              {text(KAA[secondaryLabelKey] || secondaryLabelKey)}
            </Link>
          </MotionDiv>
        ) : null}
        {showProfile ? (
          <MotionDiv variants={slideUp}>
            <Link
              to="/profile"
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-4 py-2 text-xs font-bold text-ink/70"
            >
              <Icon name="user" />
              {text(KAA.profil)}
            </Link>
          </MotionDiv>
        ) : null}
        {extras ? <MotionDiv variants={slideUp}>{extras}</MotionDiv> : null}
      </Stagger>
    </MotionDiv>
  );
}

export { DEFAULT_PLAY };
