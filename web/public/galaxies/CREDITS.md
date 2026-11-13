# Galaxy map credits

The maps the Local Group's discs are drawn from (`web/src/core/localGroup.ts` FaceOnMap,
`web/src/scene/LocalGroup.tsx`). Loaded lazily, with the Local Group's catalogue, once the
camera is out of the Milky Way's disc.

None is shown as a picture. Each is a disc seen from straight above -- where its old stars, its
star formation and its dust are -- that the app turns into a volume of light and of dust, of
each one's own thickness, and sees through from wherever the camera is (see About, "The Local
Group"). The Small Magellanic Cloud, which is no disc, is mapped as seen from Earth instead, with
how deep along the line of sight its stars lie (below).

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
- **Faded out where it is down in its noise**: the map's own level in its corners taken off
  (Triangulum's −0.001 MJy/sr, its background taken off a little deep), then a weight from its
  light smoothed over 8 texels against the scatter of each texel about its neighbours -- nothing
  below 1.5 times that noise, all of it from 5 -- and the star formation faded with it: past the
  disc the noise, drawn out along the minor axis, showed as streaks and specks round it.
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

## lmc.png, lmc.json: the Large Magellanic Cloud

Made the same way, by the same script, from its own surveys -- nine degrees across the sky, it
is in neither z0MGS nor its dust maps: 1024 × 1024 points 13 kpc either side of the centre --
its exponential under the glow's floor by the round window's edge --;
tipped 34°, its line of nodes at 139°, its north-east side nearer; star formation ending at
5.5 kpc. Each map only where it was observed: past its edge nothing, not light made up.

- **R, old stars**: Spitzer IRAC 3.6 µm, SAGE's 2″ mosaic averaged to 10″, its own background
  taken off -- 0.0100 MJy/sr, the floor its medians in rings settle on, fitted with the disc's
  measured scale length, 1.4 kpc (van der Marel 2001): 2.6 % of the profile at its centre, 23 %
  of the light the map held; its compact sources -- its own resolved giants, foreground stars,
  background galaxies -- taken out on the map. Past the mosaic's edge, its exponential of that
  scale length, joined to it smoothly where the map is down in its noise. Its dust faded out
  towards the edge of Clark's map, as the SMC's: there the fit's streaks, A_V twice the disc's,
  were a dark band along Spitzer's square.
- **G, star formation**, M☉/yr/kpc²: SHASSA's continuum-subtracted H-alpha (field 013), less the
  Milky Way's own H-alpha in front of it (its median 5.5–6.3° from the centre), plus Spitzer MIPS
  24 µm for what the dust hides, averaged to 12.5″: Kennicutt et al. 2009's
  5.5 × 10⁻⁴² [L(Hα) + 0.020 νL_ν(24 µm)] M☉/yr per erg/s. A compact source in one with nothing
  in the other taken out. Then spread by a Gaussian of 200 pc, its total kept: H-alpha and 24 µm
  show stars younger than some 10 Myr, still in their birth clouds, but most of the young stars'
  V light is from stars 10–100 Myr old, which have drifted a few hundred pc from where they
  formed, at some 10 km/s.
- **B, dust**: A_V face-on from Clark et al. 2023's dust surface density, M☉/pc² -- its opacity
  set so the Milky Way's diffuse gas has 150 times its dust's mass -- by that ratio and Bohlin et
  al.'s hydrogen per magnitude: 7.36 magnitudes per M☉/pc².

## lmc-nebula.png: the Large Magellanic Cloud's nebulae

Its ionised gas, which glows in its Balmer lines -- the pink of every photograph of its HII
regions, 30 Doradus first -- on the same 1024 × 1024 points as `lmc.png`, one 8-bit grey channel,
log10 between `lmc.json`'s `nebula.bounds`, 0 for none. Made by the same script.

- **What**: the Balmer lines' light face-on, as V-band-equivalent luminosity, L☉,V per pc²: the
  lines' energy over the Sun's V luminosity, so that it is drawn on the same exposure as the stars.
- **From** SHASSA's H-alpha, as in `lmc.png`'s star formation -- the Milky Way's in front taken
  off, a compact source with nothing at 24 µm taken out, deprojected, softened, ending at 5.5 kpc --
  but not spread: the gas is where it is. A decirayleigh is 10⁵/4π photons of 656.28 nm per cm²
  per s per sr, 2.41 × 10⁻⁸ erg/s/cm²/sr; 4π I over a pc².
- **H-beta** on top, 1/2.86 of H-alpha's energy: Case B's Balmer decrement (Osterbrock &
  Ferland 2006, Astrophysics of Gaseous Nebulae and Active Galactic Nuclei, 2nd ed.).
- **The Sun's V luminosity**, 4.55 × 10³² erg/s: its absolute V magnitude, 4.81 (Willmer 2018,
  ApJS 236, 47), with V = 0 at 3.631 × 10⁻⁹ erg/s/cm²/Å (Bessell, Castelli & Plez 1998, A&A 333,
  231) over the V band's 880 Å (Binney & Merrifield 1998, Galactic Astronomy, table 2.1).
