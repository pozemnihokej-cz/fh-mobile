import { unwrap, type SupabaseLike } from './supabaseRead';
import { toImageUrl } from '../runtimeUrls';

/**
 * PRD-055 Phase 2 — Schedule adapter. Fixtures come from the already-anon
 * `matches` table, joined to `teams` for names/crests and grouped by calendar
 * day (matching the showcase Schedule card).
 */

export interface ScheduleMatchRow {
  id: string;
  date: number | null;
  status: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
}

export interface ScheduleTeamRow {
  id: string;
  name: string | null;
  short_name: string | null;
  logo_url: string | null;
}

export interface ScheduleSide {
  name: string;
  logoUrl: string | null;
}

export interface ScheduleMatch {
  id: string;
  date: number;
  status: string;
  time: string;
  home: ScheduleSide;
  away: ScheduleSide;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ScheduleDay {
  key: string;
  label: string;
  matches: ScheduleMatch[];
}

function teamSide(
  id: string | null,
  byId: Map<string, ScheduleTeamRow>,
): ScheduleSide {
  const t = id ? byId.get(id) : undefined;
  // CHANGE-194 Bug 1 — resolve stored storage paths to a proxied public URL.
  return { name: t?.short_name || t?.name || '—', logoUrl: toImageUrl(t?.logo_url ?? null) };
}

const dayFmt = new Intl.DateTimeFormat('cs-CZ', {
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('cs-CZ', { hour: '2-digit', minute: '2-digit' });
const dayKeyFmt = new Intl.DateTimeFormat('en-CA'); // YYYY-MM-DD, stable grouping key

/**
 * Pure mapper: matches + teams-by-id → day-grouped fixtures, ascending by date.
 */
export function groupMatchesByDay(
  matches: ScheduleMatchRow[],
  teams: ScheduleTeamRow[],
): ScheduleDay[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const withDate = matches.filter((m): m is ScheduleMatchRow & { date: number } =>
    typeof m.date === 'number',
  );
  withDate.sort((a, b) => a.date - b.date);

  const days = new Map<string, ScheduleDay>();
  for (const m of withDate) {
    const d = new Date(m.date);
    const key = dayKeyFmt.format(d);
    let day = days.get(key);
    if (!day) {
      day = { key, label: dayFmt.format(d), matches: [] };
      days.set(key, day);
    }
    day.matches.push({
      id: m.id,
      date: m.date,
      status: m.status ?? 'scheduled',
      time: timeFmt.format(d),
      home: teamSide(m.home_team_id, byId),
      away: teamSide(m.away_team_id, byId),
      homeScore: m.home_score,
      awayScore: m.away_score,
    });
  }
  return [...days.values()];
}

/** Fetch the tenant's fixtures + teams and group them by day. */
export async function fetchSchedule(
  supabase: SupabaseLike,
  tenantId: string,
): Promise<ScheduleDay[]> {
  const matches = unwrap<ScheduleMatchRow[]>(
    await supabase
      .from('matches')
      .select('id,date,status,home_team_id,away_team_id,home_score,away_score')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true })
      .limit(200),
  );
  const teams = unwrap<ScheduleTeamRow[]>(
    await supabase.from('teams').select('id,name,short_name,logo_url').eq('tenant_id', tenantId),
  );
  return groupMatchesByDay(matches, teams);
}
