import { useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import {
  isMatchGenuinelyLive,
  MATCH_LIST_DEFAULT_PAST_DAYS,
  matchListFromDate,
} from '@fh/schema';
import { api } from '@convex/_generated/api';
import { Box, Container, Button, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, MatchCardSkeleton, FhIcon, focusRing } from '@fh/ui';
import { MatchCard, type MatchCardData } from '../components/MatchCard';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { useTenantContext } from './TenantContext';
import { useFanPreferences } from '../lib/useFanPreferences';

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * PRD-055 Phase 2 (Spec-AC-04/05): the live-centre at `/<slug>/live`. Reuses the
 * matches Convex query, filtered to in-progress games, over the shared
 * AsyncBoundary (skeleton / "nothing live" empty). Real data — no stub.
 */
export default function LiveCenter(): JSX.Element {
  const { tenantId, tenantName } = useTenantContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const theme = useTheme();
  /**
   * spec-matches-list-bounded-window: the SAME default window the match list
   * sends, deliberately — not a tighter live-only one.
   *
   * `isMatchGenuinelyLive` keys on the ACTUAL kickoff (`startedAt`) within a
   * three-hour window, but the only column an index can bound is the SCHEDULED
   * date. Measured on the live mirror, 3 of 134 started matches have
   * `|startedAt - date| > 24 h`, the largest 505.7 h — so a tight window on the
   * scheduled date would have hidden genuinely live matches from this page.
   * Sending identical arguments also keeps this page and the match list sharing
   * one Convex query-cache entry, as they did before the window existed.
   */
  const fromDate = useMemo(
    () => matchListFromDate(startOfDay(Date.now()), MATCH_LIST_DEFAULT_PAST_DAYS),
    [],
  );
  const matches = useQuery(
    api.functions.matches.list,
    tenantId ? { tenantId, fromDate } : 'skip',
  );
  const { isMatchSaved, toggleMatch } = useFanPreferences();

  const directId = searchParams.get('matchId') || searchParams.get('id') || searchParams.get('externalId');
  useEffect(() => {
    if (directId) {
      navigate(`../matches/${directId}`, { relative: 'path', replace: true });
    }
  }, [directId, navigate]);

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
