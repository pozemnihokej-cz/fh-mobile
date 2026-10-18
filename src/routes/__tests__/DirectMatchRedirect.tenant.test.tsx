/**
 * ISSUE-199 / spec-match-read-untenanted-external-id — TEST-006 (Spec-AC-04).
 *
 * A tenant-less fan link (`/live/<SportsPress number>`, as pozemnihokej.cz publishes them) is resolved inside
 * the default union tenant: the route resolves the `cz-field-hockey-union` slug first and passes its id to
 * `matches:getBySupabaseId`. It never issues the read without a tenant while the slug lookup is pending, so the
 * untenanted scan is never asked for. ISSUE-212: a failed slug lookup is retried; only after every retry failed does
 * the read go out without a tenant (and Convex then resolves a UUID only).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';

const slugResult = vi.hoisted(() => ({
  current: { id: 'TID-UNION', slug: 'cz-field-hockey-union', name: 'ČSPH' } as unknown,
  failFirst: 0,
  lookups: 0,
}));

vi.mock('../../lib/tenantBySlug', () => ({
  resolveTenantBySlug: vi.fn(async () => {
    slugResult.lookups += 1;
    if (slugResult.lookups <= slugResult.failFirst) throw new Error('network');
    return slugResult.current;
  }),
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

import DirectMatchRedirect, { SLUG_RETRY_DELAYS_MS } from '../DirectMatchRedirect';

SLUG_RETRY_DELAYS_MS.splice(0, SLUG_RETRY_DELAYS_MS.length, 1, 1, 1);

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
  slugResult.failFirst = 0;
  slugResult.lookups = 0;
});

describe('TEST-006 (Spec-AC-04): a tenant-less fan link resolves inside the union tenant', () => {
  it('reads the match with the union tenant id and never without one', async () => {
    mount();
    expect(await screen.findByTestId('detail')).toHaveTextContent('cz-field-hockey-union/uuid-union');
    const issued = reads.calls.filter((a) => a !== 'skip') as Array<Record<string, unknown>>;
    expect(issued.length).toBeGreaterThan(0);
    expect(issued.every((a) => a.tenantId === 'TID-UNION' && a.supabaseId === '23111')).toBe(true);
  });

  it('ISSUE-212: retries a failed slug lookup and still reads only inside the union tenant', async () => {
    slugResult.failFirst = 2;
    mount();
    expect(await screen.findByTestId('detail')).toHaveTextContent('cz-field-hockey-union/uuid-union');
    expect(slugResult.lookups).toBe(3);
    const issued = reads.calls.filter((a) => a !== 'skip') as Array<Record<string, unknown>>;
    expect(issued.every((a) => a.tenantId === 'TID-UNION')).toBe(true);
  });

  it('falls back to a read without a tenant only after every retry failed', async () => {
    slugResult.current = null;
    mount();
    await waitFor(() => expect(slugResult.lookups).toBe(4));
    await waitFor(() =>
      expect((reads.calls.filter((a) => a !== 'skip') as Array<Record<string, unknown>>).some((a) => !('tenantId' in a))).toBe(true),
    );
  });
});
