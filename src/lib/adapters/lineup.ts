import { unwrap, type SupabaseLike } from './supabaseRead';

/**
 * PRD-055 Phase 2 — Lineup adapter. Reads the already-anon `match_players`
 * roster for a match and splits it into the two sides (home / guest). Coaches
 * are surfaced separately from the on-field players.
 */

export interface MatchPlayerRow {
  id: string;
  name: string | null;
  jersey_number: string | null;
  position: string | null;
  role: string | null;
  side: string | null;
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
    id: row.id,
    name: row.name || '—',
    jersey: row.jersey_number || null,
    position: row.position || null,
    isCaptain: row.role === 'captain',
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

/** Pure mapper: roster rows → per-side, sorted lineups. */
export function groupLineup(rows: MatchPlayerRow[]): Lineup {
  const home: LineupPlayer[] = [];
  const guest: LineupPlayer[] = [];
  for (const r of rows) {
    const player = toPlayer(r);
    if (r.side === 'guest') guest.push(player);
    else home.push(player); // default any non-guest side to home
  }
  home.sort(sortPlayers);
  guest.sort(sortPlayers);
  return { home, guest };
}

/** Fetch the roster for a match and split it into sides. */
export async function fetchLineup(
  supabase: SupabaseLike,
  matchId: string,
): Promise<Lineup> {
  const rows = unwrap<MatchPlayerRow[]>(
    await supabase
      .from('match_players')
      .select('id,name,jersey_number,position,role,side')
      .eq('match_id', matchId),
  );
  return groupLineup(rows);
}
