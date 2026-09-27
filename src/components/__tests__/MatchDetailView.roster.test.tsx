import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
    expect(screen.getByText('SK Slavia')).toBeInTheDocument();
    expect(screen.getByText('Kapitán (C)')).toBeInTheDocument();

    // Verify photo card renders with rounded corners
    const photoImg = modal.querySelector('img[alt="Jan Novák"]');
    expect(photoImg).toBeInTheDocument();
    const avatarContainer = photoImg?.parentElement as HTMLElement;
    expect(avatarContainer).toHaveStyle({ border: '1px solid rgba(255, 255, 255, 0.14)' });

    // Close modal
    const closeBtn = screen.getByLabelText('Zavřít detail hráče');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('player-detail-modal')).not.toBeInTheDocument();
    });
  });

  it('renders guest team roster, and opens guest player modal with guest team metadata and frameless avatar', async () => {
    // Give guest player an image and captaincy to test full presentation
    queryState.roster = [
      ...testRoster.slice(0, 1),
      {
        id: 'p2',
        name: 'Petr Svoboda',
        jerseyNumber: '10',
        position: 'FW',
        role: 'captain',
        side: 'away',
        image: 'https://images.example.com/petr.jpg',
      },
    ];

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

    // Click Guest tab button (Bohemians Praha / TJ Bohemians)
    const guestTabBtn = screen.getByRole('button', { name: /bohemians/i });
    fireEvent.click(guestTabBtn);

    // Check guest player is visible
    await waitFor(() => {
      expect(screen.getByText('Petr Svoboda')).toBeInTheDocument();
    });

    // Check roster row retains 1px solid border
    const guestPlayerRow = screen.getByTestId('lineup-player');
    const rosterAvatar = guestPlayerRow.querySelector('.MuiAvatar-root');
    expect(rosterAvatar).toBeInTheDocument();
    expect(rosterAvatar).toHaveStyle({ border: '1px solid rgba(255, 255, 255, 0.12)' });

    // Click guest player row to open modal
    fireEvent.click(guestPlayerRow);

    // Modal opens
    const modal = await screen.findByTestId('player-detail-modal');
    expect(modal).toBeInTheDocument();

    // Modal displays guest team name (TJ Bohemians) and #10
    expect(within(modal).getByText('#10')).toBeInTheDocument();
    expect(within(modal).getByText('TJ Bohemians')).toBeInTheDocument();
    expect(within(modal).getByText('Petr Svoboda')).toBeInTheDocument();

    // Modal photo renders with card border
    const photoImg = modal.querySelector('img[alt="Petr Svoboda"]');
    expect(photoImg).toBeInTheDocument();
    const avatarContainer = photoImg?.parentElement as HTMLElement;
    expect(avatarContainer).toHaveStyle({ border: '1px solid rgba(255, 255, 255, 0.14)' });
  });
});
