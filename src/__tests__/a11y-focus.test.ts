/**
 * SPEC-PRD-057 TEST-004 (Spec-AC-03): a11y focus-ring + touch-target guard.
 *
 * AC-03 requires every interactive control on the fan screens to expose a visible
 * `focusRing` on keyboard focus and a >= MIN_TOUCH (44px) hit area — inherited
 * from the `@fh/ui` primitives and applied EXPLICITLY to any app-local
 * interactive element. This static guard (same shape as `design-guards.test.ts`)
 * scans every non-test screen/component file and asserts:
 *
 *  1. Every app-local interactive control (a MUI ButtonBase-derived control, a
 *     raw `role="button"` clickable, or a raw `onClick` on a `Box`/`Chip`/`div`
 *     — TECHDEBT-038 FIX 2) spreads `focusRing(theme)` in its `sx` — except a
 *     small, documented allow-list keyed on a (file, control-marker) PAIR
 *     (TECHDEBT-038 FIX 1) for controls that intentionally rely on MUI
 *     ButtonBase's built-in `.Mui-focusVisible` treatment.
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
 * TECHDEBT-038 FIX 2: a raw `onClick` on a non-primitive `Box`/`Chip`/`div`
 * gets NO focus/touch affordance from MUI — it must spread `focusRing` itself.
 * This tempered pattern matches an opening `<Box|Chip|div>` tag whose OWN
 * attribute list carries `onClick=` (the `(?:[^<>]|=>)*?` body tolerates arrow
 * functions in earlier props but refuses to cross into a nested JSX child or
 * past the tag close, so it only fires on the element's own handler). Clickables
 * that are ALSO `role="button"` are already covered by CONTROL_RE and are
 * de-duplicated in `controlStarts`. `@fh/ui` primitives (`<MatchCard onClick>`)
 * are not `Box`/`Chip`/`div` and so are correctly ignored.
 */
const CLICKABLE_BOX_RE = /<(?:Box|Chip|div)\b(?:[^<>]|=>)*?\bonClick=/g;

/** Window (chars) from a control anchor to inspect its own attributes/sx. */
const CONTROL_WINDOW = 1200;

/**
 * TECHDEBT-038 FIX 1: the allow-list keys on a (file, control-marker) PAIR, not
 * the whole file. Each entry names a short snippet that uniquely identifies the
 * one exempt control's window; only that control is skipped, so any OTHER
 * un-ringed control added to the same file still fails the guard.
 *
 * These 4 controls intentionally rely on MUI ButtonBase's built-in
 * `.Mui-focusVisible` treatment instead of an explicit `focusRing` spread.
 * Documented + justified — same spirit as the design-guards colour allow-list.
 * Adding a NEW un-ringed fan control must NOT land here silently: it belongs on
 * the fan screen with an explicit `focusRing`, or with its own written rationale.
 */
const FOCUS_ALLOW: Record<string, { marker: string; reason: string }[]> = {
  'routes/NotFoundPage.tsx': [
    {
      marker: 'notFound.backToPicker',
      reason:
        '404 fallback "back to picker" link — routing chrome, not a fan showcase screen (MUI contained Button default focus)',
    },
  ],
  'components/AsyncBoundary.tsx': [
    {
      marker: 'onClick={onRetry}',
      reason: 'ErrorState retry button — MUI contained Button default focus-visible',
    },
  ],
  'components/QueryErrorBoundary.tsx': [
    {
      marker: 'onClick={this.retry}',
      reason: 'ErrorState retry button — MUI contained Button default focus-visible',
    },
  ],
  'components/MatchDetailView.tsx': [
    {
      marker: 'youtube.com/watch',
      reason: 'external YouTube "watch" link — MUI outlined Button default focus-visible',
    },
  ],
};

