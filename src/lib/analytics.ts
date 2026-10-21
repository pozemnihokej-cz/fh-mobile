import { GLOBAL_SETTING_KEYS, isValidGa4MeasurementId, normalizeGa4MeasurementId } from '@fh/schema';
import { supabase } from './supabase';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __ga4_measurement_id?: string | null;
  }
}

/**
 * Asynchronously retrieves the active fan application GA4 Measurement ID
 * from `global_settings` using the anonymous Supabase client (Spec-AC-07).
 *
 * Fails open gracefully: on network error, offline state, empty or missing row,
 * returns null without throwing (Spec-AC-09).
 */
export async function fetchFanAnalyticsConfig(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('value')
      .eq('key', GLOBAL_SETTING_KEYS.FAN_APP_GA4_MEASUREMENT_ID)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const raw = (data.value as { measurement_id?: string | null } | null)?.measurement_id;
    const normalized = normalizeGa4MeasurementId(raw);

    if (normalized === '' || !isValidGa4MeasurementId(normalized)) {
      return null;
    }

    return normalized;
  } catch {
    // Fail-open: offline or unexpected exception must never crash the fan app
    return null;
  }
}

/**
 * Initializes Google Analytics 4 (gtag.js) with `send_page_view: false` (Spec-AC-08).
 *
 * Fails open: if measurementId is null, empty, or invalid, or if running in
 * non-browser environment, does nothing.
 */
export function initGa4(measurementId: string | null | undefined): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const normalized = normalizeGa4MeasurementId(measurementId);
  if (normalized === '' || !isValidGa4MeasurementId(normalized)) {
    return false;
  }

  // Already initialized with this ID
  if (window.__ga4_measurement_id === normalized) {
    return true;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', normalized, { send_page_view: false });
  window.__ga4_measurement_id = normalized;

  // Dynamically inject gtag.js script if not already present
  const scriptId = `ga4-gtag-${normalized}`;
  if (!document.getElementById(scriptId)) {
    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${normalized}`;
    document.head.appendChild(script);
  }

  return true;
}

/**
 * Dispatches a GA4 page_view event for client-side navigation (Spec-AC-08).
 * Fails open gracefully if GA4 is not initialized.
 */
export function trackPageView(path: string, title?: string): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function' || !window.__ga4_measurement_id) {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || (typeof document !== 'undefined' ? document.title : ''),
    page_location: typeof window !== 'undefined' ? window.location.href : '',
  });
}
