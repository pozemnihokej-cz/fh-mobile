/**
 * ISSUE-133 / SPEC-091 TEST-005, refined by ISSUE-135 / SPEC-093 TEST-005 + TEST-006 —
 * the compact match card reserves a fixed 60/66px status column so away crests line up
 * down the column, and drops that reserve for a match with nothing to show there ONLY
 * while the CARD itself is narrow.
 *
 * Measured in a REAL layout engine, which is the point twice over: jsdom has no layout,
 * and it does not evaluate container queries at all, so the `@fh/ui` component tests can
 * only pin the DECLARED rules. Here we measure the laid-out boxes of a played and an
 * unplayed row from ONE list at two widths:
 *
 *   TEST-005 (wide)   viewport 1280 → the fan matches list is in its two-column layout
 *                     (`Grid item xs={12} md={6}` in `Container maxWidth="lg"`), so each
 *                     card is ~570px — comfortably over the 418px card-content-box
 *                     threshold. The unplayed row must reserve the SAME 66px the played
 *                     row does, both teams columns must be the same width, and both away
 *                     crests must sit at the same offset from their card's left edge.
 *                     That last one is the property the reserve exists for.
 *   TEST-006 (narrow) viewport 390 → one column, ~358px card, under the threshold. The
 *                     unplayed row's status box must not be laid out at all and its teams
 *                     column must be wider than the played row's by the `xs` reserve plus
 *                     the flex gap. This is the ISSUE-133 behaviour, now scoped to narrow.
 *   TEST-007 (bound)  viewport 900, the `md` breakpoint itself → the NARROWEST card the
 *                     two-column list can produce, 420px. This is the load-bearing number
 *                     behind the threshold, so it gets its own guard: TEST-005 runs at 1280
 *                     with 170px of slack and would not notice the boundary moving.
 *
 * Both tests also assert the box is in the DOM at BOTH widths (five row children either
 * way): the switch is `display`, not presence, so a test that only counted children would
 * no longer distinguish the two states.
 *
 * Deliberately structural, with NO test ids: the row's `CardContent` children ARE the layout
 * (time · home crest · teams · away crest · status).
 *
 * Tenant safety: `e2e-test` slug only, auth + tenant lookup mocked in-page and the Convex
 * list replayed over the intercepted sync socket — no Supabase write, no Convex backend
 * call, `cz-field-hockey-union` never referenced.
 */
import { test, expect, type Locator } from '@playwright/test';
import { E2E_TEST_SLUG, installAuthMocks } from './utils/mockAuth';
import { installConvexReplay, REPLAY_MATCH } from './utils/convexReplay';

/** The `sm` (>=600px) reserved width of the status container in @fh/ui MatchCard. */
const RESERVED_WIDTH_SM = 66;
/** Its `xs` (<600px) reserved width — the viewport-keyed width is unchanged by SPEC-093. */
const RESERVED_WIDTH_XS = 60;
/**
 * `COMPACT_STATUS_RESERVE_MIN_PX` (400) in packages/ui/src/mobile/MatchCard.tsx is a
 * card-CONTENT-box width; `boundingBox().width` is a BORDER box, so the comparable number is
 * 402 (1px border each side).
 *
 * This is a BRACKET, not a pin: it only asserts that each test measured the branch it means to
 * measure. It does NOT pin the threshold's value — any threshold in (356, 568] leaves all three
 * tests green. The exact value is pinned in packages/ui/src/mobile/__tests__/MatchCard.test.tsx.
 */
const RESERVE_MIN_CARD_BORDER_PX = 402;
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

async function boxOf(node: Locator) {
  const box = await node.boundingBox();
  expect(box, 'the measured node must be laid out').not.toBeNull();
  return box!;
}

async function widthOf(node: Locator): Promise<number> {
  return (await boxOf(node)).width;
}

/** Offset of a row child from its own card's left edge — comparable across columns. */
async function offsetInCard(card: Locator, child: Locator): Promise<number> {
  const [cardBox, childBox] = [await boxOf(card), await boxOf(child)];
  return childBox.x - cardBox.x;
}

