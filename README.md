# Solar System Simulator

A real-time, to-scale simulation of the Solar System built on official NASA/JPL
ephemerides. Real distances and radii, drawn orbits, time controls (LIVE, pause,
warp, jump to date) and free camera navigation.

Inspired by [NASA Eyes on the Solar System](https://eyes.nasa.gov/apps/solar-system/).

> **Status:** work in progress. Step 0 (scaffolding) complete.

## Requirements

- **Node.js >= 22.18** &mdash; uses native TypeScript execution, no transpiler.
- **pnpm 10** &mdash; `npm i -g pnpm` if you don't have it.

## Usage

```bash
pnpm install         # install both workspaces
pnpm fetch:data      # download ephemerides from JPL Horizons into web/public/data/
pnpm dev             # serve the app at http://localhost:5173
```

Other commands:

```bash
pnpm test            # run tests in both workspaces
pnpm typecheck       # type-check both workspaces
pnpm build           # production build (with the GitHub Pages base path)
pnpm preview         # serve the build to verify it before publishing
```

## Layout

| Path | What it is |
|---|---|
| `tools/` | Ephemeris generator. Queries JPL Horizons and writes static JSON. Runs locally and in CI. |
| `web/` | Frontend: Vite + React + Three.js. Reads the JSON from its own origin. |
| `web/public/data/` | **Generated, not versioned.** Recreate with `pnpm fetch:data`. |

The site is fully static &mdash; there is no backend. JPL Horizons is queried only at
build time, never from a visitor's browser.

## Data sources

| Source | Used for |
|---|---|
| [JPL Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api) | Positions and velocities of planets, moons and spacecraft |
| [JPL SBDB Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | Orbital elements of asteroids and comets *(planned)* |
| [CelesTrak GP](https://celestrak.org/NORAD/elements/) | TLE/OMM data for Earth-orbiting satellites *(planned)* |
| [Gaia DR3](https://www.cosmos.esa.int/web/gaia/dr3) | Nearby stars *(planned)* |

## Credits

- Ephemerides: **NASA/JPL-Caltech**, Solar System Dynamics Group, JPL Horizons System.
- Satellite orbital data: **CelesTrak**.
- Planetary textures: see `web/public/textures/CREDITS.md`.

This project is not affiliated with or endorsed by NASA or JPL.
