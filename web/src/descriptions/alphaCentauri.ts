import type { Description, DescriptionPhoto, DescriptionPoint, DescriptionSource } from './types.ts';

/**
 * Alpha Centauri A and B, the two bright stars of the nearest system (Proxima, the third, is
 * proximaCentauri.ts). Both are catalogue stars made bodies at run time (core/alphaCenBodies.ts),
 * found by their designations; what is drawn of them is read off core/alphaCentauri.ts,
 * core/alphaCenAPlanets.ts and scene/AlphaCentauriOrbits.tsx. The pair shares its photographs,
 * its orbit and most of its sources.
 */

/** The system's too (alphaCentauriSystem.ts), as is HUBBLE_PAIR. */
export const SOUTHERN_CROSS: DescriptionPhoto = {
  file: 'photos/alpha-centauri/southern-cross-film.webp',
  largeFile: 'photos/alpha-centauri/southern-cross-film-large.webp',
  width: 616,
  height: 380,
  title: 'Alpha Centauri and the Southern Cross, on film',
  caption:
    'A 70-minute exposure on Kodak Ektachrome film by ESO’s Claus Madsen. Alpha Centauri is the bright yellowish star at the middle left — A and B together, far too close to split at this scale — one of the two “Pointers” to the Southern Cross, to the right.',
  colour: 'true',
  credit: 'ESO/Claus Madsen',
  licence: 'CC BY 4.0',
  date: '2005-12-21',
  sourceUrl: 'https://www.eso.org/public/images/eso0542a/',
};

/** Proxima's and the system's too (proximaCentauri.ts, alphaCentauriSystem.ts). */
export const SKY_SURVEY: DescriptionPhoto = {
  file: 'photos/alpha-centauri/dss2-sky.webp',
  largeFile: 'photos/alpha-centauri/dss2-sky-large.webp',
  width: 552,
  height: 560,
  title: 'The sky around Alpha Centauri and Proxima',
  caption:
    'Assembled from the photographic plates of the Digitized Sky Survey 2. A and B blaze as one; their blue halo is the plates’ doing, for the pair is pale yellow, like the Sun. Proxima Centauri is the faint red star toward the lower right, about two degrees away.',
  colour: 'true',
  credit: 'Digitized Sky Survey 2; acknowledgement: Davide De Martin/Mahdi Zamani (via ESO)',
  licence: 'CC BY 4.0, as ESO publishes it',
  date: '2016-08-24',
  sourceUrl: 'https://www.eso.org/public/images/eso1629i/',
};

export const HUBBLE_PAIR: DescriptionPhoto = {
  file: 'photos/alpha-centauri/hubble-ab.webp',
  largeFile: 'photos/alpha-centauri/hubble-ab-large.webp',
  width: 640,
  height: 418,
  title: 'A and B from Hubble',
  caption:
    'The two stars as Hubble’s Wide Field and Planetary Camera 2 saw them, through a blue filter (457 nm) and a near-infrared one (850 nm) shown as red — so the colours are not an eye’s. The spikes and rings are the telescope’s own optics.',
  colour: 'false',
  credit: 'ESA/Hubble & NASA',
  licence: 'CC BY 4.0',
  date: '2016-08-29',
  sourceUrl: 'https://esahubble.org/images/potw1635a/',
};

const CHANDRA_PAIR: DescriptionPhoto = {
  file: 'photos/alpha-centauri/chandra-xray-2017.webp',
  largeFile: 'photos/alpha-centauri/chandra-xray-2017-large.webp',
  width: 640,
  height: 632,
  title: 'A and B in X-rays, 2 May 2017',
  caption:
    'Chandra’s High Resolution Camera sees the two stars’ hot outer atmospheres, their coronae, as two sources, X-rays shown in blue. Watched every six months since 2005, A turns out milder in X-rays than the Sun, and B only a little harsher.',
  colour: 'false',
  credit: 'NASA/CXC/University of Colorado/T. Ayres',
  licence: 'Chandra media, no copyright asserted; credit requested',
  date: '2017-05-02',
  sourceUrl: 'https://chandra.harvard.edu/photo/2018/alphacen/',
};

