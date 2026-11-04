# Supernova remnant credits

The pictures the supernova remnants are drawn from (`web/src/core/supernovaRemnants.ts`,
`web/src/scene/remnantMap.ts`), and Cassiopeia A's 3D map. Loaded lazily: a file is fetched
only once its remnant is a few pixels across on screen.

None is shown as a picture. Each is a map of the remnant's light on the sky that the app
spreads through a volume, the sum along every line of sight from Earth giving back the map's
pixel (see About, "Supernova remnants").

Every file added here must be recorded below with its source, credit and licence.
`web/src/scene/remnantMap.test.ts` enforces that: an uncredited file fails the build.

## What was done to them

All are **adapted**: made by `tools/remnants/prepare.py` from the sources below, which it
downloads itself (`python tools/remnants/prepare.py`; numpy, scipy and Pillow).

- **Reprojected**: from the astrometry the source embeds (AVM in the JPEGs, the WCS in the
  FITS files), gnomonic, onto 1024 × 1024 pixels centred on Green's centre for the remnant,
  north up, east left.
- **Stars taken out**: at the positions Gaia DR3 gives (Hipparcos for the brightest, which
  Gaia misses), each star's size fitted to its magnitude on the stars clear of the gas, its
  disc (and a Hubble picture's diffraction spikes) filled from the light round it; then a
  directional median for the faintest. The app draws stars from its own catalogues.
- **Sky taken off**: a low percentile of the frame, or of the pixels round each one for the
  photographic plates, whose skies differ plate to plate; then a floor a few times the noise.
- **Faded out** beyond the remnant, at a radius given for each.
- The Digitized Sky Survey's two plates made a colour picture: red the red plate, blue the
  blue, green their mean, the blue scaled so that the stars come out white on average.
- Cassiopeia A's Hubble picture, in red and near-infrared filters, Vela's H-alpha and the
  X-ray pictures of Tycho's, SN 1006 and Puppis A are kept **grey**: where the light is and how much. The app
  draws them in the colour of the remnant's visible lines.
- The Crab's synchrotron share (`crab-continuum.png`) is how much of each pixel the
  synchrotron's colour can account for, that colour the median of the bluest bright pixels
  at its middle.

## Licences

- **ESO and ESA/Hubble**: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/), per
  eso.org/public/copyright and esahubble.org/copyright. Each asks for its full credit line,
  shown visibly: it is in the remnant's panel in the app and below. These are adaptations.
- **Chandra (NASA/CXC)**: "For Chandra content, no claim to copyright is being asserted"
  (chandra.harvard.edu/photo/image_use.html), acknowledgement asked; it warns that non-NASA
  material in a composite may belong to others. Puppis A's includes ESA's XMM-Newton data,
  public in ESA's archive, imaged by the IAFE team in its credit: used here credited, in a
  non-commercial app.
- **Cassiopeia A's 3D map** is NASA/CXC's too, published by the Chandra X-ray Center for
  anyone to use: "Created by NASA, Smithsonian Astrophysical Observatory/Chandra X-ray Center,
  MIT & T. Delaney et al." (its README).
