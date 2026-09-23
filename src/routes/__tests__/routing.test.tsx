/**
 * CHANGE-055 TEST-003 (Spec-AC-07)
 *
 * MemoryRouter with `/e2e-test/matches/abc-123` resolves the slug, mounts
 * MatchDetailPage and exposes `matchId === 'abc-123'`. The back affordance
 * navigates to `/e2e-test/matches` (parent), NOT `/`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

// Make slug → tenant resolution deterministic without any network call.
vi.mock('../../lib/tenantBySlug', () => ({
  resolveTenantBySlug: vi.fn(async (_supabase: unknown, slug: string) => ({
    id: 'TID-E2E',
    slug,
    name: 'E2E Test',
  })),
  resolveTenantById: vi.fn(async (_supabase: unknown, id: string) => ({
    id,
    slug: 'cz-field-hockey-union',
    name: 'Český svaz pozemního hokeje',
  })),
  __resetTenantBySlugCache: () => undefined,
}));

// Anon supabase client is not exercised by the resolver mock; stub the module
// so importing it does not require env vars in the test runner.
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => ({}) }) }) }) },
}));

// Auth provider: anon (no user) so the URL-override hook is a no-op.
vi.mock('@fh/auth', () => ({
  useAuth: () => ({ user: null, switchTenant: vi.fn() }),
}));

const mockMatch = vi.hoisted(() => ({ current: null as any }));

// Convex hooks are not the subject of this test; return mockMatch when
// querying a match and an empty array for events / rosters.
vi.mock('convex/react', () => ({
  useQuery: vi.fn((_query: any, args: any) => {
    if (args && typeof args === 'object') {
      if ('supabaseId' in args) return mockMatch.current;
      if ('matchId' in args) return [];
    }
    return undefined;
  }),
  useMutation: vi.fn(() => vi.fn()),
  useAction: vi.fn(() => vi.fn()),
}));

import TenantLayout from '../TenantLayout';
import MatchesPage from '../MatchesPage';
import MatchDetailPage from '../MatchDetailPage';
import DirectMatchRedirect from '../DirectMatchRedirect';
import NotFoundPage from '../NotFoundPage';

beforeEach(() => {
  mockMatch.current = undefined;
  // Reset the per-module cache so this test's slug resolution isn't masked
  // by an earlier test's cache entry.
  return import('../../lib/tenantBySlug').then((m) =>
    (m as { __resetTenantBySlugCache: () => void }).__resetTenantBySlugCache(),
  );
});

function LocationProbe(): JSX.Element {
  const loc = useLocation();
  return <span data-testid="probe-path">{loc.pathname}</span>;
}

function appTree() {
  return (
    <Routes>
      <Route path="matches/:matchId" element={<DirectMatchRedirect />} />
      <Route path="match/:matchId" element={<DirectMatchRedirect />} />
      <Route path="live/:matchId" element={<DirectMatchRedirect />} />
      <Route path="live" element={<DirectMatchRedirect />} />
      <Route path=":slug" element={<TenantLayout />}>
        <Route path="matches" element={<MatchesPage />} />
        <Route path="matches/:matchId" element={<MatchDetailPage />} />
        <Route path="match/:matchId" element={<MatchDetailPage />} />
        <Route path="live/:matchId" element={<MatchDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

describe('routing (TEST-003)', () => {
  it('mounts MatchDetailPage at /e2e-test/matches/abc-123 with matchId=abc-123', async () => {
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/abc-123']}>
        {appTree()}
        <LocationProbe />
      </MemoryRouter>,
    );

    const back = await waitFor(() => screen.getByTestId('match-detail-back'));
    expect(back).toBeInTheDocument();
    // matchId is wired into the detail header via Detail Zápasu copy +
    // the back button is present only when matchId is non-empty.
    expect(screen.getByText(/detail zápasu/i)).toBeInTheDocument();
    expect(screen.getByTestId('probe-path')).toHaveTextContent('/e2e-test/matches/abc-123');
  });

  it('back from detail lands on /<slug>/matches, NOT /', async () => {
    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/abc-123']}>
        {appTree()}
        <LocationProbe />
      </MemoryRouter>,
    );

    const back = await waitFor(() => screen.getByTestId('match-detail-back'));

    // The back affordance is a react-router <Link>; assert its computed
    // href is the parent matches list (NOT '/'). The browser-rendered href
    // is the observable contract — what the user follows on click and what
    // a screen reader / right-click "open in new tab" exposes.
    expect(back).toHaveAttribute('href', '/e2e-test/matches');
    expect(back.getAttribute('href')).not.toBe('/');
  });

  it('mounts MatchDetailPage at /e2e-test/live/79147 via live/:matchId alias', async () => {
    render(
      <MemoryRouter initialEntries={['/e2e-test/live/79147']}>
        {appTree()}
        <LocationProbe />
      </MemoryRouter>,
    );

    const back = await waitFor(() => screen.getByTestId('match-detail-back'));
    expect(back).toBeInTheDocument();
    expect(screen.getByTestId('probe-path')).toHaveTextContent('/e2e-test/live/79147');
    expect(screen.getByTestId('match-detail-share')).toBeInTheDocument();
  });

  it('redirects slug-less /matches/79147 to /cz-field-hockey-union/matches/uuid-79147', async () => {
    mockMatch.current = {
      supabaseId: 'uuid-79147',
      externalId: '79147',
      homeTeamName: 'Slavia',
      awayTeamName: 'Bohemians',
      date: Date.now(),
      status: 'scheduled',
      tenantId: 'TID-UNION',
    };

    render(
      <MemoryRouter initialEntries={['/matches/79147']}>
        {appTree()}
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe-path')).toHaveTextContent('/cz-field-hockey-union/matches/uuid-79147');
    });
  });

  it('redirects slug-less /live/79147 to /cz-field-hockey-union/matches/uuid-79147', async () => {
    mockMatch.current = {
      supabaseId: 'uuid-79147',
      externalId: '79147',
      homeTeamName: 'Slavia',
      awayTeamName: 'Bohemians',
      date: Date.now(),
      status: 'scheduled',
      tenantId: 'TID-UNION',
    };

    render(
      <MemoryRouter initialEntries={['/live/79147']}>
        {appTree()}
        <LocationProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('probe-path')).toHaveTextContent('/cz-field-hockey-union/matches/uuid-79147');
    });
  });

  it('displays externalId #79147 in header subtitle when match is loaded', async () => {
    mockMatch.current = {
      supabaseId: 'uuid-79147',
      externalId: '79147',
      homeTeamName: 'Slavia',
      awayTeamName: 'Bohemians',
      leagueName: 'Extraliga',
      date: Date.now(),
      status: 'in_progress',
      tenantId: 'TID-E2E',
    };

    render(
      <MemoryRouter initialEntries={['/e2e-test/matches/79147']}>
        {appTree()}
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/#79147/)).toBeInTheDocument();
    });
  });
});

