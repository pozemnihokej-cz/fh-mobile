/**
 * CHANGE-055 TEST-010 (Spec-AC-13)
 *
 * TenantLayout emits ONE structured `console.info` breadcrumb per slug
 * resolution with the contract:
 *   { event: 'fh-mobile.public-tenant-resolve', slug, tenantId, hasSession }
 *
 * Re-renders with the same slug must NOT re-emit; only a slug change does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../lib/tenantBySlug', () => ({
  resolveTenantBySlug: vi.fn(async (_supabase: unknown, slug: string) => ({
    id: `TID-${slug.toUpperCase()}`,
    slug,
    name: `Tenant ${slug}`,
  })),
  __resetTenantBySlugCache: () => undefined,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({}) }) }) },
}));

vi.mock('@fh/auth', () => ({
  useAuth: () => ({ user: null, switchTenant: vi.fn() }),
}));

import TenantLayout from '../TenantLayout';

beforeEach(async () => {
  vi.restoreAllMocks();
  const mod = await import('../../lib/tenantBySlug');
  (mod as { __resetTenantBySlugCache: () => void }).__resetTenantBySlugCache();
});

describe('TenantLayout telemetry (TEST-010)', () => {
  it('emits one console.info breadcrumb per slug resolution', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    render(
      <MemoryRouter initialEntries={['/e2e-test/matches']}>
        <Routes>
          <Route path=":slug" element={<TenantLayout />}>
            <Route path="matches" element={<span data-testid="child">child</span>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(infoSpy).toHaveBeenCalled();
    });

    // Find the structured breadcrumb (other unrelated console.info calls
    // are also tolerated — only the breadcrumb shape is asserted).
    const breadcrumbCalls = infoSpy.mock.calls.filter(
      (call) =>
        typeof call[0] === 'object' &&
        call[0] !== null &&
        (call[0] as { event?: string }).event === 'fh-mobile.public-tenant-resolve',
    );
    expect(breadcrumbCalls).toHaveLength(1);
    const payload = breadcrumbCalls[0][0] as {
      event: string;
      slug: string;
      tenantId: string;
      hasSession: boolean;
    };
    expect(payload.slug).toBe('e2e-test');
    expect(payload.tenantId).toBe('TID-E2E-TEST');
    expect(payload.hasSession).toBe(false);
  });
});
