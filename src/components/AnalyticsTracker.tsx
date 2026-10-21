import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchFanAnalyticsConfig, initGa4, trackPageView } from '../lib/analytics';

/**
 * Global analytics tracker component mounted at the root of fh-mobile.
 *
 * Spec-AC-07: Asynchronously retrieves active GA4 setting using anon client.
 * Spec-AC-08: Initializes gtag.js with send_page_view: false and tracks
 * initial load and React Router route changes without duplicate page views.
 * Spec-AC-09: Fails open if setting is missing/invalid or offline.
 */
export function AnalyticsTracker(): null {
  const location = useLocation();
  const [initialized, setInitialized] = useState(false);
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const measurementId = await fetchFanAnalyticsConfig();
      if (!isMounted || !measurementId) return;

      const success = initGa4(measurementId);
      if (success && isMounted) {
        setInitialized(true);
        const fullPath = location.pathname + location.search;
        trackPageView(fullPath);
        lastTrackedPath.current = fullPath;
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Track SPA route changes after initialization
  useEffect(() => {
    if (!initialized) return;

    const fullPath = location.pathname + location.search;
    if (lastTrackedPath.current !== fullPath) {
      lastTrackedPath.current = fullPath;
      trackPageView(fullPath);
    }
  }, [initialized, location.pathname, location.search]);

  return null;
}
