/**
 * TEST-001 (SPEC-fan-app-live-status-derivation Spec-AC-01/02): LiveCenter
 * derives "live" via the shared `@fh/schema` `isMatchGenuinelyLive` derivation
 * (kickoff `startedAt` + `status === 'in_progress'` within MATCH_LIVE_WINDOW_MS),
 * NOT the literal Convex `status === 'live'` — a value the Supabase→Convex mirror
 * never writes. Also keeps the loading-skeleton / "nothing live" empty-state
 * boundaries from the original PRD-055 TEST-010 slice.
 *
 * Boundary pins (parity with OM's classifyMatchLiveness):
 *   - in_progress + recent startedAt  → LIVE   (renders a card)
 *   - scheduled                       → not live
 *   - completed                       → not live
 *   - in_progress + stale startedAt   → not live (awaiting_closure)
 *   - in_progress + null startedAt    → not live (awaiting_closure)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MATCH_LIVE_WINDOW_MS } from '@fh/schema';

const state = vi.hoisted(() => ({ matches: undefined as unknown }));

vi.mock('convex/react', () => ({ useQuery: () => state.matches }));
vi.mock('@convex/_generated/api', () => ({ api: { functions: { matches: { list: 'list' } } } }));
vi.mock('../TenantContext', () => ({ useTenantContext: () => ({ tenantId: 't1', tenantName: 'HC Test' }) }));
vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({ isMatchSaved: () => false, toggleMatch: () => undefined }),
}));
vi.mock('@fh/ui', () => ({
  StickyGlassHeader: ({ title, action }: any) => (<div>{title}{action}</div>),
  EmptyState: ({ title }: any) => <div>{title}</div>,
  MatchCardSkeleton: () => <div data-testid="skel" />,
  FhIcon: () => null,
  focusRing: () => ({}),
}));
vi.mock('../../components/MatchCard', () => ({
  MatchCard: ({ match }: any) => <div data-testid="card">{match.supabaseId}</div>,
}));

import LiveCenter from '../LiveCenter';

afterEach(cleanup);

const renderView = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter initialEntries={['/hc/live']}>
        <LiveCenter />
      </MemoryRouter>
    </ThemeProvider>,
  );

const now = Date.now();
const RECENT = now - 60_000; // 1 min ago → within the 3h window
const STALE = now - (MATCH_LIVE_WINDOW_MS + 60 * 60_000); // > 3h ago

describe('LiveCenter', () => {
  it('shows the skeleton while loading', () => {
    state.matches = undefined;
    renderView();
    expect(screen.getByTestId('skel')).toBeDefined();
  });

  it('shows the empty state when nothing is genuinely live', () => {
    // scheduled, completed, stale-in_progress, and null-startedAt in_progress are
    // all NOT live — the live-centre must show its empty state, not a card.
    state.matches = [
      { _id: '1', supabaseId: 'sched', status: 'scheduled', date: now, startedAt: null },
      { _id: '2', supabaseId: 'done', status: 'completed', date: now, startedAt: RECENT },
      { _id: '3', supabaseId: 'stale', status: 'in_progress', date: now, startedAt: STALE },
      { _id: '4', supabaseId: 'nostart', status: 'in_progress', date: now, startedAt: null },
    ];
    renderView();
    expect(screen.getByText('Teď se nehraje')).toBeDefined();
    expect(screen.queryByTestId('card')).toBeNull();
  });

  it('renders a MatchCard for a genuinely-live in_progress match (recent kickoff)', () => {
    // The mirror writes `in_progress` (never `live`); a genuinely-live match is
    // in_progress with a recent kickoff. It MUST appear — the old literal-'live'
    // filter made this permanently invisible.
    state.matches = [
      { _id: '1', supabaseId: 'live-a', status: 'in_progress', date: now, startedAt: RECENT },
      { _id: '2', supabaseId: 'sched', status: 'scheduled', date: now, startedAt: null },
      { _id: '3', supabaseId: 'stale', status: 'in_progress', date: now, startedAt: STALE },
    ];
    renderView();
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toBe('live-a');
  });
});
