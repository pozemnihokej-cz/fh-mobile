/**
 * CHANGE-055 TEST-012 (Spec-AC-11)
 *
 * Anonymous Supabase client wiring: on a public-route render with no user
 * session, the outbound PostgREST request carries `Authorization: Bearer
 * ${VITE_SUPABASE_ANON_KEY}` — not a user JWT. The supabase-js client built
 * by `apps/fh-mobile/src/lib/supabase.ts` is reused without any session
 * token attached when no user is signed in.
 *
 * Strategy
 * --------
 * 1. Wire VITE_SUPABASE_ANON_KEY into vitest at config time (vitest.config.ts
 *    envDir points to the workspace root so the existing .env populates
 *    `import.meta.env.VITE_SUPABASE_ANON_KEY`).
 * 2. Spy on `globalThis.fetch` and let the real supabase-js client construct
 *    a PostgREST request. The spy resolves with an empty array so the page
 *    render settles cleanly without surfacing follow-up errors.
 * 3. Assert: at least one captured request hits `/rest/v1/tenants?...` AND
 *    its Authorization header equals `Bearer ${VITE_SUPABASE_ANON_KEY}`.
 *    Assert no captured request carries an "eyJ"-prefixed user JWT distinct
 *    from the anon key (defence-in-depth).
 *
 * Integration scope: this exercises the live wiring of `supabase.ts` ↔
 * supabase-js ↔ TenantPickerPage. No supabase module mocks. The only
 * stubbed I/O is the network layer (fetch).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import TenantPickerPage from '../../routes/TenantPickerPage';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

interface CapturedRequest {
  url: string;
  authorization: string | null;
  apikey: string | null;
}

let fetchSpy: ReturnType<typeof vi.fn>;
let captured: CapturedRequest[];

beforeEach(() => {
  captured = [];
  fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    captured.push({
      url,
      authorization: headers.get('authorization') ?? headers.get('Authorization'),
      apikey: headers.get('apikey') ?? headers.get('apiKey'),
    });
    // Empty list — picker settles into the "no tenants" branch which is fine
    // for this test (we only care about the OUTBOUND headers, not rendered
    // rows). Status 200 + JSON body satisfies PostgREST contract.
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('anon-client.int (TEST-012)', () => {
  it('wires VITE_SUPABASE_ANON_KEY into supabase.ts at test time', () => {
    // Sanity guard: if this fails, env wiring (vitest envDir) is broken and
    // every other assertion below would be vacuous. We assert non-empty
    // rather than equality against a hardcoded literal so an env rotation
    // does not silently break the test.
    expect(ANON_KEY).toBeTruthy();
    expect(ANON_KEY!.length).toBeGreaterThan(20);
  });

  it('outbound PostgREST /rest/v1/tenants request carries Authorization: Bearer <anon-key> and no user JWT', async () => {
    render(createElement(TenantPickerPage));

    // The picker's useEffect dispatches the fetch. Wait until at least one
    // request to /rest/v1/tenants is observed.
    await waitFor(
      () => {
        const tenantHits = captured.filter((c) => c.url.includes('/rest/v1/tenants'));
        expect(tenantHits.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 },
    );

    const tenantHits = captured.filter((c) => c.url.includes('/rest/v1/tenants'));
    expect(tenantHits.length).toBeGreaterThanOrEqual(1);

    const expectedHeader = `Bearer ${ANON_KEY}`;
    for (const hit of tenantHits) {
      // Authorization header MUST be the anon key.
      expect(hit.authorization).toBe(expectedHeader);
      // apikey header (PostgREST contract) MUST also be the anon key.
      expect(hit.apikey).toBe(ANON_KEY);
    }

    // Defence-in-depth: scan every captured request for a non-anon Bearer
    // token. If the supabase-js client somehow attached a session JWT
    // (which would indicate a regression), the Authorization would parse
    // a JWT with a payload distinct from `role: anon`. We sniff the role
    // claim by base64-decoding the JWT payload segment.
    for (const hit of captured) {
      if (!hit.authorization) continue;
      const bearer = hit.authorization.replace(/^Bearer\s+/i, '');
      // Each captured Authorization must match the anon key byte-for-byte
      // (the test stubs a no-session render path, so there is no other
      // legitimate token shape that should appear).
      expect(bearer).toBe(ANON_KEY);
    }
  });
});
