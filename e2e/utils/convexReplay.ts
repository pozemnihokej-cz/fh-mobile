/**
 * SPEC-PRD-057 e2e helper — deterministic Convex sync replay for fan screens.
 *
 * The two Convex-backed fan screens (MatchesPage / LiveCenter → `matches:list`,
 * MatchDetailView → `matches:getBySupabaseId`) render a `MatchCardSkeleton`
 * while their `useQuery` is `undefined` and only paint data once the query
 * resolves. Against the LIVE local stack the `e2e-test` tenant carries ZERO
 * Convex match rows, so a real connection resolves to the EmptyState — it can
 * never demonstrate the skeleton→data transition PRD-057 Spec-AC-01/06 assert.
 *
 * This helper intercepts the Convex sync WebSocket (`page.routeWebSocket`) and
 * replays a minimal, protocol-correct `Transition` frame for the matches
 * queries, so the fan list/detail render deterministic data WITHOUT ever
 * touching the real Convex backend (the route is a true sink — it never calls
 * `connectToServer`). This mirrors the sink discipline of `anonymous-flow.spec`
 * / `url-overrides-auth.spec` (which capture the outgoing query and never reply);
 * here we additionally reply so the RENDER path — the thing PRD-057 verifies —
 * is exercised.
 *
 * Tenant safety: this touches only the `e2e-test` slug's client-side render.
 * No Supabase write, no Convex backend call, no `cz-field-hockey-union` path.
 *
 * Protocol (convex ^1.34): after the client sends `ModifyQuerySet` with an
 * `Add { queryId, udfPath, args }`, the server replies with a `Transition`
 * whose `startVersion` equals the client's current RemoteQuerySet version
 * (`{ querySet, ts, identity }`, all 0 on first connect) and whose `endVersion`
 * advances it, carrying a `QueryUpdated { queryId, value, logLines }`. `ts` is a
 * u64 serialized as base64 little-endian. We own every Transition on this socket,
 * so a monotonically increasing counter keeps `startVersion` in lock-step with
 * `RemoteQuerySet.version` (validated in convex/.../remote_query_set.js).
 */

import type { Page } from '@playwright/test';

/** Convex serializes u64 timestamps as base64 little-endian 8-byte integers. */
function u64(n: number): string {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b.toString('base64');
}

export interface ConvexReplayOptions {
  /** Value replayed for `functions/matches:list` (the matches / live lists). */
  list?: unknown[];
  /** Value replayed for `functions/matches:getBySupabaseId` (match detail). */
  detail?: unknown;
  /**
   * Optional gate awaited before each reply is sent — lets a test assert the
   * loading skeleton is on screen BEFORE the data lands (Spec-AC-01).
   */
  hold?: () => Promise<void>;
}

/** A ready-made scheduled match the fan MatchCard renders (list fixture). */
export const REPLAY_MATCH = {
  _id: 'prd057_e2e_match_1',
  supabaseId: '00000000-0000-4000-8000-0000abcd9001',
  homeTeamName: 'Alpha HC',
  awayTeamName: 'Bravo HC',
  homeClubName: 'Alpha HC',
  awayClubName: 'Bravo HC',
  homeClubLogo: null,
  awayClubLogo: null,
  leagueName: 'Extraliga',
  location: 'Praha',
  date: 1719800000000,
  status: 'scheduled',
  score: { home: 0, away: 0 },
} as const;

/** A finished match the MatchDetailView scoreboard renders (detail fixture). */
export const REPLAY_MATCH_DETAIL = {
  _id: 'prd057_e2e_match_1',
  supabaseId: REPLAY_MATCH.supabaseId,
  homeTeamName: 'Alpha HC',
  awayTeamName: 'Bravo HC',
  homeClubName: 'Alpha HC',
  awayClubName: 'Bravo HC',
  homeClubLogo: null,
  awayClubLogo: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  leagueName: 'Extraliga',
  location: 'Praha',
  date: 1719800000000,
  status: 'completed',
  score: { home: 2, away: 1 },
} as const;

/**
 * Install the matches-query replay on `page`. Must be called BEFORE `page.goto`.
 */
export async function installConvexReplay(page: Page, opts: ConvexReplayOptions): Promise<void> {
  await page.routeWebSocket(/\/api\/[^/]+\/sync/, (ws) => {
    // Version is per-CONNECTION: each navigation opens a fresh Convex socket
    // whose RemoteQuerySet.version restarts at 0, so the counter must too
    // (a shared counter would drift and fail the start-version check on the
    // second navigation).
    let version = 0;
    ws.onMessage((message: string | Buffer) => {
      const raw = typeof message === 'string' ? message : Buffer.from(message).toString('utf-8');
      let parsed: {
        type?: string;
        modifications?: Array<{ type?: string; udfPath?: string; queryId?: number }>;
      };
      try {
        parsed = JSON.parse(raw);
      } catch {
        return; // handshake / ping / non-JSON frame
      }
      if (parsed.type !== 'ModifyQuerySet' || !Array.isArray(parsed.modifications)) return;
      for (const mod of parsed.modifications) {
        if (mod.type !== 'Add' || typeof mod.udfPath !== 'string' || typeof mod.queryId !== 'number') continue;
        let value: unknown;
        if (/matches[:.]list/.test(mod.udfPath) && opts.list !== undefined) {
          value = opts.list;
        } else if (/matches[:.]getBySupabaseId/.test(mod.udfPath) && opts.detail !== undefined) {
          value = opts.detail;
        } else {
          continue; // leave timeline/clock/etc. queries pending (they render empty)
        }
        // Assign the version synchronously so concurrent Adds stay ordered.
        const start = version;
        const end = version + 1;
        version = end;
        const transition = {
          type: 'Transition',
          startVersion: { querySet: start, ts: u64(start), identity: 0 },
          endVersion: { querySet: end, ts: u64(end), identity: 0 },
          modifications: [{ type: 'QueryUpdated', queryId: mod.queryId, value, logLines: [] }],
        };
        const send = (): void => ws.send(JSON.stringify(transition));
        if (opts.hold) {
          void opts.hold().then(send);
        } else {
          send();
        }
      }
    });
    // NB: never ws.connectToServer() — the real Convex backend stays untouched.
  });
}
