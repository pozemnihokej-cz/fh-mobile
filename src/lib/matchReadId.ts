/** A Supabase/Postgres UUID (any version). A SportsPress number never matches. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidShaped(id: string | undefined): boolean {
  return !!id && UUID_RE.test(id);
}

/**
 * ISSUE-212 / SPEC-208 D5 — the id a child read (roster, timeline, clock, lineup) takes for a match the URL names:
 * the UUID the tenant-scoped `matches:getBySupabaseId` read resolved; nothing while that read loads; once it answered
 * null, the URL id ONLY when it is UUID-shaped. A SportsPress number with a null match reads nothing: a number would
 * otherwise reach a tenant-less read that resolves it across tenants.
 */
export function childReadMatchId(
  urlId: string | undefined,
  match: { supabaseId?: string } | null | undefined,
): string | undefined {
  if (!urlId || match === undefined) return undefined;
  if (match?.supabaseId) return match.supabaseId;
  return isUuidShaped(urlId) ? urlId : undefined;
}
