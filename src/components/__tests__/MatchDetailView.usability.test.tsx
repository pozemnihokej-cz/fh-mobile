/**
 * spec-fan-live-match-detail-usability — TEST-003, TEST-004, TEST-007..TEST-010.
 *
 * Seam: the REAL `roster:list` handler (convex/functions/roster.ts) runs over
 * mirror-shaped matchPlayers docs; its exact output is what `useQuery` hands
 * the component (see ./_fakes/convexRoster.ts). The live-clock / timeline
 * hooks are stubbed — they are not under test and would otherwise subscribe
 * to further Convex functions this fake rightly refuses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { buildTenantTheme } from '@fh/ui';
import { resolveTenantTheme } from '@fh/config';
import {
  convexFake,
  resetConvexFake,
  supabaseFake,
  resetSupabaseFake,
  runRosterList,
  mirroredRoster,
  MATCH_FN,
  ROSTER_FN,
} from './_fakes/convexRoster';

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

const fetchLineupSpy = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock('../../lib/adapters/lineup', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual: any = await importOriginal();
  return {
    ...actual,
    fetchLineup: (sb: unknown, matchId: string) => {
      fetchLineupSpy.calls.push(matchId);
      return actual.fetchLineup(sb, matchId);
    },
  };
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

const MATCH_ID = 'match-usability-1';

const testMatch = {
  _id: 'cx-match-1',
  supabaseId: MATCH_ID,
  homeTeamName: 'Slavia Praha',
  awayTeamName: 'Bohemians Praha',
  homeClubName: 'SK Slavia',
  awayClubName: 'TJ Bohemians',
  date: Date.now() + 3_600_000,
  status: 'scheduled',
  location: 'Hřiště Eden',
  leagueName: 'Extraliga mužů',
};

const theme = buildTenantTheme(resolveTenantTheme('cz-field-hockey-union'), 'dark');

function renderView() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <MatchDetailView matchId={MATCH_ID} starred={false} onToggleStar={vi.fn()} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

function openTab(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

const realImage = globalThis.Image;

beforeEach(() => {
  resetConvexFake();
  resetSupabaseFake();
  fetchLineupSpy.calls = [];
  convexFake.match = testMatch;
  // A photo whose URL contains "broken" fails to load, every other one loads.
  class FakeImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    crossOrigin: unknown;
    referrerPolicy: unknown;
    set src(v: string) {
      setTimeout(() => (String(v).includes('broken') ? this.onerror?.() : this.onload?.()), 0);
    }
  }
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.Image = realImage;
});

describe('TEST-003 roster selector counts from the real roster:list output (Spec-AC-01)', () => {
  it('TEST-003 labels the home side (16+2) and the away side (5+0)', async () => {
    convexFake.rosterResult = await runRosterList(mirroredRoster(MATCH_ID), MATCH_ID);
    renderView();
    openTab(/soupisky/i);
    const home = await screen.findByTestId('roster-side-home');
    const away = screen.getByTestId('roster-side-guest');
    expect(home.textContent).toContain('(16+2)');
    for (const wrong of ['(19)', '(18)', '(20)', '(17+1)', '(22)']) {
      expect(home.textContent).not.toContain(wrong);
    }
    expect(away.textContent).toContain('(5+0)');
    expect(away.textContent).not.toContain('(6)');
  });
});

describe('TEST-004 no misleading count before the lineup exists (Spec-AC-02)', () => {
  it('TEST-004 shows no count while the roster is unresolved and the fallback is pending, nor once it resolves empty', async () => {
    let release!: () => void;
    supabaseFake.gate = new Promise<void>((r) => {
      release = r;
    });
    convexFake.rosterResult = undefined;
    renderView();
    openTab(/soupisky/i);
    const home = screen.getByTestId('roster-side-home');
    const away = screen.getByTestId('roster-side-guest');
    expect(home.textContent).not.toMatch(/\(\d/);
    expect(away.textContent).not.toMatch(/\(\d/);

    release();
    await waitFor(() => expect(fetchLineupSpy.calls.length).toBe(1));
    // Let fetchLineup run its three fallbacks to the empty result.
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId('roster-side-home').textContent).not.toMatch(/\(\d/);
    expect(screen.getByTestId('roster-side-guest').textContent).not.toMatch(/\(\d/);
  });
});

describe('TEST-007 Referees section placement (Spec-AC-06)', () => {
  it('TEST-007 renders the Referees section immediately after the Match information card', async () => {
    convexFake.rosterResult = await runRosterList(mirroredRoster(MATCH_ID), MATCH_ID);
    renderView();
    openTab(/přehled/i);
    const card = screen.getByTestId('match-info-card');
    const next = card.nextElementSibling as HTMLElement | null;
    expect(next).not.toBeNull();
    expect(next!.getAttribute('data-testid')).toBe('match-referees');
    expect(within(next!).getByRole('heading', { name: 'Rozhodčí' })).toBeInTheDocument();
  });
});

describe('TEST-008 referee rows (Spec-AC-07)', () => {
  it('TEST-008 renders each referee once, with photo or the person fallback, never hiding the name', async () => {
    convexFake.rosterResult = await runRosterList(mirroredRoster(MATCH_ID), MATCH_ID);
    renderView();
    openTab(/přehled/i);
    const section = screen.getByTestId('match-referees');
    const rows = within(section).getAllByTestId('referee-row');
    expect(rows).toHaveLength(3);
    expect(within(section).getAllByText(/rozhodčí alfa/i)).toHaveLength(1);

    const byName = (n: string) => rows.find((r) => r.textContent?.includes(n))!;
    const alfa = byName('Rozhodčí Alfa');
    const beta = byName('Rozhodčí Beta');
    const gama = byName('Rozhodčí Gama');

    // Photo referee: an img with the resolved photo URL.
    await waitFor(() => {
      const img = alfa.querySelector('img');
      expect(img).not.toBeNull();
      expect(img!.getAttribute('src')).toBe('https://images.example.com/referee-alfa.jpg');
    });

    // Missing photo: fallback glyph, name, no img.
    expect(beta.querySelector('img')).toBeNull();
    expect(beta.querySelector('[data-testid="fh-icon-roster"], [data-fh-icon="roster"], svg')).not.toBeNull();
    expect(beta.textContent).toContain('Rozhodčí Beta');

    // Photo that fails to load: same fallback once the error fires, name kept.
    await waitFor(() => expect(gama.querySelector('img')).toBeNull());
    expect(gama.querySelector('svg')).not.toBeNull();
    expect(gama.textContent).toContain('Rozhodčí Gama');
  });
});

describe('TEST-009 referees empty and loading states (Spec-AC-08)', () => {
  it('TEST-009 shows the Czech empty state when the resolved roster names no referee', async () => {
    const noReferees = mirroredRoster(MATCH_ID).filter((r) => String(r.role).toLowerCase() !== 'referee');
    convexFake.rosterResult = await runRosterList(noReferees, MATCH_ID);
    renderView();
    openTab(/přehled/i);
    const section = screen.getByTestId('match-referees');
    expect(within(section).getByRole('heading', { name: 'Rozhodčí' })).toBeInTheDocument();
    expect(within(section).getByText('Rozhodčí zatím nebyli zveřejněni.')).toBeInTheDocument();
    expect(within(section).queryAllByTestId('referee-row')).toHaveLength(0);
  });

  it('TEST-009 shows the loading text, not the empty state, while the roster is unresolved', async () => {
    supabaseFake.gate = new Promise<void>(() => {});
    convexFake.rosterResult = undefined;
    renderView();
    openTab(/přehled/i);
    const section = screen.getByTestId('match-referees');
    expect(within(section).getByText('Načítám rozhodčí…')).toBeInTheDocument();
    expect(within(section).queryByText('Rozhodčí zatím nebyli zveřejněni.')).toBeNull();
  });
});

describe('TEST-010 no new reads, nothing but name and photo (Spec-AC-09)', () => {
  it('TEST-010 requests only the two pre-existing Convex functions with unchanged argument shapes', async () => {
    convexFake.rosterResult = await runRosterList(mirroredRoster(MATCH_ID), MATCH_ID);
    renderView();
    openTab(/přehled/i);
    openTab(/soupisky/i);
    await waitFor(() => expect(fetchLineupSpy.calls).toEqual([MATCH_ID]));

    const names = [...new Set(convexFake.calls.map((c) => c.name))].sort();
    expect(names).toEqual([MATCH_FN, ROSTER_FN].sort());
    for (const c of convexFake.calls) {
      const keys = Object.keys(c.args as object).sort();
      expect(keys).toEqual(c.name === MATCH_FN ? ['supabaseId'] : ['matchId']);
    }
    expect(convexFake.calls.filter((c) => c.name === ROSTER_FN).every((c) => (c.args as { matchId: string }).matchId === MATCH_ID)).toBe(true);
    expect(fetchLineupSpy.calls).toEqual([MATCH_ID]);
  });

  it('TEST-010 renders only the heading and referee names in the Referees section', async () => {
    convexFake.rosterResult = await runRosterList(mirroredRoster(MATCH_ID), MATCH_ID);
    renderView();
    openTab(/přehled/i);
    const section = screen.getByTestId('match-referees');
    const pieces = [
      within(section).getByRole('heading').textContent,
      ...within(section).getAllByTestId('referee-row').map((r) => r.textContent),
    ];
    expect(pieces).toEqual(['Rozhodčí', 'Rozhodčí Alfa', 'Rozhodčí Beta', 'Rozhodčí Gama']);
    // Nothing else is rendered in the section: its whole text is exactly those pieces.
    expect(section.textContent).toBe(pieces.join(''));
    expect(section.innerHTML).not.toMatch(/hasPin|userPin|0000|lineup/);
  });
});
