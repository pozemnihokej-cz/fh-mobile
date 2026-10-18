/**
 * ISSUE-199 / spec-match-read-untenanted-external-id — TEST-006 (Spec-AC-04).
 *
 * A tenant-less fan link (`/live/<SportsPress number>`, as pozemnihokej.cz publishes them) is resolved inside
 * the default union tenant: the route resolves the `cz-field-hockey-union` slug first and passes its id to
 * `matches:getBySupabaseId`. It never issues the read without a tenant while the slug lookup is pending, so the
 * untenanted scan is never asked for. A failed slug lookup still issues the read without a tenant (slice 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';

const slugResult = vi.hoisted(() => ({ current: { id: 'TID-UNION', slug: 'cz-field-hockey-union', name: 'ČSPH' } as unknown }));

vi.mock('../../lib/tenantBySlug', () => ({
  resolveTenantBySlug: vi.fn(async () => slugResult.current),
  resolveTenantById: vi.fn(async (_s: unknown, id: string) => (id === 'TID-UNION' ? slugResult.current : null)),
}));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

const reads = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock('convex/react', () => ({
  useQuery: vi.fn((_q: unknown, args: unknown) => {
    reads.calls.push(args);
    if (args === 'skip') return undefined;
    const a = args as { supabaseId: string; tenantId?: string };
    if (a.supabaseId !== '23111') return null;
    if (a.tenantId === 'TID-UNION') return { supabaseId: 'uuid-union', tenantId: 'TID-UNION' };
    if (a.tenantId === undefined) return { supabaseId: 'uuid-any', tenantId: 'TID-UNION' };
    return null;
  }),
}));

import DirectMatchRedirect from '../DirectMatchRedirect';

function Detail() {
  const { slug, matchId } = useParams();
  return <div data-testid="detail">{`${slug}/${matchId}`}</div>;
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/live/23111']}>
      <Routes>
        <Route path="/live/:matchId" element={<DirectMatchRedirect />} />
        <Route path="/:slug/matches/:matchId" element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  reads.calls.length = 0;
  slugResult.current = { id: 'TID-UNION', slug: 'cz-field-hockey-union', name: 'ČSPH' };
});

describe('TEST-006 (Spec-AC-04): a tenant-less fan link resolves inside the union tenant', () => {
  it('reads the match with the union tenant id and never without one', async () => {
    mount();
    expect(await screen.findByTestId('detail')).toHaveTextContent('cz-field-hockey-union/uuid-union');
    const issued = reads.calls.filter((a) => a !== 'skip') as Array<Record<string, unknown>>;
    expect(issued.length).toBeGreaterThan(0);
    expect(issued.every((a) => a.tenantId === 'TID-UNION' && a.supabaseId === '23111')).toBe(true);
  });

  it('falls back to a read without a tenant when the union slug cannot be resolved', async () => {
    slugResult.current = null;
    mount();
    await waitFor(() =>
      expect((reads.calls.filter((a) => a !== 'skip') as Array<Record<string, unknown>>).some((a) => !('tenantId' in a))).toBe(true),
    );
  });
});
