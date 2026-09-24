import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Button,
  Snackbar,
  Stack,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import {
  MatchScoreboard,
  MatchTimeline,
  MatchClock,
  LiveEventToast,
  EmptyState,
  MatchCardSkeleton,
  FhIcon,
  useTimeline,
  useLiveMatchClock,
  useTimelineEventBursts,
  typeScale,
  focusRing,
} from '@fh/ui';
import { isMatchGenuinelyLive } from '@fh/schema';
import { toImageUrl } from '../lib/runtimeUrls';
import { supabase } from '../lib/supabase';
import { useAsyncData } from '../lib/useAsyncData';
import { fetchLineup, groupLineup, type LineupPlayer } from '../lib/adapters/lineup';
import { PlayerDetailModal } from './PlayerDetailModal';
import { formatPositionCz } from '../lib/playerUtils';

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
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const [tunnelTab, setTunnelTab] = useState<'timeline' | 'overview' | 'roster'>('timeline');
  const [rosterSide, setRosterSide] = useState<'home' | 'guest'>('home');
  const [selectedPlayerModal, setSelectedPlayerModal] = useState<LineupPlayer | null>(null);

  const handleTabChange = (tab: 'timeline' | 'overview' | 'roster') => {
    setTunnelTab(tab);
  };

  const match = useQuery(api.functions.matches.getBySupabaseId, { supabaseId: matchId });
  const canonicalMatchId = match?.supabaseId ?? matchId;
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
  // accidentally fire operator mutations (start/pause/phase).
  const { time: elapsed, phase, totalElapsed, running: isRunning, colonVisible, loaded: clockLoaded } = useLiveMatchClock(canonicalMatchId, matchConfig);
  const { events, derivedState, loaded: timelineLoaded } = useTimeline(canonicalMatchId, totalElapsed);

  // Convex live query for match roster (OM parity — holds complete rosters)
  const rosterQuery = (api as any)?.functions?.roster?.list;
  const convexRoster = useQuery(
    rosterQuery ?? ('skip' as any),
    canonicalMatchId && rosterQuery ? { matchId: canonicalMatchId } : 'skip',
  );

  // Lineup fetch for the integrated in-tunnel roster tab — fallback to Supabase / Convex HTTP
  const { data: lineupData } = useAsyncData(
    () => fetchLineup(supabase, canonicalMatchId),
    [canonicalMatchId],
    Boolean(canonicalMatchId),
  );
  const lineup = useMemo(() => {
    if (Array.isArray(convexRoster) && convexRoster.length > 0) {
      return groupLineup(convexRoster as any);
    }
    return lineupData ?? { home: [], guest: [] };
  }, [convexRoster, lineupData]);
  const currentPlayers = rosterSide === 'home' ? lineup.home : lineup.guest;

  // Fan notification surface: a Snackbar fires every time a new
  // highlightable event becomes time-visible.
  const { current: latestBurst } = useTimelineEventBursts(events, totalElapsed, {
    durationMs: 6_000,
    types: ['goal', 'card', 'shootout_goal'],
    loaded: timelineLoaded,
    clockReady: clockLoaded,
  });

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

  // Genuine liveness derivation
  const isLive = isMatchGenuinelyLive({
    status: (match as { status?: string } | null | undefined)?.status,
    scheduledDate: (match as { date?: number } | null | undefined)?.date,
    startedAt: (match as { startedAt?: number | null } | null | undefined)?.startedAt ?? null,
    now: Date.now(),
  });

  // When match has no timeline events and is not live, roster is the primary interesting tab
  const hasTimelineEvents = events && events.length > 0;
  useEffect(() => {
    if (!isLive && !hasTimelineEvents && timelineLoaded) {
      setTunnelTab('roster');
    }
  }, [isLive, hasTimelineEvents, timelineLoaded]);

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

  if (match === undefined) {
    return (
      <Box sx={{ py: 2 }}>
        <MatchCardSkeleton count={1} />
      </Box>
    );
  }
  if (match === null) {
    return (
      <EmptyState
        icon={<FhIcon name="hockey" sx={{ fontSize: 44 }} />}
        title="Zápas nenalezen"
        description="Tento zápas neexistuje nebo byl odstraněn."
      />
    );
  }

  const cfg = (match as unknown as { config?: { youtubeVideoId?: string; youtubeUrl?: string } }).config;
  const youtubeVideoId = cfg?.youtubeVideoId || cfg?.youtubeUrl?.split('v=')[1];

  const renderPlayerRow = (p: LineupPlayer): JSX.Element => {
    const positionLabel = formatPositionCz(p.position, p.isCoach);
    const imageUrl = toImageUrl(p.image);

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
          bgcolor: alpha(theme.palette.common.white, 0.04),
          border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: alpha(theme.palette.common.white, 0.08),
            borderColor: alpha(theme.palette.primary.main, 0.35),
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
            bgcolor: alpha(theme.palette.common.white, 0.08),
            color: 'common.white',
            fontWeight: 900,
            fontSize: '0.85rem',
            flexShrink: 0,
            border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
          }}
        >
          {p.isCoach ? (
            <FhIcon name="roster" inline sx={{ fontSize: '1rem' }} />
          ) : (
            p.jersey || '–'
          )}
        </Avatar>

        {/* Jersey number */}
        {p.jersey && (
          <Typography
            sx={{
              ...typeScale.bodyStrong,
              fontSize: '0.82rem',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 900,
              color: alpha(theme.palette.common.white, 0.6),
              minWidth: 20,
              textAlign: 'center',
            }}
          >
            {p.jersey}
          </Typography>
        )}

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

        {/* Chips */}
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
          {positionLabel && (
            <Chip
              label={positionLabel}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: alpha(theme.palette.common.white, 0.06),
                color: 'text.secondary',
                border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Stack>
      </Box>
    );
  };

  return (
    <Box>
      {/* Detail scoreboard header — compact OM-style banner */}
      <Box sx={{ mb: 2.5 }}>
        <MatchScoreboard
          compact
          live={isLive}
          league={match.leagueName}
          home={{ name: match.homeTeamName || match.homeClubName || 'Domácí', logo: toImageUrl(match.homeClubLogo ?? match.homeTeamLogo) }}
          away={{ name: match.awayTeamName || match.awayClubName || 'Hosté', logo: toImageUrl(match.awayClubLogo ?? match.awayTeamLogo) }}
          score={
            isLive || match.status === 'completed' || (match.status === 'in_progress' && !isLive)
              ? { home: derivedState.score.home, away: derivedState.score.away }
              : null
          }
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

      {/* Segmented Tunnel Navigation Tabs */}
      <Box
        ref={tabBarRef}
        sx={{
          display: 'flex',
          bgcolor: alpha(theme.palette.common.white, 0.05),
          p: 0.5,
          borderRadius: '14px',
          mb: 3,
          border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
          scrollMarginTop: { xs: '64px', sm: '76px' },
        }}
      >
        <Button
          fullWidth
          onClick={() => handleTabChange('timeline')}
          sx={{
            py: 0.8,
            borderRadius: '10px',
            bgcolor: tunnelTab === 'timeline' ? alpha(theme.palette.primary.main, 0.25) : 'transparent',
            color: tunnelTab === 'timeline' ? 'primary.main' : alpha(theme.palette.common.white, 0.75),
            border: tunnelTab === 'timeline' ? `1px solid ${alpha(theme.palette.primary.main, 0.4)}` : '1px solid transparent',
            fontWeight: 800,
            fontSize: '0.82rem',
            textTransform: 'none',
            transition: 'all 0.15s ease',
            ...focusRing(theme),
          }}
        >
          Průběh
        </Button>
        <Button
          fullWidth
          onClick={() => handleTabChange('overview')}
          sx={{
            py: 0.8,
            borderRadius: '10px',
            bgcolor: tunnelTab === 'overview' ? alpha(theme.palette.primary.main, 0.25) : 'transparent',
            color: tunnelTab === 'overview' ? 'primary.main' : alpha(theme.palette.common.white, 0.75),
            border: tunnelTab === 'overview' ? `1px solid ${alpha(theme.palette.primary.main, 0.4)}` : '1px solid transparent',
            fontWeight: 800,
            fontSize: '0.82rem',
            textTransform: 'none',
            transition: 'all 0.15s ease',
            ...focusRing(theme),
          }}
        >
          Přehled
        </Button>
        <Button
          fullWidth
          onClick={() => handleTabChange('roster')}
          sx={{
            py: 0.8,
            borderRadius: '10px',
            bgcolor: tunnelTab === 'roster' ? alpha(theme.palette.primary.main, 0.25) : 'transparent',
            color: tunnelTab === 'roster' ? 'primary.main' : alpha(theme.palette.common.white, 0.75),
            border: tunnelTab === 'roster' ? `1px solid ${alpha(theme.palette.primary.main, 0.4)}` : '1px solid transparent',
            fontWeight: 800,
            fontSize: '0.82rem',
            textTransform: 'none',
            transition: 'all 0.15s ease',
            ...focusRing(theme),
          }}
        >
          Soupisky
        </Button>
      </Box>

      {/* Tab: Průběh (Timeline) */}
      {tunnelTab === 'timeline' && (
        <Box sx={{ mb: 4 }}>
          {/* Active Penalties strip */}
          {derivedState.activeSuspensions && derivedState.activeSuspensions.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                p: 1.75,
                mb: 2.5,
                borderRadius: '16px',
                bgcolor: alpha(theme.palette.warning.main, 0.12),
                border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.warning.light ?? '#ffd600',
                  fontWeight: 900,
                  letterSpacing: '0.08em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1.25,
                }}
              >
                <FhIcon name="timer" inline sx={{ fontSize: '1rem' }} />
                AKTUÁLNĚ VYLOUČENÍ
              </Typography>
              <Stack spacing={1}>
                {derivedState.activeSuspensions.map((s) => {
                  const min = Math.floor(s.remainingSeconds / 60);
                  const sec = s.remainingSeconds % 60;
                  const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
                  const teamName = s.side === 'home'
                    ? (match.homeTeamName || match.homeClubName || 'Domácí')
                    : (match.awayTeamName || match.awayClubName || 'Hosté');
                  return (
                    <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 10,
                            height: 14,
                            borderRadius: '3px',
                            bgcolor: s.cardColor === 'yellow' ? '#ffd600' : s.cardColor === 'green' ? '#4caf50' : '#ff5252',
                          }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'common.white', fontSize: '0.85rem' }}>
                          {s.player || 'Hráč'} <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.78rem' }}>({teamName})</Typography>
                        </Typography>
                      </Box>
                      <Chip
                        label={`Zbývá ${timeStr}`}
                        size="small"
                        sx={{
                          height: 22,
                          fontWeight: 900,
                          fontSize: '0.72rem',
                          bgcolor: alpha(theme.palette.warning.main, 0.25),
                          color: theme.palette.warning.light ?? '#ffd600',
                          border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                        }}
                      />
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
          )}

          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 900, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1.25, letterSpacing: '0.04em' }}>
            <Box sx={{ width: 4, height: 16, bgcolor: 'primary.main', borderRadius: 1 }} />
            ČASOVÁ OSA UTKÁNÍ
          </Typography>

          <MatchTimeline
            events={events}
            homeTeamName={match.homeTeamName}
            homeTeamLogo={match.homeTeamLogo}
            awayTeamName={match.awayTeamName}
            awayTeamLogo={match.awayTeamLogo}
            partType={matchConfig?.partType}
            gameTime={matchConfig?.gameTime}
            variant="fancy"
            activeSuspensions={derivedState.activeSuspensions}
          />
        </Box>
      )}

      {/* Tab: Přehled (Overview) */}
      {tunnelTab === 'overview' && (
        <Box sx={{ mb: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 3,
              borderRadius: '16px',
              bgcolor: alpha(theme.palette.common.white, 0.04),
              border: `1px solid ${alpha(theme.palette.common.white, 0.08)}`,
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.05em', display: 'block', mb: 1 }}>
              INFORMACE O UTKÁNÍ
            </Typography>
            <Stack spacing={1.25}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>Soutěž</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: 'common.white', fontSize: '0.82rem' }}>{match.leagueName || '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>Datum a čas</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: 'common.white', fontSize: '0.82rem' }}>{matchDateStr || '—'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>Místo konání</Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, color: 'common.white', fontSize: '0.82rem' }}>{match.location || 'Není uvedeno'}</Typography>
              </Box>
            </Stack>
          </Paper>

          {/* YouTube Video Section */}
          {youtubeVideoId && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 900, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1.25 }}>
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
                  borderRadius: '20px',
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
                startIcon={<FhIcon name="youtube" />}
                href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
                target="_blank"
                sx={{
                  mt: 1.5,
                  borderRadius: '14px',
                  py: 1.2,
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  bgcolor: alpha(theme.palette.common.white, 0.03),
                  borderColor: alpha(theme.palette.common.white, 0.1),
                  '&:hover': {
                    bgcolor: alpha(theme.palette.common.white, 0.08),
                    borderColor: alpha(theme.palette.common.white, 0.2),
                  },
                }}
              >
                Otevřít v aplikaci YouTube
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* Tab: Soupisky (Integrated Roster) */}
      {tunnelTab === 'roster' && (
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: 'flex',
              bgcolor: alpha(theme.palette.common.white, 0.04),
              p: 0.5,
              borderRadius: '12px',
              mb: 2,
              border: `1px solid ${alpha(theme.palette.common.white, 0.06)}`,
            }}
          >
            <Button
              fullWidth
              onClick={() => setRosterSide('home')}
              sx={{
                ...focusRing(theme),
                py: 0.7,
                borderRadius: '8px',
                bgcolor: rosterSide === 'home' ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
                color: rosterSide === 'home' ? 'primary.main' : alpha(theme.palette.common.white, 0.7),
                border: rosterSide === 'home' ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}` : '1px solid transparent',
                fontWeight: 800,
                fontSize: '0.8rem',
                textTransform: 'none',
              }}
              startIcon={
                <Avatar
                  src={toImageUrl(match.homeClubLogo ?? match.homeTeamLogo) || undefined}
                  variant={match.homeClubLogo || match.homeTeamLogo ? 'rounded' : 'circular'}
                  imgProps={{ style: { objectFit: 'contain' } }}
                  sx={{
                    width: 22,
                    height: 22,
                    bgcolor: 'transparent',
                    border: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                  }}
                >
                  {(match.homeTeamName || match.homeClubName || 'D')[0]}
                </Avatar>
              }
            >
              {match.homeTeamName} {lineup.home.length > 0 && `(${lineup.home.length})`}
            </Button>
            <Button
              fullWidth
              onClick={() => setRosterSide('guest')}
              sx={{
                ...focusRing(theme),
                py: 0.7,
                borderRadius: '8px',
                bgcolor: rosterSide === 'guest' ? alpha(theme.palette.primary.main, 0.2) : 'transparent',
                color: rosterSide === 'guest' ? 'primary.main' : alpha(theme.palette.common.white, 0.7),
                border: rosterSide === 'guest' ? `1px solid ${alpha(theme.palette.primary.main, 0.3)}` : '1px solid transparent',
                fontWeight: 800,
                fontSize: '0.8rem',
                textTransform: 'none',
              }}
              startIcon={
                <Avatar
                  src={toImageUrl(match.awayClubLogo ?? match.awayTeamLogo) || undefined}
                  variant={match.awayClubLogo || match.awayTeamLogo ? 'rounded' : 'circular'}
                  imgProps={{ style: { objectFit: 'contain' } }}
                  sx={{
                    width: 22,
                    height: 22,
                    bgcolor: 'transparent',
                    border: 'none',
                    fontSize: '0.72rem',
                    fontWeight: 900,
                  }}
                >
                  {(match.awayTeamName || match.awayClubName || 'H')[0]}
                </Avatar>
              }
            >
              {match.awayTeamName} {lineup.guest.length > 0 && `(${lineup.guest.length})`}
            </Button>
          </Box>

          <Box sx={{ mb: 2 }}>
            {currentPlayers.length > 0 ? (
              <Stack spacing={0.75}>
                {currentPlayers.map((p) => renderPlayerRow(p))}
              </Stack>
            ) : (
              <Typography sx={{ textAlign: 'center', color: 'text.secondary', py: 3, fontSize: '0.85rem' }}>
                Žádní hráči v této sestavě
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Live event notifications — Snackbar */}
      <Snackbar
        open={!!activeNotification}
        autoHideDuration={6_000}
        onClose={() => setActiveNotification(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {activeNotification ? (() => {
          const ev: any = activeNotification.event;
          const side = ev.side === 'home' ? (match?.homeTeamName || match?.homeClubName) : (match?.awayTeamName || match?.awayClubName);
          const isGoal = ev.type === 'goal' || ev.type === 'shootout_goal';
          const cardColorCz: Record<string, string> = { green: 'zelená', yellow: 'žlutá', red: 'červená' };
          const label = isGoal
            ? 'GÓL'
            : ev.type === 'card'
              ? `KARTA (${cardColorCz[ev.event?.card] ?? ev.event?.card ?? '?'})`
              : ev.type.toUpperCase();
          return (
            <Box role="alert">
              <LiveEventToast
                tone={isGoal ? 'goal' : ev.type === 'card' ? 'card' : 'info'}
                icon={isGoal ? <FhIcon name="goal" sx={{ fontSize: 'inherit' }} /> : ev.type === 'card' ? <FhIcon name="card" sx={{ fontSize: 'inherit' }} /> : <FhIcon name="injury" sx={{ fontSize: 'inherit' }} />}
                title={`${label} ${ev.minute ? `${ev.minute}' ` : ''}— ${side ?? ''}`}
                subtitle={ev.playerName ?? ''}
              />
            </Box>
          );
        })() : undefined}
      </Snackbar>

      {/* Enlarged Player Detail Modal */}
      <PlayerDetailModal
        player={selectedPlayerModal}
        teamName={
          selectedPlayerModal?.side === 'guest'
            ? (match.awayTeamName || match.awayClubName)
            : (match.homeTeamName || match.homeClubName)
        }
        teamLogo={
          selectedPlayerModal?.side === 'guest'
            ? (match.awayClubLogo ?? match.awayTeamLogo)
            : (match.homeClubLogo ?? match.homeTeamLogo)
        }
        onClose={() => setSelectedPlayerModal(null)}
      />
    </Box>
  );
}
