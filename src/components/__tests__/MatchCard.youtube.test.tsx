/**
 * TEST-005 (Spec-AC-03, Spec-AC-06): fan MatchCard wrapper forwards YouTube indicator & localized label.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { i18n } from '@fh/i18n';

vi.mock('../../lib/runtimeUrls', () => ({ toImageUrl: (v: unknown) => v ?? undefined }));

import { MatchCard, type MatchCardData } from '../MatchCard';

afterEach(cleanup);
beforeAll(async () => {
  await i18n.changeLanguage('cs');
});

const base: MatchCardData = {
  _id: '1',
  supabaseId: '22222222-2222-4222-8222-222222222222',
  homeTeamName: 'Slavia',
  awayTeamName: 'Litice',
  date: Date.now(),
  status: 'scheduled',
};

describe('TEST-005 (Spec-AC-03): fan MatchCard YouTube stream indicator wrapper', () => {
  it('renders indicator with localized cs label when hasYoutubeStream=true', () => {
    render(
      <MatchCard
        match={base}
        compact
        hasYoutubeStream
        isStarred={false}
        onToggleStar={() => undefined}
        onClick={() => undefined}
      />,
    );
    const indicator = screen.getByTestId('fh-matchcard-youtube');
    expect(indicator.getAttribute('aria-label')).toBe('Dostupný YouTube přenos');
  });

  it('omits indicator when hasYoutubeStream is false or omitted', () => {
    render(
      <MatchCard
        match={base}
        compact
        isStarred={false}
        onToggleStar={() => undefined}
        onClick={() => undefined}
      />,
    );
    expect(screen.queryByTestId('fh-matchcard-youtube')).toBeNull();
  });
});
