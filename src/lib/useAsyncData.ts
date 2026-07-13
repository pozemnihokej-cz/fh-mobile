import { useCallback, useEffect, useState } from 'react';

/**
 * PRD-055 Phase 2: the shared read-state hook for the supabase-js fan screens.
 *
 * Wraps a promise-returning fetcher into the `{ data, error, loading, refetch }`
 * shape the `AsyncBoundary` consumes (Spec-AC-05). The fetcher MUST throw on
 * failure (the supabase adapters below convert a PostgREST `{ error }` into a
 * thrown Error) so the hook can surface an ErrorState with a working retry.
 *
 * `enabled = false` keeps the hook in the loading state without firing — the
 * screen is still waiting on a prerequisite (e.g. the resolved tenantId). A
 * cancelled-flag guards against setState after unmount / dependency change.
 */
export interface AsyncData<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refetch: () => void;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
  enabled = true,
): AsyncData<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(true);
      setData(undefined);
      setError(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void (async () => {
      try {
        const result = await fetcher();
        if (cancelled) return;
        setData(result);
        setError(undefined);
      } catch (err) {
        if (cancelled) return;
        setData(undefined);
        setError(err ?? new Error('Unknown error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  return { data, error, loading, refetch };
}
