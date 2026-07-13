import { Box, Container, Typography, Avatar, Stack, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, typeScale } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { FanListSkeleton } from '../components/FanListSkeleton';
import { useAsyncData } from '../lib/useAsyncData';
import { supabase } from '../lib/supabase';
import { fetchStandings } from '../lib/adapters/standings';
import { useTenantContext } from './TenantContext';

/**
 * PRD-055 Phase 2 (Spec-AC-04/05): league table at `/<slug>/standings`, computed
 * from the anon `matches` + `teams` reads. Real data via the standings adapter.
 */
export default function StandingsPage(): JSX.Element {
  const { tenantId, tenantName } = useTenantContext();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;

  const { data, error, loading, refetch } = useAsyncData(
    () => fetchStandings(supabase, tenantId as string),
    [tenantId],
    Boolean(tenantId),
  );
  const rows = data ?? [];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={t('mobile.fan.standings.title')}
        subtitle={tenantName || t('mobile.fan.standings.subtitle')}
        leading={
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
            }}
          >
            <FhIcon name="shootout" />
          </Box>
        }
      />

      <Container maxWidth="xs" data-testid="standings-screen">
        <AsyncBoundary
          loading={loading}
          error={error}
          isEmpty={rows.length === 0}
          skeleton={<FanListSkeleton count={6} />}
          onRetry={refetch}
          errorTitle={t('mobile.fan.standings.error')}
          errorDescription={t('mobile.fan.standings.errorDesc')}
          retryLabel={t('mobile.fan.errorRetry')}
          empty={
            <EmptyState
              icon={<FhIcon name="shootout" sx={{ fontSize: 44 }} />}
              title={t('mobile.fan.standings.empty')}
              description={t('mobile.fan.standings.emptyDesc')}
            />
          }
        >
          <Box sx={{ px: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1, color: 'text.secondary' }}>
              <Typography sx={{ ...typeScale.label, width: 26 }}>#</Typography>
              <Typography sx={{ ...typeScale.label, flex: 1 }}>{t('mobile.fan.standings.colTeam')}</Typography>
              <Typography sx={{ ...typeScale.label, width: 30, textAlign: 'center' }}>{t('mobile.fan.standings.colPlayed')}</Typography>
              <Typography sx={{ ...typeScale.label, width: 30, textAlign: 'center' }}>{t('mobile.fan.standings.colWins')}</Typography>
              <Typography sx={{ ...typeScale.label, width: 34, textAlign: 'right' }}>{t('mobile.fan.standings.colPoints')}</Typography>
            </Box>

            <Stack spacing={0.75} sx={{ pb: 2 }}>
              {rows.map((r, i) => {
                const leader = i === 0;
                return (
                  <Box
                    key={r.teamId}
                    data-testid="standings-row"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      px: 1.5,
                      py: 1,
                      borderRadius: '14px',
                      background: leader
                        ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.22)}, ${alpha(theme.palette.primary.main, 0.06)})`
                        : `linear-gradient(180deg, ${alpha(white, 0.07)}, ${alpha(white, 0.02)})`,
                      border: `1px solid ${alpha(white, leader ? 0.14 : 0.08)}`,
                    }}
                  >
                    <Typography sx={{ ...typeScale.bodyStrong, width: 26, color: leader ? 'primary.main' : 'text.secondary' }}>
                      {i + 1}
                    </Typography>
                    <Avatar src={r.logoUrl ?? undefined} sx={{ width: 30, height: 30, mr: 1.25, bgcolor: alpha(white, 0.08) }} />
                    <Typography sx={{ ...typeScale.bodyStrong, flex: 1, color: 'common.white', fontSize: '0.9rem' }} noWrap>
                      {r.name}
                    </Typography>
                    <Typography sx={{ ...typeScale.body, width: 30, textAlign: 'center', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                      {r.played}
                    </Typography>
                    <Typography sx={{ ...typeScale.body, width: 30, textAlign: 'center', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                      {r.wins}
                    </Typography>
                    <Typography sx={{ ...typeScale.bodyStrong, width: 34, textAlign: 'right', color: 'common.white', fontVariantNumeric: 'tabular-nums' }}>
                      {r.points}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
