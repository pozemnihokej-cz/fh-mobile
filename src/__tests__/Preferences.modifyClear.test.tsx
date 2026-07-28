/**
 * SPEC-PRD-034 Spec-AC-14 / Spec-AC-15 / TEST-020 — modify & clear fan
 * subscriptions across BOTH paths:
 *   - ANON: subscriptions live in localStorage (fh_starred_matches / fh_my_clubs
 *     / fh_my_leagues); no Convex call is made.
 *   - SIGNED-IN: on the token-present transition the client reads Convex, unions
 *     with localStorage, and upserts the merged set; subsequent modify/clear go
 *     to Convex (upsert / clear) keyed off the fan's token.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

type Row = { clubs: string[]; leagues: string[]; matches: string[]; updatedAt: number } | null;
const getSpy = vi.fn(async (_a: { token: string }): Promise<Row> => null);
const upsertSpy = vi.fn(
  async (_a: { token: string; clubs: string[]; leagues: string[]; matches: string[] }): Promise<string> => 'row-id',
);
const clearSpy = vi.fn(async (_a: { token: string }): Promise<void> => undefined);

vi.mock('../lib/fanPrefsClient', () => ({
  useFanPrefsActions: () => ({ get: getSpy, upsert: upsertSpy, clear: clearSpy }),
}));

let authState: Record<string, unknown> = { isAuthenticated: false, token: null };
vi.mock('@fh/auth', () => ({ useAuth: () => authState }));

import { FanPreferencesProvider, useFanPreferences } from '../lib/useFanPreferences';

function Harness(): JSX.Element {
  const p = useFanPreferences();
  return (
    <div>
      <span data-testid="clubs">{p.clubs.join(',')}</span>
      <span data-testid="leagues">{p.leagues.join(',')}</span>
      <span data-testid="matches">{p.matches.join(',')}</span>
      <button data-testid="tc" onClick={() => p.toggleClub('c1')}>club</button>
      <button data-testid="tl" onClick={() => p.toggleLeague('l1')}>league</button>
      <button data-testid="tm" onClick={() => p.toggleMatch('m1')}>match</button>
      <button data-testid="clr" onClick={() => p.clearAll()}>clear</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <FanPreferencesProvider>
      <Harness />
    </FanPreferencesProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getSpy.mockResolvedValue(null);
  authState = { isAuthenticated: false, token: null };
});

describe('Preferences modify/clear — ANON localStorage path (TEST-020)', () => {
  it('toggles clubs/leagues/matches into localStorage and clears them', async () => {
    renderHarness();
    fireEvent.click(screen.getByTestId('tc'));
    fireEvent.click(screen.getByTestId('tl'));
    fireEvent.click(screen.getByTestId('tm'));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('fh_my_clubs') || '[]')).toEqual(['c1']);
      expect(JSON.parse(localStorage.getItem('fh_my_leagues') || '[]')).toEqual(['l1']);
      expect(JSON.parse(localStorage.getItem('fh_starred_matches') || '[]')).toEqual(['m1']);
    });
    expect(screen.getByTestId('clubs')).toHaveTextContent('c1');

    // No Convex call while anonymous.
    expect(upsertSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('clr'));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('fh_my_clubs') || '[]')).toEqual([]);
      expect(JSON.parse(localStorage.getItem('fh_starred_matches') || '[]')).toEqual([]);
    });
  });
});

describe('Preferences modify/clear — SIGNED-IN Convex path (TEST-020)', () => {
  beforeEach(() => {
    authState = { isAuthenticated: true, token: 'tok-abc', user: { id: 'fan-1' } };
    // localStorage has an anon club; Convex has a remote club → union on sign-in.
    localStorage.setItem('fh_my_clubs', JSON.stringify(['c-local']));
    getSpy.mockResolvedValue({ clubs: ['c-remote'], leagues: [], matches: [], updatedAt: 1 });
  });

  it('sign-in transition reads Convex, unions with localStorage, and upserts merged', async () => {
    renderHarness();
    await waitFor(() => expect(getSpy).toHaveBeenCalledWith({ token: 'tok-abc' }));
    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());
    const call = upsertSpy.mock.calls[0][0];
    expect(call.token).toBe('tok-abc');
    expect(call.clubs).toEqual(expect.arrayContaining(['c-local', 'c-remote']));
    // Merged state is reflected in the UI.
    await waitFor(() =>
      expect(screen.getByTestId('clubs').textContent?.split(',').sort()).toEqual(['c-local', 'c-remote']),
    );
  });

  it('modify (signed-in) upserts the new full set with the token', async () => {
    renderHarness();
    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(1)); // the sync upsert
    await act(async () => {
      fireEvent.click(screen.getByTestId('tm')); // add match m1
    });
    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(2));
    const last = upsertSpy.mock.calls[upsertSpy.mock.calls.length - 1][0];
    expect(last.token).toBe('tok-abc');
    expect(last.matches).toEqual(expect.arrayContaining(['m1']));
  });

  it('clear (signed-in) calls Convex clear with the token', async () => {
    renderHarness();
    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByTestId('clr'));
    });
    await waitFor(() => expect(clearSpy).toHaveBeenCalledWith({ token: 'tok-abc' }));
    expect(screen.getByTestId('clubs')).toHaveTextContent('');
  });
});
