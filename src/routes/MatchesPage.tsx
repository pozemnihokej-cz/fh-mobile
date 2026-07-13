import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Box,
  Container,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import { StickyGlassHeader, EmptyState, MatchCardSkeleton, FhIcon, focusRing, useStarredIds } from '@fh/ui';
import { MatchCard, type MatchCardData } from '../components/MatchCard';
import { AsyncBoundary } from '../components/AsyncBoundary';
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
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
            <FhIcon name="hockey" />
          </Box>
        }
        action={
          <Button
            component={Link}
            to="../live"
            relative="path"
            size="small"
            startIcon={<FhIcon name="score" inline />}
            sx={{ color: 'common.white', fontWeight: 800, borderRadius: '10px', ...focusRing(theme) }}
          >
            Živě
          </Button>
        }
      />

      <Container maxWidth="xs">
        <AsyncBoundary
          loading={matches === undefined}
          isEmpty={sorted.length === 0}
          skeleton={<MatchCardSkeleton count={4} />}
          empty={
            <EmptyState
              icon={<FhIcon name="hockey" sx={{ fontSize: 44 }} />}
              title="Žádné zápasy"
              description="Zatím nejsou naplánovány žádné zápasy."
            />
          }
        >
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
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
