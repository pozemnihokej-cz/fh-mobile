import { isGoalkeeper } from '@fh/schema';
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
  image?: string | null;
}

export interface LineupPlayer {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  isCaptain: boolean;
  isCoach: boolean;
  /** Canonical `@fh/schema` goalkeeper classification over role and position. */
  isGoalkeeper: boolean;
  /** A field player or goalkeeper; false for coaches, staff, officials, referees. */
  isPlayer: boolean;
  image?: string | null;
  side?: 'home' | 'guest' | 'away';
}

export interface Lineup {
  home: LineupPlayer[];
  guest: LineupPlayer[];
  /** Match referees (role `referee`), one entry per person, in roster order. */
  referees: LineupPlayer[];
}

/** Roles that make a roster row a player; every other role is staff. */
const PLAYER_ROLES = new Set(['', 'player', 'captain', 'c']);

function normRole(role: unknown): string {
  return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

function isPlayerRow(row: MatchPlayerRow): boolean {
  const r = normRole(row.role);
  if (PLAYER_ROLES.has(r)) return true;
  return isGoalkeeper({ role: r });
}

/**
 * Match-official roles. `official` is the same dialect OM (useRoster.ts,
 * MatchSettingsPage.tsx), fh-evidence (MatchDetailPage.tsx) and Convex
 * (_matchReadiness.ts) already read as a referee.
 */
const REFEREE_ROLES = new Set(['referee', 'official']);

export function isRefereeRow(row: MatchPlayerRow): boolean {
  return REFEREE_ROLES.has(normRole(row.role));
}

export interface RosterCount {
  field: number;
  goalkeepers: number;
}

/** Count field players and goalkeepers; non-player roles change neither number. */
export function countRosterPlayers(players: LineupPlayer[]): RosterCount {
  let field = 0;
  let goalkeepers = 0;
  for (const p of players) {
    if (!p.isPlayer) continue;
    if (p.isGoalkeeper) goalkeepers += 1;
    else field += 1;
  }
  return { field, goalkeepers };
}

/** `(F+G)` for a side with at least one player, otherwise null (no misleading zero). */
export function formatRosterCount(players: LineupPlayer[]): string | null {
  const { field, goalkeepers } = countRosterPlayers(players);
  if (field + goalkeepers === 0) return null;
  return `(${field}+${goalkeepers})`;
}

export function isGuestSide(side: unknown): boolean {
  if (!side) return false;
  const s = String(side)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  return s === 'guest' || s === 'away' || s.startsWith('host') || s === 'g' || s === 'a';
}

function toPlayer(row: MatchPlayerRow): LineupPlayer {
  const isGuest = isGuestSide(row.side);
  return {
    id: row._id || row.id || '',
    name: row.name || '—',
    jersey: row.jerseyNumber || row.jersey_number || null,
    position: row.position || null,
    isCaptain: row.role === 'captain' || row.role === 'Captain' || row.role === 'C',
    isCoach: row.role === 'coach',
    isGoalkeeper: isGoalkeeper({ role: row.role, position: row.position }),
    isPlayer: isPlayerRow(row),
    image: row.image || (row as any).photoUrl || (row as any).photo_url || (row as any).imageUrl || (row as any).playerImage || null,
    side: isGuest ? 'guest' : 'home',
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
  const referees: LineupPlayer[] = [];
  const seenReferees = new Set<string>();
  for (const r of rows) {
    if (isRefereeRow(r)) {
      // A nameless row has no identity to show, so it is dropped rather than
      // merged with other nameless rows into one blank entry. The same person
      // delegated twice arrives as two rows; show them once.
      const key = (r.name ?? '').trim().toLowerCase();
      if (!key) continue;
      if (!seenReferees.has(key)) {
        seenReferees.add(key);
        referees.push(toPlayer(r));
      }
      continue;
    }
    if (r.side === 'neutral') continue;
    const player = toPlayer(r);
    if (isGuestSide(r.side)) {
      guest.push(player);
    } else {
      home.push(player); // default any non-guest side to home
    }
  }
  home.sort(sortPlayers);
  guest.sort(sortPlayers);
  return { home, guest, referees };
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
        .select('id,name,jersey_number,position,role,side,image')
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
            .select('id,name,jersey_number,position,role,team_id,image')
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

  return { home: [], guest: [], referees: [] };
}

