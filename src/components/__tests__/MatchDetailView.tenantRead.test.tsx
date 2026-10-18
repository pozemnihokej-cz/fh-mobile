/**
 * ISSUE-199 / spec-match-read-untenanted-external-id — TEST-007 (Spec-AC-04). `/<slug>/live/<SportsPress number>`
 * mounts the detail with an external id; the read must carry the URL tenant. Harness as
 * MatchDetailView.venueLinks.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { buildTenantTheme } from '@fh/ui';
import { resolveTenantTheme } from '@fh/config';
import {
  convexFake,
  resetConvexFake,
  supabaseFake,
  resetSupabaseFake,
} from './_fakes/convexRoster';

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
  return { supabase: fake.supabaseFake };
});

const fetchLineupSpy = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('../../lib/adapters/lineup', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchLineup: (sb: unknown, matchId: string) => {
      fetchLineupSpy.calls.push(matchId);
      return actual.fetchLineup(sb, matchId);
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
    useTimeline: () => ({ events: [], derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] }, loaded: false }),
    useLiveMatchClock: () => ({ time: 0, totalElapsed: 0, phase: '1Q', running: false, colonVisible: true, loaded: true }),
    useTimelineEventBursts: () => ({ current: null }),
  };
});

import { MatchDetailView } from '../MatchDetailView';
import { TenantContext } from '../../routes/TenantContext';

const MATCH_ID = '23111';
const theme = buildTenantTheme(resolveTenantTheme('cz-field-hockey-union'), 'dark');

beforeEach(() => {
  resetConvexFake();
  resetSupabaseFake();
});

describe('TEST-007 (Spec-AC-04): the fan match detail reads the match inside the URL tenant', () => {
  it('passes the URL tenant id with the match id to matches:getBySupabaseId', () => {
    convexFake.match = null;
    render(
      <MemoryRouter>
        <TenantContext.Provider value={{ tenantId: 't-union', slug: 'cz-field-hockey-union', tenantName: 'ČSPH' }}>
          <ThemeProvider theme={theme}>
            <MatchDetailView matchId={MATCH_ID} starred={false} onToggleStar={vi.fn()} />
          </ThemeProvider>
        </TenantContext.Provider>
      </MemoryRouter>,
    );
    const reads = convexFake.calls.filter((c) => c.name === 'functions/matches:getBySupabaseId');
    expect(reads.length).toBeGreaterThan(0);
    for (const r of reads) expect(r.args).toEqual({ supabaseId: MATCH_ID, tenantId: 't-union' });
  });
});