/**
 * The element's OWN opening tag, from `<Tag` to its closing `>` — skipping the
 * `>` of arrow functions (`=>`) and balancing nested JSX in props (e.g.
 * `startIcon={<Icon/>}`). Used to test an attribute against THIS element only,
 * not a sibling further down the 1200-char window.
 */
function ownTag(src: string, start: number): string {
  let depth = 0;
  for (let j = start + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '<') depth++;
    else if (c === '>') {
      if (src[j - 1] === '=') continue; // arrow => inside a handler value
      if (depth > 0) depth--; // close of a nested JSX prop element
      else return src.slice(start, j + 1);
    }
  }
  return src.slice(start, Math.min(src.length, start + CONTROL_WINDOW));
}

/**
 * All interactive-control anchor offsets in a file: the CONTROL_RE anchors plus
 * the FIX 2 clickable `Box`/`Chip`/`div` anchors, de-duplicated (a clickable box
 * that is also `role="button"` is counted once via CONTROL_RE) and sorted so the
 * per-control window can be bounded by the next control.
 */
function controlStarts(src: string): number[] {
  const starts = new Set<number>();
  for (const m of src.matchAll(CONTROL_RE)) starts.add(m.index ?? 0);
  for (const m of src.matchAll(CLICKABLE_BOX_RE)) {
    const start = m.index ?? 0;
    // Already surfaced by CONTROL_RE's role="button" branch — don't double-count.
    // Scope the check to the box's OWN tag so a SIBLING role="button" further
    // down the file doesn't absorb this (un-ringed) clickable.
    if (/\brole="button"/.test(ownTag(src, start))) continue;
    starts.add(start);
  }
  return [...starts].sort((a, b) => a - b);
}

function windowFor(src: string, starts: number[], i: number): string {
  const next = starts[i + 1] ?? src.length;
  const end = Math.min(next, starts[i] + CONTROL_WINDOW);
  return src.slice(starts[i], end);
}

describe('SPEC-PRD-057 a11y guards (TEST-004, Spec-AC-03)', () => {
  it('TEST-004: every app-local interactive control spreads focusRing (or is a documented MUI-default exception)', () => {
    const offenders: string[] = [];
    for (const f of FILES) {
      const starts = controlStarts(f.src);
      if (starts.length === 0) continue;
      const allow = FOCUS_ALLOW[f.rel] ?? [];
      starts.forEach((_, i) => {
        const win = windowFor(f.src, starts, i);
        if (/focusRing\s*\(/.test(win)) return; // explicitly ringed
        // FIX 1: only the exact allow-listed control (by marker) is exempt — a
        // NEW un-ringed control in the same file has no marker and still fails.
        if (allow.some((a) => win.includes(a.marker))) return;
        offenders.push(`${f.rel} @char${starts[i]}`);
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

  it('TEST-004: the focusRing allow-list stays honest (each marker names a real un-ringed control)', () => {
    const stale: string[] = [];
    for (const [rel, entries] of Object.entries(FOCUS_ALLOW)) {
      const f = FILES.find((x) => x.rel === rel);
      if (!f) {
        stale.push(`${rel} (file not found)`);
        continue;
      }
      const starts = controlStarts(f.src);
      for (const entry of entries) {
        // FIX 1: an allow-list entry is only justified while the file still has
        // a matching interactive control whose window lacks an explicit
        // focusRing — verified per-marker, not per-file.
        const idx = starts.findIndex((_, i) => windowFor(f.src, starts, i).includes(entry.marker));
        if (idx === -1) {
          stale.push(`${rel} :: "${entry.marker}" (no matching interactive control)`);
          continue;
        }
        if (/focusRing\s*\(/.test(windowFor(f.src, starts, idx))) {
          stale.push(`${rel} :: "${entry.marker}" (control now spreads focusRing — remove from allow-list)`);
        }
      }
    }
    expect(stale, `Stale FOCUS_ALLOW entries:\n${stale.join('\n')}`).toEqual([]);
  });
});
