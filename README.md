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
- **Axis direction and prime meridian** from the IAU rotational elements, so every body
  is turned the way it is actually turned — and so that the face you are looking at is the
  face that is really there. Verified against JPL's own sub-solar point for all nine
  planets across 2026, in **both** coordinates: latitude to **0.0026°**, nine arcseconds,
  and longitude to **0.02°**. Earth's noon falls on Greenwich.

  Checking the longitude needs two things the latitude never did. **Light time**, because
  Horizons reports where the Sun stood when the light we see left the body — Neptune is
  four light hours away and turns 90° in that time. And **the sign convention**, which the
  IAU measures opposite to the rotation, so it runs west-positive on a prograde body and
  east-positive on Venus, Uranus and Pluto.

  **Neptune is drawn in a different rotation system from the one its fact sheet quotes,
  and that is not a slip.** The IAU publishes System III for it, the 16.11-hour rotation
  of the magnetic field — the interior. But a surface map of Neptune is a map of *clouds*,
  and for cartography the IAU gives System II, `W = 249.978 + 541.1397757 d`. It is the
  only one of the four giants where the two differ, and taking the obvious set costs
  **4.83° a day**: a full turn every 75 days, which is enough to put the Great Dark Spot
  a quarter of the planet from where it belongs.
- **Saturn's rings** at real radii in its real equatorial plane, reusing the same IAU
  pole the sphere is oriented by — so they open and close over its 29.5-year orbit, as
  they do, with Saturn's own oblate shadow falling across them.
  **Their brightness, however, is not modelled** — see Known approximations.
- **Shadows both ways between Saturn and its rings** — the planet's oblate silhouette
  thrown across the rings, and the rings' own optical depth thrown back across the
  planet. The second follows the Sun's elevation, so the band sweeps across Saturn over
  its 29.5-year year and swaps hemispheres at equinox.
- **Saturn's shadow on the rings**, cast by its real oblate silhouette. Its reach along
  the ring plane is `c / tan(solar elevation)`, so with the Sun near the ring plane it
  crosses the entire system and with the rings wide open it barely touches them.
- **Surface maps registered to that axis**, checked by reading the actual pixels through
  the renderer's own geometry: the Sahara has to come out sand-coloured, the Amazon
  green, the Pacific blue. Which matters, because publishers start their images at
  different longitudes and assuming otherwise turns a planet half way round. Every map
  in the repository goes through that check, shipped or not.
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
pnpm test            # 426 tests across both workspaces
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
| `web/public/textures/` | Surface maps, **committed**. Static third-party assets that never change, so the build does not depend on a third-party host being up. Credited in `CREDITS.md`, which a test enforces. |

The site is fully static — there is no backend. JPL Horizons is queried only at build
time, never from a visitor's browser.

## Generated data

`pnpm fetch:data` writes about 20 MB of JSON: 20 years of the planets and the Moon —
ten back and ten forward from the day it runs — two years of the other twenty moons,
and the sky. Only about 3 MB of it is loaded up front; the moons arrive in pieces as
they are needed.

```
web/public/data/
├─ manifest.json          # generation time, frame, window, and each body's coverage
├─ bodies.json            # the catalog: radii, GM, rotation, color, parent
├─ stars.json             # 46,071 stars: ra, dec, V, B−V, proper motion
├─ vectors/<id>.json      # state vectors, column-wise: t, x, y, z, vx, vy, vz
├─ vectors/<id>/<n>.json  # the same, for a fast moon, split into ~1500-sample chunks
└─ elements/<id>.json     # osculating orbital elements at one epoch
```

The star catalogue comes from a second service — ESA's **Hipparcos** and **Tycho-2**
through VizieR at CDS — and is fetched in the same run. Two catalogues, because neither
is a sky on its own: Tycho-2 goes six times deeper and is *missing the brightest stars
entirely*, since their light saturated its star mapper, while Hipparcos has those and
never completed the faint ones. Hipparcos wins wherever both have a star, because its
photometry is measured in the Johnson system rather than transformed into it.

Unlike the ephemerides the sky does not go stale — both catalogues are finished — but it
is regenerated anyway rather than committed, for the same reason: generated data does
not belong in the repository.

