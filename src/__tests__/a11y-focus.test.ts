/**
 * SPEC-PRD-057 TEST-004 (Spec-AC-03): a11y focus-ring + touch-target guard.
 *
 * AC-03 requires every interactive control on the fan screens to expose a visible
 * `focusRing` on keyboard focus and a >= MIN_TOUCH (44px) hit area — inherited
 * from the `@fh/ui` primitives and applied EXPLICITLY to any app-local
 * interactive element. This static guard (same shape as `design-guards.test.ts`)
 * scans every non-test screen/component file and asserts:
 *
 *  1. Every app-local interactive control (a MUI ButtonBase-derived control or a
 *     raw `role="button"` clickable) spreads `focusRing(theme)` in its `sx` —
 *     except a small, documented allow-list of controls that intentionally rely
 *     on MUI ButtonBase's built-in `.Mui-focusVisible` treatment.
 *  2. Every raw `role="button"` clickable (which gets NO focus/touch affordance
 *     from MUI) additionally carries a >= 44px `minHeight` touch target.
 *
 * `@fh/ui` primitives (`<MatchCard onClick>`, `<ConnectionBanner>`, `<BottomNavigation>`)
 * bake focus/touch handling in and are intentionally NOT matched here.
 *
 * RED proof: delete a `...focusRing(theme)` spread from any fan control (e.g.
 * SearchPage's result row) — assertion 1 fails; delete its `minHeight: 44` —
 * assertion 2 fails. Restore -> green.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(process.cwd(), 'src');
const ROOTS = [join(SRC, 'routes'), join(SRC, 'components')];

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

const FILES = ROOTS.flatMap(walk).map((f) => ({
  rel: relative(SRC, f).split('\\').join('/'),
  src: readFileSync(f, 'utf8'),
}));

/**
 * Interactive-control anchors: MUI ButtonBase-derived controls + raw
 * `role="button"` clickables. `@fh/ui` primitives are deliberately excluded.
 */
const CONTROL_RE = /<(?:Button|IconButton|ButtonBase|Fab|BottomNavigationAction)\b|\brole="button"/g;

/**
 * Controls that intentionally rely on MUI ButtonBase's built-in
 * `.Mui-focusVisible` focus treatment instead of an explicit `focusRing` spread.
 * Documented + justified — same pattern as the design-guards colour allow-list.
 * Adding a NEW un-ringed fan control must NOT land here silently: it belongs on
 * the fan screen with an explicit `focusRing`, or with a written rationale.
 */
const FOCUS_ALLOW: Record<string, string> = {
  'routes/NotFoundPage.tsx':
    '404 fallback "back to picker" link — routing chrome, not a fan showcase screen (MUI contained Button default focus)',
  'components/AsyncBoundary.tsx':
    'ErrorState retry button — MUI contained Button default focus-visible',
  'components/QueryErrorBoundary.tsx':
    'ErrorState retry button — MUI contained Button default focus-visible',
  'components/MatchDetailView.tsx':
    'external YouTube "watch" link — MUI outlined Button default focus-visible',
};

/** Window (chars) from a control anchor to inspect its own attributes/sx. */
function controlWindows(src: string): { start: number }[] {
  return [...src.matchAll(CONTROL_RE)].map((m) => ({ start: m.index ?? 0 }));
}

function windowFor(src: string, starts: number[], i: number): string {
  const next = starts[i + 1] ?? src.length;
  const end = Math.min(next, starts[i] + 1200);
  return src.slice(starts[i], end);
}

describe('SPEC-PRD-057 a11y guards (TEST-004, Spec-AC-03)', () => {
  it('TEST-004: every app-local interactive control spreads focusRing (or is a documented MUI-default exception)', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const starts = controlWindows(f.src).map((c) => c.start);
      if (starts.length === 0) continue;
      if (f.rel in FOCUS_ALLOW) continue; // whole-file documented exception
      starts.forEach((_, i) => {
        const win = windowFor(f.src, starts, i);
        if (!/focusRing\s*\(/.test(win)) {
          offenders.push(`${f.rel} @char${starts[i]}`);
        }
      });
    }
    expect(
      offenders,
      `App-local interactive controls missing a focusRing(theme) spread ` +
        `(add ...focusRing(theme) to the control's sx, or document it in FOCUS_ALLOW):\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('TEST-004: every raw role="button" clickable meets the >= 44px MIN_TOUCH target', () => {
    const RAW_RE = /\brole="button"/g;
    let rawCount = 0;
    const undersized: string[] = [];
    for (const f of FILES) {
      const starts = [...f.src.matchAll(RAW_RE)].map((m) => m.index ?? 0);
      starts.forEach((start, i) => {
        rawCount += 1;
        const next = starts[i + 1] ?? f.src.length;
        const win = f.src.slice(start, Math.min(next, start + 1200));
        const mh = win.match(/minHeight:\s*(\d+)/);
        const usesTouchTarget = /\btouchTarget\b/.test(win);
        const px = mh ? Number(mh[1]) : 0;
        if (!usesTouchTarget && px < 44) {
          undersized.push(`${f.rel} @char${start} (minHeight=${mh ? px : 'none'})`);
        }
      });
    }
    // Guard is non-vacuous: the codebase has at least one raw role="button" control.
    expect(rawCount).toBeGreaterThan(0);
    expect(
      undersized,
      `Raw role="button" clickables below the 44px WCAG target ` +
        `(add minHeight: 44 or spread touchTarget):\n${undersized.join('\n')}`,
    ).toEqual([]);
  });

  it('TEST-004: the focusRing allow-list stays honest (each entry names a real file with an un-ringed control)', () => {
    const stale: string[] = [];
    for (const rel of Object.keys(FOCUS_ALLOW)) {
      const f = FILES.find((x) => x.rel === rel);
      if (!f) {
        stale.push(`${rel} (file not found)`);
        continue;
      }
      const hasControl = CONTROL_RE.test(f.src);
      CONTROL_RE.lastIndex = 0;
      const hasRing = /focusRing\s*\(/.test(f.src);
      // An allow-list entry is only justified while the file still has an
      // interactive control that lacks an explicit focusRing.
      if (!hasControl || hasRing) {
        stale.push(`${rel} (${!hasControl ? 'no control' : 'now spreads focusRing — remove from allow-list'})`);
      }
    }
    expect(stale, `Stale FOCUS_ALLOW entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
