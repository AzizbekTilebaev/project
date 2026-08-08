import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../Icon';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';

export default function FavoriteButton({
  active,
  onToggle,
  size = 'md',
  className = '',
  labelAdd = 'Unatıw',
  labelRemove = 'Unatqanlardan alıw',
}) {
  const reduce = usePrefersReducedMotion();
  const sizeClass = size === 'lg' ? 'w-11 h-11 text-2xl' : 'w-9 h-9 text-xl';
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (active) setPulse((n) => n + 1);
  }, [active]);

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle?.();
      }}
      aria-pressed={active}
      aria-label={active ? labelRemove : labelAdd}
      title={active ? labelRemove : labelAdd}
      animate={
        reduce || !pulse
          ? undefined
          : { scale: [1, 1.18, 1] }
      }
      transition={{ duration: 0.28, ease: [0.34, 1.4, 0.64, 1] }}
      className={`inline-flex items-center justify-center rounded-full border transition-colors shrink-0 ${sizeClass} ${
        active
          ? 'border-teal-800/40 bg-teal-900 text-parchment'
          : 'border-ink/10 bg-white/50 text-ink/40 hover:text-teal-900 hover:border-teal-800/30'
      } ${className}`}
    >
      <Icon name="heart" filled={active} />
    </motion.button>
  );
}
