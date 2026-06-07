import React, { useMemo } from 'react';
import { Box, Card, CardContent, Typography, Chip, IconButton, Grid, Avatar, useTheme, alpha } from '@mui/material';
import { Star as StarIcon, StarBorder as StarBorderIcon } from '@mui/icons-material';

/**
 * CHANGE-055: extracted from App.tsx; reused by MatchesPage.
 * Overhauled with fancy GUI during the premium mobile project.
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
  const theme = useTheme();
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
        bgcolor: isLive ? alpha(theme.palette.error.main, 0.05) : alpha(theme.palette.common.white, 0.03),
        borderRadius: '24px',
        border: isLive
          ? `1px solid ${alpha(theme.palette.error.main, 0.3)}`
          : `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
        backdropFilter: 'blur(10px)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease',
        cursor: 'pointer',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 40px ${alpha(theme.palette.common.black, 0.4)}`,
          borderColor: isLive ? alpha(theme.palette.error.main, 0.5) : alpha(theme.palette.primary.main, 0.3),
        },
      }}
    >
      <CardContent sx={{ p: '20px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.05em' }}>
            {match.leagueName || 'LIGA'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isLive ? (
              <Chip
                label="ŽIVĚ"
                size="small"
                sx={{
                  bgcolor: 'error.main',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '10px',
                  height: '20px',
                  boxShadow: `0 0 12px ${alpha(theme.palette.error.main, 0.5)}`,
                }}
              />
            ) : (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                {matchDateStr}
              </Typography>
            )}

            <IconButton size="small" onClick={onToggleStar} sx={{ color: isStarred ? 'primary.main' : alpha(theme.palette.common.white, 0.2) }}>
              {isStarred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        <Grid container spacing={2} alignItems="center">
          <Grid item xs={4.5} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Avatar
              src={(match.homeClubLogo ?? match.homeTeamLogo) || undefined}
              sx={{
                width: 52,
                height: 52,
                mb: 1.5,
                bgcolor: alpha(theme.palette.common.white, 0.05),
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
              }}
            >
              {(match.homeClubName ?? match.homeTeamName)[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff', lineHeight: 1.2 }}>
              {match.homeClubName ?? match.homeTeamName}
            </Typography>
          </Grid>

          <Grid item xs={3} sx={{ textAlign: 'center' }}>
            {isLive ? (
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>
                  {match.score?.home ?? 0} : {match.score?.away ?? 0}
                </Typography>
                <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, textTransform: 'uppercase', mt: 0.5, display: 'block' }}>
                  {match.liveState?.phase || 'Běží'}
                </Typography>
              </Box>
            ) : match.status === 'completed' ? (
              <Typography variant="h5" sx={{ fontWeight: 900, color: alpha(theme.palette.common.white, 0.8) }}>
                {match.score?.home ?? 0} : {match.score?.away ?? 0}
              </Typography>
            ) : (
              <Box sx={{ px: 1, py: 0.5, bgcolor: alpha(theme.palette.common.white, 0.05), borderRadius: '8px' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900 }}>
                  VS
                </Typography>
              </Box>
            )}
          </Grid>

          <Grid item xs={4.5} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Avatar
              src={(match.awayClubLogo ?? match.awayTeamLogo) || undefined}
              sx={{
                width: 52,
                height: 52,
                mb: 1.5,
                bgcolor: alpha(theme.palette.common.white, 0.05),
                boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
              }}
            >
              {(match.awayClubName ?? match.awayTeamName)[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 900, fontSize: '0.9rem', color: '#fff', lineHeight: 1.2 }}>
              {match.awayClubName ?? match.awayTeamName}
            </Typography>
          </Grid>
        </Grid>

        {match.location && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${alpha(theme.palette.common.white, 0.05)}`, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" sx={{ color: alpha(theme.palette.text.secondary, 0.5), fontWeight: 600 }}>
              {match.location}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
