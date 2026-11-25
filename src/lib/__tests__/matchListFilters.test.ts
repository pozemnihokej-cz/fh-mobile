/**
 * spec-sport-operator-match-list-filters — TEST-010 (Spec-AC-10, D-3): the facts Sport Live hands
 * the shared `@fh/schema` match list filter module, one per match.
 */
import { describe, it, expect } from 'vitest';
import { matchPassesListFilters } from '@fh/schema';
import { fanMatchFilterFacts } from '../matchListFilters';

describe('TEST-010: fanMatchFilterFacts', () => {
  it('venue = venue ?? location, league = leagueName, labels = display names, aliases = team and club names', () => {
    const facts = fanMatchFilterFacts({
      venue: null,
      location: ' Hřiště Eden ',
      leagueName: 'Extraliga mužů',
      homeTeamName: 'SK Slavia Praha B',
      homeTeamShortName: 'Slavia B',
      homeClubName: 'SK Slavia Praha',
      awayTeamName: 'HC Hostivař muži',
      awayClubName: 'HC Hostivař',
    });
    expect(facts.venue).toBe('Hřiště Eden');
    expect(facts.league).toBe('Extraliga mužů');
    expect(facts.teamLabels).toEqual(['Slavia B', 'HC Hostivař']);
    expect(facts.teamAliases).toEqual(['SK Slavia Praha B', 'HC Hostivař muži', 'SK Slavia Praha', 'HC Hostivař']);
  });

  it('a club-name choice keeps the match whose label is the short name', () => {
    const facts = fanMatchFilterFacts({
      homeTeamName: 'SK Slavia Praha B', homeTeamShortName: 'Slavia B', homeClubName: 'SK Slavia Praha',
      awayTeamName: 'Bohemians', awayClubName: null,
    });
    expect(matchPassesListFilters(facts, { venue: 'all', league: 'all', team: 'SK Slavia Praha' })).toBe(true);
    expect(matchPassesListFilters(facts, { venue: 'all', league: 'all', team: 'Kbely' })).toBe(false);
  });
});
