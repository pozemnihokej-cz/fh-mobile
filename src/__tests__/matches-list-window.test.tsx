/**
 * spec-matches-list-bounded-window TEST-007 / TEST-009 (Spec-AC-07, Spec-AC-09)
 * — the fan surfaces bound what Convex reads, and the archive survives it.
 *
 * The fix that makes the list fast is only correct if it does not quietly make
 * the past unreachable. Three things are pinned here:
 *
 *   1. The match list asks for a FLOOR (`fromDate`) and no ceiling.
 *   2. When the reader walks off the end of the fetched window and the tenant
 *      owns something older, the "one day back" affordance is STILL offered and
 *      pushes the floor further back — a refetch, not a dead button.
 *   3. The live centre sends the SAME window, not a tighter one. It renders
 *      matches by ACTUAL kickoff, and kickoff drifts from the scheduled date by
 *      up to 21 days in the live data, so a tight window on the scheduled date
 *      would hide genuinely live matches.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getFunctionName } from 'convex/server';
import { initI18n } from '@fh/i18n';
import { MATCH_LIST_DEFAULT_PAST_DAYS, MATCH_LIST_WIDEN_STEP_DAYS, DAY_MS } from '@fh/schema';

void initI18n();

const LIST = 'functions/matches:list';
const EARLIEST = 'functions/matches:earliestDate';

const { querySpy, results } = vi.hoisted(() => ({
  querySpy: vi.fn(),
  results: { earliest: null as number | null },
}));

/** One future fixture, so the list renders its timetable (and the affordance
 *  above it) instead of the empty state. */
const FUTURE_MATCH = {
  _id: 'm-future',
  supabaseId: 's-future',
  homeTeamName: 'Domácí HC',
  awayTeamName: 'Hosté SK',
  date: Date.now() + 2 * 86_400_000,
  status: 'scheduled',
  venue: 'Hřiště Eden',
};

vi.mock('convex/react', () => ({
  useQuery: (ref: unknown, args: unknown) => querySpy(ref, args),
}));

vi.mock('@fh/auth', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false, token: null }),
}));

import MatchesPage from '../routes/MatchesPage';
import LiveCenter from '../routes/LiveCenter';
import { TenantContext } from '../routes/TenantContext';

const TENANT = 'tenant-under-test';

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function argsFor(udfPath: string) {
  const call = querySpy.mock.calls
    .filter((c) => getFunctionName(c[0] as never) === udfPath)
    .at(-1);
  expect(call, `${udfPath} was never issued`).toBeTruthy();
  return call![1] as Record<string, unknown>;
}

function renderIn(ui: JSX.Element) {
  return render(
    <MemoryRouter>
      <TenantContext.Provider value={{ tenantId: TENANT, tenantName: 'T', slug: 't' } as never}>
        {ui}
      </TenantContext.Provider>
    </MemoryRouter>,
  );
}

// Without this the previous test's page stays mounted and keeps re-rendering,
// so `argsFor` reads ITS last query rather than the one under test.
afterEach(cleanup);

beforeEach(() => {
  querySpy.mockReset();
  sessionStorage.clear();
  results.earliest = null;
  querySpy.mockImplementation((ref: unknown, args: unknown) => {
    if (args === 'skip') return undefined;
    const name = getFunctionName(ref as never);
    if (name === EARLIEST) return results.earliest;
    if (name === LIST) return [FUTURE_MATCH];
    return [];
  });
});

describe('spec-matches-list-bounded-window TEST-007 (Spec-AC-07): the fan match list', () => {
  it('asks for a floor 30 days back from today, and for no ceiling', () => {
    renderIn(<MatchesPage />);
    const args = argsFor(LIST);
    expect(args.tenantId).toBe(TENANT);
    expect(args.fromDate).toBe(startOfDay(Date.now()) - MATCH_LIST_DEFAULT_PAST_DAYS * DAY_MS);
    expect(Object.keys(args).sort()).toEqual(['fromDate', 'tenantId']);
  });

  it('offers no step into the past when the tenant owns nothing older than the window', () => {
    results.earliest = startOfDay(Date.now());
    renderIn(<MatchesPage />);
    expect(screen.queryByTestId('match-list-pull-previous')).toBeNull();
  });

  it('keeps offering the step when the window is exhausted but older matches exist, and widens the floor when it is taken', () => {
    const today = startOfDay(Date.now());
    const firstFloor = today - MATCH_LIST_DEFAULT_PAST_DAYS * DAY_MS;
    // Older than the window reaches — the archive the window would otherwise
    // have ended in front of.
    results.earliest = firstFloor - 400 * DAY_MS;

    renderIn(<MatchesPage />);
    expect(argsFor(LIST).fromDate).toBe(firstFloor);

    const pull = screen.getByTestId('match-list-pull-previous');
    fireEvent.click(pull);

    expect(argsFor(LIST).fromDate).toBe(
      today - (MATCH_LIST_DEFAULT_PAST_DAYS + MATCH_LIST_WIDEN_STEP_DAYS) * DAY_MS,
    );
  });
});

describe('spec-matches-list-bounded-window TEST-009 (Spec-AC-09): the live centre', () => {
  it('sends the SAME window as the match list — not a tighter live-only one', () => {
    renderIn(<LiveCenter />);
    const live = argsFor(LIST);

    querySpy.mockClear();
    renderIn(<MatchesPage />);
    const list = argsFor(LIST);

    expect(live).toEqual(list);
    expect(live.fromDate).toBe(startOfDay(Date.now()) - MATCH_LIST_DEFAULT_PAST_DAYS * DAY_MS);
  });
});
