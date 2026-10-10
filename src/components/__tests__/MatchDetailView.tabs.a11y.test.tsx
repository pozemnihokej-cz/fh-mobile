/**
 * spec-fan-live-match-detail-usability — TEST-005 (Spec-AC-04), TEST-006 (Spec-AC-05).
 *
 * Measures the RENDERED tabs: jsdom computed styles produced by emotion from
 * the real tenant theme (every entry of TENANT_THEMES, dark mode, as
 * main.tsx builds it), composited over every colour stop of the shipped
 * FAN_STAGE_BG (parsed from the export, never retyped) and its vignette.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { buildTenantTheme, FAN_STAGE_BG } from '@fh/ui';
import { TENANT_THEMES } from '@fh/config';
import { convexFake, resetConvexFake, resetSupabaseFake } from './_fakes/convexRoster';

vi.mock('convex/react', async () => {
  const fake = await import('./_fakes/convexRoster');
  return { useQuery: fake.useQueryFake };
});
vi.mock('convex/browser', async () => {
  const fake = await import('./_fakes/convexRoster');
  return { ConvexHttpClient: fake.ConvexHttpClientFake };
});
vi.mock('../../lib/supabase', async () => {
  const fake = await import('./_fakes/convexRoster');
  return { supabase: fake.supabaseFake };
});
vi.mock('@fh/ui', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await importOriginal();
  return {
    ...actual,
    MatchScoreboard: () => <div data-testid="scoreboard" />,
    MatchTimeline: () => null,
    MatchClock: () => null,
    LiveEventToast: () => null,
    useTimeline: () => ({ events: [], derivedState: { score: { home: 0, away: 0 }, activeSuspensions: [] }, loaded: false }),
    useLiveMatchClock: () => ({ time: 0, totalElapsed: 0, phase: '1Q', running: false, colonVisible: true, loaded: true }),
    useTimelineEventBursts: () => ({ current: null }),
  };
});

import { MatchDetailView } from '../MatchDetailView';

type RGBA = [number, number, number, number];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function parseColor(value: string): RGBA {
  const v = value.trim().toLowerCase();
  if (v === 'transparent' || v === '') return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgb) {
    const parts = rgb[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  throw new Error(`unparseable colour: ${value}`);
}

function over(fg: RGBA, bg: [number, number, number]): [number, number, number] {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) as [number, number, number];
}

function luminance(c: [number, number, number]): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Every rendered stage background: the three gradient stops and each under the vignette. */
function stageBackgrounds(): Array<[number, number, number]> {
  const stops = [...FAN_STAGE_BG.matchAll(/hsl\((\d+(?:\.\d+)?) (\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%\)/g)].map((m) =>
    hslToRgb(Number(m[1]), Number(m[2]), Number(m[3])),
  );
  const vignette = /hsla\((\d+) (\d+)% (\d+)% \/ ([\d.]+)\)/.exec(FAN_STAGE_BG);
  expect(stops.length).toBe(3);
  expect(vignette).not.toBeNull();
  const v = hslToRgb(Number(vignette![1]), Number(vignette![2]), Number(vignette![3]));
  const alpha = Number(vignette![4]);
  return [...stops, ...stops.map((s) => over([...v, alpha] as RGBA, s))];
}

const TABS = [/průběh/i, /přehled/i, /soupisky/i];

function renderWithTenant(slug: string) {
  const theme = buildTenantTheme(TENANT_THEMES[slug], 'dark');
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <MatchDetailView matchId="match-tabs-1" starred={false} onToggleStar={vi.fn()} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function tabButtons(): HTMLElement[] {
  return TABS.map((name) => screen.getByRole('button', { name }));
}

/** The emitted `:focus-visible` declaration block for one element's emotion class. */
function focusVisibleRuleText(el: HTMLElement): string | null {
  const classes = [...el.classList].filter((c) => c.startsWith('css-'));
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of [...rules]) {
      const sel = (rule as CSSStyleRule).selectorText ?? '';
      if (classes.some((c) => sel.includes(`.${c}:focus-visible`))) return rule.cssText;
    }
  }
  return null;
}

beforeEach(() => {
  resetConvexFake();
  resetSupabaseFake();
  convexFake.match = {
    _id: 'cx-tabs',
    supabaseId: 'match-tabs-1',
    homeTeamName: 'Slavia Praha',
    awayTeamName: 'Bohemians Praha',
    date: Date.now() + 3_600_000,
    status: 'scheduled',
    location: 'Hřiště Eden',
  };
  convexFake.rosterResult = [];
});

describe('TEST-005 tab contrast on the LIVE stage (Spec-AC-04)', () => {
  const slugs = Object.keys(TENANT_THEMES);

  it('TEST-005 covers at least the default and one other tenant', () => {
    expect(slugs).toContain('cz-field-hockey-union');
    expect(slugs.length).toBeGreaterThanOrEqual(2);
  });

  for (const slug of slugs) {
    it(`TEST-005 every tab label meets 4.5:1 and the active fill 3:1, tenant ${slug}`, () => {
      renderWithTenant(slug);
      const bar = screen.getByTestId('match-detail-tabs');
      const track = parseColor(getComputedStyle(bar).backgroundColor);
      const failures: string[] = [];
      for (let activeIdx = 0; activeIdx < TABS.length; activeIdx++) {
        fireEvent.click(tabButtons()[activeIdx]);
        const buttons = tabButtons();
        const pressed = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true');
        if (pressed.length !== 1 || pressed[0] !== buttons[activeIdx]) {
          failures.push(`${slug} tab ${activeIdx} active: aria-pressed on ${pressed.length} tab(s)`);
        }
        buttons.forEach((btn, i) => {
          const cs = getComputedStyle(btn);
          const fill = parseColor(cs.backgroundColor);
          const text = parseColor(cs.color);
          for (const stage of stageBackgrounds()) {
            const trackRgb = over(track, stage);
            const fillRgb = over(fill, trackRgb);
            const label = contrast(over(text, fillRgb), fillRgb);
            if (label < 4.5) failures.push(`${slug} tab ${i} ${i === activeIdx ? 'active' : 'inactive'} label ${label.toFixed(2)}`);
            if (i === activeIdx) {
              const pill = contrast(fillRgb, trackRgb);
              if (pill < 3) failures.push(`${slug} tab ${i} active fill vs track ${pill.toFixed(2)}`);
            }
          }
        });
      }
      expect(failures).toEqual([]);
      cleanup();
    });
  }
});

