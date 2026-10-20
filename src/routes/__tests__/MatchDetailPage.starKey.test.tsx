/**
 * spec-mobile-lineup-tenant-read TEST-007 (Spec-AC-07). The match-detail star keys the fan preference by the
 * resolved match UUID (`childReadMatchId`), never by the raw SportsPress number in the URL. While the match read is
 * unresolved (loading, or null for a number) the star is a no-op and shows unstarred.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const state = vi.hoisted(() => ({
  match: undefined as unknown,
  toggled: [] as string[],
  savedChecks: [] as string[],
  view: null as null | { starred: boolean; onToggleStar: (e: { stopPropagation: () => void }) => void },
}));

vi.mock('convex/react', () => ({
  useQuery: (_q: unknown, args: unknown) => (args === 'skip' ? undefined : state.match),
}));
vi.mock('../../components/MatchDetailView', () => ({
  MatchDetailView: (props: { starred: boolean; onToggleStar: (e: { stopPropagation: () => void }) => void }) => {
    state.view = props;
    return null;
  },
}));
vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({
    isMatchSaved: (id: string) => {
      state.savedChecks.push(id);
      return id === UUID || id === NUMBER;
    },
    toggleMatch: (id: string) => state.toggled.push(id),
  }),
}));

import MatchDetailPage from '../MatchDetailPage';
import { TenantContext } from '../TenantContext';

const NUMBER = '23111';
const UUID = '11111111-2222-4333-8444-555555555555';

function mount(urlId: string) {
  render(
    <TenantContext.Provider value={{ tenantId: 't-union', slug: 'union', tenantName: 'ČSPH' }}>
      <MemoryRouter initialEntries={[`/union/live/${urlId}`]}>
        <Routes>
          <Route path="/:slug/live/:matchId" element={<MatchDetailPage />} />
        </Routes>
      </MemoryRouter>
    </TenantContext.Provider>,
  );
}

const click = () => state.view!.onToggleStar({ stopPropagation: () => undefined });

beforeEach(() => {
  state.match = undefined;
  state.toggled = [];
  state.savedChecks = [];
  state.view = null;
});

describe('TEST-007 (Spec-AC-07): the star keys by the resolved UUID', () => {
  it('a resolved number URL stars the UUID', () => {
    state.match = { supabaseId: UUID, externalId: NUMBER, status: 'scheduled', date: 0 };
    mount(NUMBER);
    expect(state.view!.starred).toBe(true);
    click();
    expect(state.toggled).toEqual([UUID]);
    expect(state.savedChecks).not.toContain(NUMBER);
  });

  it('while the match read loads, the star is a no-op and unstarred', () => {
    state.match = undefined;
    mount(NUMBER);
    expect(state.view!.starred).toBe(false);
    click();
    expect(state.toggled).toEqual([]);
    expect(state.savedChecks).not.toContain(NUMBER);
  });

  it('a number the URL tenant does not hold: no-op, never keyed by the number', () => {
    state.match = null;
    mount(NUMBER);
    expect(state.view!.starred).toBe(false);
    click();
    expect(state.toggled).toEqual([]);
    expect(state.savedChecks).not.toContain(NUMBER);
  });

  it('a UUID URL with a null match read still stars its own UUID', () => {
    state.match = null;
    mount(UUID);
    click();
    expect(state.toggled).toEqual([UUID]);
  });
});
