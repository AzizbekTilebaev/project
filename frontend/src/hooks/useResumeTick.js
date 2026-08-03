import { useEffect, useState } from 'react';
import { RESUME_CHANGED_EVENT } from '../lib/resumeEvents';

/**
 * localStorage resume ózgergende (yaki tab focus/storage) qayta render.
 * Header / ContinueLearning / Snapshot ushın.
 */
export default function useResumeTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(RESUME_CHANGED_EVENT, bump);
    window.addEventListener('storage', bump);
    window.addEventListener('focus', bump);
    return () => {
      window.removeEventListener(RESUME_CHANGED_EVENT, bump);
      window.removeEventListener('storage', bump);
      window.removeEventListener('focus', bump);
    };
  }, []);
  return tick;
}
