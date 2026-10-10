/**
 * spec-fan-live-match-detail-usability — TEST-001 (Spec-AC-03), TEST-002 (Spec-AC-07).
 */
import { describe, it, expect } from 'vitest';
import * as lineupModule from '../lineup';
import { groupLineup, type MatchPlayerRow } from '../lineup';

// Resolved at call time so a missing export fails the assertion, not the import.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mod = lineupModule as any;

function players(n: number, extra: Partial<MatchPlayerRow> = {}): MatchPlayerRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p-${extra.side ?? 'home'}-${i}`,
    name: `Hráč ${i}`,
    jersey_number: String(i + 2),
    position: 'forward',
    role: 'player',
    side: 'home',
    ...extra,
  }));
}

describe('TEST-001 roster counting (Spec-AC-03)', () => {
  it('TEST-001 counts 16 field players and 2 goalkeepers, excluding coach and staff', () => {
    const rows: MatchPlayerRow[] = [
      ...players(15),
      { id: 'cap', name: 'Kapitán', jersey_number: '99', position: 'defender', role: 'captain', side: 'home' },
      { id: 'gk-pos', name: 'Brankář Pozice', jersey_number: '1', position: 'GK', role: 'player', side: 'home' },
      { id: 'gk-role', name: 'Brankář Role', jersey_number: '30', position: null, role: 'goalkeeper', side: 'home' },
      { id: 'coach', name: 'Trenér', jersey_number: null, position: null, role: 'coach', side: 'home' },
      { id: 'staff', name: 'Masér', jersey_number: null, position: null, role: 'staff', side: 'home' },
    ];
    const { home } = groupLineup(rows);
    expect(mod.countRosterPlayers(home)).toEqual({ field: 16, goalkeepers: 2 });
    expect(mod.formatRosterCount(home)).toBe('(16+2)');
  });

  it('TEST-001 counts a captain goalkeeper as a goalkeeper and a Czech position token as a goalkeeper', () => {
    const rows: MatchPlayerRow[] = [
      ...players(3),
      { id: 'gk-cap', name: 'Brankář Kapitán', jersey_number: '1', position: 'Brankář', role: 'captain', side: 'home' },
    ];
    expect(mod.countRosterPlayers(groupLineup(rows).home)).toEqual({ field: 3, goalkeepers: 1 });
  });

  it('TEST-001 excludes a coach whose position reads GK, an official and a referee from both numbers', () => {
    const rows: MatchPlayerRow[] = [
      ...players(4),
      { id: 'coach-gk', name: 'Trenér Brankářů', jersey_number: null, position: 'GK', role: 'coach', side: 'home' },
      { id: 'official', name: 'Vedoucí', jersey_number: null, position: null, role: 'official', side: 'home' },
      { id: 'ref', name: 'Rozhodčí', jersey_number: null, position: null, role: 'referee', side: 'home' },
    ];
    expect(mod.countRosterPlayers(groupLineup(rows).home)).toEqual({ field: 4, goalkeepers: 0 });
  });

  it('TEST-001 formats players without a goalkeeper as (F+0) and a side with no players as null', () => {
    expect(mod.formatRosterCount(groupLineup(players(11)).home)).toBe('(11+0)');
    const onlyCoach: MatchPlayerRow[] = [
      { id: 'c', name: 'Trenér', jersey_number: null, position: null, role: 'coach', side: 'home' },
    ];
    expect(mod.formatRosterCount(groupLineup(onlyCoach).home)).toBeNull();
    expect(mod.formatRosterCount([])).toBeNull();
  });
});

describe('TEST-002 referees extracted from the roster (Spec-AC-07)', () => {
  it('TEST-002 collects referee rows once per normalised name and keeps them out of both sides', () => {
    const rows: MatchPlayerRow[] = [
      ...players(2),
      ...players(2, { side: 'away' }),
      { _id: 'r1', name: 'Petr Píšťala', role: 'referee', side: 'neutral', image: 'https://images.example.com/r1.jpg' },
      { _id: 'r2', name: 'Jana Praporková', role: 'Referee', side: 'neutral' },
      { _id: 'r3', name: ' petr píšťala', role: 'referee', side: 'neutral' },
    ];
    const lineup = groupLineup(rows);
    expect(lineup.referees.map((r) => r.name)).toEqual(['Petr Píšťala', 'Jana Praporková']);
    expect(lineup.referees[0].image).toBe('https://images.example.com/r1.jpg');
    expect(lineup.home.map((p) => p.name)).not.toContain('Petr Píšťala');
    expect(lineup.guest.map((p) => p.name)).not.toContain('Jana Praporková');
    expect(lineup.home).toHaveLength(2);
    expect(lineup.guest).toHaveLength(2);
  });

  it('TEST-002 yields an empty referee list when the roster names none', () => {
    expect(groupLineup(players(3)).referees).toEqual([]);
  });
});
