/**
 * SPEC-PRD-034 Spec-AC-14 / Spec-AC-15 / TEST-020 — modify & clear fan
 * subscriptions across BOTH paths:
 *   - ANON: subscriptions live in localStorage (fh_starred_matches / fh_my_clubs
 *     / fh_my_leagues); no Convex call is made.
 *   - SIGNED-IN: on the token-present transition the client reads the stored
 *     rows, unions with localStorage, and upserts the merged set; subsequent
 *     modify/clear push the full set (upsert / clear).
 *
 * TECHDEBT-041: the backing store moved Convex -> Postgres. The calls carry NO
 * token and NO user id any more — own-data isolation is own-row RLS on
 * auth.uid() (migration 00214), so the identity never crosses this seam.
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

describe('Preferences modify/clear — SIGNED-IN server path (TEST-020)', () => {
  beforeEach(() => {
    authState = { isAuthenticated: true, token: 'tok-abc', user: { id: 'fan-1' } };
    // localStorage has an anon club; the store has a remote club → union on sign-in.
    localStorage.setItem('fh_my_clubs', JSON.stringify(['c-local']));
    getSpy.mockResolvedValue({ clubs: ['c-remote'], leagues: [], matches: [] });
  });

  it('sign-in transition reads the store, unions with localStorage, and upserts merged', async () => {
    renderHarness();
    // No argument at all: the read is scoped by RLS, not by a client-supplied id.
    await waitFor(() => expect(getSpy).toHaveBeenCalled());
    expect(getSpy.mock.calls[0]).toEqual([]);
    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());
    const call = upsertSpy.mock.calls[0][0];
    expect(call).not.toHaveProperty('token');
    expect(call).not.toHaveProperty('userId');
    expect(call.clubs).toEqual(expect.arrayContaining(['c-local', 'c-remote']));
    // Merged state is reflected in the UI.
    await waitFor(() =>
      expect(screen.getByTestId('clubs').textContent?.split(',').sort()).toEqual(['c-local', 'c-remote']),
    );
  });

  it('modify (signed-in) upserts the new full set, carrying no identity', async () => {
    renderHarness();
    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(1)); // the sync upsert
    await act(async () => {
      fireEvent.click(screen.getByTestId('tm')); // add match m1
    });
    await waitFor(() => expect(upsertSpy).toHaveBeenCalledTimes(2));
    const last = upsertSpy.mock.calls[upsertSpy.mock.calls.length - 1][0];
    expect(last).not.toHaveProperty('token');
    expect(last).not.toHaveProperty('userId');
    expect(last.matches).toEqual(expect.arrayContaining(['m1']));
  });

  it('clear (signed-in) calls clear with no arguments', async () => {
    renderHarness();
    await waitFor(() => expect(upsertSpy).toHaveBeenCalled());
    await act(async () => {
      fireEvent.click(screen.getByTestId('clr'));
    });
    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
    expect(clearSpy.mock.calls[0]).toEqual([]);
    expect(screen.getByTestId('clubs')).toHaveTextContent('');
  });
});
