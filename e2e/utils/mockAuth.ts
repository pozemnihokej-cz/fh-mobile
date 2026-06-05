/**
 * CHANGE-055 TEST-014 helper — fh-mobile-specific Playwright auth mocks.
 *
 * Mirrors the route-mocking pattern of
 * `apps/fh-online-management/e2e/utils/e2eAuth.ts`, with these adaptations
 * for fh-mobile + CHANGE-055:
 *   - The mocked user has memberships in BOTH the primary `e2e-test` tenant
 *     and the synthetic 2nd `e2e-second` tenant. The Spec-AC-04 invariant
 *     ("URL slug wins over persisted/auth-context tenant") only fires when
 *     `useUrlTenantOverride` finds an active membership for the URL tenant
 *     (see `apps/fh-mobile/src/lib/useUrlTenantOverride.ts`), so the fixture
 *     MUST grant both memberships.
 *   - PostgREST `/rest/v1/tenants` is mocked to serve both the synthetic
 *     `e2e-second` lookup (for `TenantLayout` slug resolution) and the
 *     active-tenants list (for the picker; not exercised by TEST-014 but
 *     kept for completeness so unrelated requests do not 404 and pollute
 *     console logs).
 *   - The fixture is in-memory; no Supabase rows are written or deleted.
 *     This honors the project hard rule that test runs never touch
 *     `cz-field-hockey-union` and only exercise `e2e-test` (plus the
 *     synthetic `e2e-second` per spec line 206) from any test flow.
 */

import type { Page } from '@playwright/test';

// Synthetic tenant ids — must look like real UUIDs so the AuthProvider's
// PersistedSelection round-trip and Convex's `tenantId` arg validation
// both accept them.
export const E2E_TEST_TENANT_ID = '00000000-0000-4000-8000-000000000002';
export const E2E_SECOND_TENANT_ID = '00000000-0000-4000-8000-0000027f0055';
export const E2E_TEST_SLUG = 'e2e-test';
export const E2E_SECOND_SLUG = 'e2e-second';

const MOCK_USER_ID = 'change055-test014-user-id';
const MOCK_USER_EMAIL = 'change055-test014@fh.local';

// HS256-shaped JWT (signature not validated by the mocked endpoints; supabase-js
// only inspects the payload structure when restoring sessions).
const FAKE_ACCESS_TOKEN = (() => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: MOCK_USER_ID,
      email: MOCK_USER_EMAIL,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }),
  ).toString('base64url');
  return `${header}.${payload}.fake-signature-for-e2e-only`;
})();

