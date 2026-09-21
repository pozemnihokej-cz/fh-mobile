import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import {
  Box,
  Container,
  Button,
  Typography,
  Chip,
  Grid,
  Autocomplete,
  TextField,
  Paper,
  alpha,
  useTheme,
} from '@mui/material';
import { StickyGlassHeader, EmptyState, MatchCardSkeleton, FhIcon, focusRing } from '@fh/ui';
import { MatchCard, type MatchCardData } from '../components/MatchCard';
import { AsyncBoundary } from '../components/AsyncBoundary';
import { useTenantContext } from './TenantContext';
import { useFanPreferences } from '../lib/useFanPreferences';
import { useNearestVenue } from '../hooks/useNearestVenue';

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function formatDayHeader(timestamp: number): string {
  const d = new Date(timestamp);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const formatted = d.toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return isToday ? `Dnes · ${formatted}` : formatted;
}

export interface VenueOption {
  id: string;
  label: string;
  isNearby?: boolean;
}

/**
 * CHANGE-055 / compact timetable iteration:
 * - Responsive tablet layout: 2-column grid on sm/md viewports
 * - Searchable Autocomplete list box with venue filtering
 * - OM-parity compact match cards with team name wrapping, live/completed score and state chips
 * - Progressive loading of previous matches (donačítání předchozích zápasů)
 * - Geolocation nearest-pitch detection
 * - Compact skeleton placeholders during loading
 */
