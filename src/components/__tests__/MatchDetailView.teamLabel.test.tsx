/**
 * spec-fan-app-prod-cleanup-and-team-names TEST-005 (Spec-AC-06) — the match
 * detail scoreboard names a reserve team by its curated short name.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const captured = vi.hoisted(() => ({ scoreboard: undefined as any }));

vi.mock('convex/react', () => ({
  useQuery: (_fn: any, args: any) => {
    if (args?.matchId) return [];
    return {
      _id: 'm1',
      supabaseId: 'match-reserve',
      homeTeamName: 'Slavia ženy B',
      homeTeamShortName: 'Slavia B',
      homeClubName: 'Slavia',
      awayTeamName: 'Rakovník ženy',
      awayTeamShortName: 'Rakovník',
      awayClubName: 'Rakovník',
      date: Date.now() + 3_600_000,
      status: 'scheduled',
    };
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
  MatchScoreboard: (props: any) => {
    captured.scoreboard = props;
    return <div data-testid="scoreboard" />;
  },
  MatchTimeline: () => null,
  MatchClock: () => null,
  LiveEventToast: () => null,
  EmptyState: () => null,
  MatchCardSkeleton: () => null,
  FhIcon: ({ name }: { name: string }) => <span data-testid={`fh-icon-${name}`} />,
  useTimeline: () => ({ events: [], derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] } }),
  useLiveMatchClock: () => ({ time: 0, timelineElapsed: 0, phase: '1Q', running: false, colonVisible: true, loaded: true }),
  useTimelineEventBursts: () => ({ current: null }),
  focusRing: () => ({}),
  typeScale: { body: {}, bodyStrong: {}, h2: {}, caption: {} },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) },
}));

import { MatchDetailView } from '../MatchDetailView';

describe('TEST-005 (Spec-AC-06): match detail scoreboard label', () => {
  it('hands the scoreboard "Slavia B", not the bare club name', () => {
    render(
      <MemoryRouter>
        <ThemeProvider theme={createTheme()}>
          <MatchDetailView matchId="match-reserve" starred={false} onToggleStar={vi.fn()} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    expect(captured.scoreboard.home.name).toBe('Slavia B');
    expect(captured.scoreboard.away.name).toBe('Rakovník');
  });
});
