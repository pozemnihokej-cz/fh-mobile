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
} from '@mui/material';
import { SportsHockey as HockeyIcon } from '@mui/icons-material';
import { StickyGlassHeader } from '@fh/ui';
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
      {/* Page header — shared @fh/ui sticky glass bar (leading = brand badge) */}
      <StickyGlassHeader
        sx={{ mb: 3 }}
        title={tenantName || 'Zápasy'}
        subtitle="Program a výsledky"
        leading={
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
        }
      />

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
