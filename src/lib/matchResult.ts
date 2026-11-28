import { completedReadModelScore, isSingleTeamMatch, type FinalScore, type ReadModelResultFields } from '@fh/schema';

/**
 * spec-match-display-no-score-one-team-shootout D5 — the fan app's view of the
 * shared `@fh/schema` read-model rule: a completed match shows the timeline
 * score when it was run in online management, the mirrored Postgres result
 * otherwise, and NO score (null) when that result is NULL — never 0:0.
 */
export interface FanResultFields extends ReadModelResultFields {
  status: string;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
}

export type FanScore = FinalScore;

/** The completed match's score, or null when it was played without one. */
export function completedFanScore(
  match: FanResultFields,
  timeline?: { home: number; away: number },
): FanScore | null {
  return completedReadModelScore(match, timeline);
}

/**
 * spec-fan-live-score-header-card-mismatch D1 — the ONE score a live or
 * in-progress match shows on the fan match detail: the sticky header and the
 * scoreboard card both render it, so they cannot disagree.
 *
 * `matches.getBySupabaseId` counts every recorded goal row of the timeline
 * (no clock). The card used to recount with the playing clock
 * (`deriveTimelineState`), which hides a goal whose stored time is ahead of
 * the clock — PROD match 80129 (2026-11-28): a goal stamped at 346.98 s while the
 * clock read 296–325 s, header 2 : 2, card 1 : 2 for six minutes.
 */
export function liveFanScore(match: {
  homeScore?: number | null;
  awayScore?: number | null;
}): { home: number; away: number } {
  return { home: match.homeScore ?? 0, away: match.awayScore ?? 0 };
}

/** A one-team event (the same team row on both sides) is shown as that team alone. */
export function isFanSingleTeam(match: Pick<FanResultFields, 'homeTeamId' | 'awayTeamId'>): boolean {
  return isSingleTeamMatch(match.homeTeamId, match.awayTeamId);
}
