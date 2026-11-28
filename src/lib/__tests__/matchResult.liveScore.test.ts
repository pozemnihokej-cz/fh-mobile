/**
 * spec-fan-live-score-header-card-mismatch TEST-002 (Spec-AC-02) — the one live
 * score the fan header and the fan card both render. (The card half, through
 * the real clock and timeline hooks, is MatchDetailView.liveScore.test.tsx.)
 */
import { createElement as h } from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { i18n } from '@fh/i18n';
import { liveFanScore } from '../matchResult';

const state = vi.hoisted(() => ({ match: undefined as unknown }));

vi.mock('convex/react', () => ({
  useQuery: (_q: unknown, args: unknown) => (args === 'skip' ? undefined : state.match),
}));
vi.mock('../../components/MatchDetailView', () => ({ MatchDetailView: () => null }));
vi.mock('../useFanPreferences', () => ({
  useFanPreferences: () => ({ isMatchSaved: () => false, toggleMatch: () => undefined }),
}));

import MatchDetailPage from '../../routes/MatchDetailPage';
import { TenantContext } from '../../routes/TenantContext';

const UUID = 'd103748f-b4e9-44d5-8a81-5a5c1b2d0052';

beforeAll(async () => {
  await i18n.changeLanguage('cs');
});
afterEach(cleanup);

describe('TEST-002 (Spec-AC-02): liveFanScore', () => {
  it('is the match score (every recorded goal, from getBySupabaseId)', () => {
    expect(liveFanScore({ homeScore: 2, awayScore: 2 })).toEqual({ home: 2, away: 2 });
    expect(liveFanScore({ homeScore: 4, awayScore: 0 })).toEqual({ home: 4, away: 0 });
  });

  it('a missing score reads 0, never undefined', () => {
    expect(liveFanScore({})).toEqual({ home: 0, away: 0 });
    expect(liveFanScore({ homeScore: null, awayScore: undefined })).toEqual({ home: 0, away: 0 });
  });

  it('the sticky header of a live match renders liveFanScore (PROD 80129: 2 : 2)', () => {
    const match = {
      supabaseId: UUID,
      status: 'in_progress',
      date: Date.now() - 15 * 60_000,
      startedAt: Date.now() - 13 * 60_000,
      homeTeamId: 'team-h',
      awayTeamId: 'team-a',
      homeTeamShortName: 'Rakovník',
      awayTeamShortName: 'President',
      homeScore: 2,
      awayScore: 2,
      hasPlayRecord: true,
      resultHomeScore: null,
      resultAwayScore: null,
      decidedByShootout: false,
    };
    state.match = match;
    // createElement, not JSX: the Test Plan names this file `.ts`.
    render(
      h(
        TenantContext.Provider,
        { value: { tenantId: 't-union', slug: 'union', tenantName: 'ČSPH' } },
        h(
          MemoryRouter,
          { initialEntries: [`/union/matches/${UUID}`] },
          h(Routes, null, h(Route, { path: '/:slug/matches/:matchId', element: h(MatchDetailPage) })),
        ),
      ),
    );
    const s = liveFanScore(match);
    expect(screen.getByTestId('match-detail-header-score').textContent).toBe(`${s.home} : ${s.away}`);
    expect(screen.getByTestId('match-detail-header-score').textContent).toBe('2 : 2');
  });
});
