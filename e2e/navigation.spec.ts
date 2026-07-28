/**
 * SPEC-PRD-057 TEST-007 (Spec-AC-04, e2e) — navigation reaches the 11 fan screens.
 *
 * Directly navigates to each of the 11 showcase fan screens under the live
 * `e2e-test` tenant and asserts each RENDERS its screen (its identifying testid,
 * or — for LiveCenter, which has no container testid — its header) and is NOT the
 * NotFoundPage. This confirms every screen is a registered, reachable route on
 * the live app (the unit route-table proof is TEST-006).
 *
 * Data-bearing screens are read-only against the `e2e-test` tenant; screens whose
 * `e2e-test` data is empty still render their container + designed EmptyState
 * (reachability is about the screen mounting, not its data). `cz-field-hockey-union`
 * is never referenced.
 */

import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';

// A real `e2e-test` club id (read-only) so ClubDetail resolves live club data.
const E2E_TEST_CLUB_ID = '814b96e3-6a08-4d47-b26e-8c1610fe9d4c';
// Arbitrary ids for player/lineup — the screens mount + render their EmptyState
// regardless (e2e-test has no persons / match_players); reachability is proven
// by the container testid rendering, not by populated data.
const ANY_PLAYER_ID = '00000000-0000-4000-8000-0000abcd7001';
const ANY_MATCH_ID = '00000000-0000-4000-8000-0000abcd7002';

const NOT_FOUND_HEADING = /page not found|stránka nenalezena/i;

// Ten of the eleven screens expose a stable screen-identifying testid.
const TESTID_SCREENS: Array<{ name: string; path: string; testid: string }> = [
  { name: 'Standings', path: 'standings', testid: 'standings-screen' },
  { name: 'Schedule', path: 'schedule', testid: 'schedule-screen' },
  { name: 'Search', path: 'search', testid: 'search-screen' },
  { name: 'ClubDetail', path: `clubs/${E2E_TEST_CLUB_ID}`, testid: 'club-detail-screen' },
  { name: 'PlayerDetail', path: `players/${ANY_PLAYER_ID}`, testid: 'player-detail-screen' },
  { name: 'Lineup', path: `matches/${ANY_MATCH_ID}/lineup`, testid: 'lineup-screen' },
  { name: 'Onboarding', path: 'onboarding', testid: 'onboarding-screen' },
  { name: 'News', path: 'news', testid: 'news-screen' },
  { name: 'Notifications', path: 'notifications', testid: 'notifications-screen' },
  { name: 'Profile', path: 'profile', testid: 'profile-screen' },
];

test.describe('SPEC-PRD-057 TEST-007 — fan screen navigation reachability', () => {
  for (const { name, path, testid } of TESTID_SCREENS) {
    test(`reaches ${name} (/${path})`, async ({ page }) => {
      await page.goto(`/${E2E_TEST_SLUG}/${path}`);
      await expect(page.getByTestId(testid)).toBeVisible({ timeout: 15_000 });
      // Must not have fallen through to the 404 page.
      await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toHaveCount(0);
    });
  }

  // The 11th screen — LiveCenter — has no container testid; identify it by its
  // sticky-header title and confirm it is not the 404 page.
  test('reaches LiveCenter (/live)', async ({ page }) => {
    await page.goto(`/${E2E_TEST_SLUG}/live`);
    await expect(page.getByText('Živě').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: NOT_FOUND_HEADING })).toHaveCount(0);
    // The fan bottom-nav is mounted on resolved tenant routes.
    await expect(page.getByTestId('fan-bottom-nav')).toBeVisible();
  });
});
