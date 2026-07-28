/**
 * SPEC-PRD-034 Spec-AC-13 / TEST-019 — fan register + login UI.
 *
 * The Profile tab is the ONLY surface where auth appears; anonymous browsing of
 * every public screen stays intact (no login wall). We assert:
 *   (a) the AuthForm renders email + password in signed-out state;
 *   (b) register mode collects a name and calls signUp(email, pw, name);
 *   (c) login mode calls signIn(email, pw);
 *   (d) instant login — NO "pending / approval" gate copy is shown;
 *   (e) anonymous browse preserved — a public screen (MatchesPage) renders its
 *       match content with user=null and no redirect / auth wall.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { initI18n } from '@fh/i18n';

void initI18n();

const signIn = vi.fn(async () => undefined);
const signUp = vi.fn(async () => undefined);
const signOut = vi.fn();

let authState: Record<string, unknown> = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  token: null,
  signIn,
  signUp,
  signOut,
};

vi.mock('@fh/auth', () => ({
  useAuth: () => authState,
}));

// MatchesPage reads Convex `matches.list` — stub it to a single public match so
// the anonymous-browse assertion has content to find (no auth involved).
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => [
    {
      _id: 'x1',
      supabaseId: 'sb-1',
      homeTeamName: 'Alpha',
      awayTeamName: 'Beta',
      date: Date.now(),
      status: 'scheduled',
    },
  ]),
}));

import { AuthForm } from '../components/AuthForm';
import MatchesPage from '../routes/MatchesPage';
import { TenantContext } from '../routes/TenantContext';

beforeEach(() => {
  vi.clearAllMocks();
  authState = { user: null, isAuthenticated: false, isLoading: false, token: null, signIn, signUp, signOut };
});

describe('Auth register/login UI (TEST-019)', () => {
  it('renders email + password fields signed-out', () => {
    render(<MemoryRouter><AuthForm /></MemoryRouter>);
    expect(screen.getByTestId('auth-email')).toBeInTheDocument();
    expect(screen.getByTestId('auth-password')).toBeInTheDocument();
    expect(screen.getByTestId('auth-submit')).toBeInTheDocument();
  });

  it('register mode collects a name and calls signUp(email, pw, name)', async () => {
    render(<MemoryRouter><AuthForm /></MemoryRouter>);
    // Switch to register mode.
    fireEvent.click(screen.getByTestId('auth-mode-toggle'));
    const name = screen.getByTestId('auth-name').querySelector('input')!;
    const email = screen.getByTestId('auth-email').querySelector('input')!;
    const pw = screen.getByTestId('auth-password').querySelector('input')!;
    fireEvent.change(name, { target: { value: 'Fan Novak' } });
    fireEvent.change(email, { target: { value: 'fan@example.com' } });
    fireEvent.change(pw, { target: { value: 'secret123' } });
    fireEvent.click(screen.getByTestId('auth-submit'));
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith('fan@example.com', 'secret123', 'Fan Novak'),
    );
    expect(signIn).not.toHaveBeenCalled();
  });

  it('login mode calls signIn(email, pw)', async () => {
    render(<MemoryRouter><AuthForm /></MemoryRouter>);
    const email = screen.getByTestId('auth-email').querySelector('input')!;
    const pw = screen.getByTestId('auth-password').querySelector('input')!;
    fireEvent.change(email, { target: { value: 'fan@example.com' } });
    fireEvent.change(pw, { target: { value: 'secret123' } });
    fireEvent.click(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith('fan@example.com', 'secret123'));
    expect(signUp).not.toHaveBeenCalled();
  });

  it('instant login — no pending/approval gate copy is shown', () => {
    render(<MemoryRouter><AuthForm /></MemoryRouter>);
    fireEvent.click(screen.getByTestId('auth-mode-toggle')); // register
    expect(screen.queryByText(/schvál|approv|pending|čeká/i)).toBeNull();
  });

  it('anonymous browse preserved — MatchesPage renders content with user=null (no wall)', () => {
    render(
      <TenantContext.Provider value={{ tenantId: 'T1', slug: 's', tenantName: 'Org' }}>
        <MemoryRouter initialEntries={['/s/matches']}>
          <Routes>
            <Route path="/s/matches" element={<MatchesPage />} />
          </Routes>
        </MemoryRouter>
      </TenantContext.Provider>,
    );
    // A public match card renders; no auth form is present on the public screen.
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-submit')).toBeNull();
  });
});
