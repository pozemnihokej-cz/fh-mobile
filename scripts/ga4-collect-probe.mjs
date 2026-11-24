#!/usr/bin/env node
// ga4-collect-probe.mjs — does the real gtag.js send a GA4 hit for the queue
// that src/lib/analytics.ts builds? (ga4-gtag-commands-not-sent)
//
// Bundles src/lib/analytics.ts (Supabase client stubbed), runs initGa4 and
// trackPageView on a routed test origin in headless Chromium, lets Google's
// gtag.js load from the network, and records every Google Analytics request.
// Every such request is ABORTED, so no hit reaches any GA4 property; the
// default ID is a non-production placeholder.
//
// Usage (from apps/fh-mobile):
//   node scripts/ga4-collect-probe.mjs [--id G-AAIPROBE01] [--timeout-ms 15000]
//
// Exit 0: at least one g/collect request with tid=<id> and en=page_view.
// Exit 1: none observed (the queue was not processed).
// Exit 2: the probe itself failed (bundle, browser or network error).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from '@playwright/test';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const measurementId = argValue('--id', 'G-AAIPROBE01');
const timeoutMs = Number(argValue('--timeout-ms', '15000'));
const probeOrigin = 'https://ga4-probe.test';

async function bundleAnalytics() {
  const stubId = '\0ga4-probe-supabase-stub';
  const result = await build({
    configFile: false,
    root: appDir,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: {
        entry: path.join(appDir, 'src/lib/analytics.ts'),
        name: 'FhAnalytics',
        formats: ['iife'],
        fileName: () => 'analytics.js',
      },
    },
    plugins: [
      {
        name: 'ga4-probe-supabase-stub',
        enforce: 'pre',
        resolveId(source, importer) {
          if (source === './supabase' && importer && importer.endsWith(path.join('src', 'lib', 'analytics.ts'))) {
            return stubId;
          }
          return null;
        },
        load(id) {
          return id === stubId ? 'export const supabase = {};' : null;
        },
      },
    ],
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((output) => output.output).find((item) => item.type === 'chunk');
  if (!chunk) throw new Error('vite produced no chunk for src/lib/analytics.ts');
  return chunk.code;
}

function describeHit(url, postData) {
  const parsed = new URL(url);
  const bodyEvents = (postData ?? '')
    .split('\n')
    .filter(Boolean)
    .map((line) => new URLSearchParams(line).get('en'))
    .filter(Boolean);
  return {
    host: parsed.host,
    path: parsed.pathname,
    tid: parsed.searchParams.get('tid'),
    en: [parsed.searchParams.get('en'), ...bodyEvents].filter(Boolean),
  };
}

async function main() {
  const bundle = await bundleAnalytics();
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>GA4 probe</title></head><body>
<script>${bundle}</script>
<script>
  window.__probe = {
    initialized: FhAnalytics.initGa4(${JSON.stringify(measurementId)}),
  };
  FhAnalytics.trackPageView('/ga4-probe', 'GA4 probe');
</script></body></html>`;

  const browser = await chromium.launch();
  const hits = [];
  try {
    const context = await browser.newContext();
    await context.route(`${probeOrigin}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }),
    );
    // Record and abort every Google Analytics request: nothing leaves the probe.
    await context.route(/https:\/\/([a-z0-9-]+\.)*(google-analytics\.com|analytics\.google\.com)\//, (route) => {
      const request = route.request();
      hits.push(describeHit(request.url(), request.postData()));
      return route.abort();
    });

    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${probeOrigin}/ga4-probe`);
    const probe = await page.evaluate(() => ({
      initialized: window.__probe?.initialized ?? false,
      gtagScript: Boolean(document.querySelector('script[src*="googletagmanager.com/gtag/js"]')),
    }));

    if (!probe.initialized || pageErrors.length > 0) {
      throw new Error(`the probe page did not initialize GA4: ${JSON.stringify({ ...probe, pageErrors })}`);
    }

    const isPageViewHit = (hit) => hit.path.endsWith('/collect') && hit.tid === measurementId && hit.en.includes('page_view');
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && !hits.some(isPageViewHit)) {
      await page.waitForTimeout(250);
    }

    const pageViewHits = hits.filter(isPageViewHit);
    console.log(
      JSON.stringify(
        { measurementId, ...probe, pageErrors, analyticsRequests: hits.length, pageViewCollectRequests: pageViewHits.length, hits },
        null,
        2,
      ),
    );
    if (pageViewHits.length > 0) {
      console.log(`PROBE PASS: gtag.js sent ${pageViewHits.length} page_view collect request(s) for ${measurementId} (all aborted)`);
      return 0;
    }
    console.log(`PROBE FAIL: no page_view collect request for ${measurementId} within ${timeoutMs} ms`);
    return 1;
  } finally {
    await browser.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`PROBE ERROR: ${error instanceof Error ? error.stack : String(error)}`);
    process.exit(2);
  },
);
