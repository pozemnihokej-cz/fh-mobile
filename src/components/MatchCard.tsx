import { MatchCard as UIMatchCard } from '@fh/ui';

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
  score?: { home?: number; away?: number };
  liveState?: { phase?: string };
}

export function MatchCard({
  match,
  isStarred,
  onToggleStar,
  onClick,
}: {
  match: MatchCardData;
  isStarred: boolean;
  onToggleStar: (e: React.MouseEvent) => void;
  onClick: () => void;
}): JSX.Element {
  return (
    <UIMatchCard
      home={{ name: match.homeClubName ?? match.homeTeamName, logo: match.homeClubLogo ?? match.homeTeamLogo }}
      away={{ name: match.awayClubName ?? match.awayTeamName, logo: match.awayClubLogo ?? match.awayTeamLogo }}
      league={match.leagueName}
      location={match.location}
      date={match.date}
      status={match.status}
      score={match.score}
      phase={match.liveState?.phase}
      starred={isStarred}
      onToggleStar={onToggleStar}
      onClick={onClick}
    />
  );
}
