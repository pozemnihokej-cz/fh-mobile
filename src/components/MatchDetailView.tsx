import { useMemo, useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Grid,
  Avatar,
  Divider,
  CircularProgress,
  Button,
  Snackbar,
  Alert,
  useTheme,
  alpha,
  Stack,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  YouTube as YouTubeIcon,
  SportsSoccer as SportsSoccerIcon,
  Style as StyleIcon,
  LocalHospital as LocalHospitalIcon,
} from '@mui/icons-material';
import {
  MatchTimeline,
  MatchClock,
  useTimeline,
  useLiveMatchClock,
  useTimelineEventBursts,
} from '@fh/ui';

export function MatchDetailView({
  matchId,
  starred,
  onToggleStar,
}: {
  matchId: string;
  starred: boolean;
  onToggleStar: (e: React.MouseEvent) => void;
}): JSX.Element {
  const theme = useTheme();
  const match = useQuery(api.functions.matches.getBySupabaseId, { supabaseId: matchId });
  const matchConfig = useMemo(() => {
    if (!match) return undefined;
    const cfg = (match as any).config;
    return {
      partType: cfg?.partType,
      gameTime: cfg?.gameTime,
      pauseTimes: cfg?.pauseTimes,
    };
  }, [match]);

  // Fan app is a read-only surface — use the display-only clock so we can't
  // accidentally fire operator mutations (start/pause/phase). The clock
  // returns the same drift-corrected fields the operator hook does, minus
  // the mutators. `totalElapsed` then drives time-bound score + suspensions
  // via the standard useTimeline derivation.
  const { time: elapsed, phase, totalElapsed, running: isRunning, colonVisible } = useLiveMatchClock(matchId, matchConfig);
  const { events, derivedState } = useTimeline(matchId, totalElapsed);

  // Fan notification surface: a Snackbar fires every time a new
  // highlightable event becomes time-visible. Uses the same shared burst
  // hook as the streaming overlay + scoreboard so live, replay-scrubbed,
  // and operator-corrected timelines all surface identically. The hook
  // primes its seen-set on first render so opening a finished match
  // doesn't cascade 16 banners across the screen.
  const { latest: latestBurst } = useTimelineEventBursts(events, totalElapsed, {
    durationMs: 6_000,
    types: ['goal', 'card', 'shootout_goal'],
  });
  const [activeNotification, setActiveNotification] = useState<typeof latestBurst | null>(null);
  useEffect(() => {
    if (latestBurst) setActiveNotification(latestBurst);
  }, [latestBurst?.firedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const isLive = match?.status === 'live';

  const matchDateStr = useMemo(() => {
    if (!match?.date) return '';
    const d = new Date(match.date);
    return d.toLocaleDateString('cs-CZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [match?.date]);

  if (!match) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const cfg = (match as unknown as { config?: { youtubeVideoId?: string; youtubeUrl?: string } }).config;
  const youtubeVideoId = cfg?.youtubeVideoId || cfg?.youtubeUrl?.split('v=')[1];

  return (
    <Box>
      {/* Detail scoreboard header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          bgcolor: isLive ? alpha(theme.palette.error.main, 0.08) : alpha(theme.palette.common.white, 0.03),
          borderRadius: '32px',
          border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative background glow */}
        <Box
          sx={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '80%',
            height: '100%',
            background: `radial-gradient(circle, ${alpha(isLive ? theme.palette.error.main : theme.palette.primary.main, 0.15)} 0%, transparent 70%)`,
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, position: 'relative', zIndex: 1 }}>
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 900, letterSpacing: '0.1em' }}>
            {match.leagueName || 'LIGA'}
          </Typography>
          <IconButton
            size="small"
            onClick={onToggleStar}
            sx={{ color: starred ? 'primary.main' : alpha(theme.palette.common.white, 0.2) }}
          >
            {starred ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </Box>

        <Grid container alignItems="center" sx={{ my: 2, position: 'relative', zIndex: 1 }}>
          <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar
              src={(match.homeClubLogo ?? match.homeTeamLogo) || undefined}
              sx={{ width: 64, height: 64, mb: 1.5, bgcolor: alpha(theme.palette.common.white, 0.05), boxShadow: '0 8px 24px rgba(0,0,0,0.3)', border: `2px solid ${alpha(theme.palette.common.white, 0.1)}` }}
            >
              {(match.homeClubName ?? match.homeTeamName)[0]}
            </Avatar>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#fff' }}>
              {match.homeClubName ?? match.homeTeamName}
            </Typography>
          </Grid>

          <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h2" sx={{ fontWeight: 950, color: '#fff', letterSpacing: '-3px', lineHeight: 1 }}>
              {derivedState.score.home} : {derivedState.score.away}
            </Typography>

            <Box sx={{ mt: 2 }}>
              {isLive ? (
                <MatchClock
                  seconds={elapsed}
                  phase={phase}
                  isRunning={isRunning}
                  colonVisible={colonVisible}
                  variant="fancy"
                />
              ) : (
                <Chip
                  label={match.status === 'completed' ? 'KONEC ZÁPASU' : 'NAPLÁNOVÁNO'}
                  sx={{
                    bgcolor: alpha(theme.palette.common.white, 0.1),
                    color: '#fff',
                    fontWeight: 900,
                    letterSpacing: '0.05em',
                    fontSize: '0.65rem',
                    height: 24,
                  }}
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar
              src={(match.awayClubLogo ?? match.awayTeamLogo) || undefined}
              sx={{ width: 64, height: 64, mb: 1.5, bgcolor: alpha(theme.palette.common.white, 0.05), boxShadow: '0 8px 24px rgba(0,0,0,0.3)', border: `2px solid ${alpha(theme.palette.common.white, 0.1)}` }}
            >
              {(match.awayClubName ?? match.awayTeamName)[0]}
            </Avatar>
            <Typography variant="subtitle2" sx={{ fontWeight: 900, color: '#fff' }}>
              {match.awayClubName ?? match.awayTeamName}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3, borderColor: alpha(theme.palette.common.white, 0.06), position: 'relative', zIndex: 1 }} />

        <Stack direction="row" spacing={2} justifyContent="center" sx={{ position: 'relative', zIndex: 1 }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700 }}>
              DATUM A ČAS
            </Typography>
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 800 }}>
              {matchDateStr}
            </Typography>
          </Box>
          <Box sx={{ width: 1, height: 'auto', bgcolor: alpha(theme.palette.common.white, 0.06) }} />
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontWeight: 700 }}>
              MÍSTO KONÁNÍ
            </Typography>
            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 800 }}>
              {match.location || 'Není uvedeno'}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Timeline Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="subtitle1" sx={{ mb: 2.5, fontWeight: 900, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 4, height: 16, bgcolor: 'primary.main', borderRadius: 1 }} />
          PRŮBĚH UTKÁNÍ
        </Typography>

        <MatchTimeline
          events={events}
          homeTeamName={match.homeTeamName}
          homeTeamLogo={match.homeTeamLogo}
          awayTeamName={match.awayTeamName}
          awayTeamLogo={match.awayTeamLogo}
          partType={matchConfig?.partType}
          variant="fancy"
        />
      </Box>

      {/* YouTube Section */}
      {youtubeVideoId && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" sx={{ mb: 2.5, fontWeight: 900, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 4, height: 16, bgcolor: '#ff0000', borderRadius: 1 }} />
            VIDEO PŘENOS
          </Typography>

          <Paper
            elevation={4}
            sx={{
              position: 'relative',
              paddingTop: '56.25%', // 16:9 Aspect Ratio
              overflow: 'hidden',
              bgcolor: '#000',
              borderRadius: '24px',
              border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            <iframe
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 0,
              }}
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Paper>

          <Button
            fullWidth
            variant="outlined"
            color="inherit"
            startIcon={<YouTubeIcon sx={{ color: '#ff0000' }} />}
            href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
            target="_blank"
            sx={{
              mt: 2,
              borderRadius: '16px',
              py: 1.5,
              fontWeight: 800,
              bgcolor: alpha(theme.palette.common.white, 0.03),
              borderColor: alpha(theme.palette.common.white, 0.1),
              '&:hover': {
                bgcolor: alpha(theme.palette.common.white, 0.08),
                borderColor: alpha(theme.palette.common.white, 0.2),
              }
            }}
          >
            Otevřít v aplikaci YouTube
          </Button>
        </Box>
      )}

      {/* Live event notifications — Snackbar fires when the shared burst hook
          surfaces a new highlightable event (goal / card / shootout goal). */}
      <Snackbar
        open={!!activeNotification}
        autoHideDuration={6_000}
        onClose={() => setActiveNotification(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setActiveNotification(null)}
          severity={activeNotification?.event.type === 'goal' || activeNotification?.event.type === 'shootout_goal' ? 'success' : 'warning'}
          icon={
            activeNotification?.event.type === 'goal' || activeNotification?.event.type === 'shootout_goal'
              ? <SportsSoccerIcon fontSize="inherit" />
              : activeNotification?.event.type === 'card'
                ? <StyleIcon fontSize="inherit" />
                : <LocalHospitalIcon fontSize="inherit" />
          }
          sx={{ width: '100%', fontWeight: 800, alignItems: 'center' }}
        >
          {activeNotification && (() => {
            const ev: any = activeNotification.event;
            const side = ev.side === 'home' ? (match?.homeClubName ?? match?.homeTeamName) : (match?.awayClubName ?? match?.awayTeamName);
            const label = ev.type === 'goal' || ev.type === 'shootout_goal' ? 'GÓL' : ev.type === 'card' ? `KARTA (${ev.event?.card ?? '?'})` : ev.type.toUpperCase();
            return `${label} ${ev.minute ? `${ev.minute}' ` : ''}— ${side ?? ''} · ${ev.playerName ?? ''}`;
          })()}
        </Alert>
      </Snackbar>
    </Box>
  );
}
