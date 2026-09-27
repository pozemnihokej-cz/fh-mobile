import { describe, it, expect } from 'vitest';
import {
  resolveDisplayTeamNames,
  resolveDisplayHomeTeam,
  resolveDisplayAwayTeam,
} from '../teamNames';

describe('resolveDisplayTeamNames — OM parity (CHANGE-063, Spec-AC-07)', () => {
  it('normal match: prefers parent club name over full team name with category', () => {
    const match = {
      homeClubName: 'Slavia',
      awayClubName: 'Litice',
      homeTeamName: 'SK Slavia Praha ženy',
      awayTeamName: 'TJ Plzeň-Litice ženy',
    };

    const names = resolveDisplayTeamNames(match);
    expect(names.home).toBe('Slavia');
    expect(names.away).toBe('Litice');
    expect(resolveDisplayHomeTeam(match)).toBe('Slavia');
    expect(resolveDisplayAwayTeam(match)).toBe('Litice');
  });

  it('intra-club derby (e.g. match 77482): equal club names fall back to distinguishing team names with B', () => {
    const derbyMatch = {
      homeClubName: 'SK Slavia Praha',
      awayClubName: 'SK Slavia Praha',
      homeTeamName: 'SK Slavia Praha B',
      awayTeamName: 'Slavia ženy',
    };

    const names = resolveDisplayTeamNames(derbyMatch);
    expect(names.home).toBe('SK Slavia Praha B');
    expect(names.away).toBe('Slavia ženy');
    expect(names.home).not.toBe(names.away);
  });

  it('intra-club derby: missing one team name falls back to club name', () => {
    const derbyMatch = {
      homeClubName: 'SK Slavia Praha',
      awayClubName: 'SK Slavia Praha',
      homeTeamName: null,
      awayTeamName: 'Slavia ženy',
    };

    const names = resolveDisplayTeamNames(derbyMatch);
    expect(names.home).toBe('SK Slavia Praha');
    expect(names.away).toBe('Slavia ženy');
  });

  it('falls back to team name when club name is null or undefined', () => {
    const match = {
      homeClubName: null,
      awayClubName: undefined,
      homeTeamName: 'HC Hostivař',
      awayTeamName: 'HC Bohemians',
    };

    const names = resolveDisplayTeamNames(match);
    expect(names.home).toBe('HC Hostivař');
    expect(names.away).toBe('HC Bohemians');
  });

  it('falls back to team name when club name is blank / whitespace', () => {
    const match = {
      homeClubName: '   ',
      awayClubName: '',
      homeTeamName: 'HC Hostivař',
      awayTeamName: 'HC Bohemians',
    };

    const names = resolveDisplayTeamNames(match);
    expect(names.home).toBe('HC Hostivař');
    expect(names.away).toBe('HC Bohemians');
  });

  it('handles null/undefined match gracefully', () => {
    expect(resolveDisplayTeamNames(null)).toEqual({ home: 'Domácí', away: 'Hosté' });
    expect(resolveDisplayTeamNames(undefined)).toEqual({ home: 'Domácí', away: 'Hosté' });
  });

  it('falls back to default labels when both club and team names are absent', () => {
    const match = {
      homeClubName: null,
      awayClubName: null,
      homeTeamName: null,
      awayTeamName: null,
    };

    expect(resolveDisplayTeamNames(match)).toEqual({ home: 'Domácí', away: 'Hosté' });
  });
});