const WEBB_S1: DescriptionPhoto = {
  file: 'photos/alpha-centauri/webb-miri-s1.webp',
  largeFile: 'photos/alpha-centauri/webb-miri-s1-large.webp',
  width: 640,
  height: 229,
  title: 'Webb’s search for a planet around A, August 2024',
  caption:
    'Left, MIRI’s view of the pair at 10 µm; middle, at 15.5 µm with a coronagraph’s mask over A and B still bright above it; right, with the light of both stars modelled and taken away, the point marked S1, the candidate planet, 1.5 arcseconds from A. Mid-infrared light, shown in reds.',
  colour: 'false',
  credit: 'NASA, ESA, CSA, STScI, A. Sanghi (Caltech), C. Beichman (JPL), D. Mawet (Caltech), J. DePasquale (STScI)',
  licence: 'CC BY 4.0',
  date: '2025-08-07',
  sourceUrl: 'https://esawebb.org/images/weic2515c/',
};

/** How both are placed, read off core/alphaCentauri.ts and scene/AlphaCentauriOrbits.tsx. */
const PAIR_DRAWN: readonly DescriptionPoint[] = [
  {
    title: 'Where it is',
    text:
      'On the orbit of the pair, not on a straight line. Every other catalogue star is carried on one position and one velocity; for these two a straight line from Hipparcos’s 1991 measurement would by now have drifted off their orbit by several AU. So both follow Kervella et al.’s orbit of B about A — 79.93 years, eccentricity 0.52 — shared out by their masses about a barycentre that moves on the system’s own measured path through the Galaxy.',
    cite: ['kervella2016', 'kervella2017'],
  },
  {
    title: 'Its distance',
    text:
      'The pair’s one parallax, 747.17 milliarcseconds — 1.3384 parsecs, 4.365 light years — from Kervella et al.’s astrometry of the pair. Gaia gives none for either star, too bright for it, and Hipparcos’s two disagree by 42 milliarcseconds: taken at their word they would put B fourteen thousand AU in front of the star it goes round.',
    cite: ['kervella2016', 'vanleeuwen2007'],
  },
  {
    title: 'The orbits',
    text:
      'A’s and B’s paths about their barycentre are drawn in each star’s colour once they are a few pixels across, fading out when the camera is a dozen of their radii away; Proxima’s, about the pair, is drawn by the same rule.',
  },
];

const PAIR_ORBIT: DescriptionPoint = {
  title: 'The orbit of A and B',
  text:
    'Fitted to the pair’s measured positions, old and new: 79.93 years round, eccentricity 0.52, 17.59 arcseconds across in semi-major axis, tilted 79° to the sky. With the parallax that is 23.6 AU, so the two come within 11.3 AU of each other — a little farther than Saturn from the Sun — and draw apart to 35.8 AU, past Neptune. They were last closest in 1955 and will be again in 2035.',
  cite: ['kervella2016'],
};

const NOT_NEAREST: DescriptionPoint = {
  title: 'It is not the nearest star',
  text:
    'Alpha Centauri is often called the nearest star. The nearest is Proxima, at 4.25 light years; A and B are 4.37 light years away, about 0.12 light years farther.',
  cite: ['gaia2023', 'kervella2016'],
};

const ONE_POINT: DescriptionPoint = {
  title: 'It is not one star',
  text:
    'To the eye it is a single point, the third brightest in the night sky; a small telescope splits it into A and B. Proxima, the third star of the system, is two degrees away and far too faint to see without a telescope.',
  cite: ['esahubble2016'],
};

