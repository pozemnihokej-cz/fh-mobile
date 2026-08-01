/**
 * TEST-002 (SPEC-fan-app-live-status-derivation Spec-AC-04): MatchDetailView
 * derives its live state via the shared `@fh/schema` derivation over the
 * `startedAt` surfaced by `matches.getBySupabaseId` — NOT the literal Convex
 * `status === 'live'`. A genuinely-live match (in_progress + recent kickoff)
 * renders the live scoreboard (MatchScoreboard `live` + a MatchClock), while a
 * scheduled or completed match renders the status chip instead.
 *
 * Boundary pins (parity with OM's classifyMatchLiveness):
 *   - in_progress + recent startedAt → live scoreboard + clock
 *   - in_progress + stale startedAt  → NOT live (status chip)
 *   - scheduled                      → NOT live (status chip)
 *   - completed                      → NOT live (status chip)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MATCH_LIVE_WINDOW_MS } from '@fh/schema';

const queryState = vi.hoisted(() => ({ match: null as any }));

vi.mock('convex/react', () => ({ useQuery: () => queryState.match }));
vi.mock('@convex/_generated/api', () => ({
  api: { functions: { matches: { getBySupabaseId: 'matches.getBySupabaseId' } } },
}));

// Capture the `live` prop MatchScoreboard receives + whether a MatchClock is
// mounted (the live-only child). The status chip is plain MUI (not mocked).
const scoreboardLive = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('@fh/ui', () => ({
  MatchScoreboard: ({ live, clock }: any) => {
    scoreboardLive.value = live;
    return <div data-testid="scoreboard" data-live={live ? '1' : '0'}>{clock}</div>;
  },
  MatchTimeline: () => null,
  MatchClock: () => <div data-testid="matchclock" />,
  LiveEventToast: () => null,
  EmptyState: () => null,
  MatchCardSkeleton: () => null,
  FhIcon: () => null,
  useTimeline: () => ({ events: [], derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] } }),
  useLiveMatchClock: () => ({ time: 0, totalElapsed: 0, phase: '1Q', running: true, colonVisible: true, loaded: true }),
  useTimelineEventBursts: () => ({ current: null }),
}));

import { MatchDetailView } from '../MatchDetailView';

const now = Date.now();
const baseMatch = {
  homeTeamName: 'Alpha',
  awayTeamName: 'Bravo',
  homeClubName: null,
  awayClubName: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  homeClubLogo: null,
  awayClubLogo: null,
  leagueName: 'Extraliga',
  date: now,
  location: 'Praha',
  config: { partType: 'Q', gameTime: 15 },
};

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter>
        <MatchDetailView matchId="00000000-0000-0000-0000-detail001" starred={false} onToggleStar={() => undefined} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('MatchDetailView live derivation (Spec-AC-04)', () => {
  beforeEach(() => {
    cleanup();
    scoreboardLive.value = undefined;
  });

  it('renders the live scoreboard + clock for a genuinely-live in_progress match', () => {
    queryState.match = { ...baseMatch, status: 'in_progress', startedAt: now - 60_000 };
    renderView();
    expect(screen.getByTestId('scoreboard').getAttribute('data-live')).toBe('1');
    expect(screen.getByTestId('matchclock')).toBeDefined();
  });

  it('is NOT live for an in_progress match started long ago (awaiting closure)', () => {
    queryState.match = { ...baseMatch, status: 'in_progress', startedAt: now - (MATCH_LIVE_WINDOW_MS + 60 * 60_000) };
    renderView();
    expect(screen.getByTestId('scoreboard').getAttribute('data-live')).toBe('0');
    expect(screen.queryByTestId('matchclock')).toBeNull();
  });

  it('is NOT live for a scheduled match (status chip, no clock)', () => {
    queryState.match = { ...baseMatch, status: 'scheduled', startedAt: null };
    renderView();
    expect(screen.getByTestId('scoreboard').getAttribute('data-live')).toBe('0');
    expect(screen.queryByTestId('matchclock')).toBeNull();
  });

  it('is NOT live for a completed match', () => {
    queryState.match = { ...baseMatch, status: 'completed', startedAt: now - 60_000 };
    renderView();
    expect(screen.getByTestId('scoreboard').getAttribute('data-live')).toBe('0');
    expect(screen.queryByTestId('matchclock')).toBeNull();
  });
});
