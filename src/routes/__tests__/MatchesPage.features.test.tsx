import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import MatchesPage from '../MatchesPage';

// Hoist mock states
const queryData = vi.hoisted(() => ({
  matches: undefined as any,
  venues: [] as any,
}));

let callIdx = 0;
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => {
    callIdx += 1;
    // 1st call is matches, 2nd call is venues
    return (callIdx % 2 === 1) ? queryData.matches : queryData.venues;
  }),
}));

vi.mock('../TenantContext', () => ({
  useTenantContext: () => ({ tenantId: 'tenant-1', tenantName: 'ČSPH' }),
}));

vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({
    isMatchSaved: () => false,
    toggleMatch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useNearestVenue', () => ({
  useNearestVenue: () => ({
    nearestVenueName: 'Hřiště Eden',
    status: 'found',
  }),
}));

afterEach(cleanup);
beforeEach(() => {
  callIdx = 0;
});

const now = Date.now();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe('MatchesPage timeline and features', () => {
  it('renders compact skeletons while matches are loading', () => {
    queryData.matches = undefined;
    queryData.venues = [];

    render(
      <BrowserRouter>
        <ThemeProvider theme={fhThemeDark}>
          <MatchesPage />
        </ThemeProvider>
      </BrowserRouter>,
    );

    const skeletons = screen.getAllByTestId('match-card-skeleton-compact');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders today and future matches, hiding past matches behind pull-previous button', () => {
    const pastMatch = {
      _id: 'm-past',
      supabaseId: 's-past',
      homeTeamName: 'Minulost HC',
      awayTeamName: 'Historie SK',
      date: now - 2 * ONE_DAY_MS,
      status: 'completed',
      homeScore: 3,
      awayScore: 1,
      venue: 'Hřiště Eden',
    };

    const todayMatch = {
      _id: 'm-today',
      supabaseId: 's-today',
      homeTeamName: 'Dnes HC',
      awayTeamName: 'Současnost SK',
      date: now + 3600_000,
      status: 'scheduled',
      venue: 'Hřiště Eden',
    };

    queryData.matches = [pastMatch, todayMatch];
    queryData.venues = [{ name: 'Hřiště Eden', gps: '50.0, 14.0' }];

    render(
      <BrowserRouter>
        <ThemeProvider theme={fhThemeDark}>
          <MatchesPage />
        </ThemeProvider>
      </BrowserRouter>,
    );

    // Today's match is visible immediately with VS instead of 0:0
    expect(screen.getByText('Dnes HC')).toBeDefined();
    expect(screen.getByText('Současnost SK')).toBeDefined();
    expect(screen.getByText('VS')).toBeDefined();
    expect(screen.queryByText('0:0')).toBeNull();

    // Past match is hidden by default
    expect(screen.queryByText('Minulost HC')).toBeNull();

    // Pull-previous button is rendered
    const pullBtn = screen.getByTestId('match-list-pull-previous');
    expect(pullBtn).toBeDefined();

    // Clicking pull-previous reveals the past match
    fireEvent.click(pullBtn);
    expect(screen.getByText('Minulost HC')).toBeDefined();
    expect(screen.getByText('Historie SK')).toBeDefined();
    expect(screen.getByText('3:1')).toBeDefined();
  });

  it('filters matches when clicking venue chip', () => {
    const matchEden = {
      _id: 'm-1',
      supabaseId: 's-1',
      homeTeamName: 'Eden Domácí',
      awayTeamName: 'Eden Hosté',
      date: now + 3600_000,
      status: 'scheduled',
      venue: 'Hřiště Eden',
    };

    const matchLoko = {
      _id: 'm-2',
      supabaseId: 's-2',
      homeTeamName: 'Loko Domácí',
      awayTeamName: 'Loko Hosté',
      date: now + 7200_000,
      status: 'scheduled',
      venue: 'Hřiště Loko',
    };

    queryData.matches = [matchEden, matchLoko];
    queryData.venues = [
      { name: 'Hřiště Eden', gps: '50.0, 14.0' },
      { name: 'Hřiště Loko', gps: '50.1, 14.1' },
    ];

    render(
      <BrowserRouter>
        <ThemeProvider theme={fhThemeDark}>
          <MatchesPage />
        </ThemeProvider>
      </BrowserRouter>,
    );

    expect(screen.getByText('Eden Domácí')).toBeDefined();
    expect(screen.getByText('Loko Domácí')).toBeDefined();

    // Click nearby venue chip (Hřiště Eden)
    const nearbyChip = screen.getByTestId('nearby-venue-chip');
    fireEvent.click(nearbyChip);

    // Only Eden match is shown
    expect(screen.getByText('Eden Domácí')).toBeDefined();
    expect(screen.queryByText('Loko Domácí')).toBeNull();
  });

  it('renders venue autocomplete list box and filters when selecting an option', () => {
    const matchEden = {
      _id: 'm-1',
      supabaseId: 's-1',
      homeTeamName: 'Eden Domácí',
      awayTeamName: 'Eden Hosté',
      date: now + 3600_000,
      status: 'scheduled',
      venue: 'Hřiště Eden',
    };

    const matchLoko = {
      _id: 'm-2',
      supabaseId: 's-2',
      homeTeamName: 'Loko Domácí',
      awayTeamName: 'Loko Hosté',
      date: now + 7200_000,
      status: 'scheduled',
      venue: 'Hřiště Loko',
    };

    queryData.matches = [matchEden, matchLoko];
    queryData.venues = [
      { name: 'Hřiště Eden', gps: '50.0, 14.0' },
      { name: 'Hřiště Loko', gps: '50.1, 14.1' },
    ];

    render(
      <BrowserRouter>
        <ThemeProvider theme={fhThemeDark}>
          <MatchesPage />
        </ThemeProvider>
      </BrowserRouter>,
    );

    const autocomplete = screen.getByTestId('venue-filter-autocomplete');
    expect(autocomplete).toBeDefined();

    const input = screen.getByPlaceholderText('Filtrovat podle hřiště…');
    expect(input).toBeDefined();

    // Open autocomplete popup and select Hřiště Loko
    fireEvent.mouseDown(input);
    const option = screen.getByText('Hřiště Loko');
    fireEvent.click(option);

    expect(screen.getByText('Loko Domácí')).toBeDefined();
    expect(screen.queryByText('Eden Domácí')).toBeNull();
  });

  it('renders match items with xs={12} and md={6} avoiding 2-column sm={6} on portrait tablets', () => {
    const testMatch = {
      _id: 'm-grid-test',
      supabaseId: 's-grid-test',
      homeTeamName: 'TJ Sokol Kbely A',
      awayTeamName: 'HC Slavia Praha B',
      date: now + 3600_000,
      status: 'scheduled',
      venue: 'Hřiště Kbely',
    };

    queryData.matches = [testMatch];
    queryData.venues = [{ name: 'Hřiště Kbely', gps: '50.0, 14.0' }];

    const { container } = render(
      <BrowserRouter>
        <ThemeProvider theme={fhThemeDark}>
          <MatchesPage />
        </ThemeProvider>
      </BrowserRouter>,
    );

    const matchCard = screen.getByText('TJ Sokol Kbely A').closest('[class*="MuiGrid-item"]');
    expect(matchCard).not.toBeNull();
    expect(matchCard?.className).toContain('MuiGrid-grid-xs-12');
    expect(matchCard?.className).toContain('MuiGrid-grid-md-6');
    // Ensure sm-6 is NOT present so portrait tablets do not divide into 2 columns
    expect(matchCard?.className).not.toContain('MuiGrid-grid-sm-6');
  });

  it('renders toolbar return button linking back to tenant list (/)', () => {
    queryData.matches = [];
    queryData.venues = [];

    render(
      <BrowserRouter>
        <ThemeProvider theme={fhThemeDark}>
          <MatchesPage />
        </ThemeProvider>
      </BrowserRouter>,
    );

    const backBtn = screen.getByLabelText('Zpět na výběr svazu');
    expect(backBtn).toBeDefined();
    expect(backBtn.getAttribute('href')).toBe('/');
  });

  it('limits future matches to 1 week forward by default and loads more on demand via pull-next', () => {
    const todayMatch = {
      _id: 'm-today',
      supabaseId: 's-today',
      homeTeamName: 'Dnes HC',
      awayTeamName: 'Současnost SK',
      date: now + 3600_000,
      status: 'scheduled',
      venue: 'Hřiště Eden',
    };

    const inThreeDaysMatch = {
      _id: 'm-3days',
      supabaseId: 's-3days',
      homeTeamName: 'Tento Týden HC',
      awayTeamName: 'Tento Týden SK',
      date: now + 3 * ONE_DAY_MS,
      status: 'scheduled',
      venue: 'Hřiště Eden',
    };

    const inTenDaysMatch = {
      _id: 'm-10days',
      supabaseId: 's-10days',
      homeTeamName: 'Budoucnost HC',
      awayTeamName: 'Příští Týden SK',
      date: now + 10 * ONE_DAY_MS,
      status: 'scheduled',
      venue: 'Hřiště Eden',
    };

    queryData.matches = [todayMatch, inThreeDaysMatch, inTenDaysMatch];
    queryData.venues = [{ name: 'Hřiště Eden', gps: '50.0, 14.0' }];

    render(
      <BrowserRouter>
        <ThemeProvider theme={fhThemeDark}>
          <MatchesPage />
        </ThemeProvider>
      </BrowserRouter>,
    );

    // Today and in-three-days matches are within 1 week, so visible immediately
    expect(screen.getByText('Dnes HC')).toBeDefined();
    expect(screen.getByText('Tento Týden HC')).toBeDefined();

    // 10-days ahead match is beyond 1 week, so hidden initially
    expect(screen.queryByText('Budoucnost HC')).toBeNull();

    // Pull-next button is rendered with day info
    const pullNextBtn = screen.getByTestId('match-list-pull-next');
    expect(pullNextBtn).toBeDefined();

    // Click pull-next to reveal future matches (+ 1 week)
    fireEvent.click(pullNextBtn);

    // Now the 10-days match is revealed
    expect(screen.getByText('Budoucnost HC')).toBeDefined();
    // No more future matches beyond that, so pull-next button is gone
    expect(screen.queryByTestId('match-list-pull-next')).toBeNull();
  });
});