const COMMON_SOURCES: readonly DescriptionSource[] = [
  {
    key: 'kervella2016',
    text: 'Kervella, P., Mignard, F., Mérand, A., & Thévenin, F. 2016, Close stellar conjunctions of α Centauri A and B until 2050, A&A 594, A107',
    url: 'https://doi.org/10.1051/0004-6361/201629201',
  },
  {
    key: 'kervella2017',
    text: 'Kervella, P., Thévenin, F., & Lovis, C. 2017, Proxima’s orbit around α Centauri, A&A 598, L7',
    url: 'https://doi.org/10.1051/0004-6361/201629930',
  },
  {
    key: 'kervella2017radii',
    text: 'Kervella, P., Bigot, L., Gallenne, A., & Thévenin, F. 2017, The radii and limb darkenings of α Centauri A and B, A&A 597, A137',
    url: 'https://doi.org/10.1051/0004-6361/201629505',
  },
  {
    key: 'vanleeuwen2007',
    text: 'van Leeuwen, F. 2007, Validation of the new Hipparcos reduction, A&A 474, 653',
    url: 'https://doi.org/10.1051/0004-6361:20078357',
  },
  {
    key: 'gaia2023',
    text: 'Gaia Collaboration, Vallenari, A., et al. 2023, Gaia Data Release 3: Summary of the content and survey properties, A&A 674, A1',
    url: 'https://doi.org/10.1051/0004-6361/202243940',
  },
  {
    key: 'esahubble2016',
    text: 'ESA/Hubble 2016, Best image of Alpha Centauri A and B (Picture of the Week potw1635a)',
    url: 'https://esahubble.org/images/potw1635a/',
  },
  {
    key: 'ayres2018',
    text: 'Ayres, T. R. 2018, Alpha Centauri Beyond the Crossroads, Res. Notes AAS 2, 17',
    url: 'https://doi.org/10.3847/2515-5172/aaa88f',
  },
  {
    key: 'chandra2018',
    text: 'Chandra X-ray Center 2018, Alpha Centauri: A Triple Star System about 4 Light Years from Earth',
    url: 'https://chandra.harvard.edu/photo/2018/alphacen/',
  },
  {
    key: 'ballesteros2012',
    text: 'Ballesteros, F. J. 2012, New insights into black bodies, EPL 97, 34008',
    url: 'https://doi.org/10.1209/0295-5075/97/34008',
  },
];

