import { createAppSupabaseClient } from '@fh/supabase-client';

// TECHDEBT-032 item 1: shared Supabase client factory (was copy-pasted across
// the 3 apps). ANON_KEY only. import.meta.env access stays literal (Vite
// per-module injection — docs/knowledge/LEARNED.md 2026-05-07).
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const localFallback = 'http://localhost:3004';

// PRD-034 anon boundary: the fan app has TWO Supabase clients that MUST stay
// decoupled, because a signed-in fan is a tenant-LESS `authenticated`
// principal that live RLS (00049_full_tenant_scoping) denies. If a fan's JWT
// ever reaches a public PostgREST read, RLS returns 0 rows and the browse
// screens go blank (decision PRD-034-slice2-fan-reference-read-model-RESOLVED:
// the fan JWT is used ONLY for Convex, never PostgREST).
//
// `supabase` — PUBLIC BROWSE / reference-read client. Anon-only, structurally.
// The supabase-js v2 `accessToken` override pins every `.from()` read to the
// anon key and disables `.auth.*` on this instance, so no session on the auth
// client below can leak a JWT onto these reads. All public-browse screens
// (clubs, standings, schedule, search, player, lineup, tenant layout/picker)
// import THIS client.
export const supabase = createAppSupabaseClient({
  envUrl,
  envAnonKey,
  localFallback,
  accessToken: async () => envAnonKey ?? '',
});

// `authSupabase` — SESSION / auth client for `@fh/auth`'s AuthProvider ONLY.
// Owns GoTrue sign-in/up, session persistence + refresh, and exposes the fan's
// access_token (surfaced as `useAuth().token`) which is forwarded to Convex
// fan-preference actions. Its own `.from()` reads (AuthProvider profile /
// membership enrichment) DO carry the fan JWT, but those are correctly
// tenant-scoped and simply resolve empty for a tenant-less fan — no public
// browse read uses this client. NEVER import this for reference/browse reads.
export const authSupabase = createAppSupabaseClient({
  envUrl,
  envAnonKey,
  localFallback,
});
