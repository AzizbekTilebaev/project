import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { postHeartbeat } from '../api/stats';

function surfaceFromPath(pathname) {
  if (pathname.startsWith('/quiz')) return 'quiz';
  if (pathname.startsWith('/dictionary/immersion')) return 'immersion';
  if (pathname.startsWith('/dictionary')) return 'dictionary';
  if (pathname.startsWith('/crossword')) return 'crossword';
  if (pathname.startsWith('/jumbaqlar')) return 'jumbaq';
  if (pathname.startsWith('/literature') || pathname.startsWith('/books') || pathname.startsWith('/writers')) {
    return 'literature';
  }
  if (pathname.startsWith('/tutor')) return 'tutor';
  return 'app';
}

/** Har 30s faol bet uchun duration heartbeat yuboradi. */
export default function ActivityHeartbeat() {
  const { pathname } = useLocation();

  useEffect(() => {
    const surface = surfaceFromPath(pathname);
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      postHeartbeat({ surface, durationMs: 30000 }).catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [pathname]);

  return null;
}