export const ALPHA_CENTAURI_A: Description = {
  id: 'alpha-centauri-a',
  catalogueStar: { designations: ['HIP 71683', 'alf Cen A'] },
  lead: [
    'Low in the southern sky, beside the Southern Cross, shines what looks like a single star, the third brightest of the night. It is the nearest system of stars to our own, and its brighter member, Alpha Centauri A, is the closest thing to a twin of the Sun that is known: the same kind of star, a little heavier and a little wider. From a planet there, our Sun would be one more bright star in the sky, in the constellation Cassiopeia.',
    'Alpha Centauri A, whose proper name Rigil Kentaurus means “the foot of the centaur”, is a yellow-white star of spectral type G2, the Sun’s own type: 1.1 times the Sun’s mass and 1.22 times its width, 4.37 light years away. Its light left it four years and four months before it reaches us.',
    'It is not alone. Its partner, Alpha Centauri B, a smaller and cooler orange star, and A go round each other once every 80 years on a stretched orbit, coming as close as 11 times the Earth–Sun distance and drawing apart to 36 — from Saturn’s distance to beyond Neptune’s, if A stood where the Sun is. They were last closest in 1955 and will be again in 2035. Far beyond them, about 13,000 times the Earth–Sun distance out, the red dwarf Proxima Centauri goes round the pair in some 550,000 years; it is slightly nearer to us, and so it, not A, is the nearest star.',
    'In August 2024 the James Webb Space Telescope, its coronagraph blocking A’s glare, caught a faint point of light about 2 AU from the star in projection — inside the zone where a planet could keep water liquid. It may be a gas giant about the mass of Saturn. When Webb looked again in February and April 2025 it was not there: perhaps hidden close to the star by then, perhaps never a planet. It is a candidate, and if it is real, the nearest giant planet to us outside the Solar System.',
  ],
  photos: [SOUTHERN_CROSS, SKY_SURVEY, HUBBLE_PAIR, CHANDRA_PAIR, WEBB_S1],
  drawnHere: [
    ...PAIR_DRAWN,
    {
      title: 'Its candidate planet',
      text:
        'S1 is drawn grey and named a candidate. It is drawn at 100 Earth masses — the mass the paper’s own radial-velocity comparison assumes — on one of the orbits the paper fitted: the most populous family of four that all fit, retrograde against the pair’s orbit, 1.67 AU across in semi-major axis with eccentricity 0.36, the one nearest that family’s medians. Which side of the sky’s plane it is on, an image cannot say, so its depth is a convention.',
      cite: ['beichman2025'],
    },
  ],
  measured: [
    {
      title: 'Size',
      text:
        'Radius 1.2234 ± 0.0053 times the Sun’s, 851,000 km: measured by ESO’s Very Large Telescope Interferometer, which resolves the star’s disc, and its limb darkening with it, in the near infrared.',
      cite: ['kervella2017radii'],
    },
    {
      title: 'Mass',
      text: '1.1055 times the Sun’s, weighed by the pair’s orbit: its period and its size on the sky, with the parallax, give the two masses.',
      cite: ['kervella2016'],
    },
    PAIR_ORBIT,
    {
      title: 'Its kind',
      text: 'A G2 star like the Sun, still burning hydrogen in its core; B is a K1, smaller and cooler.',
      cite: ['esahubble2016'],
    },
    {
      title: 'Its X-rays',
      text:
        'Chandra has looked at the pair every six months since 2005. By its X-rays A is a gentler star than the Sun for any planet of its own, and B only slightly harsher — unlike Proxima, which floods its planets with them.',
      cite: ['ayres2018', 'chandra2018'],
    },
    {
      title: 'The candidate S1',
      text:
        'One point of light, seen by Webb’s MIRI coronagraph at 15.5 µm on 10 August 2024, 1.5 arcseconds from A, about 2 AU in projection; 3.5 ± 1.0 millijanskys bright. Not seen again in February or April 2025.',
      cite: ['beichman2025', 'esawebb2025'],
    },
  ],
  estimated: [
    {
      title: 'What S1 would be',
      text:
        'From its brightness and models of how a giant planet of A’s age glows: 90 to 150 Earth masses, a Saturn or so, and 1 to 1.1 times Jupiter’s width. Radial-velocity searches allow less than about 100 Earth masses within 2 AU. Its orbit is not known: four families of orbits fit the one sighting and keep the planet stable beside B.',
      cite: ['beichman2025'],
    },
  ],
  missing: [
    {
      title: 'Whether S1 is a planet',
      text:
        'Seen once, at one angle of the telescope, and not since. The authors find it is neither a star far behind nor something in front, but one sighting cannot confirm a planet. It may be the same object as C1, a source the VLT’s NEAR instrument glimpsed near A in 2019.',
      cite: ['beichman2025', 'esawebb2025', 'wagner2021'],
    },
    {
      title: 'Its surface',
      text: 'Not mapped: its granulation and any spots are far too small to resolve, and the disc is drawn plain, darker only toward its edge.',
    },
  ],
  misconceptions: [
    NOT_NEAREST,
    ONE_POINT,
    {
      title: 'S1 is not a found planet',
      text: 'It is reported as a planet found around our nearest Sun-like star. It is a candidate, seen once; the paper itself calls it one.',
      cite: ['beichman2025'],
    },
  ],
  sources: [
    ...COMMON_SOURCES,
    {
      key: 'beichman2025',
      text: 'Beichman, C., Sanghi, A., et al. 2025, Worlds Next Door: A Candidate Giant Planet Imaged in the Habitable Zone of α Centauri A. I. Observations, Orbital and Physical Properties, and Exozodi Upper Limits, ApJL 989, L22',
      url: 'https://doi.org/10.3847/2041-8213/adf53f',
    },
    {
      key: 'esawebb2025',
      text: 'ESA/Webb 2025, Webb finds evidence for a planet around the closest solar twin (release weic2515)',
      url: 'https://esawebb.org/news/weic2515/',
    },
    {
      key: 'wagner2021',
      text: 'Wagner, K., Boehle, A., et al. 2021, Imaging low-mass planets within the habitable zone of α Centauri, Nat. Commun. 12, 922',
      url: 'https://doi.org/10.1038/s41467-021-21176-6',
    },
  ],
};