Two things about the reference frames are worth knowing, because getting them wrong
produces numbers that look fine and are not:

- **State vectors are barycentric** (`CENTER='500@0'`). The Solar System barycenter is
  the inertial origin, so it is the right frame for positions. The Sun itself orbits
  it, up to ~1.5 million km out.
- **Orbital elements are heliocentric** (`CENTER='500@10'`). A Keplerian ellipse needs
  the dominating mass at its focus. Requesting barycentric elements puts Mercury's
  semi-major axis 2% off and its period 3% off; against the Sun's center the same
  request lands within 0.01%.
- **A moon's vectors and elements are both taken against its planet's body center**
  (`CENTER='500@599'` for Io). That makes each table exactly the parent-relative state
  the frame tree adds to the planet's, and puts the planet at the focus of the ellipse.
  The orbit is drawn with the planet's *own* mass, not the system value DE440 gives the
  giants: for Io the difference is 2.1 × 10⁻⁴, which would bend the drawn ellipse about
  175 km off Io's path.

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
| Jupiter, Saturn, Uranus, Neptune | 32 days | 0.01 — see below |
| The Moon | 1 day | 0.0024 |
| The other twenty moons | 15 minutes (Phobos) to 1.5 days (Iapetus) | < 0.01 each |

That is why a 20-year window of the planets costs less than the 6-year one that used a
flat one-day step: 16,900 samples against 21,900.

The moons turn that around. About 24 samples an orbit keeps nearly every one of them
inside a hundredth of its radius, and their orbits are short: a year of all twenty is
99,700 samples, six times the whole planetary set, a third of it Phobos. So the fast
moons take a narrower window — a year either side of the build — and ship in chunks,
and a visitor fetches one chunk per moon, only once that moon's system has opened up on
screen. The full measurement, moon by moon, is in `tools/src/catalog.ts`.

One thing the moons exposed about the planets: **Jupiter's own table is 0.013 of its
radius out at worst**, 956 km across 2026 at six-hour spacing, slightly more than the
table above says. The Galileans swing Jupiter's centre about the system's barycentre by
around 200 km every few days, and one sample a month cannot follow that — the same
effect that limits Pluto, smaller. It moves the whole Jovian system together, so Io
against Jupiter is still exact.

### Freshness

Planetary ephemerides do not go stale. DE441 is a deterministic integration covering
year −13200 to 17191, so a build today already carries exact positions for a decade
either side. The weekly CI run re-centres that window on the present; it does not
correct drift.

Outside the downloaded window the app falls back to Keplerian propagation and says
**APPROXIMATE** while it does. For the fast moons that window is two years, so warping
further than a year from the build makes them approximate while the planets are still
exact; the indicator only counts the bodies that are switched on.

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

## Surface maps

What ships is the **Solar System Scope** set (CC BY 4.0) for the Sun and eight planets,
plus NASA's New Horizons mosaic for Pluto. These are composites: NASA imagery with
colour and contrast added by their authors, so they read more vividly than a camera
would.

A **true-colour** alternative also lives in `web/public/textures/`, unused for now.
`ACTIVE_TEXTURE_SET` in `web/src/scene/SolarSystem.tsx` selects between them; there is
no in-app picker.

It covers **three bodies out of ten** — Earth, Mars and Neptune — and that is the state
of what has been published rather than a limit on the search. NASA's Venus map is the
Magellan *radar* mosaic tinted orange (93% mean saturation against Solar System Scope's
44%); its Jupiter and Saturn maps are enhanced-colour products (65% and 68% against 14%
and 21%). In all three the shipped map is already the less-processed option. Mercury,
Uranus and the Sun have no true-colour global map at all — the Sun's photosphere is
white in visible light, so every map of it, ours included, is a false-colour convention.

Earth is the instructive case: Blue Marble measures **more** saturated than the shipped
map (64% against 53%) and is still the truer image, because deep ocean and vegetation
really are that saturated. Saturation is a useful signal for spotting enhancement, not
a definition of truth.

