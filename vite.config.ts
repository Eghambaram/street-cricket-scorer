import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// ── Build identity shown on the Home screen ─────────────────────────────────
// version comes from package.json; the build id is the short git commit (or a
// timestamp when git isn't available) so every deploy is distinguishable.
const appVersion: string = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8')).version;
const buildTime = new Date().toISOString();
let buildId = buildTime.slice(0, 16).replace(/[-:T]/g, '');
try {
  buildId = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || buildId;
} catch {
  // not a git checkout — keep the timestamp id
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD_ID__: JSON.stringify(buildId),
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'screenshots/*.png'],
      manifest: {
        name: 'Street Cricket Scorer',
        short_name: 'CricScore',
        description: 'Score your street cricket matches offline, ball by ball.',
        theme_color: '#060f1c',
        background_color: '#060f1c',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['sports', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
