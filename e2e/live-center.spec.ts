/**
 * TEST-007 (SPEC-fan-app-live-status-derivation Spec-AC-06, e2e) — the live-centre
 * at `/e2e-test/live` shows a genuinely-running match and renders the empty state
 * only when nothing is genuinely live.
 *
 * Liveness is derived from the ACTUAL kickoff (`startedAt`) + `status`
 * `in_progress` within MATCH_LIVE_WINDOW_MS (shared `@fh/schema` derivation, OM
 * parity) — the Supabase→Convex mirror only ever writes `in_progress`, never the
 * literal `live` the old fan filter keyed on. This proves the fix end-to-end on
 * the live SPA render path.
 *
 * The `e2e-test` tenant carries no Convex match rows on the live stack, so the
 * data is supplied by the same protocol-correct Convex sync replay the PRD-057
 * fan-screen specs use (`installConvexReplay`) — it NEVER touches the real Convex
 * backend and NEVER references `cz-field-hockey-union`.
 */
import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';
import { installConvexReplay, REPLAY_MATCH } from './utils/convexReplay';

// A genuinely-live match: in_progress with a kickoff one minute ago (well within
// the 3h live window). The mirror writes `in_progress`, not `live`.
const LIVE_MATCH = {
  ...REPLAY_MATCH,
  _id: 'fanlive_e2e_live_1',
  supabaseId: '00000000-0000-4000-8000-0000abcd9101',
  homeTeamName: 'Live Home',
  awayTeamName: 'Live Away',
  homeClubName: 'Live Home',
  awayClubName: 'Live Away',
  status: 'in_progress',
  startedAt: Date.now() - 60_000,
  score: { home: 1, away: 0 },
};

// A match that must NOT count as live: in_progress but started ~4h ago (past the
// live window → awaiting_closure).
const STALE_MATCH = {
  ...REPLAY_MATCH,
  _id: 'fanlive_e2e_stale_1',
  supabaseId: '00000000-0000-4000-8000-0000abcd9102',
  status: 'in_progress',
  startedAt: Date.now() - 4 * 60 * 60_000,
};

test.describe('SPEC-fan-app-live-status-derivation TEST-007 — live-centre', () => {
  test('renders a MatchCard for a genuinely-live in_progress match', async ({ page }) => {
    await installConvexReplay(page, { list: [LIVE_MATCH] });
    await page.goto(`/${E2E_TEST_SLUG}/live`);

    // The running match surfaces (team name from the live card) and the empty
    // state does NOT.
    await expect(page.getByText('Live Home')).toBeVisible();
    await expect(page.getByText('Teď se nehraje')).toHaveCount(0);
  });

  test('shows the empty state when nothing is genuinely live (stale in_progress)', async ({ page }) => {
    await installConvexReplay(page, { list: [STALE_MATCH] });
    await page.goto(`/${E2E_TEST_SLUG}/live`);

    await expect(page.getByText('Teď se nehraje')).toBeVisible();
  });
});
