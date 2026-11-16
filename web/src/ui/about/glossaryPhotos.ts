/**
 * The glossary's photographs (web/public/glossary/, credited in its CREDITS.md): one per entry
 * where an official image exists, keyed by the entry's id. Width and height are the file's own,
 * so the page does not jump as each arrives.
 */

export interface GlossaryPhoto {
  readonly file: string;
  readonly width: number;
  readonly height: number;
  /** What it shows, for its alt text. */
  readonly alt: string;
  /** The credit line its source asks for, word for word. */
  readonly credit: string;
}

export const GLOSSARY_PHOTOS: Readonly<Record<string, GlossaryPhoto>> = {
  "sun": { file: "sun.webp", width: 406, height: 400, alt: "Spotless Sun", credit: "NASA/GSFC/Solar Dynamics Observatory" },
  "planet": { file: "planet.webp", width: 480, height: 305, alt: "Latest Saturn Portrait", credit: "NASA, ESA, A. Simon (Goddard Space Flight Center), and M.H. Wong (University of California, Berkeley)" },
  "dwarf-planet": { file: "dwarf-planet.webp", width: 400, height: 400, alt: "The Rich Color Variations of Pluto", credit: "NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute" },
  "moon": { file: "moon.webp", width: 258, height: 400, alt: "Juno's Ganymede Close-up", credit: "NASA/JPL-Caltech/SwRI/MSSS" },
  "asteroid": { file: "asteroid.webp", width: 400, height: 400, alt: "A Full-Frame View of Vesta", credit: "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA" },
  "comet": { file: "comet.webp", width: 381, height: 400, alt: "Comet Hale-Bopp", credit: "ESO/E. Slawik" },
  "interstellar-object": { file: "interstellar-object.webp", width: 436, height: 400, alt: "Comet 2I/Borisov and Distant Galaxy in November 2019", credit: "NASA, ESA, and D. Jewitt (UCLA)" },
  "spacecraft": { file: "spacecraft.webp", width: 393, height: 400, alt: "Voyager: Vibration Acoustics and Pyro Shock Testing", credit: "NASA/JPL-Caltech" },
  "satellite": { file: "satellite.webp", width: 480, height: 320, alt: "iss066e080762", credit: "NASA/JSC" },
  "spectral-type": { file: "spectral-type.webp", width: 480, height: 245, alt: "Colourful stars galore inside the globular star cluster Omega Centauri", credit: "NASA, ESA and the Hubble SM4 ERO Team" },
  "red-dwarf": { file: "red-dwarf.webp", width: 408, height: 400, alt: "New shot of Proxima Centauri, our nearest neighbour", credit: "ESA/Hubble & NASA" },
  "supergiant": { file: "supergiant.webp", width: 480, height: 226, alt: "Betelgeuse’s surface before and during its 2019–2020 Great Dimming", credit: "ESO/M. Montargès et al." },
  "white-dwarf": { file: "white-dwarf.webp", width: 366, height: 400, alt: "The Dog Star, Sirius A, and its tiny companion", credit: "NASA, ESA, H. Bond (STScI), and M. Barstow (University of Leicester)" },
  "neutron-star": { file: "neutron-star.webp", width: 356, height: 400, alt: "Peering into the heart of the Crab Nebula", credit: "NASA/ESA and The Hubble Heritage Team (STScI/AURA)" },
  "black-hole": { file: "black-hole.webp", width: 480, height: 280, alt: "First Image of a Black Hole", credit: "EHT Collaboration" },
  "star-system": { file: "star-system.webp", width: 480, height: 314, alt: "Best image of Alpha Centauri A and B", credit: "ESA/Hubble & NASA" },
  "exoplanet": { file: "exoplanet.webp", width: 426, height: 400, alt: "2M1207b - first image of an exoplanet", credit: "ESO" },
  "milky-way": { file: "milky-way.webp", width: 480, height: 240, alt: "The Milky Way panorama", credit: "ESO/S. Brunier" },
  "disc-bulge-arms": { file: "disc-bulge-arms.webp", width: 480, height: 274, alt: "A poster-size image of the beautiful barred spiral galaxy NGC 1300", credit: "NASA, ESA, and The Hubble Heritage Team (STScI/AURA)" },
  "galactic-centre": { file: "galactic-centre.webp", width: 400, height: 400, alt: "First image of our black hole", credit: "EHT Collaboration" },
  "star-cluster": { file: "star-cluster.webp", width: 425, height: 400, alt: "The globular cluster Omega Centauri*", credit: "ESO" },
  "supernova-remnant": { file: "supernova-remnant.webp", width: 400, height: 400, alt: "Most detailed image of the Crab Nebula", credit: "NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble)" },
  "galaxy": { file: "galaxy.webp", width: 400, height: 400, alt: "Hubble sees galaxies galore", credit: "NASA, ESA, and S. Beckwith (STScI) and the HUDF Team" },
  "spiral": { file: "spiral.webp", width: 480, height: 333, alt: "Out of this whirl: The Whirlpool Galaxy (M51) and companion galaxy", credit: "NASA, ESA, S. Beckwith (STScI), and The Hubble Heritage Team (STScI/AURA)" },
  "lenticular": { file: "lenticular.webp", width: 460, height: 400, alt: "The whirling disc of NGC 4526", credit: "ESA/Hubble & NASA Acknowledgement: Judy Schmidt" },
  "elliptical": { file: "elliptical.webp", width: 395, height: 400, alt: "Messier 87 Captured by ESO’s Very Large Telescope", credit: "ESO" },
  "irregular": { file: "irregular.webp", width: 480, height: 309, alt: "Stellar fireworks are ablaze in galaxy NGC 4449", credit: "NASA, ESA, A. Aloisi (STScI/ESA), and The Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration" },
  "dwarf-galaxy": { file: "dwarf-galaxy.webp", width: 480, height: 276, alt: "Dwarf irregular galaxy UGC 8091", credit: "ESA/Hubble, NASA Y. Choi (NOIRLab), K. Gilbert (Space Telescope Science Institute), J. Dalcanton (Flatiron Institute and University of Washington)" },
  "satellite-galaxy": { file: "satellite-galaxy.webp", width: 480, height: 320, alt: "The Atacama Large Millimeter/submillimeter Array (ALMA) by night, under the Magellanic Clouds", credit: "ESO/C. Malin (christophmalin.com)" },
  "galaxy-group": { file: "galaxy-group.webp", width: 417, height: 400, alt: "Stephan’s Quintet (NIRCam + MIRI Imaging)", credit: "NASA, ESA, CSA, and STScI" },
  "local-group": { file: "local-group.webp", width: 480, height: 121, alt: "Panorama of Spiral Galaxy, M31", credit: "Local Group Survey Team and T.A. Rector (University of Alaska Anchorage)" },
  "galaxy-cluster": { file: "galaxy-cluster.webp", width: 480, height: 365, alt: "Pandora’s Cluster (Abell 2744)", credit: "NASA, ESA, CSA, I. Labbe (Swinburne University of Technology), R. Bezanson (University of Pittsburgh), A. Pagan (STScI)" },
  "quasar": { file: "quasar.webp", width: 405, height: 400, alt: "Best image of bright quasar 3C 273", credit: "ESA/Hubble & NASA" },
  "gamma-ray-burst": { file: "gamma-ray-burst.webp", width: 451, height: 400, alt: "GRB 250314A Pull-out (NIRCam image)", credit: "NASA, ESA, CSA, STScI, A. Levan (IMAPP), Image Processing: A. Pagan (STScI)" },
  "record-holders": { file: "record-holders.webp", width: 409, height: 400, alt: "Webb finds most distant known galaxy (JADES-GS-z14-0 annotated pullout NIRCam image)", credit: "NASA, ESA, CSA, STScI, B. Robertson (UC Santa Cruz), B. Johnson (CfA), S. Tacchella (Cambridge), P. Cargile (CfA)" },
};
