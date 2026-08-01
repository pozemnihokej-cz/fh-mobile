import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { isMatchGenuinelyLive } from '@fh/schema';
import { api } from '@convex/_generated/api';
import { Box, Container, Button, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, MatchCardSkeleton, FhIcon, focusRing } from '@fh/ui';
import { MatchCard, type MatchCardData } from '../components/MatchCard';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { useTenantContext } from './TenantContext';
import { useFanPreferences } from '../lib/useFanPreferences';

/**
 * PRD-055 Phase 2 (Spec-AC-04/05): the live-centre at `/<slug>/live`. Reuses the
 * matches Convex query, filtered to in-progress games, over the shared
 * AsyncBoundary (skeleton / "nothing live" empty). Real data — no stub.
 */
export default function LiveCenter(): JSX.Element {
  const { tenantId, tenantName } = useTenantContext();
  const navigate = useNavigate();
  const theme = useTheme();
  const matches = useQuery(api.functions.matches.list, tenantId ? { tenantId } : 'skip');
  const { isMatchSaved, toggleMatch } = useFanPreferences();

  const live = useMemo<MatchCardData[]>(() => {
    if (!matches) return [];
    // Derive genuine liveness via the shared @fh/schema derivation (OM parity):
    // the mirror writes `in_progress` (never `live`), keyed by the actual kickoff
    // within MATCH_LIVE_WINDOW_MS (fan-app-live-status-derivation Spec-AC-01/02).
    const now = Date.now();
    return (matches as MatchCardData[])
      .filter((m) =>
        isMatchGenuinelyLive({ status: m.status, scheduledDate: m.date, startedAt: m.startedAt, now }),
      )
      .sort((a, b) => b.date - a.date);
  }, [matches]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 3 }}
        title="Živě"
        subtitle={tenantName || 'Právě hrané zápasy'}
        leading={
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.error.main, 0.15),
              color: 'error.main',
            }}
          >
            <FhIcon name="score" />
          </Box>
        }
        action={
          <Button
            component={Link}
            to="../matches"
            relative="path"
            size="small"
            sx={{ color: 'common.white', fontWeight: 800, borderRadius: '10px', ...focusRing(theme) }}
          >
            Zápasy
          </Button>
        }
      />

      <Container maxWidth="xs">
        <AsyncBoundary
          loading={matches === undefined}
          isEmpty={live.length === 0}
          skeleton={<MatchCardSkeleton count={2} />}
          empty={
            <EmptyState
              icon={<FhIcon name="score" sx={{ fontSize: 44 }} />}
              title="Teď se nehraje"
              description="Až začne živý zápas, uvidíš ho tady."
            />
          }
        >
          <Box>
            {live.map((m) => (
              <MatchCard
                key={m._id}
                match={m}
                isStarred={isMatchSaved(m.supabaseId)}
                onToggleStar={(e) => {
                  e.stopPropagation();
                  toggleMatch(m.supabaseId);
                }}
                onClick={() => navigate(`../matches/${m.supabaseId}`, { relative: 'path' })}
              />
            ))}
          </Box>
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
