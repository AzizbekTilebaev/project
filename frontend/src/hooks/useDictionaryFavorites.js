import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  addFavorite as apiAdd,
  clearFavorites as apiClear,
  fetchFavorites,
  removeFavorite as apiRemove,
  syncFavorites,
} from '../api/favorites';

const STORAGE_KEY = 'dictionary:favorites:v1';
const MAX_ITEMS = 200;

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => x && typeof x.id === 'string' && typeof x.soz === 'string');
  } catch {
    return [];
  }
}

function writeStore(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Yoqtirilgan so'zlar — mehmon: localStorage; akkaunt: server + local kesh.
 */
export default function useDictionaryFavorites() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [items, setItems] = useState(() => (typeof window === 'undefined' ? [] : readStore()));
  const syncedRef = useRef(false);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) setItems(readStore());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Login: local → server sync, keyin server ro‘yxatini keshga
  useEffect(() => {
    if (authLoading) return undefined;
    if (!isAuthenticated) {
      syncedRef.current = false;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const local = readStore();
        const data = local.length
          ? await syncFavorites(local)
          : await fetchFavorites();
        if (cancelled) return;
        const next = data.items || [];
        writeStore(next);
        setItems(next);
        syncedRef.current = true;
      } catch {
        /* offline — local ishlayveradi */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading]);

  const idSet = useMemo(() => new Set(items.map((x) => x.id)), [items]);
  const has = useCallback((id) => idSet.has(id), [idSet]);

  const toggle = useCallback(
    (entry) => {
      if (!entry?.id) return;
      setItems((prev) => {
        const exists = prev.some((x) => x.id === entry.id);
        const next = exists
          ? prev.filter((x) => x.id !== entry.id)
          : [
              {
                id: entry.id,
                soz: entry.soz || entry.base_soz || '',
                birinshi_aniqlama:
                  entry.birinshi_aniqlama || entry.aniqlamalar?.[0]?.description || null,
                category: entry.category || entry.aniqlamalar?.[0]?.category || null,
                savedAt: Date.now(),
              },
              ...prev,
            ].slice(0, MAX_ITEMS);
        writeStore(next);

        if (isAuthenticated) {
          const op = exists
            ? apiRemove(entry.id)
            : apiAdd({
                id: entry.id,
                soz: entry.soz || entry.base_soz || '',
                birinshi_aniqlama:
                  entry.birinshi_aniqlama || entry.aniqlamalar?.[0]?.description || null,
                category: entry.category || entry.aniqlamalar?.[0]?.category || null,
              });
          op
            .then((data) => {
              if (data?.items) {
                writeStore(data.items);
                setItems(data.items);
              }
            })
            .catch(() => {
              /* local kesh saqlanadi */
            });
        }
        return next;
      });
    },
    [isAuthenticated]
  );

  const remove = useCallback(
    (id) => {
      setItems((prev) => {
        const next = prev.filter((x) => x.id !== id);
        writeStore(next);
        return next;
      });
      if (isAuthenticated) {
        apiRemove(id).catch(() => {});
      }
    },
    [isAuthenticated]
  );

  const clear = useCallback(() => {
    writeStore([]);
    setItems([]);
    if (isAuthenticated) {
      apiClear().catch(() => {});
    }
  }, [isAuthenticated]);

  return { items, count: items.length, has, toggle, remove, clear, synced: syncedRef.current };
}
