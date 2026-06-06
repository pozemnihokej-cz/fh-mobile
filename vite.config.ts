import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const envDir = path.resolve(__dirname, '../..');

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };

  const isDocker = env.DOCKER === '1';
  const cloudflaredDomain = env.CLOUDFLARED_DOMAIN;
  const cloudflaredHost = cloudflaredDomain ? `fh-mobile.${cloudflaredDomain}` : undefined;
  const allowedHosts: string[] = ['localhost', '127.0.0.1', 'mobile.fh.localhost'];

  if (cloudflaredHost) {
    allowedHosts.push(cloudflaredHost);
  }

  return {
    plugins: [react()],
    envDir,
    resolve: {
      alias: {
        '@convex': path.resolve(__dirname, '../../convex'),
        '@fh/runtime-urls': path.resolve(__dirname, '../../packages/runtime-urls/src/index.ts'),
      },
    },
    server: {
      port: isDocker ? 5173 : 3004,
      host: isDocker ? '0.0.0.0' : 'localhost',
      allowedHosts,
      watch: isDocker ? { usePolling: true, interval: 1000 } : undefined,
      // Pre-transform critical modules at startup so the first cold load
      // (typically mobile over a slow tunnel) doesn't pay a per-module
      // JIT-compile + transfer latency tax for hundreds of TS files.
      // Mirrors fh-online-management's server.warmup config.
      warmup: {
        clientFiles: [
          './src/main.tsx',
          './src/App.tsx',
          './src/routes/TenantPickerPage.tsx',
          './src/routes/TenantLayout.tsx',
          './src/routes/MatchesPage.tsx',
          './src/routes/MatchDetailPage.tsx',
          './src/routes/NotFoundPage.tsx',
          './src/routes/TenantContext.ts',
          './src/lib/supabase.ts',
          './src/lib/tenantBySlug.ts',
          './src/lib/useUrlTenantOverride.ts',
          '../../packages/auth/src/auth-context.tsx',
          '../../packages/i18n/src/index.ts',
          '../../packages/i18n/src/locales/cs.ts',
          '../../packages/i18n/src/locales/en.ts',
          '../../packages/ui/src/index.ts',
        ],
      },
      fs: {
        allow: [path.resolve(__dirname, '../..'), path.resolve(__dirname, '.')],
      },
      proxy: {
        // Mirror fh-evidence: route /api through Vite to keep same-origin
        // under the Cloudflare tunnel domain.
        '/api': {
          target: isDocker ? 'http://api:4000' : 'http://localhost:4000',
          changeOrigin: true,
        },
        '/auth/v1': {
          target: isDocker ? 'http://fh-kong:8000' : 'http://localhost:8000',
          changeOrigin: true,
        },
        '/rest/v1': {
          target: isDocker ? 'http://fh-supabase-rest:3000' : 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/rest\/v1/, ''),
        },
        '/storage/v1': {
          target: isDocker ? 'http://fh-supabase-storage:5000' : 'http://localhost:5001',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/storage\/v1/, ''),
        },
        // RFC-003: Supabase Realtime over WebSocket — mirror fh-evidence
        // so live channels work without leaking to the polling fallback.
        '/realtime/v1': {
          target: isDocker ? 'http://realtime-dev:4000' : 'http://localhost:4000',
          changeOrigin: true,
          ws: true,
          rewrite: (p) =>
            p.startsWith('/realtime/v1/api')
              ? p.replace(/^\/realtime\/v1\/api/, '/api')
              : p.replace(/^\/realtime\/v1/, '/socket'),
        },
      },
    },
  };
});
