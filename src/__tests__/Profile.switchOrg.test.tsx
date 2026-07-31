/**
 * CHANGE-194 Bug 3 — "Switch organization" affordance on the Profile screen.
 *
 * Before this change there was NO in-app path back to the tenant picker: the
 * bottom nav, header and profile all lacked it, and the onboarding back-link was
 * unreachable. ProfilePage now renders an always-visible org card (current org
 * name + a button) that navigates to `/` — the picker — regardless of auth
 * state, because switching org is independent of being signed in.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { initI18n } from '@fh/i18n';

void initI18n();

const signOut = vi.fn();
let authState: Record<string, unknown> = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  token: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut,
};

vi.mock('@fh/auth', () => ({ useAuth: () => authState }));

import ProfilePage from '../routes/ProfilePage';
import { TenantContext } from '../routes/TenantContext';

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/e2e-test/profile']}>
      <TenantContext.Provider value={{ tenantId: 't1', slug: 'e2e-test', tenantName: 'E2E Test Tenant' }}>
        <Routes>
          <Route path="/" element={<div data-testid="picker-landed">PICKER</div>} />
          <Route path="/:slug/profile" element={<ProfilePage />} />
        </Routes>
      </TenantContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  authState = { user: null, isAuthenticated: false, isLoading: false, token: null, signIn: vi.fn(), signUp: vi.fn(), signOut };
});

describe('Profile — switch organization (CHANGE-194 Bug 3)', () => {
  it('shows the current org name + switch button and navigates to the picker (signed-out)', () => {
    renderProfile();
    expect(screen.getByText('E2E Test Tenant')).toBeInTheDocument();
    const btn = screen.getByTestId('profile-switch-org');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    // Clicking navigates to `/` → the tenant picker landing sentinel.
    expect(screen.getByTestId('picker-landed')).toBeInTheDocument();
  });

  it('shows the switch-org affordance when signed in too (auth-independent)', () => {
    authState = {
      user: { email: 'fan@example.com', name: 'Fan' },
      isAuthenticated: true,
      isLoading: false,
      token: 't',
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut,
    };
    renderProfile();
    expect(screen.getByTestId('profile-switch-org')).toBeInTheDocument();
    // sign-out still present — the two live side by side, neither replaces the other.
    expect(screen.getByTestId('profile-signout')).toBeInTheDocument();
  });
});
