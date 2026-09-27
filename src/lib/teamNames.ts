/**
 * Shared team name disambiguation logic between OM and Fan App (CHANGE-063, Spec-AC-07).
 *
 * Normal match: prefers parent club name (e.g. "Litice", "Slavia") because category
 * is already displayed in the competition/league header or card.
 *
 * Intra-club derby (e.g. match 77482 "SK Slavia Praha B" vs "SK Slavia Praha ženy"):
 * when homeClubName === awayClubName, using the club name on both sides produces
 * "Slavia vs Slavia" (team playing itself). In that case, falls back to the distinguishing
 * team names (homeTeamName / awayTeamName) so "B" or the specific squad is clearly identifiable.
 */

export interface MatchWithTeamAndClubNames {
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeClubName?: string | null;
  awayClubName?: string | null;
}

export function resolveDisplayTeamNames(match?: MatchWithTeamAndClubNames | null): {
  home: string;
  away: string;
} {
  if (!match) {
    return { home: 'Domácí', away: 'Hosté' };
  }

  const nonBlank = (v: unknown): string | null =>
    (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

  const homeClub = nonBlank(match.homeClubName);
  const awayClub = nonBlank(match.awayClubName);
  const sameClub = homeClub != null && homeClub === awayClub;

  const home =
    (sameClub ? nonBlank(match.homeTeamName) : null) ??
    homeClub ??
    nonBlank(match.homeTeamName) ??
    'Domácí';

  const away =
    (sameClub ? nonBlank(match.awayTeamName) : null) ??
    awayClub ??
    nonBlank(match.awayTeamName) ??
    'Hosté';

  return { home, away };
}

export function resolveDisplayHomeTeam(match?: MatchWithTeamAndClubNames | null): string {
  return resolveDisplayTeamNames(match).home;
}

export function resolveDisplayAwayTeam(match?: MatchWithTeamAndClubNames | null): string {
  return resolveDisplayTeamNames(match).away;
}
