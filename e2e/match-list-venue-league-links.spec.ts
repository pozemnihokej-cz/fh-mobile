/**
 * PRD-072 / spec-fan-match-list-venue-league-and-maps — TEST-010: venue and competition deep links and the Google
 * Maps action, in the real fan app.
 *
 * Convex data is supplied by the protocol-correct sync replay (`installConvexReplay`), which never connects to the
 * real Convex backend, so the new `venueInfo` field is exercised without pushing functions anywhere. The tenant
 * lookup is the real read-only Supabase call for the `e2e-test` slug; no other tenant is referenced and nothing is
 * written.
 *
 * Run from apps/fh-mobile against a dev server serving THIS tree:
 *   E2E_BASE_URL=http://localhost:<port> npx playwright test e2e/match-list-venue-league-links.spec.ts --project=fh-mobile
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay } from './utils/convexReplay';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.resolve(HERE, '../../../docs/ai/reports');
const SOON = Date.now() + 2 * 3_600_000;

const ROW = (over: Record<string, unknown>) => ({
  homeClubName: null,
  awayClubName: null,
  homeClubLogo: null,
  awayClubLogo: null,
  status: 'scheduled',
  score: { home: 0, away: 0 },
  ...over,
});

const LIST = [
  ROW({ _id: 'p72_a', supabaseId: '00000000-0000-4000-8000-0000abcd7201', homeTeamName: 'Eden Domácí', awayTeamName: 'Eden Hosté', date: SOON, location: 'Hřiště Eden', venueId: 'p72-venue-eden', leagueId: 'p72-league-xl', leagueName: 'Extraliga mužů' }),
  ROW({ _id: 'p72_b', supabaseId: '00000000-0000-4000-8000-0000abcd7202', homeTeamName: 'Kbely Domácí', awayTeamName: 'Kbely Hosté', date: SOON + 60_000, location: 'Kbely', venueId: 'p72-venue-kbely', leagueId: 'p72-league-dor', leagueName: 'Dorostenci' }),
  ROW({ _id: 'p72_c', supabaseId: '00000000-0000-4000-8000-0000abcd7203', homeTeamName: 'Eden Dorost', awayTeamName: 'Eden Soupeř', date: SOON + 120_000, location: 'Hřiště Eden', venueId: 'p72-venue-eden', leagueId: 'p72-league-dor', leagueName: 'Dorostenci' }),
];

const DETAIL = {
  ...LIST[0],
  homeTeamLogo: null,
  awayTeamLogo: null,
  venueInfo: { name: 'Hřiště Eden', address: 'Vladivostocká 1, Praha', gps: '50.0701, 14.4720' },
};

async function visibleHomeTeams(page: Page): Promise<string[]> {
  const out: string[] = [];
  for (const name of ['Eden Domácí', 'Kbely Domácí', 'Eden Dorost']) {
    if ((await page.getByText(name, { exact: true }).count()) > 0) out.push(name);
  }
  return out;
}

async function openInfo(page: Page, detail: unknown) {
  await installConvexReplay(page, { list: LIST, detail });
  await page.goto(`/${E2E_TEST_SLUG}/matches/${DETAIL.supabaseId}`);
  await page.getByRole('button', { name: /přehled/i }).click();
  const card = page.getByTestId('match-info-card');
  await expect(card).toBeVisible({ timeout: 15_000 });
  return card;
}

test.describe('PRD-072 venue / competition links and Maps', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Match information links to the filtered list and offers Google Maps navigation', async ({ page }) => {
    const card = await openInfo(page, DETAIL);
    const venue = card.getByRole('link', { name: 'Hřiště Eden', exact: true });
    await expect(venue).toHaveAttribute('href', `/${E2E_TEST_SLUG}/matches?venue=p72-venue-eden`);
    const maps = card.getByRole('link', { name: 'Navigovat na Hřiště Eden v Google Mapách' });
    await expect(maps).toHaveAttribute('href', 'https://www.google.com/maps/dir/?api=1&destination=50.0701%2C14.472');
    await expect(maps).toHaveAttribute('target', '_blank');
    await expect(maps).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(card.getByRole('link', { name: 'Extraliga mužů', exact: true })).toHaveAttribute('href', `/${E2E_TEST_SLUG}/matches?league=p72-league-xl`);

    // Keyboard focus is visible on the Maps action, and the phone layout has no horizontal overflow.
    // Keyboard modality: focus the venue link, then Tab onto the Maps action.
    await venue.focus();
    await page.keyboard.press('Tab');
    await expect(maps).toBeFocused();
    await expect(maps).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Shift+Tab');
    await expect(venue).toBeFocused();
    await expect(venue).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Tab');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await card.screenshot({ path: path.join(REPORTS, 'prd-072-match-info-links-390.png') });

    await venue.click();
    await expect(page).toHaveURL(new RegExp(`/${E2E_TEST_SLUG}/matches\\?venue=p72-venue-eden$`));
    await expect(page.getByText('Eden Domácí', { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(await visibleHomeTeams(page)).toEqual(['Eden Domácí', 'Eden Dorost']);
  });

  test('no Maps action without coordinates or address; the venue name still links', async ({ page }) => {
    const card = await openInfo(page, { ...DETAIL, venueInfo: { name: 'Hřiště Eden', address: null, gps: null } });
    await expect(card.getByRole('link', { name: 'Hřiště Eden', exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: /Google Mapách/ })).toHaveCount(0);
  });

  test('a competition deep link filters on a fresh load with empty session storage and survives refresh', async ({ page }) => {
    await installConvexReplay(page, { list: LIST });
    await page.goto(`/${E2E_TEST_SLUG}/matches?league=p72-league-dor`);
    await expect(page.getByText('Kbely Domácí', { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(await visibleHomeTeams(page)).toEqual(['Kbely Domácí', 'Eden Dorost']);
    await page.screenshot({ path: path.join(REPORTS, 'prd-072-list-league-deeplink-390.png') });

    await page.reload();
    await expect(page.getByText('Kbely Domácí', { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(await visibleHomeTeams(page)).toEqual(['Kbely Domácí', 'Eden Dorost']);
  });

  test('an unknown venue falls back to the unfiltered list', async ({ page }) => {
    await installConvexReplay(page, { list: LIST });
    await page.goto(`/${E2E_TEST_SLUG}/matches?venue=not-in-this-tenant`);
    await expect(page.getByText('Kbely Domácí', { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(await visibleHomeTeams(page)).toEqual(['Eden Domácí', 'Kbely Domácí', 'Eden Dorost']);
  });
});
