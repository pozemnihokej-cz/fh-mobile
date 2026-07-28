/**
 * SPEC-PRD-057 TEST-012 (Spec-AC-06, e2e) — offline banner + cached data.
 *
 * Loads the matches list (data supplied by the deterministic Convex replay so
 * there is genuine cached content), then drops the connection via Playwright's
 * `context.setOffline(true)` and asserts:
 *   1. the `ConnectionBanner` (role="status") appears with the offline message;
 *   2. the previously-loaded match data STAYS visible (no blank screen);
 *   3. on reconnect (`setOffline(false)`) the banner clears.
 *
 * The offline banner is driven by `useOnline` (navigator.onLine + online/offline
 * events), which `setOffline` toggles in Chromium. Tenant-safe: only `e2e-test`
 * is exercised and the Convex backend is never contacted (replay sink).
 */

import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay, REPLAY_MATCH } from './utils/convexReplay';

test.describe('SPEC-PRD-057 TEST-012 — offline banner keeps cached data', () => {
  test('offline shows the ConnectionBanner + keeps cached data; reconnect clears it', async ({ page, context }) => {
    await installConvexReplay(page, { list: [REPLAY_MATCH] });

    await page.goto(`/${E2E_TEST_SLUG}/matches`);

    // Cached data is on screen while online.
    await expect(page.getByText('Alpha HC').first()).toBeVisible({ timeout: 10_000 });
    // No banner while online.
    await expect(page.getByRole('status')).toHaveCount(0);

    // 1. Go offline → the ConnectionBanner mounts with the offline message.
    await context.setOffline(true);
    const banner = page.getByRole('status');
    await expect(banner).toBeVisible({ timeout: 5_000 });
    await expect(banner).toContainText('Nejste online');

    // 2. Previously-loaded data STAYS visible (no blank screen).
    await expect(page.getByText('Alpha HC').first()).toBeVisible();
    await expect(page.getByText('Bravo HC').first()).toBeVisible();

    // 3. Reconnect → the banner clears.
    await context.setOffline(false);
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 5_000 });
    // Data is still there after reconnect.
    await expect(page.getByText('Alpha HC').first()).toBeVisible();
  });
});
