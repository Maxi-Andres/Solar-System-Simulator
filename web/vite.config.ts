import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

/**
 * The two parts of satellite.js the app uses -- reading an element set, and SGP4 -- by
 * their own files, not through the package's entry.
 *
 * Since version 7 that entry also re-exports a WebAssembly bulk propagator whose loader
 * spawns a worker with a top-level await, and merely importing the entry made the build
 * fail ("Top-level await is currently not supported with the 'iife' output format").
 * Switching workers to ES modules got past that and shipped 300 KB of WebAssembly runtime
 * nobody calls. The package's `exports` allows only the entry, so these two names are
 * mapped here; their types are declared in src/core/satelliteJs.d.ts from the entry's
 * own, and the files are plain JavaScript with no imports outside the package.
 */
const SATELLITE_JS = fileURLToPath(new URL('./node_modules/satellite.js/dist/', import.meta.url));

/**
 * Whether this build carries the cosmic web (core/cosmicWeb.ts COSMIC_WEB_PUBLISHED): its data
 * is made by a step of the deploy that may fail without failing the deploy, and a site without
 * it should not ask for it -- every ask a 404 in the console. cosmic-web.json is written last, so
 * it is there only if the rest is. Read when the build (or the dev server) starts.
 */
const COSMIC_WEB_PUBLISHED = existsSync(fileURLToPath(new URL('./public/data/cosmic-web/cosmic-web.json', import.meta.url)));

export default defineConfig(({ mode }) => ({
  base: process.env.VITE_BASE ?? (mode === 'production' ? REPO_BASE : '/'),
  plugins: [react()],
  define: {
    'import.meta.env.VITE_COSMIC_WEB': JSON.stringify(COSMIC_WEB_PUBLISHED ? '1' : ''),
  },
  resolve: {
    alias: [
      { find: /^satellite\.js\/io$/, replacement: `${SATELLITE_JS}io.js` },
      { find: /^satellite\.js\/sgp4$/, replacement: `${SATELLITE_JS}propagation/sgp4.js` },
    ],
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
