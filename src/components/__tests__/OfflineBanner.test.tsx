/**
 * TEST-011 (SPEC-PRD-055 Spec-AC-06): OfflineBanner shows the @fh/ui
 * ConnectionBanner while offline and nothing while online, driven by useOnline.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { fhThemeDark } from '@fh/ui';
import { OfflineBanner } from '../OfflineBanner';

afterEach(cleanup);

const wrap = (ui: React.ReactNode) => <ThemeProvider theme={fhThemeDark}>{ui}</ThemeProvider>;

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

describe('OfflineBanner', () => {
  it('renders nothing while online', () => {
    setOnline(true);
    const { container } = render(wrap(<OfflineBanner />));
    expect(container.textContent).toBe('');
  });

  it('shows the ConnectionBanner when the connection drops, and clears on reconnect', () => {
    setOnline(true);
    render(wrap(<OfflineBanner />));
    act(() => setOnline(false));
    expect(screen.getByText(/Nejste online/i)).toBeDefined();
    act(() => setOnline(true));
    expect(screen.queryByText(/Nejste online/i)).toBeNull();
  });
});