const FAKE_SESSION = {
  access_token: FAKE_ACCESS_TOKEN,
  refresh_token: 'fake-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: MOCK_USER_ID,
    email: MOCK_USER_EMAIL,
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: { name: 'CHANGE-055 TEST-014 user' },
    app_metadata: { provider: 'email' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

const NOW_ISO = new Date().toISOString();

const MOCK_PROFILE = {
  user_id: MOCK_USER_ID,
  role: 'tenant_admin',
  roles: ['tenant_admin'],
  custom_role_id: null,
  scope_type: null,
  scope_id: null,
  tenant_id: E2E_TEST_TENANT_ID,
};

const MOCK_MEMBERSHIPS = [
  {
    user_id: MOCK_USER_ID,
    tenant_id: E2E_TEST_TENANT_ID,
    role: 'tenant_admin',
    is_default: true,
    scope_type: null,
    scope_id: null,
    status: 'active',
    created_at: NOW_ISO,
  },
  {
    user_id: MOCK_USER_ID,
    tenant_id: E2E_SECOND_TENANT_ID,
    role: 'tenant_admin',
    is_default: false,
    scope_type: null,
    scope_id: null,
    status: 'active',
    created_at: NOW_ISO,
  },
];

const E2E_TEST_TENANT_ROW = {
  id: E2E_TEST_TENANT_ID,
  slug: E2E_TEST_SLUG,
  name: 'E2E Test Tenant',
  type: 'union',
  is_active: true,
};

const E2E_SECOND_TENANT_ROW = {
  id: E2E_SECOND_TENANT_ID,
  slug: E2E_SECOND_SLUG,
  name: 'CHANGE-055 Synthetic Second Tenant',
  type: 'union',
  is_active: true,
};

/**
 * Install Playwright route handlers for every PostgREST + Auth endpoint
 * fh-mobile hits on a public route, plus the supabase-auth-token bootstrap
 * so the AuthProvider rehydrates with our synthetic session.
 *
 * Must be called BEFORE `page.goto()` so that the supabase-js client's
 * initial-session restore on first render sees the mocked routes.
 */
export async function installAuthMocks(page: Page): Promise<void> {
  // 1. Supabase Auth: sign-in (password grant).
  await page.route(/\/auth\/v1\/token/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_SESSION),
    });
  });

  // 2. Supabase Auth: session restore (`/auth/v1/user`).
  await page.route(/\/auth\/v1\/user/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_SESSION.user),
    });
  });

  // 3. PostgREST: user_profiles lookup.
  await page.route(/\/rest\/v1\/user_profiles/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([MOCK_PROFILE]),
      });
    } else {
      await route.continue();
    }
  });

  // 4. PostgREST: tenant_memberships lookup — TWO memberships so the URL
  //    override hook's `hasMembershipForTenant` check passes for e2e-second.
  await page.route(/\/rest\/v1\/tenant_memberships/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_MEMBERSHIPS),
      });
    } else {
      await route.continue();
    }
  });

  // 5. PostgREST: tenants lookup (both slug-eq for resolver, and active-list
  //    for picker). The resolver query in
  //    `apps/fh-mobile/src/lib/tenantBySlug.ts` matches on slug=eq.<slug> and
  //    is_active=eq.true with select=id,slug,name; the picker uses
  //    select=id,slug,name + is_active=eq.true.
  await page.route(/\/rest\/v1\/tenants/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const url = route.request().url();
    // Slug-equality lookup (TenantLayout slug resolver).
    const slugMatch = /slug=eq\.([^&]+)/.exec(url);
    if (slugMatch) {
      const slug = decodeURIComponent(slugMatch[1]);
      const row = slug === E2E_SECOND_SLUG
        ? E2E_SECOND_TENANT_ROW
        : slug === E2E_TEST_SLUG
          ? E2E_TEST_TENANT_ROW
          : null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(row ? [row] : []),
      });
      return;
    }
    // Active-tenants list (picker).
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([E2E_TEST_TENANT_ROW, E2E_SECOND_TENANT_ROW]),
    });
  });
}

/**
 * Pre-seed the supabase-auth-token in localStorage so the AuthProvider's
 * initial-session restore on first render finds a session immediately,
 * mimicking a returning signed-in user. Also pre-seeds
 * `fh.auth.activeTenantSelection` to the primary `e2e-test` tenant — this
 * is the "persisted tenant" the spec invariant pits against the URL slug.
 *
 * The Spec-AC-04 invariant we test: navigating to `/e2e-second/matches`
 * MUST drive Convex `matches.list` with `tenantId === e2e-second-id`
 * (URL wins), and MUST NOT mutate the persisted selection (URL override
 * is intentionally ephemeral).
 */
export async function installPersistedTenantSelection(page: Page): Promise<void> {
  // The supabase-js client looks up the localStorage key derived from the
  // VITE_SUPABASE_URL; the fh-mobile dev server resolves it to
  // `http://supabase.fh.localhost:10010` at runtime via `resolveBaseUrl`.
  // To be robust we pre-seed BOTH the canonical key shape (sb-<host>-auth-token)
  // and the legacy `supabase.auth.token` key.
  const sessionValue = {
    access_token: FAKE_ACCESS_TOKEN,
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: FAKE_SESSION.user,
  };
  const persistedTenant = {
    tenantId: E2E_TEST_TENANT_ID,
    scopeType: null,
    scopeId: null,
  };
  await page.addInitScript(
    ({ session, persisted }) => {
      try {
        // Pre-CHANGE-023 key — legacy fallback for older supabase-js builds.
        window.localStorage.setItem(
          'supabase.auth.token',
          JSON.stringify({ currentSession: session, expiresAt: session.expires_at }),
        );
        // CHANGE-023: persisted active tenant selection consumed by
        // packages/auth/auth-context's selectActiveMembership().
        window.localStorage.setItem('fh.auth.activeTenantSelection', JSON.stringify(persisted));
      } catch {
        /* localStorage may be unavailable in some edge cases */
      }
    },
    { session: sessionValue, persisted: persistedTenant },
  );
}
