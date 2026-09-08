# Texture credits

Planetary surface maps live in this directory and are loaded lazily, only once a body
is close enough to the camera to be drawn as a mesh. Nothing here is downloaded until
you approach something.

Every file added here must be recorded below with its source and license.
`web/src/scene/textures.test.ts` enforces that: an uncredited image fails the build.

Every map is equirectangular with north at the top and longitude increasing east.
Resolution varies by source, and is left at whatever the source published: upscaling
would invent detail the data does not have.

## Two sets, one of them unused

There is no single source that is both complete and photometric, so both live here and
`ACTIVE_TEXTURE_SET` in `web/src/scene/SolarSystem.tsx` chooses. There is no in-app
picker: one existed briefly and was removed, since the true-colour set changes only
three bodies and the comparison did not earn a permanent control.

- **Illustrative** — Solar System Scope throughout. NASA imagery with colour and
  contrast added by its authors. Complete, vivid, and not a measurement. **This is what
  currently ships.**
- **True colour** — a calibrated or mission product wherever one has been published.
  That is **three bodies**: Earth, Mars and Neptune. The other seven fall back to their
  illustrative map, and the reason is recorded per body in `tools/src/catalog.ts`.
  Present in the repository, not currently drawn.

Why only three, when NASA publishes maps of more than that: for **Venus** NASA's map is
the Magellan *radar* mosaic tinted orange, at 93% mean saturation against the
illustrative map's 44% — radar is real data and is not what Venus looks like. For
**Jupiter** and **Saturn** the NASA maps are enhanced-colour products, at 65% and 68%
saturation against 14% and 21%. In all three cases the illustrative map is already the
less-processed option. **Mercury**, **Uranus** and the **Sun** have no true-colour
global map at all; the Sun's photosphere is white in visible light, and every published
map of it, including ours, is a false-colour convention.

## Where each file starts in longitude

Recorded per map in the catalog as `longitudeOriginDeg`, because it differs by
publisher and getting it wrong turns a body exactly half way round:

- Solar System Scope, NASA Blue Marble and the NASA 3D Resources maps all centre on the
  prime meridian, so their left edge is **longitude 180 W**.
- NASA's Pluto mosaic starts at **longitude 0**, with Sputnik Planitia in the middle.

`web/src/scene/textureAlignment.test.ts` measures every one of these from the pixels,
across both sets, and includes a test that deliberately reproduces a 180-degree error
to prove the check still has teeth.

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
| `earth-photometric.jpg` | Earth | [NASA Blue Marble Next Generation](https://visibleearth.nasa.gov/images/73909/december-blue-marble-next-generation-w-topography-and-bathymetry) | Public domain |
| `mars-photometric.jpg` | Mars | [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) | Public domain |
| `neptune-photometric.jpg` | Neptune | [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) | Public domain |
| `saturn-rings.png` | Saturn's rings | [Solar System Scope](https://www.solarsystemscope.com/textures/) | CC BY 4.0 |

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

**Part of Pluto is invented, and it has to be said plainly.** New Horizons flew past in
July 2015, when Pluto's southern hemisphere was in polar winter — unlit, and therefore
unphotographable. The original mosaic is black from about 36 S to the pole, 30% of the
image. Rendering that as a black cap reads as a bug rather than as missing data, so it
is filled with **rgb(135, 112, 104)**, the average colour of the mapped part, with the
boundary relaxed over a few dozen pixels so there is no seam. Reproduce it by masking
every pixel below luminance 12, setting it to the mean of the rest, and running 40
iterations of a 3x3 average over the masked pixels only, wrapping in longitude and
clamping at the poles. Nothing south of about 40 S on Pluto is observation.

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

## The true-colour files

- **`earth-photometric.jpg`** — Blue Marble Next Generation, December 2004, with
  topography and bathymetry. MODIS radiance, calibrated and mapped to sRGB, so it is
  true colour by construction rather than by adjustment. Courtesy NASA Earth
  Observatory (Reto Stöckli). Downscaled from 5400 x 2700 to 2048 x 1024. It measures
  *more* saturated than the illustrative Earth (64% against 53%) and is still the
  truer image: deep ocean and vegetation really are that saturated. Saturation was a
  useful signal for spotting enhancement, never a definition of truth.
- **`mars-photometric.jpg`** — NASA 3D Resources, Viking-derived, 1440 x 720.
  Butterscotch rather than orange-red, which is the colour Mars actually is.
- **`neptune-photometric.jpg`** — NASA 3D Resources, 720 x 360. Pale blue-green. The
  familiar deep blue is an artifact of contrast-stretched Voyager 2 imagery; the 2024
  Oxford reprocessing (Irwin et al.) showed the real Neptune is much closer to Uranus.
  This map is in that direction, at 48% saturation against the illustrative 68%.
  Neptune is featureless enough that its longitude origin cannot be verified from the
  pixels, so it inherits its source family's convention — noted here because it is the
  one map whose alignment rests on inference rather than measurement.

## The ring map

`saturn-rings.png` is not a surface map and is not used like one. It is a **radial
strip**: 2048 px wide by 125 tall, where the horizontal axis runs from the inner ring
radius to the outer and the image is constant vertically. Its meaning is in the alpha
channel, which is what cuts the Cassini Division and the Encke Gap out of the disc, and
about 14% of it is fully transparent — the empty space inside the C ring and outside
the A ring. So `u` is radius, not longitude, and it must **clamp** rather than repeat:
wrapping it would fold the outer edge of the rings onto the inner one.

**The radii it is drawn against had to be measured.** Solar System Scope does not
publish them, so the alpha profile was read off the file and its structural boundaries —
the C ring's inner edge, the C-to-B step, the Cassini Division either side, and the A
ring's outer edge — were fitted by least squares against their surveyed radii:

```
r(u) = 69942 + 71938 * u        RMS residual 1365 km
```

corroborated independently by the Encke Gap landing 747 km from its true 133,589 km.
Those are the numbers in `tools/src/catalog.ts`, and the honest reading of them is that
**1365 km is wider than the Encke Gap itself** (325 km). Every division is present and
roughly placed; none is at a surveyed radius. The image cannot support better, and
quoting the textbook 74,658 and 136,780 would look more precise while placing every
feature further from where it belongs.

## Other sources, for later phases

- **[NASA Scientific Visualization Studio](https://svs.gsfc.nasa.gov/)** and
  **[NASA Image and Video Library](https://images.nasa.gov/)** — generally public
  domain, but verify case by case.
- **[USGS Astrogeology](https://astrogeology.usgs.gov/search)** — high-resolution
  cartographic mosaics, public domain, planetographically registered. The right
  products for Mars and Mercury, and impractical at present: the Viking colour mosaic
  is 12 GB and the MESSENGER basemap 759 MB, with no smaller published variant found.
- **[NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources)** — NASA's own
  texture library, free of copyright. Beyond the planets it carries the Moon, every
  major moon of Jupiter, Saturn, Uranus and Neptune, and **Hipparcos, Tycho and Yale
  star maps** — which are what Phase D needs to replace the procedural starfield.
