/**
 * CHANGE-055 TEST-011 (Spec-AC-12)
 *
 * Public-route renders must NOT bind any Convex mutation. We assert this
 * by source-inspection: the MatchesPage source file and its rendered-tree
 * neighbors (MatchCard) must not import `useMutation` from `convex/react`.
 *
 * Source-inspection is the correct mechanism here because the runtime
 * absence of a hook call is hard to prove negatively (the hook is React
 * state, not a side effect on the DOM), but the *import edge* is a
 * static guarantee that a future change cannot silently violate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('MatchesPage no-auth-mutations (TEST-011)', () => {
  it('MatchesPage source does not import useMutation from convex/react', () => {
    const src = read('routes/MatchesPage.tsx');
    // Allow the existence of `useQuery`; forbid `useMutation`.
    expect(src).toMatch(/from\s+['"]convex\/react['"]/);
    expect(src).not.toMatch(/useMutation/);
  });

  it('MatchCard component source does not import from convex/react at all', () => {
    const src = read('components/MatchCard.tsx');
    expect(src).not.toMatch(/from\s+['"]convex\/react['"]/);
  });

  it('TenantContext source has no convex/react import', () => {
    const src = read('routes/TenantContext.ts');
    expect(src).not.toMatch(/convex\/react/);
  });
});
