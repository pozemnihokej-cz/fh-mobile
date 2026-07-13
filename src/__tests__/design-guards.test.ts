/**
 * SPEC-PRD-055 guards:
 * - TEST-003 (Spec-AC-02): fan screen components import icons only via @fh/ui
 *   (FhIcon / matchIcons / uiIcons), never directly from @mui/icons-material.
 * - TEST-018 (Spec-AC-08): fan screen components carry no colour literals
 *   (#hex / rgba) except a documented, justified allow-list.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const FILES = walk(SRC).map((f) => ({ path: f, rel: relative(SRC, f).split('\\').join('/'), src: readFileSync(f, 'utf8') }));

describe('SPEC-PRD-055 design guards', () => {
  it('TEST-003: no direct @mui/icons-material imports in fan screens', () => {
    const offenders = FILES.filter((f) => /@mui\/icons-material/.test(f.src)).map((f) => f.rel);
    expect(offenders, `Use @fh/ui FhIcon instead:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('TEST-018: no colour literals outside the justified allow-list', () => {
    // Documented, justified non-themable literals (mirrors the @fh/ui hygiene allow-list):
    const ALLOW: Record<string, string> = {
      // Imperative body reset painted before React/theme mounts (anti-flash).
      'main.tsx': 'pre-paint body background (runs before ThemeProvider)',
      // Self-contained YouTube video-embed chrome: black frame, fixed live-red
      // bar, white-on-black text — a display surface, not a tenant-brand surface.
      'components/MatchDetailView.tsx': 'YouTube video-embed chrome (#000 frame, #ff0000 live bar, #fff text)',
    };
    const LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
    const offenders = FILES.filter((f) => LITERAL.test(f.src) && !(f.rel in ALLOW)).map((f) => f.rel);
    expect(offenders, `Use theme tokens / alpha() instead:\n${offenders.join('\n')}`).toEqual([]);
  });
});
