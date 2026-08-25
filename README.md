# Max's Solar System

A real-time, to-scale simulation of the Solar System built on official NASA/JPL
ephemerides. Real distances, real radii, real velocities, drawn orbits, time controls
and free camera navigation.

**→ [maxi-andres.github.io/Solar-System-Simulator](https://maxi-andres.github.io/Solar-System-Simulator/)**

Inspired by [NASA Eyes on the Solar System](https://eyes.nasa.gov/apps/solar-system/).

> **Status:** v1 complete — Sun, eight planets and Pluto. See [Roadmap](#roadmap).

## What "to scale" means here

Distances and sizes are never compressed. That is unusual, and it has a consequence:
at true scale the planets are essentially invisible. Earth seen from the Sun's
distance is 1/20th of a pixel.

So a body below a few pixels gets a hollow marker ring drawn **around** it, not
instead of it. A distant planet is a dot inside a ring; approach and the dot grows
until it fills the ring, and the ring fades. That ring is the only place the render
departs from physical scale, and it only applies where physical scale has nothing
left to show.

Everything else is measured:

- **Positions and velocities** interpolated from JPL state vectors with cubic
  Hermite. Error against JPL at finer resolution: 32 m for Earth, 9.7 km for Mercury.
- **Radii and polar flattening** from the IAU 2015 report. Saturn renders 9.8% shorter
  pole to pole, because it is.
- **Rotation** at each body's real sidereal rate, retrograde for Venus, Uranus and
  Pluto.
- **Time** converted UTC → TAI → TT → TDB, leap seconds included. Skipping that 69 s
  offset would misplace Earth by 2000 km.
- **Light time and relative speeds**, computed from the same vectors. The readout
  matches NASA Eyes' Distance Tool to the second.

## Requirements

- **Node.js >= 22.18** — uses native TypeScript execution, no transpiler.
- **pnpm 10** — `npm i -g pnpm` if you don't have it.

## Usage

```bash
pnpm install         # install both workspaces
pnpm fetch:data      # download ephemerides from JPL Horizons into web/public/data/
pnpm dev             # serve the app at http://localhost:5173
```

`pnpm fetch:data` must run at least once; without it the app has nothing to show.

Other commands:

```bash
pnpm test            # 190 tests across both workspaces
pnpm typecheck       # type-check both workspaces
pnpm build           # production build (with the GitHub Pages base path)
pnpm preview         # serve the build to verify it before publishing
```

## Getting around

- **Drag** to rotate. There is no pole to get stuck at — in space there is no up, so
  the view tumbles freely in any direction.
- **Scroll** to zoom. Each notch changes distance by a fixed ratio, so a few thousand
  km and tens of AU are equally easy to navigate.
- **Click** any body, label or table row to focus it.
- **Play** always runs forward at real time from wherever you are; **rewind** is the
  only control that ever runs time backwards.
- The **layers panel** lists what exists and what is still to come, disabled and
  badged with the phase that brings it.

## Layout

| Path | What it is |
|---|---|
| `tools/` | Ephemeris generator. Queries JPL Horizons and writes static JSON. Runs locally and in CI. |
| `web/` | Frontend: Vite + React + Three.js. Reads the JSON from its own origin. |
| `web/public/data/` | **Generated, not versioned.** Recreate with `pnpm fetch:data`. |

The site is fully static — there is no backend. JPL Horizons is queried only at build
time, never from a visitor's browser.

## Generated data

`pnpm fetch:data` writes about 1.5 MB of JSON, covering 20 years — ten back and ten
forward from the day it runs:

```
web/public/data/
├─ manifest.json          # generation time, frame, covered window, body list
├─ bodies.json            # the catalog: radii, GM, rotation, color, parent
├─ vectors/<id>.json      # state vectors, column-wise: t, x, y, z, vx, vy, vz
└─ elements/<id>.json     # osculating orbital elements at one epoch
```

Two things about the reference frames are worth knowing, because getting them wrong
produces numbers that look fine and are not:

- **State vectors are barycentric** (`CENTER='500@0'`). The Solar System barycenter is
  the inertial origin, so it is the right frame for positions. The Sun itself orbits
  it, up to ~1.5 million km out.
- **Orbital elements are heliocentric** (`CENTER='500@10'`). A Keplerian ellipse needs
  the dominating mass at its focus. Requesting barycentric elements puts Mercury's
  semi-major axis 2% off and its period 3% off; against the Sun's center the same
  request lands within 0.01%.

Positions come from vectors, so they are exact DE441 values regardless. The elements
only shape the drawn orbit line and the out-of-window fallback.

### Sample spacing

Spacing is chosen **per body from measured error**, not set globally. A single step
cannot serve both Mercury and Neptune: at one day Neptune's 165-year orbit gets 60,000
samples per revolution for no benefit, while Mercury at 47 km/s genuinely needs every
one. Each body's daily ephemeris was decimated and re-interpolated to find the widest
spacing that still lands well inside its own radius:

| Body | Step | Interpolation error |
|---|---|---|
| Mercury | 1 day | < 0.01 body radii |
| Pluto | 2 days | 0.07 — limited by Charon, not by its orbit |
| Venus, Earth | 4 days | < 0.01 |
| Sun, Mars | 8 days | < 0.01 |
| Jupiter, Saturn, Uranus, Neptune | 64 days | 0.02 |

That is why a 20-year window costs less than the 6-year one that used a flat one-day
step: 16,900 samples against 21,900.

### Freshness

Planetary ephemerides do not go stale. DE441 is a deterministic integration covering
year −13200 to 17191, so a build today already carries exact positions for a decade
either side. The weekly CI run re-centres that window on the present; it does not
correct drift.

Outside the downloaded window the app falls back to Keplerian propagation and says
**APPROXIMATE** while it does.

Two caveats worth knowing:

- **The window's past edge moves too.** It is ten years wide, so a decade of weekly
  runs would eventually push today out the back. `WINDOW_YEARS_BACK` in
  `tools/src/config.ts` if that ever matters.
- **GitHub disables scheduled workflows in public repositories after 60 days with no
  activity.** GitHub emails a warning first, and any push or a click in the Actions
  tab re-enables it. If it does lapse, nothing breaks: the published site stays exact
  until the end of whatever window it last built, five years out.

## Deploying

Two workflows in `.github/workflows/`:

- **`ci.yml`** — every branch except `main`, and pull requests. Type-check, tests,
  build. Ephemerides are cached per day so CI does not hit JPL on every commit.
- **`deploy.yml`** — pushes to `main`, plus a weekly cron and a manual button.
  Fetches fresh data, runs the full suite, builds and publishes to GitHub Pages. Once
  it is enabled you never need to run `pnpm fetch:data` yourself for the published
  site; the local command exists for development and for the integration tests.

To enable it, once: **Settings → Pages → Source → GitHub Actions**. That also creates
the `github-pages` environment the deploy job targets, which is why an editor may flag
`environment: name: github-pages` as unknown until then.

`web/vite.config.ts` sets `base: '/Solar-System-Simulator/'` for a project site.
Override with `VITE_BASE` if the repo is renamed, or set it to `/` for a user site.

## Page weight

About **940 KB gzipped** on first load: 296 KB of application and 647 KB of
ephemerides. GitHub Pages serves both compressed, so the 1.5 MB of JSON on disk is
not what crosses the wire.

| Connection | First load |
|---|---|
| Fibre / good wifi (50 Mbps) | 0.15 s |
| Typical broadband (20 Mbps) | 0.4 s |
| 4G mobile (10 Mbps) | 0.8 s |
| 3G mobile (1.6 Mbps) | 4.7 s |

Everything is cached after the first visit, so this is a first-load cost only. The
app does wait for all ten bodies before rendering, since a partially-populated Solar
System would be worse than a moment of "LOADING EPHEMERIDES". If the catalog grows
past a few dozen bodies that should become progressive loading.

## Data sources

| Source | Used for |
|---|---|
| [JPL Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api) | Positions and velocities of planets, moons and spacecraft |
| [JPL SBDB Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | Orbital elements of asteroids and comets *(planned)* |
| [CelesTrak GP](https://celestrak.org/NORAD/elements/) | TLE/OMM data for Earth-orbiting satellites *(planned)* |
| [Gaia DR3](https://www.cosmos.esa.int/web/gaia/dr3) | Nearby stars *(planned)* |

## Roadmap

- **Textures** — surface maps, which will make the already-correct rotation visible.
- **Phase A** — moons and spacecraft, using the reference-frame tree already in place.
- **Phase B** — asteroids and comets from SBDB, rendered with instancing and Keplerian
  propagation in the vertex shader.
- **Phase C** — Earth-orbiting satellites from CelesTrak, propagated with SGP4 in a
  worker.
- **Phase D** — nearby stars from Gaia, replacing the placeholder starfield, out to
  Alpha Centauri.

## Known approximations

Stated plainly, since the point of the project is that everything else is not:

- The **starfield is procedurally generated**, not a catalog. It is the one thing on
  screen that is not real. Phase D replaces it.
- **Flood** and **Shadow** lighting are legibility aids; only **Natural** is physical.
- Body rotation is at the correct rate but **not aligned to a real prime meridian** —
  that needs the IAU rotational elements, and matters once textures land.
- The **surface** distance mode subtracts equatorial radii, not the radius along the
  line of sight. NASA Eyes does the same.

## Credits

- Ephemerides: **NASA/JPL-Caltech**, Solar System Dynamics Group, JPL Horizons System.
- Satellite orbital data: **CelesTrak**.
- Planetary textures: see `web/public/textures/CREDITS.md`.
- Interface icons are hand-written inline SVG — no icon set, nothing to attribute.

This project is not affiliated with or endorsed by NASA or JPL.
