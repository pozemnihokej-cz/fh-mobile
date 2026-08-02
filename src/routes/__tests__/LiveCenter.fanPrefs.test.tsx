/**
 * SPEC-PRD-034 Spec-AC-14 / Spec-AC-15 — LiveCenter match-star goes through the
 * SINGLE FanPreferencesProvider store (BLOCKING-1 regression guard).
 *
 * Unlike LiveCenter.test.tsx (which mocks useStarredIds/the store away), this
 * renders LiveCenter inside the REAL FanPreferencesProvider so the Live-tab star
 * exercises the same store the Matches/MatchDetail screens use. It proves:
 *   1. a signed-in fan starring a live match reaches Convex (upsert) — the old
 *      useStarredIds path never did;
 *   2. a subsequent Matches-tab star does NOT drop the Live-tab star (both write
 *      the one owned `fh_starred_matches` key via the provider).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const state = vi.hoisted(() => ({ matches: undefined as unknown }));
vi.mock('convex/react', () => ({ useQuery: () => state.matches }));
vi.mock('@convex/_generated/api', () => ({ api: { functions: { matches: { list: 'list' } } } }));
vi.mock('../TenantContext', () => ({ useTenantContext: () => ({ tenantId: 't1', tenantName: 'HC Test' }) }));
vi.mock('@fh/ui', () => ({
  StickyGlassHeader: ({ title, action }: any) => (<div>{title}{action}</div>),
  EmptyState: ({ title }: any) => <div>{title}</div>,
  MatchCardSkeleton: () => <div data-testid="skel" />,
  FhIcon: () => null,
  focusRing: () => ({}),
}));
vi.mock('../../components/MatchCard', () => ({
  MatchCard: ({ match, isStarred, onToggleStar }: any) => (
    <button
      data-testid={`star-${match.supabaseId}`}
      data-starred={isStarred ? '1' : '0'}
      onClick={onToggleStar}
    >
      {match.supabaseId}
    </button>
  ),
}));

// Convex fan-prefs actions — spies so we can assert the Live star reaches Convex.
const getSpy = vi.fn(async (_a: { token: string }) => null as unknown);
const upsertSpy = vi.fn(
  async (_a: { token: string; clubs: string[]; leagues: string[]; matches: string[] }) => 'row-id',
);
const clearSpy = vi.fn(async (_a: { token: string }) => undefined);
vi.mock('../../lib/fanPrefsClient', () => ({
  useFanPrefsActions: () => ({ get: getSpy, upsert: upsertSpy, clear: clearSpy }),
}));

let authState: Record<string, unknown> = { isAuthenticated: false, token: null, user: null };
vi.mock('@fh/auth', () => ({ useAuth: () => authState }));

import LiveCenter from '../LiveCenter';
import { FanPreferencesProvider, useFanPreferences } from '../../lib/useFanPreferences';

// Stands in for a Matches-tab star acting on the SAME provider instance.
function MatchesTabProbe(): JSX.Element {
  const { toggleMatch, isMatchSaved } = useFanPreferences();
  return (
    <button data-testid="matches-tab-star" data-live={isMatchSaved('live-a') ? '1' : '0'} onClick={() => toggleMatch('m-matches')}>
      matches-tab
    </button>
  );
}

const renderView = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter initialEntries={['/hc/live']}>
        <FanPreferencesProvider>
          <LiveCenter />
          <MatchesTabProbe />
        </FanPreferencesProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getSpy.mockResolvedValue(null);
  // A genuinely-live match is in_progress with a recent kickoff (the mirror
  // never writes the literal 'live'); LiveCenter now derives liveness that way.
  state.matches = [{ _id: '1', supabaseId: 'live-a', status: 'in_progress', date: 2, startedAt: Date.now() - 60_000 }];
  authState = { isAuthenticated: true, token: 'tok-abc', user: { id: 'fan-1' } };
});
afterEach(cleanup);

describe('LiveCenter match-star through the FanPreferencesProvider store', () => {
  it('signed-in Live star writes through the provider and reaches Convex upsert', async () => {
    renderView();
    // Sign-in one-shot sync fires first (empty state).
    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());
    upsertSpy.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('star-live-a'));
    });

    // The star reached Convex via the provider (old useStarredIds path did not).
    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());
    const call = upsertSpy.mock.calls[upsertSpy.mock.calls.length - 1][0];
    expect(call.matches).toEqual(['live-a']);
    // ...and the one owned localStorage key holds it.
    expect(JSON.parse(localStorage.getItem('fh_starred_matches') || '[]')).toEqual(['live-a']);
  });

  it('a subsequent Matches-tab star does NOT drop the Live-tab star', async () => {
    renderView();
    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());

    await act(async () => {
      fireEvent.click(screen.getByTestId('star-live-a')); // Live tab stars live-a
    });
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fh_starred_matches') || '[]')).toEqual(['live-a']),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('matches-tab-star')); // Matches tab stars m-matches
    });

    // Both stars survive — single owner of the key, no stale-snapshot overwrite.
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('fh_starred_matches') || '[]').sort()).toEqual(
        ['live-a', 'm-matches'],
      ),
    );
    // The Live card still reads as starred (shared store reflected everywhere).
    expect(screen.getByTestId('matches-tab-star').getAttribute('data-live')).toBe('1');
    expect(screen.getByTestId('star-live-a').getAttribute('data-starred')).toBe('1');
  });
});
