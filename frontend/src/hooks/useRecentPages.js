import { useEffect, useState } from 'react';
import { RECENT_PAGES_KEY, readRecentPages } from '../lib/recentPages';
import useResumeTick from './useResumeTick';

/** Sońǵı kirilgen sahifalar (bas bette limit=3). */
export default function useRecentPages(limit = 3) {
  const resumeTick = useResumeTick();
  const [items, setItems] = useState(() =>
    typeof window === 'undefined' ? [] : readRecentPages(limit)
  );

  useEffect(() => {
    setItems(readRecentPages(limit));
  }, [limit, resumeTick]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === RECENT_PAGES_KEY || e.key === null) {
        setItems(readRecentPages(limit));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [limit]);

  return items;
}
