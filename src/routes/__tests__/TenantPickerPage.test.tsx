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
import { MemoryRouter } from 'react-router-dom';

let mockTenants: Array<{ id: string; slug: string; name: string }> = [];

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: (_table: string) => {
        const result = Promise.resolve({ data: mockTenants, error: null });
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
  mockNavigate.mockReset();
});

describe('TenantPickerPage (TEST-001)', () => {
  it('renders one <a href="/<slug>/"> per active tenant, sorted by name ASC when multiple tenants exist', async () => {
    mockTenants = [
      { id: 'TID-COBRAS', slug: 'cobras', name: 'Cobras Hockey Club' },
      { id: 'TID-AVALANCHE', slug: 'avalanche', name: 'Avalanche Hockey Union' },
      { id: 'TID-BEARS', slug: 'bears', name: 'Bears HC' },
    ];
    render(
      <MemoryRouter>
        <TenantPickerPage />
      </MemoryRouter>,
    );

    const list = await waitFor(() => screen.getByTestId('tenant-picker-list'));

    const anchors = within(list).getAllByRole('link');
    expect(anchors).toHaveLength(3);

    const hrefs = anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href'));
    expect(hrefs).toEqual(['/avalanche/', '/bears/', '/cobras/']);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('automatically redirects to /<slug>/matches when exactly one active tenant exists', async () => {
    mockTenants = [
      { id: 'TID-SINGLE', slug: 'czech-hockey', name: 'Czech Field Hockey Union' },
    ];
    render(
      <MemoryRouter>
        <TenantPickerPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/czech-hockey/matches', { replace: true });
    });
    expect(screen.queryByTestId('tenant-picker-list')).toBeNull();
  });
});
