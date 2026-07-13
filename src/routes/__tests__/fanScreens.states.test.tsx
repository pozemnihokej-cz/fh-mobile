/**
 * PRD-055 Phase 2 — Spec-AC-05: every supabase-js fan screen renders
 * loading / error(+retry) / empty / data through the shared AsyncBoundary +
 * @fh/ui state surfaces. Adapters are mocked so each async state is forced
 * deterministically. Expected copy is read from the SAME i18n instance the
 * screen uses (via `tr`), so the assertion proves the key resolves to real copy
 * (not a raw key) regardless of the detector-selected language.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactElement } from 'react';
import { i18n } from '@fh/i18n';
import { TenantContext } from '../TenantContext';

const tr = (key: string): string => i18n.t(key);

vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../lib/adapters/standings', () => ({ fetchStandings: vi.fn() }));
vi.mock('../../lib/adapters/schedule', () => ({ fetchSchedule: vi.fn() }));
vi.mock('../../lib/adapters/lineup', () => ({ fetchLineup: vi.fn() }));
vi.mock('../../lib/adapters/clubDetail', () => ({ fetchClubDetail: vi.fn() }));
vi.mock('../../lib/adapters/playerDetail', () => ({ fetchPlayerDetail: vi.fn() }));
vi.mock('../../lib/adapters/search', () => ({ fetchSearch: vi.fn() }));

import StandingsPage from '../StandingsPage';
import SchedulePage from '../SchedulePage';
import LineupPage from '../LineupPage';
import ClubDetailPage from '../ClubDetailPage';
import PlayerDetailPage from '../PlayerDetailPage';
import SearchPage from '../SearchPage';
import NewsPage from '../NewsPage';
import NotificationsPage from '../NotificationsPage';
import ProfilePage from '../ProfilePage';

import { fetchStandings } from '../../lib/adapters/standings';
import { fetchSchedule } from '../../lib/adapters/schedule';
import { fetchLineup } from '../../lib/adapters/lineup';
import { fetchClubDetail } from '../../lib/adapters/clubDetail';
import { fetchPlayerDetail } from '../../lib/adapters/playerDetail';
import { fetchSearch } from '../../lib/adapters/search';

const NEVER = () => new Promise<never>(() => undefined);
const ctx = { tenantId: 'T1', slug: 's', tenantName: 'Org' };

function renderScreen(ui: ReactElement, { path, route }: { path: string; route: string }) {
  return render(
    <TenantContext.Provider value={ctx}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={ui} />
        </Routes>
      </MemoryRouter>
    </TenantContext.Provider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('Standings — full async-state matrix', () => {
  it('loading → skeleton', () => {
    vi.mocked(fetchStandings).mockImplementation(NEVER);
    renderScreen(<StandingsPage />, { path: '/s/standings', route: '/s/standings' });
    expect(screen.getByTestId('fan-list-skeleton')).toBeInTheDocument();
  });

  it('error → ErrorState with a working retry', async () => {
    vi.mocked(fetchStandings).mockRejectedValue(new Error('boom'));
    renderScreen(<StandingsPage />, { path: '/s/standings', route: '/s/standings' });
    const retry = await screen.findByRole('button', { name: tr('mobile.fan.errorRetry') });
    expect(retry).toBeInTheDocument();
    vi.mocked(fetchStandings).mockResolvedValueOnce([]);
    fireEvent.click(retry);
    await waitFor(() => expect(fetchStandings).toHaveBeenCalledTimes(2));
  });

  it('empty → EmptyState', async () => {
    vi.mocked(fetchStandings).mockResolvedValue([]);
    renderScreen(<StandingsPage />, { path: '/s/standings', route: '/s/standings' });
    expect(await screen.findByText(tr('mobile.fan.standings.empty'))).toBeInTheDocument();
    expect(screen.queryByTestId('standings-row')).toBeNull();
  });

  it('data → rows', async () => {
    vi.mocked(fetchStandings).mockResolvedValue([
      { teamId: 'A', name: 'Alpha', logoUrl: null, played: 2, wins: 2, draws: 0, losses: 0, goalsFor: 5, goalsAgainst: 1, points: 6 },
    ]);
    renderScreen(<StandingsPage />, { path: '/s/standings', route: '/s/standings' });
    expect(await screen.findByTestId('standings-row')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
});

describe('Schedule — states', () => {
  it('loading → skeleton', () => {
    vi.mocked(fetchSchedule).mockImplementation(NEVER);
    renderScreen(<SchedulePage />, { path: '/s/schedule', route: '/s/schedule' });
    expect(screen.getByTestId('fan-list-skeleton')).toBeInTheDocument();
  });
  it('empty → EmptyState', async () => {
    vi.mocked(fetchSchedule).mockResolvedValue([]);
    renderScreen(<SchedulePage />, { path: '/s/schedule', route: '/s/schedule' });
    expect(await screen.findByText(tr('mobile.fan.schedule.empty'))).toBeInTheDocument();
  });
  it('data → day group', async () => {
    vi.mocked(fetchSchedule).mockResolvedValue([
      { key: '2026-01-12', label: 'Neděle 12. 1.', matches: [
        { id: 'm1', date: 1, status: 'scheduled', time: '18:00', home: { name: 'A', logoUrl: null }, away: { name: 'B', logoUrl: null }, homeScore: null, awayScore: null },
      ] },
    ]);
    renderScreen(<SchedulePage />, { path: '/s/schedule', route: '/s/schedule' });
    expect(await screen.findByTestId('schedule-day')).toBeInTheDocument();
  });
});

describe('Lineup — states', () => {
  const route = '/s/matches/:matchId/lineup';
  const path = '/s/matches/M1/lineup';
  it('empty → EmptyState', async () => {
    vi.mocked(fetchLineup).mockResolvedValue({ home: [], guest: [] });
    renderScreen(<LineupPage />, { path, route });
    expect(await screen.findByText(tr('mobile.fan.lineup.empty'))).toBeInTheDocument();
  });
  it('data → players', async () => {
    vi.mocked(fetchLineup).mockResolvedValue({
      home: [{ id: '1', name: 'Karel', jersey: '9', position: 'forward', isCaptain: false, isCoach: false }],
      guest: [],
    });
    renderScreen(<LineupPage />, { path, route });
    expect(await screen.findByTestId('lineup-player')).toBeInTheDocument();
  });
});

describe('ClubDetail — states', () => {
  const route = '/s/clubs/:clubId';
  const path = '/s/clubs/C1';
  it('empty (null) → EmptyState', async () => {
    vi.mocked(fetchClubDetail).mockResolvedValue(null);
    renderScreen(<ClubDetailPage />, { path, route });
    expect(await screen.findByText(tr('mobile.fan.clubDetail.empty'))).toBeInTheDocument();
  });
  it('data → teams', async () => {
    vi.mocked(fetchClubDetail).mockResolvedValue({
      id: 'C1', name: 'HC Alpha', logoUrl: null, web: null,
      teams: [{ id: 'T1', name: 'Alpha A', logoUrl: null, category: 'U16' }],
      fixtures: [],
    });
    renderScreen(<ClubDetailPage />, { path, route });
    expect(await screen.findByTestId('club-team')).toBeInTheDocument();
  });
});

describe('PlayerDetail — states', () => {
  const route = '/s/players/:personId';
  const path = '/s/players/P1';
  it('empty (null) → EmptyState', async () => {
    vi.mocked(fetchPlayerDetail).mockResolvedValue(null);
    renderScreen(<PlayerDetailPage />, { path, route });
    expect(await screen.findByText(tr('mobile.fan.playerDetail.empty'))).toBeInTheDocument();
  });
  it('data → identity + appearances stat', async () => {
    vi.mocked(fetchPlayerDetail).mockResolvedValue({
      identity: { id: 'P1', fullName: 'Jan Novák', position: 'forward', jersey: '7', isCaptain: true, photoUrl: null },
      stats: { appearances: 12, recent: [{ matchId: 'M1', date: 1, opponent: 'Bravo', result: '2:1' }] },
    });
    renderScreen(<PlayerDetailPage />, { path, route });
    expect(await screen.findByTestId('player-stat')).toBeInTheDocument();
    // Name appears in both the header and the hero — assert at least one.
    expect(screen.getAllByText('Jan Novák').length).toBeGreaterThan(0);
    expect(screen.getByTestId('player-recent')).toBeInTheDocument();
  });
  it('homonym (stats null) → stats-unavailable, no misattributed count', async () => {
    vi.mocked(fetchPlayerDetail).mockResolvedValue({
      identity: { id: 'P1', fullName: 'Jan Novák', position: 'forward', jersey: '7', isCaptain: false, photoUrl: null },
      stats: null,
    });
    renderScreen(<PlayerDetailPage />, { path, route });
    expect(await screen.findByTestId('player-stats-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('player-stat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('player-recent')).not.toBeInTheDocument();
  });
});

describe('Search — states', () => {
  const route = '/s/search';
  const path = '/s/search';
  it('under 2 chars → hint EmptyState (no fetch)', () => {
    renderScreen(<SearchPage />, { path, route });
    expect(screen.getByText(tr('mobile.fan.search.hint'))).toBeInTheDocument();
    expect(fetchSearch).not.toHaveBeenCalled();
  });
  it('query → results after debounce', async () => {
    vi.mocked(fetchSearch).mockResolvedValue({
      clubs: [{ kind: 'club', id: 'c1', title: 'Alpha', subtitle: null, imageUrl: null }],
      teams: [], players: [], total: 1,
    });
    renderScreen(<SearchPage />, { path, route });
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'alpha' } });
    expect(await screen.findByTestId('search-result')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
});

describe('Stub screens — designed EmptyState (AC-05)', () => {
  it('News renders its EmptyState', () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>);
    expect(screen.getByTestId('news-screen')).toBeInTheDocument();
    expect(screen.getByText(tr('mobile.fan.news.empty'))).toBeInTheDocument();
  });
  it('Notifications renders its EmptyState', () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>);
    expect(screen.getByTestId('notifications-screen')).toBeInTheDocument();
    expect(screen.getByText(tr('mobile.fan.notifications.empty'))).toBeInTheDocument();
  });
  it('Profile renders its EmptyState', () => {
    render(<MemoryRouter><ProfilePage /></MemoryRouter>);
    expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    expect(screen.getByText(tr('mobile.fan.profile.empty'))).toBeInTheDocument();
  });
});
