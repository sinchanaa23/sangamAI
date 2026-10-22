import { realpathSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Resolve symlinked / virtualised folders so dev-server paths match module ids
  root: realpathSync.native(process.cwd()),
  plugins: [react()],
  server: { port: 5173 },
});