- Its H-alpha, 2.6 × 10⁴⁰ erg/s in all; 30 Doradus, at its brightest, some 500 L☉,V per pc².

### Sources

- **IRAC 3.6 µm and MIPS 24 µm**: SAGE, Meixner, M., et al. 2006, AJ 132, 2268; IRSA,
  doi:10.26131/IRSA404. This work is based in part on observations made with the Spitzer Space
  Telescope, which was operated by the Jet Propulsion Laboratory, California Institute of
  Technology under a contract with NASA; it has made use of the NASA/IPAC Infrared Science Archive.
- **H-alpha**: the Southern H-Alpha Sky Survey Atlas (SHASSA), which is supported by the
  National Science Foundation -- Gaustad, J. E., McCullough, P. R., Rosing, W., Van Buren, D. 2001,
  PASP 113, 1326. © Las Cumbres Observatory; free for scientific and educational use with
  acknowledgement, not for commercial use.
- **Dust**: Clark, C. J. R., et al. 2023, ApJ 946, 42, "The Quest for the Missing Dust: II";
  Zenodo, doi:10.5281/zenodo.7392275, CC BY 4.0.

## smc.png, smc-nebula.png, smc.json: the Small Magellanic Cloud

Made by the same script (`python tools/galaxies/prepare.py smc`). Torn by the LMC, the SMC is
no disc: it is deeper along our line of sight than it is wide on the sky, so a face-on map of it
would be a map of nothing. Its maps are of the sky as seen from Earth, not deprojected, and
`smc.json` says how deep its light lies at each place.

- **The sky**: 1640 × 1640 points on the tangent (gnomonic) plane about RA 12.75°, Dec −73.12°,
  8° either side, so that its old stars' exponential is under the glow's floor by the round
  window's edge; the column number grows to the east, the row number to the north -- so the
  picture's left is west, unlike a photograph of the sky. Each value per pc² of sky at 62.44 kpc
  (Graczyk et al. 2020). Each map only where it was observed, as the LMC's.
- **R, old stars**: Spitzer IRAC 3.6 µm, SAGE-SMC's 2″ mosaic averaged to 10″; its compact
  sources taken out on the map. The Milky Way's globular clusters 47 Tucanae and NGC 362, in
  front of it, masked to their tidal radii, 42′ and 10′ (Harris 1996, 2010 edition) -- 47 Tuc's
  light is still a fifth above the SMC's at 40′. The mosaic's own background taken off: its
  medians in rings fall to some 3.7 kpc from the centre and then stay at 0.0035 MJy/sr out to
  5.4, where the SMC's giants fall another e^−1.5 (Nidever et al. 2011, ApJ 733, L10: an
  exponential of 1.0°, 1.09 kpc, from 3° to 7.5°) -- so a floor of 0.0013 MJy/sr, fitted with
  that scale length over the rings 1.2–8.7 kpc out, 1.1 % of the profile at its centre, which
  carried past the mosaic's edge had drawn a grey disc 5° across. Past the mosaic's edge, and
  where the mosaic is down in its noise, the SMC's own exponential on the sky of that scale
  length, joined to the mosaic smoothly. (Fitted to the mosaic, as it was, its slope came out 2.35 kpc: the floor and
  the Bridge to the east held it up.)
