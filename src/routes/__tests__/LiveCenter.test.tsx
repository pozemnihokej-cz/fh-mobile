/**
 * TEST-010 slice (SPEC-PRD-055 Spec-AC-05): LiveCenter renders the skeleton
 * while loading, the "nothing live" EmptyState when no game is in progress, and
 * a MatchCard per live game once data resolves.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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

describe('LiveCenter', () => {
  it('shows the skeleton while loading', () => {
    state.matches = undefined;
    renderView();
    expect(screen.getByTestId('skel')).toBeDefined();
  });

  it('shows the empty state when no match is live', () => {
    state.matches = [{ _id: '1', supabaseId: 'a', status: 'scheduled', date: 1 }];
    renderView();
    expect(screen.getByText('Teď se nehraje')).toBeDefined();
    expect(screen.queryByTestId('card')).toBeNull();
  });

  it('renders a MatchCard per live game', () => {
    state.matches = [
      { _id: '1', supabaseId: 'live-a', status: 'live', date: 2 },
      { _id: '2', supabaseId: 'sched', status: 'scheduled', date: 1 },
    ];
    renderView();
    const cards = screen.getAllByTestId('card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toBe('live-a');
  });
});
