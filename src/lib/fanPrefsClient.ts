import { useAction } from 'convex/react';
import { api } from '@convex/_generated/api';

/**
 * SPEC-PRD-034 Spec-AC-14 — thin Convex binding for the fan_preferences
 * actions. Isolated in its own module so the ONLY `convex/react` `useAction`
 * import for fan preferences lives here (keeps the source-inspection
 * no-mutation guard on the public routes honest, and lets tests mock the whole
 * client without touching Convex).
 *
 * The public surface is Convex ACTIONS (not mutations): identity is verified
 * server-side via `verifyJwt`, which fetches GoTrue and is therefore forbidden
 * in a query/mutation. Each call carries only the fan's bearer `token` (+ the
 * lists for upsert) — never an id — so own-data isolation is structural.
 */
export interface FanPrefsRow {
  clubs: string[];
  leagues: string[];
  matches: string[];
  updatedAt: number;
}

export interface FanPrefsActions {
  get: (args: { token: string }) => Promise<FanPrefsRow | null>;
  upsert: (args: {
    token: string;
    clubs: string[];
    leagues: string[];
    matches: string[];
  }) => Promise<unknown>;
  clear: (args: { token: string }) => Promise<unknown>;
}

export function useFanPrefsActions(): FanPrefsActions {
  const get = useAction(api.functions.fanPreferences.get);
  const upsert = useAction(api.functions.fanPreferences.upsert);
  const clear = useAction(api.functions.fanPreferences.clear);
  return { get, upsert, clear } as unknown as FanPrefsActions;
}
