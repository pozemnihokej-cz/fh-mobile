import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { FanBottomNav } from '../../components/FanBottomNav';
import { TenantContext } from '../TenantContext';
import ProfilePage from '../ProfilePage';

vi.mock('@fh/auth', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    token: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('../../lib/useFanPreferences', () => ({
  useFanPreferences: () => ({
    clubs: [],
    leagues: [],
    matches: [],
    toggleClub: vi.fn(),
    toggleLeague: vi.fn(),
    toggleMatch: vi.fn(),
    clearAll: vi.fn(),
    isMatchSaved: vi.fn(() => false),
  }),
}));

describe('Production fan app surface cleanup & gating', () => {
  const originalProd = import.meta.env.PROD;

  afterEach(() => {
    // restore original PROD
    (import.meta.env as any).PROD = originalProd;
  });

  it('hides FanBottomNav in production mode', () => {
    (import.meta.env as any).PROD = true;

    const { container } = render(
      <MemoryRouter initialEntries={['/csph/matches']}>
        <TenantContext.Provider value={{ tenantId: 't1', slug: 'csph', tenantName: 'ČSPH' }}>
          <FanBottomNav />
        </TenantContext.Provider>
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-testid="fan-bottom-nav"]')).toBeNull();
  });

  it('displays FanBottomNav in development mode', () => {
    (import.meta.env as any).PROD = false;

    render(
      <MemoryRouter initialEntries={['/csph/matches']}>
        <TenantContext.Provider value={{ tenantId: 't1', slug: 'csph', tenantName: 'ČSPH' }}>
          <FanBottomNav />
        </TenantContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('fan-bottom-nav')).toBeInTheDocument();
  });

  it('shows unavailable note in ProfilePage in production instead of AuthForm', () => {
    (import.meta.env as any).PROD = true;

    render(
      <MemoryRouter initialEntries={['/csph/profile']}>
        <TenantContext.Provider value={{ tenantId: 't1', slug: 'csph', tenantName: 'ČSPH' }}>
          <ThemeProvider theme={createTheme()}>
            <ProfilePage />
          </ThemeProvider>
        </TenantContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText(/přihlášení a vytváření uživatelských účtů není v této verzi k dispozici/i)).toBeInTheDocument();
    expect(screen.queryByTestId('auth-submit')).toBeNull();
  });
});

/**
 * spec-fan-app-prod-cleanup-and-team-names TEST-002 (Spec-AC-02, Spec-AC-03):
 * one gate for every hidden surface, and the unreleased flag reopens them.
 */
describe('TEST-002: unreleasedPagesHidden() and the flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    [true, '', true],
    [true, 'false', true],
    [true, 'true', false],
    [false, '', false],
    [false, 'true', false],
  ])('PROD=%s flag=%j -> hidden=%s', async (prod, flag, hidden) => {
    vi.stubEnv('PROD', prod);
    vi.stubEnv('VITE_ENABLE_UNRELEASED_PAGES', flag);
    const { unreleasedPagesHidden } = await import('../../lib/releaseGate');
    expect(unreleasedPagesHidden()).toBe(hidden);
  });

  it('a production build with VITE_ENABLE_UNRELEASED_PAGES=true renders the bottom navigation and the sign-in form', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ENABLE_UNRELEASED_PAGES', 'true');
    render(
      <MemoryRouter initialEntries={['/csph/profile']}>
        <TenantContext.Provider value={{ tenantId: 't1', slug: 'csph', tenantName: 'ČSPH' }}>
          <ThemeProvider theme={createTheme()}>
            <FanBottomNav />
            <ProfilePage />
          </ThemeProvider>
        </TenantContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('fan-bottom-nav')).toBeInTheDocument();
    expect(screen.queryByText(/přihlášení a vytváření uživatelských účtů není v této verzi k dispozici/i)).toBeNull();
    expect(screen.getByTestId('auth-submit')).toBeInTheDocument();
  });
});
