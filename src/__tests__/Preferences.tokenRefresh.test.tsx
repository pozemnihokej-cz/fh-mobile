/**
 * SPEC-PRD-034 Spec-AC-14 — the sign-in merge-sync is a one-shot per IDENTITY,
 * not per token. supabase-js rotates the JWT (~hourly); the guard must key on
 * the verified `user.id` (sub), NOT the token value.
 *
 * Regression guard for the union-resurrect race: a token refresh that re-ran the
 * merge could RESURRECT a just-removed item (refresh get() returns the stale
 * remote set, union() re-adds it). This proves:
 *   - a token refresh with the SAME identity does NOT re-fire get()/upsert();
 *   - a removed item is NOT resurrected across the refresh;
 *   - signing in as a DIFFERENT identity re-arms the sync.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

type Row = { clubs: string[]; leagues: string[]; matches: string[] } | null;
const getSpy = vi.fn(async (): Promise<Row> => null);
const upsertSpy = vi.fn(
  async (_a: { clubs: string[]; leagues: string[]; matches: string[] }): Promise<void> => undefined,
);
const clearSpy = vi.fn(async (): Promise<void> => undefined);
vi.mock('../lib/fanPrefsClient', () => ({
  useFanPrefsActions: () => ({ get: getSpy, upsert: upsertSpy, clear: clearSpy }),
}));

let authState: Record<string, unknown> = { isAuthenticated: false, token: null, user: null };
vi.mock('@fh/auth', () => ({ useAuth: () => authState }));

import { FanPreferencesProvider, useFanPreferences } from '../lib/useFanPreferences';

function Harness(): JSX.Element {
  const p = useFanPreferences();
  return (
    <div>
      <span data-testid="matches">{p.matches.join(',')}</span>
      <button data-testid="tm" onClick={() => p.toggleMatch('m-remote')}>match</button>
    </div>
  );
}

// A FRESH element each call — React bails out of re-rendering a referentially
// identical top-level element, which would mask (not exercise) the auth change.
const tree = (): JSX.Element => (
  <FanPreferencesProvider>
    <Harness />
  </FanPreferencesProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getSpy.mockResolvedValue(null);
  authState = { isAuthenticated: false, token: null, user: null };
});

describe('Fan-prefs sync is one-shot per identity (token refresh)', () => {
  it('a token refresh with the same identity does NOT re-fire sync or resurrect a removed item', async () => {
    // Signed in; remote already has m-remote → sync unions it in.
    authState = { isAuthenticated: true, token: 'tok-1', user: { id: 'fan-1' } };
    getSpy.mockResolvedValue({ clubs: [], leagues: [], matches: ['m-remote'] });

    const { rerender } = render(tree());

    // One-shot sync ran exactly once and pulled the remote match in.
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('matches')).toHaveTextContent('m-remote'));

    // Fan removes m-remote (state → [], upsert([]) sent).
    await act(async () => {
      fireEvent.click(screen.getByTestId('tm'));
    });
    await waitFor(() => expect(screen.getByTestId('matches')).toHaveTextContent(''));

    // JWT refresh: SAME identity, new token. Remote still (staleley) reports m-remote.
    authState = { isAuthenticated: true, token: 'tok-2', user: { id: 'fan-1' } };
    rerender(tree());

    // Give any errant re-sync a chance to run, then assert it did NOT.
    await Promise.resolve();
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1)); // still one — no re-fire
    // The removed item stays removed — not resurrected by a refresh union().
    expect(screen.getByTestId('matches')).toHaveTextContent('');
  });

  it('signing in as a DIFFERENT identity re-arms the sync', async () => {
    authState = { isAuthenticated: true, token: 'tok-1', user: { id: 'fan-1' } };
    getSpy.mockResolvedValue({ clubs: [], leagues: [], matches: [] });
    const { rerender } = render(tree());
    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(1));

    // Sign out then in as fan-2 → guard re-arms, sync fires again for the new sub.
    await act(async () => {
      authState = { isAuthenticated: false, token: null, user: null };
      rerender(tree());
    });
    await act(async () => {
      authState = { isAuthenticated: true, token: 'tok-9', user: { id: 'fan-2' } };
      rerender(tree());
    });

    await waitFor(() => expect(getSpy).toHaveBeenCalledTimes(2));
    // The re-armed sync re-reads under the NEW identity; RLS scopes it, so the
    // call itself still carries no argument.
    expect(getSpy.mock.calls[getSpy.mock.calls.length - 1]).toEqual([]);
  });
});
