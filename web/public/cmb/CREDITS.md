# CMB map credits

The map the last-scattering sphere is drawn with (`web/src/scene/cmb.ts`,
`web/src/scene/CosmicMicrowaveBackground.tsx`). Loaded only once the camera is far out, 3 billion
light years from the Sun or more.

It is laid on a sphere of the CMB's comoving radius about the Sun, seen from inside, as the wall of
the sky. Each point is drawn either as a blackbody whose departure from the mean temperature is made
1,000 times larger (true colour, the default), or in the Planck Collaboration's colour scale for its
maps, Planck_Parchment_RGB.txt, over -300 to +300 uK (false colour). See About, "The observable
universe".

Every file added here must be recorded below with its source and credit.
`web/src/scene/cmb.test.ts` enforces that.

## cmb.png, cmb.json: the CMB's temperature

**Credit: ESA, Planck Collaboration.**

- **Source**: Planck 2018 (PR3) SMICA CMB map, `COM_CMB_IQU-smica_2048_R3.00_full.fits`, column
  `I_STOKES_INP` (the temperature, inpainted where the Galactic plane and bright sources were
  masked). Planck Collaboration 2020, "Planck 2018 results. IV. Diffuse component separation",
  A&A 641, A4. From the Planck Legacy Archive, through its mirror at the NASA/IPAC Infrared
  Science Archive:
  https://irsa.ipac.caltech.edu/data/Planck/release_3/all-sky-maps/maps/component-maps/cmb/
- **Licence**: data in ESA's space-science archives are distributed under CC BY-NC 3.0 IGO, with
  the mission's credit line, which for Planck is "ESA, Planck Collaboration"
  (https://www.cosmos.esa.int/web/esdc/terms-and-conditions). Non-commercial use only; commercial
  use needs ESA's authorisation (data.licences@esa.int).
- **Adapted** by `tools/src/cmb/prepareCmb.ts` (`pnpm -C tools prepare:cmb`, which downloads the
  2.0 GB source itself into `tools/cmb/.cache/`):
  - HEALPix, Nside 2048, NESTED, Galactic coordinates, made an equirectangular map of 2048 x 1024
    texels, Galactic: the middle column l = 0, l growing to the left as on Planck's own maps; the
    top row b = +90. Each texel the mean of 16 directions spread over it, each looked up in the
    HEALPix map.
  - Stored as one byte per texel: 128 + dT / 4 uK, clipped to 0-255 (+-512 uK).
  - Checked for orientation: Planck's confidence mask (`TMASK`), read through the same lookup,
    is mostly 0 within 3 degrees of b = 0 and nearly all 1 beyond 30 degrees.
  - The run's own numbers are in `cmb.json`.
