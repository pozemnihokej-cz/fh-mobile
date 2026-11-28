/**
 * spec-fan-live-score-header-card-mismatch TEST-004 (Spec-AC-04).
 *
 * The running fan app on the `e2e-test` slug renders a live match shaped like
 * PROD #80129 at the moment the owner saw two scores (2026-11-28 ~10:17):
 * 1Q of a `Q,10,[1,3,1]` match with the clock RUNNING from 5:04 left
 * (playing 296 s), and four goal rows, one of them stamped at 346.98 s —
 * ahead of the clock. `getBySupabaseId` counts every goal row (2 : 2).
 * Before the fix the sticky header read 2 : 2 and the card 1 : 2.
 *
 * Data arrives through the protocol-correct Convex sync replay
 * (`installConvexReplay`), so the real Convex backend is never touched and
 * nothing is written; the only real read is the `e2e-test` tenant lookup.
 * `cz-field-hockey-union` is never referenced.
 */
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay } from './utils/convexReplay';

const MATCH_UUID = '00000000-0000-4000-8000-00000000b129';

test.describe('spec-fan-live-score-header-card-mismatch TEST-004 — one live score on the match detail', () => {
  test.use({ locale: 'cs-CZ' });

  test('a goal stamped ahead of the running clock is counted in the header AND the card', async ({ page }) => {
    const now = Date.now();
    const detail = {
      _id: 'e2e_live_80129',
      supabaseId: MATCH_UUID,
      homeTeamId: 'team-rakovnik',
      awayTeamId: 'team-president',
      homeTeamName: 'Rakovník',
      awayTeamName: 'President',
      homeClubName: null,
      awayClubName: null,
      homeClubLogo: null,
      awayClubLogo: null,
      homeTeamLogo: null,
      awayTeamLogo: null,
      leagueName: 'Extraliga muži hala',
      location: 'Rakovník',
      date: now - 15 * 60_000,
      startedAt: now - 13 * 60_000,
      liveRunning: true,
      status: 'in_progress',
      homeScore: 2,
      awayScore: 2,
      hasPlayRecord: true,
      resultHomeScore: null,
      resultAwayScore: null,
      decidedByShootout: false,
      config: { partType: 'Q', gameTime: 10, pauseTimes: [1, 3, 1] },
    };
    const liveState = {
      _id: 'e2e_live_state',
      matchId: MATCH_UUID,
      phase: '1Q',
      // 5:04 left in a 10-minute quarter, running from now.
      time: 304,
      running: true,
      started: new Date(now).toISOString(),
      updatedAt: now,
    };
    const goal = (id: string, side: string, minute: number, time: number, playerName: string) => ({
      _id: id, _creationTime: now, matchId: MATCH_UUID, type: 'goal', side, phase: '1Q', minute, time, playerName, createdAt: now,
    });
    const timeline = [
      goal('g1', 'away', 0, 0, '6 - Rambousek Marek'),
      goal('g2', 'home', 0, 24, '35 - Ostaš Matěj'),
      goal('g3', 'home', 5, 346.98, '14 - Seemann Martin'),
      goal('g4', 'away', 4, 265.02, '22 - Baxa Jáchym'),
    ];

    await installConvexReplay(page, { detail, liveState, timeline });
    await page.goto(`/${E2E_TEST_SLUG}/matches/${MATCH_UUID}`);

    const header = page.getByTestId('match-detail-header-score');
    const card = page.getByTestId('match-detail-scoreboard');
    await expect(header).toHaveText('2 : 2', { timeout: 15_000 });
    await expect(card).toContainText('2 : 2');
    await expect(card).not.toContainText('1 : 2');

    // The clock keeps running (still below the 346.98 s stamp): the two stay equal.
    await page.waitForTimeout(3_000);
    await expect(header).toHaveText('2 : 2');
    await expect(card).toContainText('2 : 2');

    await page.screenshot({
      path: fileURLToPath(new URL('../../../docs/ai/tdd/fan-live-score-header-card-mismatch/e2e-live-score.png', import.meta.url)),
      fullPage: true,
    });
  });
});
