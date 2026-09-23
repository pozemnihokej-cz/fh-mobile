import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * CHANGE-055 Spec-AC-02 / Spec-AC-10: slug → tenant resolver with caching.
 *
 * Reads `public.tenants` via PostgREST projecting ONLY (id, slug, name)
 * filtered by `is_active = true` AND `slug = <slug>`. The column-level GRANT
 * + RLS USING clause from migration 00132_anon_select_tenants.sql constrains
 * the read at the database layer; the explicit projection here makes the
 * intent legible at the call site.
 *
 * Memoization (Spec-AC-10): a module-level Map keyed by slug holds the
 * resolved tuple for the lifetime of the SPA session. Route transitions
 * within the same tenant therefore issue ZERO PostgREST calls.
 *
 * Negative results (slug not found) are NOT cached so a transient
 * race-on-creation does not poison subsequent navigation. Errors propagate
 * as `null` — the layout consumer renders NotFoundPage either way.
 */
export interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
}

const cache = new Map<string, ResolvedTenant>();
const cacheById = new Map<string, ResolvedTenant>();

/** Test-only: clear the in-memory cache. Production code does not call this. */
export function __resetTenantBySlugCache(): void {
  cache.clear();
  cacheById.clear();
}

export async function resolveTenantBySlug(
  supabase: Pick<SupabaseClient, 'from'>,
  slug: string,
): Promise<ResolvedTenant | null> {
  if (!slug) return null;
  const cached = cache.get(slug);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('tenants')
    .select('id,slug,name')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  const resolved: ResolvedTenant = {
    id: String((data as { id: unknown }).id),
    slug: String((data as { slug: unknown }).slug),
    name: String((data as { name: unknown }).name),
  };
  cache.set(slug, resolved);
  cacheById.set(resolved.id, resolved);
  return resolved;
}

export async function resolveTenantById(
  supabase: Pick<SupabaseClient, 'from'>,
  id: string,
): Promise<ResolvedTenant | null> {
  if (!id) return null;
  const cached = cacheById.get(id);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('tenants')
    .select('id,slug,name')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;

  const resolved: ResolvedTenant = {
    id: String((data as { id: unknown }).id),
    slug: String((data as { slug: unknown }).slug),
    name: String((data as { name: unknown }).name),
  };
  cache.set(resolved.slug, resolved);
  cacheById.set(id, resolved);
  return resolved;
}

