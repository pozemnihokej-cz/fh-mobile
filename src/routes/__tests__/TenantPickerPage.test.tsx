/**
 * CHANGE-055 TEST-001 (Spec-AC-02)
 *
 * TenantPickerPage renders one `<a href="/<slug>/">` per active tenant row
 * returned by the anon Supabase fetch, sorted by `name` ASC. Locale-aware
 * sort: 'Avalanche' (A) ranks before 'Bears' (B) ranks before 'Cobras' (C),
 * even if the upstream returned them shuffled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';

const mockOrder: Array<{ id: string; slug: string; name: string }> = [
  { id: 'TID-COBRAS', slug: 'cobras', name: 'Cobras Hockey Club' },
  { id: 'TID-AVALANCHE', slug: 'avalanche', name: 'Avalanche Hockey Union' },
  { id: 'TID-BEARS', slug: 'bears', name: 'Bears HC' },
];

vi.mock('../../lib/supabase', () => {
  // Chainable builder mock matching the .from('tenants').select(...).eq(...).eq(...) shape.
  // Resolves on `await` because the builder is thenable.
  return {
    supabase: {
      from: (_table: string) => {
        const result = Promise.resolve({ data: mockOrder, error: null });
        const builder: Record<string, unknown> = {
          select: (_cols: string) => builder,
          eq: (_col: string, _val: unknown) => builder,
          then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
            result.then(resolve, reject),
        };
        return builder;
      },
    },
  };
});

import TenantPickerPage from '../TenantPickerPage';

beforeEach(() => {
  // no shared mock state to reset
});

describe('TenantPickerPage (TEST-001)', () => {
  it('renders one <a href="/<slug>/"> per active tenant, sorted by name ASC', async () => {
    render(<TenantPickerPage />);

    const list = await waitFor(() => screen.getByTestId('tenant-picker-list'));

    const anchors = within(list).getAllByRole('link');
    expect(anchors).toHaveLength(3);

    const hrefs = anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href'));
    expect(hrefs).toEqual(['/avalanche/', '/bears/', '/cobras/']);
  });
});
