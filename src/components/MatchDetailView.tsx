import { useMemo, useState } from 'react';
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
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  YouTube as YouTubeIcon,
} from '@mui/icons-material';

/**
 * CHANGE-055: lifted out of App.tsx; reused by MatchDetailPage at
 * `/<slug>/matches/<matchId>`. Single-row fetch by `supabaseId` (UUID) —
 * not slug-bound; anon RLS on `matches` already enforces tenant safety.
 */
export function MatchDetailView({
  matchId,
  starred,
  onToggleStar,
}: {
  matchId: string;
  starred: boolean;
  onToggleStar: (e: React.MouseEvent) => void;
}): JSX.Element {
  const [activeSegment, setActiveSegment] = useState(0);
  const match = useQuery(api.functions.matches.getBySupabaseId, { supabaseId: matchId });
  const events = useQuery(api.functions.matchTimeline.listEvents, { matchId });

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

  const score = useMemo(() => {
    const res = { home: 0, away: 0 };
    if (!events) return res;
    events.forEach((e: { type: string; side: string }) => {
      if (e.type === 'goal' || e.type === 'shootout_goal') {
        if (e.side === 'home') res.home++;
        else res.away++;
      }
    });
    return res;
  }, [events]);

  if (!match) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress color="success" />
      </Box>
    );
  }

  const cfg = (match as unknown as { config?: { youtubeVideoId?: string; youtubeUrl?: string } }).config;
  const youtubeVideoId = cfg?.youtubeVideoId || cfg?.youtubeUrl?.split('v=')[1];

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          bgcolor: isLive ? 'rgba(255,23,68,0.05)' : 'rgba(255,255,255,0.03)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 800 }}>
            {match.leagueName || 'LIGA'}
          </Typography>
          <IconButton
            size="small"
            onClick={onToggleStar}
            sx={{ color: starred ? '#4caf50' : 'rgba(255,255,255,0.3)' }}
          >
            {starred ? <StarIcon /> : <StarBorderIcon />}
          </IconButton>
        </Box>

        <Grid container alignItems="center" sx={{ my: 2 }}>
          <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar src={match.homeTeamLogo || undefined} sx={{ width: 56, height: 56, mb: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
              {match.homeTeamName[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#ffffff' }}>
              {match.homeTeamName}
            </Typography>
          </Grid>

          <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 900, color: '#ffffff', letterSpacing: '-2px' }}>
              {score.home} : {score.away}
            </Typography>
            {isLive ? (
              <Chip label="ŽIVĚ" color="error" size="small" sx={{ mt: 1, fontWeight: 900 }} />
            ) : (
              <Chip
                label={match.status === 'completed' ? 'Konec' : 'Naplánováno'}
                size="small"
                sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}
              />
            )}
          </Grid>

          <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Avatar src={match.awayTeamLogo || undefined} sx={{ width: 56, height: 56, mb: 1, bgcolor: 'rgba(255,255,255,0.05)' }}>
              {match.awayTeamName[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#ffffff' }}>
              {match.awayTeamName}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.06)' }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5, fontWeight: 600 }}>
          {matchDateStr}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
          {match.location}
        </Typography>
      </Paper>

      <Tabs
        value={activeSegment}
        onChange={(_e, val: number) => setActiveSegment(val)}
        centered
        sx={{
          mb: 3,
          '& .MuiTabs-indicator': { bgcolor: '#4caf50' },
          '& .MuiTab-root': { color: 'rgba(255,255,255,0.4)', '&.Mui-selected': { color: '#ffffff' } },
        }}
      >
        <Tab label="Průběh" />
        <Tab label="YouTube Stream" disabled={!youtubeVideoId} />
      </Tabs>

      {activeSegment === 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
            ČASOVÁ OSA UTKÁNÍ
          </Typography>

          {!events || events.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                Zatím nebyly zaznamenány žádné události zápasu.
              </Typography>
            </Paper>
          ) : (
            <Box>
              {[...events].sort((a, b) => b.minute - a.minute).map((e) => (
                <Box key={e._id} sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    {e.minute}&apos; — {e.type} ({e.side})
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {activeSegment === 1 && youtubeVideoId && (
        <Box>
          <Paper
            elevation={4}
            sx={{
              position: 'relative',
              paddingTop: '56.25%',
              overflow: 'hidden',
              bgcolor: '#000000',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <iframe
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Paper>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<YouTubeIcon />}
            href={`https://www.youtube.com/watch?v=${youtubeVideoId}`}
            target="_blank"
            sx={{ mt: 2, borderRadius: '12px' }}
          >
            Otevřít v aplikaci YouTube
          </Button>
        </Box>
      )}
    </Box>
  );
}
