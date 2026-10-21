import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockQueryResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(mockQueryResult),
        }),
      }),
    }),
  },
}));

import { fetchFanAnalyticsConfig, initGa4, trackPageView } from '../analytics';

describe('TEST-005 (Spec-AC-07, Spec-AC-09): Fan App Analytics Module', () => {
  beforeEach(() => {
    mockQueryResult = { data: null, error: null };
    delete (window as any).dataLayer;
    delete (window as any).gtag;
    delete (window as any).__ga4_measurement_id;
    // Remove any previously injected gtag scripts
    document.querySelectorAll('script[src*="googletagmanager.com"]').forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchFanAnalyticsConfig (Spec-AC-07, Spec-AC-09)', () => {
    it('returns normalized Measurement ID when valid setting is returned', async () => {
      mockQueryResult = {
        data: { value: { measurement_id: 'G-46L3YVJSHZ' } },
        error: null,
      };

      const result = await fetchFanAnalyticsConfig();
      expect(result).toBe('G-46L3YVJSHZ');
    });

    it('returns normalized Measurement ID when input has lowercase letters or surrounding spaces', async () => {
      mockQueryResult = {
        data: { value: { measurement_id: '  g-46l3yvjshz  ' } },
        error: null,
      };

      const result = await fetchFanAnalyticsConfig();
      expect(result).toBe('G-46L3YVJSHZ');
    });

    it('returns null when setting row is null or missing (fail-open)', async () => {
      mockQueryResult = { data: null, error: null };
      const result = await fetchFanAnalyticsConfig();
      expect(result).toBeNull();
    });

    it('returns null when measurement_id is empty string (fail-open)', async () => {
      mockQueryResult = {
        data: { value: { measurement_id: '' } },
        error: null,
      };
      const result = await fetchFanAnalyticsConfig();
      expect(result).toBeNull();
    });

    it('returns null when measurement_id is malformed (fail-open)', async () => {
      mockQueryResult = {
        data: { value: { measurement_id: 'INVALID_ID' } },
        error: null,
      };
      const result = await fetchFanAnalyticsConfig();
      expect(result).toBeNull();
    });

    it('returns null when query encounters database or network error (fail-open)', async () => {
      mockQueryResult = {
        data: null,
        error: { message: 'Network connection failed' },
      };
      const result = await fetchFanAnalyticsConfig();
      expect(result).toBeNull();
    });
  });

  describe('initGa4 (Spec-AC-08, Spec-AC-09)', () => {
    it('returns false and does nothing when ID is null, empty, or invalid (fail-open)', () => {
      expect(initGa4(null)).toBe(false);
      expect(initGa4('')).toBe(false);
      expect(initGa4('UA-12345-1')).toBe(false);
      expect(initGa4('invalid')).toBe(false);

      expect(window.dataLayer).toBeUndefined();
      expect(window.gtag).toBeUndefined();
      expect(document.querySelector('script[src*="googletagmanager.com"]')).toBeNull();
    });

    it('initializes dataLayer, gtag function, and config with send_page_view: false for valid ID', () => {
      const success = initGa4('G-46L3YVJSHZ');
      expect(success).toBe(true);

      expect(Array.isArray(window.dataLayer)).toBe(true);
      expect(typeof window.gtag).toBe('function');
      expect(window.__ga4_measurement_id).toBe('G-46L3YVJSHZ');

      // Verify gtag calls pushed into dataLayer
      const dl = window.dataLayer as unknown[][];
      const configCall = dl.find((call) => call[0] === 'config');
      expect(configCall).toBeDefined();
      expect(configCall?.[1]).toBe('G-46L3YVJSHZ');
      expect(configCall?.[2]).toEqual({ send_page_view: false });

      // Verify script injection into DOM
      const script = document.querySelector('script[src*="googletagmanager.com/gtag/js?id=G-46L3YVJSHZ"]') as HTMLScriptElement;
      expect(script).not.toBeNull();
      expect(script.async).toBe(true);
    });

    it('does not re-inject script or re-initialize if already initialized with the same ID', () => {
      initGa4('G-46L3YVJSHZ');
      const initialScriptCount = document.querySelectorAll('script[src*="googletagmanager.com"]').length;
      expect(initialScriptCount).toBe(1);

      const repeatSuccess = initGa4('G-46L3YVJSHZ');
      expect(repeatSuccess).toBe(true);
      expect(document.querySelectorAll('script[src*="googletagmanager.com"]').length).toBe(1);
    });
  });

  describe('trackPageView (Spec-AC-08, Spec-AC-09)', () => {
    it('does not throw when called before initialization (fail-open)', () => {
      expect(() => trackPageView('/matches')).not.toThrow();
    });

    it('dispatches page_view event with path and document title when initialized', () => {
      initGa4('G-46L3YVJSHZ');
      document.title = 'Czech Field Hockey';

      trackPageView('/matches?tenant=bohemians', 'Matches List');

      const dl = window.dataLayer as unknown[][];
      const pageViewCall = dl.find((call) => call[0] === 'event' && call[1] === 'page_view');
      expect(pageViewCall).toBeDefined();
      expect(pageViewCall?.[2]).toEqual(
        expect.objectContaining({
          page_path: '/matches?tenant=bohemians',
          page_title: 'Matches List',
        }),
      );
    });
  });
});