describe('TEST-006 touch target and visible focus (Spec-AC-05)', () => {
  it('TEST-006 each tab has a 44px minimum box and a focus-visible outline that shows on the stage', () => {
    renderWithTenant('cz-field-hockey-union');
    const failures: string[] = [];
    for (const btn of tabButtons()) {
      const cs = getComputedStyle(btn);
      const minH = parseFloat(cs.minHeight);
      const minW = parseFloat(cs.minWidth);
      if (!(minH >= 44)) failures.push(`${btn.textContent} min-height ${cs.minHeight || '(none)'}`);
      if (!(minW >= 44)) failures.push(`${btn.textContent} min-width ${cs.minWidth || '(none)'}`);

      const ruleText = focusVisibleRuleText(btn);
      if (!ruleText) {
        failures.push(`${btn.textContent} has no :focus-visible rule`);
        continue;
      }
      const outline = /outline:\s*([^;]+);/.exec(ruleText);
      if (!outline) {
        failures.push(`${btn.textContent} focus rule has no outline: ${ruleText}`);
        continue;
      }
      const width = /(\d+(?:\.\d+)?)px/.exec(outline[1]);
      const colour = /(#[0-9a-f]{3,8}|rgba?\([^)]+\))/i.exec(outline[1]);
      if (!width || Number(width[1]) < 2) failures.push(`${btn.textContent} outline width ${outline[1]}`);
      if (!colour) {
        failures.push(`${btn.textContent} outline colour missing: ${outline[1]}`);
        continue;
      }
      const ring = parseColor(colour[1]);
      for (const stage of stageBackgrounds()) {
        const ratio = contrast(over(ring, stage), stage);
        if (ratio < 3) failures.push(`${btn.textContent} ring ${ratio.toFixed(2)} on stage`);
      }
    }
    expect(failures).toEqual([]);
  });
});

/**
 * The value a pseudo-state rule of this element's emotion class declares for
 * `prop`, last rule wins (emotion emits the component's own rule first and the
 * sx override after it). Media-wrapped rules are skipped: they only apply on
 * hover-less devices, where there is no hover state to render.
 */
function stateDecl(el: HTMLElement, suffixes: string[], prop: string): string | null {
  const classes = [...el.classList].filter((c) => c.startsWith('css-'));
  let found: string | null = null;
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of [...rules]) {
      const sel = (rule as CSSStyleRule).selectorText;
      if (!sel) continue;
      const parts = sel.split(',').map((p) => p.trim());
      if (!parts.some((p) => classes.some((c) => suffixes.some((sfx) => p === `.${c}${sfx}`)))) continue;
      const v = (rule as CSSStyleRule).style.getPropertyValue(prop);
      if (v) found = v;
    }
  }
  return found;
}

describe('TEST-012 hover and focus-visible states keep AA contrast (Spec-AC-04)', () => {
  const STATES: Array<{ name: string; suffixes: string[] }> = [
    { name: 'hover', suffixes: [':hover'] },
    { name: 'focus-visible', suffixes: [':focus-visible', '.Mui-focusVisible'] },
  ];

  for (const slug of Object.keys(TENANT_THEMES)) {
    it(`TEST-012 every tab in hover and focus-visible, active and inactive, meets 4.5:1 on all stage stops, tenant ${slug}`, () => {
      renderWithTenant(slug);
      const bar = screen.getByTestId('match-detail-tabs');
      const track = parseColor(getComputedStyle(bar).backgroundColor);
      const failures: string[] = [];
      for (let activeIdx = 0; activeIdx < TABS.length; activeIdx++) {
        fireEvent.click(tabButtons()[activeIdx]);
        tabButtons().forEach((btn, i) => {
          const role = i === activeIdx ? 'active' : 'inactive';
          // A ripple paints a translucent currentColor layer under the label,
          // which no stylesheet rule shows: the tabs must not carry one. MUI
          // mounts it lazily, so press the tab first.
          fireEvent.mouseDown(btn);
          fireEvent.mouseUp(btn);
          if (btn.querySelector('.MuiTouchRipple-root')) failures.push(`${slug} tab ${i} ${role}: ripple layer present`);
          const cs = getComputedStyle(btn);
          for (const st of STATES) {
            const fill = parseColor(stateDecl(btn, st.suffixes, 'background-color') ?? cs.backgroundColor);
            const text = parseColor(stateDecl(btn, st.suffixes, 'color') ?? cs.color);
            for (const stage of stageBackgrounds()) {
              const fillRgb = over(fill, over(track, stage));
              const ratio = contrast(over(text, fillRgb), fillRgb);
              if (ratio < 4.5) failures.push(`${slug} tab ${i} ${role} ${st.name} label ${ratio.toFixed(2)}`);
            }
          }
        });
      }
      expect(failures).toEqual([]);
      cleanup();
    });
  }
});

