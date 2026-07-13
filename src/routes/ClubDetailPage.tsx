import { Link, useParams } from 'react-router-dom';
import { Box, Container, Typography, Avatar, Stack, Button, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, typeScale, focusRing } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { FanListSkeleton } from '../components/FanListSkeleton';
import { useAsyncData } from '../lib/useAsyncData';
import { supabase } from '../lib/supabase';
import { fetchClubDetail } from '../lib/adapters/clubDetail';

/**
 * PRD-055 Phase 2 (Spec-AC-04/05): club profile at `/<slug>/clubs/:clubId`.
 * Real data via the clubDetail adapter over the anon `clubs`/`teams`/`matches`.
 */
export default function ClubDetailPage(): JSX.Element {
  const { clubId } = useParams<{ clubId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;

  const { data, error, loading, refetch } = useAsyncData(
    () => fetchClubDetail(supabase, clubId as string),
    [clubId],
    Boolean(clubId),
  );
  const club = data ?? null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      <StickyGlassHeader
        sx={{ mb: 2 }}
        title={club?.name || t('mobile.fan.clubDetail.title')}
        leading={
          <Button
            component={Link}
            to="../.."
            relative="path"
            data-testid="club-back"
            size="small"
            sx={{ minWidth: 40, color: 'common.white', ...focusRing(theme) }}
          >
            <FhIcon name="back" />
          </Button>
        }
      />

      <Container maxWidth="xs" data-testid="club-detail-screen">
        <AsyncBoundary
          loading={loading}
          error={error}
          isEmpty={club === null}
          skeleton={<FanListSkeleton count={6} />}
          onRetry={refetch}
          errorTitle={t('mobile.fan.clubDetail.error')}
          errorDescription={t('mobile.fan.clubDetail.errorDesc')}
          retryLabel={t('mobile.fan.errorRetry')}
          empty={
            <EmptyState
              icon={<FhIcon name="hockey" sx={{ fontSize: 44 }} />}
              title={t('mobile.fan.clubDetail.empty')}
              description={t('mobile.fan.clubDetail.emptyDesc')}
            />
          }
        >
          {club && (
            <Box sx={{ px: 0.5 }}>
              <Stack alignItems="center" spacing={1} sx={{ py: 2 }}>
                <Avatar
                  src={club.logoUrl ?? undefined}
                  sx={{ width: 84, height: 84, bgcolor: alpha(white, 0.08), boxShadow: `0 12px 30px ${alpha(theme.palette.common.black, 0.4)}` }}
                >
                  <FhIcon name="hockey" sx={{ fontSize: 36 }} />
                </Avatar>
                <Typography sx={{ ...typeScale.title, color: 'common.white', textAlign: 'center' }}>{club.name}</Typography>
                {club.web && (
                  <Button
                    component="a"
                    href={club.web}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    startIcon={<FhIcon name="chevronRight" inline />}
                    sx={{ color: 'primary.main', fontWeight: 700, ...focusRing(theme) }}
                  >
                    {t('mobile.fan.clubDetail.website')}
                  </Button>
                )}
              </Stack>

              {club.teams.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ ...typeScale.label, color: 'text.secondary', mb: 1, display: 'block' }}>
                    {t('mobile.fan.clubDetail.teams')}
                  </Typography>
                  <Stack spacing={0.75}>
                    {club.teams.map((tm) => (
                      <Box
                        key={tm.id}
                        data-testid="club-team"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: '12px', bgcolor: alpha(white, 0.04), border: `1px solid ${alpha(white, 0.06)}` }}
                      >
                        <Avatar src={tm.logoUrl ?? undefined} sx={{ width: 30, height: 30, bgcolor: alpha(white, 0.08) }} />
                        <Typography sx={{ ...typeScale.bodyStrong, flex: 1, fontSize: '0.9rem', color: 'common.white' }} noWrap>
                          {tm.name}
                        </Typography>
                        {tm.category && (
                          <Typography sx={{ ...typeScale.caption, color: 'text.secondary' }}>{tm.category}</Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}

              {club.fixtures.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ ...typeScale.label, color: 'text.secondary', mb: 1, display: 'block' }}>
                    {t('mobile.fan.clubDetail.fixtures')}
                  </Typography>
                  <Stack spacing={0.75}>
                    {club.fixtures.map((f) => (
                      <Box
                        key={f.id}
                        data-testid="club-fixture"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: '12px', bgcolor: alpha(white, 0.04), border: `1px solid ${alpha(white, 0.06)}` }}
                      >
                        <Typography sx={{ ...typeScale.body, flex: 1, fontSize: '0.85rem', color: 'common.white' }} noWrap>
                          {f.homeName} — {f.awayName}
                        </Typography>
                        <Typography sx={{ ...typeScale.bodyStrong, fontSize: '0.85rem', color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                          {typeof f.homeScore === 'number' && typeof f.awayScore === 'number'
                            ? `${f.homeScore}:${f.awayScore}`
                            : '–'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          )}
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
