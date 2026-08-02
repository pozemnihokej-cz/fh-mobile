/**
 * TEST-004 (SPEC-fan-app-live-status-derivation Spec-AC-03): the fan `MatchCard`
 * wrapper computes liveness via the shared `@fh/schema` `isMatchGenuinelyLive`
 * derivation (status `in_progress` + recent `startedAt`) and passes the boolean
 * `live` down to the design-system `UIMatchCard` — so a genuinely-live match
 * lights the badge while a scheduled / stale one does not. This is what makes
 * MatchesPage + LiveCenter cards light up (they render this same wrapper).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MATCH_LIVE_WINDOW_MS } from '@fh/schema';

// Capture the props the DS component receives from the wrapper.
const uiProps = vi.hoisted(() => ({ last: undefined as any }));
vi.mock('@fh/ui', () => ({
  MatchCard: (props: any) => {
    uiProps.last = props;
    return <div data-testid="ui-card" />;
  },
}));
// Keep the logo resolver identity-simple (not under test here).
vi.mock('../../lib/runtimeUrls', () => ({ toImageUrl: (v: unknown) => v ?? undefined }));

import { MatchCard, type MatchCardData } from '../MatchCard';

afterEach(cleanup);

const now = Date.now();
const base: MatchCardData = {
  _id: '1',
  supabaseId: 'm1',
  homeTeamName: 'Alpha',
  awayTeamName: 'Bravo',
  date: now,
  status: 'scheduled',
};

function renderWrapper(match: MatchCardData) {
  render(
    <MatchCard match={match} isStarred={false} onToggleStar={() => undefined} onClick={() => undefined} />,
  );
  return uiProps.last;
}

describe('fan MatchCard wrapper → DS live prop (Spec-AC-03)', () => {
  it('passes live=true for a genuinely-live in_progress match (recent kickoff)', () => {
    const p = renderWrapper({ ...base, status: 'in_progress', startedAt: now - 60_000 });
    expect(p.live).toBe(true);
  });

  it('passes live=false for a scheduled match', () => {
    const p = renderWrapper({ ...base, status: 'scheduled', startedAt: null });
    expect(p.live).toBe(false);
  });

  it('passes live=false for an in_progress match started long ago (awaiting closure)', () => {
    const p = renderWrapper({ ...base, status: 'in_progress', startedAt: now - (MATCH_LIVE_WINDOW_MS + 60 * 60_000) });
    expect(p.live).toBe(false);
  });

  it('passes live=false for a completed match', () => {
    const p = renderWrapper({ ...base, status: 'completed', startedAt: now - 60_000 });
    expect(p.live).toBe(false);
  });
});
