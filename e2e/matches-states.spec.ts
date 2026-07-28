/**
 * SPEC-PRD-057 TEST-002 (Spec-AC-01, e2e) — matches list: skeleton → data on load.
 *
 * Confirms the async-state boundary on the live fan app: the matches list at
 * `/e2e-test/matches` first paints the `MatchCardSkeleton` (loading), then, once
 * the `matches:list` query resolves, replaces it with real MatchCard content —
 * one reusable boundary, no blank/spinner intermediate.
 *
 * The `e2e-test` tenant carries no Convex match rows on the live stack, so the
 * data half is supplied by a protocol-correct Convex sync replay
 * (`installConvexReplay`) that never touches the real Convex backend. The replay
 * is gated so the skeleton is asserted ON SCREEN before the data lands, making
 * the skeleton→data transition genuinely observable (not a race).
 *
 * Tenant safety: only the `e2e-test` slug is exercised; the tenant lookup is a
 * real read-only Supabase call for that slug. `cz-field-hockey-union` is never
 * referenced.
 */

import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay, REPLAY_MATCH } from './utils/convexReplay';

test.describe('SPEC-PRD-057 TEST-002 — matches list skeleton → data', () => {
  test('shows the MatchCardSkeleton on load, then renders the resolved match data', async ({ page }) => {
    // Gate the Convex reply so we can prove the skeleton is on screen first.
    let releaseData!: () => void;
    const dataGate = new Promise<void>((resolve) => {
      releaseData = resolve;
    });

    await installConvexReplay(page, {
      list: [REPLAY_MATCH],
      hold: () => dataGate,
    });

    await page.goto(`/${E2E_TEST_SLUG}/matches`);

    // 1. LOADING: the skeleton (MUI Skeleton nodes from MatchCardSkeleton) shows
    //    while the query is undefined and before the gated reply is released.
    await expect(page.locator('.MuiSkeleton-root').first()).toBeVisible({ timeout: 10_000 });
    // The resolved data must NOT be present yet.
    await expect(page.getByText('Alpha HC')).toHaveCount(0);

    // 2. Release the Convex data.
    releaseData();

    // 3. DATA: the skeleton is replaced by the real MatchCard content.
    await expect(page.getByText('Alpha HC').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Bravo HC').first()).toBeVisible();
    await expect(page.locator('.MuiSkeleton-root')).toHaveCount(0);
    // The empty state must not appear when data resolved.
    await expect(page.getByText('Žádné zápasy')).toHaveCount(0);
  });
});
