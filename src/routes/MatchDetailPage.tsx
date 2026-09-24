import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Box, Container, IconButton, Typography, Tooltip, Snackbar, Alert, alpha, useTheme } from '@mui/material';
import { StickyGlassHeader, FhIcon, focusRing } from '@fh/ui';
import { isMatchGenuinelyLive } from '@fh/schema';
import { MatchDetailView } from '../components/MatchDetailView';
import { useFanPreferences } from '../lib/useFanPreferences';

/**
 * CHANGE-055 Spec-AC-07: `/<slug>/matches/<matchId>` direct deep link.
 *
 * Wraps the existing MatchDetailView, reads `matchId` from `useParams`,
 * and renders a back affordance that navigates to the parent list (NOT
 * the picker — browser back from the detail goes to `/<slug>/matches`).
 */
export default function MatchDetailPage(): JSX.Element {
  const { matchId } = useParams<{ matchId: string }>();
  const theme = useTheme();
  const { isMatchSaved, toggleMatch } = useFanPreferences();
  const [copied, setCopied] = useState(false);

  const match = useQuery(api.functions.matches.getBySupabaseId, matchId ? { supabaseId: matchId } : 'skip');
  const canonicalMatchId = match?.supabaseId ?? matchId ?? '';

  const handleShare = async () => {
    try {
      const shareId = match?.externalId || canonicalMatchId;
      const shareUrl = `${window.location.origin}/live/${shareId}`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
      }
    } catch {
      // ignore
    }
  };

  if (!matchId) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'common.white', p: 4 }}>
        <Typography>Chybí ID zápasu.</Typography>
      </Box>
    );
  }

  const isLive = match
    ? isMatchGenuinelyLive({
        status: match.status,
        scheduledDate: match.date,
        startedAt: match.startedAt,
        now: Date.now(),
      })
    : false;

  const isPlayedOrLive = match ? isLive || match.status === 'completed' || match.status === 'in_progress' : false;
  const homeName = match?.homeTeamName || match?.homeClubName || 'Domácí';
  const awayName = match?.awayTeamName || match?.awayClubName || 'Hosté';
  const hasScore = match && (match.homeScore != null || match.awayScore != null);
  const scoreStr = hasScore ? `${match.homeScore ?? 0} : ${match.awayScore ?? 0}` : '0 : 0';

  const headerTitle = match ? (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Typography variant="body1" noWrap sx={{ fontWeight: 800, color: 'common.white', fontSize: { xs: '0.88rem', sm: '0.98rem' } }}>
        {homeName}
      </Typography>
      {isPlayedOrLive ? (
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: { xs: '0.88rem', sm: '1rem' },
            color: isLive ? 'error.main' : 'primary.main',
            px: 0.75,
            py: 0.1,
            bgcolor: isLive ? alpha(theme.palette.error.main, 0.15) : alpha(theme.palette.primary.main, 0.15),
            borderRadius: '6px',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {scoreStr}
        </Typography>
      ) : (
        <Typography sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.8rem', mx: 0.25 }}>
          vs
        </Typography>
      )}
      <Typography variant="body1" noWrap sx={{ fontWeight: 800, color: 'common.white', fontSize: { xs: '0.88rem', sm: '0.98rem' } }}>
        {awayName}
      </Typography>
    </Box>
  ) : (
    'Detail zápasu'
  );

  const headerSubtitle = match
    ? [
        match.leagueName || 'LIGA',
        match.externalId ? `#${match.externalId}` : null,
        isLive ? 'ŽIVĚ' : match.status === 'completed' ? 'KONEC ZÁPASU' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Statistiky a průběh';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'transparent', color: 'common.white' }}>
      {/* Shared @fh/ui sticky glass bar with persistent score and league (leading = back affordance) */}
      <StickyGlassHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        leading={
          <IconButton
            data-testid="match-detail-back"
            aria-label="Zpět na zápasy"
            component={Link}
            to=".."
            relative="path"
            sx={{
              color: 'common.white',
              width: 44,
              height: 44,
              bgcolor: alpha(theme.palette.common.white, 0.05),
              '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.1) },
              ...focusRing(theme),
            }}
          >
            <FhIcon name="back" />
          </IconButton>
        }
        action={
          <Tooltip title={copied ? 'Odkaz zkopírován' : 'Kopírovat odkaz na zápas'}>
            <IconButton
              data-testid="match-detail-share"
              aria-label="Kopírovat odkaz na zápas"
              onClick={handleShare}
              sx={{
                color: copied ? 'success.main' : 'common.white',
                width: 44,
                height: 44,
                bgcolor: alpha(theme.palette.common.white, 0.05),
                '&:hover': { bgcolor: alpha(theme.palette.common.white, 0.1) },
                ...focusRing(theme),
              }}
            >
              {copied ? <FhIcon name="confirm" inline /> : <FhIcon name="share" inline />}
            </IconButton>
          </Tooltip>
        }
      />
      <Container maxWidth="md" sx={{ py: 3 }}>
        <MatchDetailView
          matchId={canonicalMatchId}
          starred={isMatchSaved(canonicalMatchId)}
          onToggleStar={(e) => {
            e.stopPropagation();
            toggleMatch(canonicalMatchId);
          }}
        />
      </Container>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" sx={{ width: '100%', fontWeight: 700 }}>
          Odkaz na zápas byl zkopírován do schránky!
        </Alert>
      </Snackbar>
    </Box>
  );
}
