/**
 * spec-fan-app-prod-cleanup-and-team-names TEST-007 (Spec-AC-01, Spec-AC-03,
 * Spec-AC-06, e2e).
 *
 * Runs ONLY against a PRODUCTION build (`vite build`, no
 * VITE_ENABLE_UNRELEASED_PAGES), served at E2E_BASE_URL with the backend paths
 * forwarded to the local TEST stack. The dev server the suite normally targets
 * shows every screen by design (Spec-AC-02), so without E2E_PROD_BUILD=1 the
 * file skips itself. Read-only, `e2e-test` tenant only.
 */
import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';

const NOT_FOUND_HEADING = /page not found|stránka nenalezena/i;
const ANY_ID = '00000000-0000-4000-8000-0000abcd7001';

test.describe('TEST-007 — production fan surface', () => {
  test.skip(process.env.E2E_PROD_BUILD !== '1', 'needs a production build (E2E_PROD_BUILD=1, E2E_BASE_URL)');

  for (const path of ['standings', 'schedule', 'search', `clubs/${ANY_ID}`, `players/${ANY_ID}`, 'onboarding', 'news', 'notifications', 'profile']) {
    test(`/${path} lands on the match list`, async ({ page }) => {
      await page.goto(`/${E2E_TEST_SLUG}/${path}`);
      await expect(page).toHaveURL(new RegExp(`/${E2E_TEST_SLUG}/matches$`), { timeout: 15_000 });
      await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toHaveCount(0);
      await expect(page.getByTestId('fan-bottom-nav')).toHaveCount(0);
    });
  }

  // The e2e-test fixture match `HC Hostivař B` (short name `Hostivař B`) vs
  // `HC 1946 Praga` (`Praga`); kick-off 2025-04-11, so it is outside the list's
  // window and is opened directly.
  test('the match detail names the reserve team by its short name (Spec-AC-06)', async ({ page }) => {
    test.skip(process.env.E2E_EXPECT_TEAM_SHORT_NAME !== '1', 'needs the TEST Convex to serve the ride functions');
    await page.goto(`/${E2E_TEST_SLUG}/matches/00000000-0000-0000-0000-e2e066512001`);
    await expect(page.getByText('Hostivař B').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Praga', { exact: true }).first()).toBeVisible();
  });
});
