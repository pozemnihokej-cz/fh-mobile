/**
 * spec-fan-match-external-id-redirect TEST-013 (Spec-AC-03, Spec-AC-06; e2e).
 *
 * Live anonymous browser run against the RUNNING local stack (no WS sink,
 * no PostgREST mocking — the point of this row is to prove the real
 * round-trip through the real Convex deployment this ride just pushed).
 * `e2e-test` tenant ONLY (project hard rule); `cz-field-hockey-union` is
 * never touched by any assertion fixture here.
 *
 * Fixture (real, measured — MF-02): externalId '23111' exists in BOTH
 * `cz-field-hockey-union` (an archival 2021 match outside the Convex
 * mirror window, MF-09 — resolves to not-found there) and `e2e-test`
 * (supabaseId `00000000-0000-0000-0000-e2e023111001`). This spec asserts
 * the `e2e-test` side resolves to its OWN match and never to the archival
 * `cz-field-hockey-union` row (`36e0ed9c-9488-41cb-ad21-965d4e9f4cc1`).
 *
 * "cz-field-hockey-union is never requested" is checked at the PostgREST
 * layer ONLY — requests whose URL contains `/rest/v1/` — never over the
 * whole `page.on('request')` stream. Measured 2026-10-03 (remediation):
 * `TenantLayout.resolveTenantBySlug` issues
 * `GET /rest/v1/tenants?...&slug=eq.<slug>`, and every subsequent read for
 * the resolved tenant filters by that same id/slug in the query string
 * (e.g. `/rest/v1/match_players?...`) — `/rest/v1/` is the one HTTP surface
 * in this flow that can carry a tenant-identifying string as literal
 * request-URL text. The Convex call
 * (`resolveExternalIdToSupabaseId{tenantId, externalId}`) is carried over
 * the client's WebSocket sync connection — confirmed by instrumenting this
 * exact run: zero convex-host entries ever appear in `page.on('request')`,
 * so a per-query arg there is structurally invisible to a request-URL scan
 * and was never actually being checked by the old blanket loop either.
 * Its cross-tenant isolation is proven at the unit level by
 * `convex/functions/__tests__/matches.resolveExternalId.test.ts`
 * (TEST-006/007/008, direct `_handler` invocation) and was independently
 * confirmed live via an anonymous `curl` probe against the deployed
 * function during this same ride (see hand-off evidence) — this e2e row's
 * job is the real BROWSER round-trip, not re-proving the backend logic.
 *
 * The prior version of this assertion scanned EVERY request the page made,
 * which trips on Vite's own dev-only module graph: the federation-profile
 * config module is served at a path that literally embeds a tenant slug in
 * its own filename (`@fs/.../federation-profiles/cz-field-hockey-union.ts`),
 * carrying zero runtime tenant data. That is a false positive, not a leak,
 * and is excluded by the `/rest/v1/` scoping below rather than by
 * special-casing the dev server.
 */
import { test, expect } from '@playwright/test';

const E2E_TEST_SLUG = 'e2e-test';
const EXTERNAL_ID = '23111';
const EXPECTED_SUPABASE_ID = '00000000-0000-0000-0000-e2e023111001';
const ARCHIVAL_CZ_UNION_MATCH_ID = '36e0ed9c-9488-41cb-ad21-965d4e9f4cc1';
const CZ_UNION_SLUG = 'cz-field-hockey-union';
const CZ_UNION_TENANT_ID = '00000000-0000-4000-8000-000000000001';

test.describe('spec-fan-match-external-id-redirect TEST-013 — live external-id deeplink', () => {
  test('/e2e-test/matches/external/23111 ends on the e2e-test canonical UUID, never the archival cz-field-hockey-union match', async ({ page }) => {
    const requestedUrls: string[] = [];
    page.on('request', (req) => requestedUrls.push(req.url()));

    await page.goto(`/${E2E_TEST_SLUG}/matches/external/${EXTERNAL_ID}`);

    await expect(page).toHaveURL(new RegExp(EXPECTED_SUPABASE_ID), { timeout: 15_000 });
    expect(page.url()).not.toContain(ARCHIVAL_CZ_UNION_MATCH_ID);
    // Spec-AC-04: the resolver itself must not remain in history either.
    expect(page.url()).not.toContain('/external/');

    // The detail surface rendered: MatchDetailPage's back affordance mounts
    // unconditionally once routed here, independent of the match data's own
    // load state.
    await expect(page.getByTestId('match-detail-back')).toBeVisible({ timeout: 15_000 });

    // Scoped to the one HTTP surface that can actually carry a
    // tenant-identifying string in a request URL (see file header). The
    // sanity check guards against the scoping itself going silently vacuous
    // (e.g. a future refactor renaming the REST path) — this flow is known
    // to issue at least the tenant lookup, so an empty result here is a
    // defect in the assertion, not a passing isolation proof.
    const postgrestRequests = requestedUrls.filter((url) => url.includes('/rest/v1/'));
    expect(postgrestRequests.length).toBeGreaterThan(0);
    for (const url of postgrestRequests) {
      expect(url).not.toContain(CZ_UNION_SLUG);
      expect(url).not.toContain(CZ_UNION_TENANT_ID);
    }
  });
});
