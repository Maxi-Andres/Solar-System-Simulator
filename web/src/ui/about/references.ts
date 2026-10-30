/**
 * The About panel's reference list: every paper, catalogue and service the simulator's
 * numbers come from, grouped by topic and numbered in this order. The text cites them by
 * key (`<Cite k="chenKipping2017" />`), which renders the number and jumps here.
 *
 * **Identifiers are only those already in this repository** -- the arXiv numbers and
 * DOIs in the code's own comments, the ADS bibcodes the Exoplanet Archive's reference
 * links carry (tools/src/exoplanets/__fixtures__), the URLs in README.md and
 * web/public/textures/CREDITS.md. A reference with no such identifier is given by
 * author, year and journal and no link, rather than with one guessed.
 */

export interface Reference {
  readonly key: string;
  /** Authors and year, or the body that publishes it. */
  readonly who: string;
  readonly title?: string;
  /** Journal, volume and page; or publisher. */
  readonly where?: string;
  readonly link?: string;
  /** What it is used for here, in a few words. */
  readonly use: string;
}

export interface ReferenceGroup {
  readonly id: string;
  readonly label: string;
  readonly refs: readonly Reference[];
}

const ads = (bibcode: string) => `https://ui.adsabs.harvard.edu/abs/${bibcode}/abstract`;
const arxiv = (id: string) => `https://arxiv.org/abs/${id}`;

