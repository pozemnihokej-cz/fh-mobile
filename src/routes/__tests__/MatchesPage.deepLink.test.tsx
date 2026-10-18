/**
 * PRD-072 / spec-fan-match-list-venue-league-and-maps — `/<slug>/matches?venue=…|league=…` preselects the filter
 * on a fresh load, ignores stale session filters, falls back to the unfiltered list for an unknown value, and drops
 * the parameters once the reader changes the filters. Harness as MatchesPage.features.test.tsx.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import MatchesPage from '../MatchesPage';

const queryData = vi.hoisted(() => ({ matches: undefined as unknown }));

vi.mock('convex/react', async () => {
  const { getFunctionName } = await vi.importActual<typeof import('convex/server')>('convex/server');
  return {
    useQuery: vi.fn((ref: unknown) => {
      switch (getFunctionName(ref as never)) {
        case 'functions/matches:list':
          return queryData.matches;
        case 'functions/venues:list':
          return [];
        case 'functions/matches:earliestDate':
          return null;
        default:
          return undefined;
      }
    }),
  };
});
vi.mock('../TenantContext', () => ({
  useTenantContext: () => ({ tenantId: 'tenant-1', slug: 'e2e-test', tenantName: 'ČSPH' }),
}));
vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({ isMatchSaved: () => false, toggleMatch: vi.fn() }),
}));
vi.mock('../../hooks/useNearestVenue', () => ({
  useNearestVenue: () => ({ nearestVenueName: null, nearbyVenues: [], status: 'idle' }),
}));

const SOON = Date.now() + 3_600_000;
const MATCHES = [
  { _id: 'a', supabaseId: 's-a', homeTeamName: 'Eden Domácí', awayTeamName: 'Eden Hosté', date: SOON, status: 'scheduled', location: ' Hřiště Eden ', venueId: 'v-eden', leagueId: 'l-xl', leagueName: 'Extraliga' },
  { _id: 'b', supabaseId: 's-b', homeTeamName: 'Kbely Domácí', awayTeamName: 'Kbely Hosté', date: SOON + 60_000, status: 'scheduled', location: 'Kbely', venueId: 'v-kbely', leagueId: 'l-dor', leagueName: 'Dorostenci' },
  { _id: 'c', supabaseId: 's-c', homeTeamName: 'Eden Dorost', awayTeamName: 'Eden Soupeř', date: SOON + 120_000, status: 'scheduled', location: 'Hřiště Eden', venueId: 'v-eden', leagueId: 'l-dor', leagueName: 'Dorostenci' },
];

let currentSearch = '';
function LocationProbe() {
  currentSearch = useLocation().search;
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate('/e2e-test/matches?venue=v-eden')}>go-eden</button>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={fhThemeDark}>
        <MatchesPage />
        <LocationProbe />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function visibleHomeTeams(): string[] {
  return ['Eden Domácí', 'Kbely Domácí', 'Eden Dorost'].filter((n) => screen.queryByText(n) !== null);
}

afterEach(cleanup);
beforeEach(() => {
  sessionStorage.clear();
  // A stale session filter the deep link must not reuse.
  sessionStorage.setItem(
    'fh.matches.tenant-1.state',
    JSON.stringify({ selectedVenue: 'Kbely', selectedLeague: 'Dorostenci', selectedTeam: 'Kbely Domácí' }),
  );
  queryData.matches = MATCHES;
});

describe('PRD-072 match list deep links', () => {
  it('?venue=<id> shows only that venue, ignoring the stale session filters', () => {
    renderAt('/e2e-test/matches?venue=v-eden');
    expect(visibleHomeTeams()).toEqual(['Eden Domácí', 'Eden Dorost']);
  });

  it('?league=<id> shows only that competition', () => {
    renderAt('/e2e-test/matches?league=l-dor');
    expect(visibleHomeTeams()).toEqual(['Kbely Domácí', 'Eden Dorost']);
  });

  it('?venueName=<name> works for a match without ids', () => {
    renderAt(`/e2e-test/matches?venueName=${encodeURIComponent('Hřiště Eden')}`);
    expect(visibleHomeTeams()).toEqual(['Eden Domácí', 'Eden Dorost']);
  });

  it('an unknown id falls back to the unfiltered list', () => {
    renderAt('/e2e-test/matches?venue=v-other-tenant');
    expect(visibleHomeTeams()).toEqual(['Eden Domácí', 'Kbely Domácí', 'Eden Dorost']);
  });

  it('applies the deep link once the list has loaded', () => {
    queryData.matches = undefined;
    const view = renderAt('/e2e-test/matches?venue=v-eden');
    queryData.matches = MATCHES;
    view.rerender(
      <MemoryRouter initialEntries={['/e2e-test/matches?venue=v-eden']}>
        <ThemeProvider theme={fhThemeDark}>
          <MatchesPage />
          <LocationProbe />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(visibleHomeTeams()).toEqual(['Eden Domácí', 'Eden Dorost']);
  });

  it('drops the deep-link parameters when the reader clears the filters', () => {
    renderAt('/e2e-test/matches?venue=v-eden');
    expect(currentSearch).toBe('?venue=v-eden');
    fireEvent.click(screen.getByText('Zrušit filtry'));
    expect(currentSearch).toBe('');
    expect(visibleHomeTeams()).toEqual(['Eden Domácí', 'Kbely Domácí', 'Eden Dorost']);
  });

  it('without a deep link the session filters still apply (unchanged behaviour)', () => {
    renderAt('/e2e-test/matches');
    expect(visibleHomeTeams()).toEqual(['Kbely Domácí']);
  });

  it('while the list is still loading, the stale session filter is not shown', () => {
    queryData.matches = undefined;
    renderAt('/e2e-test/matches?venue=v-eden');
    expect(screen.queryByText('Zrušit filtry')).toBeNull();
  });

  it('a deep link reached without remounting the page also resets the team filter', () => {
    renderAt('/e2e-test/matches');
    expect(visibleHomeTeams()).toEqual(['Kbely Domácí']);
    fireEvent.click(screen.getByText('go-eden'));
    expect(currentSearch).toBe('?venue=v-eden');
    expect(visibleHomeTeams()).toEqual(['Eden Domácí', 'Eden Dorost']);
  });
});
