import { realpathSync } from 'node:fs';
import { defineConfig } from 'vite';
import type { Connect, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleAsk, handleExtract } from './server/ai';

// The GDELT news API does not send CORS headers, so the browser reaches it through this proxy.
const proxy = {
  '/gdelt': { target: 'https://api.gdeltproject.org', changeOrigin: true, rewrite: (p: string) => p.replace(/^\/gdelt/, '') },
};

// Ask Sangam: AI endpoints served by the dev/preview server so the API key stays on the server.
function sangamApi(): Plugin {
  const mount = (m: Connect.Server) => {
    m.use('/api/ask', (req, res) => { void handleAsk(req, res); });
    m.use('/api/extract-certificate', (req, res) => { void handleExtract(req, res); });
  };
  return { name: 'sangam-api', configureServer: (s) => mount(s.middlewares), configurePreviewServer: (s) => mount(s.middlewares) };
}

export default defineConfig({
  // Resolve symlinked / virtualised folders so dev-server paths match module ids
  root: realpathSync.native(process.cwd()),
  plugins: [react(), sangamApi()],
  server: { port: 5173, proxy },
  preview: { proxy },
});
