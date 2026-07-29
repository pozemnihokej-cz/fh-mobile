/**
 * SPEC-PRD-057 TEST-011 (Spec-AC-06): offline cache-retention.
 *
 * AC-06: on connection loss the app shows a `ConnectionBanner` AND keeps the
 * last-cached data visible (no blank screen); on reconnect the banner clears.
 *
 * The banner mount/clear half is already covered by
 * `components/__tests__/OfflineBanner.test.tsx`. This integration test adds the
 * missing "cached data stays visible" half.
 *
 * TECHDEBT-038 FIX 3: instead of a hand-built `Shell` that merely COPIES
 * `App.tsx`'s JSX, this renders the REAL `App` as the router layout element
 * (exactly as `main.tsx` mounts it: `<Route element={<App />}>` with the screen
 * in the `<Outlet/>`). App's own `FanPreferencesProvider` deps (`@fh/auth` +
 * the Convex-backed fan-prefs client) are stubbed so the real shell mounts
 * without a Convex/Auth context and takes its anonymous path. Because the cached
 * screen now flows through App's real `<OfflineBanner /> + <Outlet />` wiring, an
 * App-level offline-unmount regression (e.g. conditionally dropping the outlet
 * while offline) is caught here.
 *
 * The strong assertion is DOM-node identity: after going offline the cached
 * content must be the SAME node (`toBe`), proving React did not unmount + remount
 * (which would blank the screen / drop cache) — a naive impl that hid children
 * while offline would fail this.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';

// App mounts FanPreferencesProvider, which reads `@fh/auth` and the Convex-backed
// fan-prefs actions. Stub both so the REAL App shell renders without a
// Convex/Auth context; an anonymous session keeps the provider on its
// localStorage-only path (no network).
vi.mock('../lib/fanPrefsClient', () => ({
  useFanPrefsActions: () => ({
    get: async () => null,
    upsert: async () => undefined,
    clear: async () => undefined,
  }),
}));
vi.mock('@fh/auth', () => ({
  useAuth: () => ({ isAuthenticated: false, token: null, user: null }),
}));

import App from '../App';

afterEach(cleanup);

/** The already-resolved fan "screen" App renders into its <Outlet/>. */
function CachedScreen(): JSX.Element {
  return <Box data-testid="cached-standings">Sparta 24 b. · Slavia 21 b.</Box>;
}

/** Render the REAL App shell as the route layout, mirroring main.tsx. */
function renderApp() {
  return render(
    <ThemeProvider theme={fhThemeDark}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<App />}>
            <Route index element={<CachedScreen />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

describe('SPEC-PRD-057 offline cache-retention (TEST-011, Spec-AC-06)', () => {
  it('keeps the last-cached data visible when the connection drops, and clears the banner on reconnect', () => {
    setOnline(true);
    renderApp();

    // Baseline: data resolved + visible, no banner while online.
    const cached = screen.getByTestId('cached-standings');
    expect(cached).toBeInTheDocument();
    expect(cached.textContent).toContain('Sparta 24 b.');
    expect(screen.queryByText(/Nejste online/i)).toBeNull();

    // Connection drops: banner mounts AND the cached data is the SAME node
    // (never unmounted/blanked — no layout wipe), through App's real wiring.
    act(() => setOnline(false));
    expect(screen.getByText(/Nejste online/i)).toBeInTheDocument();
    const afterOffline = screen.getByTestId('cached-standings');
    expect(afterOffline).toBe(cached); // identity: not remounted
    expect(afterOffline.textContent).toContain('Sparta 24 b.');

    // Reconnect: banner clears, cached data still the same node.
    act(() => setOnline(true));
    expect(screen.queryByText(/Nejste online/i)).toBeNull();
    const afterOnline = screen.getByTestId('cached-standings');
    expect(afterOnline).toBe(cached);
    expect(afterOnline.textContent).toContain('Sparta 24 b.');
  });
});
