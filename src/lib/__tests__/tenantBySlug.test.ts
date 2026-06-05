/**
 * CHANGE-055 TEST-004 (Spec-AC-10)
 *
 * `resolveTenantBySlug` memoizes per slug for the SPA session: two calls
 * with the same slug trigger exactly ONE underlying PostgREST select;
 * subsequent calls return the cached tuple. Negative results MUST NOT be
 * cached (so a transient create race does not poison navigation).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTenantBySlug, __resetTenantBySlugCache } from '../tenantBySlug';

function makeMockSupabase(rows: Array<{ id: string; slug: string; name: string }> | null) {
  const maybeSingle = vi.fn(async () =>
    rows && rows.length > 0 ? { data: rows[0], error: null } : { data: null, error: null },
  );
  const eq = vi.fn(() => builder);
  const select = vi.fn(() => builder);
  const from = vi.fn(() => builder);
  const builder = { select, eq, maybeSingle } as unknown as Record<string, unknown>;
  return { client: { from }, spies: { from, select, eq, maybeSingle } };
}

beforeEach(() => {
  __resetTenantBySlugCache();
});

describe('resolveTenantBySlug (TEST-004)', () => {
  it('hits the underlying PostgREST select exactly once for repeated lookups of the same slug', async () => {
    const { client, spies } = makeMockSupabase([
      { id: 'TID-1', slug: 'e2e-test', name: 'E2E Test' },
    ]);

    const first = await resolveTenantBySlug(client as never, 'e2e-test');
    const second = await resolveTenantBySlug(client as never, 'e2e-test');
    const third = await resolveTenantBySlug(client as never, 'e2e-test');

    expect(first).toEqual({ id: 'TID-1', slug: 'e2e-test', name: 'E2E Test' });
    expect(second).toBe(first);
    expect(third).toBe(first);

    // Spies on the builder chain — the database read terminus is `maybeSingle`.
    expect(spies.maybeSingle).toHaveBeenCalledTimes(1);
    expect(spies.from).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache a null result (slug not found can be re-tried)', async () => {
    const { client, spies } = makeMockSupabase(null);

    const first = await resolveTenantBySlug(client as never, 'unknown');
    const second = await resolveTenantBySlug(client as never, 'unknown');

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(spies.maybeSingle).toHaveBeenCalledTimes(2);
  });
});
