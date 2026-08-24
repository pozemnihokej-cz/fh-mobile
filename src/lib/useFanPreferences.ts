import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@fh/auth';
import { useFanPrefsActions } from './fanPrefsClient';

/**
 * SPEC-PRD-034 Spec-AC-14 / Spec-AC-15 (AC-008) — unified fan-preferences store.
 *
 * Single source of truth for the three subscribed lists (clubs / leagues /
 * matches). Hides the anon-vs-signed-in branch from screens:
 *
 *   - ANONYMOUS: the lists live in localStorage (keys below). Zero backend
 *     load — the v1 anonymous experience is preserved.
 *   - ON SIGN-IN (token becomes non-null): a one-shot, ref-guarded sync reads
 *     the fan's stored rows, UNIONS them with the current localStorage lists,
 *     and writes the merged set back (atomic full-replace). State is then
 *     read-through the store while localStorage stays mirrored so a later
 *     sign-out degrades gracefully.
 *   - SIGNED-IN MUTATIONS: toggle/clear update state optimistically, mirror to
 *     localStorage, and push the new full set (upsert / clear).
 *
 * TECHDEBT-041 moved the backing store from Convex to the RLS-gated Postgres
 * table `fan_preferences` (migration 00214); persistent data in Convex is
 * forbidden by docs/TECHNOLOGY.md L72. That swap is confined to
 * ./fanPrefsClient.ts — the merge semantics and every screen-facing API below
 * are unchanged.
 *
 * Own-data isolation is enforced by the DATABASE (own-row RLS on auth.uid()):
 * the client supplies no user id on any call. The fan JWT now does reach
 * PostgREST for THIS table, which is safe because 00214 gates on auth.uid()
 * rather than tenant access; public browse reads still use the anon client.
 *
 * Delivered as a Provider + `useFanPreferences()` context hook so the store is
 * a single instance for the whole app session (one sync, live cross-screen
 * updates). Consumers rendered WITHOUT the provider (isolated unit tests) get
 * an inert default and never touch the backend.
 */

// Storage keys. `fh_starred_matches` is the pre-existing v1 key (kept for
// back-compat with useStarredIds); clubs/leagues are new.
export const LS_MATCHES = 'fh_starred_matches';
export const LS_CLUBS = 'fh_my_clubs';
export const LS_LEAGUES = 'fh_my_leagues';

export interface FanPreferences {
  clubs: string[];
  leagues: string[];
  matches: string[];
  isClubSaved: (id: string) => boolean;
  isLeagueSaved: (id: string) => boolean;
  isMatchSaved: (id: string) => boolean;
  toggleClub: (id: string) => void;
  toggleLeague: (id: string) => void;
  toggleMatch: (id: string) => void;
  clearAll: () => void;
  /** True once a fan session is active (drives the server-backed sync path). */
  isAuthenticated: boolean;
}

const INERT: FanPreferences = {
  clubs: [],
  leagues: [],
  matches: [],
  isClubSaved: () => false,
  isLeagueSaved: () => false,
  isMatchSaved: () => false,
  toggleClub: () => undefined,
  toggleLeague: () => undefined,
  toggleMatch: () => undefined,
  clearAll: () => undefined,
  isAuthenticated: false,
};

const FanPreferencesContext = createContext<FanPreferences>(INERT);

