import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Container, Typography, Stack, Button, Chip, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, typeScale, focusRing } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { FanListSkeleton } from '../components/FanListSkeleton';
import { useAsyncData } from '../lib/useAsyncData';
import { supabase } from '../lib/supabase';
import { fetchLineup, type LineupPlayer } from '../lib/adapters/lineup';

/**
 * PRD-055 Phase 2 / Redesign: match lineup at `/<slug>/matches/:matchId/lineup`.
 * Compact OM-style presentation with Home/Away team tabs, jersey number badges,
 * and captain/position chips styled for fan dark theme.
 */
export default function LineupPage(): JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;
  const [selectedSide, setSelectedSide] = useState<'home' | 'guest'>('home');

  const { data, error, loading, refetch } = useAsyncData(
    () => fetchLineup(supabase, matchId as string),
    [matchId],
    Boolean(matchId),
  );
  const lineup = data ?? { home: [], guest: [] };
  const isEmpty = lineup.home.length === 0 && lineup.guest.length === 0;

  const currentPlayers = selectedSide === 'home' ? lineup.home : lineup.guest;

  const renderPlayer = (p: LineupPlayer): JSX.Element => (
    <Box
      key={p.id}
      data-testid="lineup-player"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        py: 0.9,
        borderRadius: '12px',
        bgcolor: alpha(white, 0.04),
        border: `1px solid ${alpha(white, 0.06)}`,
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: alpha(white, 0.07),
          borderColor: alpha(white, 0.12),
        },
      }}
    >
      {/* Jersey Number Box (OM-style compact badge) */}
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(white, 0.08),
          color: 'common.white',
          flexShrink: 0,
        }}
      >
        <Typography sx={{ ...typeScale.bodyStrong, fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums', fontWeight: 900 }}>
          {p.isCoach ? <FhIcon name="roster" inline /> : p.jersey || '–'}
        </Typography>
      </Box>

      {/* Player Name */}
      <Typography sx={{ ...typeScale.body, flex: 1, fontSize: '0.88rem', fontWeight: 700, color: 'common.white', minWidth: 0 }} noWrap>
        {p.name}
      </Typography>

      {/* Role / Position Chips */}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
        {p.isCaptain && (
          <Chip
            label="C"
            size="small"
            sx={{
              height: 20,
              fontSize: '0.62rem',
              fontWeight: 900,
              bgcolor: alpha(theme.palette.primary.main, 0.2),
              color: 'primary.main',
              border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
        {(p.isCoach || p.position) && (
          <Chip
            label={p.isCoach ? t('mobile.fan.lineup.coach') : p.position}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 600,
              bgcolor: alpha(white, 0.06),
              color: 'text.secondary',
              border: `1px solid ${alpha(white, 0.08)}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
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

      <Container maxWidth="sm" data-testid="lineup-screen">
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
          {/* Side Switcher Tabs (Home / Away) - OM style */}
          <Box
            sx={{
              display: 'flex',
              bgcolor: alpha(white, 0.06),
              p: 0.5,
              borderRadius: '14px',
              mb: 2,
              border: `1px solid ${alpha(white, 0.08)}`,
            }}
          >
            <Button
              fullWidth
              onClick={() => setSelectedSide('home')}
              sx={{
                py: 0.75,
                borderRadius: '10px',
                bgcolor: selectedSide === 'home' ? alpha(theme.palette.primary.main, 0.25) : 'transparent',
                color: selectedSide === 'home' ? 'primary.main' : alpha(white, 0.75),
                border: selectedSide === 'home' ? `1px solid ${alpha(theme.palette.primary.main, 0.4)}` : '1px solid transparent',
                fontWeight: 800,
                fontSize: '0.82rem',
                textTransform: 'none',
                transition: 'all 0.15s ease',
                ...focusRing(theme),
              }}
            >
              {t('mobile.fan.lineup.home')} {lineup.home.length > 0 && `(${lineup.home.length})`}
            </Button>
            <Button
              fullWidth
              onClick={() => setSelectedSide('guest')}
              sx={{
                py: 0.75,
                borderRadius: '10px',
                bgcolor: selectedSide === 'guest' ? alpha(theme.palette.primary.main, 0.25) : 'transparent',
                color: selectedSide === 'guest' ? 'primary.main' : alpha(white, 0.75),
                border: selectedSide === 'guest' ? `1px solid ${alpha(theme.palette.primary.main, 0.4)}` : '1px solid transparent',
                fontWeight: 800,
                fontSize: '0.82rem',
                textTransform: 'none',
                transition: 'all 0.15s ease',
                ...focusRing(theme),
              }}
            >
              {t('mobile.fan.lineup.guest')} {lineup.guest.length > 0 && `(${lineup.guest.length})`}
            </Button>
          </Box>

          <Box sx={{ px: 0.25 }}>
            {currentPlayers.length > 0 ? (
              <Stack spacing={0.75}>
                {currentPlayers.map((p) => renderPlayer(p))}
              </Stack>
            ) : (
              <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 3, fontSize: '0.85rem' }}>
                Žádní hráči v této sestavě
              </Typography>
            )}
          </Box>
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
