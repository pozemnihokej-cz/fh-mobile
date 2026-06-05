import { useEffect } from 'react';
import { useAuth, type AuthUser } from '@fh/auth';

/**
 * Returns true when the user holds an active membership matching the given
 * tenant id. Anonymous user → false.
 *
 * Extracted as a named helper so the read-time contract (membership look-up
 * key is `tenant_id`, matching `TenantMembership` in `@fh/auth`) stays
 * legible and unit-testable from the hook's call site.
 */
function hasMembershipForTenant(
  user: AuthUser | null | undefined,
  tenantId: string,
): boolean {
  if (!user) return false;
  return user.allMemberships?.some((m) => m.tenant_id === tenantId) ?? false;
}

/**
 * CHANGE-055 Spec-AC-04 / Spec-AC-09: URL-driven tenant override (fh-mobile only).
 *
 * The first path segment of an fh-mobile URL is a tenant slug. Once the slug
 * has been resolved into a tenant id by the route layout, this hook keeps
 * the authenticated session's active tenant in sync with the URL — but
 * ONLY when the user is actually a member of the URL tenant. The URL is the
 * source of truth for fh-mobile public routes.
 *
 * Behavior matrix:
 *   - anonymous user                           → no-op
 *   - `resolvedTenantId === null` (root route) → no-op
 *   - URL tenant === user's active tenant      → no-op
 *   - user has no membership for URL tenant    → no-op (public view stays)
 *   - otherwise                                → `switchTenant(URL tenant)` once
 *
 * Spec-AC-04 invariant: this hook does NOT mutate `localStorage` itself.
 * `packages/auth.switchTenant` owns the persisted-selection write; this
 * hook MUST NOT bypass it nor write a parallel key. The override is
 * intentionally URL-driven and re-applied on each route mount.
 *
 * Spec-AC-09 invariant: the override lives entirely in fh-mobile.
 * `packages/auth/src/auth-context.tsx` is NOT modified so the shared auth
 * contract used by fh-online-management and fh-evidence stays byte-identical.
 *
 * Idempotence: the effect dependencies are the primitive identifiers that
 * actually drive the decision (the URL tenant id and the user identity).
 * A re-render that does not change them will not re-invoke `switchTenant`.
 */
export function useUrlTenantOverride(resolvedTenantId: string | null): void {
  const { user, switchTenant } = useAuth();
  const currentTenantId = user?.tenantId;
  const userId = user?.id;

  useEffect(() => {
    if (!resolvedTenantId) return;
    if (!user) return;
    if (currentTenantId === resolvedTenantId) return;
    if (!hasMembershipForTenant(user, resolvedTenantId)) return;

    switchTenant(resolvedTenantId);
  }, [resolvedTenantId, userId, currentTenantId, switchTenant, user]);
}
