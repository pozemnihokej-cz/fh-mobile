/**
 * spec-mobile-lineup-tenant-read TEST-006 (Spec-AC-06; e2e).
 *
 * Live anonymous browser run against the RUNNING local TEST stack, `e2e-test` tenant ONLY. No global setup, no
 * fixture writes: it only reads.
 *
 * Fixture (as external-id-deeplink.spec.ts): externalId '23111' exists in BOTH `cz-field-hockey-union` (an archival
 * match) and `e2e-test` (supabaseId `00000000-0000-0000-0000-e2e023111001`).
 * `/e2e-test/matches/23111/lineup` must resolve the number inside the URL tenant first and read the lineup by the
 * e2e-test UUID only: no PostgREST read ever carries the raw number or the archival union match id.
 *
 * The roster read over Convex travels on the WebSocket / HTTP client and is not inspected here; the unit suite
 * (LineupPage.tenantRead.test.tsx TEST-002/004) proves the Convex roster read never carries the number.
 */
import { test, expect } from '@playwright/test';

const E2E_TEST_SLUG = 'e2e-test';
const EXTERNAL_ID = '23111';
const EXPECTED_SUPABASE_ID = '00000000-0000-0000-0000-e2e023111001';
const ARCHIVAL_CZ_UNION_MATCH_ID = '36e0ed9c-9488-41cb-ad21-965d4e9f4cc1';

test.describe('spec-mobile-lineup-tenant-read TEST-006 — lineup by SportsPress number reads the URL tenant only', () => {
  test('/e2e-test/matches/23111/lineup reads match_players by the e2e-test UUID, never by the number', async ({ page }) => {
    const restUrls: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/rest/v1/')) restUrls.push(decodeURIComponent(url));
    });

    await page.goto(`/${E2E_TEST_SLUG}/matches/${EXTERNAL_ID}/lineup`);
    await expect(page.getByTestId('lineup-screen')).toBeVisible({ timeout: 15_000 });

    // The lineup read is issued only after the tenant-scoped match read resolved: wait for it.
    await expect
      .poll(() => restUrls.filter((u) => u.includes('/rest/v1/match_players')).length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const lineupReads = restUrls.filter((u) => u.includes('/rest/v1/match_players') && u.includes('match_id='));
    expect(lineupReads.length).toBeGreaterThan(0);
    for (const url of lineupReads) {
      expect(url).toContain(`match_id=eq.${EXPECTED_SUPABASE_ID}`);
    }
    for (const url of restUrls) {
      expect(url).not.toContain(`eq.${EXTERNAL_ID}`);
      expect(url).not.toContain(ARCHIVAL_CZ_UNION_MATCH_ID);
    }
  });
});
