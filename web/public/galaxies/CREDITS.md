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
  stars. Inside, a compact source in the far-UV with nothing at 22 µm (a star in front) or the
  reverse (a galaxy behind) is taken out: a star-forming region shows in both.
- **Softened** to the resolution the minor axis leaves -- a texel and a half across, one along --
  and faded out below twice the noise measured where there is no disc.
- **R, old stars**: WISE 3.4 µm.
- **G, star formation**, M☉/yr/kpc²: GALEX far-UV plus WISE 22 µm for the UV the dust took,
  Leroy et al. 2008's calibration.
- **B, dust**: A_V face-on, from Marsh et al. 2018's column density, H₂ per cm², and Bohlin et
  al. 1978's hydrogen per magnitude of reddening, 5.8 × 10²¹ cm⁻² per E(B−V), R_V 3.1.
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

## m33.png, m33.json: Triangulum

Made the same way, by the same script: 1024 × 1024 points 12 kpc either side of the centre;
tipped 52°, its major axis at 22.5°, its west side taken as the nearer; squeezed by 0.616 for
the old stars and 0.626 for the dust; no bulge to take off; star formation ending at 11 kpc.

- **R, old stars**: WISE 3.4 µm. **G, star formation**: GALEX far-UV plus WISE 22 µm. Both from
  z0MGS, as Andromeda's.
- **B, dust**: A_V face-on, from z0MGS's dust surface density -- Draine & Li 2007's model fitted
  to Herschel's PACS and SPIRE pictures, its `LOGSIGD` extension -- by Draine et al. 2014's
  A_V = 0.74 Σ_d / (10⁵ M☉ kpc⁻²), divided by the 2.5 Dalcanton et al. 2015 found that model
  overpredicts Andromeda's dust by, measuring it from its stars.

### Sources

- **WISE 3.4 and 22 µm, GALEX far-UV**: z0MGS, as above.
- **Dust**: z0MGS's dust maps, IRSA, https://irsa.ipac.caltech.edu/data/Herschel/z0MGS_Dust/ --
  Chastenet, J., et al. 2025, ApJS 276, 2; IRSA, doi:10.26131/IRSA581; from Herschel's PACS
  and SPIRE, as above, and WISE.
