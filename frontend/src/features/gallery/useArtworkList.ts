import { useCallback, useEffect, useRef, useState } from 'react';
import type { Artwork, Page } from '../../shared/api/types';

const PAGE_SIZE = 24;

/**
 * Список робіт із пагінацією «Показати ще».
 * fetchPage має бути стабільною (useCallback) — її зміна перезапускає список.
 */
export function useArtworkList(fetchPage: (offset: number, limit: number) => Promise<Page<Artwork>>) {
  const [items, setItems] = useState<Artwork[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(
    async (offset: number) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(false);
      try {
        const page = await fetchPage(offset, PAGE_SIZE);
        if (id !== requestId.current) return; // прийшла відповідь на застарілий запит
        setItems((prev) => (offset === 0 ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
      } catch {
        if (id === requestId.current) setError(true);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return {
    items,
    total,
    loading,
    error,
    hasMore: items.length < total,
    loadMore: () => load(items.length),
    reload: () => load(0),
    update: (artwork: Artwork) =>
      setItems((prev) => prev.map((a) => (a.id === artwork.id ? artwork : a))),
    remove: (id: number) => {
      setItems((prev) => prev.filter((a) => a.id !== id));
      setTotal((n) => Math.max(0, n - 1));
    },
    prepend: (artwork: Artwork) => {
      setItems((prev) => [artwork, ...prev]);
      setTotal((n) => n + 1);
    },
  };
}