export const ALPHA_CENTAURI_B: Description = {
  id: 'alpha-centauri-b',
  catalogueStar: { designations: ['HIP 71681', 'alf Cen B'] },
  lead: [
    'The second sun of the nearest system of stars. Alpha Centauri B and its brighter partner, A, circle each other once a lifetime, every 80 years; from a planet of either, the other would be no ordinary star but a second, smaller sun, always far brighter than our full Moon. Whether any such planet exists is still not known — and around B, one has already been found and lost.',
    'B, named Toliman, is an orange star of spectral type K1: a little smaller, cooler and fainter than the Sun, 0.94 times its mass and 0.86 times its width, 4.37 light years away. To the eye it merges with A into one bright point beside the Southern Cross; a small telescope splits them.',
    'The two go round each other on a stretched orbit, as close as 11 times the Earth–Sun distance and as far apart as 36; they were last closest in 1955 and will be again in 2035. Far out, about 13,000 times the Earth–Sun distance away, the red dwarf Proxima Centauri circles the pair in some 550,000 years, and is a little nearer to us than either.',
    'In 2012 astronomers announced an Earth-mass planet around B, on a 3.2-day orbit — the nearest planet beyond the Solar System, for a time. Three years later a closer look at the data showed the signal was most likely an echo of when the star had been observed, not a planet. B has no planet known today.',
  ],
  photos: [SOUTHERN_CROSS, SKY_SURVEY, HUBBLE_PAIR, CHANDRA_PAIR],
  drawnHere: PAIR_DRAWN,
  measured: [
    {
      title: 'Size',
      text: 'Radius 0.8632 ± 0.0037 times the Sun’s, 600,500 km, measured by ESO’s Very Large Telescope Interferometer, which resolves its disc.',
      cite: ['kervella2017radii'],
    },
    {
      title: 'Mass',
      text: '0.9373 times the Sun’s, weighed by the pair’s orbit with the parallax.',
      cite: ['kervella2016'],
    },
    PAIR_ORBIT,
    {
      title: 'Its kind',
      text: 'A K1 star, cooler and smaller than the Sun, beside A, a G2 like the Sun.',
      cite: ['esahubble2016'],
    },
    {
      title: 'Its X-rays',
      text: 'Followed by Chandra every six months since 2005: for a planet of its own, B is only slightly harsher in X-rays than the Sun is for Earth, and A gentler.',
      cite: ['ayres2018', 'chandra2018'],
    },
  ],
  estimated: [],
  missing: [
    {
      title: 'Its planets, if any',
      text: 'None is known, and none is drawn. The one announced in 2012 did not survive a second look at the data.',
      cite: ['dumusque2012', 'rajpaul2016'],
    },
    {
      title: 'Its surface',
      text: 'Not mapped: drawn as a plain disc, darker only toward its edge.',
    },
  ],
  misconceptions: [
    NOT_NEAREST,
    ONE_POINT,
    {
      title: 'Alpha Centauri Bb is not a planet',
      text:
        'The Earth-mass planet announced around B in 2012 is still cited as one. Reanalysed in 2015, its signal turned out to be most likely a ghost of how the observations were spaced in time; it is not counted among known planets.',
      cite: ['dumusque2012', 'rajpaul2016'],
    },
  ],
  sources: [
    ...COMMON_SOURCES,
    {
      key: 'dumusque2012',
      text: 'Dumusque, X., Pepe, F., et al. 2012, An Earth-mass planet orbiting α Centauri B, Nature 491, 207',
      url: 'https://doi.org/10.1038/nature11572',
    },
    {
      key: 'rajpaul2016',
      text: 'Rajpaul, V., Aigrain, S., & Roberts, S. 2016, Ghost in the time series: no planet for Alpha Cen B, MNRAS 456, L6',
      url: 'https://doi.org/10.1093/mnrasl/slv164',
    },
  ],
};
