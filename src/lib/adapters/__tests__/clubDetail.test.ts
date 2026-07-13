import { describe, it, expect } from 'vitest';
import { toClubDetail } from '../clubDetail';

const club = {
  id: 'C1',
  official_name: 'Hockey Club Alpha, z.s.',
  short_name: 'HC Alpha',
  marketing_name: null,
  logo_url: 'logo.png',
  web: 'https://alpha.example',
};

const teams = [
  { id: 'T2', name: 'Alpha B', short_name: 'Alpha B', logo_url: null, category: 'U16', gender: 'men' },
  { id: 'T1', name: 'Alpha A', short_name: 'Alpha A', logo_url: 't1.png', category: null, gender: 'men' },
];

describe('toClubDetail (row → presentation)', () => {
  it('projects identity, sorts teams by name, sorts fixtures newest-first', () => {
    const matches = [
      { id: 'm1', date: 100, status: 'scheduled', home_team_id: 'T1', away_team_id: 'X', home_score: null, away_score: null },
      { id: 'm2', date: 300, status: 'scheduled', home_team_id: 'X', away_team_id: 'T2', home_score: 2, away_score: 1 },
    ];
    const detail = toClubDetail(club, teams, matches);

    expect(detail.name).toBe('HC Alpha');
    expect(detail.logoUrl).toBe('logo.png');
    expect(detail.teams.map((t) => t.name)).toEqual(['Alpha A', 'Alpha B']);
    expect(detail.teams[1].category).toBe('U16');
    expect(detail.fixtures.map((f) => f.id)).toEqual(['m2', 'm1']);
    expect(detail.fixtures[0]).toMatchObject({ homeName: '—', awayName: 'Alpha B', homeScore: 2, awayScore: 1 });
  });

  it('prefers marketing_name, then short_name, then official_name', () => {
    expect(toClubDetail({ ...club, marketing_name: 'Alpha!' }, [], []).name).toBe('Alpha!');
    expect(toClubDetail({ ...club, short_name: null }, [], []).name).toBe('Hockey Club Alpha, z.s.');
  });
});
