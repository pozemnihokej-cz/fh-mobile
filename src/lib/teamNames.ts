/**
 * Fan label for each side of a match.
 *
 * spec-fan-app-prod-cleanup-and-team-names D3 — first choice is the team's
 * curated short name (`teams.short_name`, mirrored to Convex as `shortName`):
 * "Slavia B", "Hostivař B", "Slavia". Measured on zcom 2026-10-22, it keeps a
 * reserve team's letter and leaves out the category, which the competition
 * label next to the matchup already shows.
 *
 * Without a short name, a side falls back to the CHANGE-063 rule (Spec-AC-07):
 * the parent club name; in a same-club derby the team name, so it does not
 * read "Slavia vs Slavia" (match 77482); then the team name; then the default.
 *
 * When both labels still come out equal while the full team names differ
 * (two teams curated with one short name), both sides show the full names.
 */

export interface MatchWithTeamAndClubNames {
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeTeamShortName?: string | null;
  awayTeamShortName?: string | null;
  homeClubName?: string | null;
  awayClubName?: string | null;
}

const nonBlank = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

const sameLabel = (a: string, b: string): boolean =>
  a.toLocaleLowerCase('cs') === b.toLocaleLowerCase('cs');

export function resolveDisplayTeamNames(match?: MatchWithTeamAndClubNames | null): {
  home: string;
  away: string;
} {
  if (!match) {
    return { home: 'Domácí', away: 'Hosté' };
  }

  const homeTeam = nonBlank(match.homeTeamName);
  const awayTeam = nonBlank(match.awayTeamName);
  const homeClub = nonBlank(match.homeClubName);
  const awayClub = nonBlank(match.awayClubName);
  const sameClub = homeClub != null && homeClub === awayClub;

  const home =
    nonBlank(match.homeTeamShortName) ??
    (sameClub ? homeTeam : null) ??
    homeClub ??
    homeTeam ??
    'Domácí';

  const away =
    nonBlank(match.awayTeamShortName) ??
    (sameClub ? awayTeam : null) ??
    awayClub ??
    awayTeam ??
    'Hosté';

  if (homeTeam && awayTeam && sameLabel(home, away) && !sameLabel(homeTeam, awayTeam)) {
    return { home: homeTeam, away: awayTeam };
  }

  return { home, away };
}

export function resolveDisplayHomeTeam(match?: MatchWithTeamAndClubNames | null): string {
  return resolveDisplayTeamNames(match).home;
}

export function resolveDisplayAwayTeam(match?: MatchWithTeamAndClubNames | null): string {
  return resolveDisplayTeamNames(match).away;
}
