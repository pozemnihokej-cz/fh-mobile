import { unwrap, type SupabaseLike } from './supabaseRead';
import { toImageUrl } from '../runtimeUrls';

/**
 * PRD-055 Phase 2 — ClubDetail adapter. Composes the already-anon `clubs`,
 * `teams` and `matches` tables into a club profile: identity, its teams, and
 * the club's fixtures.
 */

export interface ClubRow {
  id: string;
  official_name: string | null;
  short_name: string | null;
  marketing_name: string | null;
  logo_url: string | null;
  web: string | null;
}

export interface ClubTeamRow {
  id: string;
  name: string | null;
  short_name: string | null;
  logo_url: string | null;
  category: string | null;
  gender: string | null;
}

export interface ClubMatchRow {
  id: string;
  date: number | null;
  status: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
}

export interface ClubTeam {
  id: string;
  name: string;
  logoUrl: string | null;
  category: string | null;
}

export interface ClubFixture {
  id: string;
  date: number | null;
  status: string;
  homeName: string;
  awayName: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ClubDetail {
  id: string;
  name: string;
  logoUrl: string | null;
  web: string | null;
  teams: ClubTeam[];
  fixtures: ClubFixture[];
}

/** Pure mapper: raw club + teams + matches → the ClubDetail presentation shape. */
export function toClubDetail(
  club: ClubRow,
  teams: ClubTeamRow[],
  matches: ClubMatchRow[],
): ClubDetail {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamName = (id: string | null): string => {
    const t = id ? teamById.get(id) : undefined;
    return t?.short_name || t?.name || '—';
  };
  const mappedTeams: ClubTeam[] = teams
    .map((t) => ({
      id: t.id,
      name: t.short_name || t.name || '—',
      logoUrl: toImageUrl(t.logo_url), // CHANGE-194 Bug 1
      category: t.category || t.gender || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const fixtures: ClubFixture[] = matches
    .slice()
    .sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
    .map((m) => ({
      id: m.id,
      date: m.date,
      status: m.status ?? 'scheduled',
      homeName: teamName(m.home_team_id),
      awayName: teamName(m.away_team_id),
      homeScore: m.home_score,
      awayScore: m.away_score,
    }));

  return {
    id: club.id,
    name: club.marketing_name || club.short_name || club.official_name || '—',
    logoUrl: toImageUrl(club.logo_url), // CHANGE-194 Bug 1
    web: club.web,
    teams: mappedTeams,
    fixtures,
  };
}

/** Fetch a club, its teams and their fixtures. Returns null when not found. */
export async function fetchClubDetail(
  supabase: SupabaseLike,
  clubId: string,
): Promise<ClubDetail | null> {
  const clubs = unwrap<ClubRow[]>(
    await supabase
      .from('clubs')
      .select('id,official_name,short_name,marketing_name,logo_url,web')
      .eq('id', clubId)
      .limit(1),
  );
  const club = clubs[0];
  if (!club) return null;

  const teams = unwrap<ClubTeamRow[]>(
    await supabase
      .from('teams')
      .select('id,name,short_name,logo_url,category,gender')
      .eq('club_id', clubId),
  );

  const teamIds = teams.map((t) => t.id);
  let matches: ClubMatchRow[] = [];
  if (teamIds.length > 0) {
    const idList = `(${teamIds.join(',')})`;
    matches = unwrap<ClubMatchRow[]>(
      await supabase
        .from('matches')
        .select('id,date,status,home_team_id,away_team_id,home_score,away_score')
        .or(`home_team_id.in.${idList},away_team_id.in.${idList}`)
        .order('date', { ascending: false })
        .limit(30),
    );
  }

  return toClubDetail(club, teams, matches);
}
