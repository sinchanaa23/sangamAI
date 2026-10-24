import { serve } from '@hono/node-server';
import { createApp } from './app';

// API keys live in .env.local (git-ignored); the browser never sees them.
try { process.loadEnvFile('.env.local'); } catch { /* no .env.local: replay mode only */ }

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: createApp().fetch, port }, () => console.log(`Sangam server on http://localhost:${port}`));