Full per-file sources, licences and longitude conventions in
`web/public/textures/CREDITS.md`.

## Page weight

About **1.72 MB gzipped** on first load: 296 KB of application, 938 KB of
ephemerides and 484 KB of sky. GitHub Pages serves both compressed, so the 2.2 MB of
JSON on disk is not what crosses the wire. The Moon is 244 KB of that, shipped with the
planets because at one sample a day its twenty years are cheap.

The other twenty moons are **not** part of it. Their tables are split into chunks of
about 1500 samples — 51 KB each, compressed — and a chunk is fetched only once its moon's
system has opened up on screen: from the default view of the Sun, not one. Approaching
Jupiter costs its four moons' chunks, about 200 KB; Saturn's seven, about 350 KB.

The surface maps are **not** part of that. Each is fetched only when its body grows past
about six pixels on screen, so looking at the Solar System from outside costs nothing,
and approaching one planet costs one image — between 76 KB (Uranus) and 852 KB
(Mercury). The unused true-colour files are never requested at all. The moons' maps work
the same way: 38 KB (Umbriel) to 731 KB (Dione), each fetched only when that moon is on
screen. They bring the committed texture set to 12.4 MB.

| Connection | First load |
|---|---|
| Fibre / good wifi (50 Mbps) | 0.28 s |
| Typical broadband (20 Mbps) | 0.7 s |
| 4G mobile (10 Mbps) | 1.4 s |
| 3G mobile (1.6 Mbps) | 8.6 s |

Everything is cached after the first visit, so this is a first-load cost only. The
app waits for the planets and the Moon before rendering, since a partially-populated
Solar System would be worse than a moment of "LOADING EPHEMERIDES". The other moons
load progressively: one whose chunk has not arrived is simply absent for a frame or
two, never drawn somewhere approximate and then moved.

## Data sources