export const REFERENCE_GROUPS: readonly ReferenceGroup[] = [
  {
    id: 'ephemerides',
    label: 'Ephemerides, orbits and rotation',
    refs: [
      {
        key: 'horizons',
        who: 'NASA/JPL-Caltech, Solar System Dynamics Group',
        title: 'JPL Horizons System (DE441)',
        link: 'https://ssd.jpl.nasa.gov/horizons/',
        use: 'positions and velocities of the planets, moons, named small bodies and spacecraft',
      },
      {
        key: 'sbdb',
        who: 'NASA/JPL-Caltech, Solar System Dynamics Group',
        title: 'JPL Small-Body Database and its Query API',
        link: 'https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html',
        use: 'asteroid and comet orbits; sizes, masses and spins of the named small bodies',
      },
      {
        key: 'marsMaps',
        who: 'NASA/JPL-Caltech',
        title: 'Mars mission maps (MMGIS)',
        link: 'https://science.nasa.gov/mission/msl-curiosity/location-map/',
        use: 'where Curiosity and Perseverance ended each drive, and their heading',
      },
      {
        key: 'archinal2018',
        who: 'Archinal et al. 2018',
        title: 'Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015',
        where: 'Celest. Mech. Dyn. Astr. 130, 22',
        use: 'radii, flattening, poles and prime meridians',
      },
      {
        key: 'conway1986',
        who: 'Conway 1986',
        where: 'Celest. Mech. 39, 199',
        use: 'Laguerre’s iteration for Kepler’s equation, as the comets solve it',
      },
      {
        key: 'meeus1998',
        who: 'Meeus 1998',
        title: 'Astronomical Algorithms, 2nd ed.',
        where: 'Willmann-Bell',
        use: 'the IAU 1980 nutation series (table 22.A) and Delaunay arguments',
      },
      {
        key: 'lieske1977',
        who: 'Lieske et al. 1977',
        where: 'A&A 58, 1',
        use: 'IAU 1976 precession, from satellite elements’ frame to J2000',
      },
    ],
  },
  {
    id: 'satellites',
    label: 'Earth satellites',
    refs: [
      {
        key: 'celestrak',
        who: 'CelesTrak (Dr. T.S. Kelso)',
        title: 'GP element sets and SATCAT',
        link: 'https://celestrak.org/NORAD/elements/',
        use: 'SGP4 elements of the Earth satellites, from the US Space Force’s 18th Space Defense Squadron via Space-Track.org',
      },
      {
        key: 'vallado2006',
        who: 'Vallado, Crawford, Hujsak & Kelso 2006',
        title: 'Revisiting Spacetrack Report #3',
        where: 'AIAA 2006-6753',
        use: 'SGP4, the model the element sets are fitted in, and the TEME frame',
      },
      {
        key: 'satellitejs',
        who: 'satellite.js',
        title: 'SGP4 in JavaScript (MIT licence)',
        link: 'https://github.com/shashwatak/satellite-js',
        use: 'running SGP4 for the named satellites',
      },
    ],
  },
  {
    id: 'stars',
    label: 'Stars',
    refs: [
      {
        key: 'hipparcos',
        who: 'ESA 1997',
        title: 'The Hipparcos and Tycho Catalogues',
        where: 'ESA SP-1200',
        link: 'https://vizier.cds.unistra.fr/viz-bin/VizieR-3?-source=I/239/hip_main',
        use: 'the bright sky: positions, proper motions, V and B−V',
      },
      {
        key: 'hog2000',
        who: 'Høg et al. 2000',
        title: 'The Tycho-2 catalogue of the 2.5 million brightest stars',
        where: 'A&A 355, L27',
        link: 'https://vizier.cds.unistra.fr/viz-bin/VizieR-3?-source=I/259/tyc2',
        use: 'the faint stars Hipparcos never completed',
      },
      {
        key: 'vanLeeuwen2007',
        who: 'van Leeuwen 2007',
        title: 'Validation of the new Hipparcos reduction',
        where: 'A&A 474, 653',
        link: 'https://vizier.cds.unistra.fr/viz-bin/VizieR-3?-source=I/311/hip2',
        use: 'parallaxes of the bright stars Gaia saturates on',
      },
      {
        key: 'gaiaDr3',
        who: 'Gaia Collaboration, Vallenari et al. 2023',
        title: 'Gaia Data Release 3: Summary of the content and survey properties',
        where: 'A&A 674, A1',
        link: 'https://www.cosmos.esa.int/web/gaia/dr3',
        use: 'parallaxes and radial velocities of the 3D stars',
      },
      {
        key: 'gcns',
        who: 'Gaia Collaboration, Smart et al. 2021',
        title: 'Gaia Early Data Release 3: The Gaia Catalogue of Nearby Stars',
        where: 'A&A 649, A6',
        link: 'https://vizier.cds.unistra.fr/viz-bin/VizieR-3?-source=J/A%2BA/649/A6',
        use: 'the census of every star within 100 parsecs',
      },
      {
        key: 'gontcharov2006',
        who: 'Gontcharov 2006',
        title: 'Pulkovo Compilation of Radial Velocities for 35 495 Hipparcos stars in a common system',
        where: 'Astron. Lett. 32, 759',
        use: 'radial velocities where Gaia has none',
      },
      {
        key: 'pecautMamajek2013',
        who: 'Pecaut & Mamajek 2013; Mamajek’s Modern Mean Dwarf Stellar Color and Effective Temperature Sequence (2022.04.16)',
        where: 'ApJS 208, 9',
        link: arxiv('1307.2657'),
        use: 'Gaia colours turned into Johnson V and B−V; the colours of the hot stars at the Galactic Centre',
      },
      {
        key: 'willmer2018',
        who: 'Willmer 2018',
        title: 'The Absolute Magnitude of the Sun in Several Filters',
        where: 'ApJS 236, 47',
        use: 'the Sun’s absolute magnitude, 4.81',
      },
      {
        key: 'vizier',
        who: 'Ochsenbein, Bauer & Marcout 2000',
        title: 'The VizieR database of astronomical catalogues (CDS, Strasbourg)',
        where: 'A&AS 143, 23',
        use: 'the service the catalogues are read through',
      },
      {
        key: 'simbad',
        who: 'Wenger et al. 2000',
        title: 'The SIMBAD astronomical database (CDS, Strasbourg)',
        where: 'A&AS 143, 9',
        link: 'https://simbad.cds.unistra.fr/',
        use: 'names, systems and spectral types of the nearest stars',
      },
      {
        key: 'wgsn',
        who: 'IAU Working Group on Star Names (WGSN)',
        title: 'IAU Catalog of Star Names (CC BY 4.0)',
        link: 'https://exopla.net/star-names/modern-iau-star-names/',
        use: 'proper star names',
      },
      {
        key: 'ybsc',
        who: 'Hoffleit & Warren 1991',
        title: 'The Bright Star Catalogue (Yale), CDS V/50',
        link: 'https://cdsarc.cds.unistra.fr/viz-bin/cat/V/50',
        use: 'Bayer and Flamsteed designations',
      },
      {
        key: 'teixeira2009',
        who: 'Teixeira et al. 2009',
        where: 'A&A 494, 237',
        use: 'Tau Ceti’s radius, 0.793 R☉, and mass',
      },
      {
        key: 'bainesArmstrong2012',
        who: 'Baines & Armstrong 2012',
        where: 'ApJ 744, 138',
        use: 'Epsilon Eridani’s radius, 0.74 R☉',
      },
      {
        key: 'boyajian2012',
        who: 'Boyajian et al. 2012',
        where: 'ApJ 757, 112',
        use: 'Barnard’s Star’s radius, 0.1869 R☉',
      },
      {
        key: 'boyajian2013',
        who: 'Boyajian et al. 2013',
        where: 'ApJ 771, 40',
        use: '51 Pegasi’s radius, 1.15 R☉',
      },
    ],
  },
  {
    id: 'alphaCen',
    label: 'Alpha Centauri',
    refs: [
      {
        key: 'kervella2016',
        who: 'Kervella et al. 2016',
        where: 'A&A 594, A107',
        use: 'the orbit of A and B, and their parallax',
      },
      {
        key: 'kervellaTL2017',
        who: 'Kervella, Thévenin & Lovis 2017',
        title: 'Proxima’s orbit around α Centauri',
        where: 'A&A 598, L7',
        use: 'the barycentre’s position and motion; Proxima’s velocity about it',
      },
      {
        key: 'kervella2017',
        who: 'Kervella et al. 2017',
        where: 'A&A 597, A137',
        use: 'A’s and B’s interferometric radii',
      },
    ],
  },
  {
    id: 'exoplanets',
    label: 'Planets of other stars',
    refs: [
      {
        key: 'nea',
        who: 'NASA Exoplanet Archive',
        title: 'Planetary Systems Composite Parameters (pscomppars)',
        where: 'DOI 10.26133/NEA13',
        link: 'https://doi.org/10.26133/NEA13',
        use: 'every confirmed planet, its orbit, mass and radius, and its host',
      },
      {
        key: 'chenKipping2017',
        who: 'Chen & Kipping 2017',
        title: 'Probabilistic Forecasting of the Masses and Radii of Other Worlds',
        where: 'ApJ 834, 17',
        use: 'a planet’s radius estimated from its mass',
      },
      {
        key: 'angladaEscude2016',
        who: 'Anglada-Escudé et al. 2016',
        title: 'A terrestrial planet candidate in a temperate orbit around Proxima Centauri',
        where: 'Nature 536, 437',
        link: ads('2016Natur.536..437A'),
        use: 'Proxima b',
      },
      {
        key: 'damasso2020',
        who: 'Damasso et al. 2020',
        where: 'Sci. Adv. 6, eaax7467',
        link: ads('2020SciA....6.7467D'),
        use: 'Proxima b’s conjunction; the candidate Proxima c',
      },
      {
        key: 'faria2022',
        who: 'Faria et al. 2022',
        where: 'A&A 658, A115',
        link: ads('2022A&A...658A.115F'),
        use: 'Proxima b’s distance and mass; Proxima d',
      },
      {
        key: 'suarezMascareno2025',
        who: 'Suárez Mascareño et al. 2025',
        where: 'A&A 700, A11',
        link: ads('2025A&A...700A..11M'),
        use: 'Proxima d confirmed',
      },
      {
        key: 'feng2017',
        who: 'Feng et al. 2017',
        where: 'AJ 154, 135',
        link: ads('2017AJ....154..135F'),
        use: 'Tau Ceti’s four signals',
      },
      {
        key: 'thompson2025',
        who: 'Thompson et al. 2025',
        where: 'AJ 170, 301',
        link: arxiv('2502.20561'),
        use: 'Epsilon Eridani b, its orbit oriented on the sky',
      },
      {
        key: 'harada2025',
        who: 'Harada et al. 2025',
        where: 'AJ 170, 343',
        link: ads('2025AJ....170..343H'),
        use: 'Epsilon Eridani b’s conjunction',
      },
      {
        key: 'basant2025',
        who: 'Basant et al. 2025',
        where: 'ApJL 982, L1',
        link: arxiv('2503.08095'),
        use: 'Barnard’s Star’s four planets',
      },
      {
        key: 'gonzalezHernandez2024',
        who: 'González Hernández et al. 2024',
        where: 'A&A 690, A79',
        use: 'Barnard’s Star b, first found',
      },
      {
        key: 'mayorQueloz1995',
        who: 'Mayor & Queloz 1995',
        title: 'A Jupiter-mass companion to a solar-type star',
        where: 'Nature 378, 355',
        link: ads('1995Natur.378..355M'),
        use: '51 Pegasi b',
      },
      {
        key: 'cont2026',
        who: 'Cont et al. 2026',
        where: 'A&A 710, A345',
        link: ads('2026A&A...710A.345C'),
        use: '51 Pegasi b’s tilt, 49.8°, from its own light',
      },
    ],
  },
  {
    id: 'blackHoles',
    label: 'Black holes and the Galactic Centre',
    refs: [
      {
        key: 'gravity2024',
        who: 'GRAVITY Collaboration 2024',
        where: 'A&A 692, A242',
        link: arxiv('2409.12261'),
        use: 'Sgr A*’s mass and distance; the orbits of S2, S29, S38 and S55',
      },
      {
        key: 'gordon2023',
        who: 'Gordon et al. 2023',
        where: 'AJ 165, 49',
        link: arxiv('2212.00632'),
        use: 'Sgr A*’s position and motion on the sky (ICRF3)',
      },
      {
        key: 'schoenrich2010',
        who: 'Schönrich, Binney & Dehnen 2010',
        title: 'Local kinematics and the local standard of rest',
        where: 'MNRAS 403, 1829',
        use: 'the Sun’s 11.1 km/s toward the centre',
      },
      {
        key: 'habibi2017',
        who: 'Habibi et al. 2017',
        where: 'ApJ 847, 120',
        link: arxiv('1708.06353'),
        use: 'S2’s temperature, radius and mass; seven more S-stars’ temperatures',
      },
      {
        key: 'elBadry2023',
        who: 'El-Badry et al. 2023',
        title: 'A Sun-like star orbiting a black hole',
        where: 'MNRAS 518, 1057',
        link: arxiv('2209.06833'),
        use: 'Gaia BH1 and its star',
      },
      {
        key: 'panuzzo2024',
        who: 'Gaia Collaboration, Panuzzo et al. 2024',
        title: 'Discovery of a dormant 33 solar-mass black hole in pre-release Gaia astrometry',
        where: 'A&A 686, L2',
        link: arxiv('2404.10486'),
        use: 'Gaia BH3 and the giant LS II +14 13',
      },
      {
        key: 'millerJones2021',
        who: 'Miller-Jones et al. 2021',
        title: 'Cygnus X-1 contains a 21-solar mass black hole — implications for massive star winds',
        where: 'Science 371, 1046',
        link: arxiv('2102.09091'),
        use: 'Cygnus X-1: the masses, the orbit, the supergiant, the distance and the motion on the sky',
      },
      {
        key: 'brocksopp1999',
        who: 'Brocksopp et al. 1999',
        title: 'An improved orbital ephemeris for Cygnus X-1',
        where: 'MNRAS 309, 1063',
        link: arxiv('astro-ph/9812077'),
        use: 'Cygnus X-1’s period',
      },
      {
        key: 'gies2003',
        who: 'Gies et al. 2003',
        title: 'Wind accretion and state transitions in Cygnus X-1',
        where: 'ApJ 583, 424',
        link: arxiv('astro-ph/0206253'),
        use: 'when Cygnus X-1’s star passes in front of the hole, and the system’s velocity',
      },
      {
        key: 'zhao2021',
        who: 'Zhao et al. 2021',
        title: 'Re-estimating the spin parameter of the black hole in Cygnus X-1',
        where: 'ApJ 908, 117',
        link: arxiv('2102.09093'),
        use: 'Cygnus X-1’s spin (not drawn)',
      },
      {
        key: 'eht2022',
        who: 'Event Horizon Telescope Collaboration 2022',
        title: 'First Sagittarius A* Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole in the Center of the Milky Way',
        where: 'ApJL 930, L12',
        link: arxiv('2311.08680'),
        use: 'Sgr A*’s ring, 51.8 ± 2.3 µas, against the shadow drawn',
      },
      {
        key: 'darwin1959',
        who: 'Darwin 1959',
        where: 'Proc. R. Soc. A 249, 180',
        use: 'light bent near the shadow’s edge (strong field)',
      },
      {
        key: 'bozza2002',
        who: 'Bozza 2002',
        where: 'Phys. Rev. D 66, 103001',
        use: 'the strong-field limit the deflection is tested against',
      },
      {
        key: 'keetonPetters2005',
        who: 'Keeton & Petters 2005',
        where: 'Phys. Rev. D 72, 104006',
        use: 'the weak-field series the deflection is tested against',
      },
      {
        key: 'synge1966',
        who: 'Synge 1966',
        where: 'MNRAS 131, 463',
        use: 'the shadow’s size seen from a camera at a finite distance',
      },
      {
        key: 'perlick2004',
        who: 'Perlick 2004',
        title: 'Gravitational lensing from a spacetime perspective',
        where: 'Living Rev. Relativ. 7, 9',
        use: 'lensing for an observer at a finite distance',
      },
      {
        key: 'carlson1995',
        who: 'Carlson 1995',
        where: 'Numerical Algorithms 10, 13',
        use: 'the elliptic integrals the deflection is solved with',
      },
      {
        key: 'paczynski1986',
        who: 'Paczyński 1986',
        where: 'ApJ 304, 1',
        use: 'the brightness of a star’s two images',
      },
      {
        key: 'genzel2010',
        who: 'Genzel, Eisenhauer & Gillessen 2010',
        where: 'Rev. Mod. Phys. 82, 3121',
        use: 'the dust in front of the Galactic Centre, about 30 magnitudes in V',
      },
      {
        key: 'eht2019',
        who: 'Event Horizon Telescope Collaboration 2019',
        title: 'First M87 Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole',
        where: 'ApJL 875, L1',
        use: 'M87*’s mass and distance',
      },
    ],
  },
  {
    id: 'galacticCentre',
    label: 'The Galactic Centre’s stars',
    refs: [
      {
        key: 'gillessen2017',
        who: 'Gillessen et al. 2017',
        title: 'An Update on Monitoring Stellar Orbits in the Galactic Center',
        where: 'ApJ 837, 30',
        link: arxiv('1611.09144'),
        use: 'the orbits, K magnitudes and types of the S-stars (Table 3)',
      },
      {
        key: 'paumard2006',
        who: 'Paumard et al. 2006',
        title: 'The Two Young Star Disks in the Central Parsec of the Galaxy',
        where: 'ApJ 643, 1011',
        link: arxiv('astro-ph/0601268'),
        use: 'the young stars’ places, K magnitudes and types (Table 2), and their density',
      },
      {
        key: 'reid2003',
        who: 'Reid et al. 2003',
        title: 'Accurate Positions and Proper Motions of Stellar SiO Masers near the Galactic Center',
        where: 'ApJ 587, 208',
        link: arxiv('astro-ph/0212273'),
        use: 'where IRS 7 is',
      },
      {
        key: 'paumard2014',
        who: 'Paumard et al. 2014',
        title: 'GCIRS 7, a pulsating M1 supergiant at the Galactic centre',
        where: 'A&A 568, A85',
        link: arxiv('1406.5320'),
        use: 'IRS 7’s brightness, extinction and temperature',
      },
      {
        key: 'fritz2011',
        who: 'Fritz et al. 2011',
        title: 'Line derived infrared extinction towards the Galactic Center',
        where: 'ApJ 737, 73',
        link: arxiv('1105.2822'),
        use: 'the extinction in K toward Sgr A* and the central parsec, and in V',
      },
      {
        key: 'schoedel2010',
        who: 'Schödel et al. 2010',
        title: 'Peering through the veil: near-infrared photometry and extinction for the Galactic nuclear star cluster',
        where: 'A&A 511, A18',
        link: arxiv('0912.1273'),
        use: 'the cluster’s K luminosity function and red clump, held against the model',
      },
      {
        key: 'schoedel2014',
        who: 'Schödel et al. 2014',
        title: 'Surface Brightness Profile of the Milky Way’s Nuclear Star Cluster',
        where: 'A&A 566, A47',
        link: arxiv('1403.6657'),
        use: 'the cluster’s mass, 25 million Suns, and flattening, 0.71',
      },
      {
        key: 'schoedel2018',
        who: 'Schödel et al. 2018',
        title: 'The distribution of stars around the Milky Way’s central black hole II: Diffuse light',
        where: 'A&A 609, A27',
        link: arxiv('1701.03817'),
        use: 'the cluster’s density law and the mass inside each radius',
      },
      {
        key: 'gallegoCano2018',
        who: 'Gallego-Cano et al. 2018',
        title: 'The distribution of old stars around the Milky Way’s central black hole I: Star counts',
        where: 'A&A 609, A26',
        link: arxiv('1701.03816'),
        use: 'the cluster’s K luminosity function, held against the model',
      },
      {
        key: 'schoedel2020',
        who: 'Schödel et al. 2020',
        title: 'The Milky Way’s nuclear star cluster: Old, metal-rich, and cuspy',
        where: 'A&A 641, A102',
        link: arxiv('2007.15950'),
        use: 'the cluster’s ages and metallicity',
      },
      {
        key: 'bressan2012',
        who: 'Bressan et al. 2012',
        title: 'PARSEC stellar isochrones, through the CMD 3.9 service',
        where: 'MNRAS 427, 127',
        link: 'https://stev.oapd.inaf.it/cgi-bin/cmd',
        use: 'the brightness and colour of the cluster’s stars at their ages',
      },
      {
        key: 'kroupa2001',
        who: 'Kroupa 2001',
        title: 'On the variation of the initial mass function',
        where: 'MNRAS 322, 231',
        use: 'how many stars are born at each mass (the IMF the isochrones are populated with)',
      },
    ],
  },
  {
    id: 'pulsars',
    label: 'Pulsars and magnetars',
    refs: [
      {
        key: 'atnf',
        who: 'Manchester, Hobbs, Teoh & Hobbs 2005',
        title: 'The ATNF Pulsar Catalogue',
        where: 'AJ 129, 1993',
        link: arxiv('astro-ph/0412641'),
        use: 'every pulsar: where it is, how far, its spin and orbit (version 2.9.0, https://www.atnf.csiro.au/research/pulsar/psrcat)',
      },
      {
        key: 'ymw16',
        who: 'Yao, Manchester & Wang 2017',
        title: 'A new electron-density model for estimation of pulsar and FRB distances',
        where: 'ApJ 835, 29',
        link: arxiv('1610.09448'),
        use: 'most pulsars’ distances, from their dispersion measures',
      },
      {
        key: 'mcgill',
        who: 'Olausen & Kaspi 2014',
        title: 'The McGill Magnetar Catalog',
        where: 'ApJS 212, 6',
        link: arxiv('1309.4167'),
        use: 'the magnetars and their distances (http://www.physics.mcgill.ca/~pulsar/magnetar/main.html)',
      },
      {
        key: 'fermi3pc',
        who: 'Smith et al. 2023',
        title: 'The Third Fermi Large Area Telescope Catalog of Gamma-ray Pulsars',
        where: 'ApJ 958, 191',
        link: arxiv('2307.11132'),
        use: 'where YMW16 gives its ceiling and not a distance',
      },
      {
        key: 'riley2019',
        who: 'Riley et al. 2019',
        title: 'A NICER view of PSR J0030+0451: millisecond pulsar parameter estimation',
        where: 'ApJL 887, L21',
        link: arxiv('1912.05702'),
        use: 'PSR J0030+0451’s radius and mass',
      },
      {
        key: 'riley2021',
        who: 'Riley et al. 2021',
        title: 'A NICER view of the massive pulsar PSR J0740+6620 informed by radio timing and XMM-Newton spectroscopy',
        where: 'ApJL 918, L27',
        link: arxiv('2105.06980'),
        use: 'PSR J0740+6620’s radius and mass',
      },
      {
        key: 'choudhury2024',
        who: 'Choudhury et al. 2024',
        title: 'A NICER view of the nearest and brightest millisecond pulsar: PSR J0437–4715',
        where: 'ApJL 971, L20',
        link: arxiv('2407.06789'),
        use: 'PSR J0437−4715’s radius and mass',
      },
      {
        key: 'lorimerKramer2005',
        who: 'Lorimer & Kramer 2005',
        title: 'Handbook of Pulsar Astronomy',
        where: 'Cambridge University Press',
        use: 'the dipole field and characteristic age a spin-down gives',
      },
    ],
  },
  {
    id: 'galaxy',
    label: 'The Milky Way',
    refs: [
      {
        key: 'reid2019',
        who: 'Reid et al. 2019',
        title: 'Trigonometric Parallaxes of High-mass Star Forming Regions: Our View of the Milky Way',
        where: 'ApJ 885, 131',
        use: 'the spiral arms (Table 2) and the centre at 8.15 kpc',
      },
      {
        key: 'blandHawthorn2016',
        who: 'Bland-Hawthorn & Gerhard 2016',
        title: 'The Galaxy in Context: Structural, Kinematic & Integrated Properties',
        where: 'ARA&A 54, 529',
        use: 'the discs, the bulge, the bar and the Sun’s height above the plane',
      },
      {
        key: 'drimmelSpergel2001',
        who: 'Drimmel & Spergel 2001',
        title:
          'Three-dimensional Structure of the Milky Way Disk: The Distribution of Stars and Dust beyond 0.35 R☉',
        where: 'ApJ 556, 181',
        use: 'the dust disc (Table 1), fitted to COBE’s far-infrared sky',
      },
      {
        key: 'osterbrockFerland2006',
        who: 'Osterbrock & Ferland 2006',
        title: 'Astrophysics of Gaseous Nebulae and Active Galactic Nuclei, 2nd ed.',
        where: 'University Science Books',
        use: 'the Balmer decrement, 2.86',
      },
    ],
  },
  {
    id: 'light',
    label: 'Light, colour and atmosphere',
    refs: [
      {
        key: 'ballesteros2012',
        who: 'Ballesteros 2012',
        title: 'New insights into black bodies',
        where: 'EPL 97, 34008',
        use: 'temperature from B−V',
      },
      {
        key: 'wyman2013',
        who: 'Wyman, Sloan & Shirley 2013',
        title: 'Simple Analytic Approximations to the CIE XYZ Color Matching Functions',
        where: 'J. Computer Graphics Techniques 2(2)',
        use: 'the CIE 1931 observer, as fitted curves',
      },
      {
        key: 'cie135',
        who: 'CIE 135/1-1999 (Vos & van den Berg)',
        title: 'Disability glare',
        use: 'the Sun’s glare',
      },
      {
        key: 'peckReeder1972',
        who: 'Peck & Reeder 1972',
        title: 'Dispersion of Air',
        where: 'J. Opt. Soc. Am. 62, 958',
        use: 'the refractive index of air, for Rayleigh scattering',
      },
      {
        key: 'coxMunk1954',
        who: 'Cox & Munk 1954',
        title: 'Measurement of the Roughness of the Sea Surface from Photographs of the Sun’s Glitter',
        where: 'J. Opt. Soc. Am. 44, 838',
        use: 'how rough the ocean is',
      },
    ],
  },
];

/** Every reference, in the order it is numbered. */
export const REFERENCES: readonly Reference[] = REFERENCE_GROUPS.flatMap((group) => group.refs);

const NUMBERS = new Map(REFERENCES.map((reference, index) => [reference.key, index + 1]));

/** A reference's number, from 1; throws on a key nobody listed, so a typo fails the tests. */
export function referenceNumber(key: string): number {
  const number = NUMBERS.get(key);
  if (number === undefined) {
    throw new Error(`No reference "${key}" in the About's list.`);
  }
  return number;
}

/** The DOM id a reference's entry carries in the Sources section. */
export function referenceAnchor(key: string): string {
  return `about-ref-${key}`;
}
