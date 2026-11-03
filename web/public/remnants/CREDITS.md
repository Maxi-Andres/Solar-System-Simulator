# Supernova remnant photograph credits

Photographs of the supernova remnants (`web/src/core/supernovaRemnants.ts`), loaded lazily:
a file is fetched only once its remnant is a few pixels across on screen.

Every file added here must be recorded below with its source, credit and licence.
`web/src/core/supernovaRemnants.test.ts` enforces that: an uncredited photograph fails the
build.

Each is the source's published JPEG, downscaled to at most 2048 pixels on its long side
(Lanczos, JPEG quality 85), not cropped, turned or retouched. Its field of view, centre and
orientation are read from the astrometry its source embeds in the original file (AVM), and
checked against real stars in two of them (52 Cyg in the Cygnus Loop's, η Gem in IC 443's).
None is mirrored: east is left of north in all nine.

## Licences

- **ESA/Hubble, ESO and NOIRLab**: CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/),
  per esahubble.org/copyright, eso.org/public/outreach/copyright and
  noirlab.edu/public/copyright. Each asks for its full credit line, shown visibly; ESO and
  ESA/Hubble add that the people named in it need not be asked. The credit line is in the
  remnant's panel in the app and below.
- **Chandra (NASA/CXC)**: NASA claims no copyright on its own images
  (chandra.harvard.edu/photo/image_use.html), and warns that non-NASA material in a composite
  may belong to others. In Tycho's and Kepler's that material is the Digitized Sky Survey's
  stars, which ESO and ESA/Hubble publish under CC BY 4.0 themselves. In Puppis A's it is
  ESA's XMM-Newton X-ray data, public in ESA's archive, imaged by the IAFE team named in the
  credit: used here credited, in a non-commercial app -- the least clean of the nine, and
  the project owner's call.

## What they show

Five are visible light, three are X-rays drawn in false colour, one mixes radio, X-rays and
H-alpha. Tycho's, Kepler's and Puppis A have no free optical image of the whole remnant in
these archives: their optical light is faint filaments, and Puppis A's only optical picture
(NOIRLab's noirlab2406f) is a 9′ excerpt of it. Vela's is its northern quarter: no image in
them shows the whole of it, 255′ across. The Cygnus Loop's leaves out about a sixth of it,
its faint southern edge. IC 443's was taken in Kitt Peak's Advanced Observing Program, by
visiting observers with NOIRLab's Adam Block; it is NOIRLab's, credited and licensed by it.

## Files

| File | Source | Credit | Licence | Field of view | North |
|---|---|---|---|---|---|
| crab.jpg | https://esahubble.org/images/heic0515a/ (large, 3864²) | NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble) | CC BY 4.0 | 6.41′ × 6.41′ | up |
| cas-a.jpg | https://esahubble.org/images/heic0609a/ (publication JPEG, 4000×2879) | NASA, ESA, and the Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration. Acknowledgement: Robert A. Fesen (Dartmouth College, USA) and James Long (ESA/Hubble) | CC BY 4.0 | 8.55′ × 6.15′ | 0.4° left of up |
| tycho.jpg | https://chandra.harvard.edu/photo/2011/tycho/ (tycho_lg.jpg, 3600×2844) | X-ray: NASA/CXC/Rutgers/K.Eriksen et al.; Optical: DSS | NASA/CXC: no copyright claimed | 19.04′ × 15.04′ | 0.1° left of up |
| kepler.jpg | https://chandra.harvard.edu/photo/2013/kepler/ (kepler_lg.jpg, 3600×2407) | X-ray: NASA/CXC/NCSU/M.Burkey et al; Optical: DSS | NASA/CXC: no copyright claimed | 12.16′ × 8.13′ | 0.2° right of up |
| sn-1006.jpg | https://www.eso.org/public/images/eso1308b/ (large, 3311²) | Radio: NRAO/AUI/NSF/GBT/VLA/Dyer, Maddalena & Cornwell, X-ray: Chandra X-ray Observatory; NASA/CXC/Rutgers/G. Cassam-Chenaï, J. Hughes et al., Visible light: 0.9-metre Curtis Schmidt optical telescope; NOAO/AURA/NSF/CTIO/Middlebury College/F. Winkler and Digitized Sky Survey. | CC BY 4.0 | 55.54′ × 55.54′ | up |
| vela.jpg | https://noirlab.edu/public/images/noirlab2406a/ (publication JPEG, 3989×4000) | CTIO/NOIRLab/DOE/NSF/AURA Image Processing: T.A. Rector (University of Alaska Anchorage/NSF NOIRLab), M. Zamani & D. de Martin (NSF NOIRLab) | CC BY 4.0 | 161.11′ × 161.53′ | 0.1° left of up |
| cygnus-loop.jpg | https://noirlab.edu/public/images/noao1209a/ (publication JPEG, 3980×4000) | T.A. Rector (University of Alaska Anchorage) and WIYN/NOIRLab/NSF/AURA | CC BY 4.0 | 173.10′ × 173.97′ | 0.6° right of up |
| puppis-a.jpg | https://chandra.harvard.edu/photo/2014/puppisa/ (puppisa_lg.jpg, 3600²) | X-ray: NASA/CXC/IAFE/G.Dubner et al & ESA/XMM-Newton | NASA/CXC: no copyright claimed | 85.66′ × 85.66′ | up |
| ic-443.jpg | https://noirlab.edu/public/images/noao-ic443block2/ (large, 1331×866, kept at its size) | KPNO/NOIRLab/NSF/AURA/Tom Bash and John Fox/Adam Block | CC BY 4.0 | 121.16′ × 78.84′ | 111.1° right of up |
