/**
 * Framer Motion wrapper — reduce-motion da animatsiyasiz.
 */
import { motion } from 'framer-motion';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { none, pickVariants } from './motionVariants';

export function MotionDiv({
  variants,
  initial = 'hidden',
  animate = 'show',
  exit,
  children,
  ...rest
}) {
  const reduce = usePrefersReducedMotion();
  const v = pickVariants(reduce, variants || none);
  return (
    <motion.div
      variants={v}
      initial={reduce ? false : initial}
      animate={animate}
      exit={reduce ? undefined : exit}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function MotionSpan(props) {
  const reduce = usePrefersReducedMotion();
  const { variants, initial = 'hidden', animate = 'show', exit, children, ...rest } = props;
  const v = pickVariants(reduce, variants || none);
  return (
    <motion.span
      variants={v}
      initial={reduce ? false : initial}
      animate={animate}
      exit={reduce ? undefined : exit}
      {...rest}
    >
      {children}
    </motion.span>
  );
}

export function Stagger({ variants, className = '', children, ...rest }) {
  const reduce = usePrefersReducedMotion();
  if (reduce) {
    return (
      <div className={className} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="show"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export { motion };
