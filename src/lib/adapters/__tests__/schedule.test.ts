import { describe, it, expect } from 'vitest';
import { groupMatchesByDay } from '../schedule';

const teams = [
  { id: 'A', name: 'Alpha HC', short_name: 'Alpha', logo_url: 'a.png' },
  { id: 'B', name: 'Bravo HC', short_name: 'Bravo', logo_url: null },
];

// Two fixed instants on different UTC-local days.
const DAY1 = Date.UTC(2026, 0, 12, 17, 0); // 12 Jan 2026 18:00 Prague
const DAY1b = Date.UTC(2026, 0, 12, 19, 15);
const DAY2 = Date.UTC(2026, 0, 18, 16, 0);

describe('groupMatchesByDay (row → presentation)', () => {
  it('groups matches by calendar day and sorts ascending', () => {
    const matches = [
      { id: 'm2', date: DAY2, status: 'scheduled', home_team_id: 'B', away_team_id: 'A', home_score: null, away_score: null },
      { id: 'm1', date: DAY1, status: 'scheduled', home_team_id: 'A', away_team_id: 'B', home_score: null, away_score: null },
      { id: 'm1b', date: DAY1b, status: 'scheduled', home_team_id: 'A', away_team_id: 'B', home_score: null, away_score: null },
    ];
    const days = groupMatchesByDay(matches, teams);
    expect(days).toHaveLength(2);
    // Day 1 comes first (ascending) and holds the two same-day matches in time order.
    expect(days[0].matches.map((m) => m.id)).toEqual(['m1', 'm1b']);
    expect(days[1].matches.map((m) => m.id)).toEqual(['m2']);
  });

  it('resolves team names/logos and formats a time label', () => {
    const days = groupMatchesByDay(
      [{ id: 'm1', date: DAY1, status: 'scheduled', home_team_id: 'A', away_team_id: 'B', home_score: null, away_score: null }],
      teams,
    );
    const match = days[0].matches[0];
    expect(match.home).toEqual({ name: 'Alpha', logoUrl: 'a.png' });
    expect(match.away).toEqual({ name: 'Bravo', logoUrl: null });
    expect(match.time).toMatch(/\d{1,2}[:.]\d{2}/);
  });

  it('drops matches without a date', () => {
    const days = groupMatchesByDay(
      [{ id: 'x', date: null, status: 'scheduled', home_team_id: 'A', away_team_id: 'B', home_score: null, away_score: null }],
      teams,
    );
    expect(days).toEqual([]);
  });
});
