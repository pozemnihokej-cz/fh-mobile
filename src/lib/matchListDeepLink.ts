/**
 * PRD-072 / spec-fan-match-list-venue-league-and-maps — the deep-link contract of the fan match list and the
 * Google Maps destination of a venue.
 *
 * `/<slug>/matches?venue=<venueId>` / `?league=<leagueId>` (stable ids). Only a match without an id is linked by its
 * display name, `?venueName=` / `?leagueName=`. The list still filters by display name, so a deep link is resolved
 * against the loaded rows into the option name; anything not among them resolves to "all".
 */
import { parseGps } from '../hooks/useNearestVenue';

export interface MatchListLinkTarget {
  venueId?: string | null;
  venueName?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
}

export interface MatchListDeepLink {
  venueId?: string;
  venueName?: string;
  leagueId?: string;
  leagueName?: string;
}

const PARAMS = { venueId: 'venue', venueName: 'venueName', leagueId: 'league', leagueName: 'leagueName' } as const;

/** Every search parameter the contract owns, so the list can drop them once the reader changes the filters. */
export const MATCH_LIST_DEEP_LINK_PARAMS: readonly string[] = Object.values(PARAMS);

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Href of the tenant's match list filtered to one venue or one competition, or null when nothing identifies it. */
export function buildMatchListHref(slug: string | null | undefined, target: MatchListLinkTarget): string | null {
  if (!slug) return null;
  const params = new URLSearchParams();
  const venueId = clean(target.venueId);
  const venueName = clean(target.venueName);
  const leagueId = clean(target.leagueId);
  const leagueName = clean(target.leagueName);
  if (venueId) params.set(PARAMS.venueId, venueId);
  else if (venueName) params.set(PARAMS.venueName, venueName);
  if (leagueId) params.set(PARAMS.leagueId, leagueId);
  else if (leagueName) params.set(PARAMS.leagueName, leagueName);
  const query = params.toString();
  if (!query) return null;
  return `/${encodeURIComponent(slug)}/matches?${query}`;
}

/** The deep link carried by a URL, or null when it carries none. */
export function readMatchListDeepLink(search: URLSearchParams): MatchListDeepLink | null {
  const link: MatchListDeepLink = {};
  for (const [key, param] of Object.entries(PARAMS) as Array<[keyof MatchListDeepLink, string]>) {
    const value = clean(search.get(param));
    if (value) link[key] = value;
  }
  return Object.keys(link).length > 0 ? link : null;
}

export interface MatchListRow {
  venueId?: string | null;
  venue?: string | null;
  location?: string | null;
  leagueId?: string | null;
  leagueName?: string | null;
}

export interface ResolvedMatchListFilters {
  venue: string;
  league: string;
  team: 'all';
}

/** The venue name the list filters and offers options by (MatchesPage: `venue ?? location`, trimmed). */
export function matchVenueLabel(row: MatchListRow): string | null {
  return clean(row.venue ?? row.location);
}

/**
 * Filters a deep link selects over the loaded rows. Every filter the link does not name — the team filter
 * included — is "all", so no stale session filter survives a deep link.
 */
export function resolveMatchListDeepLink(
  link: MatchListDeepLink,
  rows: readonly MatchListRow[],
): ResolvedMatchListFilters {
  const venueNames = new Set<string>();
  const leagueNames = new Set<string>();
  let venueById: string | null = null;
  let leagueById: string | null = null;
  for (const row of rows) {
    const venue = matchVenueLabel(row);
    const league = clean(row.leagueName);
    if (venue) venueNames.add(venue);
    if (league) leagueNames.add(league);
    if (!venueById && link.venueId && row.venueId === link.venueId && venue) venueById = venue;
    if (!leagueById && link.leagueId && row.leagueId === link.leagueId && league) leagueById = league;
  }
  const byName = (name: string | undefined, names: Set<string>) => (name && names.has(name) ? name : null);
  return {
    venue: (link.venueId ? venueById : byName(link.venueName, venueNames)) ?? 'all',
    league: (link.leagueId ? leagueById : byName(link.leagueName, leagueNames)) ?? 'all',
    team: 'all',
  };
}

export interface VenueDestination {
  gps?: string | null;
  address?: string | null;
}

/** Google Maps directions to the venue: coordinates when they parse, else the address, else null. */
export function googleMapsDirectionsHref(venue: VenueDestination | null | undefined): string | null {
  if (!venue) return null;
  const coords = parseGps(venue.gps);
  const destination = coords ? `${coords[0]},${coords[1]}` : clean(venue.address);
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination }).toString()}`;
}
