import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Container, IconButton, Paper, Typography, alpha, useTheme } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
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

  const [starredMatches, setStarredMatches] = useState<string[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('fh_starred_matches') : null;
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('fh_starred_matches', JSON.stringify(starredMatches));
    } catch {
      /* storage disabled */
    }
  }, [starredMatches]);

  if (!matchId) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#121212', color: '#ffffff', p: 4 }}>
        <Typography>Missing match id.</Typography>
      </Box>
    );
  }

  const toggleStar = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setStarredMatches((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId],
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: '#ffffff' }}>
      <Paper
        elevation={0}
        sx={{
          py: 2,
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: alpha(theme.palette.background.default, 0.8),
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 0,
        }}
      >
        <Container maxWidth="xs" sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            data-testid="match-detail-back"
            component={Link}
            to=".."
            relative="path"
            sx={{
              color: '#ffffff',
              mr: 1,
              bgcolor: alpha(theme.palette.common.white, 0.05),
              '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.1) }
            }}
          >
            <BackIcon />
          </IconButton>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
              Detail Zápasu
            </Typography>
            <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Statistiky a průběh
            </Typography>
          </Box>
        </Container>
      </Paper>
      <Container maxWidth="xs" sx={{ py: 3 }}>
        <MatchDetailView
          matchId={matchId}
          starred={starredMatches.includes(matchId)}
          onToggleStar={toggleStar}
        />
      </Container>
    </Box>
  );
}
