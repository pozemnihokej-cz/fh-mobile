/**
 * spec-match-display-no-score-one-team-shootout TEST-004 (Spec-AC-04).
 *
 * The fan list card over the REAL `@fh/ui` MatchCard (no mock of the design
 * system), fed rows shaped exactly like the Convex `matches.list` output of
 * TEST-003: a completed match without a play record shows the mirrored result,
 * no digits when that result is NULL, the "sn" marker for a shootout, and one
 * team for a one-team event; a match run in OM keeps its timeline score.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { i18n } from '@fh/i18n';

vi.mock('../../lib/runtimeUrls', () => ({ toImageUrl: (v: unknown) => v ?? undefined }));

import { MatchCard, type MatchCardData } from '../MatchCard';

afterEach(cleanup);
// The fan app runs in Czech.
beforeAll(async () => {
  await i18n.changeLanguage('cs');
});

const PAST = Date.now() - 7 * 24 * 3_600_000;

function row(over: Partial<MatchCardData>): MatchCardData {
  return {
    _id: 'c1',
    supabaseId: 'm1',
    homeTeamId: 'team-h',
    awayTeamId: 'team-a',
    homeTeamName: 'Slavia ženy',
    homeTeamShortName: 'Slavia',
    awayTeamName: 'Rakovník ženy',
    awayTeamShortName: 'Rakovník',
    date: PAST,
    status: 'completed',
    // The Convex timeline aggregate of a match never run in OM.
    homeScore: 0,
    awayScore: 0,
    hasPlayRecord: false,
    resultHomeScore: null,
    resultAwayScore: null,
    decidedByShootout: false,
    ...over,
  };
}

function renderRow(match: MatchCardData, compact: boolean) {
  return render(
    <MatchCard match={match} isStarred={false} onToggleStar={() => undefined} onClick={() => undefined} compact={compact} />,
  );
}

describe.each([false, true])('TEST-004 fan MatchCard result display (compact=%s)', (compact) => {
  it('a SportsPress result shows that result, not the 0:0 timeline aggregate', () => {
    renderRow(row({ resultHomeScore: 0, resultAwayScore: 2 }), compact);
    expect(screen.getByTestId('fh-matchcard-score').textContent).toMatch(/^0\s*:\s*2$/);
  });

  it('a completed match without a result shows the played label and no digits', () => {
    const { container } = renderRow(row({}), compact);
    expect(screen.queryByTestId('fh-matchcard-score')).toBeNull();
    expect(container.textContent?.toLowerCase()).toContain('odehráno');
  });

  it('a shootout result shows the sn marker', () => {
    renderRow(row({ resultHomeScore: 3, resultAwayScore: 2, decidedByShootout: true }), compact);
    expect(screen.getByTestId('fh-matchcard-score').textContent).toMatch(/3\s*:\s*2\s*sn/);
    expect(screen.getByTestId('fh-matchcard-shootout').getAttribute('title')).toBe('po nájezdech');
  });

  it('a one-team event shows the team once', () => {
    const { container } = renderRow(
      row({ awayTeamId: 'team-h', awayTeamName: 'Slavia ženy', awayTeamShortName: 'Slavia' }),
      compact,
    );
    expect(container.textContent?.match(/Slavia/g)).toHaveLength(1);
    expect(container.textContent).not.toMatch(/\bvs\b/i);
  });

  it('a match run in OM keeps its timeline score and reads the shootout off it', () => {
    renderRow(row({ hasPlayRecord: true, homeScore: 2, awayScore: 1, decidedByShootout: true }), compact);
    expect(screen.getByTestId('fh-matchcard-score').textContent).toMatch(/2\s*:\s*1\s*sn/);
  });

  it('an older Convex row without hasPlayRecord keeps the previous timeline behaviour', () => {
    renderRow(row({ hasPlayRecord: undefined, homeScore: 4, awayScore: 1 }), compact);
    expect(screen.getByTestId('fh-matchcard-score').textContent).toMatch(/^4\s*:\s*1$/);
  });
});
