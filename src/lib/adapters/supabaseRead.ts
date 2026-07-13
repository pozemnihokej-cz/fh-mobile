import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * PRD-055 Phase 2: the narrow supabase surface the fan read adapters depend on.
 * Typing to `Pick<SupabaseClient, 'from'>` lets unit tests inject a hand-rolled
 * query-builder stub without constructing a real client.
 */
export type SupabaseLike = Pick<SupabaseClient, 'from'>;

/** A PostgREST `{ data, error }` envelope. */
export interface PostgrestResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

/**
 * Convert a PostgREST envelope into either the data or a thrown Error, so
 * `useAsyncData` can route failures to the shared ErrorState + retry. Anon
 * reads only — the adapters never mutate.
 */
export function unwrap<T>(result: PostgrestResult<T>): T {
  if (result.error) {
    const code = result.error.code ? ` (${result.error.code})` : '';
    throw new Error(`${result.error.message}${code}`);
  }
  return (result.data ?? ([] as unknown as T)) as T;
}
