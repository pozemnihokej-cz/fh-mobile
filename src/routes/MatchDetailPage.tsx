import { Link, useParams } from 'react-router-dom';
import { Box, Container, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { StickyGlassHeader, useStarredIds } from '@fh/ui';
import { MatchDetailView } from '../components/MatchDetailView';

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
  const { isStarred, toggle } = useStarredIds('fh_starred_matches');

  if (!matchId) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#121212', color: '#ffffff', p: 4 }}>
        <Typography>Missing match id.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: '#ffffff' }}>
      {/* Shared @fh/ui sticky glass bar (leading = back affordance) */}
      <StickyGlassHeader
        title="Detail Zápasu"
        subtitle="Statistiky a průběh"
        leading={
          <IconButton
            data-testid="match-detail-back"
            component={Link}
            to=".."
            relative="path"
            sx={{
              color: '#ffffff',
              bgcolor: alpha(theme.palette.common.white, 0.05),
              '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.1) },
            }}
          >
            <BackIcon />
          </IconButton>
        }
      />
      <Container maxWidth="xs" sx={{ py: 3 }}>
        <MatchDetailView
          matchId={matchId}
          starred={isStarred(matchId)}
          onToggleStar={(e) => {
            e.stopPropagation();
            toggle(matchId);
          }}
        />
      </Container>
    </Box>
  );
}
