/**
 * CHANGE-055 TEST-005 (Spec-AC-04, Spec-AC-09)
 *
 * Unit test for the fh-mobile-local `useUrlTenantOverride(resolvedTenantId)`
 * hook. Contract:
 *
 *   - When the URL-resolved tenant differs from the user's currently-active
 *     tenant AND the user has a membership for the URL tenant, the hook
 *     invokes `switchTenant(resolvedTenantId)` EXACTLY ONCE on mount /
 *     dependency change.
 *   - It does NOT mutate `localStorage` directly — the URL is the source of
 *     truth, persisted selection (managed by `packages/auth`) stays intact.
 *     Spec-AC-04 explicitly forbids URL-driven mutation of the persisted
 *     `fh.auth.activeTenantSelection` key.
 *   - It is a no-op when the user is anonymous, when the URL tenant already
 *     matches the active tenant, when the user has no membership for the
 *     URL tenant id, and when `resolvedTenantId` is `null`.
 *   - Re-rendering with the same `resolvedTenantId` does not call
 *     `switchTenant` again (idempotent per slug).
 *
 * Spec-AC-09 binds the hook to fh-mobile: the override logic must NOT live
 * in `packages/auth/src/auth-context.tsx`. This test consumes the existing
 * `@fh/auth` `useAuth()` contract (`user`, `switchTenant`) unmodified.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useUrlTenantOverride } from '../useUrlTenantOverride';

// ── @fh/auth mock ─────────────────────────────────────────────────────────
//
// The hook only depends on `useAuth()`; mocking the module is cheaper and
// safer than constructing an AuthProvider that drags a real Supabase client
// into the test environment.

const switchTenant = vi.fn();
let mockAuthValue: {
  user: null | {
    id: string;
    tenantId: string | undefined;
    allMemberships: Array<{ tenant_id: string }>;
  };
  switchTenant: typeof switchTenant;
} = { user: null, switchTenant };

vi.mock('@fh/auth', () => ({
  useAuth: () => mockAuthValue,
}));

// ── localStorage stub ─────────────────────────────────────────────────────
//
// jsdom provides a working `localStorage`, but we need to seed it with a
// value BEFORE the hook runs so we can assert it is preserved verbatim
// (Spec-AC-04: persisted selection is NOT mutated by URL-driven override).

const PERSISTED_KEY = 'fh.auth.activeTenantSelection';
const PERSISTED_VALUE_JSON = JSON.stringify({
  tenantId: 'TENANT-A',
  scopeType: null,
  scopeId: null,
});

beforeEach(() => {
  switchTenant.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem(PERSISTED_KEY, PERSISTED_VALUE_JSON);
  mockAuthValue = { user: null, switchTenant };
});

// ── Helpers ───────────────────────────────────────────────────────────────

function setAuthUser(tenantId: string, memberTenantIds: string[]) {
  mockAuthValue = {
    user: {
      id: 'user-1',
      tenantId,
      allMemberships: memberTenantIds.map((tid) => ({ tenant_id: tid })),
    },
    switchTenant,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('useUrlTenantOverride', () => {
  it('invokes switchTenant exactly once when URL tenant differs from active tenant and user is a member', () => {
    setAuthUser('TENANT-A', ['TENANT-A', 'TENANT-B']);

    renderHook(() => useUrlTenantOverride('TENANT-B'));

    expect(switchTenant).toHaveBeenCalledTimes(1);
    expect(switchTenant).toHaveBeenCalledWith('TENANT-B');
  });

  it('does not mutate the persisted tenant selection in localStorage', () => {
    setAuthUser('TENANT-A', ['TENANT-A', 'TENANT-B']);

    renderHook(() => useUrlTenantOverride('TENANT-B'));

    expect(window.localStorage.getItem(PERSISTED_KEY)).toBe(PERSISTED_VALUE_JSON);
  });

  it('is idempotent: re-rendering with the same resolvedTenantId does not call switchTenant again', () => {
    setAuthUser('TENANT-A', ['TENANT-A', 'TENANT-B']);

    const { rerender } = renderHook(({ slug }) => useUrlTenantOverride(slug), {
      initialProps: { slug: 'TENANT-B' },
    });
    rerender({ slug: 'TENANT-B' });
    rerender({ slug: 'TENANT-B' });

    expect(switchTenant).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for anonymous users (user is null)', () => {
    mockAuthValue = { user: null, switchTenant };

    renderHook(() => useUrlTenantOverride('TENANT-B'));

    expect(switchTenant).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PERSISTED_KEY)).toBe(PERSISTED_VALUE_JSON);
  });

  it('is a no-op when the user already has the URL tenant active', () => {
    setAuthUser('TENANT-B', ['TENANT-A', 'TENANT-B']);

    renderHook(() => useUrlTenantOverride('TENANT-B'));

    expect(switchTenant).not.toHaveBeenCalled();
  });

  it('is a no-op when the user has no membership for the URL tenant id', () => {
    setAuthUser('TENANT-A', ['TENANT-A']); // not a member of TENANT-B

    renderHook(() => useUrlTenantOverride('TENANT-B'));

    expect(switchTenant).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(PERSISTED_KEY)).toBe(PERSISTED_VALUE_JSON);
  });

  it('is a no-op when resolvedTenantId is null (root / picker route)', () => {
    setAuthUser('TENANT-A', ['TENANT-A', 'TENANT-B']);

    renderHook(() => useUrlTenantOverride(null));

    expect(switchTenant).not.toHaveBeenCalled();
  });
});
