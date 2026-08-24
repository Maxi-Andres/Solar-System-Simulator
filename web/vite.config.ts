import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * A GitHub Pages project site is served under /<repo-name>/, so the build needs that
 * prefix or every asset 404s. In dev we use '/' so localhost:5173 works without it.
 *
 * Override with VITE_BASE if the repo is renamed, or if it becomes a user site
 * (username.github.io), where the base is '/'.
 */
const REPO_BASE = '/Solar-System-Simulator/';

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === 'production' ? REPO_BASE : '/'),
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
