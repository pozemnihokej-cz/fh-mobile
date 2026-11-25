/**
 * spec-match-report-events-chronological — TEST-010 (Spec-AC-10).
 *
 * The fan app's match timeline is the shared `MatchTimeline` without an `order`: it stays newest
 * first (the live feed fans follow) and offers no order control, even on a device where the
 * operator app stored a chronological choice. Rendered through the REAL `@fh/ui` timeline
 * component and hooks (source modules), with only `convex/react` faked.
 *
 * Run: cd apps/fh-mobile && npx vitest run --maxWorkers=4 src/components/__tests__/MatchDetailView.timeline-order.test.tsx
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const MATCH_ID = '00000000-0000-0000-0000-detail002';
const fx = vi.hoisted(() => ({
  liveState: { phase: 'POST', time: 0, running: false } as any,
  events: [] as any[],
  status: 'completed',
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
    // The REAL shared timeline: this test pins what the fan sees.
    MatchTimeline: (await import('../../../../../packages/ui/src/match/components/MatchTimeline')).MatchTimeline,
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

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter>
        <MatchDetailView matchId={MATCH_ID} starred={false} onToggleStar={() => undefined} />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const rowIds = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('[data-testid^="timeline-event-"]')).map((el) =>
    (el.getAttribute('data-testid') ?? '').replace(/^timeline-event-/, ''),
  );

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('TEST-010 (Spec-AC-10): the fan app timeline stays newest first', () => {
  it('4Q row before 1Q row, no order control, despite a stored chronological choice', () => {
    window.localStorage.setItem('fh_om_events_timeline_order', 'chronological');
    fx.events = [
      { _id: 'q1', type: 'goal', side: 'home', minute: 3, phase: '1Q', time: 180, playerName: '9 - Prvni Gol', createdAt: 1 },
      { _id: 'q2', type: 'goal', side: 'away', minute: 19, phase: '2Q', time: 1140, playerName: '8 - Druhy Gol', createdAt: 2 },
      { _id: 'q4', type: 'injury', side: 'home', minute: 51, phase: '4Q', time: 3060, playerName: '7 - Ctvrty', createdAt: 3 },
    ];
    const { container } = renderView();
    expect(rowIds(container)).toEqual(['q4', 'q2', 'q1']);
    expect(container.querySelector('[data-testid="events-timeline-order-toggle"]')).toBeNull();
  });
});
