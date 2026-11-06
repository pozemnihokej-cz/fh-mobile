/**
 * spec-match-display-no-score-one-team-shootout TEST-005 (Spec-AC-05) — the fan
 * match detail HEADER. A completed match never reads "0 : 0" unless that is its
 * result: the mirrored result for a match not run in OM, the played label for
 * one without a result, the shootout marker, and one team for a one-team event.
 * (The scoreboard half is MatchDetailView.result.test.tsx.)
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { i18n } from '@fh/i18n';

const state = vi.hoisted(() => ({ match: undefined as unknown }));

vi.mock('convex/react', () => ({
  useQuery: (_q: unknown, args: unknown) => (args === 'skip' ? undefined : state.match),
}));
vi.mock('../../components/MatchDetailView', () => ({ MatchDetailView: () => null }));
vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({ isMatchSaved: () => false, toggleMatch: () => undefined }),
}));

import MatchDetailPage from '../MatchDetailPage';
import { TenantContext } from '../TenantContext';

const UUID = '11111111-2222-4333-8444-555555555555';

beforeAll(async () => {
  await i18n.changeLanguage('cs');
});
beforeEach(() => {
  state.match = undefined;
});
afterEach(cleanup);

function mount(match: Record<string, unknown>) {
  state.match = {
    supabaseId: UUID,
    status: 'completed',
    date: Date.now() - 7 * 24 * 3_600_000,
    homeTeamId: 'team-h',
    awayTeamId: 'team-a',
    homeTeamShortName: 'Slavia',
    awayTeamShortName: 'Rakovník',
    homeScore: 0,
    awayScore: 0,
    hasPlayRecord: false,
    resultHomeScore: null,
    resultAwayScore: null,
    decidedByShootout: false,
    ...match,
  };
  return render(
    <TenantContext.Provider value={{ tenantId: 't-union', slug: 'union', tenantName: 'ČSPH' }}>
      <MemoryRouter initialEntries={[`/union/matches/${UUID}`]}>
        <Routes>
          <Route path="/:slug/matches/:matchId" element={<MatchDetailPage />} />
        </Routes>
      </MemoryRouter>
    </TenantContext.Provider>,
  );
}

describe('TEST-005 (Spec-AC-05): fan match detail header', () => {
  it('a completed match without a result shows "Odehráno", never "0 : 0"', () => {
    const { container } = mount({});
    expect(screen.getByTestId('match-detail-header-score').textContent).toBe('Odehráno');
    expect(container.textContent).not.toContain('0 : 0');
  });

  it('a SportsPress result shows that result', () => {
    mount({ resultHomeScore: 0, resultAwayScore: 2 });
    expect(screen.getByTestId('match-detail-header-score').textContent).toBe('0 : 2');
  });

  it('a shootout result carries the marker, with the long form as its title', () => {
    mount({ resultHomeScore: 3, resultAwayScore: 2, decidedByShootout: true });
    const el = screen.getByTestId('match-detail-header-score');
    expect(el.textContent).toBe('3 : 2 sn');
    expect(el.getAttribute('title')).toBe('po nájezdech');
  });

  it('a one-team event names its team once', () => {
    const { container } = mount({ awayTeamId: 'team-h', awayTeamShortName: 'Slavia' });
    expect(container.textContent?.match(/Slavia/g)).toHaveLength(1);
    expect(container.textContent).not.toContain('Rakovník');
  });

  it('an OM-run completed match keeps its timeline score', () => {
    mount({ hasPlayRecord: true, homeScore: 2, awayScore: 1 });
    expect(screen.getByTestId('match-detail-header-score').textContent).toBe('2 : 1');
  });
});
