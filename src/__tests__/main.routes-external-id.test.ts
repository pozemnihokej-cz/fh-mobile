/**
 * spec-fan-match-external-id-redirect TEST-001 / TEST-014 (Spec-AC-01,
 * Spec-AC-08).
 *
 * Source-inspection on the SHIPPED `main.tsx` (not a retyped tree — see R-1
 * / fu-source-inspection-ratchet): every pre-existing fh-mobile route test
 * asserts against a retyped `<Routes>` tree and would pass even if
 * `main.tsx` never gained the new route line. This file reads the real
 * file off disk so the route table's actual, deployed shape is what gets
 * checked, paired with the live e2e (TEST-013) that exercises the real
 * bundle.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mainSource = readFileSync(resolve(__dirname, '../main.tsx'), 'utf8');

/** The `<Route path=":slug" element={<TenantLayout />}>` subtree, up to
 * its own closing `<Route path="*"` catch-all sibling (the slug subtree's
 * unknown-route 404, NOT the outer slug-less catch-all). */
function slugSubtree(src: string): { start: number; end: number; text: string } {
  const start = src.indexOf('path=":slug"');
  expect(start).toBeGreaterThan(-1);
  const closeIdx = src.indexOf('<Route path="*" element={<NotFoundPage />} />', start);
  expect(closeIdx).toBeGreaterThan(start);
  return { start, end: closeIdx, text: src.slice(start, closeIdx) };
}

describe('TEST-001 (Spec-AC-01): the external-id route is declared INSIDE the :slug subtree', () => {
  it('main.tsx declares path="matches/external/:externalId" between path=":slug" and its own "*" sibling', () => {
    const { start, end } = slugSubtree(mainSource);
    const needle = 'path="matches/external/:externalId"';
    const idx = mainSource.indexOf(needle);
    expect(idx).toBeGreaterThan(start);
    expect(idx).toBeLessThan(end);
  });

  it('wires the ExternalMatchRedirect element to that route line', () => {
    const { text } = slugSubtree(mainSource);
    // NB-1 remediation wraps the element in a route-scoped QueryErrorBoundary
    // (see the dedicated NB-1 describe block below for the exact pattern);
    // this assertion stays scoped to "wired to THIS route", not the literal
    // adjacency, so it still catches a regression that rewires the element
    // to some other, distant route.
    expect(text).toMatch(/path="matches\/external\/:externalId"[\s\S]{0,300}?<ExternalMatchRedirect\s*\/>/);
  });

  it('imports ExternalMatchRedirect from ./routes/ExternalMatchRedirect', () => {
    expect(mainSource).toMatch(/import ExternalMatchRedirect from '\.\/routes\/ExternalMatchRedirect';/);
  });

  it('is declared BEFORE matches/:matchId/lineup (Route-ranking note, TEST-012 tie-break)', () => {
    const { text } = slugSubtree(mainSource);
    const extIdx = text.indexOf('path="matches/external/:externalId"');
    const lineupIdx = text.indexOf('path="matches/:matchId/lineup"');
    expect(extIdx).toBeGreaterThan(-1);
    expect(lineupIdx).toBeGreaterThan(-1);
    expect(extIdx).toBeLessThan(lineupIdx);
  });
});

describe('NB-1 remediation: main.tsx wraps the route in a route-scoped QueryErrorBoundary', () => {
  it('matches/external/:externalId element is wrapped in the same QueryErrorBoundary pattern as its matches/* siblings', () => {
    const { text } = slugSubtree(mainSource);
    const re = /path="matches\/external\/:externalId"[\s\S]*?element=\{[\s\S]*?<QueryErrorBoundary errorTitle="Zápas se nepodařilo načíst" errorDescription="Zkontroluj připojení a zkus to znovu\." retryLabel="Zkusit znovu">[\s\S]*?<ExternalMatchRedirect\s*\/>[\s\S]*?<\/QueryErrorBoundary>[\s\S]*?\}/;
    expect(text).toMatch(re);
  });
});

describe('TEST-014 (Spec-AC-08): anti-regression — the pre-existing route table is unchanged', () => {
  it('still declares path="matches/:matchId" under :slug', () => {
    const { text } = slugSubtree(mainSource);
    expect(text).toMatch(/path="matches\/:matchId"/);
  });

  it('still declares all four slug-less DirectMatchRedirect routes', () => {
    for (const p of ['matches/:matchId', 'match/:matchId', 'live/:matchId', 'live']) {
      const re = new RegExp(`<Route path="${p.replace(/[/:]/g, '\\$&')}" element={<DirectMatchRedirect \\/>} />`);
      expect(mainSource).toMatch(re);
    }
  });
});
