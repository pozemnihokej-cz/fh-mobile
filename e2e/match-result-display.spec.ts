/**
 * spec-match-display-no-score-one-team-shootout TEST-010 (Spec-AC-04, Spec-AC-05).
 *
 * The running fan app renders Convex rows shaped exactly like the new
 * `matches:list` / `matches:getBySupabaseId` read model (TEST-003):
 *   - a completed match never run in OM with a NULL result -> "Odehráno", no 0:0;
 *   - a SportsPress shootout result -> "3:2 sn";
 *   - a one-team event -> the team once, no "vs".
 *
 * Data arrives through the protocol-correct Convex sync replay
 * (`installConvexReplay`), so the real Convex backend is never touched; the
 * only real read is the `e2e-test` tenant lookup. `cz-field-hockey-union` is
 * never referenced.
 */
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay } from './utils/convexReplay';

// Earlier today: the list anchors on today, so these rows are on screen.
const TODAY = Date.now() - 2 * 3_600_000;

const base = {
  homeClubLogo: null,
  awayClubLogo: null,
  homeTeamLogo: null,
  awayTeamLogo: null,
  location: 'Praha',
  status: 'completed',
  homeScore: 0,
  awayScore: 0,
  hasPlayRecord: false,
  decidedByShootout: false,
  resultHomeScore: null,
  resultAwayScore: null,
  startedAt: null,
  liveRunning: false,
};

const NO_RESULT = {
  ...base,
  _id: 'e2e_result_none',
  supabaseId: '00000000-0000-4000-8000-00000000a001',
  homeTeamId: 'team-alpha',
  awayTeamId: 'team-bravo',
  homeTeamName: 'Alpha HC',
  awayTeamName: 'Bravo HC',
  leagueName: 'Přípravka',
  date: TODAY,
};

const SHOOTOUT = {
  ...base,
  _id: 'e2e_result_so',
  supabaseId: '00000000-0000-4000-8000-00000000a002',
  homeTeamId: 'team-charlie',
  awayTeamId: 'team-delta',
  homeTeamName: 'Charlie HC',
  awayTeamName: 'Delta HC',
  leagueName: 'Extraliga',
  date: TODAY + 60_000,
  resultHomeScore: 3,
  resultAwayScore: 2,
  decidedByShootout: true,
};

const ONE_TEAM = {
  ...base,
  _id: 'e2e_result_one',
  supabaseId: '00000000-0000-4000-8000-00000000a003',
  homeTeamId: 'team-echo',
  awayTeamId: 'team-echo',
  homeTeamName: 'Echo minibenjamínci',
  awayTeamName: 'Echo minibenjamínci',
  leagueName: 'MiniBenjamínci',
  date: TODAY + 120_000,
};

test.describe('spec-match-display-no-score-one-team-shootout TEST-010 — fan result display', () => {
  // The fan app follows the browser language; the federation's fans read Czech.
  test.use({ locale: 'cs-CZ' });
  test('the matches list shows no 0:0, the shootout marker, and a one-team event once', async ({ page }) => {
    await installConvexReplay(page, { list: [NO_RESULT, SHOOTOUT, ONE_TEAM] });
    await page.goto(`/${E2E_TEST_SLUG}/matches`);

    const noResultCard = page.locator('.MuiCard-root', { hasText: 'Alpha HC' }).first();
    await expect(noResultCard).toBeVisible({ timeout: 15_000 });
    await expect(noResultCard).toContainText(/odehráno/i);
    await expect(noResultCard.getByTestId('fh-matchcard-score')).toHaveCount(0);

    const soCard = page.locator('.MuiCard-root', { hasText: 'Charlie HC' }).first();
    await expect(soCard.getByTestId('fh-matchcard-score')).toHaveText(/3\s*:\s*2\s*sn/);
    await expect(soCard.getByTestId('fh-matchcard-shootout')).toHaveAttribute('title', 'po nájezdech');

    const oneCard = page.locator('.MuiCard-root', { hasText: 'Echo minibenjamínci' }).first();
    await expect(oneCard).toBeVisible();
    expect(((await oneCard.textContent()) ?? '').match(/Echo minibenjamínci/g)).toHaveLength(1);
    await expect(oneCard).not.toContainText(/\bvs\b/);

    await page.screenshot({
      path: fileURLToPath(new URL('../../../docs/ai/tdd/match-display-no-score-one-team-shootout/e2e-fh-mobile-list.png', import.meta.url)),
      fullPage: true,
    });
  });

  test('the match detail shows "Odehráno" for a completed match without a result', async ({ page }) => {
    await installConvexReplay(page, { detail: NO_RESULT });
    await page.goto(`/${E2E_TEST_SLUG}/matches/${NO_RESULT.supabaseId}`);
    const headerScore = page.getByTestId('match-detail-header-score');
    await expect(headerScore).toHaveText('Odehráno', { timeout: 15_000 });
    await expect(page.getByTestId('fh-scoreboard-placeholder')).toHaveText('Odehráno');
    await expect(page.locator('body')).not.toContainText('0 : 0');
  });

  test('the match detail shows the shootout result with its long form', async ({ page }) => {
    await installConvexReplay(page, { detail: SHOOTOUT });
    await page.goto(`/${E2E_TEST_SLUG}/matches/${SHOOTOUT.supabaseId}`);
    await expect(page.getByTestId('match-detail-header-score')).toHaveText('3 : 2 sn', { timeout: 15_000 });
    await expect(page.getByTestId('fh-scoreboard-shootout')).toHaveText('po nájezdech');
    await page.screenshot({
      path: fileURLToPath(new URL('../../../docs/ai/tdd/match-display-no-score-one-team-shootout/e2e-fh-mobile-detail-shootout.png', import.meta.url)),
      fullPage: true,
    });
  });
});
