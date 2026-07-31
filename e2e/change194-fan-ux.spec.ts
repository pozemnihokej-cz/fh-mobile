/**
 * CHANGE-194 — fan-app UX fixes (visual + behavioural e2e).
 *
 * Covers the three reported fan-app bugs, all against the read-only `e2e-test`
 * tenant (Convex list replayed in-page; no Supabase write, no Convex backend
 * call, `cz-field-hockey-union` never referenced):
 *
 *   Bug 1 — team logos: a stored `/storage/v1/assets/…` path must be resolved to
 *           the proxied public-object form before it reaches <img src>. We assert
 *           the app actually REQUESTS the resolved URL and never the raw (404ing)
 *           form. (Data gap for NULL logos is out of scope — those fall back to
 *           the gradient crest by design.)
 *   Bug 2 — compact list card: the matches list uses the dense two-row variant,
 *           so league · date · venue collapse into a single meta line.
 *   Bug 3 — switch organization: the Profile screen exposes an affordance that
 *           navigates back to the `/` tenant picker.
 */
import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay, REPLAY_MATCH } from './utils/convexReplay';

const RAW_LOGO_PATH = '/storage/v1/assets/00000000-0000-4000-8000-000000000001/club-logo/change194.png';
const RESOLVED_LOGO_PATH =
  '/storage/v1/object/public/assets/00000000-0000-4000-8000-000000000001/club-logo/change194.png';

const MATCH_WITH_LOGO = {
  ...REPLAY_MATCH,
  _id: 'change194_e2e_match_logo',
  homeClubName: 'Alpha HC',
  awayClubName: 'Bravo HC',
  // Stored form the importer writes — relative /storage/v1/assets/… (Bug 1).
  homeClubLogo: RAW_LOGO_PATH,
  awayClubLogo: null,
  leagueName: 'Extraliga',
  location: 'Praha',
  status: 'scheduled',
};

test.describe('CHANGE-194 — fan-app UX fixes', () => {
  test('Bug 1 — stored storage-path logo is requested as the resolved public URL, never raw', async ({ page }) => {
    const storageRequests: string[] = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('/storage/v1/')) storageRequests.push(new URL(u).pathname);
    });

    await installConvexReplay(page, { list: [MATCH_WITH_LOGO] });
    await page.goto(`/${E2E_TEST_SLUG}/matches`);
    await expect(page.getByText('Alpha HC').first()).toBeVisible({ timeout: 10_000 });

    // The crest <img> must request the RESOLVED public-object path…
    await expect
      .poll(() => storageRequests.some((p) => p === RESOLVED_LOGO_PATH), { timeout: 5_000 })
      .toBe(true);
    // …and NEVER the raw /storage/v1/assets/… form that 404s.
    expect(storageRequests.some((p) => p.startsWith('/storage/v1/assets/'))).toBe(false);
  });

  test('Bug 2 — matches list renders the compact two-row card (single meta line)', async ({ page }, testInfo) => {
    await installConvexReplay(page, { list: [MATCH_WITH_LOGO] });
    await page.goto(`/${E2E_TEST_SLUG}/matches`);
    await expect(page.getByText('Alpha HC').first()).toBeVisible({ timeout: 10_000 });

    // Compact card collapses league + date + venue into ONE caption line joined
    // by ' · ' (the full card renders venue in a separate bordered footer).
    await expect(page.getByText(/Extraliga\s+·.*·\s+Praha/).first()).toBeVisible();

    await page.screenshot({ path: testInfo.outputPath('change194-matches-compact.png'), fullPage: true });
  });

  test('Bug 3 — Profile exposes a switch-organization affordance that returns to the picker', async ({ page }, testInfo) => {
    await page.goto(`/${E2E_TEST_SLUG}/profile`);

    const switchBtn = page.getByTestId('profile-switch-org');
    await expect(switchBtn).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: testInfo.outputPath('change194-profile-switch-org.png'), fullPage: true });

    await switchBtn.click();
    // Lands on `/` — the tenant picker. It lists the e2e-test tenant row.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/e2e-test/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
