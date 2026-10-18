/**
 * ISSUE-199 / spec-match-read-untenanted-external-id — TEST-008 (Spec-AC-04). The page's own match read (share
 * link, header) carries the URL tenant, so `/<slug>/live/<SportsPress number>` never resolves across tenants.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const reads = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock('convex/react', () => ({
  useQuery: (_q: unknown, args: unknown) => {
    reads.calls.push(args);
    return undefined;
  },
}));
vi.mock('../../components/MatchDetailView', () => ({ MatchDetailView: () => null }));
vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({ isMatchSaved: () => false, toggleMatch: vi.fn() }),
}));

import MatchDetailPage from '../MatchDetailPage';
import { TenantContext } from '../TenantContext';

describe('TEST-008 (Spec-AC-04): MatchDetailPage reads the match inside the URL tenant', () => {
  it('passes the URL tenant id with the route match id', () => {
    render(
      <TenantContext.Provider value={{ tenantId: 't-union', slug: 'cz-field-hockey-union', tenantName: 'ČSPH' }}>
        <MemoryRouter initialEntries={['/cz-field-hockey-union/live/23111']}>
          <Routes>
            <Route path="/:slug/live/:matchId" element={<MatchDetailPage />} />
          </Routes>
        </MemoryRouter>
      </TenantContext.Provider>,
    );
    const issued = reads.calls.filter((a) => a !== 'skip');
    expect(issued.length).toBeGreaterThan(0);
    for (const a of issued) expect(a).toEqual({ supabaseId: '23111', tenantId: 't-union' });
  });
});
