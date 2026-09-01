import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` is set from an env var so the same build works on GitHub Pages
// (served from /<repo>/) and on Vercel/Netlify/Lovable (served from /).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