- **G, star formation**, M☉/yr/kpc² of sky: SHASSA's continuum-subtracted H-alpha (field 510),
  less the Milky Way's H-alpha in front of it, 7.0 dR -- its median 4.5–6° from the centre, the
  third of that ring towards the LMC (position angles 50–170°, the Bridge's gas) left out -- plus
  Spitzer MIPS 24 µm averaged to 12.5″, by Kennicutt et al. 2009's calibration, as the LMC's. A
  compact source in one with nothing in the other taken out where both were observed; past the
  24 µm mosaic, which covers all the SMC's star formation, the residuals SHASSA left of the Milky
  Way's bright stars -- each more than 500 dR below nothing beside as much above, which no HII
  region is -- taken out with 3′ round them; 47 Tuc and NGC 362 masked to 10′ and 5′, where their
  continuum left a residual. Ending 4° from the centre, where the Bridge begins; spread by 200 pc,
  as the LMC's. In all, 0.033 M☉/yr.
- **B, dust**: A_V as seen from Earth, from Clark et al. 2023's dust surface density, as the
  LMC's (7.36 magnitudes per M☉/pc²): 1.68 × 10⁵ M☉ of dust, where Herschel observed it -- some
  4.3° × 4.9° about the bar and the Wing's start. Past Clark's map, no dust: unlike the old stars
  there is no profile of it to carry on honestly. And the dust fades out at its edge rather than
  ending in a square that the volume would show from every side: its outermost 0.3°, where the
  far-infrared is faint and the fit's rows come out as streaks, dropped, then a smooth ramp to the
  whole map by 0.7° inside the edge -- 1.48 × 10⁵ M☉ kept, 12 % lost.
- **smc-nebula.png**: its ionised gas's Balmer light, L☉,V per pc² of sky, made from the H-alpha
  above exactly as `lmc-nebula.png`, not spread. Its H-alpha, 5.5 × 10³⁹ erg/s in all.
- Each channel log10 between the bounds in `smc.json`, in 8 bits, 0 for none.

### Its depth: smc.json's `depth`

On a 51 × 51 grid over the same square -- cells 0.31° across, for its old stars and its young:
the mean distance from the Sun, kpc, and the intrinsic spread about it along the line of sight,
kpc -- the app spreads each point of the sky maps along the line of sight by the Gaussian of its
place (the dust by the young stars').

- **Old** from OGLE-IV's RR Lyrae (3458 in the SMC), **young** from its classical Cepheids
  younger than 150 Myr (1556), each star's distance from its period-luminosity relation, with
  its error.
- At each point, the mean and spread that best explain the stars round it, each counted by a
  Gaussian of its distance on the sky -- 0.5°, widened where they are sparse until it holds 50
  stars -- the likelihood of each star's distance N(mean, spread² + its error²), so its own error
  is taken out; stars more than three times the width from the mean left out and the fit made
  again. Where no star is within some 2°, the whole SMC's mean, and the spread typical of a place
  in it, blended in smoothly. The spread kept within the 5–95 % range found in squares of 0.625°
  with 30 stars or more.
- **Zero points**: the two catalogues' period-luminosity relations disagree by some 4 kpc at the
  SMC. Each is scaled so that the median distance of all its stars within 1° of the centre is the
  eclipsing binaries' 62.44 kpc (Graczyk et al. 2020) -- the RR Lyrae's by 1.017, the Cepheids'
  by 0.954 -- a zero point in distance modulus being a factor in distance. The young Cepheids keep
  their offset from the older ones on the same scale.
- At the centre the old stars lie at 62.1 kpc, spread by 3.0 kpc (2.0–3.8 over the grid); the
  young at 61.8 kpc, spread by 2.8 kpc (1.3–3.3), and the young lie nearer to the north-east,
  farther by 2.3 kpc per degree towards position angle 241° (the Wing and N66 nearer, the
  south-west bar farther).

### Sources

- **IRAC 3.6 µm and MIPS 24 µm**: SAGE-SMC, Gordon, K. D., et al. 2011, AJ 142, 102,
  doi:10.1088/0004-6256/142/4/102; IRSA, doi:10.26131/IRSA431. This work is based in part on
  observations made with the Spitzer Space Telescope, which was operated by the Jet Propulsion
  Laboratory, California Institute of Technology under a contract with NASA; it has made use of
  the NASA/IPAC Infrared Science Archive.
- **H-alpha**: SHASSA, as the LMC's -- Gaustad, J. E., McCullough, P. R., Rosing, W., Van Buren,
  D. 2001, PASP 113, 1326. © Las Cumbres Observatory; free for scientific and educational use
  with acknowledgement, not for commercial use.
- **Dust**: Clark, C. J. R., et al. 2023, ApJ 946, 42; Zenodo, doi:10.5281/zenodo.7392275,
  CC BY 4.0.
- **Classical Cepheids**: Jacyszyn-Dobrzeniecka, A. M., et al. 2016, "OGLE-ing the Magellanic
  System: Three-Dimensional Structure of the Clouds and the Bridge Using Classical Cepheids",
  Acta Astronomica 66, 149, arXiv:1602.09141 -- its table 3,
  https://ogle.astrouw.edu.pl/cont/4_main/str/3_dim_str/.
- **RR Lyrae**: Jacyszyn-Dobrzeniecka, A. M., et al. 2017, "OGLE-ing the Magellanic System:
  Three-Dimensional Structure of the Clouds and the Bridge using RR Lyrae Stars", Acta
  Astronomica 67, 1, arXiv:1611.02709 -- its table 2,
  https://ogle.astrouw.edu.pl/cont/4_main/str/3_dim_rrl/. OGLE asks, of both: "PLEASE cite the
  following paper when using the data or referring to these OGLE results".
- **Distance**: Graczyk, D., et al. 2020, ApJ 904, 13, doi:10.3847/1538-4357/abbb2b.
- **47 Tucanae and NGC 362**: Harris, W. E. 1996, AJ 112, 1487 (2010 edition),
  doi:10.1086/118116 -- their positions, half-light and tidal radii.
