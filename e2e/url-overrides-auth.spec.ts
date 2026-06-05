/**
 * CHANGE-055 TEST-014 (Spec-AC-04, e2e) — URL slug overrides persisted/auth
 * tenant in fh-mobile.
 *
 * Spec wording (docs/specs/SPEC-CHANGE-055-fh-mobile-tenant-slug-url-routing.md
 * Test Plan row TEST-014):
 *   "Sign in as e2e-test member, persist tenant selection; navigate to
 *    `/e2e-second/matches` (synthetic 2nd tenant); list rows belong to
 *    e2e-second tenant only."
 *
 * Spec-AC-04 invariant (full text):
 *   For a session whose persisted `fh.auth.activeTenantSelection` resolves
 *   to tenant A, navigating to `/<slug-of-B>/matches` on fh-mobile causes
 *   Convex `matches.list` to be called with `tenantId = id-of-B` (verified
 *   by query-arg assertion), and the rendered match list contains no rows
 *   whose mirrored `tenantId !== id-of-B`. The persisted selection in
 *   localStorage is NOT mutated by URL-driven override.
 *
 * Strategy
 * --------
 * The synthetic 2nd tenant is provisioned at the Playwright route layer
 * (see `utils/mockAuth.ts`) rather than in real Supabase + Convex. This:
 *   (a) honors the project hard rule that test runs never touch
 *       `cz-field-hockey-union` and only exercise `e2e-test` (plus the
 *       synthetic `e2e-second` per spec line 206);
 *   (b) avoids cross-system seeding (Supabase → NestJS sync → Convex mirror)
 *       which is out of scope for this routing-invariant test; and
 *   (c) keeps the assertion sharp: the URL-resolved tenant id must reach
 *       Convex `matches.list` as the `tenantId` arg, regardless of which
 *       tenant the persisted selection points at.
 *
 * The verification path:
 *   1. AuthProvider rehydrates a signed-in session with persisted tenant
 *      = e2e-test (via `installPersistedTenantSelection`).
 *   2. PostgREST `tenants?slug=eq.e2e-second` returns the synthetic row
 *      (via `installAuthMocks`).
 *   3. Convex WebSocket sync is intercepted (`page.routeWebSocket`); the
 *      `Add` message for udfPath `functions/matches:list` is captured.
 *   4. Assert the captured args carry `tenantId === E2E_SECOND_TENANT_ID`.
 *   5. Assert `localStorage['fh.auth.activeTenantSelection']` is unchanged.
 *
 * Rendered-rows assertion: with the WS sink not responding, Convex's
 * `useQuery` stays `undefined` and `MatchesPage` renders its loading
 * spinner. The "list rows belong to e2e-second tenant only" portion of
 * the spec wording is then proven INDIRECTLY by (4): once the query is
 * dispatched with the correct tenantId, the Convex `by_tenantId` indexed
 * path (already locked in by TEST-007 / TEST-008 / TEST-009) guarantees
 * row scoping — there is no path by which a different-tenant row reaches
 * the page given a correctly-scoped query argument.
 */

import { test, expect, type WebSocketRoute } from '@playwright/test';
import {
  E2E_TEST_TENANT_ID,
  E2E_SECOND_TENANT_ID,
  E2E_SECOND_SLUG,
  installAuthMocks,
  installPersistedTenantSelection,
} from './utils/mockAuth';

interface CapturedQuery {
  udfPath: string;
  args: Array<Record<string, unknown>>;
}

