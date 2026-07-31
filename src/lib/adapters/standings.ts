import { unwrap, type SupabaseLike } from './supabaseRead';
import { toImageUrl } from '../runtimeUrls';

/**
 * PRD-055 Phase 2 — Standings adapter. The fan Standings table is COMPUTED
 * from the already-anon `matches` + `teams` tables (no dedicated standings
 * source exists). A match contributes to the table only once it has a result
 * (both scores present); scheduled/undecided games are ignored.
 */

export interface StandingMatchRow {
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
}

export interface StandingTeamRow {
  id: string;
  name: string | null;
  short_name: string | null;
  logo_url: string | null;
}

export interface StandingRow {
  teamId: string;
  name: string;
  logoUrl: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

const WIN_POINTS = 3;
const DRAW_POINTS = 1;

/**
 * Pure row → presentation mapper: fold played matches into a ranked table.
 * Ranked by points, then goal difference, then goals scored, then name.
 */
export function computeStandings(
  matches: StandingMatchRow[],
  teams: StandingTeamRow[],
): StandingRow[] {
  const byId = new Map<string, StandingRow>();
  for (const t of teams) {
    byId.set(t.id, {
      teamId: t.id,
      name: t.short_name || t.name || '—',
      logoUrl: toImageUrl(t.logo_url), // CHANGE-194 Bug 1
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (m.home_team_id == null || m.away_team_id == null) continue;
    if (typeof m.home_score !== 'number' || typeof m.away_score !== 'number') continue;
    const home = byId.get(m.home_team_id);
    const away = byId.get(m.away_team_id);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += m.home_score;
    home.goalsAgainst += m.away_score;
    away.goalsFor += m.away_score;
    away.goalsAgainst += m.home_score;

    if (m.home_score > m.away_score) {
      home.wins += 1;
      home.points += WIN_POINTS;
      away.losses += 1;
    } else if (m.home_score < m.away_score) {
      away.wins += 1;
      away.points += WIN_POINTS;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += DRAW_POINTS;
      away.points += DRAW_POINTS;
    }
  }

  return [...byId.values()]
    .filter((r) => r.played > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.name.localeCompare(b.name);
    });
}

/** Fetch the played matches + teams for a tenant and compute the table. */
export async function fetchStandings(
  supabase: SupabaseLike,
  tenantId: string,
): Promise<StandingRow[]> {
  const matches = unwrap<StandingMatchRow[]>(
    await supabase
      .from('matches')
      .select('home_team_id,away_team_id,home_score,away_score')
      .eq('tenant_id', tenantId),
  );
  const teams = unwrap<StandingTeamRow[]>(
    await supabase
      .from('teams')
      .select('id,name,short_name,logo_url')
      .eq('tenant_id', tenantId),
  );
  return computeStandings(matches, teams);
}
