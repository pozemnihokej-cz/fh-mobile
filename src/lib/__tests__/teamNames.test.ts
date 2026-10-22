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

/**
 * spec-fan-app-prod-cleanup-and-team-names TEST-004 (Spec-AC-05).
 *
 * Measured on zcom 2026-10-22: team names carry the category (`Slavia ženy B`),
 * club short names drop the reserve letter (`Slavia`), and the curated
 * `teams.short_name` keeps the letter without the category (`Slavia B`).
 */
describe('TEST-004 (Spec-AC-05): the curated team short name is the fan label', () => {
  it('a reserve team against another club keeps its letter (was the bare club name)', () => {
    const names = resolveDisplayTeamNames({
      homeTeamName: 'Slavia ženy B',
      homeTeamShortName: 'Slavia B',
      homeClubName: 'Slavia',
      awayTeamName: 'Rakovník ženy',
      awayTeamShortName: 'Rakovník',
      awayClubName: 'Rakovník',
    });
    expect(names).toEqual({ home: 'Slavia B', away: 'Rakovník' });
  });

  it('a same-club derby reads with the two short names (zcom 77482)', () => {
    const names = resolveDisplayTeamNames({
      homeTeamName: 'Slavia ženy B',
      homeTeamShortName: 'Slavia B',
      homeClubName: 'Slavia',
      awayTeamName: 'Slavia ženy',
      awayTeamShortName: 'Slavia',
      awayClubName: 'Slavia',
    });
    expect(names).toEqual({ home: 'Slavia B', away: 'Slavia' });
  });

  it('a blank or missing short name falls back to the existing rule for that side only', () => {
    const names = resolveDisplayTeamNames({
      homeTeamName: 'HC Hostivař B',
      homeTeamShortName: '   ',
      homeClubName: 'Hostivař',
      awayTeamName: 'President B',
      awayTeamShortName: ' President B ',
      awayClubName: 'President',
    });
    expect(names).toEqual({ home: 'Hostivař', away: 'President B' });
  });

  it('equal labels with differing full team names fall back to the full team names', () => {
    const names = resolveDisplayTeamNames({
      homeTeamName: 'Litice mladší žáci',
      homeTeamShortName: 'Litice',
      homeClubName: 'Litice',
      awayTeamName: 'Litice starší žáci',
      awayTeamShortName: 'litice ',
      awayClubName: 'Litice',
    });
    expect(names).toEqual({ home: 'Litice mladší žáci', away: 'Litice starší žáci' });
  });

  it('one team row on both sides stays as it is (zcom 78997)', () => {
    const names = resolveDisplayTeamNames({
      homeTeamName: 'Rakovník minibenjamínci',
      homeTeamShortName: 'Rakovník',
      homeClubName: 'Rakovník',
      awayTeamName: 'Rakovník minibenjamínci',
      awayTeamShortName: 'Rakovník',
      awayClubName: 'Rakovník',
    });
    expect(names).toEqual({ home: 'Rakovník', away: 'Rakovník' });
  });

  it('the null short name of the Convex payload is treated as absent', () => {
    const names = resolveDisplayTeamNames({
      homeTeamName: 'Slavia ženy',
      homeTeamShortName: null,
      homeClubName: 'Slavia',
      awayTeamName: 'Praga ženy',
      awayTeamShortName: null,
      awayClubName: 'Praga',
    });
    expect(names).toEqual({ home: 'Slavia', away: 'Praga' });
  });
});
