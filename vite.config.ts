import { realpathSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Resolve symlinked / virtualised folders so dev-server paths match module ids
const root = realpathSync.native(process.cwd());

export default defineConfig(({ mode }) => {
  // PORT comes from .env.local, the same file the server reads, so the proxy and the server cannot disagree.
  // 8790 by default: 8787 is taken by other developer tools on some machines (a local proxy answered /api with 404).
  const apiPort = loadEnv(mode, root, '').PORT ?? process.env.PORT ?? 8790;

  // The GDELT news API does not send CORS headers, so the browser reaches it through this proxy.
  // /api goes to the Hono server (server/index.ts), which holds the database, the agents and the API keys.
  const proxy = {
    '/gdelt': { target: 'https://api.gdeltproject.org', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/gdelt/, '') },
    '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true },
  };

  return { root, plugins: [react()], server: { port: 5173, proxy }, preview: { proxy } };
});
