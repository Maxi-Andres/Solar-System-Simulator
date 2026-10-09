# Spacecraft model credits

3D models of the spacecraft, loaded lazily: a file is fetched only once its craft is a
few pixels across on screen. Nothing here is downloaded until you approach a craft.

Every file added here must be recorded below with its source and licence.
`web/src/scene/craftModels.test.ts` enforces that: an uncredited model fails the build.

## Licence

All six are NASA's, from NASA 3D Resources. NASA's media guidelines
(https://www.nasa.gov/nasa-brand-center/images-and-media/) say its 3D content — "texture
maps and polygon data in any format" — is "generally not subject to copyright in the
United States", and may be used for "computer graphical simulations and Internet Web
pages". **NASA should be acknowledged as the source**, which is what this file and the
About panel do. No NASA endorsement is implied, and no NASA insignia is used.

## Files

| File | Craft drawn with it | Source |
|---|---|---|
| `voyager.glb` | Voyager 1, Voyager 2 | https://science.nasa.gov/resource/voyager-3d-model/ — `Voyager.glb`, credit NASA Visualization Technology Applications and Development (VTAD) |
| `pioneer.glb` | Pioneer 10, Pioneer 11 | NASA 3D Resources, `Pioneer 10.glb` — https://github.com/nasa/NASA-3D-Resources and https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/pioneer-10/Pioneer%2010.glb |
| `new-horizons.glb` | New Horizons | https://science.nasa.gov/resource/new-horizons-3d-model/ — `New_Horizons.glb`, credit NASA VTAD |
| `parker-solar-probe.glb` | Parker Solar Probe | https://science.nasa.gov/resource/parker-solar-probe-3d-model/ — `PSP.glb`, credit NASA VTAD |
| `jwst.glb` | James Webb Space Telescope | https://science.nasa.gov/3d-resources/james-webb-space-telescope-b/ — `James Webb Space Telescope (B).glb` |
| `europa-clipper.glb` | Europa Clipper | https://science.nasa.gov/resource/europa-clipper-3d-model/ — `clipper_spacecraft.glb`, credit NASA VTAD |
| `ace.glb` | ACE | https://science.nasa.gov/3d-resources/advanced-composition-explorer/ — `Advanced Composition Explorer.glb` |
| `dscovr.glb` | DSCOVR | https://science.nasa.gov/3d-resources/deep-space-climate-observatory-dscovr-triana/ — `Deep Space Climate Observatory (DSCOVR) (Triana).glb` |
| `soho.glb` | SOHO | NASA 3D Resources mirror, `3D Models/Solar and Heliospheric Observatory/Solar and Heliospheric Observatory.glb` (https://github.com/nasa/NASA-3D-Resources); its science.nasa.gov page carries printable files only |
| `roman.glb` | Roman Space Telescope | https://science.nasa.gov/3d-resources/nancy-grace-roman-space-telescope-b/ — `Nancy Grace Roman Space Telescope (B).glb` |
| `tess.glb` | TESS | https://science.nasa.gov/3d-resources/transiting-exoplanet-survey-satellite-tess-a/ — `Transiting Exoplanet Survey Satellite (TESS) (A).glb` |
| `stereo.glb` | STEREO-A | NASA 3D Resources mirror, `3D Models/Solar TErrestrial RElations Observatory (STEREO)/…(STEREO).glb` |
| `osiris-rex.glb` | OSIRIS-APEX | https://science.nasa.gov/3d-resources/origins-spectral-interpretation-resource-identification-and-security-regolith-explorer-osiris-rex/ — `OSIRIS-REx.glb` |
| `cassini.glb` | Cassini | https://science.nasa.gov/3d-resources/cassini-huygens-a/ — `Cassini-Huygens (A) (without Hyugens).glb` (NASA's spelling): the orbiter alone, as it flew after Huygens left in 2004 |
| `dawn.glb` | Dawn | https://science.nasa.gov/3d-resources/dawn/ — `Dawn.glb` |
| `kepler.glb` | Kepler | https://science.nasa.gov/3d-resources/kepler-a/ — `Kepler (A).glb` |
| `spitzer.glb` | Spitzer | https://science.nasa.gov/3d-resources/spitzer-space-telescope/ — `Spitzer Space Telescope.glb` |
| `wind.glb` | Wind | https://science.nasa.gov/3d-resources/wind/ — `Wind.glb` |
| `mro.glb` | Mars Reconnaissance Orbiter | https://science.nasa.gov/3d-resources/mars-reconnaissance-orbiter-mro-c/ — `Mars Reconnaissance Orbiter (MRO) (C).glb` |
| `maven.glb` | MAVEN | https://science.nasa.gov/3d-resources/mars-atmosphere-and-volatile-evolution-maven-b/ — `Mars Atmosphere and Volatile EvolutioN (MAVEN) (B).glb` |
| `odyssey.glb` | Mars Odyssey | https://science.nasa.gov/3d-resources/mars-odyssey/ — `Mars Odyssey.glb` |
| `lro.glb` | LRO | https://science.nasa.gov/3d-resources/lunar-reconnaissance-orbiter-b/ — `Lunar Reconnaissance Orbiter (B).glb` |
| `juno.glb` | Juno | https://science.nasa.gov/3d-resources/juno-a/ — `Juno (A).glb` |
| `themis.glb` | ARTEMIS P1, ARTEMIS P2 | https://science.nasa.gov/3d-resources/time-history-of-events-and-macroscale-interactions-during-substorms-themis/ — `…(THEMIS).glb`; one model for every THEMIS probe, two of which are ARTEMIS |
| `dart.glb` | DART | https://science.nasa.gov/3d-resources/double-asteroid-redirection-test-dart/ — the printable `Double Asteroid Redirection Test (DART).stl`, converted to GLB here (one mesh, flat grey; no textures exist) |
| `curiosity.glb` | Curiosity | https://science.nasa.gov/resource/curiosity-rover-3d-model/ — `24584_Curiosity_static.glb`, credit NASA/JPL-Caltech (no GLB of Curiosity is in NASA 3D Resources itself) |
| `perseverance.glb` | Perseverance | https://science.nasa.gov/3d-resources/mars-2020-perseverance-rover/ — `Mars 2020 Perseverance Rover.glb`, NASA/JPL; posed here, see below |
| `insight.glb` | InSight | https://science.nasa.gov/resource/insight-lander-3d-model/ — `24880_InSight_deployed.glb`, credit NASA/JPL-Caltech; lifted here, see below |

One model serves both Voyagers and Pioneer 10's serves Pioneer 11: each pair was built
alike, and no model of the second of either has been published.

Seven of the second batch's eleven are in arbitrary units, not metres -- ACE, DSCOVR,
SOHO, Roman, TESS, STEREO and OSIRIS-REx. They are scaled in the app by one published
dimension each; `SHAPES` and `MORE_SHAPES` in `tools/src/catalog.ts` give the factor and
where it comes from. NASA's Wind model draws the craft's 100 m wire antennas a few metres
long; at 0.38 mm thick they would not show at any length. DART's only NASA model is a
printable STL, converted to GLB with glTF-Transform's core library (positions and face
normals, welded) before the same compression.

Two of the Mars models were changed before compression, and nothing else about them.
Perseverance's file ships with its mast stowed and a demonstration animation that raises
it and then works the arm; every animated part was set to its pose at 3 s -- mast up, arm
still stowed, as the rover drives -- and the animations dropped. InSight's origin is at
its deck, 0.664 m above the lowest point, the seismometer it set on the ground; the whole
file was moved up by that, so it stands on the ground it is placed on.

## Not here

Juice, Lucy and Psyche are drawn as plain boxes of their published dimensions instead.
Juice's model is on ESA's SPICE server with no licence stated; Lucy's and Psyche's exist
only as NASA Eyes runtime assets, with no terms published. Using any of them would be
using something nobody has said may be used.

The same goes for ESA's models of Solar Orbiter, BepiColombo, Hera, Euclid, Gaia and
SOHO (on its SPICE server and Scifleet), JAXA's none for Hayabusa2 or Akatsuki, and
NASA's printable-only DART: boxes, or -- for Gaia and Aditya-L1, whose three dimensions
are not published -- the marker alone.

## Processing

Downloaded 2026-10-06 and compressed with glTF-Transform 4.5.1, two commands per file:

```
npx @gltf-transform/cli optimize <source>.glb mid.glb --simplify false --palette false --compress false --texture-compress webp --texture-size 1024
npx @gltf-transform/cli meshopt mid.glb <name>.glb --quantize-position 16 --quantize-normal 12
```

WebP textures at most 1024 px, then meshopt geometry compression with positions
quantised to 16 bits -- 0.3 mm across JWST's 21 m. **No simplification**: the first
pass used `optimize`'s defaults, which simplify the mesh and quantise positions to 14
bits, and JWST lost a third of its vertices to it. Only bitwise-identical vertices are
merged now. Every model's bounds were checked unchanged afterwards. 50 MB of sources
became 5.9 MB, most of it Europa Clipper (35.7 MB to 3.7 MB). The app decodes meshopt
with three.js's own decoder, fetched with the first model.

Units and axes are documented nowhere in the sources. Both were measured: see `SHAPES` in
`tools/src/catalog.ts`.
