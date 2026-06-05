import { useEffect, useMemo, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '@fh/auth';
import { resolveTenantBySlug, type ResolvedTenant } from '../lib/tenantBySlug';
import { useUrlTenantOverride } from '../lib/useUrlTenantOverride';
import { supabase } from '../lib/supabase';
import { TenantContext } from './TenantContext';
import NotFoundPage from './NotFoundPage';

type ResolutionState =
  | { kind: 'pending' }
  | { kind: 'resolved'; tenant: ResolvedTenant }
  | { kind: 'not-found' };

/**
 * CHANGE-055 Spec-AC-01 / Spec-AC-04 / Spec-AC-13: wrapper for `/:slug/*`.
 *
 * Responsibilities:
 *   1. Read `slug` from the URL via `useParams`.
 *   2. Resolve slug → tenant via `resolveTenantBySlug` (anon Supabase,
 *      memoized per slug). Show a light skeleton during pending.
 *   3. If null → render NotFoundPage (Spec-AC-03).
 *   4. If resolved →
 *      - publish `{ tenantId, slug, tenantName }` in TenantContext,
 *      - call `useUrlTenantOverride(resolvedTenantId)` (no-op for anon),
 *      - emit ONE telemetry breadcrumb per slug resolution (Spec-AC-13),
 *      - render `<Outlet />` for the nested route.
 */
export default function TenantLayout(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const auth = useAuth();
  const [state, setState] = useState<ResolutionState>({ kind: 'pending' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'pending' });
    if (!slug) {
      setState({ kind: 'not-found' });
      return;
    }
    void (async () => {
      const tenant = await resolveTenantBySlug(supabase, slug);
      if (cancelled) return;
      setState(tenant ? { kind: 'resolved', tenant } : { kind: 'not-found' });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const resolvedTenantId = state.kind === 'resolved' ? state.tenant.id : null;
  const hasSession = Boolean(auth.user);

  // CHANGE-055 Spec-AC-13: emit a single structured breadcrumb per resolution.
  // Effect dep is the resolved tenant id, so re-renders on auth/state changes
  // do not re-emit.
  useEffect(() => {
    if (!resolvedTenantId || !slug) return;
    // eslint-disable-next-line no-console
    console.info({
      event: 'fh-mobile.public-tenant-resolve',
      slug,
      tenantId: resolvedTenantId,
      hasSession,
    });
    // hasSession deliberately omitted — telemetry fires once per slug resolution,
    // not once per auth-state churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTenantId, slug]);

  // CHANGE-055 Spec-AC-04 / Spec-AC-09: re-align authed user's active tenant
  // with the URL slug when they hold a membership for it. Anon → no-op.
  useUrlTenantOverride(resolvedTenantId);

  const contextValue = useMemo(
    () =>
      state.kind === 'resolved'
        ? {
            tenantId: state.tenant.id,
            slug: state.tenant.slug,
            tenantName: state.tenant.name,
          }
        : { tenantId: null, slug: null, tenantName: null },
    [state],
  );

  if (state.kind === 'pending') {
    return (
      <Box
        data-testid="tenant-layout-loading"
        sx={{ display: 'flex', justifyContent: 'center', py: 6, bgcolor: '#121212', minHeight: '100vh' }}
      >
        <CircularProgress color="success" />
      </Box>
    );
  }

  if (state.kind === 'not-found') {
    return <NotFoundPage />;
  }

  return (
    <TenantContext.Provider value={contextValue}>
      <Outlet />
    </TenantContext.Provider>
  );
}
