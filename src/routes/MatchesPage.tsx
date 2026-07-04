import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Box,
  Container,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import { SportsHockey as HockeyIcon } from '@mui/icons-material';
import { StickyGlassHeader, EmptyState, useStarredIds } from '@fh/ui';
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

  const { isStarred, toggle: toggleStar } = useStarredIds('fh_starred_matches');

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
          <EmptyState
            icon={<HockeyIcon sx={{ fontSize: 44 }} />}
            title="Žádné zápasy"
            description="Zatím nejsou naplánovány žádné zápasy."
          />
        ) : (
          <Box>
            {sorted.map((m) => (
              <MatchCard
                key={m._id}
                match={m}
                isStarred={isStarred(m.supabaseId)}
                onToggleStar={(e) => {
                  e.stopPropagation();
                  toggleStar(m.supabaseId);
                }}
                onClick={() => navigate(m.supabaseId)}
              />
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
}
