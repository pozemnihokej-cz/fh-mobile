import { Link, useParams } from 'react-router-dom';
import { Box, Container, Typography, Stack, Button, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, typeScale, focusRing } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { FanListSkeleton } from '../components/FanListSkeleton';
import { useAsyncData } from '../lib/useAsyncData';
import { supabase } from '../lib/supabase';
import { fetchLineup, type LineupPlayer } from '../lib/adapters/lineup';

/**
 * PRD-055 Phase 2 (Spec-AC-04/05): match lineup at
 * `/<slug>/matches/:matchId/lineup`. Real data via the lineup adapter over the
 * anon `match_players` read, split by side.
 */
export default function LineupPage(): JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;

  const { data, error, loading, refetch } = useAsyncData(
    () => fetchLineup(supabase, matchId as string),
    [matchId],
    Boolean(matchId),
  );
  const lineup = data ?? { home: [], guest: [] };
  const isEmpty = lineup.home.length === 0 && lineup.guest.length === 0;

  const renderSide = (label: string, players: LineupPlayer[]): JSX.Element => (
    <Box sx={{ mb: 3 }}>
      <Typography sx={{ ...typeScale.label, color: 'primary.main', mb: 1, display: 'block' }}>{label}</Typography>
      <Stack spacing={0.75}>
        {players.map((p) => (
          <Box
            key={p.id}
            data-testid="lineup-player"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.25,
              borderRadius: '12px',
              bgcolor: alpha(white, 0.04),
              border: `1px solid ${alpha(white, 0.06)}`,
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(white, 0.08),
                color: 'common.white',
              }}
            >
              <Typography sx={{ ...typeScale.bodyStrong, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums' }}>
                {p.isCoach ? <FhIcon name="roster" inline /> : p.jersey || '–'}
              </Typography>
            </Box>
            <Typography sx={{ ...typeScale.body, flex: 1, fontSize: '0.9rem', color: 'common.white' }} noWrap>
              {p.name}
            </Typography>
            {p.isCaptain && (
              <Box sx={{ px: 1, py: 0.25, borderRadius: '8px', bgcolor: alpha(theme.palette.primary.main, 0.18) }}>
                <Typography sx={{ ...typeScale.caption, color: 'primary.main', fontWeight: 800 }}>C</Typography>
              </Box>
            )}
            <Typography sx={{ ...typeScale.caption, color: 'text.secondary' }}>
              {p.isCoach ? t('mobile.fan.lineup.coach') : p.position}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={t('mobile.fan.lineup.title')}
        leading={
          <Button
            component={Link}
            to=".."
            relative="path"
            data-testid="lineup-back"
            size="small"
            sx={{ minWidth: 40, color: 'common.white', ...focusRing(theme) }}
          >
            <FhIcon name="back" />
          </Button>
        }
      />

      <Container maxWidth="xs" data-testid="lineup-screen">
        <AsyncBoundary
          loading={loading}
          error={error}
          isEmpty={isEmpty}
          skeleton={<FanListSkeleton count={6} />}
          onRetry={refetch}
          errorTitle={t('mobile.fan.lineup.error')}
          errorDescription={t('mobile.fan.lineup.errorDesc')}
          retryLabel={t('mobile.fan.errorRetry')}
          empty={
            <EmptyState
              icon={<FhIcon name="roster" sx={{ fontSize: 44 }} />}
              title={t('mobile.fan.lineup.empty')}
              description={t('mobile.fan.lineup.emptyDesc')}
            />
          }
        >
          <Box sx={{ px: 0.5 }}>
            {lineup.home.length > 0 && renderSide(t('mobile.fan.lineup.home'), lineup.home)}
            {lineup.guest.length > 0 && renderSide(t('mobile.fan.lineup.guest'), lineup.guest)}
          </Box>
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
