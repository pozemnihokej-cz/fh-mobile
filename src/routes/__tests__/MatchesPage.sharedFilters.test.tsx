/**
 * spec-sport-operator-match-list-filters — TEST-010 (Spec-AC-10, D-3).
 *
 * Sport Live computes its filter options and its filtered list through the module it shares
 * with Sport Operator (`@fh/schema` match-list-filters). Visible behaviour stays, except that
 * the option lists now follow Czech alphabetical order ("Č" after "C", not after "Z").
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import MatchesPage from '../MatchesPage';

const queryData = vi.hoisted(() => ({ matches: undefined as any, venues: [] as any }));

vi.mock('convex/react', async () => {
  const { getFunctionName } = await vi.importActual<typeof import('convex/server')>('convex/server');
  return {
    useQuery: vi.fn((ref: unknown) => {
      switch (getFunctionName(ref as never)) {
        case 'functions/matches:list':
          return queryData.matches;
        case 'functions/venues:list':
          return queryData.venues;
        default:
          return undefined;
      }
    }),
  };
});
vi.mock('../TenantContext', () => ({ useTenantContext: () => ({ tenantId: 'tenant-1', tenantName: 'ČSPH' }) }));
vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({ isMatchSaved: () => false, toggleMatch: vi.fn() }),
}));
vi.mock('../../hooks/useNearestVenue', () => ({
  useNearestVenue: () => ({ nearestVenueName: null, nearbyVenues: [], status: 'idle' }),
}));

afterEach(cleanup);
beforeEach(() => sessionStorage.clear());

const now = Date.now();
const row = (id: string, over: Record<string, unknown>) => ({
  _id: id, supabaseId: `s-${id}`, date: now + 3600_000, status: 'scheduled', ...over,
});

function renderPage() {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={fhThemeDark}>
        <MatchesPage />
      </ThemeProvider>
    </BrowserRouter>,
  );
}

describe('TEST-010 (Spec-AC-10): Sport Live on the shared filter module', () => {
  it('option lists follow Czech collation', () => {
    queryData.matches = [
      row('1', { homeTeamName: 'Zlín', awayTeamName: 'Čelákovice', location: 'Žižkov', leagueName: 'Česká liga' }),
      row('2', { homeTeamName: 'Brno', awayTeamName: 'Dolní', location: 'Cheb', leagueName: 'Dorost' }),
    ];
    renderPage();

    fireEvent.mouseDown(screen.getByLabelText('Filtrovat podle týmu'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Všechny týmy', 'Brno', 'Čelákovice', 'Dolní', 'Zlín',
    ]);
    fireEvent.keyDown(screen.getByLabelText('Filtrovat podle týmu'), { key: 'Escape' });

    fireEvent.mouseDown(screen.getByLabelText('Filtrovat podle soutěže'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Všechny soutěže', 'Česká liga', 'Dorost',
    ]);
    fireEvent.keyDown(screen.getByLabelText('Filtrovat podle soutěže'), { key: 'Escape' });

    fireEvent.mouseDown(screen.getByLabelText('Filtrovat podle hřiště'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Všechna hřiště', 'Cheb', 'Žižkov',
    ]);
  });

  it('a team chosen by its short label keeps only that team\'s matches', () => {
    queryData.matches = [
      row('1', { homeTeamName: 'SK Slavia Praha B', homeTeamShortName: 'Slavia B', homeClubName: 'SK Slavia Praha', awayTeamName: 'Hostivař' }),
      row('2', { homeTeamName: 'Kbely', awayTeamName: 'Praga' }),
    ];
    renderPage();
    fireEvent.mouseDown(screen.getByLabelText('Filtrovat podle týmu'));
    fireEvent.click(screen.getByRole('option', { name: 'Slavia B' }));
    expect(screen.getByText('Slavia B')).toBeDefined();
    expect(screen.queryByText('Kbely')).toBeNull();
  });

  it('a value carried only by a cancelled match is not offered (the list never shows it)', () => {
    queryData.matches = [
      row('1', { homeTeamName: 'Brno', awayTeamName: 'Dolní', location: 'Cheb', leagueName: 'Dorost' }),
      row('2', { homeTeamName: 'Zrušený', awayTeamName: 'Dolní', location: 'Zrušené hřiště', leagueName: 'Zrušená liga', status: 'cancelled' }),
    ];
    renderPage();
    for (const [label, gone] of [
      ['Filtrovat podle týmu', 'Zrušený'],
      ['Filtrovat podle soutěže', 'Zrušená liga'],
      ['Filtrovat podle hřiště', 'Zrušené hřiště'],
    ]) {
      fireEvent.mouseDown(screen.getByLabelText(label));
      expect(screen.getAllByRole('option').map((o) => o.textContent)).not.toContain(gone);
      fireEvent.keyDown(screen.getByLabelText(label), { key: 'Escape' });
    }
  });
});
