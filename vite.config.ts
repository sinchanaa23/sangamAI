import { realpathSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The GDELT news API does not send CORS headers, so the browser reaches it through this proxy.
const proxy = {
  '/gdelt': { target: 'https://api.gdeltproject.org', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/gdelt/, '') },
};

export default defineConfig({
  // Resolve symlinked / virtualised folders so dev-server paths match module ids
  root: realpathSync.native(process.cwd()),
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { proxy },
});
