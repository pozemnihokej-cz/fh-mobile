import { authSupabase } from './supabase';

/**
 * TECHDEBT-041 — fan-preferences persistence on Postgres (was Convex).
 *
 * `docs/TECHNOLOGY.md` L72 forbids storing persistent data in Convex (L19:
 * "transient match data only"; L18: PostgreSQL is the system of record). A
 * fan's subscriptions are durable user data, so they live in the RLS-gated
 * `fan_preferences` table from migration 00214.
 *
 * WHICH CLIENT: `authSupabase`, the session client that carries the fan's JWT
 * — deliberately NOT the anon `supabase` browse client. The PRD-034 anon
 * boundary (see ./supabase.ts) exists because tenant-scoped RLS returns 0 rows
 * for a tenant-LESS fan, which would blank the public browse screens. It does
 * not apply here: 00214's policies gate on `user_id = auth.uid()` and never on
 * `app.has_tenant_access()`, so a tenant-less fan resolves correctly. Public
 * browse reads still go through the anon client, untouched.
 *
 * OWN-DATA ISOLATION is now enforced by the DATABASE rather than by application
 * code — the point of the migration. Note what is absent below: no function
 * takes a user id. Reads are filtered by the own-row SELECT policy; writes go
 * through `fan_preferences_replace()`, which targets `auth.uid()` internally.
 * As with the Convex actions this replaces, there is no argument by which fan A
 * could reach fan B's data — but the guarantee is now a policy, not a comment.
 */

/** Client-facing shape of a fan's stored preferences. */
export interface FanPrefsRow {
  clubs: string[];
  leagues: string[];
  matches: string[];
}

export interface FanPrefsActions {
  /** The caller's own preferences, or null when they have none stored yet. */
  get: () => Promise<FanPrefsRow | null>;
  /** Atomically replace the caller's full set (see the RPC in 00214). */
  upsert: (args: { clubs: string[]; leagues: string[]; matches: string[] }) => Promise<void>;
  /** Clear the caller's subscriptions — a replace with three empty lists. */
  clear: () => Promise<void>;
}

const TABLE = 'fan_preferences';
const REPLACE_RPC = 'fan_preferences_replace';

/** Storage kinds, mapped to the three client-facing lists. */
const KIND_TO_LIST = {
  club_subscription: 'clubs',
  league_subscription: 'leagues',
  starred_match: 'matches',
} as const;

type StoredKind = keyof typeof KIND_TO_LIST;

interface StoredRow {
  kind: StoredKind;
  entity_id: string;
}

function fail(error: { message: string; code?: string }): never {
  const code = error.code ? ` (${error.code})` : '';
  throw new Error(`fan_preferences: ${error.message}${code}`);
}

/**
 * Read the fan's rows and fold them into the three lists. No `user_id` filter:
 * the own-row SELECT policy is the filter, so a missing/expired session yields
 * an error (anon holds no grant) rather than another fan's data.
 */
async function get(): Promise<FanPrefsRow | null> {
  const { data, error } = await authSupabase
    .from(TABLE)
    .select('kind, entity_id')
    .order('created_at', { ascending: true });
  if (error) fail(error);

  const rows = (data ?? []) as StoredRow[];
  // Null (not an empty row) when nothing is stored, so the caller's sign-in
  // merge can tell "no remote state yet" from "explicitly empty" the same way
  // the Convex `get` did.
  if (rows.length === 0) return null;

  const out: FanPrefsRow = { clubs: [], leagues: [], matches: [] };
  for (const row of rows) {
    const list = KIND_TO_LIST[row.kind];
    // Defensive: a kind added by a later migration but not yet known here is
    // skipped rather than crashing the sign-in sync.
    if (list) out[list].push(row.entity_id);
  }
  return out;
}

/**
 * Full-replace in ONE round trip and ONE transaction. Doing this as separate
 * DELETE/INSERT calls from PostgREST would be non-atomic — a mid-flight failure
 * would leave the fan with a half-applied set.
 */
async function upsert(args: {
  clubs: string[];
  leagues: string[];
  matches: string[];
}): Promise<void> {
  const { error } = await authSupabase.rpc(REPLACE_RPC, {
    p_clubs: args.clubs,
    p_leagues: args.leagues,
    p_matches: args.matches,
  });
  if (error) fail(error);
}

async function clear(): Promise<void> {
  await upsert({ clubs: [], leagues: [], matches: [] });
}

// Module-level singleton: `authSupabase` is itself a singleton, so these need
// no hook state. A stable object identity matters — the provider's callbacks
// take `upsert` as a dependency and would be rebuilt on every render otherwise.
const ACTIONS: FanPrefsActions = { get, upsert, clear };

export function useFanPrefsActions(): FanPrefsActions {
  return ACTIONS;
}
