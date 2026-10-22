/**
 * spec-fan-app-prod-cleanup-and-team-names TEST-005 (Spec-AC-06) — the match
 * detail page header names a reserve team by its curated short name.
 * Added after review round 1 (the header was not pinned).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('convex/react', () => ({
  useQuery: (_q: unknown, args: unknown) =>
    args === 'skip'
      ? undefined
      : {
          supabaseId: '11111111-2222-4333-8444-555555555555',
          status: 'scheduled',
          date: Date.now() + 3_600_000,
          homeTeamName: 'Slavia ženy B',
          homeTeamShortName: 'Slavia B',
          homeClubName: 'Slavia',
          awayTeamName: 'Rakovník ženy',
          awayTeamShortName: 'Rakovník',
          awayClubName: 'Rakovník',
        },
}));
vi.mock('../../components/MatchDetailView', () => ({ MatchDetailView: () => null }));
vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({ isMatchSaved: () => false, toggleMatch: () => undefined }),
}));

import MatchDetailPage from '../MatchDetailPage';
import { TenantContext } from '../TenantContext';

describe('TEST-005 (Spec-AC-06): match detail page header label', () => {
  it('shows "Slavia B", not the bare club name', () => {
    render(
      <TenantContext.Provider value={{ tenantId: 't-union', slug: 'union', tenantName: 'ČSPH' }}>
        <MemoryRouter initialEntries={['/union/matches/11111111-2222-4333-8444-555555555555']}>
          <Routes>
            <Route path="/:slug/matches/:matchId" element={<MatchDetailPage />} />
          </Routes>
        </MemoryRouter>
      </TenantContext.Provider>,
    );
    expect(screen.getByText('Slavia B')).toBeInTheDocument();
    expect(screen.queryByText('Slavia', { exact: true })).toBeNull();
    expect(screen.getByText('Rakovník')).toBeInTheDocument();
  });
});
