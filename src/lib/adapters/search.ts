import { unwrap, type SupabaseLike } from './supabaseRead';
import { toImageUrl } from '../runtimeUrls';

/**
 * PRD-055 Phase 2 — Search adapter. Fans search across the already-anon
 * `clubs` / `teams` tables and the fan-safe `persons_public` view (migration
 * 00195). Person search reads persons_public ONLY — never the PII base table.
 */

export interface SearchClubRow {
  id: string;
  official_name: string | null;
  short_name: string | null;
  marketing_name: string | null;
  logo_url: string | null;
}

export interface SearchTeamRow {
  id: string;
  name: string | null;
  short_name: string | null;
  logo_url: string | null;
  club_id: string | null;
}

export interface SearchPersonRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  jersey_number: number | null;
  photo_url: string | null;
}

export type SearchResultKind = 'club' | 'team' | 'player';

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
}

export interface SearchResults {
  clubs: SearchResult[];
  teams: SearchResult[];
  players: SearchResult[];
  total: number;
}

/** Pure mapper: raw rows from the three sources → grouped search results. */
export function toSearchResults(
  clubs: SearchClubRow[],
  teams: SearchTeamRow[],
  persons: SearchPersonRow[],
): SearchResults {
  const clubResults: SearchResult[] = clubs.map((c) => ({
    kind: 'club',
    id: c.id,
    title: c.marketing_name || c.short_name || c.official_name || '—',
    subtitle: null,
    imageUrl: toImageUrl(c.logo_url), // CHANGE-194 Bug 1
  }));
  const teamResults: SearchResult[] = teams.map((t) => ({
    kind: 'team',
    id: t.id,
    title: t.short_name || t.name || '—',
    subtitle: null,
    imageUrl: toImageUrl(t.logo_url), // CHANGE-194 Bug 1
  }));
  const playerResults: SearchResult[] = persons.map((p) => {
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';
    const bits = [p.position, p.jersey_number != null ? `#${p.jersey_number}` : null].filter(Boolean);
    return {
      kind: 'player',
      id: p.id,
      title: name,
      subtitle: bits.length ? bits.join(' · ') : null,
      imageUrl: toImageUrl(p.photo_url), // CHANGE-194 Bug 1
    };
  });
  return {
    clubs: clubResults,
    teams: teamResults,
    players: playerResults,
    total: clubResults.length + teamResults.length + playerResults.length,
  };
}

/**
 * Sanitize a raw fan query before it is interpolated into PostgREST
 * `.or()` / `.ilike()` filter strings. PostgREST treats `,` `(` `)` `.` `:` as
 * filter-grammar separators and `*` `%` `_` as `ilike` wildcards; `"` and `\`
 * quote/escape values. A raw query carrying any of these could break or re-shape
 * the `.or()` filter (e.g. inject an extra comma-separated term). We keep only
 * letters/digits/whitespace/diacritics, collapse the stripped runs to a single
 * space, and cap the length so a single term stays bounded.
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw
    .replace(/[,().*:"\\%_]/g, ' ') // drop PostgREST filter + ilike metacharacters
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

/** Run the multi-source search for a query string within a tenant. */
export async function fetchSearch(
  supabase: SupabaseLike,
  tenantId: string,
  query: string,
): Promise<SearchResults> {
  const q = sanitizeSearchQuery(query);
  if (q.length < 2) return { clubs: [], teams: [], players: [], total: 0 };
  const like = `%${q}%`;

  const clubs = unwrap<SearchClubRow[]>(
    await supabase
      .from('clubs')
      .select('id,official_name,short_name,marketing_name,logo_url')
      .eq('tenant_id', tenantId)
      .or(`official_name.ilike.${like},short_name.ilike.${like},marketing_name.ilike.${like}`)
      .limit(10),
  );
  const teams = unwrap<SearchTeamRow[]>(
    await supabase
      .from('teams')
      .select('id,name,short_name,logo_url,club_id')
      .eq('tenant_id', tenantId)
      .or(`name.ilike.${like},short_name.ilike.${like}`)
      .limit(10),
  );
  const persons = unwrap<SearchPersonRow[]>(
    await supabase
      .from('persons_public')
      .select('id,first_name,last_name,position,jersey_number,photo_url')
      .or(`first_name.ilike.${like},last_name.ilike.${like}`)
      .limit(15),
  );

  return toSearchResults(clubs, teams, persons);
}
