import {
  Dialog,
  Box,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Stack,
  alpha,
  useTheme,
} from '@mui/material';
import { FhIcon, focusRing } from '@fh/ui';
import { toImageUrl } from '../lib/runtimeUrls';
import { formatPositionCz } from '../lib/playerUtils';
import type { LineupPlayer } from '../lib/adapters/lineup';

export interface PlayerDetailModalProps {
  player: LineupPlayer | null;
  teamName?: string | null;
  teamLogo?: string | null;
  onClose: () => void;
}

export function PlayerDetailModal({
  player,
  teamName,
  teamLogo,
  onClose,
}: PlayerDetailModalProps): JSX.Element | null {
  const theme = useTheme();

  if (!player) return null;

  const positionLabel = formatPositionCz(player.position, player.isCoach);
  const imageUrl = toImageUrl(player.image);
  const isGuest = player.side === 'guest';
  const accentColor = isGuest ? theme.palette.info.main : theme.palette.primary.main;

  return (
    <Dialog
      open={!!player}
      onClose={onClose}
      data-testid="player-detail-modal"
      PaperProps={{
        sx: {
          borderRadius: '28px',
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.background.paper, 0.94),
          backdropFilter: 'blur(24px)',
          border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
          boxShadow: `0 24px 64px ${alpha(theme.palette.common.black, 0.75)}`,
          maxWidth: 360,
          width: '90%',
          m: 2,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          pt: 4,
          pb: 3.5,
          px: 3,
          textAlign: 'center',
          background: `radial-gradient(circle at 50% 0%, ${alpha(accentColor, 0.15)} 0%, transparent 70%)`,
        }}
      >
        {/* Close Button */}
        <IconButton
          onClick={onClose}
          aria-label="Zavřít detail hráče"
          size="small"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: alpha(theme.palette.common.white, 0.6),
            bgcolor: alpha(theme.palette.common.white, 0.06),
            '&:hover': {
              bgcolor: alpha(theme.palette.common.white, 0.12),
              color: 'common.white',
            },
            ...focusRing(theme),
          }}
        >
          <FhIcon name="close" sx={{ fontSize: '1.25rem' }} />
        </IconButton>

        {/* Large Avatar / Photo */}
        <Avatar
          src={imageUrl || undefined}
          alt={player.name}
          sx={{
            width: 128,
            height: 128,
            mx: 'auto',
            mb: 2.5,
            bgcolor: alpha(theme.palette.common.white, 0.08),
            color: accentColor,
            fontSize: '3rem',
            fontWeight: 900,
            border: `3px solid ${alpha(accentColor, 0.4)}`,
            boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.5)}`,
          }}
        >
          {player.jersey ? (
            player.jersey
          ) : (
            <FhIcon name="roster" sx={{ fontSize: '3.5rem', color: alpha(theme.palette.common.white, 0.5) }} />
          )}
        </Avatar>

        {/* Jersey Number Tag */}
        {player.jersey && (
          <Typography
            sx={{
              display: 'inline-block',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 900,
              fontSize: '1rem',
              color: accentColor,
              bgcolor: alpha(accentColor, 0.15),
              px: 1.25,
              py: 0.25,
              borderRadius: '8px',
              mb: 1,
              letterSpacing: '0.04em',
            }}
          >
            #{player.jersey}
          </Typography>
        )}

        {/* Player Name */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 900,
            color: 'common.white',
            mb: 0.5,
            lineHeight: 1.2,
          }}
        >
          {player.name}
        </Typography>

        {/* Team Name and Logo */}
        {teamName && (
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            justifyContent="center"
            sx={{ mb: 2 }}
          >
            {teamLogo && (
              <Box
                component="img"
                src={toImageUrl(teamLogo) || undefined}
                alt=""
                sx={{ width: 18, height: 18, objectFit: 'contain' }}
              />
            )}
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                color: alpha(theme.palette.common.white, 0.7),
                fontSize: '0.85rem',
              }}
            >
              {teamName}
            </Typography>
          </Stack>
        )}

        {/* Tags / Chips (Position, Captain, Coach) */}
        <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ gap: 1 }}>
          {player.isCaptain && (
            <Chip
              label="Kapitán (C)"
              size="small"
              sx={{
                height: 24,
                fontWeight: 800,
                fontSize: '0.72rem',
                bgcolor: alpha(theme.palette.primary.main, 0.2),
                color: 'primary.main',
                border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
              }}
            />
          )}
          {positionLabel && (
            <Chip
              label={positionLabel}
              size="small"
              sx={{
                height: 24,
                fontWeight: 700,
                fontSize: '0.72rem',
                bgcolor: alpha(theme.palette.common.white, 0.08),
                color: 'common.white',
                border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
              }}
            />
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}
