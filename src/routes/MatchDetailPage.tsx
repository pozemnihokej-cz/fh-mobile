import { Link, useParams } from 'react-router-dom';
import { Box, Container, IconButton, Typography, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, FhIcon, focusRing } from '@fh/ui';
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

  if (!matchId) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'common.white', p: 4 }}>
        <Typography>Chybí ID zápasu.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white' }}>
      {/* Shared @fh/ui sticky glass bar (leading = back affordance) */}
      <StickyGlassHeader
        title="Detail Zápasu"
        subtitle="Statistiky a průběh"
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
      <Container maxWidth="sm" sx={{ py: 3 }}>
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
