import { unwrap, type SupabaseLike } from './supabaseRead';
import { toImageUrl } from '../runtimeUrls';

/**
 * PRD-055 Phase 2 — PlayerDetail adapter.
 *
 * Identity comes from the fan-safe `persons_public` view (migration 00195):
 * name, position, jersey, captain flag, photos.
 *
 * BEST-EFFORT stats/recent: the anon path CANNOT bridge a `persons.id` to its
 * `match_players` rows — that bridge (`person_external_identities`) is not
 * anon-readable, and `match_players` carries no `person_id`. So appearances are
 * matched heuristically on the player's name within the tenant's rosters. Goal
 * / assist counts require `match_timeline` joined through the same missing
 * bridge, so they are intentionally NOT surfaced here (shown as appearances
 * only). This is a recorded limitation, not a bug — see the spec residual risk.
 *
 * HOMONYM GUARD (PRD-055 W1): because the match is name-only, two DIFFERENT
 * people sharing the same first+last name in the fan-visible set would have
 * their appearances merged/inflated. `fetchPlayerDetail` therefore checks
 * whether the name is ambiguous (more than one active person with that exact
 * first+last name in `persons_public`) and, if so, returns `stats: null` so the
 * UI renders a 'stats unavailable' state rather than a wrong/merged count.
 */

export interface PersonPublicRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  jersey_number: number | null;
  is_captain: boolean | null;
  photo_url: string | null;
  photo_detail_url: string | null;
}

export interface PlayerIdentity {
  id: string;
  fullName: string;
  position: string | null;
  jersey: string | null;
  isCaptain: boolean;
  photoUrl: string | null;
}

export interface PlayerAppearanceRow {
  match_id: string | null;
  side: string | null;
  name: string | null;
}

export interface PlayerMatchRow {
  id: string;
  date: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
}

export interface PlayerTeamRow {
  id: string;
  name: string | null;
  short_name: string | null;
}

export interface RecentAppearance {
  matchId: string;
  date: number | null;
  opponent: string;
  result: string | null;
}

export interface PlayerStats {
  appearances: number;
  recent: RecentAppearance[];
}

export interface PlayerDetail {
  identity: PlayerIdentity;
  /**
   * Appearance stats, or `null` when they cannot be safely attributed. Because
   * appearances are matched only by name (the anon path has no id bridge), if
   * more than one fan-visible person shares this exact first+last name the
   * heuristic would merge two people's matches. In that homonym case we return
   * `null` so the UI shows a 'stats unavailable' state instead of a wrong count.
   */
  stats: PlayerStats | null;
}

/** Pure mapper: persons_public row → identity. */
export function toPlayerIdentity(row: PersonPublicRow): PlayerIdentity {
  const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || '—';
  return {
    id: row.id,
    fullName,
    position: row.position || null,
    jersey: row.jersey_number != null ? String(row.jersey_number) : null,
    isCaptain: Boolean(row.is_captain),
    photoUrl: toImageUrl(row.photo_detail_url || row.photo_url || null), // CHANGE-194 Bug 1
  };
}

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Whether a roster name plausibly refers to the given person (token-set match). */
export function nameMatches(first: string | null, last: string | null, rosterName: string | null): boolean {
  if (!rosterName) return false;
  const wanted = [first, last].filter(Boolean).map((s) => normalizeToken(String(s))).filter(Boolean);
  if (wanted.length === 0) return false;
  const got = new Set(rosterName.split(/\s+/).map(normalizeToken).filter(Boolean));
  return wanted.every((w) => got.has(w));
}

/** Pure mapper: appearance rows + match/team lookups → appearance stats. */
export function computePlayerStats(
  appearances: PlayerAppearanceRow[],
  matches: PlayerMatchRow[],
  teams: PlayerTeamRow[],
): PlayerStats {
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const teamName = (id: string | null): string => {
    const t = id ? teams.find((x) => x.id === id) : undefined;
    return t?.short_name || t?.name || '—';
  };

  const recent: RecentAppearance[] = [];
  for (const ap of appearances) {
    const match = ap.match_id ? matchById.get(ap.match_id) : undefined;
    if (!match) continue;
    const isHome = ap.side !== 'guest';
    const opponent = teamName(isHome ? match.away_team_id : match.home_team_id);
    let result: string | null = null;
    if (typeof match.home_score === 'number' && typeof match.away_score === 'number') {
      result = isHome
        ? `${match.home_score}:${match.away_score}`
        : `${match.away_score}:${match.home_score}`;
    }
    recent.push({ matchId: match.id, date: match.date, opponent, result });
  }
  recent.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));

  return { appearances: appearances.length, recent: recent.slice(0, 8) };
}

/** Fetch the player's identity + best-effort appearance stats. Null when absent. */
export async function fetchPlayerDetail(
  supabase: SupabaseLike,
  tenantId: string,
  personId: string,
): Promise<PlayerDetail | null> {
  const persons = unwrap<PersonPublicRow[]>(
    await supabase
      .from('persons_public')
      .select('id,first_name,last_name,position,jersey_number,is_captain,photo_url,photo_detail_url')
      .eq('id', personId)
      .limit(1),
  );
  const person = persons[0];
  if (!person) return null;
  const identity = toPlayerIdentity(person);

  // Homonym guard (W1): if more than one fan-visible person shares this exact
  // first+last name, name-only appearance matching cannot be attributed to THIS
  // person — suppress stats rather than show a merged/inflated count. When the
  // name is incomplete we cannot name-match at all, so stats are also unavailable.
  const first = (person.first_name ?? '').trim();
  const last = (person.last_name ?? '').trim();
  if (!first || !last) {
    return { identity, stats: null };
  }
  const sameName = unwrap<{ id: string }[]>(
    await supabase
      .from('persons_public')
      .select('id')
      .ilike('first_name', first)
      .ilike('last_name', last)
      .limit(5),
  );
  if (sameName.length > 1) {
    return { identity, stats: null };
  }

  // Best-effort appearances: roster rows in the tenant whose name matches.
  const rosterRows = unwrap<PlayerAppearanceRow[]>(
    await supabase
      .from('match_players')
      .select('match_id,side,name')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${person.last_name ?? ''}%`)
      .limit(200),
  );
  const appearances = rosterRows.filter((r) =>
    nameMatches(person.first_name, person.last_name, r.name),
  );

  let matches: PlayerMatchRow[] = [];
  let teams: PlayerTeamRow[] = [];
  const matchIds = [...new Set(appearances.map((a) => a.match_id).filter(Boolean))] as string[];
  if (matchIds.length > 0) {
    matches = unwrap<PlayerMatchRow[]>(
      await supabase
        .from('matches')
        .select('id,date,home_team_id,away_team_id,home_score,away_score')
        .in('id', matchIds),
    );
    const teamIds = [
      ...new Set(
        matches.flatMap((m) => [m.home_team_id, m.away_team_id]).filter(Boolean),
      ),
    ] as string[];
    if (teamIds.length > 0) {
      teams = unwrap<PlayerTeamRow[]>(
        await supabase.from('teams').select('id,name,short_name').in('id', teamIds),
      );
    }
  }

  return { identity, stats: computePlayerStats(appearances, matches, teams) };
}
