import { Box, Container, Typography, Avatar, Stack, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, typeScale } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { FanListSkeleton } from '../components/FanListSkeleton';
import { useAsyncData } from '../lib/useAsyncData';
import { supabase } from '../lib/supabase';
import { fetchSchedule } from '../lib/adapters/schedule';
import { useTenantContext } from './TenantContext';

/**
 * PRD-055 Phase 2 (Spec-AC-04/05): fixtures grouped by day at `/<slug>/schedule`.
 * Real data via the schedule adapter over the anon `matches` + `teams` reads.
 */
export default function SchedulePage(): JSX.Element {
  const { tenantId, tenantName } = useTenantContext();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;

  const { data, error, loading, refetch } = useAsyncData(
    () => fetchSchedule(supabase, tenantId as string),
    [tenantId],
    Boolean(tenantId),
  );
  const days = data ?? [];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={t('mobile.fan.schedule.title')}
        subtitle={tenantName || t('mobile.fan.schedule.subtitle')}
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
            <FhIcon name="events" />
          </Box>
        }
      />

      <Container maxWidth="xs" data-testid="schedule-screen">
        <AsyncBoundary
          loading={loading}
          error={error}
          isEmpty={days.length === 0}
          skeleton={<FanListSkeleton count={5} />}
          onRetry={refetch}
          errorTitle={t('mobile.fan.schedule.error')}
          errorDescription={t('mobile.fan.schedule.errorDesc')}
          retryLabel={t('mobile.fan.errorRetry')}
          empty={
            <EmptyState
              icon={<FhIcon name="events" sx={{ fontSize: 44 }} />}
              title={t('mobile.fan.schedule.empty')}
              description={t('mobile.fan.schedule.emptyDesc')}
            />
          }
        >
          <Box sx={{ px: 0.5 }}>
            {days.map((d) => (
              <Box key={d.key} data-testid="schedule-day" sx={{ mb: 2.5 }}>
                <Typography sx={{ ...typeScale.label, color: 'primary.main', mb: 1, display: 'block' }}>
                  {d.label}
                </Typography>
                <Stack spacing={1}>
                  {d.matches.map((g) => (
                    <Box
                      key={g.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1.5,
                        borderRadius: '16px',
                        background: `linear-gradient(180deg, ${alpha(white, 0.06)}, ${alpha(white, 0.02)})`,
                        border: `1px solid ${alpha(white, 0.08)}`,
                      }}
                    >
                      <Box sx={{ px: 1.25, py: 0.5, borderRadius: '10px', bgcolor: alpha(white, 0.06), mr: 1.5 }}>
                        <Typography sx={{ ...typeScale.bodyStrong, fontSize: '0.8rem', color: 'common.white', fontVariantNumeric: 'tabular-nums' }}>
                          {g.time}
                        </Typography>
                      </Box>
                      <Avatar src={g.home.logoUrl ?? undefined} sx={{ width: 28, height: 28, bgcolor: alpha(white, 0.08) }} />
                      <Typography sx={{ ...typeScale.bodyStrong, fontSize: '0.82rem', flex: 1, textAlign: 'center', color: 'common.white' }} noWrap>
                        {g.home.name} — {g.away.name}
                      </Typography>
                      <Avatar src={g.away.logoUrl ?? undefined} sx={{ width: 28, height: 28, bgcolor: alpha(white, 0.08) }} />
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
