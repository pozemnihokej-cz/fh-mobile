/**
 * spec-postgrest-calls-match-schema D4 — the PostgREST guard runs in fh-mobile's own suite.
 * The guard lives in the superproject (services/workers/src/__tests__/sql-schema).
 */
import { describe, expect, it } from 'vitest';
import { livePgrstFindings, livePgrstSites } from '../../../../services/workers/src/__tests__/sql-schema/live-postgrest';
import { unexpectedPgrstFindings } from '../../../../services/workers/src/__tests__/sql-schema/allowlist';

const ROOTS = ['apps/fh-mobile/src'];

describe('fh-mobile supabase-js calls vs the migration schema', () => {
  it('no call names anything the migrations do not create', () => {
    expect(unexpectedPgrstFindings(livePgrstFindings(ROOTS))).toEqual([]);
  });

  it('the scan sees this app (it is not silently empty)', () => {
    expect(livePgrstSites(ROOTS).filter((s) => s.op.method === 'from').length).toBeGreaterThan(10);
  });
});
