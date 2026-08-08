import { useEffect, useState } from 'react';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

/** Ball/streak — 0→N sanalish (reduce-motion da darhol N). */
export default function CountUp({ value = 0, durationMs = 600, className = '' }) {
  const reduce = usePrefersReducedMotion();
  const target = Number(value) || 0;
  const [n, setN] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setN(target);
      return undefined;
    }
    let raf = 0;
    const t0 = performance.now();
    const from = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - (1 - p) ** 3;
      setN(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduce]);

  return <span className={className}>{n}</span>;
}
