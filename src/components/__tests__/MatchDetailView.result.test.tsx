/**
 * spec-match-display-no-score-one-team-shootout TEST-005 (Spec-AC-05) — the fan
 * match detail SCOREBOARD gets the final score (mirrored result for a match not
 * run in OM, the live-derived timeline otherwise), the played placeholder when
 * there is no result, the shootout flag, and the one-team flag.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { i18n } from '@fh/i18n';

const captured = vi.hoisted(() => ({ scoreboard: undefined as any, match: undefined as any, timeline: { home: 0, away: 0 } }));

vi.mock('convex/react', () => ({
  useQuery: (_fn: any, args: any) => (args?.matchId ? [] : captured.match),
}));
vi.mock('@convex/_generated/api', () => ({
  api: { functions: { matches: { getBySupabaseId: 'matches.getBySupabaseId' }, roster: { list: 'roster.list' } } },
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
  useTimeline: () => ({ events: [], derivedState: { score: captured.timeline, activeSuspensions: [] } }),
  useLiveMatchClock: () => ({ time: 0, timelineElapsed: 0, phase: '1Q', running: false, colonVisible: true, loaded: true }),
  useTimelineEventBursts: () => ({ current: null }),
  focusRing: () => ({}),
  typeScale: { body: {}, bodyStrong: {}, h2: {}, caption: {} },
}));
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) },
}));

import { MatchDetailView } from '../MatchDetailView';

beforeAll(async () => {
  await i18n.changeLanguage('cs');
});

function mount(match: Record<string, unknown>, timeline = { home: 0, away: 0 }) {
  captured.timeline = timeline;
  captured.match = {
    _id: 'm1',
    supabaseId: 'm-1',
    homeTeamId: 'team-h',
    awayTeamId: 'team-a',
    homeTeamShortName: 'Slavia',
    awayTeamShortName: 'Rakovník',
    date: Date.now() - 7 * 24 * 3_600_000,
    status: 'completed',
    homeScore: 0,
    awayScore: 0,
    hasPlayRecord: false,
    resultHomeScore: null,
    resultAwayScore: null,
    decidedByShootout: false,
    ...match,
  };
  render(
    <MemoryRouter>
      <ThemeProvider theme={createTheme()}>
        <MatchDetailView matchId="m-1" starred={false} onToggleStar={vi.fn()} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return captured.scoreboard;
}

describe('TEST-005 (Spec-AC-05): fan match detail scoreboard', () => {
  it('no result -> no score, the played placeholder', () => {
    const sb = mount({});
    expect(sb.score).toBeNull();
    expect(sb.placeholder).toBe('Odehráno');
  });

  it('a SportsPress shootout result -> that score with the shootout flag and the long label', () => {
    const sb = mount({ resultHomeScore: 3, resultAwayScore: 2, decidedByShootout: true });
    expect(sb.score).toEqual({ home: 3, away: 2, shootout: true });
    expect(sb.shootoutLabel).toBe('po nájezdech');
  });

  it('an OM-run match -> the live-derived timeline score', () => {
    const sb = mount({ hasPlayRecord: true }, { home: 2, away: 1 });
    expect(sb.score).toEqual({ home: 2, away: 1, shootout: false });
  });

  it('a one-team event -> singleTeam', () => {
    expect(mount({ awayTeamId: 'team-h' }).singleTeam).toBe(true);
    expect(mount({}).singleTeam).toBe(false);
  });
});
