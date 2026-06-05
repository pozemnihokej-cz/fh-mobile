import { createContext, useContext } from 'react';

/**
 * CHANGE-055: TenantContext carries the URL-resolved tenant for the
 * `/:slug/*` subtree. Components below TenantLayout read it instead of
 * looking at the auth user's active tenant — the URL slug is the source
 * of truth for fh-mobile public routes.
 *
 * The default value is intentionally a null triple so consumers that
 * render outside the layout (e.g. unit tests for sub-components) do not
 * blow up; they simply observe "no resolved tenant".
 */
export interface TenantContextValue {
  tenantId: string | null;
  slug: string | null;
  tenantName: string | null;
}

const defaultValue: TenantContextValue = {
  tenantId: null,
  slug: null,
  tenantName: null,
};

export const TenantContext = createContext<TenantContextValue>(defaultValue);

export function useTenantContext(): TenantContextValue {
  return useContext(TenantContext);
}
