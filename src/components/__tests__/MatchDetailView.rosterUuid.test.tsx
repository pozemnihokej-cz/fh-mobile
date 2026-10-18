/**
 * ISSUE-212 / SPEC-208 TEST-005.
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
const childIds = vi.hoisted(() => ({ timeline: [] as unknown[], clock: [] as unknown[] }));
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
    useTimeline: (id: unknown) => {
      childIds.timeline.push(id);
      return { events: [], derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] }, loaded: false };
    },
    useLiveMatchClock: (id: unknown) => {
      childIds.clock.push(id);
      return { time: 0, totalElapsed: 0, phase: '1Q', running: false, colonVisible: true, loaded: true };
    },
    useTimelineEventBursts: () => ({ current: null }),
  };
});

import { MatchDetailView } from '../MatchDetailView';
import { TenantContext } from '../../routes/TenantContext';

/**
 * ISSUE-212 / SPEC-208 TEST-005 (Spec-AC-05). `/<slug>/live/<number>`: the roster, timeline, clock and lineup
 * reads take the UUID the tenant-scoped match read resolved, never the raw number (`roster:list` takes no tenant).
 * Harness as MatchDetailView.tenantRead.test.tsx.
 */
const NUMBER = '23111';
const theme = buildTenantTheme(resolveTenantTheme('cz-field-hockey-union'), 'dark');

function mount(matchId: string) {
  return render(
    <MemoryRouter>
      <TenantContext.Provider value={{ tenantId: 't-union', slug: 'cz-field-hockey-union', tenantName: 'ČSPH' }}>
        <ThemeProvider theme={theme}>
          <MatchDetailView matchId={matchId} starred={false} onToggleStar={vi.fn()} />
        </ThemeProvider>
      </TenantContext.Provider>
    </MemoryRouter>,
  );
}

const rosterArgs = () => convexFake.calls.filter((c) => c.name === 'functions/roster:list').map((c) => c.args as any);
const everyChildId = () => [...childIds.timeline, ...childIds.clock, ...fetchLineupSpy.calls, ...rosterArgs().map((a) => a.matchId)];

beforeEach(() => {
  resetConvexFake();
  resetSupabaseFake();
  fetchLineupSpy.calls = [];
  childIds.timeline = [];
  childIds.clock = [];
});

describe('TEST-005 (Spec-AC-05): fan match detail child reads use the resolved UUID', () => {
  it('while the match read loads, no child read carries the URL number', () => {
    convexFake.match = undefined;
    mount(NUMBER);
    expect(rosterArgs()).toEqual([]);
    expect(everyChildId().filter((id) => id === NUMBER)).toEqual([]);
  });

  it('once resolved, roster / timeline / clock / lineup read the UUID', () => {
    convexFake.match = { supabaseId: 'uuid-union', externalId: NUMBER, status: 'scheduled', date: 0 };
    mount(NUMBER);
    expect(rosterArgs().length).toBeGreaterThan(0);
    expect(rosterArgs().every((a) => a.matchId === 'uuid-union')).toBe(true);
    expect(everyChildId().filter((id) => id === NUMBER)).toEqual([]);
    expect(childIds.timeline).toContain('uuid-union');
  });

  it('a null match read keeps a UUID URL readable by its own id', () => {
    convexFake.match = null;
    mount('uuid-route');
    expect(rosterArgs().every((a) => a.matchId === 'uuid-route')).toBe(true);
    expect(rosterArgs().length).toBeGreaterThan(0);
  });
});
