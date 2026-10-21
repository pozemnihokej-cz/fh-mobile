import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import * as analytics from '../../lib/analytics';
import { AnalyticsTracker } from '../AnalyticsTracker';

describe('TEST-006 (Spec-AC-08, Spec-AC-09): AnalyticsTracker component', () => {
  let fetchSpy: any;
  let initSpy: any;
  let trackSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(analytics, 'fetchFanAnalyticsConfig');
    initSpy = vi.spyOn(analytics, 'initGa4').mockReturnValue(true);
    trackSpy = vi.spyOn(analytics, 'trackPageView').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function NavigationHelper({ target }: { target: string }) {
    const navigate = useNavigate();
    return (
      <button data-testid="nav-btn" onClick={() => navigate(target)}>
        Navigate
      </button>
    );
  }

  it('initializes GA4 and tracks initial route exactly once upon mount (Spec-AC-08)', async () => {
    fetchSpy.mockResolvedValue('G-46L3YVJSHZ');

    render(
      <MemoryRouter initialEntries={['/matches']}>
        <AnalyticsTracker />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith('G-46L3YVJSHZ');
      expect(trackSpy).toHaveBeenCalledTimes(1);
      expect(trackSpy).toHaveBeenCalledWith('/matches');
    });
  });

  it('tracks subsequent client-side route changes without duplicate page views (Spec-AC-08)', async () => {
    fetchSpy.mockResolvedValue('G-46L3YVJSHZ');

    const result = render(
      <MemoryRouter initialEntries={['/matches']}>
        <AnalyticsTracker />
        <NavigationHelper target="/standings" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(trackSpy).toHaveBeenCalledWith('/matches');
    });

    expect(trackSpy).toHaveBeenCalledTimes(1);

    // Trigger navigation to /standings
    act(() => {
      result.getByTestId('nav-btn').click();
    });

    await waitFor(() => {
      expect(trackSpy).toHaveBeenCalledWith('/standings');
    });

    expect(trackSpy).toHaveBeenCalledTimes(2);
  });

  it('fails open and does not track when analytics config is null or offline (Spec-AC-09)', async () => {
    fetchSpy.mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/matches']}>
        <AnalyticsTracker />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    expect(initSpy).not.toHaveBeenCalled();
    expect(trackSpy).not.toHaveBeenCalled();
  });
});
