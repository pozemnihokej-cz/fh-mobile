/**
 * spec-timeline-goal-score-on-caption-line TEST-008 (Spec-AC-08).
 *
 * Owner 2026-11-28: "Názvy barev karet v timeline dle jazyka". The fan match detail timeline
 * captions a card with its colour in the UI language — cs "Žlutá karta, 5′", en "Yellow card, 5′" —
 * for both writers' dialects (operator app `yellow` + seconds, bridge `Y` + minutes). Before the
 * change it read "KARTA (yellow, 5′)" / "CARD (yellow, 5′)".
 *
 * Convex is replayed in the browser (`installConvexReplay`): no backend write; the only real read is
 * the `e2e-test` tenant lookup. `cz-field-hockey-union` is never referenced.
 *
 * Run: cd apps/fh-mobile && E2E_BASE_URL=<worktree dev server> npx playwright test e2e/timeline-card-colour-label.spec.ts --workers=2
 * E2E_SHOT_NAME picks the screenshot file suffix (before / after evidence).
 */
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay } from './utils/convexReplay';

const MATCH_UUID = '00000000-0000-4000-8000-00000000b131';
const SHOT = process.env.E2E_SHOT_NAME || 'after';

const CASES = [
  { lng: 'cs', locale: 'cs-CZ', expected: { c1: 'Zelená karta, 2′', c2: 'Žlutá karta, 5′', c3: 'Žlutá karta, 10′', c4: 'Červená karta' } },
  { lng: 'en', locale: 'en-US', expected: { c1: 'Green card, 2′', c2: 'Yellow card, 5′', c3: 'Yellow card, 10′', c4: 'Red card' } },
] as const;

for (const { lng, locale, expected } of CASES) test.describe(`spec-timeline-goal-score-on-caption-line TEST-008 — card colour names (${lng})`, () => {
  test.use({ locale, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test(`card rows read the colour in ${lng} for both dialects`, async ({ page }) => {
    // The fan app may carry a remembered language; pin the one this case asserts.
    await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* storage off */ } }, lng);
    const now = Date.now();
    const detail = {
      _id: 'e2e_timeline_cards', supabaseId: MATCH_UUID,
      homeTeamId: 'team-home', awayTeamId: 'team-away', homeTeamName: 'Rakovník', awayTeamName: 'President',
      homeClubName: null, awayClubName: null, homeClubLogo: null, awayClubLogo: null, homeTeamLogo: null, awayTeamLogo: null,
      leagueName: 'Extraliga muži hala', location: 'Rakovník',
      date: now - 60 * 60_000, startedAt: now - 58 * 60_000, liveRunning: false, status: 'completed',
      homeScore: 0, awayScore: 0, hasPlayRecord: true, resultHomeScore: 0, resultAwayScore: 0, decidedByShootout: false,
      config: { partType: 'Q', gameTime: 10, pauseTimes: [1, 3, 1] },
    };
    const card = (id: string, side: string, minute: number, playerName: string, event: Record<string, unknown>) => ({
      _id: id, _creationTime: now, matchId: MATCH_UUID, type: 'card', side, phase: '1Q', minute, time: minute * 60, playerName, event, createdAt: now,
    });
    const timeline = [
      card('c1', 'home', 1, '4 - Novák Petr', { card: 'green', duration: 120 }), // operator app dialect
      card('c2', 'away', 3, '8 - Dvořák Jan', { card: 'yellow', duration: 300 }),
      card('c3', 'home', 6, '11 - Svoboda Karel', { card: 'Y', penalty: '10' }), // bridged old-app dialect
      card('c4', 'away', 8, '2 - Černý Adam', { card: 'R' }),
    ];

    await installConvexReplay(page, { detail, timeline });
    await page.goto(`/${E2E_TEST_SLUG}/matches/${MATCH_UUID}`);

    const first = page.getByTestId('timeline-event-c1');
    await expect(first).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('timeline-event-c4').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: fileURLToPath(new URL(`../../../docs/ai/tdd/timeline-goal-score-on-caption-line/e2e-cards-${lng}-${SHOT}.png`, import.meta.url)),
      fullPage: true,
    });

    for (const [id, text] of Object.entries(expected)) {
      await expect(page.getByTestId(`timeline-caption-${id}`), id).toHaveText(text);
    }
    const all = (await page.locator('[data-testid^="timeline-event-"]').allTextContents()).join(' ');
    expect(all).not.toMatch(/\((green|yellow|red|G|Y|R)\b/);
  });
});
