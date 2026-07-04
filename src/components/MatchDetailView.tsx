import { useMemo, useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Box,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Button,
  Snackbar,
  Alert,
  useTheme,
  alpha,
} from '@mui/material';
import {
  YouTube as YouTubeIcon,
  SportsSoccer as SportsSoccerIcon,
  Style as StyleIcon,
  LocalHospital as LocalHospitalIcon,
} from '@mui/icons-material';
import {
  MatchScoreboard,
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
  const { time: elapsed, phase, totalElapsed, running: isRunning, colonVisible, loaded: clockLoaded } = useLiveMatchClock(matchId, matchConfig);
  const { events, derivedState, loaded: timelineLoaded } = useTimeline(matchId, totalElapsed);

  // Fan notification surface: a Snackbar fires every time a new
  // highlightable event becomes time-visible. Uses the same shared burst
  // hook as the streaming overlay + scoreboard so live, replay-scrubbed,
  // and operator-corrected timelines all surface identically. The hook
  // primes its seen-set on first render so opening a finished match
  // doesn't cascade 16 banners across the screen, and queues concurrent
  // bursts (multiple events at the same `e.time`) so they pop one after
  // the other instead of collapsing into a single slot.
  const { current: latestBurst } = useTimelineEventBursts(events, totalElapsed, {
    durationMs: 6_000,
    types: ['goal', 'card', 'shootout_goal'],
    loaded: timelineLoaded,
    // `clockLoaded` gates the prime so cursor=0 (clock still loading)
    // can't mark every event as still-future and cascade-replay them
    // the moment the real cursor arrives.
    clockReady: clockLoaded,
  });
  // Suppress unknown-player bursts — operator-entered events without an
  // identified player (the OM "Neznámý" placeholder serializes to
  // `playerName = '? - ?'`) shouldn't ping a fan with a "?" notification.
  const isUnknownPlayer = (label?: string | null): boolean => {
    if (!label) return true;
    const parts = label.trim().split(' - ').map((p) => p.trim());
    return parts.every((p) => p === '' || p === '?');
  };
  const [activeNotification, setActiveNotification] = useState<typeof latestBurst | null>(null);
  useEffect(() => {
    if (latestBurst && !isUnknownPlayer(latestBurst.event.playerName)) {
      setActiveNotification(latestBurst);
    }
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
      {/* Detail scoreboard header — shared @fh/ui MatchScoreboard; the live clock
          / status chip stays app-owned (coupled to the live feed) via `clock`. */}
      <Box sx={{ mb: 4 }}>
        <MatchScoreboard
          live={isLive}
          league={match.leagueName}
          home={{ name: match.homeClubName ?? match.homeTeamName, logo: match.homeClubLogo ?? match.homeTeamLogo }}
          away={{ name: match.awayClubName ?? match.awayTeamName, logo: match.awayClubLogo ?? match.awayTeamLogo }}
          score={{ home: derivedState.score.home, away: derivedState.score.away }}
          dateLabel={matchDateStr}
          location={match.location}
          starred={starred}
          onToggleStar={onToggleStar}
          clock={
            isLive ? (
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
            )
          }
        />
      </Box>

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
            // Localized labels: 'card' includes the Czech color name so the fan
            // sees "KARTA (žlutá)" instead of "KARTA (yellow)". Color comes
            // from `event.event.card` which carries the operator's full-word
            // pick (`'green' | 'yellow' | 'red'`) from MatchEventsPage.
            const cardColorCz: Record<string, string> = { green: 'zelená', yellow: 'žlutá', red: 'červená' };
            const label = ev.type === 'goal' || ev.type === 'shootout_goal'
              ? 'GÓL'
              : ev.type === 'card'
                ? `KARTA (${cardColorCz[ev.event?.card] ?? ev.event?.card ?? '?'})`
                : ev.type.toUpperCase();
            return `${label} ${ev.minute ? `${ev.minute}' ` : ''}— ${side ?? ''} · ${ev.playerName ?? ''}`;
          })()}
        </Alert>
      </Snackbar>
    </Box>
  );
}
