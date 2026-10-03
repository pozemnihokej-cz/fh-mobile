import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from '@fh/i18n';
import { useTenantContext } from './TenantContext';
import NotFoundPage from './NotFoundPage';

/**
 * spec-fan-match-external-id-redirect Spec-AC-01 / Spec-AC-02 / Spec-AC-03 /
 * Spec-AC-04 / Spec-AC-05 / Spec-AC-06 / Spec-AC-07 / Spec-AC-12 — public
 * entry point `/<slug>/matches/external/<externalId>`.
 *
 * Nested under TenantLayout's `path=":slug"` subtree (main.tsx): by the time
 * this mounts, `useTenantContext()` is already resolved, and an unknown
 * slug never reaches this component at all — TenantLayout renders its own
 * NotFoundPage first (MF-10). This is why the route cannot be reached
 * without a tenant slug (an intake out-of-scope item).
 *
 * Three observable states, driven entirely by the Convex query result:
 *   - `match === undefined` — either the query is still pending, or
 *     `tenantId`/`externalId` is not yet available and the query is
 *     `'skip'`ped. Renders the loading spinner
 *     (`data-testid="external-match-redirect"`, `mobile.routing.loading`).
 *   - `match === null` — the query ran and found no unique match: zero
 *     rows or an ambiguous duplicate pair for that tenant/externalId
 *     (Spec-AC-07: both cases resolve here). Renders the standard
 *     `NotFoundPage` and performs NO navigation.
 *   - otherwise (resolved) — replace-navigates to the canonical
 *     `/<slug>/matches/<supabaseId>` route (Spec-AC-02), so the back
 *     gesture never returns to this resolver (Spec-AC-04).
 *
 * Spec-AC-12: calls ONLY `resolveExternalIdToSupabaseId` — never
 * `getBySupabaseId`, which is MF-04's forbidden untenanted externalId
 * fallback (a full table scan with an arbitrary `.first()`).
 *
 * No enrichment is read here and nothing but `supabaseId` is used from the
 * result — the resolver's own return shape already carries nothing else
 * (Spec-AC-07's "discloses strictly less than the canonical route" clause).
 */
export default function ExternalMatchRedirect(): JSX.Element {
  const { externalId } = useParams<{ externalId?: string }>();
  const { tenantId, slug } = useTenantContext();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const match = useQuery(
    api.functions.matches.resolveExternalIdToSupabaseId,
    tenantId && externalId ? { tenantId, externalId } : 'skip',
  );

  useEffect(() => {
    if (match === undefined || match === null) return;
    const resolved = match;
    navigate(`/${slug}/matches/${resolved.supabaseId}`, { replace: true });
  }, [match, slug, navigate]);

  if (match === null) {
    return <NotFoundPage />;
  }

  return (
    <Box
      data-testid="external-match-redirect"
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
      <CircularProgress color="success" />
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {t('mobile.routing.loading')}
      </Typography>
    </Box>
  );
}
