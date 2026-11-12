// @vitest-environment node
import path from 'path';
import { describe, expect, it } from 'vitest';
import { loadEnv } from 'vite';

// TEST-002 (ci-mobile-tests-anon-key): vitest.config.ts supplies a non-secret
// placeholder anon key only when no env file provides one. An env-file value
// always wins. The expected value is computed from the env FILES only, so
// process.env (where the config's test.env default lands) is hidden meanwhile.
// Known limit (spec R-2): a key supplied only through the shell environment,
// with no env file, makes this test fail although the config handles it.
const PLACEHOLDER = 'test-anon-key-not-a-secret';
const KEY = 'VITE_SUPABASE_ANON_KEY';

function fileValue(): string | undefined {
  const saved = process.env[KEY];
  delete process.env[KEY];
  try {
    const root = path.resolve(__dirname, '../../../..');
    return loadEnv(import.meta.env.MODE, root, 'VITE_')[KEY] || undefined;
  } finally {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  }
}

describe('fh-mobile test env anon key', () => {
  it('uses the env-file value when present, otherwise the non-secret placeholder', () => {
    const fromFile = fileValue();
    const expected = fromFile ?? PLACEHOLDER;
    const actual = import.meta.env.VITE_SUPABASE_ANON_KEY;
    expect(actual).toBe(expected);
    if (fromFile === undefined) {
      expect(String(actual).startsWith('eyJ')).toBe(false);
      expect(String(actual)).not.toContain('.');
    }
  });
});
