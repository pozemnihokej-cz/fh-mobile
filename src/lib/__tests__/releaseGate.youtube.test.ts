/**
 * TEST-001 (Spec-AC-01): test-only YouTube stream preview gate & Dockerfile build ARG.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('TEST-001 (Spec-AC-01): youtubeStreamPreviewEnabled() and Dockerfile build arg', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    [false, '', '', true],
    [false, 'false', '', true],
    [true, '', '', false],
    [true, 'false', '', false],
    [true, '', 'true', false],
    [true, 'true', '', true],
    [true, 'true', 'false', true],
  ])(
    'PROD=%s VITE_ENABLE_FAN_YOUTUBE_PREVIEW=%j VITE_ENABLE_UNRELEASED_PAGES=%j -> enabled=%s',
    async (prod, ytFlag, unreleasedFlag, expectedEnabled) => {
      vi.stubEnv('PROD', prod);
      vi.stubEnv('VITE_ENABLE_FAN_YOUTUBE_PREVIEW', ytFlag);
      vi.stubEnv('VITE_ENABLE_UNRELEASED_PAGES', unreleasedFlag);
      const { youtubeStreamPreviewEnabled, unreleasedPagesHidden } = await import('../releaseGate');
      expect(youtubeStreamPreviewEnabled()).toBe(expectedEnabled);
      // Enabling the YouTube preview flag never unhides unreleased pages
      if (prod && unreleasedFlag !== 'true') {
        expect(unreleasedPagesHidden()).toBe(true);
      }
    },
  );

  it('Dockerfile.frontend.prod declares empty-default ARG and ENV VITE_ENABLE_FAN_YOUTUBE_PREVIEW before build', () => {
    const dfPath = resolve(__dirname, '../../../../../docker/dockerfiles/Dockerfile.frontend.prod');
    const df = readFileSync(dfPath, 'utf-8');
    expect(df).toMatch(/^ARG\s+VITE_ENABLE_FAN_YOUTUBE_PREVIEW=\s*$/m);
    expect(df).toMatch(/VITE_ENABLE_FAN_YOUTUBE_PREVIEW=\$\{VITE_ENABLE_FAN_YOUTUBE_PREVIEW\}/);
    const argIdx = df.indexOf('ARG VITE_ENABLE_FAN_YOUTUBE_PREVIEW=');
    const buildIdx = df.indexOf('pnpm --filter "./${APP_DIR}" build');
    expect(argIdx).toBeGreaterThan(-1);
    expect(argIdx).toBeLessThan(buildIdx);
  });
});
