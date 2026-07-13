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

  it('maps flags and defaults an unknown side to home', () => {
    const lineup = groupLineup([
      { id: 'z', name: 'Zed', jersey_number: null, position: null, role: 'player', side: null },
    ]);
    expect(lineup.home).toHaveLength(1);
    expect(lineup.home[0]).toMatchObject({ name: 'Zed', jersey: null, isCaptain: false, isCoach: false });
  });
});
