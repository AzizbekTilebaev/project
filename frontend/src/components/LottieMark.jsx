import { useCallback, useEffect, useRef } from 'react';
import Lottie from 'lottie-react';
import usePrefersReducedMotion from '../hooks/usePrefersReducedMotion';

/**
 * Ixcham Lottie — bir marta oynam, oxirida toxta;
 * scroll yoki sahifa yangilanganda qayta oynam.
 */
export default function LottieMark({
  animationData,
  className = '',
  loop = false,
  speed = 0.45,
  restartOnScroll = true,
}) {
  const reduceMotion = usePrefersReducedMotion();
  const lottieRef = useRef(null);
  const wrapRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    const inst = lottieRef.current;
    if (!inst) return;
    inst.setSpeed(reduceMotion ? 0 : speed);
  }, [speed, reduceMotion, animationData]);

  const onComplete = useCallback(() => {
    finishedRef.current = true;
  }, []);

  useEffect(() => {
    if (reduceMotion || !restartOnScroll || loop) return undefined;

    const replay = () => {
      if (!finishedRef.current) return;
      const inst = lottieRef.current;
      const el = wrapRef.current;
      if (!inst || !el) return;
      const rect = el.getBoundingClientRect();
      const visible = rect.bottom > 40 && rect.top < window.innerHeight - 40;
      if (!visible) return;
      finishedRef.current = false;
      inst.goToAndPlay(0, true);
    };

    window.addEventListener('scroll', replay, { passive: true });
    return () => window.removeEventListener('scroll', replay);
  }, [reduceMotion, restartOnScroll, loop, animationData]);

  if (!animationData) return null;

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop={!reduceMotion && loop}
        autoplay={!reduceMotion}
        onComplete={onComplete}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        rendererSettings={{
          preserveAspectRatio: 'xMidYMid meet',
          clearCanvas: true,
          progressiveLoad: true,
        }}
      />
    </div>
  );
}
