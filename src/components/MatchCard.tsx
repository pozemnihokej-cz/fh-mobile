import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Chip, IconButton, Grid, Avatar } from '@mui/material';
import { Star as StarIcon, StarBorder as StarBorderIcon } from '@mui/icons-material';

/**
 * CHANGE-055: extracted from App.tsx in this tick so MatchesPage can use it
 * without importing the legacy single-page App component. Pure presentation —
 * no Convex/Supabase reads here, all data is passed in.
 */
export interface MatchCardData {
  _id: string;
  supabaseId: string;
  homeTeamName: string;
  awayTeamName: string;
  /**
   * CHANGE-063 2026-06-06: parent club name when the team is linked
   * to a club (csph teams carry the category in the name, e.g.
   * "Litice ženy"). The display prefers `homeClubName ?? homeTeamName`
   * because the league/competition row is rendered next to the
   * matchup — showing the category in both places is duplicate.
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
  const matchDateStr = useMemo(() => {
    const d = new Date(match.date);
    return d.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [match.date]);

  const isLive = match.status === 'live';

  return (
    <Card
      onClick={onClick}
      sx={{
        mb: 2,
        bgcolor: isLive ? 'rgba(255, 23, 68, 0.04)' : 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        border: isLive
          ? '1px solid rgba(255, 23, 68, 0.2)'
          : '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
      }}
    >
      <CardContent sx={{ p: '16px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
            {match.leagueName || 'Soutěž'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isLive ? (
              <Chip
                label="ŽIVĚ"
                size="small"
                sx={{ bgcolor: '#ff1744', color: '#ffffff', fontWeight: 900, fontSize: '10px', height: '20px' }}
              />
            ) : (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                {matchDateStr}
              </Typography>
            )}
            <IconButton
              size="small"
              onClick={onToggleStar}
              sx={{ color: isStarred ? '#4caf50' : 'rgba(255,255,255,0.3)' }}
            >
              {isStarred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        <Grid container spacing={1} alignItems="center" sx={{ my: 1 }}>
          <Grid item xs={5} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Avatar src={(match.homeClubLogo ?? match.homeTeamLogo) || undefined} sx={{ width: 44, height: 44, mb: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
              {(match.homeClubName ?? match.homeTeamName)[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>
              {match.homeClubName ?? match.homeTeamName}
            </Typography>
          </Grid>

          <Grid item xs={2} sx={{ textAlign: 'center' }}>
            {isLive ? (
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#ffffff', letterSpacing: '-1px' }}>
                  {match.score?.home ?? 0} : {match.score?.away ?? 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 700, display: 'block', mt: 0.5 }}>
                  {match.liveState?.phase || 'Běží'}
                </Typography>
              </Box>
            ) : match.status === 'completed' ? (
              <Typography variant="h6" sx={{ fontWeight: 900, color: 'rgba(255,255,255,0.8)' }}>
                {match.score?.home ?? 0} : {match.score?.away ?? 0}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                VS
              </Typography>
            )}
          </Grid>

          <Grid item xs={5} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Avatar src={(match.awayClubLogo ?? match.awayTeamLogo) || undefined} sx={{ width: 44, height: 44, mb: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
              {(match.awayClubName ?? match.awayTeamName)[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>
              {match.awayClubName ?? match.awayTeamName}
            </Typography>
          </Grid>
        </Grid>

        {match.location && (
          <Box sx={{ mt: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)', pt: 1, display: 'flex', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
              {match.location}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
