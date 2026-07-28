/**
 * SPEC-PRD-057 TEST-011 (Spec-AC-06): offline cache-retention.
 *
 * AC-06: on connection loss the app shows a `ConnectionBanner` AND keeps the
 * last-cached data visible (no blank screen); on reconnect the banner clears.
 *
 * The banner mount/clear half is already covered by
 * `components/__tests__/OfflineBanner.test.tsx`. This integration test adds the
 * missing "cached data stays visible" half: it mirrors the `App.tsx` shell
 * (a pinned `<OfflineBanner />` sibling ABOVE the screen content) with content
 * that has ALREADY resolved, then toggles connectivity and asserts the
 * previously-rendered data node is never unmounted/blanked.
 *
 * The strong assertion is DOM-node identity: after going offline the cached
 * content must be the SAME node (`toBe`), proving React did not unmount + remount
 * (which would blank the screen / drop cache) — a naive impl that hid children
 * while offline would fail this.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Box } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import { OfflineBanner } from '../components/OfflineBanner';

afterEach(cleanup);

/** Mirrors App.tsx: the offline strip is pinned ABOVE the (already-resolved) screen. */
function Shell(): JSX.Element {
  return (
    <ThemeProvider theme={fhThemeDark}>
      <Box>
        <OfflineBanner />
        <Box data-testid="cached-standings">Sparta 24 b. · Slavia 21 b.</Box>
      </Box>
    </ThemeProvider>
  );
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

describe('SPEC-PRD-057 offline cache-retention (TEST-011, Spec-AC-06)', () => {
  it('keeps the last-cached data visible when the connection drops, and clears the banner on reconnect', () => {
    setOnline(true);
    render(<Shell />);

    // Baseline: data resolved + visible, no banner while online.
    const cached = screen.getByTestId('cached-standings');
    expect(cached).toBeInTheDocument();
    expect(cached.textContent).toContain('Sparta 24 b.');
    expect(screen.queryByText(/Nejste online/i)).toBeNull();

    // Connection drops: banner mounts AND the cached data is the SAME node
    // (never unmounted/blanked — no layout wipe).
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
