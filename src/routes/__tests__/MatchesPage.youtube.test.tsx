/**
 * TEST-005 (Spec-AC-03): MatchesPage wires useMatchYoutubeStreams onto MatchCard indicators.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import { i18n } from '@fh/i18n';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const MATCH_WITH_STREAM = '22222222-2222-4222-8222-222222222222';
const MATCH_WITHOUT_STREAM = '33333333-3333-4333-8333-333333333333';

const queryData = vi.hoisted(() => ({
  matches: [] as any[],
  venues: [] as any[],
  earliestDate: null as number | null,
}));
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('convex/react', async () => {
  const { getFunctionName } = await vi.importActual<typeof import('convex/server')>('convex/server');
  return {
    useQuery: vi.fn((ref: unknown) => {
      switch (getFunctionName(ref as never)) {
        case 'functions/matches:list':
          return queryData.matches;
        case 'functions/venues:list':
          return queryData.venues;
        case 'functions/matches:earliestDate':
          return queryData.earliestDate;
        default:
          return undefined;
      }
    }),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock('../TenantContext', () => ({
  useTenantContext: () => ({ tenantId: TENANT_ID, tenantName: 'ČSPH' }),
}));

vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({
    isMatchSaved: () => false,
    toggleMatch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useNearestVenue', () => ({
  useNearestVenue: () => ({
    nearestVenueName: null,
    nearbyVenues: [],
    status: 'unavailable',
  }),
}));

import MatchesPage from '../MatchesPage';

beforeEach(async () => {
  await i18n.changeLanguage('cs');
  sessionStorage.clear();
  const now = Date.now() + 3_600_000;
  queryData.matches = [
    {
      _id: 'cx-1',
      supabaseId: MATCH_WITH_STREAM,
      homeTeamName: 'Slavia',
      awayTeamName: 'Bohemians',
      date: now,
      status: 'scheduled',
      leagueName: 'Extraliga',
    },
    {
      _id: 'cx-2',
      supabaseId: MATCH_WITHOUT_STREAM,
      homeTeamName: 'Hostivař',
      awayTeamName: 'Litice',
      date: now + 60_000,
      status: 'scheduled',
      leagueName: 'Extraliga',
    },
  ];
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({
    data: [
      {
        match_id: MATCH_WITH_STREAM,
        broadcast_id: 'ytMatch1234',
        youtube_url: 'https://www.youtube.com/watch?v=ytMatch1234',
        status: 'ready',
      },
    ],
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
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

describe('TEST-005 (Spec-AC-03): MatchesPage YouTube card indicator', () => {
  it('shows indicator ONLY on cards whose match has an eligible current broadcast', async () => {
    vi.stubEnv('PROD', false);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('fh-matchcard-youtube')).toHaveLength(1);
    });

    const withStreamRow = document.getElementById(`match-item-${MATCH_WITH_STREAM}`)!;
    const withoutStreamRow = document.getElementById(`match-item-${MATCH_WITHOUT_STREAM}`)!;
    expect(within(withStreamRow).getByTestId('fh-matchcard-youtube')).toBeDefined();
    expect(within(withoutStreamRow).queryByTestId('fh-matchcard-youtube')).toBeNull();
  });

  it('hides all card indicators and skips RPC in production without opt-in flag', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_FAN_YOUTUBE_PREVIEW', '');
    renderPage();

    expect(screen.queryByTestId('fh-matchcard-youtube')).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
