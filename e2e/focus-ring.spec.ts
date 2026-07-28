/**
 * SPEC-PRD-057 TEST-005 (Spec-AC-03, e2e) — keyboard focus ring.
 *
 * Verifies that keyboard navigation on a live fan screen moves focus onto an
 * interactive control and renders the shared `@fh/ui` `focusRing` — a 3px solid
 * `primary` outline applied on `:focus-visible` / `.Mui-focusVisible` (see
 * packages/ui/src/mobile/a11y.ts). Pointer clicks stay ring-free; only keyboard
 * focus surfaces it, which is exactly what Tab exercises here.
 *
 * Runs against `/e2e-test/standings` (a real screen with header + row controls)
 * so the assertion is about live rendered focus behaviour, not a mock. Read-only;
 * `cz-field-hockey-union` never referenced.
 */

import { test, expect } from '@playwright/test';
import { E2E_TEST_SLUG } from './utils/mockAuth';

interface FocusInfo {
  tag: string;
  interactive: boolean;
  outlineWidth: string;
  outlineStyle: string;
  focusVisible: boolean;
}

function readActiveFocus(): FocusInfo | null {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const interactiveTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  return {
    tag: el.tagName,
    interactive: interactiveTags.includes(el.tagName) || el.tabIndex >= 0,
    outlineWidth: cs.outlineWidth,
    outlineStyle: cs.outlineStyle,
    focusVisible: el.classList.contains('Mui-focusVisible'),
  };
}

test.describe('SPEC-PRD-057 TEST-005 — keyboard focus ring', () => {
  test('Tab moves focus to an interactive control that shows a visible focus ring', async ({ page }) => {
    await page.goto(`/${E2E_TEST_SLUG}/standings`);
    // Wait for the screen to render so focusable controls are present.
    await expect(page.getByTestId('standings-screen')).toBeVisible({ timeout: 15_000 });

    // Tab through the first several controls; assert at least one interactive
    // control receives focus AND paints the focus ring (3px solid outline via
    // .Mui-focusVisible). We stop at the first ringed control.
    let ringed: FocusInfo | null = null;
    for (let i = 0; i < 10 && !ringed; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(readActiveFocus);
      if (
        info
        && info.interactive
        && info.focusVisible
        && info.outlineStyle === 'solid'
        && parseFloat(info.outlineWidth) >= 3
      ) {
        ringed = info;
      }
    }

    expect(ringed, 'a keyboard-focused interactive control should paint the 3px focus ring').not.toBeNull();
    expect(ringed?.focusVisible).toBe(true);
    expect(parseFloat(ringed?.outlineWidth ?? '0')).toBeGreaterThanOrEqual(3);
    expect(ringed?.outlineStyle).toBe('solid');
  });
});
