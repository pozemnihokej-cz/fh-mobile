import { describe, it, expect } from 'vitest';
import { groupLineup } from '../lineup';

describe('groupLineup (row → presentation)', () => {
  const rows = [
    { id: '1', name: 'Karel Home', jersey_number: '9', position: 'forward', role: 'player', side: 'home' },
    { id: '2', name: 'Petr Cap', jersey_number: '4', position: 'defender', role: 'captain', side: 'home' },
    { id: '3', name: 'Coach Home', jersey_number: null, position: null, role: 'coach', side: 'home' },
    { id: '4', name: 'Guest One', jersey_number: '7', position: 'forward', role: 'player', side: 'guest' },
  ];

  it('splits players by side (home / guest)', () => {
    const lineup = groupLineup(rows);
    expect(lineup.home.map((p) => p.id)).toContain('1');
    expect(lineup.guest.map((p) => p.id)).toEqual(['4']);
  });

  it('orders captain first, coaches last, else by jersey number', () => {
    const lineup = groupLineup(rows);
    expect(lineup.home.map((p) => p.id)).toEqual(['2', '1', '3']);
    expect(lineup.home[0].isCaptain).toBe(true);
    expect(lineup.home[2].isCoach).toBe(true);
  });

  it('maps Convex documents with _id, jerseyNumber, side away and filters referees', () => {
    const convexRows = [
      { _id: 'cx-1', name: 'Alena Away', jerseyNumber: '11', position: 'FW', role: 'player', side: 'away' },
      { _id: 'cx-2', name: 'Barbora Home', jerseyNumber: '2', position: 'DF', role: 'Captain', side: 'home' },
      { _id: 'cx-3', name: 'Referee Novák', jerseyNumber: null, position: null, role: 'referee', side: 'neutral' },
    ];
    const lineup = groupLineup(convexRows as any);
    expect(lineup.home).toHaveLength(1);
    expect(lineup.home[0]).toMatchObject({ id: 'cx-2', name: 'Barbora Home', jersey: '2', isCaptain: true });
    expect(lineup.guest).toHaveLength(1);
    expect(lineup.guest[0]).toMatchObject({ id: 'cx-1', name: 'Alena Away', jersey: '11', isCaptain: false });
    // Referee is filtered out
    expect(lineup.home.some((p) => p.name.includes('Referee'))).toBe(false);
    expect(lineup.guest.some((p) => p.name.includes('Referee'))).toBe(false);
  });
});

describe('fetchLineup', () => {
  it('fetches direct match_players when present', async () => {
    const fakeSupabase: any = {
      from: (table: string) => {
        if (table === 'match_players') {
          return {
            select: () => ({
              eq: (field: string, val: string) => Promise.resolve({
                data: [
                  { id: 'p1', name: 'Jan Domácí', jersey_number: '10', position: 'FW', role: 'player', side: 'home' },
                  { id: 'p2', name: 'Petr Host', jersey_number: '5', position: 'DF', role: 'player', side: 'guest' },
                ],
                error: null,
              }),
            }),
          };
        }
        return {};
      },
    };

    const res = await (await import('../lineup')).fetchLineup(fakeSupabase, 'M1');
    expect(res.home).toHaveLength(1);
    expect(res.home[0].name).toBe('Jan Domácí');
    expect(res.guest).toHaveLength(1);
    expect(res.guest[0].name).toBe('Petr Host');
  });

  it('falls back to team roster when match_players by match_id is empty', async () => {
    const fakeSupabase: any = {
      from: (table: string) => {
        if (table === 'match_players') {
          return {
            select: (cols: string) => ({
              eq: () => Promise.resolve({ data: [], error: null }),
              in: (field: string, ids: string[]) => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [
                      { id: 'tp1', name: 'Adam Hostivař', jersey_number: '1', position: 'GK', role: 'player', team_id: 'TEAM_HOME' },
                      { id: 'tp2', name: 'Bedřich President', jersey_number: '2', position: 'DF', role: 'player', team_id: 'TEAM_AWAY' },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'matches') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({
                  data: { home_team_id: 'TEAM_HOME', away_team_id: 'TEAM_AWAY' },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const res = await (await import('../lineup')).fetchLineup(fakeSupabase, 'M2');
    expect(res.home).toHaveLength(1);
    expect(res.home[0].name).toBe('Adam Hostivař');
    expect(res.guest).toHaveLength(1);
    expect(res.guest[0].name).toBe('Bedřich President');
  });
});

