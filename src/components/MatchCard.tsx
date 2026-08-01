import { MatchCard as UIMatchCard } from '@fh/ui';
import { isMatchGenuinelyLive } from '@fh/schema';
import { toImageUrl } from '../lib/runtimeUrls';

/**
 * CHANGE-055 / mobile DS adoption: the styled presentation now lives in
 * `@fh/ui` (MatchCard). This module keeps the app-facing Convex row shape
 * (`MatchCardData`) and maps it onto the design-system component's
 * presentation props — including the club-over-team name/logo preference
 * (CHANGE-063).
 */
export interface MatchCardData {
  _id: string;
  supabaseId: string;
  homeTeamName: string;
  awayTeamName: string;
  /**
   * CHANGE-063 2026-06-06: parent club name when the team is linked to a club
   * (csph teams carry the category in the name, e.g. "Litice ženy"). Display
   * prefers `homeClubName ?? homeTeamName` because the competition row is
   * rendered next to the matchup — showing the category twice is duplicate.
   */
  homeClubName?: string | null;
  awayClubName?: string | null;
  homeClubLogo?: string | null;
  awayClubLogo?: string | null;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  leagueName?: string | null;
  location?: string | null;
  date: number;
  status: 'scheduled' | 'live' | 'completed' | string;
  /**
   * Actual kickoff (ms epoch) surfaced by Convex `matches.list` /
   * `getBySupabaseId` from `liveMatchState.started`. Drives the shared
   * `@fh/schema` liveness derivation (fan-app-live-status-derivation).
   */
  startedAt?: number | null;
  score?: { home?: number; away?: number };
  liveState?: { phase?: string };
}

export function MatchCard({
  match,
  isStarred,
  onToggleStar,
  onClick,
  compact = false,
}: {
  match: MatchCardData;
  isStarred: boolean;
  onToggleStar: (e: React.MouseEvent) => void;
  onClick: () => void;
  /** CHANGE-194 Bug 2 — render the dense two-row list card. */
  compact?: boolean;
}): JSX.Element {
  // Derive genuine liveness the SAME way OM does (shared @fh/schema derivation):
  // the Supabase→Convex mirror only writes `in_progress` — never `live` — so a
  // literal status check would never light the badge (fan-app-live-status-derivation).
  const live = isMatchGenuinelyLive({
    status: match.status,
    scheduledDate: match.date,
    startedAt: match.startedAt,
    now: Date.now(),
  });
  return (
    <UIMatchCard
      home={{
        name: match.homeClubName ?? match.homeTeamName,
        // CHANGE-194 Bug 1 — resolve stored /storage/v1/assets/… paths to a
        // proxied public-object URL so real crests render (was raw → 404).
        logo: toImageUrl(match.homeClubLogo ?? match.homeTeamLogo),
      }}
      away={{
        name: match.awayClubName ?? match.awayTeamName,
        logo: toImageUrl(match.awayClubLogo ?? match.awayTeamLogo),
      }}
      league={match.leagueName}
      location={match.location}
      date={match.date}
      status={match.status}
      live={live}
      score={match.score}
      phase={match.liveState?.phase}
      starred={isStarred}
      onToggleStar={onToggleStar}
      onClick={onClick}
      compact={compact}
    />
  );
}
