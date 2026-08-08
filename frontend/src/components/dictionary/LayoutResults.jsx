/**
 * Sozlik natijalari — layout animatsiya (filtrda sakramasın).
 */
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import usePrefersReducedMotion from '../../hooks/usePrefersReducedMotion';
import { slideUp } from '../../animations/motionVariants';

export default function LayoutResults({
  items,
  getKey,
  activeIdx = -1,
  activeRef = null,
  className = 'space-y-6',
  id = 'dict-results-list',
  children,
}) {
  const reduce = usePrefersReducedMotion();

  if (reduce) {
    return (
      <ul id={id} className={className}>
        {items.map((item, idx) => (
          <li
            key={getKey(item, idx)}
            id={`dict-result-${idx}`}
            ref={activeIdx === idx ? activeRef : null}
            className={
              activeIdx === idx
                ? 'ring-2 ring-teal-700/60 ring-offset-2 ring-offset-transparent rounded-2xl'
                : 'rounded-2xl'
            }
          >
            {children(item, idx)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <LayoutGroup id={id}>
      <ul id={id} className={className}>
        <AnimatePresence mode="popLayout" initial={false}>
          {items.map((item, idx) => (
            <motion.li
              key={getKey(item, idx)}
              id={`dict-result-${idx}`}
              ref={activeIdx === idx ? activeRef : null}
              layout
              variants={slideUp}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={{ layout: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
              className={`rounded-2xl ${
                activeIdx === idx
                  ? 'ring-2 ring-teal-700/60 ring-offset-2 ring-offset-transparent'
                  : ''
              }`}
            >
              {children(item, idx)}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </LayoutGroup>
  );
}
