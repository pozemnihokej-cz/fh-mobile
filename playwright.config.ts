import { defineConfig, devices } from '@playwright/test';
// Single source of truth for .env loading. The shared loader resolves the
// workspace `.env` from its own file path (not process.cwd()), so it works
// in both the Playwright runner (cwd=apps/fh-mobile) and worker processes
// (cwd=apps/fh-mobile/e2e). Without this, VITE_SUPABASE_URL / E2E_EMAIL /
// E2E_PASSWORD / SERVICE_ROLE_KEY are silently empty in workers and every
// fixture-dependent test either skips or fails.
//
// CHANGE-055 Playwright bootstrap. Mirrors apps/fh-evidence/playwright.config.ts
// and apps/fh-online-management/playwright.config.ts so the workspace
// convention stays uniform across e2e suites.
import './e2e/utils/loadEnv';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: '../../docs/ai/reports/e2e-fh-mobile' }],
    ['list'],
  ],
  use: {
    // fh-mobile routes through fh-traefik on :10010 via the local
    // `mobile.fh.localhost` subdomain. Requires
    // `bash scripts/dev-hosts-install.sh` once per machine to register the
    // subdomain in /etc/hosts (already part of the standard dev bootstrap).
    baseURL: 'http://mobile.fh.localhost:10010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'fh-mobile',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
