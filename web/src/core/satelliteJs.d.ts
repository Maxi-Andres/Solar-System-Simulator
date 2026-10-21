/**
 * The two parts of satellite.js the app imports, by name: see the aliases in
 * vite.config.ts for why not through the package's entry. Their types are the entry's
 * own, re-exported -- a type import is erased from the build, so the entry, and the
 * WebAssembly propagator it carries, never reach the browser.
 */
declare module 'satellite.js/io' {
  export { json2satrec } from 'satellite.js';
}

declare module 'satellite.js/sgp4' {
  export { sgp4 } from 'satellite.js';
}
