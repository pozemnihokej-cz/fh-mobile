import { createAppSupabaseClient } from '@fh/supabase-client';

// TECHDEBT-032 item 1: shared Supabase client factory (was copy-pasted across
// the 3 apps). ANON_KEY only. import.meta.env access stays literal (Vite
// per-module injection — docs/knowledge/LEARNED.md 2026-05-07).
export const supabase = createAppSupabaseClient({
  envUrl: import.meta.env.VITE_SUPABASE_URL,
  envAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  localFallback: 'http://localhost:3004',
});
