import { describe, it, expect } from 'vitest';
import { toPlayerIdentity, nameMatches, computePlayerStats, fetchPlayerDetail } from '../playerDetail';

/**
 * Sequential per-table stub for the fan supabase read surface. Each `from(table)`
 * call consumes the next queued response for that table; every filter method is a
 * no-op passthrough and the builder is thenable so `await`-ing the chain resolves
 * the queued `{ data, error }` envelope.
 */
function makeSupabase(responses: Record<string, unknown[][]>): { from: (t: string) => unknown } {
  const calls: Record<string, number> = {};
  return {
    from(table: string) {
      const idx = calls[table] ?? 0;
      calls[table] = idx + 1;
      const data = responses[table]?.[idx] ?? [];
      const result = { data, error: null };
      const builder: Record<string, unknown> = {};
      const passthrough = (): Record<string, unknown> => builder;
      builder.select = passthrough;
      builder.eq = passthrough;
      builder.or = passthrough;
      builder.ilike = passthrough;
      builder.in = passthrough;
      builder.limit = passthrough;
      builder.then = (resolve: (r: unknown) => unknown) => resolve(result);
      return builder;
    },
  };
}

const HOMONYM = {
  id: 'P1', first_name: 'Jan', last_name: 'Novák', position: 'forward',
  jersey_number: 7, is_captain: false, photo_url: null, photo_detail_url: null,
};

describe('toPlayerIdentity (persons_public row → identity)', () => {
  it('composes name, stringifies jersey, prefers detail photo', () => {
    const id = toPlayerIdentity({
      id: 'P1',
      first_name: 'Jan',
      last_name: 'Novák',
      position: 'forward',
      jersey_number: 7,
      is_captain: true,
      photo_url: 'small.png',
      photo_detail_url: 'big.png',
    });
    expect(id).toEqual({
      id: 'P1',
      fullName: 'Jan Novák',
      position: 'forward',
      jersey: '7',
      isCaptain: true,
      photoUrl: 'big.png',
    });
  });

  it('falls back to the small photo and handles missing names/jersey', () => {
    const id = toPlayerIdentity({
      id: 'P2', first_name: null, last_name: null, position: null,
      jersey_number: null, is_captain: null, photo_url: 'small.png', photo_detail_url: null,
    });
    expect(id.fullName).toBe('—');
    expect(id.jersey).toBeNull();
    expect(id.photoUrl).toBe('small.png');
  });
});

describe('nameMatches (roster name heuristic)', () => {
  it('matches on token set regardless of order and diacritics/case', () => {
    expect(nameMatches('Jan', 'Novák', 'Novák Jan')).toBe(true);
    expect(nameMatches('Jan', 'Novák', 'jan novak')).toBe(true);
    expect(nameMatches('Jan', 'Novák', 'Jan Svoboda')).toBe(false);
    expect(nameMatches('Jan', 'Novák', null)).toBe(false);
  });
});

describe('computePlayerStats (appearances → recent)', () => {
  const matches = [
    { id: 'M1', date: 200, home_team_id: 'H', away_team_id: 'G', home_score: 3, away_score: 1 },
    { id: 'M2', date: 100, home_team_id: 'H2', away_team_id: 'G2', home_score: 0, away_score: 2 },
  ];
  const teams = [
    { id: 'H', name: 'Home One', short_name: null }, { id: 'G', name: 'Guest One', short_name: 'G1' },
    { id: 'H2', name: 'Home Two', short_name: null }, { id: 'G2', name: 'Guest Two', short_name: null },
  ];

  it('counts appearances and computes opponent + result from the player perspective', () => {
    const stats = computePlayerStats(
      [
        { match_id: 'M1', side: 'home', name: 'x' }, // home vs G1 → 3:1
        { match_id: 'M2', side: 'guest', name: 'x' }, // guest, opponent Home Two → 2:0
      ],
      matches,
      teams,
    );
    expect(stats.appearances).toBe(2);
    // newest first (date 200 before 100)
    expect(stats.recent[0]).toMatchObject({ matchId: 'M1', opponent: 'G1', result: '3:1' });
    expect(stats.recent[1]).toMatchObject({ matchId: 'M2', opponent: 'Home Two', result: '2:0' });
  });

  it('skips appearances whose match is missing and omits result when unscored', () => {
    const stats = computePlayerStats(
      [
        { match_id: 'ghost', side: 'home', name: 'x' },
        { match_id: 'M3', side: 'home', name: 'x' },
      ],
      [{ id: 'M3', date: 1, home_team_id: 'H', away_team_id: 'G', home_score: null, away_score: null }],
      teams,
    );
    expect(stats.appearances).toBe(2);
    expect(stats.recent).toHaveLength(1);
    expect(stats.recent[0].result).toBeNull();
  });
});

describe('fetchPlayerDetail (W1 — homonym guard)', () => {
  it('suppresses stats (null) when two people share the same first+last name', async () => {
    const supabase = makeSupabase({
      persons_public: [
        [HOMONYM], // identity lookup by id
        [{ id: 'P1' }, { id: 'P2' }], // homonym probe → 2 people named Jan Novák
      ],
      // match_players must NOT be consulted once the name is ambiguous.
      match_players: [[{ match_id: 'M1', side: 'home', name: 'Jan Novák' }]],
    });
    const out = await fetchPlayerDetail(supabase as never, 'T1', 'P1');
    expect(out).not.toBeNull();
    expect(out!.identity.fullName).toBe('Jan Novák');
    // The wrong player's merged/inflated count is never shown.
    expect(out!.stats).toBeNull();
  });

  it('computes appearances when the name is unique in the fan-visible set', async () => {
    const supabase = makeSupabase({
      persons_public: [
        [HOMONYM], // identity lookup by id
        [{ id: 'P1' }], // homonym probe → exactly one person → not ambiguous
      ],
      match_players: [[{ match_id: 'M1', side: 'home', name: 'Jan Novák' }]],
      matches: [[{ id: 'M1', date: 200, home_team_id: 'H', away_team_id: 'G', home_score: 3, away_score: 1 }]],
      teams: [[{ id: 'H', name: 'Home', short_name: null }, { id: 'G', name: 'Guest', short_name: 'G1' }]],
    });
    const out = await fetchPlayerDetail(supabase as never, 'T1', 'P1');
    expect(out!.stats).not.toBeNull();
    expect(out!.stats!.appearances).toBe(1);
    expect(out!.stats!.recent[0]).toMatchObject({ opponent: 'G1', result: '3:1' });
  });
});
