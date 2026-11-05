# Galaxy map credits

The maps the Local Group's discs are drawn from (`web/src/core/localGroup.ts` FaceOnMap,
`web/src/scene/LocalGroup.tsx`). Loaded lazily, with the Local Group's catalogue, once the
camera is out of the Milky Way's disc.

None is shown as a picture. Each is a disc seen from straight above -- where its old stars, its
star formation and its dust are -- that the app turns into a volume of light and of dust, of
each one's own thickness, and sees through from wherever the camera is (see About, "The Local
Group").

Every file added here must be recorded below with its sources and credit.
`web/src/core/localGroup.test.ts` enforces that: an uncredited map fails the build.

## m31.png, m31.json: Andromeda

Made by `tools/galaxies/prepare.py`, which downloads its sources itself
(`python tools/galaxies/prepare.py`; numpy, scipy and Pillow).

- **Deprojected**: each point of the disc, 1024 × 1024 points 25 kpc either side of the
  centre, to where it is on the sky -- 77° tipped, its major axis at 38°, its north-west side
  nearer, squeezed along its minor axis by 0.262 for the old stars and 0.226 for the dust and
  young stars, as discs of their thickness are -- through each picture's WCS; times that, the
  face-on brightness.
- **Compact sources** the masks missed taken out of the old stars' map (half again above the
  median round them), and the dust map softened by a texel: in a sheet each would be a streak.
- **Foreground stars** masked where z0MGS's own masks put them, and **M32 and NGC 205**, which
  lie on the disc as seen from Earth, four half-light radii about each; filled from round them.
- **The bulge** fitted and taken off (a Sérsic profile, n 2.0, R_e 0.9 kpc, flattened to 0.70,
  with the disc's exponential, inside 3 kpc on the sky): the app draws it as a body of its own.
- **Star formation** ends at 22 kpc: past the outer ring, what the far-UV shows is foreground
  stars.
- **R, old stars**: WISE 3.4 µm.
- **G, star formation**, M☉/yr/kpc²: GALEX far-UV plus WISE 22 µm for the UV the dust took,
  Leroy et al. 2008's calibration.
- **B, dust**: H₂ per cm², Marsh et al. 2018's column density.
- Each channel log10 between the bounds in `m31.json`, in 8 bits, 0 for none.

### Sources

- **WISE 3.4 and 22 µm, GALEX far-UV**: z0MGS, the z = 0 Multiwavelength Galaxy Synthesis --
  Leroy, A. K., et al. 2019, ApJS 244, 24; IRSA, doi:10.26131/IRSA6. This publication makes use
  of data products from the Wide-field Infrared Survey Explorer, which is a joint project of the
  University of California, Los Angeles, and the Jet Propulsion Laboratory/California Institute
  of Technology, funded by the National Aeronautics and Space Administration; and from GALEX,
  operated for NASA by the California Institute of Technology.
- **Dust**: Marsh, K. A., Whitworth, A. P., Smith, M. W. L., Lomax, O., Eales, S. A. 2018,
  "Dust in the Eye of Andromeda", MNRAS, doi:10.1093/mnras/sty2037 -- its PPMAP maps from Herschel,
  http://www.astro.cf.ac.uk/research/PPMAP_M31/. Herschel is an ESA space observatory with
  science instruments provided by European-led Principal Investigator consortia and with
  important participation from NASA.
