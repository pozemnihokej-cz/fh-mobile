/**
 * spec-sport-operator-match-list-filters D-3 — what one match tells the match list filters
 * Sport Live shares with Sport Operator (`@fh/schema` match-list-filters).
 *
 * The values are exactly the ones this page used before the module was shared: the venue it
 * shows (`venue ?? location`), the competition name, the side labels the cards show as the
 * team options, and the team and club names a team choice also matches.
 */
import type { MatchListFilterFacts } from '@fh/schema';
import { matchVenueLabel, type MatchListRow } from './matchListDeepLink';
import { resolveDisplayTeamNames, type MatchWithTeamAndClubNames } from './teamNames';

export type FanMatchFilterRow = MatchListRow & MatchWithTeamAndClubNames;

export function fanMatchFilterFacts(m: FanMatchFilterRow): MatchListFilterFacts {
  const { home, away } = resolveDisplayTeamNames(m);
  return {
    venue: matchVenueLabel(m),
    league: m.leagueName,
    teamLabels: [home, away],
    teamAliases: [m.homeTeamName, m.awayTeamName, m.homeClubName, m.awayClubName],
  };
}
