/**
 * spec-postgrest-calls-match-schema D4 — the PostgREST guard runs in fh-mobile's own suite.
 * The guard lives in the superproject (services/workers/src/__tests__/sql-schema).
 */
import { describe, expect, it } from 'vitest';
import { livePgrstFindings, livePgrstSites } from '../../../../services/workers/src/__tests__/sql-schema/live-postgrest';
import { unexpectedGrantErrors, unexpectedPgrstFindings } from '../../../../services/workers/src/__tests__/sql-schema/allowlist';
import { liveGrantFindings } from '../../../../services/workers/src/__tests__/sql-schema/live-grants';

const ROOTS = ['apps/fh-mobile/src'];

describe('fh-mobile supabase-js calls vs the migration schema', () => {
  it('no call names anything the migrations do not create', () => {
    expect(unexpectedPgrstFindings(livePgrstFindings(ROOTS))).toEqual([]);
  });

  it('the scan sees this app (it is not silently empty)', () => {
    expect(livePgrstSites(ROOTS).filter((s) => s.op.method === 'from').length).toBeGreaterThan(10);
  });

  // spec-postgrest-client-role-grants: and only what its client role (anon / authenticated) is granted.
  it('no call is refused a privilege its client role lacks', () => {
    const errors = liveGrantFindings()
      .filter((f) => f.site.startsWith('apps/fh-mobile/src/') && f.severity === 'error')
      .map((f) => `${f.site} ${f.finding}`);
    expect(unexpectedGrantErrors(errors)).toEqual([]);
  });
});
