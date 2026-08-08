/**
 * Tab kontenti — mode="wait" crossfade (reduce-motion da oddiy swap).
 */
import { AnimatePresence, motion } from 'framer-motion';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { fadeIn } from './motionVariants';

export default function TabCrossfade({ tabKey, className = '', children }) {
  const reduce = usePrefersReducedMotion();

  if (reduce) {
    return (
      <div key={tabKey} className={className}>
        {children}
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={tabKey}
        className={className}
        variants={fadeIn}
        initial="hidden"
        animate="show"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
