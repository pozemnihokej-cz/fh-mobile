/**
 * PRD-034 Spec-AC-14 — anon-boundary POST-SIGNIN seam (Remediation of
 * VAL-PRD-034-fe-20260728T184631Z §3).
 *
 * The pre-existing TEST-012 (`anon-client.int.test.ts`) only covered the
 * PRE-sign-in state ("no session → anon key"). Sign-in became reachable for
 * the first time in this PRD (AuthForm), which opened a real seam: supabase-js
 * v2 auto-switches `.from()` reads from the anon key to the session's
 * `access_token` once ANY session exists on that client. A fan is a
 * tenant-less `authenticated` principal that live RLS (00049) denies, so a fan
 * JWT on a public read → 0 rows → blank browse screens.
 *
 * Decision under test (`PRD-034-slice2-fan-reference-read-model-RESOLVED`):
 * the fan JWT reaches Convex ONLY, never PostgREST. The fix decouples the two
 * clients — `supabase` (public browse) is anon-pinned via the supabase-js
 * `accessToken` override, `authSupabase` (session) owns sign-in.
 *
 * This test crosses the seam: it establishes a REAL session on the auth client
 * (`authSupabase.auth.signInWithPassword`), then performs a public reference
 * read on the browse client (`supabase.from('clubs')`) and asserts the read
 * STILL carries the anon key — never the fan JWT.
 *
 * No supabase module mocks: this exercises the live wiring of `supabase.ts` ↔
 * the real `@supabase/supabase-js`. The only stubbed I/O is the network layer
 * (fetch) — the GoTrue token endpoint returns a fake session, PostgREST reads
 * return an empty array.
 *
 * RED→GREEN: with the pre-fix single shared client (`authSupabase === supabase`,
 * no accessToken override) this fails — the clubs read carries `Bearer
 * FAN.JWT...`. With the fix it passes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabase, authSupabase } from '../supabase';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Recognisable fake fan JWT the stubbed GoTrue token endpoint hands back. A
// three-segment shape so supabase-js treats it as a normal access_token.
const FAN_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FAN_PAYLOAD_PLACEHOLDER.FAN_SIGNATURE';

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

    // GoTrue password-grant endpoint → return a fake fan session.
    if (url.includes('/auth/v1/token')) {
      const user = {
        id: '00000000-0000-0000-0000-00000000fa77',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'fan@example.com',
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      };
      return new Response(
        JSON.stringify({
          access_token: FAN_JWT,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'fake-refresh-token',
          user,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Any other GoTrue call (e.g. user fetch) → minimal 200.
    if (url.includes('/auth/v1/')) {
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // PostgREST reads → empty list; we only care about outbound headers.
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(async () => {
  // Clear the persisted fan session so it cannot bleed into other tests.
  try {
    await authSupabase.auth.signOut();
  } catch {
    // signOut may be disabled/irrelevant on some client shapes — ignore.
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('anon-boundary post-signin (PRD-034 Spec-AC-14 seam)', () => {
  it('after a fan signs in on the auth client, a public browse read still carries the anon key, not the fan JWT', async () => {
    expect(ANON_KEY).toBeTruthy();
    expect(ANON_KEY!.length).toBeGreaterThan(20);

    // 1. Sign in on the AUTH/session client — this is what AuthForm.signIn
    //    drives. A real session is now established on `authSupabase`.
    const { error } = await authSupabase.auth.signInWithPassword({
      email: 'fan@example.com',
      password: 'irrelevant-password',
    });
    expect(error).toBeNull();

    // 2. Prove we actually crossed the seam: the fan session IS present on the
    //    auth client (the exact precondition that leaked the JWT pre-fix).
    const { data: sessionData } = await authSupabase.auth.getSession();
    expect(sessionData.session?.access_token).toBe(FAN_JWT);

    // 3. Now perform a PUBLIC browse read on the BROWSE client — the same
    //    `supabase` singleton every fan-facing screen (ClubDetailPage,
    //    StandingsPage, …) imports.
    captured = [];
    await supabase.from('clubs').select('*');

    const clubHits = captured.filter((c) => c.url.includes('/rest/v1/clubs'));
    expect(clubHits.length).toBeGreaterThanOrEqual(1);

    // 4. The invariant: every public read carries the anon key, NEVER the fan
    //    JWT. Pre-fix (shared client) these were `Bearer FAN.JWT…` → RLS 0 rows.
    const expectedHeader = `Bearer ${ANON_KEY}`;
    for (const hit of clubHits) {
      expect(hit.authorization).toBe(expectedHeader);
      expect(hit.authorization).not.toBe(`Bearer ${FAN_JWT}`);
      expect(hit.apikey).toBe(ANON_KEY);
    }

    // Defence-in-depth: NO captured PostgREST request may carry the fan JWT.
    for (const hit of captured) {
      if (!hit.url.includes('/rest/v1/')) continue;
      expect(hit.authorization).not.toBe(`Bearer ${FAN_JWT}`);
    }
  });
});
