/**
 * Shared .env loader for fh-mobile E2E tests.
 *
 * Playwright workers run with `process.cwd()` set to the e2e directory,
 * not the workspace root. This loader resolves the search starting from
 * the FILE path of this module so it works regardless of how Playwright
 * is launched.
 *
 * Vars are only set when not already present in process.env, so explicit
 * shell env still wins.
 *
 * Mirrors apps/fh-evidence/e2e/utils/loadEnv.ts byte-for-byte (other than
 * the doc comment header) — keeping the convention identical across e2e
 * suites means any future fix to .env discovery applies uniformly.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let envLoaded = false;

const __dirname_loader = dirname(fileURLToPath(import.meta.url));

export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;

  const candidateRoots = [
    process.cwd(),
    resolve(process.cwd(), '..'),
    resolve(process.cwd(), '../..'),
    resolve(process.cwd(), '../../..'),
    __dirname_loader,
    resolve(__dirname_loader, '..'),
    resolve(__dirname_loader, '../..'),
    resolve(__dirname_loader, '../../..'),
    resolve(__dirname_loader, '../../../..'),
  ];

  for (const root of candidateRoots) {
    for (const fileName of ['.env.local', '.env']) {
      const envPath = resolve(root, fileName);
      if (!existsSync(envPath)) continue;

      const contents = readFileSync(envPath, 'utf8');
      for (const rawLine of contents.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx);
        if (!key || process.env[key] !== undefined) continue;
        let value = line.slice(eqIdx + 1);
        if (
          (value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }
}

// Eagerly load on module import. Tests can opt out by setting
// FH_DISABLE_AUTOLOAD_ENV=1 if they need different behaviour.
if (!process.env.FH_DISABLE_AUTOLOAD_ENV) {
  loadEnv();
}
