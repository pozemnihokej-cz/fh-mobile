/**
 * spec-timeline-minute-light-colour TEST-003 (Spec-AC-03).
 *
 * The fan match detail timeline ("ČASOVÁ OSA UTKÁNÍ") at 390 px: the minute of a goal row, of a
 * shoot-out goal ("SO") and of a card row all have one light colour. Before the change a goal's
 * minute was green (primary) and a card's was light (secondary text).
 *
 * Data arrives through the protocol-correct Convex sync replay (`installConvexReplay`), so the
 * real Convex backend is never touched and nothing is written; the only real read is the
 * `e2e-test` tenant lookup. `cz-field-hockey-union` is never referenced.
 *
 * Run: cd apps/fh-mobile && E2E_BASE_URL=<worktree dev server> npx playwright test e2e/timeline-minute-colour.spec.ts --workers=2
 * E2E_SHOT_NAME picks the screenshot file suffix (before / after evidence).
 */
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay } from './utils/convexReplay';

const MATCH_UUID = '00000000-0000-4000-8000-00000000b131';
const SHOT = process.env.E2E_SHOT_NAME || 'after';

test.describe('spec-timeline-minute-light-colour TEST-003 — every minute is light (390 px)', () => {
  test.use({ locale: 'cs-CZ', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('goal, shoot-out goal and card minutes share one colour', async ({ page }) => {
    const now = Date.now();
    const detail = {
      _id: 'e2e_timeline_minute_colour',
      supabaseId: MATCH_UUID,
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      homeTeamName: 'Rakovník',
      awayTeamName: 'President',
      homeClubName: null,
      awayClubName: null,
      homeClubLogo: null,
      awayClubLogo: null,
      homeTeamLogo: null,
      awayTeamLogo: null,
      leagueName: 'Extraliga ženy hala',
      location: 'Rakovník',
      date: now - 60 * 60_000,
      startedAt: now - 58 * 60_000,
      liveRunning: false,
      status: 'completed',
      homeScore: 2,
      awayScore: 2,
      hasPlayRecord: true,
      resultHomeScore: 3,
      resultAwayScore: 2,
      decidedByShootout: true,
      config: { partType: 'Q', gameTime: 10, pauseTimes: [1, 3, 1] },
    };
    const row = (id: string, type: string, side: string, phase: string, minute: number, time: number, playerName: string, extra = {}) => ({
      _id: id, _creationTime: now, matchId: MATCH_UUID, type, side, phase, minute, time, playerName, createdAt: now, ...extra,
    });
    const timeline = [
      row('g1', 'goal', 'away', '1Q', 2, 120, '6 - Rambousek Marek'),
      row('c1', 'card', 'home', '1Q', 4, 240, '9 - Novák Petr', { event: { card: 'yellow' } }),
      row('g2', 'goal', 'home', '2Q', 15, 900, '14 - Seemann Martin'),
      row('s1', 'shootout_goal', 'home', 'SO', 40, 2400, '35 - Ostaš Matěj'),
    ];

    await installConvexReplay(page, { detail, timeline });
    await page.goto(`/${E2E_TEST_SLUG}/matches/${MATCH_UUID}`);

    const goal = page.getByTestId('timeline-event-g2');
    await expect(goal).toBeVisible({ timeout: 15_000 });

    const dir = `../../../docs/ai/tdd/timeline-minute-light-colour/`;
    // The page body is a fixed-height scroller, so a full-page shot stops at the fold: the viewport
    // (shoot-out + goal rows) plus the 1st-quarter goal and card rows shot one by one.
    await page.screenshot({ path: fileURLToPath(new URL(`${dir}e2e-390-${SHOT}.png`, import.meta.url)) });
    for (const id of ['g1', 'c1']) {
      await page.getByTestId(`timeline-event-${id}`).screenshot({ path: fileURLToPath(new URL(`${dir}e2e-390-${SHOT}-row-${id}.png`, import.meta.url)) });
    }

    const colour = (id: string) =>
      page.getByTestId(`timeline-minute-${id}`).evaluate((el) => ({ text: el.textContent, color: getComputedStyle(el).color }));
    const minutes = { g1: await colour('g1'), c1: await colour('c1'), g2: await colour('g2'), s1: await colour('s1') };
    console.log(`[TEST-003] ${SHOT}: ${JSON.stringify(minutes)}`);

    expect(minutes.g1.text).toBe("2'");
    expect(minutes.g2.text).toBe("15'");
    expect(minutes.s1.text).toBe('SO');
    expect(minutes.c1.text).toBe("4'");
    expect(minutes.g1.color).toBe(minutes.c1.color);
    expect(minutes.g2.color).toBe(minutes.c1.color);
    expect(minutes.s1.color).toBe(minutes.c1.color);
  });
});
