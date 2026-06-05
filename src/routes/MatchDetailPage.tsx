import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Container, IconButton, Paper, Typography } from '@mui/material';
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#121212', color: '#ffffff' }}>
      <Paper
        elevation={0}
        sx={{
          py: 1,
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: 'rgba(18,18,18,0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 0,
        }}
      >
        <Container maxWidth="xs" sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            data-testid="match-detail-back"
            component={Link}
            to=".."
            relative="path"
            sx={{ color: '#ffffff' }}
          >
            <BackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2, fontWeight: 900 }}>
            Detail Zápasu
          </Typography>
        </Container>
      </Paper>
      <Container maxWidth="xs" sx={{ py: 2 }}>
        <MatchDetailView
          matchId={matchId}
          starred={starredMatches.includes(matchId)}
          onToggleStar={toggleStar}
        />
      </Container>
    </Box>
  );
}