| Source | Used for |
|---|---|
| [JPL Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api) | Positions and velocities of planets, moons and spacecraft |
| [ESA Hipparcos, via VizieR](https://vizier.cds.unistra.fr/viz-bin/VizieR-3?-source=I/239/hip_main) | Position, proper motion, magnitude and colour index — the bright sky |
| [Tycho-2, via VizieR](https://vizier.cds.unistra.fr/viz-bin/VizieR-3?-source=I/259/tyc2) | The same, for the faint stars Hipparcos never completed |
| [JPL SBDB Query API](https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html) | Orbital elements of asteroids and comets *(planned)* |
| [CelesTrak GP](https://celestrak.org/NORAD/elements/) | TLE/OMM data for Earth-orbiting satellites *(planned)* |
| [Gaia DR3](https://www.cosmos.esa.int/web/gaia/dr3) | Nearby stars *(planned)* |

## Roadmap

- **Textures and the sky** — done. Surface maps, Saturn's rings, Earth's clouds, night
  lights and atmosphere, and a real star catalogue. A photographic Milky Way panorama
  was tried here and withdrawn: a photograph is the wrong instrument for a sky.
- **Phase A** — moons and spacecraft, using the reference-frame tree already in place.
  The twenty-one major moons are in, with real positions and orbits; their rotation,
  shapes and surface maps are next, then planet-centred views, then spacecraft.
- **Phase B** — asteroids and comets from SBDB, rendered with instancing and Keplerian
  propagation in the vertex shader.
- **Phase C** — Earth-orbiting satellites from CelesTrak, propagated with SGP4 in a
  worker.
- **Phase D** — real distances for the nearest stars, from Gaia parallaxes, out to
  Alpha Centauri. The stars are already real; what phase D adds is depth.

## Known approximations

Stated plainly, since the point of the project is that everything else is not:

- **The moons are mostly greyscale**, because that is what exists: Galileo, Cassini and
  Voyager mapped them through clear filters, and the colour products are enhanced into
  the ultraviolet and infrared. The Moon is natural colour; Titan is 938 nm, its surface
  through the haze; Io and Triton carry uncalibrated mission colour. Maps are USGS,
  NASA SVS and NASA 3D Resources, each placed in longitude from its ISIS label and
  checked against Gazetteer features (`web/public/textures/CREDITS.md`).
- **Half of several moons was never photographed**, and is filled as Pluto's south is —
  Uranus's five and Triton in the north, Charon in the south. Not observation.
- **Deimos has no map.** Its one global map cannot be placed in longitude, so it stays
  flat rather than possibly half a turn out.
- The moons' shapes and rotation *are* measured: the IAU's triaxial radii, and the IAU
  model with every periodic term, read by script out of NAIF's `pck00011.tpc` rather
  than typed. Against JPL, all twenty-one poles land within 0.002° and the face each moon
  turns to its planet within 0.007°.
- **The fast moons are exact for two years, not twenty.** A year either side of the
  build, by budget: see *Sample spacing*.

- **The sky is drawn to magnitude 8, and how bright a star looks is compressed.**
  Which stars are there is a measurement: 46,071 real stars at their own positions,
  moving at their own proper motions, coloured from their own B−V. Where the limit sits
  is not — it is this picture's exposure, and it was set by measuring the reference
  rather than by taste.

  Both frames were read pixel by pixel, and then solved against each other under a
  transform free to scale and rotate. It solves the same way at three sample sizes — 13
  of the brightest 25, 25 of 40, 37 of 60, at a mean error of two to three pixels — which
  gives the missing number: **NASA Eyes was at a 30.6° vertical field where this is at
  27°**. That splits the 1.54× gap in star separation into 1.14× of camera and 1.36× of
  sky. Only the second is the catalogue's business: their sky holds 1.84× the stars
  per square degree, which magnitude 8 delivers to within 3%.

  The camera half is left alone on purpose. 27° is the vertical field of a 50 mm lens on
  35 mm film — the photographic definition of a normal lens — and it was chosen for what
  it does to a planet filling the frame: at 27° you are standing 4.3 radii out and seeing
  38% of the surface, where a wide field crushes everything past 65° of latitude into the
  rim. Widening it to 30.6° would undo that to make the sky read 14% tighter.

  **About 41,000 of those keep measured Johnson magnitudes, from Hipparcos. The other
  5,000 are transformed** from Tycho's own BT and VT by the relation published with that
  catalogue (`V = VT − 0.090(BT−VT)`, `B−V = 0.850(BT−VT)`), which is a first-order fit
  valid over 97% of the stars here. It is the one place this project's photometry is
  converted rather than observed.

  How bright they look is not a measurement either. The sky spans about thirteen orders
  of magnitude and a screen has three, so every picture of space chooses which three to
  show. Here the brightest star is white, the faintest is at 2% of that — five code
  values out of 255, which is what "limiting magnitude" already means — and the response
  between them is linear in magnitude, the eye's own scale, since that is what the
  magnitude system was built from. So Sirius outshines a magnitude 8 star by nearly six
  thousand to one in the sky and by fifty to one on screen.

  A star's size is not a separate setting: it is where its point spread falls below the
  darkest step the display can show. That spread is a **Gaussian core 0.54 pixels wide
  plus a power-law tail**, `1/(1 + (r/σ)²)`, carrying a tenth of the star's light — the
  same shape as the Sun's glare, and for the same reason: every real optical system
  scatters a few percent of a source into a halo, and a Gaussian alone cannot.

  Both numbers are measured off the reference. The core reproduces its median equivalent
  diameter of 2.26 px and its 90th percentile of 2.99; the tail's share was solved from
  its brightest blob, 13.5 px across, which a Gaussian at this σ could not exceed 4.2 for
  however bright the star. Here the same star draws 13.2. The cost is a slightly less
  black sky — 0.57% of pixels above the floor against 0.45% without the tail, and the
  reference's own 0.41%.

  Stars sit on a sphere rather than at their real distances, so there is no parallax.
  The nearest star here would move 0.742 arcseconds across Earth's orbit, which is under
  a hundredth of a pixel. Real distances are phase D.
- **The Sun's glare is real in shape and calibrated in brightness.** Most of what you
  see around the Sun is its light scattered sideways inside whatever is looking at it,
  and that scatter is measured: the CIE disability-glare equation (CIE 135/1-1999, from
  Vos and van den Berg) gives the veil as `10/θ³ + 5/θ²` with θ in degrees. That is the
  profile used here, and it follows the inverse square law on its own — the halo is 3.9°
  wide from Mercury's orbit, 1.8° from Earth's, 0.34° from Saturn's, with nothing
  animating it. Its colour is the Sun's own, from the same Planck-and-CIE path the stars
  use.

  **There is no free constant in it.** The veil's brightness is the illuminance the disc
  delivers — `E = L·π·sin²θ_R`, the inverse square law written without assuming the source
  is a point — so it is tied to whatever exposure the disc is drawn at and cannot drift
  away from it. An earlier version anchored the veil independently and then the disc was
  overexposed by 45; the glare did not follow, and the halo went from plausible to
  invisible beside its own source.

  What does not match the reference is the far profile — theirs falls as θ^-3.5 where the
  eye's equation is between θ^-3 and θ^-2, so at Earth's distance their glow ends at 1.72°
  and this one reaches 3.6°. Theirs is tighter because an optical instrument is tighter
  than an eye: most of the eye's veil is scattered inside the eye itself, and a lens has no
  retina. Matching it would mean replacing a published measurement with a fitted exponent.

  The veil is drawn outside the photosphere only, because the disc is already clipped.

- **The Sun's disc is overexposed, and that is the physical answer rather than a stylistic
  one.** Its photosphere radiates `σT⁴/π`, which at 5,772 K is 2.0×10⁷ W/m²/sr against the
  130 that sunlit Earth returns — so the Sun is **154,000× brighter than the brightest
  thing this exposure can hold**, and a correct render of it is a flat white circle with
  nothing in it at all.

  It is drawn at **45× full scale**, which is still three and a half thousand times *under*
  the true value. The factor was chosen so red clips across the whole map, leaving what
  survives of the granulation in the blue channel — the only one with headroom left. The
  disc then averages **255, 249, 60** on screen. Reading NASA's own render of the Sun pixel
  by pixel gives **255, 249, 59**: one code value per channel, from a number that was not
  fitted to it.

  The overexposure is also what flattens the map. Across NASA's disc the green channel runs
  244 to 253 — a spread of 9 out of 255. Drawn at unity ours ran 52 to 205, a spread of
  153; at 45 it is about 21. That flatness is not a filter applied to the texture, it is
  what happens to any texture pushed against the ceiling.

- **Flood** and **Shadow** lighting are legibility aids; only **Natural** is physical.
- **Saturn's ring radii are fitted, not quoted.** The ring map is a radial strip and its
  publisher does not say which radii its edges are, so they were measured from the
  image's alpha profile against surveyed ring boundaries: `r(u) = 69942 + 71938·u`, RMS
  residual 1365 km. That is wider than the Encke Gap the map draws (325 km), so every
  division is present and roughly placed and none is at a surveyed radius.
- **The depth of the ring shadow on Saturn is calibrated, not derived.** Where the band
  falls is exact geometry — which latitudes, which hemisphere, how it sweeps with the
  seasons. How dark it gets is not, for two reasons. The light reaching a shadowed point
  indirectly is one constant standing in for diffuse transmission through the rings and
  ringshine from the lit ones, plus a gain setting how dark the darkest part gets. Tuned
  by eye, it converged at 10.5% of full sunlight — inside the 8–12% measured off the
  reference, which is a reassuring place for eye-tuning to land. And the map's opacity is an artist's, not an optical
  depth: it over-states the C ring and the Cassini Division by three to four times, so
  for shadowing it is corrected by an exponent that recovers the published optical depths
  of the C, B and A rings from the same image.
- **Ring brightness is a constant, and this is the one place the renderer knowingly
  stops being measured.** The rings are drawn at a fixed radiance factor regardless of
  where the camera and the Sun are. Their geometry is real — radii, plane, shadow — and
  their band structure comes from the map's optical depth; only the light model is
  faked.

  The rings are grey, deliberately. Real ring particles are ice stained by tholins, so a
  slight red bias is physically right and the shipped map carries one — but at the
  brightness the rings are drawn at, that small bias reads as brown rather than as
  off-white, and the reference renders them neutral. The band structure comes from the
  map's own opacity, which spans 7.4× from the faintest bands to the brightest.

  It was not for lack of trying. A physically-derived model went in and was corrected
  four times, each round finding a real error: alpha applied twice from the wrong
  channel, a Lambert term that is wrong for a slab of particles, a radiometric scale
  that was guessed rather than derived, no multiple scattering (so the shadowed face
  went black and the lit face ran away), and a phase function pinned at its opposition
  value when a polar view of the rings is actually 83° of phase.

  What settled it was measuring against NASA Eyes at matched viewpoints. Ring brightness
  as a fraction of Saturn's:

  | view | NASA Eyes | the model |
  |---|---|---|
  | from above the pole | 0.106 | 0.078 |
  | from near the ring plane | 0.060 | **0.214** |

  NASA's rings do not brighten edge-on. Ours brightened 3.6×, because a slab of
  particles seen edge-on genuinely does return more light per unit projected area. The
  prediction is right and the appearance is wrong, which means the gap is no longer a
  bug to find: closing it needs a measured particle phase curve, a finite-slab multiple
  scattering solution and the ring's vertical thickness. That is a research problem, and
  the rings were holding up everything else.

  The model is kept, tested, one constant away — `RING_SHADING` in
  `web/src/scene/ringMaterial.ts`. It is where a future attempt should start, not
  something to rebuild. The full reasoning is at the top of that file.
- **Pluto's southern hemisphere is invented.** New Horizons could not photograph it —
  it was in polar winter during the 2015 flyby — so the original mosaic is black from
  about 36°S down. It is filled with the average colour of the mapped part so it does
  not render as a black cap. Nothing south of about 40°S on Pluto is an observation.
- **Surface maps are composites**, not cartographic products.
  The Solar System Scope set is built on NASA imagery with colour and detail added by
  its authors; only Pluto's is a mission product. Venus shows its atmosphere, which is
  what is visible, rather than the radar map of the ground beneath.
- **Latitude on the flattened bodies is approximate.** A map is wrapped by the sphere's
  own parametrisation and the sphere is then scaled to the real polar flattening, which
  lands a feature between where planetocentric and planetographic latitude would each
  put it. Saturn is the worst at about 1.5° at mid-latitudes; Earth and Mars are under
  0.1°. Committing to either convention would be false precision on an artist's map.
- **The IAU periodic terms are dropped**, except Neptune's. Every other one is under
  0.01°; Neptune's reaches 0.7° and is carried. The linear pole rates — precession — are
  carried for every body, because Earth's alone reaches 0.145° by 2026.
- **Pluto's axial tilt is listed as 119.591°, not the 122.53° NASA publishes.** That
  figure comes from the pole the IAU retired in 2009, which sits 2.9° from the current
  one — exactly the gap between the two numbers. The value here matches the axis that
  is actually drawn.
- The **surface** distance mode subtracts equatorial radii, not the radius along the
  line of sight. NASA Eyes does the same.

## Credits

- Ephemerides: **NASA/JPL-Caltech**, Solar System Dynamics Group, JPL Horizons System.
- Star positions, proper motions, magnitudes and colours: the **ESA Hipparcos
  catalogue** (ESA 1997, ESA SP-1200) and **Tycho-2** (Høg et al. 2000, A&A 355, L27),
  accessed through the **VizieR** service at CDS, Strasbourg (Ochsenbein, Bauer &
  Marcout 2000, A&AS 143, 23).
- Satellite orbital data: **CelesTrak**.
- Planetary surface maps: **Solar System Scope** (CC BY 4.0); **NASA/JHUAPL/SwRI** New
  Horizons mosaic for Pluto; **NASA Earth Observatory** Blue Marble and **NASA 3D
  Resources** for the unused true-colour files. Full details in
  `web/public/textures/CREDITS.md`.
- Rotational elements: **IAU Working Group on Cartographic Coordinates and Rotational
  Elements**, 2015 report (Archinal et al. 2018).
- Interface icons are hand-written inline SVG — no icon set, nothing to attribute.

This project is not affiliated with or endorsed by NASA or JPL.
