/**
 * TEST-005 (Spec-AC-03): LiveCenter wires useMatchYoutubeStreams onto MatchCard indicators.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import { i18n } from '@fh/i18n';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const LIVE_WITH_STREAM = '22222222-2222-4222-8222-222222222222';
const LIVE_NO_STREAM = '33333333-3333-4333-8333-333333333333';

const state = vi.hoisted(() => ({ matches: [] as any[] }));
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock('convex/react', () => ({ useQuery: () => state.matches }));
vi.mock('@convex/_generated/api', () => ({ api: { functions: { matches: { list: 'list' } } } }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: rpcMock } }));
vi.mock('../TenantContext', () => ({
  useTenantContext: () => ({ tenantId: TENANT_ID, tenantName: 'ČSPH' }),
}));
vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({ isMatchSaved: () => false, toggleMatch: () => undefined }),
}));

import LiveCenter from '../LiveCenter';

beforeEach(async () => {
  await i18n.changeLanguage('cs');
  const recent = Date.now() - 60_000;
  state.matches = [
    {
      _id: 'cx-live-1',
      supabaseId: LIVE_WITH_STREAM,
      homeTeamName: 'Slavia',
      awayTeamName: 'Litice',
      status: 'in_progress',
      date: recent,
      startedAt: recent,
    },
    {
      _id: 'cx-live-2',
      supabaseId: LIVE_NO_STREAM,
      homeTeamName: 'Hostivař',
      awayTeamName: 'Bohemians',
      status: 'in_progress',
      date: recent,
      startedAt: recent,
    },
  ];
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({
    data: [
      {
        match_id: LIVE_WITH_STREAM,
        broadcast_id: 'liveBc12345',
        youtube_url: 'https://www.youtube.com/watch?v=liveBc12345',
        status: 'live',
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
    <ThemeProvider theme={fhThemeDark}>
      <MemoryRouter initialEntries={['/csph/live']}>
        <LiveCenter />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('TEST-005 (Spec-AC-03): LiveCenter YouTube card indicator', () => {
  it('shows YouTube indicator only on the live card with an eligible broadcast', async () => {
    vi.stubEnv('PROD', false);
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('fh-matchcard-youtube')).toHaveLength(1);
    });
  });

  it('hides indicators and skips RPC in production without opt-in flag', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_FAN_YOUTUBE_PREVIEW', '');
    renderPage();

    expect(screen.queryByTestId('fh-matchcard-youtube')).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
