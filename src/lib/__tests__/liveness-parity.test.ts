/**
 * TEST-006 (SPEC-fan-app-live-status-derivation Spec-AC-05): the fan app derives
 * liveness ONLY through the shared `@fh/schema` derivation — TRUE parity with OM
 * (same exported function, same inputs), not a re-implementation. This suite:
 *
 *   (a) proves `isMatchGenuinelyLive(input)` is identical to OM's live gate
 *       `classifyMatchLiveness(input).state === 'live'` across a boundary matrix;
 *   (b) pins that NO literal `status === 'live'` live-gate remains in the three
 *       fan live-detection surfaces (LiveCenter filter, MatchCard wrapper,
 *       MatchDetailView), and that each imports the shared derivation.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { classifyMatchLiveness, isMatchGenuinelyLive, MATCH_LIVE_WINDOW_MS } from '@fh/schema';

const now = 1_720_000_000_000;

// The exact input shape OM's MatchListPage.tsx feeds the classifier.
const matrix = [
  { label: 'in_progress + recent kickoff', status: 'in_progress', scheduledDate: now, startedAt: now - 60_000 },
  { label: 'in_progress + kickoff at window edge', status: 'in_progress', scheduledDate: now, startedAt: now - MATCH_LIVE_WINDOW_MS },
  { label: 'in_progress + kickoff just past window', status: 'in_progress', scheduledDate: now, startedAt: now - (MATCH_LIVE_WINDOW_MS + 1) },
  { label: 'in_progress + stale kickoff', status: 'in_progress', scheduledDate: now, startedAt: now - 5 * 60 * 60_000 },
  { label: 'in_progress + null kickoff', status: 'in_progress', scheduledDate: now, startedAt: null },
  { label: 'in_progress + future kickoff (clock skew)', status: 'in_progress', scheduledDate: now, startedAt: now + 60_000 },
  { label: 'scheduled', status: 'scheduled', scheduledDate: now, startedAt: null },
  { label: 'completed', status: 'completed', scheduledDate: now, startedAt: now - 60_000 },
  { label: 'legacy literal "live"', status: 'live', scheduledDate: now, startedAt: now - 60_000 },
  { label: 'null status', status: null, scheduledDate: now, startedAt: null },
];

describe('TEST-006 (Spec-AC-05): fan liveness derivation == OM derivation', () => {
  for (const c of matrix) {
    it(`parity for ${c.label}`, () => {
      const input = { status: c.status, scheduledDate: c.scheduledDate, startedAt: c.startedAt, now };
      // OM's live gate (MatchListPage.tsx:168) vs the fan convenience wrapper.
      const omLive = classifyMatchLiveness(input).state === 'live';
      const fanLive = isMatchGenuinelyLive(input);
      expect(fanLive).toBe(omLive);
    });
  }

  it('the legacy literal "live" status is NOT treated as live by the shared derivation', () => {
    // The mirror never writes 'live'; if a stray one appears it must NOT be
    // mistaken for a genuinely-running match by the shared derivation.
    expect(isMatchGenuinelyLive({ status: 'live', scheduledDate: now, startedAt: now - 60_000, now })).toBe(false);
  });
});

describe('TEST-006 (Spec-AC-05): no residual literal "live" gate in fan surfaces', () => {
  const SRC = path.resolve(__dirname, '../..');
  const surfaces = [
    'routes/LiveCenter.tsx',
    'components/MatchCard.tsx',
    'components/MatchDetailView.tsx',
  ];

  for (const rel of surfaces) {
    it(`${rel} imports the shared @fh/schema derivation`, () => {
      const src = fs.readFileSync(path.join(SRC, rel), 'utf-8');
      expect(src).toMatch(/from ['"]@fh\/schema['"]/);
      expect(src).toMatch(/isMatchGenuinelyLive/);
    });

    it(`${rel} contains no literal status === 'live' gate`, () => {
      const src = fs.readFileSync(path.join(SRC, rel), 'utf-8');
      // Neither quote flavor of the literal-status live gate may remain.
      expect(src).not.toMatch(/status\s*===\s*['"]live['"]/);
    });
  }
});
