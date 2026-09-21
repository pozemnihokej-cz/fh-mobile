import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Box, Container, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, FhIcon, focusRing } from '@fh/ui';
import { isMatchGenuinelyLive } from '@fh/schema';
import { MatchDetailView } from '../components/MatchDetailView';
import { useFanPreferences } from '../lib/useFanPreferences';

/**
 * CHANGE-055 Spec-AC-07: `/<slug>/matches/<matchId>` direct deep link.
 *
 * Wraps the existing MatchDetailView, reads `matchId` from `useParams`,
 * and renders a back affordance that navigates to the parent list (NOT
 * the picker — browser back from the detail goes to `/<slug>/matches`).
 */
export default function MatchDetailPage(): JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const theme = useTheme();
  const { isMatchSaved, toggleMatch } = useFanPreferences();

  const match = useQuery(api.functions.matches.getBySupabaseId, matchId ? { supabaseId: matchId } : 'skip');

  if (!matchId) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'common.white', p: 4 }}>
        <Typography>Chybí ID zápasu.</Typography>
      </Box>
    );
  }

  const isLive = match
    ? isMatchGenuinelyLive({
        status: match.status,
        scheduledDate: match.date,
        startedAt: match.startedAt,
        now: Date.now(),
      })
    : false;

  const isPlayedOrLive = match ? isLive || match.status === 'completed' || match.status === 'in_progress' : false;
  const homeName = match?.homeClubName ?? match?.homeTeamName ?? 'Domácí';
  const awayName = match?.awayClubName ?? match?.awayTeamName ?? 'Hosté';
  const hasScore = match && (match.homeScore != null || match.awayScore != null);
  const scoreStr = hasScore ? `${match.homeScore ?? 0} : ${match.awayScore ?? 0}` : '0 : 0';

  const headerTitle = match ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Typography variant="body1" noWrap sx={{ fontWeight: 800, color: 'common.white', fontSize: { xs: '0.88rem', sm: '0.98rem' } }}>
        {homeName}
      </Typography>
      {isPlayedOrLive ? (
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: { xs: '0.88rem', sm: '1rem' },
            color: isLive ? 'error.main' : 'primary.main',
            px: 0.75,
            py: 0.1,
            bgcolor: isLive ? alpha(theme.palette.error.main, 0.15) : alpha(theme.palette.primary.main, 0.15),
            borderRadius: '6px',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {scoreStr}
        </Typography>
      ) : (
        <Typography sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.8rem', mx: 0.25 }}>
          vs
        </Typography>
      )}
      <Typography variant="body1" noWrap sx={{ fontWeight: 800, color: 'common.white', fontSize: { xs: '0.88rem', sm: '0.98rem' } }}>
        {awayName}
      </Typography>
    </Box>
  ) : (
    'Detail zápasu'
  );

  const headerSubtitle = match
    ? [
        match.leagueName || 'LIGA',
        isLive ? 'ŽIVĚ' : match.status === 'completed' ? 'KONEC ZÁPASU' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Statistiky a průběh';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white' }}>
      {/* Shared @fh/ui sticky glass bar with persistent score and league (leading = back affordance) */}
      <StickyGlassHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        leading={
          <IconButton
            data-testid="match-detail-back"
            aria-label="Zpět na zápasy"
            component={Link}
            to=".."
            relative="path"
            sx={{
              color: 'common.white',
              width: 44,
              height: 44,
              bgcolor: alpha(theme.palette.common.white, 0.05),
              '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.1) },
              ...focusRing(theme),
            }}
          >
            <FhIcon name="back" />
          </IconButton>
        }
      />
      <Container maxWidth="md" sx={{ py: 3 }}>
        <MatchDetailView
          matchId={matchId}
          starred={isMatchSaved(matchId)}
          onToggleStar={(e) => {
            e.stopPropagation();
            toggleMatch(matchId);
          }}
        />
      </Container>
    </Box>
  );
}
