/**
 * Sahifa kirish — Framer Motion stagger (CSS fallback class saqlanadi).
 */
import { MotionDiv, Stagger } from './Motion';
import { slideUp, staggerContainer } from './motionVariants';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

export default function PageEnter({ children, className = '', stagger = true }) {
  const reduce = usePrefersReducedMotion();
  const cls = ['motion-page-enter', stagger ? 'motion-page-enter--stagger' : '', className]
    .filter(Boolean)
    .join(' ');

  if (reduce) {
    return <div className={cls}>{children}</div>;
  }

  if (!stagger) {
    return (
      <MotionDiv className={cls} variants={slideUp}>
        {children}
      </MotionDiv>
    );
  }

  const kids = Array.isArray(children) ? children : [children];
  return (
    <Stagger className={cls} variants={staggerContainer}>
      {kids.map((child, i) => (
        <MotionDiv key={child?.key ?? i} variants={slideUp}>
          {child}
        </MotionDiv>
      ))}
    </Stagger>
  );
}
