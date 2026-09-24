import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MatchDetailView } from '../MatchDetailView';

const queryState = vi.hoisted(() => ({
  match: null as any,
  roster: null as any,
}));

vi.mock('convex/react', () => ({
  useQuery: (_fn: any, args: any) => {
    if (args?.matchId) return queryState.roster;
    return queryState.match;
  },
}));

vi.mock('@convex/_generated/api', () => ({
  api: {
    functions: {
      matches: { getBySupabaseId: 'matches.getBySupabaseId' },
      roster: { list: 'roster.list' },
    },
  },
}));

vi.mock('@fh/ui', () => ({
  MatchScoreboard: () => <div data-testid="scoreboard" />,
  MatchTimeline: () => null,
  MatchClock: () => null,
  LiveEventToast: () => null,
  EmptyState: () => null,
  MatchCardSkeleton: () => null,
  FhIcon: ({ name }: { name: string }) => <span data-testid={`fh-icon-${name}`} />,
  useTimeline: () => ({ events: [], derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] } }),
  useLiveMatchClock: () => ({ time: 0, totalElapsed: 0, phase: '1Q', running: true, colonVisible: true, loaded: true }),
  useTimelineEventBursts: () => ({ current: null }),
  focusRing: () => ({}),
  typeScale: { body: {}, bodyStrong: {}, h2: {}, caption: {} },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [] }),
      }),
    }),
  },
}));

const testMatch = {
  _id: 'm1',
  supabaseId: 'match-123',
  homeTeamName: 'Slavia Praha',
  awayTeamName: 'Bohemians Praha',
  homeClubName: 'SK Slavia',
  awayClubName: 'TJ Bohemians',
  homeClubLogo: '/logos/slavia.png',
  awayClubLogo: '/logos/bohemians.png',
  date: Date.now() + 3600_000,
  status: 'scheduled',
  venue: 'Eden',
};

const testRoster = [
  {
    id: 'p1',
    name: 'Jan Novák',
    jerseyNumber: '1',
    position: 'GK',
    role: 'captain',
    side: 'home',
    image: 'https://images.example.com/jan.jpg',
  },
  {
    id: 'p2',
    name: 'Petr Svoboda',
    jerseyNumber: '10',
    position: 'FW',
    role: 'player',
    side: 'guest',
    image: null,
  },
];

describe('MatchDetailView roster and player detail modal', () => {
  beforeEach(() => {
    queryState.match = testMatch;
    queryState.roster = testRoster;
  });

  it('renders roster tab, displays Czech positions, and opens player modal on click', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={createTheme()}>
          <MatchDetailView matchId="match-123" starred={false} onToggleStar={vi.fn()} />
        </ThemeProvider>
      </MemoryRouter>,
    );

    // Switch to roster tab
    const rosterTab = screen.getByRole('button', { name: /soupisky/i });
    fireEvent.click(rosterTab);

    // Check player is rendered with Czech position abbreviation/translation
    await waitFor(() => {
      expect(screen.getByText('Jan Novák')).toBeInTheDocument();
    });

    // GK is mapped to 'Brankář'
    expect(screen.getByText('Brankář')).toBeInTheDocument();

    // Click player row to open modal
    const playerRow = screen.getByText('Jan Novák');
    fireEvent.click(playerRow);

    // Modal opens
    const modal = await screen.findByTestId('player-detail-modal');
    expect(modal).toBeInTheDocument();

    // Modal displays player name, jersey number, team, and Czech position
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('Slavia Praha')).toBeInTheDocument();
    expect(screen.getByText('Kapitán (C)')).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByLabelText('Zavřít detail hráče');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('player-detail-modal')).not.toBeInTheDocument();
    });
  });
});