test.describe('ISSUE-135 — the compact fan card drops its empty status reserve only on a narrow card', () => {
  test('TEST-005 wide card (two-column list, viewport 1280): the unplayed row reserves the status width and keeps the away crests aligned', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await installAuthMocks(page);
    await installConvexReplay(page, { list: [PLAYED, UNPLAYED] });
    await page.goto(`/${E2E_TEST_SLUG}/matches`);

    const playedCard = page.locator('.MuiCard-root').filter({ hasText: 'Gamma HC' }).first();
    const unplayedCard = page.locator('.MuiCard-root').filter({ hasText: 'Alpha HC' }).first();
    await expect(playedCard).toBeVisible({ timeout: 15_000 });
    await expect(unplayedCard).toBeVisible();

    // 0. Both cards are wide enough for the reserve — otherwise everything below would be
    //    asserting the narrow branch by accident.
    const playedCardWidth = await widthOf(playedCard);
    const unplayedCardWidth = await widthOf(unplayedCard);
    expect(Math.round(playedCardWidth)).toBe(Math.round(unplayedCardWidth));
    expect(playedCardWidth).toBeGreaterThanOrEqual(RESERVE_MIN_CARD_BORDER_PX);

    // 1. Both rows carry the same five-part layout: time, home crest, teams, away crest,
    //    status container. (Neither fixture is starred; the starred indicator is a sixth,
    //    absolutely-positioned child when it is present.)
    await expect(rowChildren(playedCard)).toHaveCount(5);
    await expect(rowChildren(unplayedCard)).toHaveCount(5);

    // 2. BOTH status containers are laid out at the reserved width — the unplayed one holds
    //    nothing, which is exactly the space being reserved for a score.
    //    NOTE: an empty reserve is a 66 x 0 box, and Playwright's toBeVisible()/toBeHidden()
    //    both key off a NON-EMPTY box, so neither can tell a reserved empty column from a
    //    collapsed one. Only the presence of a layout box can, so that is what is asserted
    //    here and, inverted, in TEST-006.
    const playedStatus = await boxOf(rowChildren(playedCard).nth(4));
    const unplayedStatus = await boxOf(rowChildren(unplayedCard).nth(4));
    expect(Math.round(playedStatus.width)).toBe(RESERVED_WIDTH_SM);
    expect(Math.round(unplayedStatus.width)).toBe(RESERVED_WIDTH_SM);
    expect(playedStatus.height).toBeGreaterThan(0);

    // 3. So the teams columns are the same width…
    const playedTeams = await widthOf(rowChildren(playedCard).nth(2));
    const unplayedTeams = await widthOf(rowChildren(unplayedCard).nth(2));
    expect(Math.round(unplayedTeams)).toBe(Math.round(playedTeams));

    // 4. …and the away crests line up: the same offset from each card's left edge. This is
    //    the vertical line of away logos the fixed reserve exists to produce.
    const playedCrest = await offsetInCard(playedCard, rowChildren(playedCard).nth(3));
    const unplayedCrest = await offsetInCard(unplayedCard, rowChildren(unplayedCard).nth(3));
    expect(Math.round(unplayedCrest)).toBe(Math.round(playedCrest));
  });

  test('TEST-007 the md breakpoint itself (viewport 900, the narrowest two-column card): the reserve survives', async ({
    page,
  }) => {
    // The threshold is derived from THIS card: (900 - 48 - 12) / 2 = 420px of card, 418px of
    // content box. It is the whole justification for the number, so it is guarded here rather
    // than left in a spec table. (With a classic scrollbar the same viewport yields ~410.5px,
    // which is why the threshold is 400 and not 418 — that platform is not measured here.)
    await page.setViewportSize({ width: 900, height: 720 });
    await installAuthMocks(page);
    await installConvexReplay(page, { list: [PLAYED, UNPLAYED] });
    await page.goto(`/${E2E_TEST_SLUG}/matches`);

    const playedCard = page.locator('.MuiCard-root').filter({ hasText: 'Gamma HC' }).first();
    const unplayedCard = page.locator('.MuiCard-root').filter({ hasText: 'Alpha HC' }).first();
    await expect(playedCard).toBeVisible({ timeout: 15_000 });
    await expect(unplayedCard).toBeVisible();

    // Two columns, and the card is the derived 420px — if this number moves, the threshold's
    // justification has moved with it and this test says so.
    const cardWidth = await widthOf(unplayedCard);
    expect(Math.round(cardWidth)).toBe(420);
    expect(cardWidth).toBeGreaterThanOrEqual(RESERVE_MIN_CARD_BORDER_PX);

    const unplayedStatus = await boxOf(rowChildren(unplayedCard).nth(4));
    expect(Math.round(unplayedStatus.width)).toBe(RESERVED_WIDTH_SM);
    const playedCrest = await offsetInCard(playedCard, rowChildren(playedCard).nth(3));
    const unplayedCrest = await offsetInCard(unplayedCard, rowChildren(unplayedCard).nth(3));
    expect(Math.round(unplayedCrest)).toBe(Math.round(playedCrest));
  });

  test('TEST-006 narrow card (one column, viewport 390): the unplayed row has no laid-out status box and its teams column reclaims the reserve', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installAuthMocks(page);
    await installConvexReplay(page, { list: [PLAYED, UNPLAYED] });
    await page.goto(`/${E2E_TEST_SLUG}/matches`);

    const playedCard = page.locator('.MuiCard-root').filter({ hasText: 'Gamma HC' }).first();
    const unplayedCard = page.locator('.MuiCard-root').filter({ hasText: 'Alpha HC' }).first();
    await expect(playedCard).toBeVisible({ timeout: 15_000 });
    await expect(unplayedCard).toBeVisible();

    // 0. Both cards are under the threshold, so this really is the narrow branch.
    const playedCardWidth = await widthOf(playedCard);
    const unplayedCardWidth = await widthOf(unplayedCard);
    expect(Math.round(playedCardWidth)).toBe(Math.round(unplayedCardWidth));
    expect(playedCardWidth).toBeLessThan(RESERVE_MIN_CARD_BORDER_PX);

    // 1. The status container is still in the DOM on both rows — the switch is `display`.
    await expect(rowChildren(playedCard)).toHaveCount(5);
    await expect(rowChildren(unplayedCard)).toHaveCount(5);

    // 2. The played row's box is laid out at the `xs` reserve; the unplayed row's is not laid
    //    out at all (`display: none` has no box).
    const playedStatus = await boxOf(rowChildren(playedCard).nth(4));
    expect(Math.round(playedStatus.width)).toBe(RESERVED_WIDTH_XS);
    expect(playedStatus.height).toBeGreaterThan(0);
    expect(await rowChildren(unplayedCard).nth(4).boundingBox()).toBeNull();

    // 3. So the teams column reclaims the reserve AND the 10px flex gap that sat in front of
    //    it — the ISSUE-133 fix, now only here.
    const playedTeams = await widthOf(rowChildren(playedCard).nth(2));
    const unplayedTeams = await widthOf(rowChildren(unplayedCard).nth(2));
    expect(Math.round(unplayedTeams - playedTeams)).toBe(RESERVED_WIDTH_XS + ROW_GAP);
  });
});
