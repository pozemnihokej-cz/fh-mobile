/**
 * PRD-055 Phase 2 — Spec-AC-04: every new fan screen is a REACHABLE route.
 * Mounts the tenant-scoped route table (TenantLayout → screen) at each path and
 * asserts the screen-identifying testid renders. Tenant resolution, supabase,
 * auth and the read adapters are stubbed so the assertion is about routing, not
 * data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../lib/tenantBySlug', () => ({
  resolveTenantBySlug: vi.fn(async (_s: unknown, slug: string) => ({ id: 'TID', slug, name: 'Org' })),
  __resetTenantBySlugCache: () => undefined,
}));
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({}) }) }) } }));
vi.mock('@fh/auth', () => ({ useAuth: () => ({ user: null, switchTenant: vi.fn() }) }));

// Read adapters: resolve to empty so screens render their container testid fast.
vi.mock('../../lib/adapters/standings', () => ({ fetchStandings: vi.fn(async () => []) }));
vi.mock('../../lib/adapters/schedule', () => ({ fetchSchedule: vi.fn(async () => []) }));
vi.mock('../../lib/adapters/lineup', () => ({ fetchLineup: vi.fn(async () => ({ home: [], guest: [] })) }));
vi.mock('../../lib/adapters/clubDetail', () => ({ fetchClubDetail: vi.fn(async () => null) }));
vi.mock('../../lib/adapters/playerDetail', () => ({ fetchPlayerDetail: vi.fn(async () => null) }));
vi.mock('../../lib/adapters/search', () => ({ fetchSearch: vi.fn(async () => ({ clubs: [], teams: [], players: [], total: 0 })) }));

import TenantLayout from '../TenantLayout';
import StandingsPage from '../StandingsPage';
import SchedulePage from '../SchedulePage';
import SearchPage from '../SearchPage';
import ClubDetailPage from '../ClubDetailPage';
import PlayerDetailPage from '../PlayerDetailPage';
import LineupPage from '../LineupPage';
import OnboardingPage from '../OnboardingPage';
import NewsPage from '../NewsPage';
import NotificationsPage from '../NotificationsPage';
import ProfilePage from '../ProfilePage';

function tree() {
  return (
    <Routes>
      <Route path=":slug" element={<TenantLayout />}>
        <Route path="matches/:matchId/lineup" element={<LineupPage />} />
        <Route path="standings" element={<StandingsPage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="clubs/:clubId" element={<ClubDetailPage />} />
        <Route path="players/:personId" element={<PlayerDetailPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
    </Routes>
  );
}

const ROUTES: Array<[path: string, testid: string]> = [
  ['/org/standings', 'standings-screen'],
  ['/org/schedule', 'schedule-screen'],
  ['/org/search', 'search-screen'],
  ['/org/clubs/C1', 'club-detail-screen'],
  ['/org/players/P1', 'player-detail-screen'],
  ['/org/matches/M1/lineup', 'lineup-screen'],
  ['/org/onboarding', 'onboarding-screen'],
  ['/org/news', 'news-screen'],
  ['/org/notifications', 'notifications-screen'],
  ['/org/profile', 'profile-screen'],
];

beforeEach(() => vi.clearAllMocks());

describe('fan route reachability (Spec-AC-04)', () => {
  it.each(ROUTES)('%s renders %s', async (path, testid) => {
    render(<MemoryRouter initialEntries={[path]}>{tree()}</MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId(testid)).toBeInTheDocument());
  });

  it('the fan bottom nav is mounted on tenant routes', async () => {
    render(<MemoryRouter initialEntries={['/org/standings']}>{tree()}</MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('fan-bottom-nav')).toBeInTheDocument());
    for (const seg of ['matches', 'standings', 'schedule', 'search', 'profile']) {
      expect(screen.getByTestId(`fan-nav-${seg}`)).toBeInTheDocument();
    }
  });
});
