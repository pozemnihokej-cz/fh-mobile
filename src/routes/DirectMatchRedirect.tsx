import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Box, CircularProgress, Typography, Button, Container, useTheme } from '@mui/material';
import { FhIcon, focusRing } from '@fh/ui';
import { supabase } from '../lib/supabase';
import { resolveTenantById } from '../lib/tenantBySlug';

const DEFAULT_SLUG = 'cz-field-hockey-union';

/**
 * DirectMatchRedirect:
 * Allows linking to matches from external platforms (e.g. SportsPress on pozemnihokej.cz)
 * without needing to know or hardcode the tenant slug.
 *
 * Supported patterns:
 *   /matches/:matchId
 *   /match/:matchId
 *   /live/:matchId
 *   /live?id=:matchId or /live?matchId=:matchId or /live?externalId=:matchId
 *
 * Both internal Supabase UUIDs and external SportsPress IDs (e.g. 79147) are resolved.
 */
export default function DirectMatchRedirect(): JSX.Element {
  const theme = useTheme();
  const { matchId: paramMatchId } = useParams<{ matchId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryMatchId =
    searchParams.get('matchId') ||
    searchParams.get('id') ||
    searchParams.get('externalId') ||
    undefined;

  const targetId = paramMatchId || queryMatchId;

  const match = useQuery(
    api.functions.matches.getBySupabaseId,
    targetId ? { supabaseId: targetId } : 'skip',
  );

  const [, setResolving] = useState(false);

  useEffect(() => {
    if (!targetId) {
      navigate(`/${DEFAULT_SLUG}/live`, { replace: true });
      return;
    }

    if (match === undefined) {
      // still loading match
      return;
    }

    if (match === null) {
      // match not found
      return;
    }

    let cancelled = false;
    setResolving(true);

    void (async () => {
      let slug = DEFAULT_SLUG;
      if (match.tenantId) {
        const tenant = await resolveTenantById(supabase, match.tenantId);
        if (tenant?.slug) {
          slug = tenant.slug;
        }
      }

      if (!cancelled) {
        navigate(`/${slug}/matches/${match.supabaseId}`, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetId, match, navigate]);

  if (match === null) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'common.white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Container maxWidth="xs" sx={{ textAlign: 'center' }}>
          <FhIcon name="hockey" sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Zápas nebyl nalezen
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Zápas s ID &bdquo;{targetId}&ldquo; se v systému nepodařilo najít.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/${DEFAULT_SLUG}/matches`, { replace: true })}
            sx={{ ...focusRing(theme) }}
          >
            Přejít na přehled zápasů
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box
      data-testid="direct-match-redirect-loading"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        color: 'common.white',
        gap: 2,
      }}
    >
      <CircularProgress color="primary" />
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        Načítám detail zápasu...
      </Typography>
    </Box>
  );
}
