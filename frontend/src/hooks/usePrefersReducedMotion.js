/**
 * OS "reduce motion" — Framer Motion useReducedMotion + CSS sinxron.
 */
import { useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';

export default function usePrefersReducedMotion() {
  const reduce = useReducedMotion();

  useEffect(() => {
    try {
      document.documentElement.classList.toggle('qp-reduce-motion', Boolean(reduce));
    } catch {
      /* ignore */
    }
  }, [reduce]);

  return Boolean(reduce);
}

export { useReducedMotion };
