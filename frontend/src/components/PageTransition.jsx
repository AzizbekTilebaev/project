import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, Routes } from 'react-router-dom';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';
import { pageFade } from '../animations/motionVariants';

/**
 * Route almashganda yengil fade (~160ms).
 * Children: <Route .../> elementlari (Routes ichida emas — shu komponent Routes yaratadi).
 */
export default function AnimatedRoutes({ children }) {
  const location = useLocation();
  const reduce = usePrefersReducedMotion();

  if (reduce) {
    return <Routes location={location}>{children}</Routes>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={pageFade.initial}
        animate={pageFade.animate}
        exit={pageFade.exit}
      >
        <Routes location={location}>{children}</Routes>
      </motion.div>
    </AnimatePresence>
  );
}
