import { Link, useParams } from 'react-router-dom';
import { Box, Container, Typography, Avatar, Stack, Button, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, typeScale, focusRing } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { FanListSkeleton } from '../components/FanListSkeleton';
import { useAsyncData } from '../lib/useAsyncData';
import { supabase } from '../lib/supabase';
import { fetchPlayerDetail } from '../lib/adapters/playerDetail';
import { useTenantContext } from './TenantContext';

/**
 * PRD-055 Phase 2 (Spec-AC-04/05): player profile at `/<slug>/players/:personId`.
 * Identity from the fan-safe `persons_public` view; best-effort appearances via
 * the playerDetail adapter (see its header for the anon-bridge limitation).
 */
export default function PlayerDetailPage(): JSX.Element {
  const { personId } = useParams<{ personId: string }>();
  const { tenantId } = useTenantContext();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;

  const { data, error, loading, refetch } = useAsyncData(
    () => fetchPlayerDetail(supabase, tenantId as string, personId as string),
    [tenantId, personId],
    Boolean(tenantId && personId),
  );
  const player = data ?? null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={player?.identity.fullName || t('mobile.fan.playerDetail.title')}
        subtitle={player?.identity.position || undefined}
        leading={
          <Button
            component={Link}
            to="../.."
            relative="path"
            data-testid="player-back"
            size="small"
            sx={{ minWidth: 40, color: 'common.white', ...focusRing(theme) }}
          >
            <FhIcon name="back" />
          </Button>
        }
      />

      <Container maxWidth="xs" data-testid="player-detail-screen">
        <AsyncBoundary
          loading={loading}
          error={error}
          isEmpty={player === null}
          skeleton={<FanListSkeleton count={5} />}
          onRetry={refetch}
          errorTitle={t('mobile.fan.playerDetail.error')}
          errorDescription={t('mobile.fan.playerDetail.errorDesc')}
          retryLabel={t('mobile.fan.errorRetry')}
          empty={
            <EmptyState
              icon={<FhIcon name="roster" sx={{ fontSize: 44 }} />}
              title={t('mobile.fan.playerDetail.empty')}
              description={t('mobile.fan.playerDetail.emptyDesc')}
            />
          }
        >
          {player && (
            <Box sx={{ px: 0.5 }}>
              <Stack alignItems="center" spacing={1} sx={{ py: 2 }}>
                <Avatar
                  src={player.identity.photoUrl ?? undefined}
                  sx={{
                    width: 92,
                    height: 92,
                    ...typeScale.display,
                    fontSize: '2.4rem',
                    color: 'common.white',
                    bgcolor: alpha(theme.palette.primary.main, 0.25),
                    boxShadow: `0 12px 30px ${alpha(theme.palette.common.black, 0.4)}`,
                  }}
                >
                  {player.identity.jersey || player.identity.fullName.charAt(0)}
                </Avatar>
                <Typography sx={{ ...typeScale.title, color: 'common.white' }}>{player.identity.fullName}</Typography>
                <Typography sx={{ ...typeScale.caption, color: 'text.secondary' }}>
                  {[
                    player.identity.position,
                    player.identity.jersey ? `#${player.identity.jersey}` : null,
                    player.identity.isCaptain ? t('mobile.fan.lineup.captain') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Stack>

              {player.stats === null ? (
                <Typography
                  data-testid="player-stats-unavailable"
                  sx={{ ...typeScale.body, color: 'text.secondary', px: 1, py: 2, display: 'block' }}
                >
                  {t('mobile.fan.playerDetail.statsUnavailable')}
                </Typography>
              ) : (
                <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 1, mb: 3 }}>
                    <Box
                      data-testid="player-stat"
                      sx={{
                        textAlign: 'center',
                        py: 1.5,
                        borderRadius: '14px',
                        background: `linear-gradient(180deg, ${alpha(white, 0.08)}, ${alpha(white, 0.02)})`,
                        border: `1px solid ${alpha(white, 0.08)}`,
                      }}
                    >
                      <Typography sx={{ ...typeScale.title, fontSize: '1.35rem', color: 'primary.main' }}>
                        {player.stats.appearances}
                      </Typography>
                      <Typography sx={{ ...typeScale.caption, color: 'text.secondary' }}>
                        {t('mobile.fan.playerDetail.appearances')}
                      </Typography>
                    </Box>
                  </Box>

                  <Typography sx={{ ...typeScale.label, color: 'text.secondary', mb: 1, display: 'block' }}>
                    {t('mobile.fan.playerDetail.recent')}
                  </Typography>
                  {player.stats.recent.length === 0 ? (
                    <Typography sx={{ ...typeScale.body, color: 'text.secondary', px: 1, pb: 2 }}>
                      {t('mobile.fan.playerDetail.noStats')}
                    </Typography>
                  ) : (
                    <Stack spacing={0.75} sx={{ pb: 2 }}>
                      {player.stats.recent.map((r) => (
                        <Box
                          key={r.matchId}
                          data-testid="player-recent"
                          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px', bgcolor: alpha(white, 0.04) }}
                        >
                          <Typography sx={{ ...typeScale.body, flex: 1, fontSize: '0.88rem', color: 'common.white' }} noWrap>
                            {t('mobile.fan.playerDetail.vs')} {r.opponent}
                          </Typography>
                          {r.result && (
                            <Typography sx={{ ...typeScale.bodyStrong, fontSize: '0.85rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                              {r.result}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                  )}
                </>
              )}
            </Box>
          )}
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
