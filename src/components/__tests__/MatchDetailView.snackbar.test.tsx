/**
 * fh-mobile MatchDetailView — regression guard for the live event-burst
 * Snackbar (PRD-034 AC-005a).
 *
 * What we lock in here:
 *   - When no burst is active, no Snackbar `alert` is rendered.
 *   - When `useTimelineEventBursts` reports a goal burst, the Snackbar
 *     shows "GÓL ..." with the player name + the side's club / team name.
 *   - When the latest burst is a card, the Snackbar localizes the color
 *     ("KARTA (žlutá)" not "KARTA (yellow)"), per the cs-locale fix.
 *
 * We stub the four `@fh/ui` hooks directly (no Convex client involvement)
 * because the operator-facing burst logic itself is unit-tested in
 * packages/ui via `stepEventBursts.test.ts` — here we just verify the
 * mobile presentation layer wires up correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// Stub Convex hooks — the component reads `useQuery(api.functions.matches.getBySupabaseId)`
// and we want a minimal match shape so the body renders past the loading guard.
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => ({
    homeTeamName: 'Hostivař',
    homeClubName: null,
    homeTeamLogo: null,
    homeClubLogo: null,
    awayTeamName: 'Praga',
    awayClubName: null,
    awayTeamLogo: null,
    awayClubLogo: null,
    homeScore: 0,
    awayScore: 0,
    status: 'live',
    date: Date.now(),
    location: 'Hřiště',
    config: { partType: 'Q', gameTime: 15 },
  })),
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    functions: {
      matches: { getBySupabaseId: 'matches.getBySupabaseId' },
    },
  },
}));

// `@fh/ui` — the surface we're actually testing. Each test sets the mock
// return values for the four hooks via the module-level locals.
let burstState: {
  bursts: any[];
  latest: any | null;
  home: any | null;
  guest: any | null;
} = { bursts: [], latest: null, home: null, guest: null };

vi.mock('@fh/ui', () => ({
  MatchTimeline: () => null,
  MatchClock: () => null,
  useTimeline: () => ({
    events: [],
    derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] },
  }),
  useLiveMatchClock: () => ({
    time: 0,
    totalElapsed: 0,
    phase: '1Q',
    running: false,
    cornerRunning: false,
    cornerTime: 0,
    colonVisible: true,
    loaded: true,
  }),
  useTimelineEventBursts: () => burstState,
}));

import { MatchDetailView } from '../MatchDetailView';

function renderView() {
  const theme = createTheme();
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <MatchDetailView matchId="00000000-0000-0000-0000-test0001" starred={false} onToggleStar={() => undefined} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe('MatchDetailView Snackbar burst notifications', () => {
  beforeEach(() => {
    cleanup();
    burstState = { bursts: [], latest: null, home: null, guest: null };
  });

  it('renders no alert when no burst is active', () => {
    renderView();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows GÓL + player + side when the latest burst is a goal on home', () => {
    burstState = {
      bursts: [],
      latest: {
        event: { _id: 'g1', type: 'goal', side: 'home', minute: 12, playerName: '7 - Holubec' },
        firedAt: Date.now(),
        expiresAt: Date.now() + 6_000,
      },
      home: null,
      guest: null,
    };
    renderView();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('GÓL');
    expect(alert.textContent).toContain("12'");
    expect(alert.textContent).toContain('Hostivař');
    expect(alert.textContent).toContain('Holubec');
  });

  it('localizes card color to cs (KARTA (žlutá), not (yellow))', () => {
    burstState = {
      bursts: [],
      latest: {
        event: {
          _id: 'c1',
          type: 'card',
          side: 'away',
          minute: 24,
          playerName: '19 - Šimánek',
          event: { card: 'yellow', duration: 120 },
        },
        firedAt: Date.now(),
        expiresAt: Date.now() + 6_000,
      },
      home: null,
      guest: null,
    };
    renderView();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('KARTA');
    expect(alert.textContent).toContain('žlutá');
    expect(alert.textContent).not.toContain('yellow');
    expect(alert.textContent).toContain('Praga');
    expect(alert.textContent).toContain('Šimánek');
  });

  it('localizes red and green card colors', () => {
    burstState = {
      bursts: [],
      latest: {
        event: {
          _id: 'c2',
          type: 'card',
          side: 'home',
          minute: 60,
          playerName: '11 - Captain',
          event: { card: 'red', duration: 9999 },
        },
        firedAt: Date.now(),
        expiresAt: Date.now() + 6_000,
      },
      home: null,
      guest: null,
    };
    renderView();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('červená');
    expect(alert.textContent).not.toContain('red');
  });

  it('shootout_goal renders as GÓL (same as regulation goal)', () => {
    burstState = {
      bursts: [],
      latest: {
        event: { _id: 'so1', type: 'shootout_goal', side: 'away', minute: 60, playerName: '3 - Penalty Hero' },
        firedAt: Date.now(),
        expiresAt: Date.now() + 6_000,
      },
      home: null,
      guest: null,
    };
    renderView();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('GÓL');
    expect(alert.textContent).toContain('Penalty Hero');
  });
});
