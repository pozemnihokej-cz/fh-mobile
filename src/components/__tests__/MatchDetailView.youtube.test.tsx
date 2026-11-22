/**
 * TEST-004 (Spec-AC-02, Spec-AC-06): visible YouTube stream preview & click-through in MatchDetailView.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { buildTenantTheme } from '@fh/ui';
import { resolveTenantTheme } from '@fh/config';
import { i18n } from '@fh/i18n';
import {
  convexFake,
  resetConvexFake,
  supabaseFake,
  resetSupabaseFake,
} from './_fakes/convexRoster';

const rpcMock = vi.hoisted(() => vi.fn());

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
  return {
    supabase: {
      from: fake.supabaseFake.from,
      rpc: rpcMock,
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
    useTimeline: () => ({
      events: [],
      derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] },
      loaded: false,
    }),
    useLiveMatchClock: () => ({
      time: 0,
      timelineElapsed: 0,
      phase: '1Q',
      running: false,
      colonVisible: true,
      loaded: true,
    }),
    useTimelineEventBursts: () => ({ current: null }),
  };
});

import { MatchDetailView } from '../MatchDetailView';
import { TenantContext } from '../../routes/TenantContext';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const MATCH_ID = '22222222-2222-4222-8222-222222222222';
const theme = buildTenantTheme(resolveTenantTheme('cz-field-hockey-union'), 'dark');

function setupMatch(overrides: Record<string, unknown> = {}) {
  convexFake.match = {
    _id: 'cx-1',
    supabaseId: MATCH_ID,
    homeTeamName: 'Slavia Praha',
    awayTeamName: 'Hostivař',
    date: Date.now() + 3_600_000,
    status: 'scheduled',
    location: 'Eden',
    leagueName: 'Extraliga',
    config: { youtubeVideoId: 'LEGACY_SHOULD_NOT_DUPLICATE' },
    ...overrides,
  };
}

function renderView() {
  return render(
    <MemoryRouter>
      <TenantContext.Provider value={{ tenantId: TENANT_ID, slug: 'csph', tenantName: 'ČSPH' }}>
        <ThemeProvider theme={theme}>
          <MatchDetailView matchId={MATCH_ID} starred={false} onToggleStar={vi.fn()} />
        </ThemeProvider>
      </TenantContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('cs');
  resetConvexFake();
  resetSupabaseFake();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('TEST-004 (Spec-AC-02, Spec-AC-06): MatchDetailView YouTube stream preview', () => {
  it('renders embedded iframe, localized status, and safe YouTube link above tabs on default timeline tab without duplicating in overview', async () => {
    vi.stubEnv('PROD', false);
    setupMatch();
    rpcMock.mockResolvedValue({
      data: [
        {
          match_id: MATCH_ID,
          broadcast_id: 'ytLiveAbc123',
          youtube_url: 'https://www.youtube.com/watch?v=ytLiveAbc123',
          status: 'live',
        },
      ],
      error: null,
    });

    renderView();

    const preview = await screen.findByTestId('match-youtube-preview');
    const tabs = screen.getByTestId('match-detail-tabs');
    // Preview sits visibly BEFORE the tab bar (does not require switching to Overview)
    expect(preview.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const iframe = screen.getByTestId('match-youtube-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('https://www.youtube.com/embed/ytLiveAbc123');
    expect(iframe.getAttribute('loading')).toBe('lazy');

    expect(screen.getByTestId('match-youtube-status').textContent).toBe('ŽIVĚ');

    const link = screen.getByTestId('match-youtube-open');
    expect(link.getAttribute('href')).toBe('https://www.youtube.com/watch?v=ytLiveAbc123');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toContain('Otevřít na YouTube');

    // Switch to Přehled tab: no duplicate player renders from legacy match.config
    fireEvent.click(screen.getByRole('button', { name: 'Přehled' }));
    expect(screen.getAllByTestId('match-youtube-iframe')).toHaveLength(1);
    expect(screen.queryByText('VIDEO PŘENOS')).toBeNull();
  });

  it('renders nothing when no eligible stream exists (ignores legacy match.config.youtubeVideoId)', async () => {
    vi.stubEnv('PROD', false);
    setupMatch();
    rpcMock.mockResolvedValue({ data: [], error: null });

    renderView();
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));

    expect(screen.queryByTestId('match-youtube-preview')).toBeNull();
    expect(screen.queryByTestId('match-youtube-iframe')).toBeNull();
  });

  it('hides preview completely and skips RPC on production build without VITE_ENABLE_FAN_YOUTUBE_PREVIEW=true', async () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_FAN_YOUTUBE_PREVIEW', '');
    setupMatch();

    renderView();
    expect(screen.queryByTestId('match-youtube-preview')).toBeNull();
    expect(screen.queryByTestId('match-youtube-iframe')).toBeNull();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
