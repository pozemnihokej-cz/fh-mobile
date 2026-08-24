/**
 * TECHDEBT-041 — unit tests for the Postgres-backed fan-preferences client.
 *
 * Covers the logic that moved out of Convex and into this module: folding
 * association rows into the three client-facing lists, the atomic full-replace
 * RPC payload, and the security-relevant property that NO call carries a user
 * id (own-row RLS is the filter — see migration 00214).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface SelectResult {
  data: { kind: string; entity_id: string }[] | null;
  error: { message: string; code?: string } | null;
}

let selectResult: SelectResult;
let rpcResult: { error: { message: string; code?: string } | null };

const orderSpy = vi.fn(
  async (_col: string, _opts: { ascending: boolean }): Promise<SelectResult> => selectResult,
);
const selectSpy = vi.fn((_cols: string) => ({ order: orderSpy }));
/** The builder `.from()` hands back — deliberately WITHOUT `.eq()`. */
const builder = { select: selectSpy };
const fromSpy = vi.fn((_table: string) => builder);
const rpcSpy = vi.fn(
  async (_fn: string, _args: Record<string, unknown>) => rpcResult,
);

vi.mock('../supabase', () => ({
  authSupabase: {
    from: (table: string) => fromSpy(table),
    rpc: (fn: string, args: Record<string, unknown>) => rpcSpy(fn, args),
  },
}));

import { useFanPrefsActions } from '../fanPrefsClient';

const { get, upsert, clear } = useFanPrefsActions();

beforeEach(() => {
  vi.clearAllMocks();
  selectResult = { data: [], error: null };
  rpcResult = { error: null };
});

describe('get()', () => {
  it('folds the three kinds into their lists, preserving row order', async () => {
    selectResult = {
      data: [
        { kind: 'club_subscription', entity_id: 'c1' },
        { kind: 'league_subscription', entity_id: 'l1' },
        { kind: 'starred_match', entity_id: 'm1' },
        { kind: 'club_subscription', entity_id: 'c2' },
      ],
      error: null,
    };
    expect(await get()).toEqual({
      clubs: ['c1', 'c2'],
      leagues: ['l1'],
      matches: ['m1'],
    });
  });

  it('reads ordered by created_at so list order is stable across devices', async () => {
    await get();
    expect(selectSpy).toHaveBeenCalledWith('kind, entity_id');
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('never filters by user_id — RLS is the filter, not the client', async () => {
    await get();
    expect(fromSpy).toHaveBeenCalledWith('fan_preferences');
    // A `.eq()` would mean the client is asserting identity itself; the whole
    // point of 00214 is that the database does that.
    expect(builder).not.toHaveProperty('eq');
  });

  it('returns null when nothing is stored, so sign-in merge can tell "no remote state"', async () => {
    selectResult = { data: [], error: null };
    expect(await get()).toBeNull();
    selectResult = { data: null, error: null };
    expect(await get()).toBeNull();
  });

  it('skips a kind this build does not know rather than crashing the sync', async () => {
    selectResult = {
      data: [
        { kind: 'club_subscription', entity_id: 'c1' },
        { kind: 'player_subscription', entity_id: 'p1' },
      ],
      error: null,
    };
    expect(await get()).toEqual({ clubs: ['c1'], leagues: [], matches: [] });
  });

  it('throws with the PostgREST code on error', async () => {
    selectResult = { data: null, error: { message: 'permission denied', code: '42501' } };
    await expect(get()).rejects.toThrow(/permission denied \(42501\)/);
  });
});

describe('upsert() / clear()', () => {
  it('sends the full set to the atomic replace RPC', async () => {
    await upsert({ clubs: ['c1'], leagues: ['l1', 'l2'], matches: [] });
    expect(rpcSpy).toHaveBeenCalledWith('fan_preferences_replace', {
      p_clubs: ['c1'],
      p_leagues: ['l1', 'l2'],
      p_matches: [],
    });
  });

  it('carries no user id — the RPC targets auth.uid() server-side', async () => {
    await upsert({ clubs: ['c1'], leagues: [], matches: [] });
    const payload = rpcSpy.mock.calls[0][1];
    expect(Object.keys(payload).sort()).toEqual(['p_clubs', 'p_leagues', 'p_matches']);
  });

  it('clear() is a replace with three empty lists', async () => {
    await clear();
    expect(rpcSpy).toHaveBeenCalledWith('fan_preferences_replace', {
      p_clubs: [],
      p_leagues: [],
      p_matches: [],
    });
  });

  it('throws when the RPC fails', async () => {
    rpcResult = { error: { message: 'no authenticated fan' } };
    await expect(clear()).rejects.toThrow(/no authenticated fan/);
  });
});

describe('action identity', () => {
  it('is a stable object across calls (provider callbacks depend on it)', () => {
    expect(useFanPrefsActions()).toBe(useFanPrefsActions());
  });
});
