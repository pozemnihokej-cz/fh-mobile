import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// fh-mobile Vitest config (CHANGE-055 TEST-005 onwards).
// Mirrors the apps/fh-online-management config conventions: jsdom env,
// __tests__ glob, jest-dom matchers via a shared setup file. The Vite app
// itself uses vite.config.ts; this file is consumed only by vitest.
export default defineConfig({
  plugins: [react()],
  // CHANGE-055 TEST-012: load VITE_* env from the workspace root so
  // `import.meta.env.VITE_SUPABASE_ANON_KEY` mirrors what the dev server
  // sees. Without this the anon-client integration test cannot assert
  // `Bearer ${VITE_SUPABASE_ANON_KEY}` because the supabase-js client
  // would be constructed with an empty key.
  envDir: path.resolve(__dirname, '../..'),
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
  },
});
