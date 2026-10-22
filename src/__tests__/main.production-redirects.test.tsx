/**
 * spec-fan-app-prod-cleanup-and-team-names TEST-001 (Spec-AC-01, Spec-AC-02).
 *
 * Drives the SHIPPED main.tsx route tree, not a retyped copy: `react-dom/client`
 * is mocked so `createRoot(...).render(tree)` hands the tree to the test, which
 * renders it with @testing-library under a real BrowserRouter at the URL set
 * through `window.history`. Pages are stubs; providers are passthroughs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const captured: { tree: ReactElement | null } = { tree: null };

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: () => ({
      render: (tree: ReactElement) => {
        captured.tree = tree;
      },
    }),
  },
  createRoot: () => ({
    render: (tree: ReactElement) => {
      captured.tree = tree;
    },
  }),
}));

vi.mock('convex/react', () => ({
  ConvexReactClient: class {},
  ConvexProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

vi.mock('@fh/auth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false, token: null, signOut: vi.fn() }),
}));

vi.mock('../lib/supabase', () => ({ supabase: {}, authSupabase: {} }));
vi.mock('../lib/tenantBySlug', () => ({
  resolveTenantBySlug: async (_c: unknown, slug: string) => ({ id: 't-1', slug, name: 'Tenant' }),
}));
vi.mock('../lib/useUrlTenantOverride', () => ({ useUrlTenantOverride: () => undefined }));
vi.mock('../App', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: () => <Outlet /> };
});

function stub(testid: string) {
  return { default: () => <div data-testid={testid} /> };
}
vi.mock('../routes/MatchesPage', () => stub('stub-matches'));
vi.mock('../routes/MatchDetailPage', () => stub('stub-match-detail'));
vi.mock('../routes/LiveCenter', () => stub('stub-live'));
vi.mock('../routes/StandingsPage', () => stub('stub-standings'));
vi.mock('../routes/SchedulePage', () => stub('stub-schedule'));
vi.mock('../routes/SearchPage', () => stub('stub-search'));
vi.mock('../routes/ClubDetailPage', () => stub('stub-club'));
vi.mock('../routes/PlayerDetailPage', () => stub('stub-player'));
vi.mock('../routes/LineupPage', () => stub('stub-lineup'));
vi.mock('../routes/OnboardingPage', () => stub('stub-onboarding'));
vi.mock('../routes/NewsPage', () => stub('stub-news'));
vi.mock('../routes/NotificationsPage', () => stub('stub-notifications'));
vi.mock('../routes/ProfilePage', () => stub('stub-profile'));
vi.mock('../routes/NotFoundPage', () => stub('stub-not-found'));
vi.mock('../routes/TenantPickerPage', () => stub('stub-picker'));
vi.mock('../components/FanBottomNav', () => ({ FanBottomNav: () => null }));

// The first import of main.tsx transforms the whole app graph (~11 s alone,
// longer under a full parallel run); later imports hit the module cache.
vi.setConfig({ testTimeout: 60_000 });

async function mountShippedTreeAt(path: string): Promise<void> {
  window.history.replaceState(null, '', path);
  vi.resetModules();
  captured.tree = null;
  await import('../main');
  // Read through a widened local: TS narrowed `captured.tree` to null above.
  const tree: ReactElement | null = (captured as { tree: ReactElement | null }).tree;
  expect(tree).not.toBeNull();
  render(tree as ReactElement);
}

const GATED: Array<{ path: string; stubId: string }> = [
  { path: 'standings', stubId: 'stub-standings' },
  { path: 'schedule', stubId: 'stub-schedule' },
  { path: 'search', stubId: 'stub-search' },
  { path: 'clubs/c-1', stubId: 'stub-club' },
  { path: 'players/p-1', stubId: 'stub-player' },
  { path: 'onboarding', stubId: 'stub-onboarding' },
  { path: 'news', stubId: 'stub-news' },
  { path: 'notifications', stubId: 'stub-notifications' },
  { path: 'profile', stubId: 'stub-profile' },
];

describe('TEST-001 (Spec-AC-01): on production a hidden fan screen lands on the match list', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_UNRELEASED_PAGES', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  for (const { path, stubId } of GATED) {
    it(`/csph/${path} ends on /csph/matches showing the list, not the not-found page`, async () => {
      await mountShippedTreeAt(`/csph/${path}`);
      await waitFor(() => expect(screen.getByTestId('stub-matches')).toBeInTheDocument());
      expect(window.location.pathname).toBe('/csph/matches');
      expect(screen.queryByTestId('stub-not-found')).toBeNull();
      expect(screen.queryByTestId(stubId)).toBeNull();
    });
  }
});

describe('TEST-001 (Spec-AC-02): outside production, or with the unreleased flag, the screens stay reachable', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const cases: Array<{ name: string; prod: boolean; flag: string }> = [
    { name: 'dev build', prod: false, flag: '' },
    { name: 'production build with VITE_ENABLE_UNRELEASED_PAGES=true', prod: true, flag: 'true' },
  ];
  for (const c of cases) {
    for (const { path, stubId } of [GATED[0], GATED[3]]) {
      it(`${c.name}: /csph/${path} renders its own screen`, async () => {
        vi.stubEnv('PROD', c.prod);
        vi.stubEnv('VITE_ENABLE_UNRELEASED_PAGES', c.flag);
        await mountShippedTreeAt(`/csph/${path}`);
        await waitFor(() => expect(screen.getByTestId(stubId)).toBeInTheDocument());
        expect(window.location.pathname).toBe(`/csph/${path}`);
      });
    }
  }
});
