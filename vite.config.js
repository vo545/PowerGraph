import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Vite plugin: after every production build, replace __BUILD_ID__ in dist/sw.js
// with the current timestamp so the browser detects a new service worker version.
function injectSwBuildId() {
  return {
    name: 'inject-sw-build-id',
    apply: 'build',
    closeBundle() {
      const swPath = 'dist/sw.js';
      if (!existsSync(swPath)) return;
      const sw = readFileSync(swPath, 'utf8');
      writeFileSync(swPath, sw.replace('__BUILD_ID__', Date.now().toString()));
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), injectSwBuildId()],
  base: mode === 'production' ? '/PowerGraph/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
}));
