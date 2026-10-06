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

One model serves both Voyagers and Pioneer 10's serves Pioneer 11: each pair was built
alike, and no model of the second of either has been published.

## Not here

Juice, Lucy and Psyche are drawn as plain boxes of their published dimensions instead.
Juice's model is on ESA's SPICE server with no licence stated; Lucy's and Psyche's exist
only as NASA Eyes runtime assets, with no terms published. Using any of them would be
using something nobody has said may be used.

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
