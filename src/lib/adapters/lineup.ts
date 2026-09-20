import { unwrap, type SupabaseLike } from './supabaseRead';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@convex/_generated/api';
import { resolveSiblingUrl } from '../runtimeUrls';

/**
 * PRD-055 Phase 2 — Lineup adapter. Reads the already-anon `match_players`
 * roster for a match and splits it into the two sides (home / guest). Coaches
 * are surfaced separately from the on-field players.
 */

export interface MatchPlayerRow {
  id?: string;
  _id?: string;
  name?: string | null;
  jersey_number?: string | null;
  jerseyNumber?: string | null;
  position?: string | null;
  role?: string | null;
  side?: string | null;
}

export interface LineupPlayer {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  isCaptain: boolean;
  isCoach: boolean;
}

export interface Lineup {
  home: LineupPlayer[];
  guest: LineupPlayer[];
}

function toPlayer(row: MatchPlayerRow): LineupPlayer {
  return {
    id: row._id || row.id || '',
    name: row.name || '—',
    jersey: row.jerseyNumber || row.jersey_number || null,
    position: row.position || null,
    isCaptain: row.role === 'captain' || row.role === 'Captain' || row.role === 'C',
    isCoach: row.role === 'coach',
  };
}

function sortPlayers(a: LineupPlayer, b: LineupPlayer): number {
  // Coaches last; captains first; then by jersey number, then name.
  if (a.isCoach !== b.isCoach) return a.isCoach ? 1 : -1;
  if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1;
  const ja = Number(a.jersey);
  const jb = Number(b.jersey);
  const aNum = Number.isFinite(ja);
  const bNum = Number.isFinite(jb);
  if (aNum && bNum && ja !== jb) return ja - jb;
  if (aNum !== bNum) return aNum ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/** Pure mapper: roster rows → per-side, sorted lineups. Supports both Supabase and Convex shapes. */
export function groupLineup(rows: MatchPlayerRow[]): Lineup {
  const home: LineupPlayer[] = [];
  const guest: LineupPlayer[] = [];
  for (const r of rows) {
    if (r.role === 'referee' || r.role === 'Official' || r.side === 'neutral') continue;
    const player = toPlayer(r);
    const rawSide = String(r.side ?? '').toLowerCase().trim();
    if (rawSide === 'guest' || rawSide === 'away' || rawSide === 'host' || rawSide === 'hoste') {
      guest.push(player);
    } else {
      home.push(player); // default any non-guest side to home
    }
  }
  home.sort(sortPlayers);
  guest.sort(sortPlayers);
  return { home, guest };
}

/** Fetch the roster for a match and split it into sides. Supports Supabase and Convex. */
export async function fetchLineup(
  supabase: SupabaseLike,
  matchId: string,
): Promise<Lineup> {
  // First attempt: Supabase PostgREST
  try {
    const rows = unwrap<MatchPlayerRow[]>(
      await supabase
        .from('match_players')
        .select('id,name,jersey_number,position,role,side')
        .eq('match_id', matchId),
    );
    if (rows && rows.length > 0) {
      return groupLineup(rows);
    }
  } catch {
    // Continue to Convex fallback
  }

  // Second attempt: Convex HTTP client (when PostgREST is empty or offline)
  try {
    const convexUrl = resolveSiblingUrl('fh-convex', import.meta.env.VITE_CONVEX_URL, 'http://localhost:3210');
    const client = new ConvexHttpClient(convexUrl);
    const rows = await client.query(api.functions.roster.list, { matchId });
    if (rows && rows.length > 0) {
      return groupLineup(rows as any);
    }
  } catch {
    // Continue to third attempt
  }

  // Third attempt: Fallback to teams' known rosters for scheduled / upcoming matches
  // where an official match sheet has not yet been submitted.
  try {
    const matchRes = await supabase
      .from('matches')
      .select('home_team_id,away_team_id')
      .eq('id', matchId)
      .maybeSingle();
    const matchRow = unwrap<{ home_team_id?: string; away_team_id?: string }>(matchRes);
    if (matchRow?.home_team_id || matchRow?.away_team_id) {
      const teamIds = [matchRow.home_team_id, matchRow.away_team_id].filter(Boolean) as string[];
      if (teamIds.length > 0) {
        const teamPlayers = unwrap<Array<MatchPlayerRow & { team_id?: string }>>(
          await supabase
            .from('match_players')
            .select('id,name,jersey_number,position,role,team_id')
            .in('team_id', teamIds)
            .order('created_at', { ascending: false })
            .limit(120),
        );
        if (teamPlayers && teamPlayers.length > 0) {
          const seenHome = new Set<string>();
          const seenGuest = new Set<string>();
          const syntheticRows: MatchPlayerRow[] = [];

          for (const tp of teamPlayers) {
            if (!tp.name) continue;
            const isHome = tp.team_id === matchRow.home_team_id;
            const seen = isHome ? seenHome : seenGuest;
            if (seen.has(tp.name)) continue;
            seen.add(tp.name);
            syntheticRows.push({
              ...tp,
              side: isHome ? 'home' : 'guest',
            });
          }
          if (syntheticRows.length > 0) {
            return groupLineup(syntheticRows);
          }
        }
      }
    }
  } catch {
    // All attempts failed
  }

  return { home: [], guest: [] };
}