- **SHASSA** (Vela's): "These images are copyrighted by Las Cumbres Observatory, Inc.
  Permission for scientific and educational use is hereby granted freely, as long as
  acknowledgement of the source is given […] Commerical use is prohibited without express
  permission" (amundsen.swarthmore.edu/SHASSA/ack.html). Acknowledged as it asks, in the
  panel and below, with its paper (Gaustad et al. 2001, PASP 113, 1326). Its H-alpha is
  continuum-subtracted, the stars taken out by the survey; what the brightest leave is
  masked at Hipparcos's positions. Vela's whole remnant is in no visible-light photograph
  under a licence that allows this: this is its light in H-alpha, the Gum Nebula's with it
  where they overlap on the sky.
- **The Digitized Sky Survey**: STScI gives no licence; it asks for its acknowledgement, and
  the plates are copyright the institutions that took them (archive.stsci.edu/dss/copyright.html).
  Used here credited, in a non-commercial app, with STScI's acknowledgement:

  > The Digitized Sky Surveys were produced at the Space Telescope Science Institute under
  > U.S. Government grant NAG W-2166. The images of these surveys are based on photographic
  > data obtained using the Oschin Schmidt Telescope on Palomar Mountain and the UK Schmidt
  > Telescope. The plates were processed into the present compressed digital form with the
  > permission of these institutions.
  >
  > The National Geographic Society - Palomar Observatory Sky Atlas (POSS-I) was made by the
  > California Institute of Technology with grants from the National Geographic Society.
  >
  > The Second Palomar Observatory Sky Survey (POSS-II) was made by the California Institute
  > of Technology with funds from the National Science Foundation, the National Geographic
  > Society, the Sloan Foundation, the Samuel Oschin Foundation, and the Eastman Kodak
  > Corporation.
  >
  > The Oschin Schmidt Telescope is operated by the California Institute of Technology and
  > Palomar Observatory.
  >
  > The UK Schmidt Telescope was operated by the Royal Observatory Edinburgh, with funding
  > from the UK Science and Engineering Research Council (later the UK Particle Physics and
  > Astronomy Research Council), until 1988 June, and thereafter by the Anglo-Australian
  > Observatory.

  The plates were fetched through NASA's SkyView (skyview.gsfc.nasa.gov).
- **Gaia DR3 and Hipparcos** (the star positions), from ESA's Gaia archive
  (gea.esac.esa.int): Gaia data are "distributed under the CC BY-NC 3.0 IGO license"
  (cosmos.esa.int/web/gaia-users/license). Only used to find the stars to take out, not
  shipped. This work has made use of data from the European Space Agency (ESA) mission Gaia,
  processed by the Gaia Data Processing and Analysis Consortium (DPAC).

## Files

| File | Remnant | Source | Credit | Licence |
|---|---|---|---|---|
| `crab.png` | Crab Nebula | https://www.eso.org/public/images/eso9948f/ (VLT FORS2, three filters) | ESO | CC BY 4.0, adapted |
| `crab-continuum.png` | Crab Nebula | https://www.eso.org/public/images/eso9948f/ (its synchrotron share) | ESO | CC BY 4.0, adapted |
| `cas-a.png` | Cassiopeia A | https://esahubble.org/images/heic0609a/ (ACS, F625W, F775W, F850LP) | NASA, ESA, and the Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration. Acknowledgement: Robert A. Fesen (Dartmouth College, USA) and James Long (ESA/Hubble) | CC BY 4.0, adapted |
| `cas-a-points.bin` | Cassiopeia A | https://chandra.harvard.edu/graphics/resources/illustrations/3d_files/CasA_supernova_remnant-ascii_vtks.zip (DeLaney et al. 2010, ApJ 725, 2038) | Model: NASA/CXC/MIT/T. Delaney et al. | no copyright asserted |
| `kepler.png` | Kepler's | https://esahubble.org/images/opo0429i/ (WFPC2 and ACS) | NASA, ESA, R. Sankrit and W. Blair (Johns Hopkins University) | CC BY 4.0, adapted |
| `tycho.png` | Tycho's | https://chandra.harvard.edu/photo/openFITS/xray_data.html (tycho_4100-6100eV.fits) | NASA/CXC/Rutgers/J.Warren & J.Hughes et al. | no copyright asserted |
| `sn-1006.png` | SN 1006 | https://chandra.harvard.edu/photo/2013/sn1006/ (sn1006_lg.jpg) | NASA/CXC/Middlebury College/F.Winkler | no copyright asserted |
| `puppis-a.png` | Puppis A | https://chandra.harvard.edu/photo/2014/puppisa/ (puppisa_lg.jpg) | X-ray: NASA/CXC/IAFE/G.Dubner et al & ESA/XMM-Newton | Chandra: no copyright asserted; XMM-Newton: ESA |
| `vela.png` | Vela | https://skyview.gsfc.nasa.gov/ (SHASSA CC, 5° at 128.5, −45.833; https://amundsen.swarthmore.edu/SHASSA/) | the Southern H-Alpha Sky Survey Atlas (SHASSA), which is supported by the National Science Foundation; Gaustad et al. 2001, PASP 113, 1326 | © Las Cumbres Observatory, free for scientific and educational use, not commercial |
| `cygnus-loop.png` | Cygnus Loop | https://skyview.gsfc.nasa.gov/ (DSS2 Red and Blue, 4.5° at 312.75, 30.667) | Digitized Sky Survey 2 (STScI); Second Palomar Observatory Sky Survey (Caltech) | DSS acknowledgement above |
| `ic-443.png` | IC 443 | https://skyview.gsfc.nasa.gov/ (DSS2 Red and DSS1 Blue, 1.25° at 94.25, 22.567) | Digitized Sky Survey (STScI); Palomar Observatory Sky Surveys I and II (Caltech) | DSS acknowledgement above |
