/**
 * PRD-072 / spec-fan-match-list-venue-league-and-maps — Match information: competition and venue link to the
 * filtered match list; a Google Maps action to the venue. Harness as MatchDetailView.usability.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { buildTenantTheme } from '@fh/ui';
import { resolveTenantTheme } from '@fh/config';
import {
  convexFake,
  resetConvexFake,
  supabaseFake,
  resetSupabaseFake,
} from './_fakes/convexRoster';

vi.mock('convex/react', async () => {
  const fake = await import('./_fakes/convexRoster');
  return { useQuery: fake.useQueryFake };
});

vi.mock('convex/browser', async () => {
  const fake = await import('./_fakes/convexRoster');
  return { ConvexHttpClient: fake.ConvexHttpClientFake };
});

vi.mock('../../lib/supabase', async () => {
  const fake = await import('./_fakes/convexRoster');
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

vi.mock('@fh/ui', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await importOriginal();
  return {
    ...actual,
    MatchScoreboard: () => <div data-testid="scoreboard" />,
    MatchTimeline: () => null,
    MatchClock: () => null,
    LiveEventToast: () => null,
    useTimeline: () => ({ events: [], derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] }, loaded: false }),
    useLiveMatchClock: () => ({ time: 0, timelineElapsed: 0, phase: '1Q', running: false, colonVisible: true, loaded: true }),
    useTimelineEventBursts: () => ({ current: null }),
  };
});

import { MatchDetailView } from '../MatchDetailView';
import { TenantContext } from '../../routes/TenantContext';

const MATCH_ID = 'match-venue-links-1';
const BASE = {
  _id: 'cx-match-venue-1',
  supabaseId: MATCH_ID,
  homeTeamName: 'Slavia Praha',
  awayTeamName: 'Bohemians Praha',
  date: Date.now() + 3_600_000,
  status: 'scheduled',
  location: 'Hřiště Eden',
  venueId: 'venue-eden',
  leagueId: 'league-xl',
  leagueName: 'Extraliga mužů',
  venueInfo: { name: 'Hřiště Eden', address: 'Vladivostocká 1, Praha', gps: '50.0701, 14.4720' },
};

const theme = buildTenantTheme(resolveTenantTheme('cz-field-hockey-union'), 'dark');

function renderView(match: Record<string, unknown>) {
  convexFake.match = match;
  render(
    <MemoryRouter>
      <TenantContext.Provider value={{ tenantId: 't-1', slug: 'e2e-test', tenantName: 'E2E' }}>
        <ThemeProvider theme={theme}>
          <MatchDetailView matchId={MATCH_ID} starred={false} onToggleStar={vi.fn()} />
        </ThemeProvider>
      </TenantContext.Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /přehled/i }));
  return within(screen.getByTestId('match-info-card'));
}

beforeEach(() => {
  resetConvexFake();
  resetSupabaseFake();
});

describe('PRD-072 Match information links', () => {
  it('links the competition and the venue to the filtered match list by stable id', () => {
    const card = renderView(BASE);
    expect(card.getByRole('link', { name: 'Extraliga mužů' }).getAttribute('href')).toBe('/e2e-test/matches?league=league-xl');
    expect(card.getByRole('link', { name: 'Hřiště Eden' }).getAttribute('href')).toBe('/e2e-test/matches?venue=venue-eden');
  });

  it('offers a Google Maps action to the venue coordinates in a new context, with a Czech accessible name', () => {
    const card = renderView(BASE);
    const maps = card.getByRole('link', { name: 'Navigovat na Hřiště Eden v Google Mapách' });
    expect(maps.getAttribute('href')).toBe('https://www.google.com/maps/dir/?api=1&destination=50.0701%2C14.472');
    expect(maps.getAttribute('target')).toBe('_blank');
    expect(maps.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('falls back to the address when there are no coordinates', () => {
    const card = renderView({ ...BASE, venueInfo: { name: 'Hřiště Eden', address: 'Vladivostocká 1, Praha', gps: null } });
    expect(card.getByRole('link', { name: /Google Mapách/ }).getAttribute('href')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Vladivostock%C3%A1+1%2C+Praha',
    );
  });

  it('renders no Maps action without coordinates or address, and keeps the venue name linked', () => {
    const card = renderView({ ...BASE, venueInfo: { name: 'Hřiště Eden', address: null, gps: null } });
    expect(card.queryByRole('link', { name: /Google Mapách/ })).toBeNull();
    expect(card.getByRole('link', { name: 'Hřiště Eden' }).getAttribute('href')).toBe('/e2e-test/matches?venue=venue-eden');
  });

  it('uses the display-name fallback when the match carries no ids', () => {
    const card = renderView({ ...BASE, venueId: undefined, leagueId: undefined, venueInfo: null });
    expect(card.getByRole('link', { name: 'Extraliga mužů' }).getAttribute('href')).toBe(
      '/e2e-test/matches?leagueName=Extraliga+mu%C5%BE%C5%AF',
    );
    expect(card.getByRole('link', { name: 'Hřiště Eden' }).getAttribute('href')).toBe(
      '/e2e-test/matches?venueName=H%C5%99i%C5%A1t%C4%9B+Eden',
    );
    expect(card.queryByRole('link', { name: /Google Mapách/ })).toBeNull();
  });

  it('keeps unknown values as plain text', () => {
    const card = renderView({ ...BASE, venueId: undefined, leagueId: undefined, leagueName: null, location: '', venueInfo: null });
    expect(card.queryAllByRole('link')).toHaveLength(0);
    expect(card.getByText('Není uvedeno')).toBeTruthy();
  });
});