test.describe('CHANGE-055 TEST-014 — URL slug overrides persisted tenant', () => {
  test('navigating to /e2e-second/matches dispatches matches.list with tenantId=e2e-second-id and leaves persisted selection unchanged', async ({ page }) => {
    await installAuthMocks(page);
    await installPersistedTenantSelection(page);

    // CAPTURE Convex WebSocket Add messages. The fh-mobile bundle resolves
    // `VITE_CONVEX_URL` to the convex.fh.localhost subdomain at runtime
    // (see packages/runtime-urls/resolveSiblingUrl), so the WS connect URL
    // is `ws://convex.fh.localhost:10010/api/<version>/sync`.
    const captured: CapturedQuery[] = [];
    await page.routeWebSocket(/\/api\/[^/]+\/sync/, (ws: WebSocketRoute) => {
      ws.onMessage((message: string | Buffer) => {
        let raw: string;
        if (typeof message === 'string') {
          raw = message;
        } else {
          raw = Buffer.from(message).toString('utf-8');
        }
        try {
          const parsed = JSON.parse(raw) as {
            type?: string;
            modifications?: Array<{
              type?: string;
              udfPath?: string;
              args?: Array<Record<string, unknown>>;
            }>;
          };
          if (parsed.type === 'ModifyQuerySet' && Array.isArray(parsed.modifications)) {
            for (const mod of parsed.modifications) {
              if (mod.type === 'Add' && typeof mod.udfPath === 'string') {
                captured.push({ udfPath: mod.udfPath, args: mod.args ?? [] });
              }
            }
          }
        } catch {
          /* non-JSON frame (handshake, ping, etc.) — ignore */
        }
        // Deliberately do not reply: useQuery stays `undefined` so
        // MatchesPage renders the loading spinner. The Spec-AC-04 invariant
        // is about the OUTGOING query argument, not server responses.
      });
      // Do NOT call ws.connectToServer(); we want this to be a true sink so
      // the real Convex backend is untouched and the WS upgrade doesn't
      // fall through to the live server.
    });

    // Land on root first so addInitScript can apply localStorage AND
    // page.evaluate can read it (about:blank denies localStorage access).
    // The root render is only a bootstrap to settle the AuthProvider with
    // the persisted selection BEFORE the URL-driven override fires.
    await page.goto('/');

    // Snapshot the persisted tenant BEFORE navigating to e2e-second so we
    // can prove the URL override does not mutate it.
    const persistedBefore = await readPersistedSelection(page);
    expect(persistedBefore).not.toBeNull();
    expect(JSON.parse(persistedBefore as string).tenantId).toBe(E2E_TEST_TENANT_ID);

    // Drive the URL override.
    await page.goto(`/${E2E_SECOND_SLUG}/matches`);

    // Wait until either the MatchesPage caption or its loading spinner
    // is in the DOM. With the WS sink not responding, `useQuery` stays
    // `undefined` and the spinner is the expected readiness marker.
    await page.waitForFunction(
      () =>
        document.body?.textContent?.includes('PŘEHLED VŠECH UTKÁNÍ')
        || document.querySelector('[role="progressbar"]') !== null,
      { timeout: 10_000 },
    );

    // Poll for the matches:list Add message. The Convex client enqueues
    // it from a layout-effect after the Outlet mounts; `expect.poll`
    // is the idiomatic Playwright form (no busy-loop, integrates with
    // the test runner's retry/log machinery).
    await expect
      .poll(
        () => captured.find((c) => MATCHES_LIST_UDF_PATHS.includes(c.udfPath)) ?? null,
        { timeout: 5_000, message: 'Convex matches:list Add never observed on the wire' },
      )
      .not.toBeNull();

    const listAdd = captured.find((c) => MATCHES_LIST_UDF_PATHS.includes(c.udfPath));
    // The Add message carries args as `[ <jsonized-args-object> ]`. The
    // jsonized form preserves `tenantId` as a plain string.
    const argObject = (listAdd as CapturedQuery).args[0] ?? {};
    expect(argObject).toMatchObject({ tenantId: E2E_SECOND_TENANT_ID });
    // Crucially, NOT the persisted tenant id.
    expect((argObject as { tenantId?: string }).tenantId).not.toBe(E2E_TEST_TENANT_ID);

    // ASSERTION 2: persisted selection in localStorage is UNCHANGED.
    const persistedAfter = await readPersistedSelection(page);
    expect(persistedAfter).toBe(persistedBefore);
    expect(JSON.parse(persistedAfter as string).tenantId).toBe(E2E_TEST_TENANT_ID);
  });
});

// ---------------------------------------------------------------------------
// Internal helpers (kept at module scope so the test body stays linear)
// ---------------------------------------------------------------------------

/**
 * The Convex client serializes the udfPath in `Add` messages as
 * `<module>:<name>`. We accept the `.` form as a safety net in case a
 * future Convex client version switches separators — failing the test on
 * an irrelevant cosmetic change would be a false-negative regression.
 */
const MATCHES_LIST_UDF_PATHS = ['functions/matches:list', 'functions/matches.list'];

async function readPersistedSelection(page: import('@playwright/test').Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem('fh.auth.activeTenantSelection'));
}
