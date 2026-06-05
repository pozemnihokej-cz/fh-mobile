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
      fs: {
        allow: [path.resolve(__dirname, '../..'), path.resolve(__dirname, '.')],
      },
      proxy: {
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
      },
    },
  };
});
