import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Card,
  CardContent,
  Avatar,
  Grid,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  BottomNavigation,
  BottomNavigationAction,
} from '@mui/material';
import {
  Home as HomeIcon,
  CalendarMonth as CalendarIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Search as SearchIcon,
  YouTube as YouTubeIcon,
  SportsHockey as HockeyIcon,
  PlayCircle as PlayIcon,
  ArrowBack as BackIcon,
  Info as InfoIcon,
  NotificationsActive as AlertIcon,
} from '@mui/icons-material';

// Standard match status type
type MatchStatus = 'scheduled' | 'live' | 'completed';

// Interactive timeline event types
interface TimelineEvent {
  _id: string;
  type: 'goal' | 'card' | 'shootout_goal' | 'suspension' | string;
  minute: number;
  side: 'home' | 'away';
  playerName?: string;
  time?: number;
  event?: {
    card?: 'green' | 'yellow' | 'red';
    duration?: number;
  };
}

export default function App() {
  // Navigation: 0 = Domů/Live, 1 = Program/Výsledky, 2 = Moje kluby/Oblíbené
  const [activeTab, setActiveTab] = useState(0);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [myClubs, setMyClubs] = useState<string[]>(() => {
    const saved = localStorage.getItem('fh_my_clubs');
    return saved ? JSON.parse(saved) : [];
  });
  const [starredMatches, setStarredMatches] = useState<string[]>(() => {
    const saved = localStorage.getItem('fh_starred_matches');
    return saved ? JSON.parse(saved) : [];
  });
  const [clubInput, setClubInput] = useState('');

  // Fetch matches from Convex (using list query)
  const matches = useQuery(api.functions.matches.list, {});

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('fh_my_clubs', JSON.stringify(myClubs));
  }, [myClubs]);

  useEffect(() => {
    localStorage.setItem('fh_starred_matches', JSON.stringify(starredMatches));
  }, [starredMatches]);

  const toggleStarMatch = (matchId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setStarredMatches((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  };

  const handleAddClub = () => {
    if (clubInput.trim() && !myClubs.includes(clubInput.trim())) {
      setMyClubs((prev) => [...prev, clubInput.trim()]);
      setClubInput('');
    }
  };

  const handleRemoveClub = (clubName: string) => {
    setMyClubs((prev) => prev.filter((c) => c !== clubName));
  };

  // Filter matches based on the selected tab and queries
  const processedMatches = useMemo(() => {
    if (!matches) return [];

    let filtered = [...matches];

    // Subscribed/favorite club filter for My Clubs tab
    if (activeTab === 2 && myClubs.length > 0) {
      filtered = filtered.filter(
        (m) =>
          myClubs.some((c) => m.homeTeamName.toLowerCase().includes(c.toLowerCase())) ||
          myClubs.some((c) => m.awayTeamName.toLowerCase().includes(c.toLowerCase()))
      );
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.homeTeamName.toLowerCase().includes(q) ||
          m.awayTeamName.toLowerCase().includes(q) ||
          (m.leagueName && m.leagueName.toLowerCase().includes(q)) ||
          (m.location && m.location.toLowerCase().includes(q))
      );
    }

    return filtered.sort((a, b) => b.date - a.date);
  }, [matches, activeTab, searchQuery, myClubs]);

  // Separate live, upcoming, and past matches
  const liveMatches = useMemo(() => {
    return (matches ?? []).filter((m) => m.status === 'live');
  }, [matches]);

  const upcomingMatches = useMemo(() => {
    return (matches ?? []).filter((m) => m.status === 'scheduled').sort((a, b) => a.date - b.date);
  }, [matches]);

  const finishedMatches = useMemo(() => {
    return (matches ?? []).filter((m) => m.status === 'completed').sort((a, b) => b.date - a.date);
  }, [matches]);

  return (
    <Box sx={{ pb: 8, minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#121212' }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          py: 2,
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: 'rgba(18, 18, 18, 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 0,
        }}
      >
        <Container maxWidth="xs" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {selectedMatchId ? (
            <IconButton onClick={() => setSelectedMatchId(null)} sx={{ color: '#ffffff' }}>
              <BackIcon />
            </IconButton>
          ) : (
            <HockeyIcon sx={{ color: '#4caf50', fontSize: 32 }} />
          )}

          <Typography
            variant="h6"
            sx={{
              fontWeight: 900,
              letterSpacing: '-0.5px',
              background: 'linear-gradient(45deg, #4caf50 30%, #81c784 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {selectedMatchId ? 'Detail Zápasu' : 'FH FANZONE'}
          </Typography>

          <Box sx={{ width: 40 }} />
        </Container>
      </Paper>

      {/* Main Content */}
      <Container maxWidth="xs" sx={{ flexGrow: 1, py: 2 }}>
        {selectedMatchId ? (
          <MatchDetailView
            matchId={selectedMatchId}
            starred={starredMatches.includes(selectedMatchId)}
            onToggleStar={(e) => toggleStarMatch(selectedMatchId, e)}
          />
        ) : (
          <>
            {/* Search (only on matches & schedule tabs) */}
            {activeTab !== 2 && (
              <TextField
                fullWidth
                size="small"
                placeholder="Hledat týmy, soutěže, místa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  },
                  input: { color: '#ffffff' },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.4)' }} />
                    </InputAdornment>
                  ),
                }}
              />
            )}

            {/* Tab contents */}
            {activeTab === 0 && (
              <Box>
                {/* Live Section */}
                {liveMatches.length > 0 && (
                  <Box sx={{ mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#ff1744',
                          animation: 'pulse 1.5s infinite',
                          '@keyframes pulse': {
                            '0%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 23, 68, 0.7)' },
                            '70%': { transform: 'scale(1)', boxShadow: '0 0 0 6px rgba(255, 23, 68, 0)' },
                            '100%': { transform: 'scale(0.95)', boxShadow: '0 0 0 0 rgba(255, 23, 68, 0)' },
                          },
                        }}
                      />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ff1744' }}>
                        ŽIVÉ ZÁPASY
                      </Typography>
                    </Box>
                    {liveMatches.map((m) => (
                      <MatchCard
                        key={m._id}
                        match={m}
                        isStarred={starredMatches.includes(m.supabaseId)}
                        onToggleStar={(e) => toggleStarMatch(m.supabaseId, e)}
                        onClick={() => setSelectedMatchId(m.supabaseId)}
                      />
                    ))}
                  </Box>
                )}

                {/* Starred Matches Section */}
                {starredMatches.length > 0 && (
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: '#4caf50', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StarIcon fontSize="small" /> OBLÍBENÉ ZÁPASY
                    </Typography>
                    {processedMatches
                      .filter((m) => starredMatches.includes(m.supabaseId))
                      .slice(0, 3)
                      .map((m) => (
                        <MatchCard
                          key={m._id}
                          match={m}
                          isStarred={true}
                          onToggleStar={(e) => toggleStarMatch(m.supabaseId, e)}
                          onClick={() => setSelectedMatchId(m.supabaseId)}
                        />
                      ))}
                  </Box>
                )}

                {/* General Match List */}
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
                  NEJBLIŽŠÍ PROGRAM
                </Typography>
                {upcomingMatches.length === 0 && !matches ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress color="success" />
                  </Box>
                ) : upcomingMatches.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', py: 3 }}>
                    Žádné blížící se zápasy v programu.
                  </Typography>
                ) : (
                  upcomingMatches.slice(0, 5).map((m) => (
                    <MatchCard
                      key={m._id}
                      match={m}
                      isStarred={starredMatches.includes(m.supabaseId)}
                      onToggleStar={(e) => toggleStarMatch(m.supabaseId, e)}
                      onClick={() => setSelectedMatchId(m.supabaseId)}
                    />
                  ))
                )}
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
                  PŘEHLED VŠECH UTKÁNÍ
                </Typography>
                {processedMatches.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', py: 5 }}>
                    Nebyly nalezeny žádné zápasy odpovídající vyhledávání.
                  </Typography>
                ) : (
                  processedMatches.map((m) => (
                    <MatchCard
                      key={m._id}
                      match={m}
                      isStarred={starredMatches.includes(m.supabaseId)}
                      onToggleStar={(e) => toggleStarMatch(m.supabaseId, e)}
                      onClick={() => setSelectedMatchId(m.supabaseId)}
                    />
                  ))
                )}
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
                  MOJE OBLÍBENÉ KLUBY
                </Typography>

                <Paper
                  sx={{
                    p: 2,
                    mb: 3,
                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 2 }}>
                    Odebírejte své oblíbené kluby pro snadný a rychlý přehled jejich zápasů.
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Název klubu (např. Hostivař)"
                      value={clubInput}
                      onChange={(e) => setClubInput(e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '8px',
                          bgcolor: 'rgba(255, 255, 255, 0.02)',
                        },
                        input: { color: '#ffffff' },
                      }}
                    />
                    <Button variant="contained" color="success" onClick={handleAddClub}>
                      Přidat
                    </Button>
                  </Box>

                  {myClubs.length > 0 && (
                    <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {myClubs.map((club) => (
                        <Chip
                          key={club}
                          label={club}
                          onDelete={() => handleRemoveClub(club)}
                          sx={{
                            bgcolor: 'rgba(76, 175, 80, 0.2)',
                            color: '#81c784',
                            border: '1px solid rgba(76, 175, 80, 0.3)',
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </Paper>

                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: '#4caf50' }}>
                  ZÁPASY MÝCH KLUBŮ
                </Typography>

                {myClubs.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', py: 4 }}>
                    Přidejte své kluby pro zobrazení jejich rozpisu zápasů.
                  </Typography>
                ) : processedMatches.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', textAlign: 'center', py: 4 }}>
                    Žádné zápasy pro vybrané kluby nebyly nalezeny.
                  </Typography>
                ) : (
                  processedMatches.map((m) => (
                    <MatchCard
                      key={m._id}
                      match={m}
                      isStarred={starredMatches.includes(m.supabaseId)}
                      onToggleStar={(e) => toggleStarMatch(m.supabaseId, e)}
                      onClick={() => setSelectedMatchId(m.supabaseId)}
                    />
                  ))
                )}
              </Box>
            )}
          </>
        )}
      </Container>

      {/* Bottom Nav Bar */}
      {!selectedMatchId && (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            bgcolor: '#121212',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 0,
            zIndex: 1100,
          }}
        >
          <BottomNavigation
            showLabels
            value={activeTab}
            onChange={(event, newValue) => setActiveTab(newValue)}
            sx={{
              bgcolor: 'transparent',
              '& .MuiBottomNavigationAction-root': {
                color: 'rgba(255, 255, 255, 0.4)',
                '&.Mui-selected': { color: '#4caf50' },
              },
            }}
          >
            <BottomNavigationAction label="Hlavní / Živě" icon={<HomeIcon />} />
            <BottomNavigationAction label="Program" icon={<CalendarIcon />} />
            <BottomNavigationAction label="Moje kluby" icon={<StarIcon />} />
          </BottomNavigation>
        </Paper>
      )}
    </Box>
  );
}

