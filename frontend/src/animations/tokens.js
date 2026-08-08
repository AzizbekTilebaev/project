/**
 * Motion tokens — ANIMATSIYA-REJA.md
 * CSS variables: frontend/src/animations/motion.css (--motion-*)
 */
export const motion = {
  fast: 180,
  normal: 280,
  slow: 420,
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeSuccess: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
};

export const motionClass = {
  pageEnter: 'motion-page-enter',
  rise: 'motion-rise',
  reveal: 'motion-reveal',
  success: 'motion-success',
  gridPulse: 'motion-grid-pulse',
  chipStagger: 'motion-chip-stagger',
};

export default motion;