export default function MatchesPage(): JSX.Element {
  const { tenantId, tenantName } = useTenantContext();
  const navigate = useNavigate();
  const theme = useTheme();

  const matches = useQuery(
    api.functions.matches.list,
    tenantId ? { tenantId } : 'skip',
  );

  const venues = useQuery(
    api.functions.venues.list,
    tenantId ? { tenantId } : 'skip',
  );

  const { isMatchSaved, toggleMatch } = useFanPreferences();

  // Geolocation detection of nearest pitch
  const visibleVenues = useMemo(() => {
    if (!venues) return [];
    return venues.map((v) => ({ name: v.name, gps: v.gps }));
  }, [venues]);

  const { nearestVenueName, status: geoStatus } = useNearestVenue(visibleVenues);

  // Session storage state persistence — remembers revealed days & scroll position
  // so opening a match detail and navigating Back keeps the user in place.
  const sessionKey = `fh.matches.${tenantId || 'default'}.state`;
  const savedState = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(sessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [sessionKey]);

  // Venue filtering & pagination state — initialized from saved session if available
  const [selectedVenue, setSelectedVenue] = useState<string>(savedState?.selectedVenue ?? 'all');
  const [daysBack, setDaysBack] = useState<number>(savedState?.daysBack ?? 0);
  const [daysForward, setDaysForward] = useState<number>(savedState?.daysForward ?? 7);

  // Persist pagination & venue state to session storage
  useEffect(() => {
    try {
      const currentRaw = sessionStorage.getItem(sessionKey);
      const prevObj = currentRaw ? JSON.parse(currentRaw) : {};
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          ...prevObj,
          selectedVenue,
          daysBack,
          daysForward,
        }),
      );
    } catch {
      // sessionStorage unavailable
    }
  }, [sessionKey, selectedVenue, daysBack, daysForward]);

  // Track window scroll continuously
  useEffect(() => {
    const onScroll = () => {
      try {
        const currentRaw = sessionStorage.getItem(sessionKey);
        const prevObj = currentRaw ? JSON.parse(currentRaw) : {};
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            ...prevObj,
            scrollY: window.scrollY,
          }),
        );
      } catch {
        // sessionStorage unavailable
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sessionKey]);

  // Reset revealed past and future days ONLY when venue filter is deliberately changed by the user
  const prevVenueRef = useRef(selectedVenue);
  useEffect(() => {
    if (prevVenueRef.current !== selectedVenue) {
      prevVenueRef.current = selectedVenue;
      setDaysBack(0);
      setDaysForward(7);
      try {
        const currentRaw = sessionStorage.getItem(sessionKey);
        const prevObj = currentRaw ? JSON.parse(currentRaw) : {};
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify({
            ...prevObj,
            selectedVenue,
            daysBack: 0,
            daysForward: 7,
            scrollY: 0,
            lastMatchId: undefined,
          }),
        );
      } catch {
        // sessionStorage unavailable
      }
    }
  }, [selectedVenue, sessionKey]);

  // Extract unique venues that have matches
  const availableVenues = useMemo(() => {
    const set = new Set<string>();
    if (matches) {
      for (const m of matches as MatchCardData[]) {
        const v = m.venue ?? m.location;
        if (v && v.trim()) set.add(v.trim());
      }
    }
    return Array.from(set).sort();
  }, [matches]);

  // Options for Autocomplete list box
  const venueOptions = useMemo<VenueOption[]>(() => {
    const opts: VenueOption[] = [{ id: 'all', label: 'Všechna hřiště' }];
    if (geoStatus === 'found' && nearestVenueName) {
      opts.push({
        id: nearestVenueName,
        label: `${nearestVenueName} (poblíž)`,
        isNearby: true,
      });
    }
    for (const v of availableVenues) {
      if (v === nearestVenueName) continue;
      opts.push({ id: v, label: v });
    }
    return opts;
  }, [availableVenues, nearestVenueName, geoStatus]);

  // Filter matches by selected venue
  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    return (matches as MatchCardData[]).filter((m) => {
      if (m.status === 'cancelled') return false;
      if (selectedVenue !== 'all') {
        const v = m.venue ?? m.location;
        if (v !== selectedVenue) return false;
      }
      return true;
    });
  }, [matches, selectedVenue]);

  // Group into timeline days (oldest revealed past day at top, future at bottom)
  const timeline = useMemo(() => {
    const todayAnchor = startOfDay(Date.now());
    const byDay = new Map<number, MatchCardData[]>();

    for (const m of filteredMatches) {
      const dayKey = startOfDay(m.date);
      const arr = byDay.get(dayKey);
      if (arr) arr.push(m);
      else byDay.set(dayKey, [m]);
    }

    // Past days (days strictly before today) sorted newest to oldest
    const pastKeys = [...byDay.keys()].filter((k) => k < todayAnchor).sort((a, b) => b - a);
    // Revealed past days sorted chronologically
    const revealedPast = pastKeys.slice(0, Math.max(0, daysBack)).sort((a, b) => a - b);
    const nextPastDayKey = pastKeys[Math.max(0, daysBack)] ?? null;

    // Today and future days sorted chronologically — capped at max 1 week forward by default
    const allFutureKeys = [...byDay.keys()].filter((k) => k >= todayAnchor).sort((a, b) => a - b);
    const futureCutoff = todayAnchor + daysForward * 86_400_000;
    let revealedFuture = allFutureKeys.filter((k) => k <= futureCutoff);
    let nextFutureDayKey = allFutureKeys.find((k) => k > futureCutoff) ?? null;

    // If no matches fall within the current window but future matches exist,
    // reveal the earliest future match day so the schedule is not blank.
    if (revealedFuture.length === 0 && allFutureKeys.length > 0) {
      revealedFuture = [allFutureKeys[0]];
      nextFutureDayKey = allFutureKeys[1] ?? null;
    }

    const keys = [...revealedPast, ...revealedFuture];
    const days = keys.map((dayKey) => ({
      dayKey,
      items: (byDay.get(dayKey) ?? []).slice().sort((a, b) => a.date - b.date),
    }));

    return {
      days,
      nextPastDayKey,
      nextFutureDayKey,
      hasPastMatches: pastKeys.length > 0,
      hasFutureMatches: allFutureKeys.length > 0,
      totalCount: filteredMatches.length,
    };
  }, [filteredMatches, daysBack, daysForward]);

  // Restore scroll position when returning from match detail
  const didRestoreScroll = useRef(false);
  useEffect(() => {
    if (matches === undefined || timeline.days.length === 0 || didRestoreScroll.current) return;

    try {
      const raw = sessionStorage.getItem(sessionKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      didRestoreScroll.current = true;

      const timer = setTimeout(() => {
        if (parsed.lastMatchId) {
          const el = document.getElementById(`match-item-${parsed.lastMatchId}`);
          if (el) {
            el.scrollIntoView?.({ block: 'center', behavior: 'instant' as any });
            return;
          }
        }
        if (typeof parsed.scrollY === 'number' && parsed.scrollY > 0) {
          window.scrollTo?.({ top: parsed.scrollY, behavior: 'instant' as any });
        }
      }, 50);

      return () => clearTimeout(timer);
    } catch {
      // noop
    }
  }, [matches, timeline.days.length, sessionKey]);

  const handleMatchClick = (m: MatchCardData) => {
    try {
      const currentRaw = sessionStorage.getItem(sessionKey);
      const prevObj = currentRaw ? JSON.parse(currentRaw) : {};
      sessionStorage.setItem(
        sessionKey,
        JSON.stringify({
          ...prevObj,
          selectedVenue,
          daysBack,
          daysForward,
          scrollY: window.scrollY,
          lastMatchId: m.supabaseId,
        }),
      );
    } catch {
      // noop
    }
    navigate(m.supabaseId);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white', pb: 12 }}>
      {/* Page header — shared @fh/ui sticky glass bar with full-width toolbar and return to tenant list */}
      <StickyGlassHeader
        sx={{ mb: 2 }}
        maxWidth={false}
        title={tenantName || 'Zápasy'}
        subtitle="Program a výsledky"
        leading={
          <Box
            component={Link}
            to="/"
            aria-label="Zpět na výběr svazu"
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
              textDecoration: 'none',
              transition: 'background-color 0.15s ease, transform 0.15s ease',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.22),
                transform: 'scale(1.04)',
              },
              ...focusRing(theme),
            }}
          >
            <FhIcon name="back" inline sx={{ fontSize: '1.25rem' }} />
          </Box>
        }
        action={
          <Button
            component={Link}
            to="../live"
            relative="path"
            size="small"
            startIcon={<FhIcon name="score" inline />}
            sx={{ color: 'common.white', fontWeight: 800, borderRadius: '10px', ...focusRing(theme) }}
          >
            Živě
          </Button>
        }
      />

      <Container maxWidth="lg" sx={{ px: { xs: 2, sm: 3 } }}>
        {/* Venue Filter Bar with Autocomplete & Nearby quick chip */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Autocomplete<VenueOption, false, boolean, false>
            id="venue-filter-autocomplete"
            data-testid="venue-filter-autocomplete"
            size="small"
            options={venueOptions}
            getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            value={venueOptions.find((o) => o.id === selectedVenue) ?? venueOptions[0]}
            onChange={(_, newVal) => {
              setSelectedVenue(newVal ? newVal.id : 'all');
            }}
            disableClearable={selectedVenue === 'all'}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Filtrovat podle hřiště…"
                variant="outlined"
                size="small"
                inputProps={{
                  ...params.inputProps,
                  'aria-label': 'Filtrovat podle hřiště',
                }}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <Box component="span" sx={{ display: 'inline-flex', mr: 0.75, color: 'primary.main', alignItems: 'center' }}>
                        <FhIcon name="location" inline />
                      </Box>
                      {params.InputProps.startAdornment}
                    </>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: alpha(theme.palette.common.white, 0.05),
                    borderRadius: '12px',
                    color: 'common.white',
                    fontSize: '0.85rem',
                    '& fieldset': {
                      borderColor: alpha(theme.palette.common.white, 0.15),
                    },
                    '&:hover fieldset': {
                      borderColor: alpha(theme.palette.primary.main, 0.5),
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', py: 0.25 }}>
                  {option.isNearby ? (
                    <FhIcon name="location" inline sx={{ color: 'primary.main', fontSize: '0.95rem' }} />
                  ) : null}
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: option.id === selectedVenue ? 800 : 500 }}>
                    {option.label}
                  </Typography>
                </Box>
              </li>
            )}
            PaperComponent={(props) => (
              <Paper
                {...props}
                sx={{
                  bgcolor: alpha(theme.palette.background.paper, 0.96),
                  backdropFilter: 'blur(16px)',
                  border: `1px solid ${alpha(theme.palette.common.white, 0.15)}`,
                  borderRadius: '12px',
                  color: 'common.white',
                  mt: 0.5,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.5)}`,
                }}
              />
            )}
            sx={{
              flex: 1,
              minWidth: { xs: '100%', sm: 260 },
              ...focusRing(theme),
            }}
          />

          {/* Quick chip for nearest venue when detected */}
          {geoStatus === 'found' && nearestVenueName && (
            <Chip
              data-testid="nearby-venue-chip"
              icon={
                <FhIcon
                  name="location"
                  inline
                  sx={{
                    fontSize: '0.95rem !important',
                    color: selectedVenue === nearestVenueName ? 'common.black !important' : 'primary.main !important',
                  }}
                />
              }
              label={`Poblíž: ${nearestVenueName}`}
              size="small"
              onClick={() => setSelectedVenue(selectedVenue === nearestVenueName ? 'all' : nearestVenueName)}
              sx={{
                fontWeight: 800,
                fontSize: '0.75rem',
                height: 38,
                borderRadius: '10px',
                bgcolor: selectedVenue === nearestVenueName ? 'primary.main' : alpha(theme.palette.primary.main, 0.15),
                color: selectedVenue === nearestVenueName ? 'common.black' : 'primary.light',
                border: `1px solid ${selectedVenue === nearestVenueName ? 'primary.main' : alpha(theme.palette.primary.main, 0.4)}`,
                cursor: 'pointer',
                flexShrink: 0,
                ...focusRing(theme),
              }}
            />
          )}
        </Box>

        <AsyncBoundary
          loading={matches === undefined}
          isEmpty={timeline.totalCount === 0}
          skeleton={
            <Grid container spacing={1.5} alignItems="stretch">
              {Array.from({ length: 6 }).map((_, i) => (
                <Grid
                  item
                  xs={12}
                  md={6}
                  key={i}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    '@media (orientation: portrait)': {
                      maxWidth: '100%',
                      flexBasis: '100%',
                    },
                  }}
                >
                  <MatchCardSkeleton count={1} compact />
                </Grid>
              ))}
            </Grid>
          }
          empty={
            <EmptyState
              icon={<FhIcon name="hockey" sx={{ fontSize: 44 }} />}
              title="Žádné zápasy"
              description={selectedVenue !== 'all' ? 'Na vybraném hřišti se nekonají žádné zápasy.' : 'Zatím nejsou naplánovány žádné zápasy.'}
            />
          }
        >
          <Box>
            {/* Pull in / reveal previous past day button */}
            {timeline.nextPastDayKey !== null && (
              <Box
                data-testid="match-list-pull-previous"
                onClick={() => setDaysBack((prev) => prev + 1)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setDaysBack((prev) => prev + 1);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                  py: 1.25,
                  minHeight: 44,
                  mb: 1.5,
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderRadius: '14px',
                  border: `1px dashed ${alpha(theme.palette.common.white, 0.2)}`,
                  bgcolor: alpha(theme.palette.common.white, 0.03),
                  color: alpha(theme.palette.common.white, 0.8),
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.common.white, 0.07),
                    borderColor: alpha(theme.palette.primary.main, 0.5),
                  },
                  ...focusRing(theme),
                }}
              >
                <FhIcon name="expandLess" inline sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
                <span>Donačíst předchozí zápasy ({formatDayHeader(timeline.nextPastDayKey)})</span>
              </Box>
            )}

            {/* Timeline days */}
            {timeline.days.map((day) => (
              <Box key={day.dayKey} data-testid="timeline-day" sx={{ mb: 2 }}>
                {/* Day Header — clean subdued text without a box */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 2, mb: 1, px: 0.5 }}>
                  <FhIcon
                    name="calendar"
                    inline
                    sx={{
                      fontSize: '0.9rem',
                      color: alpha(theme.palette.common.white, 0.45),
                    }}
                  />
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      color: alpha(theme.palette.common.white, 0.65),
                      textTransform: 'capitalize',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {formatDayHeader(day.dayKey)}
                  </Typography>
                </Box>

                {/* Match cards in responsive grid: 1 col on portrait (xs/sm/md-portrait), 2 cols on landscape (md/lg) */}
                <Grid container spacing={1.5} alignItems="stretch">
                  {day.items.map((m) => (
                    <Grid
                      item
                      xs={12}
                      md={6}
                      key={m._id}
                      id={`match-item-${m.supabaseId}`}
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        '@media (orientation: portrait)': {
                          maxWidth: '100%',
                          flexBasis: '100%',
                        },
                      }}
                    >
                      <MatchCard
                        match={m}
                        compact
                        isStarred={isMatchSaved(m.supabaseId)}
                        onToggleStar={(e) => {
                          e.stopPropagation();
                          toggleMatch(m.supabaseId);
                        }}
                        onClick={() => handleMatchClick(m)}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}

            {/* Pull in / reveal next future matches button */}
            {timeline.nextFutureDayKey !== null && (
              <Box
                data-testid="match-list-pull-next"
                onClick={() => setDaysForward((prev) => prev + 7)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setDaysForward((prev) => prev + 7);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                  py: 1.25,
                  minHeight: 44,
                  mt: 2,
                  mb: 1.5,
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderRadius: '14px',
                  border: `1px dashed ${alpha(theme.palette.common.white, 0.2)}`,
                  bgcolor: alpha(theme.palette.common.white, 0.03),
                  color: alpha(theme.palette.common.white, 0.8),
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.common.white, 0.07),
                    borderColor: alpha(theme.palette.primary.main, 0.5),
                  },
                  ...focusRing(theme),
                }}
              >
                <FhIcon name="expandMore" inline sx={{ fontSize: '1.1rem', color: 'primary.main' }} />
                <span>Donačíst další zápasy ({formatDayHeader(timeline.nextFutureDayKey)})</span>
              </Box>
            )}
          </Box>
        </AsyncBoundary>
      </Container>
    </Box>
  );
}
