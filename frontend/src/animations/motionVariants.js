/**
 * Qayta ishlatiladigan Framer Motion variants.
 * Faqat transform + opacity (Performance qoidasi).
 */
import { motion as tokens } from './tokens';

const ease = tokens.easeOut;
const easePop = tokens.easeSuccess;

/** Reduced motion: bir zumda final holat */
export const none = {
  hidden: { opacity: 1 },
  show: { opacity: 1 },
  exit: { opacity: 1 },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: tokens.normal / 1000, ease },
  },
  exit: { opacity: 0, transition: { duration: tokens.fast / 1000 } },
};

export const slideUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: tokens.normal / 1000, ease },
  },
  exit: { opacity: 0, y: -8, transition: { duration: tokens.fast / 1000 } },
};

export const slideDown = {
  hidden: { opacity: 0, y: -10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: tokens.normal / 1000, ease },
  },
};

export const slideFromRight = {
  hidden: { opacity: 0, x: 24 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: tokens.normal / 1000, ease },
  },
  exit: { opacity: 0, x: -16, transition: { duration: tokens.fast / 1000 } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: tokens.normal / 1000, ease: easePop },
  },
};

export const pop = {
  hidden: { scale: 1 },
  show: {
    scale: [1, 1.12, 1],
    transition: { duration: 0.35, ease: easePop },
  },
};

export const shake = {
  hidden: { x: 0 },
  show: {
    x: [0, -3, 3, -2, 2, 0],
    transition: { duration: 0.22 },
  },
};

export const staggerContainer = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const staggerFast = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

/** Route-level page fade (<200ms) */
export const pageFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.16, ease } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

export function pickVariants(reduceMotion, active) {
  return reduceMotion ? none : active;
}
