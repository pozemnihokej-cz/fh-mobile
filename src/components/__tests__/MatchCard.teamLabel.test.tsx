/**
 * spec-fan-app-prod-cleanup-and-team-names TEST-005 (Spec-AC-06) — the fan
 * list / live card names a reserve team by its curated short name.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const uiProps = vi.hoisted(() => ({ last: undefined as any }));
vi.mock('@fh/ui', () => ({
  MatchCard: (props: any) => {
    uiProps.last = props;
    return <div data-testid="ui-card" />;
  },
}));
vi.mock('../../lib/runtimeUrls', () => ({ toImageUrl: (v: unknown) => v ?? undefined }));

import { MatchCard, type MatchCardData } from '../MatchCard';

const reserveMatch: MatchCardData = {
  _id: '1',
  supabaseId: 'm1',
  homeTeamName: 'Slavia ženy B',
  homeTeamShortName: 'Slavia B',
  homeClubName: 'Slavia',
  awayTeamName: 'Rakovník ženy',
  awayTeamShortName: 'Rakovník',
  awayClubName: 'Rakovník',
  date: Date.now() + 3_600_000,
  status: 'scheduled',
};

describe('TEST-005 (Spec-AC-06): fan MatchCard label', () => {
  it('passes "Slavia B", not the bare club name, to the design-system card', () => {
    render(<MatchCard match={reserveMatch} isStarred={false} onToggleStar={() => undefined} onClick={() => undefined} />);
    expect(uiProps.last.home.name).toBe('Slavia B');
    expect(uiProps.last.away.name).toBe('Rakovník');
  });
});
