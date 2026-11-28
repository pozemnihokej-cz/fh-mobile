/**
 * spec-timeline-goal-score-on-caption-line TEST-005 (Spec-AC-05).
 *
 * The fan match detail timeline ("ČASOVÁ OSA UTKÁNÍ") at phone width: a goal row shows the player
 * name alone on its line and the running score next to "GÓL" on the caption line. Before the
 * change the score badge sat beside the name and a long name wrapped onto two lines.
 *
 * Data arrives through the protocol-correct Convex sync replay (`installConvexReplay`), so the
 * real Convex backend is never touched and nothing is written; the only real read is the
 * `e2e-test` tenant lookup. `cz-field-hockey-union` is never referenced.
 *
 * Run: cd apps/fh-mobile && E2E_BASE_URL=<worktree dev server> npx playwright test e2e/timeline-goal-score-line.spec.ts --workers=2
 * E2E_SHOT_NAME picks the screenshot file suffix (before / after evidence).
 */
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay } from './utils/convexReplay';

const MATCH_UUID = '00000000-0000-4000-8000-00000000b130';
// A name too long for any phone line (ellipsis, full name in the title).
const LONG_NAME = 'Seemannová-Kovaříková Martina Alexandra';
const SHOT = process.env.E2E_SHOT_NAME || 'after';
// Each case: a name that wrapped beside the score badge at that width and fits once the badge moves.
// 360 px carries the owner's example (PROD, 2026-11-28: "5' | Seemann Martin [2:2] | GÓL").
const CASES = [
  { width: 390, name: 'Kovaříková Martina' },
  { width: 360, name: 'Seemann Martin' },
];

for (const { width, name: OWNER_NAME } of CASES) test.describe(`spec-timeline-goal-score-on-caption-line TEST-005 — the goal score sits on the GÓL line (${width} px)`, () => {
  test.use({ locale: 'cs-CZ', viewport: { width, height: 844 }, isMobile: true, hasTouch: true });

  test(`"${OWNER_NAME}" keeps one line at ${width} px; the score badge is on the caption line`, async ({ page }) => {
    const now = Date.now();
    const detail = {
      _id: 'e2e_timeline_score_line',
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
      resultHomeScore: 2,
      resultAwayScore: 2,
      decidedByShootout: false,
      config: { partType: 'Q', gameTime: 10, pauseTimes: [1, 3, 1] },
    };
    const goal = (id: string, side: string, minute: number, time: number, playerName: string) => ({
      _id: id, _creationTime: now, matchId: MATCH_UUID, type: 'goal', side, phase: '1Q', minute, time, playerName, createdAt: now,
    });
    const timeline = [
      goal('g1', 'away', 0, 10, '6 - Rambousek Marek'),
      goal('g2', 'home', 1, 70, '35 - Ostaš Matěj'),
      goal('g3', 'home', 5, 300, `14 - ${OWNER_NAME}`),
      goal('g4', 'away', 8, 480, `22 - ${LONG_NAME}`),
      // An event bridged from the old app without a minute (an injury, so the running score is
      // untouched): the "doplnit minutu" chip shares the name line (code review NB-1 — the chip
      // must not squeeze the name to "…").
      { ...goal('g5', 'home', 0, 0, `9 - ${OWNER_NAME}`), type: 'injury', phase: '', time: undefined, minuteToVerify: true },
    ];

    await installConvexReplay(page, { detail, timeline });
    await page.goto(`/${E2E_TEST_SLUG}/matches/${MATCH_UUID}`);

    const row = page.getByTestId('timeline-event-g3');
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.scrollIntoViewIfNeeded();
    await expect(row).toContainText(OWNER_NAME);
    await expect(row).toContainText('2:1');

    const shotPath = fileURLToPath(new URL(`../../../docs/ai/tdd/timeline-goal-score-on-caption-line/e2e-${width}-${SHOT}.png`, import.meta.url));
    await row.screenshot({ path: shotPath.replace(/\.png$/, '-row.png') });
    await page.screenshot({ path: shotPath, fullPage: true });
    // Diagnostic for the before/after record: the height of the row's name text in lines
    // (the third <p> of the row: minute, crest letter, name), measured without the test hooks.
    const measured = await row.locator('p').nth(2).evaluate((el) => {
      const cs = getComputedStyle(el);
      return { text: el.textContent, lines: el.getBoundingClientRect().height / (parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5) };
    });
    console.log(`[TEST-005] ${width}px ${SHOT}: name element "${measured.text}" spans ${measured.lines.toFixed(2)} line(s)`);

    // The score badge is on the caption line, next to "GÓL".
    const caption = page.getByTestId('timeline-caption-g3');
    await expect(caption).toContainText('GÓL');
    await expect(caption.getByTestId('timeline-score-g3')).toHaveText('2:1');

    // The name keeps ONE line at 390 px; the owner's example fits whole (no ellipsis).
    const lines = (testId: string) =>
      page.getByTestId(testId).evaluate((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        return { lines: el.getBoundingClientRect().height / lh, truncated: el.scrollWidth > el.clientWidth };
      });
    const owner = await lines('timeline-name-g3');
    expect(owner.lines).toBeLessThan(1.5);
    expect(owner.truncated).toBe(false);
    await expect(page.getByTestId('timeline-name-g3')).toHaveText(OWNER_NAME);

    // A name too long for the line stays on one line (ellipsis), full name in the title.
    const long = await lines('timeline-name-g4');
    expect(long.lines).toBeLessThan(1.5);
    await expect(page.getByTestId('timeline-name-g4')).toHaveAttribute('title', LONG_NAME);
    await expect(page.getByTestId('timeline-caption-g4').getByTestId('timeline-score-g4')).toHaveText('2:2');

    // A status chip beside the name never truncates it: the chip moves under the name instead.
    await page.getByTestId('timeline-event-g5').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('timeline-minute-to-verify-g5')).toBeVisible();
    await page.getByTestId('timeline-event-g5').screenshot({
      path: fileURLToPath(new URL(`../../../docs/ai/tdd/timeline-goal-score-on-caption-line/e2e-${width}-${SHOT}-minute-to-verify-row.png`, import.meta.url)),
    });
    const unverified = await lines('timeline-name-g5');
    expect(unverified.truncated).toBe(false);
    expect(unverified.lines).toBeLessThan(1.5);
  });
});
