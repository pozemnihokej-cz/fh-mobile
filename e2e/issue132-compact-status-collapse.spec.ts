/**
 * ISSUE-132 / SPEC-091 TEST-005 (Spec-AC-05, e2e) — the compact match card must
 * not reserve its 60/66px status column for a match that has nothing to show
 * there.
 *
 * Measured in a REAL layout engine, which is the point: jsdom has no layout, so
 * the `@fh/ui` component tests can only pin the DECLARED width. Here we measure
 * the laid-out boxes of two rows rendered side by side in ONE list — a match
 * played earlier today (chip + score → the container renders) and one still to
 * be played today (nothing → the container must be gone) — and assert the
 * played row's teams column is exactly the reserved width plus the flex gap
 * NARROWER than the unplayed row's.
 *
 * Deliberately structural, with no new test ids: the row's `CardContent`
 * children ARE the layout (time · home crest · teams · away crest · [status]),
 * so the pre-fix build fails these assertions on the counts and the widths
 * rather than on a missing selector.
 *
 * Tenant safety: `e2e-test` slug only, auth + tenant lookup mocked in-page and
 * the Convex list replayed over the intercepted sync socket — no Supabase
 * write, no Convex backend call, `cz-field-hockey-union` never referenced.
 */
import { test, expect, type Locator } from '@playwright/test';
import { E2E_TEST_SLUG, installAuthMocks } from './utils/mockAuth';
import { installConvexReplay, REPLAY_MATCH } from './utils/convexReplay';

/** The `sm` (>=600px) reserved width of the status container in @fh/ui MatchCard. */
const RESERVED_WIDTH_SM = 66;
/**
 * The compact card's CardContent is a flex row with `gap: 1.25` (= 10px). Dropping
 * the status container therefore returns the reserved width AND the gap that sat in
 * front of it, so the teams column gains 76px, not 66. Measured, not assumed.
 */
const ROW_GAP = 10;

function todayAt(hour: number): number {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

// Both fixtures sit on TODAY so the matches list renders them in the same day
// group, inside the same-width container — the widths are then comparable.
const PLAYED = {
  ...REPLAY_MATCH,
  _id: 'issue132_played',
  supabaseId: '00000000-0000-4000-8000-0000abcd9132',
  homeTeamName: 'Gamma HC',
  awayTeamName: 'Delta HC',
  homeClubName: 'Gamma HC',
  awayClubName: 'Delta HC',
  date: todayAt(10),
  status: 'completed',
  score: { home: 3, away: 1 },
};

const UNPLAYED = {
  ...REPLAY_MATCH,
  _id: 'issue132_unplayed',
  supabaseId: '00000000-0000-4000-8000-0000abcd9133',
  homeTeamName: 'Alpha HC',
  awayTeamName: 'Bravo HC',
  homeClubName: 'Alpha HC',
  awayClubName: 'Bravo HC',
  date: todayAt(18),
  status: 'scheduled',
  score: { home: 0, away: 0 },
};

/** The compact card's row = the direct children of its CardContent. */
function rowChildren(card: Locator): Locator {
  return card.locator('.MuiCardContent-root > *');
}

async function widthOf(node: Locator): Promise<number> {
  const box = await node.boundingBox();
  expect(box, 'the measured node must be laid out').not.toBeNull();
  return box!.width;
}

test.describe('ISSUE-132 — empty status column collapses in the compact fan card', () => {
  test('the unplayed row has no status box and its teams column reclaims the reserved width', async ({ page }) => {
    await installAuthMocks(page);
    await installConvexReplay(page, { list: [PLAYED, UNPLAYED] });
    await page.goto(`/${E2E_TEST_SLUG}/matches`);

    const playedCard = page.locator('.MuiCard-root').filter({ hasText: 'Gamma HC' }).first();
    const unplayedCard = page.locator('.MuiCard-root').filter({ hasText: 'Alpha HC' }).first();
    await expect(playedCard).toBeVisible({ timeout: 15_000 });
    await expect(unplayedCard).toBeVisible();

    // 1. The played row keeps its five-part layout: time, home crest, teams,
    //    away crest, status container. (Neither fixture is starred; the starred
    //    indicator is a sixth, absolutely-positioned child when it is present.)
    await expect(rowChildren(playedCard)).toHaveCount(5);
    // 2. The unplayed row has FOUR: the status container is not rendered at all.
    await expect(rowChildren(unplayedCard)).toHaveCount(4);

    // 3. The played row's status container is the real, laid-out 66px box.
    const status = rowChildren(playedCard).nth(4);
    const statusBox = await status.boundingBox();
    expect(statusBox).not.toBeNull();
    expect(Math.round(statusBox!.width)).toBe(RESERVED_WIDTH_SM);
    expect(statusBox!.height).toBeGreaterThan(0);

    // 4. The teams column (the flex:1 child, index 2) reclaims exactly that
    //    width on the unplayed row. This is the defect, measured: 66px of every
    //    unplayed row was spent on a 0px-tall blank box.
    const playedTeams = await widthOf(rowChildren(playedCard).nth(2));
    const unplayedTeams = await widthOf(rowChildren(unplayedCard).nth(2));
    expect(Math.round(unplayedTeams - playedTeams)).toBe(RESERVED_WIDTH_SM + ROW_GAP);

    // 5. Both rows are the same overall width, so the comparison above is
    //    apples-to-apples and not an artefact of two different containers.
    expect(Math.round(await widthOf(playedCard))).toBe(Math.round(await widthOf(unplayedCard)));
  });
});
