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
| `earth-night.jpg` | Earth, city lights | [NASA Earth Observatory, Earth at Night 2012 (VIIRS DNB)](https://visibleearth.nasa.gov/images/79765/night-lights-2012-flat-map) | Public domain |
| `earth-clouds.jpg` | Earth, cloud deck | [NASA Visible Earth, Blue Marble clouds (MODIS)](https://visibleearth.nasa.gov/images/57747/blue-marble-clouds) | Public domain |
| `earth-water.png` | Earth, land/water mask | [NASA Visible Earth, Blue Marble land surface, shallow water and shaded topography](https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography) | Public domain |
| `moon.jpg` | Moon | [NASA SVS CGI Moon Kit (LRO LROC WAC), 4720](https://svs.gsfc.nasa.gov/4720) | Public domain |
| `phobos.jpg` | Phobos | [USGS Astrogeology, Mars Express SRC + Viking global mosaic](https://planetarymaps.usgs.gov/mosaic/Phobos_ME_SRC_Mosaic_Global_16ppd.tif) | Public domain |
| `io.jpg` | Io | [USGS Astrogeology, Galileo SSI colour merged onto the Voyager–Galileo global mosaic, 1 km](https://planetarymaps.usgs.gov/mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif) | Public domain |
| `europa.jpg` | Europa | [USGS Astrogeology, Voyager–Galileo SSI global mosaic 500 m](https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif) | Public domain |
| `ganymede.jpg` | Ganymede | [USGS Astrogeology, Voyager–Galileo SSI global mosaic 1 km](https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif) | Public domain |
| `callisto.jpg` | Callisto | [USGS Astrogeology, Voyager–Galileo SSI global mosaic 1 km](https://planetarymaps.usgs.gov/mosaic/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif) | Public domain |
| `mimas.jpg` | Mimas | [NASA/JPL-Caltech/Space Science Institute, Cassini ISS, PIA17214](https://photojournal.jpl.nasa.gov/catalog/PIA17214) | Public domain |
| `enceladus.jpg` | Enceladus | [USGS Astrogeology, Cassini ISS global mosaic 100 m, high-pass filtered](https://planetarymaps.usgs.gov/mosaic/Enceladus_Cassini_ISS_Global_Mosaic_100m_HPF.tif) | Public domain |
| `tethys.jpg` | Tethys | [USGS Astrogeology, Cassini ISS global mosaic 293 m](https://planetarymaps.usgs.gov/mosaic/Tethys_Cassini_mosaic_global_293m.tif) | Public domain |
| `dione.jpg` | Dione | [USGS Astrogeology, Cassini–Voyager global mosaic 154 m](https://planetarymaps.usgs.gov/mosaic/Dione_Cassini_Voyager_mosaic_global_154m.tif) | Public domain |
| `rhea.jpg` | Rhea | [USGS Astrogeology, Cassini–Voyager global mosaic 417 m](https://planetarymaps.usgs.gov/mosaic/Rhea_Cassini_Voyager_mosaic_global_417m.tif) | Public domain |
| `titan.jpg` | Titan | [USGS Astrogeology, Cassini ISS 938 nm global mosaic (PIA19658)](https://planetarymaps.usgs.gov/mosaic/Titan_ISS_P19658_Mosaic_Global_4km.tif) | Public domain |
| `iapetus.jpg` | Iapetus | [USGS Astrogeology, Cassini–Voyager global mosaic 783 m](https://planetarymaps.usgs.gov/mosaic/Iapetus_Cassini_Voyager_mosaic_global_783m.tif) | Public domain |
| `miranda.jpg` | Miranda | [NASA 3D Resources (USGS/Tammy Becker, Voyager 2)](https://github.com/nasa/NASA-3D-Resources) | Public domain |
| `ariel.jpg` | Ariel | [NASA 3D Resources (USGS/Tammy Becker, Voyager 2)](https://github.com/nasa/NASA-3D-Resources) | Public domain |
| `umbriel.jpg` | Umbriel | [NASA 3D Resources (USGS/Tammy Becker, Voyager 2)](https://github.com/nasa/NASA-3D-Resources) | Public domain |
| `titania.jpg` | Titania | [NASA 3D Resources (USGS/Tammy Becker, Voyager 2)](https://github.com/nasa/NASA-3D-Resources) | Public domain |
| `oberon.jpg` | Oberon | [NASA 3D Resources (USGS/Tammy Becker, Voyager 2)](https://github.com/nasa/NASA-3D-Resources) | Public domain |
| `triton.jpg` | Triton | [USGS Astrogeology, Voyager 2 colour global mosaic with fill, 600 m](https://planetarymaps.usgs.gov/mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif) | Public domain |
| `charon.jpg` | Charon | [USGS Astrogeology, New Horizons LORRI/MVIC global mosaic 300 m](https://planetarymaps.usgs.gov/mosaic/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif) | Public domain |

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

## The moons

Mission mosaics, nearly all of them from **USGS Astrogeology**, whose products are in
the U.S. public domain; they ask that the authors be cited, and several were assembled by
DLR (Roatsch et al.) and by the LPI (Schenk). NASA imagery -- the Moon, Mimas, the
Uranian set -- is not subject to copyright; credit NASA, and for the Moon NASA's
Scientific Visualization Studio.

**Most are greyscale, and that is the measurement, not a shortcut.** Galileo, Cassini
and Voyager mapped these bodies through a clear or green filter; there is no global
true-colour map of any of them. The colour products that exist -- the Cassini sets
PIA18434-18439, USGS's Ganymede -- are enhanced into the ultraviolet and infrared, and
are what a camera would not see. The Moon is the one natural-colour map here, from LRO's
wide-angle camera. Titan's is at 938 nm, the near-infrared window through its haze: the
only way anyone has seen its surface. Two more carry colour, and neither is calibrated:
Io's is Galileo colour laid over a monochrome base, and Triton's is Voyager's orange,
violet and ultraviolet filters combined -- in NASA's words, a close approximation to
what an eye would see.

**How each was made.** Downloaded once from the link in the table, downscaled to 2048 x
1024 with Lanczos resampling and saved as JPEG at quality 85, single-channel where the
source is. Sources smaller than that -- the five Uranian moons, 1440 x 720 -- keep their
own size, because upscaling would invent detail. Nothing else is altered, except below.

**Where each file starts in longitude was measured, twice.** Once from the product's own
ISIS label -- `UpperLeftCornerX` of minus pi R puts the left edge 180 degrees from
`CenterLongitude` -- and once by eye against named features from the USGS Gazetteer of
Planetary Nomenclature: Mare Crisium and Tycho on the Moon, Stickney on Phobos, Pele and
Loki Patera on Io, Tuonela Planitia on Triton, Pwyll on
Europa, Galileo Regio and Tros on Ganymede, Valhalla on Callisto, Herschel on Mimas,
Odysseus on Tethys, Inktomi on Rhea, Xanadu and Belet on Titan, Cassini Regio on
Iapetus, Arden and Inverness Coronae on Miranda, Laica on Ariel, Wunda on Umbriel,
Gertrude on Titania, Hamlet on Oberon and Argo Chasma on Charon. The two agreed for every
map. `textureAlignment.test.ts` holds the ones with enough contrast to read from the
pixels.

**Half of several moons was never photographed, and is filled -- the Pluto recipe.**
Voyager 2 passed Uranus in 1986 near southern solstice, so its moons' northern
hemispheres were in the dark: 57 to 62% of each Uranian map. New Horizons saw Charon's
south in polar night (35%), and Galileo left gaps near Callisto's, Ganymede's and
Europa's poles (4 to 5%); Voyager 2 saw Triton's northern 39% in the same darkness it
saw Uranus's moons. Each is filled as Pluto is -- every pixel below luminance 12 set to
the mean of the rest, then 40 relaxation passes of a 3 x 3 average over the filled
pixels only -- with one addition: the mask is grown by three pixels first, because the
edge of an imaged region is anti-aliased into the black and otherwise survives as a dark
outline. It reads as missing data rather than as a black cap. Nothing in those regions is
an observation.

**Deimos has no map**, by decision. The one global map, Stooke's from Viking, cannot be
placed: its USGS world file and its author's guide disagree about where longitude 0 is,
and Deimos's two named craters are too small to settle it from the pixels. It stays in
flat colour until a map can be registered.

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

## Earth's three extras

None of these is a surface map, and none is used like one. They are the only files here
that belong to a single body, and the reason is simply that Earth is the only body
anyone has flown a night-light survey over.

- **`earth-night.jpg`** — the 2012 *Earth at Night* composite, from the VIIRS
  Day/Night Band on Suomi NPP: cloud-free radiance assembled from 312 orbits in April
  and October 2012. Courtesy **NASA Earth Observatory / NOAA NGDC** (Miguel Román,
  Chris Elvidge, Robert Simmon). Downscaled from 3600 x 1800 to 2048 x 1024.

  **It was processed, and here is exactly how.** The published image draws a dark blue
  land-and-sea base layer *under* the lights, which is fine for a wall map and wrong for
  this: used as emission it would make the whole night side glow. The base is deep blue
  and the lights are near-white, so the **red channel alone is the lights** — the ocean
  sits at red 0 and the land base at exactly red 15. Reproduce it by taking the red
  channel, subtracting 15, clamping at zero, rescaling to full range, and then
  downscaling by area average. 96% of the result is black, which is what a night side
  should be.

  **The colour on screen is not in this file.** The DNB is a single broad panchromatic
  channel, so the composite carries radiance and no colour whatever. The amber the
  renderer tints it with starts from the chromaticity of a 2000 K blackbody —
  high-pressure sodium — taken half way to neutral white, because sodium was never the
  whole story: mercury vapour, fluorescent and metal halide lit a large share of the
  world in 2012 and are all far whiter. Pure sodium was tried first and rendered every
  city red. It is a convention with a shelf life either way, since cities are converting
  to 3000-4000 K LEDs. See `earthExtras.ts`.

- **`earth-clouds.jpg`** — the Blue Marble cloud composite, MODIS, already 2048 x 1024
  at the source. Converted to grey and re-encoded; nothing else was done to it. Used as
  an **opacity map** on its own sphere 5 km up, so what the image says is how much cloud
  is there, not what colour it is.

  It is read as an **optical depth**, not as an alpha: the opacity drawn is
  `1 − exp(−3.2 · v)`. The map measures how much cloud is in the column, and taking that
  for how much light gets through it left the deck gauzy where the reference shows solid
  weather systems. Same conversion the ring strip gets, for the same reason. The gain is
  calibrated against a number read off NASA Eyes rather than by eye: 17.3% of their
  Earth's disc is bright cloud, against 6.6% of ours before, and 3.2 is the gain that
  puts the same 17.3% of this map past opacity 0.8.

  Two things about it are worth knowing. It is a **fixed composite** assembled from
  passes over weeks in 2001, so it is never the weather on the simulated date and the
  slow westward drift the renderer gives it does not change that. And MODIS cloud
  detection over snow and ice is famously ambiguous, so the bright polar caps in this
  image are partly cloud and partly ground.

- **`earth-water.png`** — **derived, not published**, and the derivation is the whole of
  it. NASA's *land surface, shallow water and shaded topography* map fills deep water
  with a single flat colour, **rgb(10, 10, 50)**, and paints everything else from
  imagery. So the mask is the distance from that fill.

  **It is a coverage fraction, not a yes/no, and that is the second version.** The first
  was binary — inside a tolerance or outside it — and it showed: a texel here is 20 km,
  nothing about a coastline is 20 km wide, and a hard edge drew the coast as the
  staircase the *grid* makes. Since roughness jumps across that edge, every shore came
  out visibly blocky wherever the Sun caught the water.

  The fix was to stop throwing information away. The source is a JPEG, so its own
  antialiasing has already blended the flat ocean colour with the land beside it — which
  means **how far a coastal texel sits from the fill colour is how much of that texel is
  sea**. Reproduce it from `land_shallow_topo_2048.jpg`: take the Euclidean RGB distance
  from rgb(10, 10, 50), map distance 10 to fully water and 45 to fully land with a linear
  ramp between, then one 1‑2‑1 binomial pass wrapping in longitude and clamping at the
  poles. 160 KB, about 5% of it partial values.

  **It comes out at 69.7% water against the published 70.8%, and the point of difference
  is explained rather than mysterious**: the source *draws* the shallow continental
  shelves instead of filling them, so a rim of every coast reads as land. The binary
  version managed 68.6%, so reading the blend bought a point of accuracy as well as a
  shoreline that is not made of squares. Inland water is included — the Caspian, the
  Great Lakes and the Black Sea all classify correctly. The thresholds come from the
  encoder's noise and the gap in the distance histogram, not from raising them until the
  total matched 70.8%, which is why the test asserts where it actually lands.

  It drives one thing: roughness. Water gets 0.444, from Cox and Munk's sun-glitter
  measurement of sea-surface slope at 7 m/s of wind; land keeps 1.

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
