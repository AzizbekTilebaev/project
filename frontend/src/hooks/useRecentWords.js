import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  addRecentWord as apiAddRecentWord,
  clearRecentWords as apiClearRecentWords,
  fetchRecentWords,
  syncRecentWords as apiSyncRecentWords,
} from '../api/recentWords';

const STORAGE_KEY = 'dictionary:recent:v1';
/** Landing’da 5, to‘liq tarix sahifası ushın kóbirek saqlanadı */
const MAX_ITEMS = 48;

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x.id === 'string' && typeof x.soz === 'string')
      .map((x) => ({
        id: x.id,
        soz: x.soz,
        category: x.category || null,
        viewedAt: typeof x.viewedAt === 'number' ? x.viewedAt : Date.parse(x.viewedAt) || null,
      }));
  } catch {
    return [];
  }
}

function writeStore(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // quota / private mode — UI ishlashda davom etadi
  }
}

/**
 * Yaqinda ko'rilgan so'zlar tarixi — localStorage + tablar orasida sinxron.
 * Snapshot: { id, soz, category?, viewedAt }
 */
export default function useRecentWords() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState(() => (typeof window === 'undefined' ? [] : readStore()));

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) setItems(readStore());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const local = readStore();
        const data = local.length ? await apiSyncRecentWords(local) : await fetchRecentWords();
        if (cancelled) return;
        const next = data.items || [];
        writeStore(next);
        setItems(next);
      } catch {
        /* offline/local fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const record = useCallback((entry) => {
    if (!entry?.id || !entry?.soz) return;
    setItems((prev) => {
      const next = [
        {
          id: entry.id,
          soz: entry.soz,
          category: entry.category || null,
          viewedAt: Date.now(),
        },
        ...prev.filter((x) => x.id !== entry.id),
      ].slice(0, MAX_ITEMS);
      writeStore(next);
      if (isAuthenticated) {
        apiAddRecentWord(entry)
          .then((data) => {
            if (data?.items) {
              writeStore(data.items);
              setItems(data.items);
            }
          })
          .catch(() => {});
      }
      return next;
    });
  }, [isAuthenticated]);

  const clear = useCallback(() => {
    writeStore([]);
    setItems([]);
    if (isAuthenticated) apiClearRecentWords().catch(() => {});
  }, [isAuthenticated]);

  return { items, count: items.length, record, clear };
}
