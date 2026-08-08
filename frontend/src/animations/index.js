/**
 * Product animation class names + components.
 * CSS: loyalty.css (rewards) + kit.css (UI chrome) + motion.css (page/reveal).
 * Source kit: animations/csskit-ab2rahman-main/src/animations/
 */
export { default as AnimIconDivider } from './AnimIconDivider';
export { default as AnimChevron, AnimChevronToggle } from './AnimChevron';
export { default as AnimMatrixRain } from './AnimMatrixRain';
export { default as PageEnter } from './PageEnter';
export { default as TabCrossfade } from './TabCrossfade';
export { motion, motionClass } from './tokens';
export * as motionVariants from './motionVariants';
export { MotionDiv, MotionSpan, Stagger, motion as fmMotion } from './Motion';

export const anim = {
  // Loyalty / rewards
  chestBurst: 'loyalty-chest-burst',
  chestOpen: 'is-open',
  chestBody: 'loyalty-chest-burst__body',
  streakFlame: 'loyalty-streak-flame',
  streakDot: 'loyalty-streak-flame__dot',
  checkinPop: 'loyalty-checkin-pop',
  badgeShine: 'loyalty-badge-shine',
  badgeActive: 'is-active',
  pointsFloat: 'loyalty-points-float',
  progressFill: 'loyalty-progress-fill',
  progressBar: 'loyalty-progress-fill__bar',

  // UI kit
  iconDivider: 'anim-icon-divider',
  chevron: 'anim-chevron',
  chevronToggle: 'anim-chevron-toggle',
  breatheLine: 'anim-breathe-line',
  matrixRain: 'anim-matrix-rain',
  shine: 'anim-shine',
  shineParchment: 'anim-shine anim-shine--parchment',
  underlineGrow: 'anim-underline-grow',
  underlineParchment: 'anim-underline-grow anim-underline-grow--parchment',
  ruleDraw: 'anim-rule-draw',
  particles: 'anim-particles',

  // Motion layer (ANIMATSIYA-REJA)
  pageEnter: 'motion-page-enter',
  rise: 'motion-rise',
  reveal: 'motion-reveal',
  success: 'motion-success',
  gridPulse: 'motion-grid-pulse',
  chipStagger: 'motion-chip-stagger',
};

export default anim;
