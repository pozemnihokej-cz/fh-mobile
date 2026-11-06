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

/** A one-team event (the same team row on both sides) is shown as that team alone. */
export function isFanSingleTeam(match: Pick<FanResultFields, 'homeTeamId' | 'awayTeamId'>): boolean {
  return isSingleTeamMatch(match.homeTeamId, match.awayTeamId);
}
