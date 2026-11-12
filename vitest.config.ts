import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// fh-mobile Vitest config (CHANGE-055 TEST-005 onwards).
// Mirrors the apps/fh-online-management config conventions: jsdom env,
// __tests__ glob, jest-dom matchers via a shared setup file. The Vite app
// itself uses vite.config.ts; this file is consumed only by vitest.
// Non-secret placeholder anon key, for tests only. Used when no env file or
// process env provides VITE_SUPABASE_ANON_KEY (e.g. CI has no root .env), so
// modules that build the supabase client at import time can load.
const TEST_ANON_KEY = 'test-anon-key-not-a-secret';
const envDir = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, envDir, 'VITE_');
  return {
    plugins: [react()],
    // CHANGE-055 TEST-012: load VITE_* env from the workspace root so
    // `import.meta.env.VITE_SUPABASE_ANON_KEY` mirrors what the dev server
    // sees. Without this the anon-client integration test cannot assert
    // `Bearer ${VITE_SUPABASE_ANON_KEY}` because the supabase-js client
    // would be constructed with an empty key.
    envDir,
    resolve: {
      alias: {
        '@convex': path.resolve(__dirname, '../../convex'),
        '@fh/runtime-urls': path.resolve(__dirname, '../../packages/runtime-urls/src/index.ts'),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
      setupFiles: ['src/__tests__/setup.ts'],
      testTimeout: 15000,
      // When the loaded env has no anon key, tests use the non-secret placeholder.
      env: loadedEnv.VITE_SUPABASE_ANON_KEY ? {} : { VITE_SUPABASE_ANON_KEY: TEST_ANON_KEY },
    },
  };
});