function readLs(key: string): string[] {
  try {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    return saved ? (JSON.parse(saved) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLs(key: string, value: string[]): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* storage disabled / quota — ignore */
  }
}

function union(a: string[], b: string[]): string[] {
  const out = [...a];
  for (const x of b) if (!out.includes(x)) out.push(x);
  return out;
}

function toggleIn(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function FanPreferencesProvider({ children }: { children: ReactNode }): JSX.Element {
  const { token, user, isAuthenticated } = useAuth();
  const { get, upsert, clear } = useFanPrefsActions();

  const [clubs, setClubs] = useState<string[]>(() => readLs(LS_CLUBS));
  const [leagues, setLeagues] = useState<string[]>(() => readLs(LS_LEAGUES));
  const [matches, setMatches] = useState<string[]>(() => readLs(LS_MATCHES));

  // Latest snapshot for building full-replace upsert payloads inside callbacks
  // without adding the lists to callback deps.
  const snap = useRef({ clubs, leagues, matches });
  snap.current = { clubs, leagues, matches };

  // Mirror every list to localStorage on change (anon store + signed-in mirror
  // so a later sign-out keeps the last-known lists locally).
  useEffect(() => writeLs(LS_CLUBS, clubs), [clubs]);
  useEffect(() => writeLs(LS_LEAGUES, leagues), [leagues]);
  useEffect(() => writeLs(LS_MATCHES, matches), [matches]);

  // One-shot sign-in sync, ref-guarded on the authenticated IDENTITY (the
  // verified `user.id` / sub), NOT the token — supabase-js rotates the JWT
  // (~hourly) and a token-keyed guard would re-run the union-merge on every
  // refresh, which can RESURRECT a just-removed item (a refresh get() racing an
  // in-flight removal). Keying on identity fires the merge exactly once per
  // signed-in fan; token refresh with the same identity is a no-op here.
  // Both token and identity are required: the token proves there is a live
  // session (RLS needs it), identity keys the guard. Sign-out (identity → null)
  // re-arms it, so signing in as a different user re-syncs. Read-through still
  // works: the one-shot get() seeds state and mutations push the full set.
  const syncedIdentity = useRef<string | null>(null);
  useEffect(() => {
    const identity = user?.id ?? null;
    if (!token || !identity) {
      syncedIdentity.current = null;
      return;
    }
    if (syncedIdentity.current === identity) return;
    syncedIdentity.current = identity;

    let cancelled = false;
    void (async () => {
      let remote: { clubs: string[]; leagues: string[]; matches: string[] } | null = null;
      try {
        remote = await get();
      } catch {
        remote = null;
      }
      if (cancelled) return;
      const mergedClubs = union(snap.current.clubs, remote?.clubs ?? []);
      const mergedLeagues = union(snap.current.leagues, remote?.leagues ?? []);
      const mergedMatches = union(snap.current.matches, remote?.matches ?? []);
      setClubs(mergedClubs);
      setLeagues(mergedLeagues);
      setMatches(mergedMatches);
      try {
        await upsert({
          clubs: mergedClubs,
          leagues: mergedLeagues,
          matches: mergedMatches,
        });
      } catch {
        /* offline / transient — localStorage already holds the merge */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run when the token first arrives or the identity changes; the guard
    // above makes a same-identity token refresh a no-op. get/upsert are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id]);

  // Push the current full set when signed in (atomic full-replace via RPC).
  const pushIfSignedIn = useCallback(
    (next: { clubs: string[]; leagues: string[]; matches: string[] }) => {
      if (!token) return;
      void upsert({ ...next }).catch(() => undefined);
    },
    [token, upsert],
  );

  const toggleClub = useCallback(
    (id: string) => {
      const next = toggleIn(snap.current.clubs, id);
      setClubs(next);
      pushIfSignedIn({ clubs: next, leagues: snap.current.leagues, matches: snap.current.matches });
    },
    [pushIfSignedIn],
  );
  const toggleLeague = useCallback(
    (id: string) => {
      const next = toggleIn(snap.current.leagues, id);
      setLeagues(next);
      pushIfSignedIn({ clubs: snap.current.clubs, leagues: next, matches: snap.current.matches });
    },
    [pushIfSignedIn],
  );
  const toggleMatch = useCallback(
    (id: string) => {
      const next = toggleIn(snap.current.matches, id);
      setMatches(next);
      pushIfSignedIn({ clubs: snap.current.clubs, leagues: snap.current.leagues, matches: next });
    },
    [pushIfSignedIn],
  );

  const clearAll = useCallback(() => {
    setClubs([]);
    setLeagues([]);
    setMatches([]);
    if (token) void clear().catch(() => undefined);
  }, [token, clear]);

  const value: FanPreferences = {
    clubs,
    leagues,
    matches,
    isClubSaved: (id) => clubs.includes(id),
    isLeagueSaved: (id) => leagues.includes(id),
    isMatchSaved: (id) => matches.includes(id),
    toggleClub,
    toggleLeague,
    toggleMatch,
    clearAll,
    isAuthenticated: Boolean(isAuthenticated),
  };

  return createElement(FanPreferencesContext.Provider, { value }, children);
}

export function useFanPreferences(): FanPreferences {
  return useContext(FanPreferencesContext);
}
