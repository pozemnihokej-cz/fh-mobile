import { describe, it, expect, vi } from 'vitest';
import { computeStandings, fetchStandings } from '../standings';

const teams = [
  { id: 'A', name: 'Alpha HC', short_name: 'Alpha', logo_url: 'a.png' },
  { id: 'B', name: 'Bravo HC', short_name: 'Bravo', logo_url: null },
  { id: 'C', name: 'Charlie HC', short_name: null, logo_url: null },
];

describe('computeStandings (row → presentation)', () => {
  it('folds played matches into wins/draws/losses/points and ranks them', () => {
    const matches = [
      { home_team_id: 'A', away_team_id: 'B', home_score: 3, away_score: 1 }, // A win
      { home_team_id: 'B', away_team_id: 'C', home_score: 2, away_score: 2 }, // draw
      { home_team_id: 'C', away_team_id: 'A', home_score: 0, away_score: 4 }, // A win
    ];
    const table = computeStandings(matches, teams);

    expect(table.map((r) => r.teamId)).toEqual(['A', 'B', 'C']);
    const a = table[0];
    expect(a).toMatchObject({ played: 2, wins: 2, draws: 0, losses: 0, points: 6, goalsFor: 7, goalsAgainst: 1 });
    const b = table.find((r) => r.teamId === 'B');
    expect(b).toMatchObject({ played: 2, wins: 0, draws: 1, losses: 1, points: 1 });
  });

  it('ignores matches without a result (null scores) and teams that never played', () => {
    const matches = [
      { home_team_id: 'A', away_team_id: 'B', home_score: null, away_score: null },
      { home_team_id: 'A', away_team_id: 'B', home_score: 1, away_score: 0 },
    ];
    const table = computeStandings(matches, teams);
    // Only A and B played; C is filtered out (played === 0).
    expect(table.map((r) => r.teamId).sort()).toEqual(['A', 'B']);
    expect(table.every((r) => r.played === 1)).toBe(true);
  });

  it('falls back to team name when short_name is missing', () => {
    const table = computeStandings(
      [{ home_team_id: 'C', away_team_id: 'A', home_score: 1, away_score: 0 }],
      teams,
    );
    expect(table.find((r) => r.teamId === 'C')?.name).toBe('Charlie HC');
  });
});

describe('fetchStandings (supabase read path)', () => {
  function makeSupabase(matchesData: unknown, teamsData: unknown) {
    return {
      from: vi.fn((table: string) => {
        const result = table === 'matches'
          ? { data: matchesData, error: null }
          : { data: teamsData, error: null };
        const builder = {
          select: () => builder,
          eq: () => Promise.resolve(result),
        };
        return builder;
      }),
    };
  }

  it('reads matches + teams and returns the computed table', async () => {
    const supabase = makeSupabase(
      [{ home_team_id: 'A', away_team_id: 'B', home_score: 2, away_score: 0 }],
      teams,
    );
    const table = await fetchStandings(supabase as never, 'T1');
    expect(table[0].teamId).toBe('A');
    expect(table[0].points).toBe(3);
  });

  it('throws when PostgREST returns an error (routes to ErrorState)', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'boom', code: '42501' } }) }),
      })),
    };
    await expect(fetchStandings(supabase as never, 'T1')).rejects.toThrow(/boom/);
  });
});
