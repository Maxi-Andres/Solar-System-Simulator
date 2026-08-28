# Texture credits

Planetary surface maps live in this directory and are loaded lazily, only once a body
is close enough to the camera to be drawn as a mesh. Nothing here is downloaded until
you approach something.

Every file added here must be recorded below with its source and license.
`web/src/scene/textures.test.ts` enforces that: an uncredited image fails the build.

All maps are 2048 x 1024 equirectangular, north at the top, longitude increasing east.

**Where each file starts is not the same for both sources**, and it is recorded per body
in the catalog as `textureLongitudeOriginDeg`:

- Solar System Scope centres its maps on the prime meridian, so their left edge is
  **longitude 180 W**. Greenwich is in the middle of the image.
- NASA's Pluto mosaic starts at **longitude 0**, with Sputnik Planitia in the middle.

Assuming the first for both, or the second for both, turns a body exactly half way
round. `web/src/scene/textureAlignment.test.ts` measures it from the pixels.

| File | Body | Source | License |
|---|---|---|---|
| `sun.jpg` | Sun | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `mercury.jpg` | Mercury | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `venus.jpg` | Venus | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `earth.jpg` | Earth | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `mars.jpg` | Mars | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `jupiter.jpg` | Jupiter | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `saturn.jpg` | Saturn | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `uranus.jpg` | Uranus | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `neptune.jpg` | Neptune | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |
| `pluto.jpg` | Pluto | [NASA/JHUAPL/SwRI, PIA11707](https://images.nasa.gov/details/PIA11707) | Public domain |

## Attribution

**Solar System Scope** textures are published under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), which requires credit.
Credit: **Solar System Scope** — <https://www.solarsystemscope.com/textures/>. They are
based on NASA elevation and imagery data, with colour and detail added by the authors,
so they are illustrative composites rather than cartographic products.

**Pluto** is the New Horizons global colour mosaic (PIA11707), assembled from
Ralph/MVIC imagery taken during the July 2015 flyby and draped on a LORRI base map.
NASA material is public domain; the courtesy line is
**NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research
Institute**. Solar System Scope has no Pluto map, and this is better data anyway. It
was downscaled from 5926 x 2963 to 2048 x 1024 to match the rest of the set.

## Two things worth knowing about how these are drawn

- **Venus is its atmosphere, not its surface.** Solar System Scope also publishes the
  radar map of the ground beneath the clouds. The ground is real, and it is not what is
  there to see.
- **Latitude on the flattened bodies is approximate.** The maps are wrapped by the
  sphere's own parametrisation and the sphere is then scaled to the real polar
  flattening, which places a feature between where planetocentric and planetographic
  latitude would each put it. On Saturn, the most oblate body here, that is about 1.5
  degrees at mid-latitudes; on Earth and Mars it is under 0.1. Since these are artist's
  composites rather than registered cartographic products, committing to either
  convention would be a false precision.

## Other sources, for later phases

- **[NASA Scientific Visualization Studio](https://svs.gsfc.nasa.gov/)** and
  **[NASA Image and Video Library](https://images.nasa.gov/)** — generally public
  domain, but verify case by case.
- **[USGS Astrogeology](https://astrogeology.usgs.gov/search)** — high-resolution
  cartographic mosaics, public domain, planetographically registered.
