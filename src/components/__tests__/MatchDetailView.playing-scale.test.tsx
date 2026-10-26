/**
 * TEST-008 (spec-fu-eventtime-break-inclusive-readers-v2, Spec-AC-07, D3).
 *
 * The fan app's "currently suspended" strip, rendered through the REAL `@fh/ui`
 * clock and timeline hooks (imported from their source modules), with only
 * `convex/react` faked. Live state: 4Q, 100 s in, of a `Q,15,[2,10,2]` match;
 * stored card: 10 minutes at playing 2788. Correct: "Zbývá 9:48". The
 * break-inclusive clock dropped the card (-252 with no break model).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const MATCH_ID = '00000000-0000-0000-0000-detail002';
const fx = vi.hoisted(() => ({
  liveState: { phase: '4Q', time: 800, running: false } as any,
  events: [] as any[],
  status: 'in_progress',
}));

vi.mock('convex/react', () => ({
  useQuery: (ref: string, args: unknown) => {
    if (args === 'skip') return undefined;
    if (ref === 'matches.getBySupabaseId') {
      return {
        supabaseId: '00000000-0000-0000-0000-detail002',
        homeTeamName: 'Alpha', awayTeamName: 'Bravo', homeClubName: null, awayClubName: null,
        homeTeamLogo: null, awayTeamLogo: null, homeClubLogo: null, awayClubLogo: null,
        leagueName: 'Extraliga', date: Date.now(), location: 'Praha', status: fx.status, startedAt: Date.now() - 60_000,
        config: { partType: 'Q', gameTime: 15, pauseTimes: [2, 10, 2] },
      };
    }
    if (ref === 'matchControl.getLiveState') return fx.liveState;
    if (ref === 'matchTimeline.listEvents') return fx.events;
    return undefined;
  },
  useMutation: () => vi.fn(async () => undefined),
}));
vi.mock('@convex/_generated/api', () => ({
  api: {
    functions: {
      matches: { getBySupabaseId: 'matches.getBySupabaseId' },
      matchControl: { getLiveState: 'matchControl.getLiveState' },
      matchTimeline: { listEvents: 'matchTimeline.listEvents', addEvent: 'a', removeEvent: 'r', updateEvent: 'u' },
    },
  },
}));

vi.mock('@fh/ui', async () => {
  const clock = await import('../../../../../packages/ui/src/match/hooks/useLiveMatchClock');
  const timeline = await import('../../../../../packages/ui/src/match/hooks/useTimeline');
  const bursts = await import('../../../../../packages/ui/src/match/hooks/useTimelineEventBursts');
  return {
    MatchScoreboard: ({ clock: c }: any) => <div data-testid="scoreboard">{c}</div>,
    MatchTimeline: () => null,
    MatchClock: () => <div data-testid="matchclock" />,
    LiveEventToast: () => null,
    EmptyState: () => null,
    MatchCardSkeleton: () => null,
    FhIcon: () => null,
    focusRing: () => ({}),
    typeScale: { body: {}, bodyStrong: {} },
    useLiveMatchClock: clock.useLiveMatchClock,
    useTimeline: timeline.useTimeline,
    useTimelineEventBursts: bursts.useTimelineEventBursts,
  };
});

import { MatchDetailView } from '../MatchDetailView';

const CARD = { _id: 'card-2788', type: 'card', side: 'home', minute: 46, phase: '4Q', time: 2788, playerName: '7 - Novak Jan', event: { card: 'yellow', duration: 600 } };

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter>
        <MatchDetailView matchId={MATCH_ID} starred={false} onToggleStar={() => undefined} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  fx.events = [];
  fx.liveState = { phase: '4Q', time: 800, running: false };
  fx.status = 'in_progress';
});

describe('TEST-008 the fan app reads the playing clock', () => {
  it('at 4Q + 100 s the 2788 card is listed with 9:48 left', () => {
    fx.events = [CARD];
    renderView();
    expect(screen.getByText('Zbývá 9:48')).toBeInTheDocument();
  });

  it('during HT a 2Q card is frozen at the value it had when 2Q ended', () => {
    // 2Q card at playing 1750, 5 minutes; 2Q ends at 1800 -> 250 s left, frozen through HT.
    fx.events = [{ ...CARD, _id: 'c-2q', time: 1750, phase: '2Q', event: { card: 'yellow', duration: 300 } }];
    fx.liveState = { phase: 'HT', time: 120, running: false }; // 8 min into HT
    renderView();
    expect(screen.getByText('Zbývá 4:10')).toBeInTheDocument();
  });

  it('a completed match left in 4Q at 0:00 lists no suspension (the bound is lifted)', () => {
    // 4Q 0:00 -> playing 3600; a 10-minute card at 3500 would still show 8:20 on a bounded clock.
    fx.events = [{ ...CARD, _id: 'c-late', time: 3500 }];
    fx.liveState = { phase: '4Q', time: 0, running: false };
    renderView();
    expect(screen.getByText('Zbývá 8:20')).toBeInTheDocument();
    cleanup();
    fx.status = 'completed';
    renderView();
    expect(screen.queryByText(/^Zbývá /)).toBeNull();
  });

  it('after the match no suspension is listed', () => {
    fx.events = [CARD];
    fx.liveState = { phase: 'POST', time: 0, running: false };
    renderView();
    expect(screen.queryByText(/^Zbývá /)).toBeNull();
  });
});
