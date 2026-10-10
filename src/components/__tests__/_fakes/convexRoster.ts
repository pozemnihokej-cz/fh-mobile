/**
 * spec-fan-live-match-detail-usability — faithful fakes for the two read
 * paths MatchDetailView takes to its roster.
 *
 * Convex: `useQuery` is dispatched by the FUNCTION NAME of the reference it is
 * handed (`getFunctionName`, the same identity the Convex client sends over
 * the wire), never by sniffing the argument shape. The `roster:list` answer is
 * produced by the REAL handler in `convex/functions/roster.ts`, executed over
 * the in-memory ctx the Convex suites already use, so whatever that public
 * query strips or adds (it drops `userPin`, adds `hasPin`) reaches the
 * component exactly as production delivers it. A query this fake does not
 * know throws: a new Convex read added by the component cannot pass silently.
 *
 * Supabase: a thenable builder resolving `{ data, error }` like supabase-js,
 * applying `eq` / `in` to fixture tables. `gate` lets a test hold every read
 * pending (the "lineup not yet available" state) and release it later.
 */
import { getFunctionName } from 'convex/server';
import { list as rosterListFn } from '@convex/functions/roster';
import { makeMultiCtx } from '@convex/functions/__tests__/_helpers/inMemoryMultiDb';

export type Row = Record<string, unknown>;

export const MATCH_FN = 'functions/matches:getBySupabaseId';
export const ROSTER_FN = 'functions/roster:list';

export const convexFake: {
  match: unknown;
  rosterResult: unknown;
  calls: Array<{ name: string; args: unknown }>;
  httpCalls: Array<{ name: string; args: unknown }>;
} = {
  match: undefined,
  rosterResult: undefined,
  calls: [],
  httpCalls: [],
};

/** Execute the real public `roster:list` handler over stored matchPlayers docs. */
export async function runRosterList(storedMatchPlayers: Row[], matchId: string): Promise<unknown[]> {
  const ctx = makeMultiCtx({ matchPlayers: storedMatchPlayers, matches: [] });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (rosterListFn as any)._handler(ctx, { matchId });
}

export function resetConvexFake(): void {
  convexFake.match = undefined;
  convexFake.rosterResult = undefined;
  convexFake.calls = [];
  convexFake.httpCalls = [];
}

export function useQueryFake(ref: unknown, args: unknown): unknown {
  if (args === 'skip' || ref === 'skip') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const name = getFunctionName(ref as any);
  convexFake.calls.push({ name, args });
  if (name === MATCH_FN) return convexFake.match;
  if (name === ROSTER_FN) return convexFake.rosterResult;
  throw new Error(`convexFake: unexpected Convex query ${name}`);
}

export class ConvexHttpClientFake {
  constructor(_url: string) {}
  async query(ref: unknown, args: unknown): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const name = getFunctionName(ref as any);
    convexFake.httpCalls.push({ name, args });
    if (name === ROSTER_FN) return [];
    throw new Error(`convexFake(http): unexpected Convex query ${name}`);
  }
}

export const supabaseFake: {
  tables: Record<string, Row[]>;
  gate: Promise<void> | null;
  from: (table: string) => unknown;
} = {
  tables: {},
  gate: null,
  from(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let single = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select: () => builder,
      eq: (field: string, value: unknown) => {
        filters.push((r) => r[field] === value);
        return builder;
      },
      in: (field: string, values: unknown[]) => {
        filters.push((r) => values.includes(r[field]));
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => {
        single = true;
        return builder;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        (supabaseFake.gate ?? Promise.resolve())
          .then(() => {
            const rows = (supabaseFake.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
            return { data: single ? rows[0] ?? null : rows, error: null };
          })
          .then(resolve, reject),
    };
    return builder;
  },
};

export function resetSupabaseFake(): void {
  supabaseFake.tables = {};
  supabaseFake.gate = null;
}

/**
 * Mirror-shaped matchPlayers documents for one match, as
 * packages/sync/src/mirror-to-convex.ts writes them: guests on `side: 'away'`,
 * referees on `side: 'neutral'` with `role: 'referee'`, a PIN on every row.
 */
export function mirroredRoster(matchId: string): Row[] {
  const rows: Row[] = [];
  const pin = { userPin: '0000' };
  for (let i = 1; i <= 16; i++) {
    rows.push({
      matchId,
      name: `Domácí Hráč ${String(i).padStart(2, '0')}`,
      jerseyNumber: String(i + 1),
      side: 'home',
      status: 'lineup',
      position: i % 2 === 0 ? 'defender' : 'forward',
      role: i === 1 ? 'captain' : 'player',
      ...pin,
    });
  }
  rows.push({ matchId, name: 'Domácí Brankář Pozice', jerseyNumber: '1', side: 'home', status: 'lineup', position: 'GK', role: 'player', ...pin });
  rows.push({ matchId, name: 'Domácí Brankář Role', jerseyNumber: '30', side: 'home', status: 'lineup', role: 'goalkeeper', ...pin });
  rows.push({ matchId, name: 'Domácí Trenér', side: 'home', status: 'lineup', role: 'coach', ...pin });
  rows.push({ matchId, name: 'Domácí Masér', side: 'home', status: 'lineup', role: 'staff', ...pin });
  for (let i = 1; i <= 5; i++) {
    rows.push({ matchId, name: `Hostující Hráč ${i}`, jerseyNumber: String(i + 10), side: 'away', status: 'lineup', position: 'forward', role: 'player', ...pin });
  }
  rows.push({ matchId, name: 'Hostující Trenér', side: 'away', status: 'lineup', role: 'coach', ...pin });
  rows.push({ matchId, name: 'Rozhodčí Alfa', side: 'neutral', status: 'lineup', role: 'referee', image: 'https://images.example.com/referee-alfa.jpg', ...pin });
  rows.push({ matchId, name: 'Rozhodčí Beta', side: 'neutral', status: 'lineup', role: 'referee', ...pin });
  rows.push({ matchId, name: 'Rozhodčí Gama', side: 'neutral', status: 'lineup', role: 'referee', image: 'https://images.example.com/broken-referee-gama.jpg', ...pin });
  // The same referee delegated twice (two rows, one person).
  rows.push({ matchId, name: 'rozhodčí alfa ', side: 'neutral', status: 'lineup', role: 'Referee', image: 'https://images.example.com/referee-alfa.jpg', ...pin });
  return rows;
}
