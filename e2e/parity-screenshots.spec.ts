/**
 * SPEC-PRD-057 TEST-016 (Spec-AC-07 EVIDENCE, e2e) — one screenshot per screen.
 *
 * Captures a Playwright screenshot of every built fan screen under the live
 * `e2e-test` tenant into the test's output directory. This is EVIDENCE for the
 * review-gated visual-parity AC-07 — it does NOT assert visual parity (that is a
 * human verdict against the showcase gallery). The test's job is simply to
 * produce the per-screen screenshots reliably.
 *
 * Convex-backed screens (matches / live / detail) are populated via the
 * deterministic Convex replay so the screenshots show representative content
 * rather than an empty tenant; Supabase-backed screens render their live
 * `e2e-test` data (mostly empty → the designed EmptyState, which is itself valid
 * parity evidence). Read-only; `cz-field-hockey-union` never referenced.
 */

import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay, REPLAY_MATCH, REPLAY_MATCH_DETAIL } from './utils/convexReplay';

const E2E_TEST_CLUB_ID = '814b96e3-6a08-4d47-b26e-8c1610fe9d4c';
const ANY_PLAYER_ID = '00000000-0000-4000-8000-0000abcd7001';

// A live match so the LiveCenter screenshot is populated too (matches:list is
// shared by both screens; LiveCenter filters to status==='live').
const REPLAY_MATCH_LIVE = {
  ...REPLAY_MATCH,
  _id: 'prd057_e2e_match_live',
  supabaseId: '00000000-0000-4000-8000-0000abcd9002',
  homeTeamName: 'Delta HC',
  awayTeamName: 'Echo HC',
  homeClubName: 'Delta HC',
  awayClubName: 'Echo HC',
  status: 'live',
  score: { home: 1, away: 1 },
  liveState: { phase: '2. poločas' },
};

interface Shot {
  name: string;
  path: string;
  ready: (page: import('@playwright/test').Page) => Promise<void>;
}

test.describe('SPEC-PRD-057 TEST-016 — per-screen parity screenshots (evidence only)', () => {
  test('captures one screenshot per built fan screen', async ({ page }, testInfo) => {
    await installConvexReplay(page, {
      list: [REPLAY_MATCH_LIVE, REPLAY_MATCH],
      detail: REPLAY_MATCH_DETAIL,
    });

    const byTestId = (id: string) => async (p: typeof page) => {
      await expect(p.getByTestId(id)).toBeVisible({ timeout: 15_000 });
    };

    const shots: Shot[] = [
      { name: 'Matches', path: 'matches', ready: async (p) => { await expect(p.getByText('Alpha HC').first()).toBeVisible({ timeout: 15_000 }); } },
      { name: 'MatchDetail', path: `matches/${REPLAY_MATCH_DETAIL.supabaseId}`, ready: async (p) => { await expect(p.getByText('Alpha HC').first()).toBeVisible({ timeout: 15_000 }); } },
      { name: 'LiveCenter', path: 'live', ready: async (p) => { await expect(p.getByText('Delta HC').first()).toBeVisible({ timeout: 15_000 }); } },
      { name: 'Standings', path: 'standings', ready: byTestId('standings-screen') },
      { name: 'Schedule', path: 'schedule', ready: byTestId('schedule-screen') },
      { name: 'ClubDetail', path: `clubs/${E2E_TEST_CLUB_ID}`, ready: byTestId('club-detail-screen') },
      { name: 'Lineup', path: `matches/${REPLAY_MATCH_DETAIL.supabaseId}/lineup`, ready: byTestId('lineup-screen') },
      { name: 'Search', path: 'search', ready: byTestId('search-screen') },
      { name: 'PlayerDetail', path: `players/${ANY_PLAYER_ID}`, ready: byTestId('player-detail-screen') },
      { name: 'Onboarding', path: 'onboarding', ready: byTestId('onboarding-screen') },
      { name: 'News', path: 'news', ready: byTestId('news-screen') },
      { name: 'Notifications', path: 'notifications', ready: byTestId('notifications-screen') },
      { name: 'Profile', path: 'profile', ready: byTestId('profile-screen') },
    ];

    const captured: string[] = [];
    for (const shot of shots) {
      await page.goto(`/${E2E_TEST_SLUG}/${shot.path}`);
      await shot.ready(page);
      // Let async content + the sticky-header blur settle before the shot.
      await page.waitForTimeout(500);
      const file = testInfo.outputPath(`parity-${shot.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      await testInfo.attach(`parity-${shot.name}`, { path: file, contentType: 'image/png' });
      captured.push(shot.name);
    }

    // eslint-disable-next-line no-console
    console.log(`SPEC-PRD-057 TEST-016: captured ${captured.length} screenshots → ${captured.join(', ')}`);
    // Evidence sanity: every intended screen produced a file (NOT a parity verdict).
    expect(captured.length).toBe(shots.length);
  });
});