// Compact premium Match Card Component
function MatchCard({
  match,
  isStarred,
  onToggleStar,
  onClick,
}: {
  match: any;
  isStarred: boolean;
  onToggleStar: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const matchDateStr = useMemo(() => {
    const d = new Date(match.date);
    return d.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [match.date]);

  const isLive = match.status === 'live';

  return (
    <Card
      onClick={onClick}
      sx={{
        mb: 2,
        bgcolor: isLive ? 'rgba(255, 23, 68, 0.04)' : 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        border: isLive
          ? '1px solid rgba(255, 23, 68, 0.2)'
          : '1px solid rgba(255, 255, 255, 0.06)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          borderColor: isLive ? 'rgba(255, 23, 68, 0.4)' : 'rgba(255, 255, 255, 0.15)',
        },
      }}
    >
      <CardContent sx={{ p: '16px !important' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600 }}>
            {match.leagueName || 'Soutěž'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isLive ? (
              <Chip
                label="ŽIVĚ"
                size="small"
                sx={{
                  bgcolor: '#ff1744',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '10px',
                  height: '20px',
                }}
              />
            ) : (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600 }}>
                {matchDateStr}
              </Typography>
            )}

            <IconButton size="small" onClick={onToggleStar} sx={{ color: isStarred ? '#4caf50' : 'rgba(255, 255, 255, 0.3)' }}>
              {isStarred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>

        <Grid container spacing={1} alignItems="center" sx={{ my: 1 }}>
          <Grid item xs={5} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Avatar
              src={match.homeTeamLogo || undefined}
              sx={{ width: 44, height: 44, mb: 1, bgcolor: 'rgba(255, 255, 255, 0.05)' }}
            >
              {match.homeTeamName[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>
              {match.homeTeamName}
            </Typography>
          </Grid>

          <Grid item xs={2} sx={{ textAlign: 'center' }}>
            {isLive ? (
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#ffffff', letterSpacing: '-1px' }}>
                  {match.score?.home ?? 0} : {match.score?.away ?? 0}
                </Typography>
                <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 700, display: 'block', mt: 0.5 }}>
                  {match.liveState?.phase || 'Běží'}
                </Typography>
              </Box>
            ) : match.status === 'completed' ? (
              <Typography variant="h6" sx={{ fontWeight: 900, color: 'rgba(255, 255, 255, 0.8)' }}>
                {match.score?.home ?? 0} : {match.score?.away ?? 0}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 700 }}>
                VS
              </Typography>
            )}
          </Grid>

          <Grid item xs={5} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <Avatar
              src={match.awayTeamLogo || undefined}
              sx={{ width: 44, height: 44, mb: 1, bgcolor: 'rgba(255, 255, 255, 0.05)' }}
            >
              {match.awayTeamName[0]}
            </Avatar>
            <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '13px', color: '#ffffff' }}>
              {match.awayTeamName}
            </Typography>
          </Grid>
        </Grid>

        {match.location && (
          <Box sx={{ mt: 1.5, borderTop: '1px solid rgba(255, 255, 255, 0.04)', pt: 1, display: 'flex', justifyContent: 'center' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 500 }}>
              {match.location}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// Live Interactive Match Detail Component
function MatchDetailView({
  matchId,
  starred,
  onToggleStar,
}: {
  matchId: string;
  starred: boolean;
  onToggleStar: (e: React.MouseEvent) => void;
}) {
  const [activeSegment, setActiveSegment] = useState(0); // 0 = Timeline, 1 = Sestavy, 2 = YouTube
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
    events.forEach((e: any) => {
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

  // Parse YouTube video ID or stream
  const youtubeVideoId = match.config?.youtubeVideoId || match.config?.youtubeUrl?.split('v=')[1];

  return (
    <Box>
      {/* Detail scoreboard header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          bgcolor: isLive ? 'rgba(255, 23, 68, 0.05)' : 'rgba(255, 255, 255, 0.03)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 800 }}>
            {match.leagueName || 'LIGA'}
          </Typography>
          <IconButton size="small" onClick={onToggleStar} sx={{ color: starred ? '#4caf50' : 'rgba(255, 255, 255, 0.3)' }}>
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
              <Chip
                label="ŽIVĚ"
                color="error"
                size="small"
                sx={{ mt: 1, fontWeight: 900, animation: 'pulse 1.5s infinite' }}
              />
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

      {/* Segments/Tabs selector */}
      <Tabs
        value={activeSegment}
        onChange={(e, val) => setActiveSegment(val)}
        centered
        sx={{
          mb: 3,
          '& .MuiTabs-indicator': { bgcolor: '#4caf50' },
          '& .MuiTab-root': { color: 'rgba(255, 255, 255, 0.4)', '&.Mui-selected': { color: '#ffffff' } },
        }}
      >
        <Tab label="Průběh" />
        <Tab label="YouTube Stream" disabled={!youtubeVideoId} />
      </Tabs>

      {/* Segment Contents */}
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
            <Box sx={{ position: 'relative', pl: 3, '&::before': { content: '""', position: 'absolute', left: 8, top: 8, bottom: 8, width: '2px', bgcolor: 'rgba(255,255,255,0.06)' } }}>
              {[...events]
                .sort((a, b) => b.minute - a.minute)
                .map((e: any) => {
                  const isGoal = e.type === 'goal' || e.type === 'shootout_goal';
                  const isCard = e.type === 'card';
                  const cardColor = e.event?.card; // green, yellow, red

                  return (
                    <Box key={e._id} sx={{ position: 'relative', mb: 3 }}>
                      {/* Timeline dot */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: -29,
                          top: 4,
                          width: 14,
                          height: 14,
                          borderRadius: '50%',
                          border: '2px solid #121212',
                          bgcolor: isGoal ? '#4caf50' : isCard && cardColor === 'yellow' ? '#ffd600' : isCard && cardColor === 'red' ? '#ff1744' : '#9e9e9e',
                        }}
                      />

                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: '#4caf50', width: 36 }}>
                          {e.minute}'
                        </Typography>

                        <Paper
                          sx={{
                            p: 1.5,
                            flexGrow: 1,
                            bgcolor: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '12px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {isGoal ? '⚽ GÓL!' : isCard ? `🟨 KARTA (${cardColor})` : e.type}
                            </Typography>
                            <Chip
                              label={e.side === 'home' ? 'Domácí' : 'Hosté'}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '9px',
                                bgcolor: e.side === 'home' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(33, 150, 243, 0.15)',
                                color: e.side === 'home' ? '#81c784' : '#64b5f6',
                              }}
                            />
                          </Box>
                          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                            {e.playerName || 'Neznámý hráč'}
                          </Typography>
                        </Paper>
                      </Box>
                    </Box>
                  );
                })}
            </Box>
          )}
        </Box>
      )}

      {activeSegment === 1 && youtubeVideoId && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 800, color: 'rgba(255,255,255,0.5)' }}>
            ŽIVÝ PŘENOS NEBO ZÁZNAM
          </Typography>

          <Paper
            elevation={4}
            sx={{
              position: 'relative',
              paddingTop: '56.25%', // 16:9 Aspect Ratio
              overflow: 'hidden',
              bgcolor: '#000000',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
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
