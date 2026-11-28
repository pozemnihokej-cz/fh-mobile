/**
 * spec-fan-live-score-header-card-mismatch TEST-001 (Spec-AC-01) + TEST-003 (Spec-AC-03).
 *
 * The fan match detail CARD, rendered through the REAL `@fh/ui` clock and
 * timeline hooks (imported from their source modules), with only `convex/react`
 * faked. Fixture = PROD match #80129 at the moment the owner saw it
 * (2026-11-28 ~10:17): 1Q of a `Q,10,[1,3,1]` match, 5:04 left (playing 296 s),
 * four goal rows — one of them (Seemann, 346.98 s) stamped AHEAD of the clock.
 * `getBySupabaseId` counts every goal row: 2 : 2. The card read 1 : 2.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const MATCH_ID = 'd103748f-b4e9-44d5-8a81-5a5c1b2d0052';
const fx = vi.hoisted(() => ({
  liveState: { phase: '1Q', time: 304, running: false } as any,
  events: [] as any[],
  match: {} as Record<string, unknown>,
  scoreboard: undefined as any,
}));

vi.mock('convex/react', () => ({
  useQuery: (ref: string, args: unknown) => {
    if (args === 'skip') return undefined;
    if (ref === 'matches.getBySupabaseId') return fx.match;
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
    MatchScoreboard: (props: any) => {
      fx.scoreboard = props;
      return <div data-testid="scoreboard" />;
    },
    MatchTimeline: () => null,
    MatchClock: () => null,
    LiveEventToast: () => null,
    EmptyState: () => null,
    MatchCardSkeleton: () => null,
    FhIcon: () => null,
    focusRing: () => ({}),
    typeScale: { body: {}, bodyStrong: {}, h2: {}, caption: {} },
    useLiveMatchClock: clock.useLiveMatchClock,
    useTimeline: timeline.useTimeline,
    useTimelineEventBursts: bursts.useTimelineEventBursts,
  };
});
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) },
}));

import { MatchDetailView } from '../MatchDetailView';

/** PROD #80129 goal rows (Convex `matchTimeline:listEvents`, read-only 2026-11-28), in creation order. */
const GOALS = [
  { _id: 'g1', type: 'goal', side: 'away', phase: '1Q', minute: 0, time: 0, playerName: '6 - Rambousek Marek' },
  { _id: 'g2', type: 'goal', side: 'home', phase: '1Q', minute: 0, time: 24, playerName: '35 - Ostaš Matěj' },
  { _id: 'g3', type: 'goal', side: 'home', phase: '1Q', minute: 5, time: 346.98, playerName: '14 - Seemann Martin' },
  { _id: 'g4', type: 'goal', side: 'away', phase: '1Q', minute: 4, time: 265.02, playerName: '22 - Baxa Jáchym' },
];

function liveMatch(overrides: Record<string, unknown> = {}) {
  return {
    supabaseId: MATCH_ID,
    homeTeamId: 'team-h',
    awayTeamId: 'team-a',
    homeTeamName: 'Rakovník',
    awayTeamName: 'President',
    homeClubName: null,
    awayClubName: null,
    homeTeamLogo: null,
    awayTeamLogo: null,
    homeClubLogo: null,
    awayClubLogo: null,
    leagueName: 'Extraliga muži hala',
    location: 'Rakovník',
    date: Date.now() - 15 * 60_000,
    startedAt: Date.now() - 13 * 60_000,
    status: 'in_progress',
    // getBySupabaseId: readTimeline counts every goal row.
    homeScore: 2,
    awayScore: 2,
    hasPlayRecord: true,
    resultHomeScore: null,
    resultAwayScore: null,
    decidedByShootout: false,
    config: { partType: 'Q', gameTime: 10, pauseTimes: [1, 3, 1] },
    ...overrides,
  };
}

function renderView() {
  render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter>
        <MatchDetailView matchId={MATCH_ID} starred={false} onToggleStar={() => undefined} />
      </MemoryRouter>
    </ThemeProvider>,
  );
  return fx.scoreboard;
}

afterEach(() => {
  cleanup();
  fx.events = [];
  fx.liveState = { phase: '1Q', time: 304, running: false };
  fx.scoreboard = undefined;
});

describe('TEST-001 (Spec-AC-01): the live card counts a goal stamped ahead of the clock', () => {
  it('PROD #80129 at 1Q 5:04 left: the card shows 2 : 2, the header score, not 1 : 2', () => {
    fx.match = liveMatch();
    fx.events = GOALS;
    const sb = renderView();
    expect(sb.live).toBe(true);
    expect(sb.score).toEqual({ home: 2, away: 2 });
  });

  it('the card follows the match score, not a time-bounded recount, at 4:35 left (clock paused there)', () => {
    // Clock at 4:35 left (playing 325 s) — still below the 346.98 s stamp.
    fx.match = liveMatch();
    fx.events = GOALS;
    fx.liveState = { phase: '1Q', time: 275, running: false };
    expect(renderView().score).toEqual({ home: 2, away: 2 });
  });
});

describe('TEST-003 (Spec-AC-03): completed, scheduled and suspensions are unchanged', () => {
  it('a completed OM-run match keeps completedFanScore of the timeline (clock lifted)', () => {
    // The stored aggregate is deliberately different: the completed card does not read it.
    fx.match = liveMatch({ status: 'completed', date: Date.now() - 3 * 3_600_000, startedAt: null, homeScore: 9, awayScore: 9 });
    fx.events = GOALS;
    expect(renderView().score).toEqual({ home: 2, away: 2, shootout: false });
  });

  it('a scheduled match shows no score', () => {
    fx.match = liveMatch({ status: 'scheduled', date: Date.now() + 3 * 3_600_000, startedAt: null, homeScore: 0, awayScore: 0, hasPlayRecord: false });
    expect(renderView().score).toBeNull();
  });

  it('a card stamped after the clock is not in the suspension strip; one before it is', () => {
    fx.match = liveMatch();
    fx.events = [
      ...GOALS,
      { _id: 'c-ahead', type: 'card', side: 'home', phase: '1Q', minute: 5, time: 340, playerName: '7 - Ahead Jan', event: { card: 'green', duration: 60 } },
      { _id: 'c-on', type: 'card', side: 'away', phase: '1Q', minute: 4, time: 280, playerName: '9 - Now Petr', event: { card: 'green', duration: 60 } },
    ];
    renderView();
    // Playing 296 s: the 280 s card has 44 s left; the 340 s card is not issued yet.
    expect(screen.getByText('Zbývá 0:44')).toBeInTheDocument();
    expect(screen.queryAllByText(/^Zbývá /)).toHaveLength(1);
  });
});
