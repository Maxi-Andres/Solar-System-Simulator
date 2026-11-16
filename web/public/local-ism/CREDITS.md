# Local interstellar medium credits

The data the Local Interstellar Medium layer is drawn from (`web/src/core/localInterstellar.ts`,
`web/src/scene/LocalInterstellar.tsx`). Loaded only once the layer is on and the camera is a few
parsecs from the Sun.

Every file added here must be recorded below with its sources and credits.
`web/src/core/localInterstellar.test.ts` enforces that.

## local-ism.json: the Local Bubble and the Radcliffe Wave

Made by `tools/src/localInterstellar/prepareLocalInterstellar.ts` (`pnpm -C tools
prepare:local-ism`, which downloads its three sources itself from Harvard Dataverse).

### The Local Bubble

- **Source**: V. Pelgrims, "The shape of the shell of the Local Bubble", Harvard Dataverse,
  doi:10.7910/DVN/RHPVNC, file `L19_map-inner_final.fits`: the distance from the Sun to the inner
  edge of the Local Bubble's shell, derived in Pelgrims, Ferrière, Boulanger, Lallement & Montier
  2020, "Modeling the magnetized Local Bubble from dust data", A&A 636, A17, from the 3D dust
  extinction map of Lallement et al. 2019, A&A 625, A135.
- **Licence**: CC0 1.0 (public domain dedication), as the dataset states. Credited all the same.
- **Adapted**: the column `r_in_lmax-06` (the spherical-harmonic model of the surface to
  multipole 6), a HEALPix map (Nside 128, RING, Galactic), read at every 3 degrees of Galactic
  longitude and latitude -- each node the value of the HEALPix pixel it falls in -- and rounded
  to the parsec.

### The Radcliffe Wave

- **Sources**: R. Konietzka, "Best fit model of the Radcliffe Wave", Harvard Dataverse,
  doi:10.7910/DVN/F98QHY, and "12CO radial velocities along the Radcliffe Wave",
  doi:10.7910/DVN/Q7F4PC: the data of Konietzka et al. 2024, "The Radcliffe Wave is
  oscillating", Nature 628, 62. The wave was found by Alves et al. 2020, Nature 578, 237.
- **Licence**: CC0 1.0, as each dataset states. Credited all the same.
- **Adapted**: of the model's 1,500 points (heliocentric Galactic x, y, z in pc, and the vertical
  velocity), one in eight kept, and the last, rounded to 0.1 pc and 0.1 km/s; the 79 clouds kept
  whole -- name, position and spread -- the underscores in their names made spaces.
