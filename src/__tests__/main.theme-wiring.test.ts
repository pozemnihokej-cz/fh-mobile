/**
 * PRD-041 Phase B TEST-012
 *
 * fh-mobile must build its MUI theme from the tenant-resolved theming
 * foundation (DARK mode), not the literal `fhThemeDark`. We assert this by
 * source-inspection of main.tsx: the static import + render edges are a
 * guarantee that a future change cannot silently revert to the literal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('main.tsx theme wiring (TEST-012)', () => {
  it('references resolveTenantTheme from the config foundation', () => {
    const src = read('main.tsx');
    expect(src).toMatch(/resolveTenantTheme/);
  });

  it('references buildTenantTheme from the ui foundation', () => {
    const src = read('main.tsx');
    expect(src).toMatch(/buildTenantTheme/);
  });

  it('mounts a ThemeProvider', () => {
    const src = read('main.tsx');
    expect(src).toMatch(/<ThemeProvider/);
  });

  it('contains NO literal theme={fhThemeDark}', () => {
    const src = read('main.tsx');
    expect(src).not.toMatch(/theme=\{fhThemeDark\}/);
  });
});
