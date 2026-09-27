import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Box, Container, Typography, Stack, Button, Chip, Avatar, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, EmptyState, FhIcon, typeScale, focusRing } from '@fh/ui';
import { useTranslation } from '@fh/i18n';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { FanListSkeleton } from '../components/FanListSkeleton';
import { useAsyncData } from '../lib/useAsyncData';
import { supabase } from '../lib/supabase';
import { fetchLineup, isGuestSide, type LineupPlayer } from '../lib/adapters/lineup';
import { toImageUrl } from '../lib/runtimeUrls';
import { formatPositionCz } from '../lib/playerUtils';
import { PlayerDetailModal } from '../components/PlayerDetailModal';

/**
 * PRD-055 Phase 2 / Redesign: match lineup at `/<slug>/matches/:matchId/lineup`.
 * Compact OM-style presentation with Home/Away team tabs, jersey number badges,
 * player photos, and captain/position chips styled for fan dark theme.
 */
export default function LineupPage(): JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const theme = useTheme();
  const { t } = useTranslation();
  const white = theme.palette.common.white;
  const [selectedSide, setSelectedSide] = useState<'home' | 'guest'>('home');
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<LineupPlayer | null>(null);

  const { data, error, loading, refetch } = useAsyncData(
    () => fetchLineup(supabase, matchId as string),
    [matchId],
    Boolean(matchId),
  );
  const lineup = data ?? { home: [], guest: [] };
  const isEmpty = lineup.home.length === 0 && lineup.guest.length === 0;

  const currentPlayers = selectedSide === 'home' ? lineup.home : lineup.guest;
  const fieldPlayers = currentPlayers.filter((p) => !p.isCoach);
  const coaches = currentPlayers.filter((p) => p.isCoach);

  const renderPlayer = (p: LineupPlayer): JSX.Element => {
    const positionLabel = formatPositionCz(p.position, p.isCoach);
    const imageUrl = toImageUrl(p.image);
    const isGuest = isGuestSide(p.side);
    const accent = isGuest ? theme.palette.info.main : theme.palette.primary.main;

    return (
      <Box
        key={p.id}
        data-testid="lineup-player"
        onClick={() => setSelectedPlayerModal(p)}
        role="button"
        tabIndex={0}
        aria-label={`Detail hráče ${p.name}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setSelectedPlayerModal(p);
          }
        }}
        sx={{
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.5,
          py: 0.85,
          borderRadius: '14px',
          bgcolor: alpha(white, 0.04),
          border: `1px solid ${alpha(white, 0.06)}`,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: alpha(white, 0.08),
            borderColor: alpha(accent, 0.35),
            transform: 'translateX(2px)',
          },
          ...focusRing(theme),
        }}
      >
        {/* Avatar with player photo or jersey number fallback */}
        <Avatar
          src={imageUrl || undefined}
          alt={p.name}
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: alpha(white, 0.08),
            color: 'common.white',
            fontWeight: 900,
            fontSize: '0.85rem',
            flexShrink: 0,
            border: `1px solid ${alpha(white, 0.12)}`,
          }}
        >
          {p.isCoach ? (
            <FhIcon name="roster" inline sx={{ fontSize: '1rem' }} />
          ) : (
            p.jersey || '–'
          )}
        </Avatar>

        {/* Jersey number slot — always reserve space so names never jump left when player has no number */}
        <Typography
          sx={{
            ...typeScale.bodyStrong,
            fontSize: '0.82rem',
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 900,
            color: alpha(white, 0.6),
            minWidth: 24,
            textAlign: 'center',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {p.isCoach ? '' : p.jersey || ''}
        </Typography>

        {/* Player Name */}
        <Typography
          sx={{
            ...typeScale.body,
            flex: 1,
            fontSize: '0.88rem',
            fontWeight: 700,
            color: 'common.white',
            minWidth: 0,
          }}
          noWrap
        >
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
                bgcolor: alpha(accent, 0.2),
                color: accent,
                border: `1px solid ${alpha(accent, 0.4)}`,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
          {positionLabel && (
            <Chip
              label={positionLabel}
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
  };

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
                bgcolor: selectedSide === 'guest' ? alpha(theme.palette.info.main, 0.25) : 'transparent',
                color: selectedSide === 'guest' ? theme.palette.info.main : alpha(white, 0.75),
                border: selectedSide === 'guest' ? `1px solid ${alpha(theme.palette.info.main, 0.4)}` : '1px solid transparent',
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
            {fieldPlayers.length > 0 ? (
              <Stack spacing={0.75}>
                {fieldPlayers.map((p) => renderPlayer(p))}
              </Stack>
            ) : (
              <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 3, fontSize: '0.85rem' }}>
                Žádní hráči v této sestavě
              </Typography>
            )}

            {coaches.length > 0 && (
              <Box sx={{ mt: 2.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1,
                    px: 0.5,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 900,
                      fontSize: '0.72rem',
                      color: alpha(white, 0.6),
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {coaches.length === 1 ? 'Trenér' : 'Realizační tým / Trenéři'}
                  </Typography>
                  <Box sx={{ flex: 1, height: '1px', bgcolor: alpha(white, 0.08) }} />
                </Box>
                <Stack spacing={0.75}>
                  {coaches.map((c) => renderPlayer(c))}
                </Stack>
              </Box>
            )}
          </Box>
        </AsyncBoundary>
      </Container>

      {/* Enlarged Player Detail Modal */}
      <PlayerDetailModal
        player={selectedPlayerModal}
        teamName={
          isGuestSide(selectedPlayerModal?.side)
            ? t('mobile.fan.lineup.guest')
            : t('mobile.fan.lineup.home')
        }
        onClose={() => setSelectedPlayerModal(null)}
      />
    </Box>
  );
}
