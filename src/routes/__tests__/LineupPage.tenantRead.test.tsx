/**
 * spec-mobile-lineup-tenant-read TEST-001..TEST-005.
 *
 * `/<slug>/matches/:matchId/lineup` resolves the URL id inside the URL tenant (tenant-scoped
 * `matches:getBySupabaseId`) and reads the lineup by the resolved UUID (`childReadMatchId`), exactly as
 * MatchDetailView does since ISSUE-212 / SPEC-208 D5. A SportsPress number never reaches `fetchLineup`,
 * whose Convex `roster:list` fallback takes no tenant.
 *
 * Harness: the shared faithful fakes (`useQuery` dispatched by function name; supabase-js-shaped builder over
 * fixture tables; the REAL `fetchLineup`, only spied).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { i18n } from '@fh/i18n';
import {
  convexFake,
  resetConvexFake,
  supabaseFake,
  resetSupabaseFake,
  MATCH_FN,
} from '../../components/__tests__/_fakes/convexRoster';

vi.mock('convex/react', async () => {
  const fake = await import('../../components/__tests__/_fakes/convexRoster');
  return { useQuery: fake.useQueryFake };
});

vi.mock('convex/browser', async () => {
  const fake = await import('../../components/__tests__/_fakes/convexRoster');
  return { ConvexHttpClient: fake.ConvexHttpClientFake };
});

vi.mock('../../lib/supabase', async () => {
  const fake = await import('../../components/__tests__/_fakes/convexRoster');
  return { supabase: fake.supabaseFake };
});

const fetchLineupSpy = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('../../lib/adapters/lineup', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchLineup: (sb: unknown, matchId: string) => {
      fetchLineupSpy.calls.push(matchId);
      return actual.fetchLineup(sb, matchId);
    },
  };
});

import LineupPage from '../LineupPage';
import { TenantContext } from '../TenantContext';

const tr = (key: string): string => i18n.t(key);
const NUMBER = '23111';
const UNION_UUID = '11111111-2222-4333-8444-555555555555';
const ROUTE_UUID = '0b7e2f4c-1d2a-4c3b-9e8f-112233445566';

function mount(urlId: string) {
  return render(
    <TenantContext.Provider value={{ tenantId: 't-union', slug: 'union', tenantName: 'ČSPH' }}>
      <MemoryRouter initialEntries={[`/union/matches/${urlId}/lineup`]}>
        <Routes>
          <Route path="/:slug/matches/:matchId/lineup" element={<LineupPage />} />
        </Routes>
      </MemoryRouter>
    </TenantContext.Provider>,
  );
}

const matchReads = () => convexFake.calls.filter((c) => c.name === MATCH_FN).map((c) => c.args as Record<string, unknown>);
const rosterHttpArgs = () =>
  convexFake.httpCalls.map((c) => (c.args as { matchId?: string }).matchId);

beforeEach(() => {
  resetConvexFake();
  resetSupabaseFake();
  fetchLineupSpy.calls = [];
});

describe('TEST-001 (Spec-AC-01): the URL id resolves inside the URL tenant', () => {
  it('reads getBySupabaseId with the URL id AND the URL tenant', () => {
    convexFake.match = undefined;
    mount(NUMBER);
    expect(matchReads().length).toBeGreaterThan(0);
    expect(matchReads().every((a) => a.supabaseId === NUMBER && a.tenantId === 't-union')).toBe(true);
  });
});

describe('TEST-002 (Spec-AC-02): a number URL reads the lineup by the resolved UUID', () => {
  it('fetchLineup and every downstream read take the UUID, never the number, and the lineup shows', async () => {
    convexFake.match = { supabaseId: UNION_UUID, externalId: NUMBER, status: 'completed', date: 0 };
    supabaseFake.tables.match_players = [
      { id: 'p1', match_id: UNION_UUID, name: 'Union Hráčka', jersey_number: '7', side: 'home', role: 'player' },
      // A different tenant's match that happens to carry rows keyed by the raw number must never be read.
      { id: 'x1', match_id: NUMBER, name: 'Cizí Hráčka', jersey_number: '9', side: 'home', role: 'player' },
    ];
    mount(NUMBER);
    expect(await screen.findByText('Union Hráčka')).toBeInTheDocument();
    expect(screen.queryByText('Cizí Hráčka')).toBeNull();
    expect(fetchLineupSpy.calls).toEqual([UNION_UUID]);
    expect(rosterHttpArgs().filter((id) => id === NUMBER)).toEqual([]);
  });
});

describe('TEST-003 (Spec-AC-03): while the match read loads, nothing is read and the skeleton shows', () => {
  it('no fetchLineup call and no empty state yet', () => {
    convexFake.match = undefined;
    mount(NUMBER);
    expect(fetchLineupSpy.calls).toEqual([]);
    expect(screen.queryByText(tr('mobile.fan.lineup.empty'))).toBeNull();
  });
});

describe('TEST-004 (Spec-AC-04): a number URL whose match the URL tenant does not hold reads nothing', () => {
  it('match read answered null: no fetchLineup call, the empty state shows', async () => {
    convexFake.match = null;
    supabaseFake.tables.match_players = [
      { id: 'x1', match_id: NUMBER, name: 'Cizí Hráčka', jersey_number: '9', side: 'home', role: 'player' },
    ];
    mount(NUMBER);
    expect(await screen.findByText(tr('mobile.fan.lineup.empty'))).toBeInTheDocument();
    expect(fetchLineupSpy.calls).toEqual([]);
    expect(rosterHttpArgs()).toEqual([]);
    expect(screen.queryByText('Cizí Hráčka')).toBeNull();
  });
});

describe('TEST-005 (Spec-AC-05): a UUID URL stays readable by its own id', () => {
  it('match read answered null: the UUID itself is read', async () => {
    convexFake.match = null;
    supabaseFake.tables.match_players = [
      { id: 'p2', match_id: ROUTE_UUID, name: 'Uuid Hráčka', jersey_number: '3', side: 'guest', role: 'player' },
    ];
    mount(ROUTE_UUID);
    await waitFor(() => expect(fetchLineupSpy.calls).toEqual([ROUTE_UUID]));
  });
});
