import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  alpha,
  useTheme,
  Paper,
  Stack,
} from '@mui/material';
import { SportsHockey as HockeyIcon } from '@mui/icons-material';
import { MatchCard, type MatchCardData } from '../components/MatchCard';
import { useTenantContext } from './TenantContext';

/**
 * CHANGE-055 Spec-AC-01 / Spec-AC-12: matches list at `/<slug>/matches`.
 * Overhauled with premium fancy GUI.
 */
export default function MatchesPage(): JSX.Element {
  const { tenantId, tenantName } = useTenantContext();
  const navigate = useNavigate();
  const theme = useTheme();
  const matches = useQuery(
    api.functions.matches.list,
    tenantId ? { tenantId } : 'skip',
  );

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

  const toggleStar = (supabaseId: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setStarredMatches((prev) =>
      prev.includes(supabaseId) ? prev.filter((id) => id !== supabaseId) : [...prev, supabaseId],
    );
  };

  const sorted = useMemo<MatchCardData[]>(() => {
    if (!matches) return [];
    return [...(matches as MatchCardData[])].sort((a, b) => b.date - a.date);
  }, [matches]);

  if (matches === undefined) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8, bgcolor: 'background.default', minHeight: '100vh' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: '#ffffff', pb: 4 }}>
      {/* Page Header */}
      <Paper
        elevation={0}
        sx={{
          py: 2,
          mb: 3,
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: alpha(theme.palette.background.default, 0.8),
          backdropFilter: 'blur(20px)',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 0,
        }}
      >
        <Container maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: 'primary.main',
              }}
            >
              <HockeyIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                {tenantName || 'Zápasy'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Program a výsledky
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Paper>

      <Container maxWidth="xs">
        {sorted.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              textAlign: 'center',
              bgcolor: alpha(theme.palette.common.white, 0.03),
              borderRadius: '24px',
              border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Zatím nejsou naplánovány žádné zápasy.
            </Typography>
          </Paper>
        ) : (
          <Box>
            {sorted.map((m) => (
              <MatchCard
                key={m._id}
                match={m}
                isStarred={starredMatches.includes(m.supabaseId)}
                onToggleStar={(e) => toggleStar(m.supabaseId, e)}
                onClick={() => navigate(m.supabaseId)}
              />
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
}
