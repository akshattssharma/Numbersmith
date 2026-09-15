import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `base` is set from an env var so the same build works on GitHub Pages
// (served from /<repo>/) and on Vercel/Netlify/Lovable (served from /).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Numbersmith',
        short_name: 'Numbersmith',
        description: 'A maths game that models how a child thinks, not just whether they were right.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The default glob leaves out the world backdrops — without them,
        // "works offline" would mean a game with no background art, which
        // is the kind of half-offline that's worse than an honest error.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,jpg}'],
      },
    }),
  ],
  base: process.env.VITE_BASE ?? '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
