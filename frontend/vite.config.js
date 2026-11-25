import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In the dev stack the API runs in the backend container; the browser only talks to Vite.
    proxy: { '/api': { target: process.env.API_TARGET ?? 'http://localhost:8000' } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/test/**', 'src/**/*.test.{js,jsx}'],
      thresholds: { statements: 95, branches: 90, functions: 95, lines: 95 },
    },
  },
});
