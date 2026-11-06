/**
 * spec-match-display-no-score-one-team-shootout TEST-006 (Spec-AC-06) — the
 * fan Supabase adapters (club detail fixtures, player detail recent results,
 * schedule): the shootout flag, no digits for a NULL score, and the one-team
 * flag; and the reads select `decided_by_shootout` (a mapper over a column
 * that is never fetched would always say "no shootout").
 */
import { describe, it, expect } from 'vitest';
import { toClubDetail, fetchClubDetail } from '../clubDetail';
import { computePlayerStats, fetchPlayerDetail } from '../playerDetail';
import { groupMatchesByDay } from '../schedule';

const match = (over: Record<string, unknown>) => ({
  id: 'm',
  date: 1_700_000_000_000,
  status: 'completed',
  home_team_id: 'T1',
  away_team_id: 'T2',
  home_score: null as number | null,
  away_score: null as number | null,
  decided_by_shootout: false,
  ...over,
});

const club = { id: 'C1', official_name: 'Alpha', short_name: 'Alpha', marketing_name: null, logo_url: null, web: null };
const teams = [
  { id: 'T1', name: 'Alpha', short_name: 'Alpha', logo_url: null, category: null, gender: null },
  { id: 'T2', name: 'Bravo', short_name: 'Bravo', logo_url: null, category: null, gender: null },
];

describe('club detail fixtures', () => {
  it('carries the shootout flag, keeps NULL scores NULL, flags a one-team event', () => {
    const d = toClubDetail(club, teams, [
      match({ id: 'so', home_score: 3, away_score: 2, decided_by_shootout: true }),
      match({ id: 'null', date: 1 }),
      match({ id: 'one', date: 2, away_team_id: 'T1' }),
    ]);
    const byId = Object.fromEntries(d.fixtures.map((f) => [f.id, f]));
    expect(byId.so).toMatchObject({ homeScore: 3, awayScore: 2, shootout: true, singleTeam: false });
    expect(byId.null).toMatchObject({ homeScore: null, awayScore: null, shootout: false });
    expect(byId.one).toMatchObject({ singleTeam: true, homeName: 'Alpha' });
  });
});

describe('player detail recent results', () => {
  it('marks a shootout only with a result, and a one-team event as the own team without opponent', () => {
    const stats = computePlayerStats(
      [
        { match_id: 'so', side: 'home', name: 'X' },
        { match_id: 'nullso', side: 'home', name: 'X' },
        { match_id: 'one', side: 'home', name: 'X' },
      ],
      [
        match({ id: 'so', date: 3, home_score: 3, away_score: 2, decided_by_shootout: true }),
        match({ id: 'nullso', date: 2, decided_by_shootout: true }),
        match({ id: 'one', date: 1, away_team_id: 'T1' }),
      ],
      teams,
    );
    const byId = Object.fromEntries(stats.recent.map((r) => [r.matchId, r]));
    expect(byId.so).toMatchObject({ result: '3:2', shootout: true, singleTeam: false });
    expect(byId.nullso).toMatchObject({ result: null, shootout: false });
    expect(byId.one).toMatchObject({ result: null, singleTeam: true, opponent: 'Alpha' });
  });
});

describe('schedule', () => {
  it('flags a one-team event', () => {
    const [day] = groupMatchesByDay(
      [match({ id: 'one', away_team_id: 'T1' }), match({ id: 'two', date: 1_700_000_000_001 })],
      teams.map(({ id, name, short_name, logo_url }) => ({ id, name, short_name, logo_url })),
    );
    expect(day.matches.map((m) => [m.id, m.singleTeam])).toEqual([
      ['one', true],
      ['two', false],
    ]);
  });
});

/** A chainable PostgREST stand-in that records every select list per table. */
function fakeSupabase(rows: Record<string, unknown[]>) {
  const selects: Record<string, string[]> = {};
  return {
    selects,
    client: {
      from(table: string) {
        const chain: any = {
          select(cols: string) {
            (selects[table] ??= []).push(cols);
            return chain;
          },
          then(resolve: (v: unknown) => unknown) {
            return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve);
          },
        };
        for (const m of ['eq', 'in', 'or', 'order', 'limit', 'ilike']) chain[m] = () => chain;
        return chain;
      },
    } as any,
  };
}

describe('the reads select decided_by_shootout', () => {
  it('fetchClubDetail', async () => {
    const fake = fakeSupabase({ clubs: [club], teams, matches: [] });
    await fetchClubDetail(fake.client, 'C1');
    expect(fake.selects.matches.join()).toMatch(/\bdecided_by_shootout\b/);
  });

  it('fetchPlayerDetail', async () => {
    const fake = fakeSupabase({
      persons_public: [{ id: 'P1', first_name: 'Jan', last_name: 'Novák' }],
      match_players: [{ match_id: 'm', side: 'home', name: 'Jan Novák' }],
      matches: [match({})],
      teams,
    });
    await fetchPlayerDetail(fake.client, 'tenant', 'P1');
    expect(fake.selects.matches?.join() ?? '').toMatch(/\bdecided_by_shootout\b/);
  });
});
