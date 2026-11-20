import { NEARBY_UNIVERSE_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The Nearby Universe: no body, so opened from its breadcrumb level's panel (state/levels.ts,
 * ui/LevelFacts.tsx) -- the mapped galaxies about Laniakea, out to its catalogue's 700 Mpc. Every
 * number here is from the source it cites; where a figure is a model's rather than a
 * measurement, it sits under "estimated" and says which model. What the app draws of it is read
 * off core/laniakea.ts, core/cosmicWeb.ts, scene/scale.ts (NEARBY_UNIVERSE_FRAMING_KM) and
 * scene/homeName.ts.
 */
export const NEARBY_UNIVERSE: Description = {
  id: NEARBY_UNIVERSE_DESCRIPTION_ID,
  subject: { name: 'Nearby Universe', kind: 'the mapped galaxies' },
  lead: [
    'This is where the universe begins to look the same everywhere. Up close it is all lumps — a galaxy here, a cluster there, nothing between; but take any sphere more than about 300 million light years in radius, and it holds about as many galaxies as any other. From here out, the universe is a texture, not a place. And it is old light: from the far edge of this map, it set out 2.2 billion years ago.',
    'Here is the map of the galaxies all round us, in three dimensions: some hundred thousand galaxies, each placed by its measured distance or by its redshift — how much the expansion of the universe has stretched its light. It holds Laniakea, the basin of galaxies we live in, and its neighbours: the Coma Cluster, more than 300 million light years away and thousands of galaxies strong; the Perseus Cluster; the Hercules Cluster; and, 190 megaparsecs off, the Shapley Supercluster, a great concentration of galaxies toward which our own flow may run.',
    'The map has a shape. Galaxies are not scattered: they gather into thin walls and threads with clusters where the threads meet, round voids where hardly any galaxy is — voids typically a fifth as dense as the mean and some two hundred million light years across, found in every survey large enough to hold one. One wall, the Great Wall, found in 1989, runs at least 170 h⁻¹ megaparsecs, with no end in the survey that found it. This web of galaxies is the pattern the ripples in the early universe grew into.',
    'It took two kinds of survey to draw. Redshifts are easy to measure and give a distance only by the expansion; true distances — from how fast a spiral turns, how an elliptical’s light is spread, how bright a supernova gets — are harder and fewer. The two together give where the galaxies are and how they move besides the expansion. Its edge is where the catalogue ends: beyond, the galaxies go on, and the Sloan survey’s deeper wedges show the same web.',
  ],
  photos: [
    {
      file: 'photos/nearby-universe/perseus-euclid.webp',
      largeFile: 'photos/nearby-universe/perseus-euclid-large.webp',
      width: 640,
      height: 640,
      title: 'The Perseus Cluster, from Euclid',
      caption:
        'About 1,000 of the cluster’s galaxies, some 240 million light years away, and more than 100,000 galaxies far behind it, many never seen before. From Euclid’s visible and near-infrared instruments, the bands chosen for the red, green and blue — so not an eye’s colours.',
      colour: 'false',
      credit: 'ESA/Euclid/Euclid Consortium/NASA, image processing by J.-C. Cuillandre (CEA Paris-Saclay), G. Anselmi',
      licence: 'CC BY-SA 3.0 IGO',
      date: '2023-11-07',
      sourceUrl: 'https://www.esa.int/ESA_Multimedia/Images/2023/11/Euclid_s_view_of_the_Perseus_cluster_of_galaxies',
    },
    {
      file: 'photos/nearby-universe/coma-hubble.webp',
      largeFile: 'photos/nearby-universe/coma-hubble-large.webp',
      width: 640,
      height: 454,
      title: 'The Coma Cluster, from Hubble',
      caption:
        'A part of a cluster more than 300 million light years away, nearly round, more than 20 million light years across and thousands of galaxies strong: most of those in its middle are ellipticals, pale golden-brown balls of old stars. Hubble’s filters shown in colour.',
      colour: 'false',
      credit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA). Acknowledgement: D. Carter (Liverpool John Moores University) and the Coma HST ACS Treasury Team',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2008-06-10',
      sourceUrl: 'https://esahubble.org/images/heic0813a/',
    },
    {
      file: 'photos/nearby-universe/arp272-hercules.webp',
      largeFile: 'photos/nearby-universe/arp272-hercules-large.webp',
      width: 640,
      height: 640,
      title: 'Two spirals colliding in the Hercules Cluster',
      caption:
        'Arp 272: the spirals NGC 6050 and IC 1179 running into each other, their arms already linked, in the Hercules Galaxy Cluster. From Hubble; its filters shown in colour.',
      colour: 'false',
      credit: 'NASA, ESA, the Hubble Heritage Team (STScI/AURA)-ESA/Hubble Collaboration, and K. Noll (STScI)',
      licence: 'NASA media, not copyrighted; credit requested',
      date: '2008-04-24',
      sourceUrl: 'https://images.nasa.gov/details/PIA10387',
    },
    {
      file: 'photos/jwst/stephans-quintet-2022.webp',
      largeFile: 'photos/jwst/stephans-quintet-2022-large.webp',
      width: 640,
      height: 614,
      title: 'Stephan’s Quintet, from Webb',
      caption:
        'Four galaxies about 290 million light years away pulling gas, dust and stars out of one another in tails, one of them driving a shock wave through the group; the fifth, on the left, is only about 40 million light years off, in front. Near-infrared shown blue and white, mid-infrared yellow, orange and red.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, and STScI',
      licence: 'CC BY 4.0 (ESA/Webb)',
      date: '2022-07-12',
      sourceUrl: 'https://esawebb.org/images/weic2208a/',
    },
    {
      file: 'photos/laniakea/centaurus-ngc4696.webp',
      largeFile: 'photos/laniakea/centaurus-ngc4696-large.webp',
      width: 640,
      height: 302,
      title: 'NGC 4696, at the heart of the Centaurus Cluster',
      caption:
        'The largest galaxy of the Centaurus Cluster, some 120 million light years away, toward which much of our motion runs, with a dust lane about 30,000 light years across sweeping across its face. Blue and near-infrared filters.',
      colour: 'false',
      credit: 'ESA/Hubble and NASA',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2010-08-12',
      sourceUrl: 'https://esahubble.org/images/heic1013a/',
    },
    {
      file: 'photos/laniakea/great-attractor-field.webp',
      largeFile: 'photos/laniakea/great-attractor-field-large.webp',
      width: 640,
      height: 660,
      title: 'Through the Milky Way, toward the Great Attractor',
      caption:
        'A patch of the Norma Cluster, 220 million light years away, seen through the crowded stars of our own galaxy’s plane — the hardest part of the sky to map galaxies in, and so the map’s thinnest. Blue and near-infrared filters.',
      colour: 'false',
      credit: 'ESA/Hubble & NASA',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2013-01-14',
      sourceUrl: 'https://esahubble.org/images/potw1302a/',
    },
    {
      file: 'photos/nearby-universe/sdss-map.webp',
      largeFile: 'photos/nearby-universe/sdss-map-large.webp',
      width: 640,
      height: 636,
      title: 'The Sloan survey’s map, a slice',
      caption:
        'Not a photograph: a map. Each dot is a galaxy, the Milky Way at the centre, distance outward as redshift to 0.14 — about the reach of this level’s map — in the two wedges of sky the survey covered; the dark between them is sky it did not map. Each dot coloured by the galaxy’s own colour, g − r. The walls, threads and voids are real.',
      colour: 'false',
      credit: 'M. Blanton and the Sloan Digital Sky Survey',
      licence: 'CC BY 4.0',
      date: '2014',
      sourceUrl: 'https://www.sdss4.org/science/orangepie/',
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The breadcrumb’s Nearby Universe puts the camera 1.5 billion light years from the Sun, over the supergalactic pole, turned as Laniakea’s view is: Laniakea, the Perseus, Coma and Hercules Clusters and the Shapley Supercluster with Abell 3558 at its heart, 190 megaparsecs off, all within nine tenths of the frame. From the Observable Universe’s view the whole map is one place, and the names of its clusters, superclusters, voids and walls fold into its own.',
    },
    {
      title: 'Its galaxies',
      text: '86,899 galaxies out to 700 megaparsecs: Cosmicflows-4’s measured distances and the 2MASS Redshift Survey’s redshifts merged, each galaxy at its own distance, its group’s, or — a fifth of them — its redshift’s. Each a point holding all its light, coloured by its colour; the few the camera comes near drawn as volumes, as the Local Volume’s galaxies are.',
      cite: ['tully2023', 'huchra2012'],
    },
    {
      title: 'One instant',
      text: 'Every galaxy is where it is now on the expansion, in Cosmicflows-4’s cosmology — not where it was when the light we see left it. The light from the farthest left 2.2 billion years ago.',
      cite: ['tully2023'],
    },
    {
      title: 'Past the catalogue',
      text: 'The Cosmic Web layers: the Sloan survey’s 1.8 million galaxies in its two wedges of sky, each at its redshift’s distance, and the filaments Tempel et al. and Malavasi et al. traced through them, as threads.',
      cite: ['tempel2014', 'malavasi2020'],
    },
    {
      title: 'Its basins and flow',
      text: 'With Laniakea’s layers: its watershed basins and the flow lines of the velocity field fitted to Cosmicflows-4, our basin and Shapley’s both drawn, since the reconstructions disagree on which we are in.',
      cite: ['dupuy2023', 'valade2024'],
    },
  ],
  measured: [
    {
      title: 'Distances',
      text: 'Cosmicflows-4: distances to 55,877 galaxies in 38,065 groups by eight methods, most from how spirals turn and how ellipticals’ light is spread, with Type Ia supernovae and others; compatible with a Hubble constant of 74.6 ± 0.8 km/s per megaparsec.',
      cite: ['tully2023'],
    },
    {
      title: 'Redshifts',
      text: 'The 2MASS Redshift Survey: 44,599 galaxies brighter than K = 11.75 in the near infrared, 97.6% complete, over 91% of the sky — everything but a band along the Milky Way — within 300 megaparsecs.',
      cite: ['huchra2012'],
    },
    {
      title: 'Walls and voids',
      text: 'Voids with about a fifth of the mean density and diameters of some 5,000 km/s, in every survey large enough to hold them; galaxies in thin sheets, the largest the Great Wall, at least 60 by 170 h⁻¹ megaparsecs.',
      cite: ['geller1989'],
    },
    {
      title: 'Where it becomes smooth',
      text: 'Counted in spheres of radius over 70 to 81 h⁻¹ megaparsecs, depending on redshift, the galaxies grow in number as the volume does: the universe is homogeneous on those scales.',
      cite: ['scrimgeour2012'],
    },
    {
      title: 'Its great clusters',
      text: 'Coma, more than 300 million light years away, more than 20 million across, thousands of galaxies; Perseus, about 240 million light years away, with some 1,000 galaxies in Euclid’s view.',
      cite: ['heic0813', 'esaperseus'],
    },
  ],
  estimated: [
    {
      title: 'Distances from redshift',
      text: 'For galaxies with no distance of their own, the redshift’s by the Hubble law: right on average, but each galaxy’s own motion — hundreds of km/s — moves it along the line of sight by megaparsecs.',
      cite: ['tully2023'],
    },
    {
      title: 'Our basin',
      text: 'One reconstruction of Cosmicflows-4 finds Laniakea a basin of its own; another finds our flow ending at Shapley, and a probabilistic analysis slightly prefers Laniakea being part of Shapley’s much larger basin.',
      cite: ['dupuy2023', 'valade2024'],
    },
    {
      title: 'The Shapley Supercluster',
      text: 'A great concentration of galaxies mapped in 1989 in the direction of the Great Attractor, and far beyond it. Its place in this map is the app’s, from its galaxies.',
      cite: ['raychaudhury1989'],
    },
  ],
  missing: [
    {
      title: 'Behind the Milky Way',
      text: 'The redshift survey leaves out a band of sky within 5° of the Milky Way’s plane, 8° toward its bulge, where its stars and dust hide the galaxies: the map is thin there, toward the Great Attractor itself.',
      cite: ['huchra2012'],
    },
    {
      title: 'The faint galaxies far off',
      text: 'The survey holds only galaxies brighter than its limit, so far out only the most luminous are in it, and the map thins with distance — not because the galaxies do.',
      cite: ['huchra2012'],
    },
    {
      title: 'Gas and dark matter',
      text: 'Not drawn: the hot gas of the clusters and the thin gas along the filaments, and the dark matter that is most of the mass. The map is galaxies’ light.',
    },
  ],
  misconceptions: [
    {
      title: 'Galaxies are not scattered at random',
      text: 'They lie in walls and threads round voids — structures as large as the surveys that found them.',
      cite: ['geller1989'],
    },
    {
      title: 'Superclusters have no edges',
      text: 'They are joined to one another; Laniakea is defined by where the flow of galaxies turns, not by where galaxies stop.',
      cite: ['tully2014'],
    },
    {
      title: 'Redshift is not quite distance',
      text: 'It is the expansion plus each galaxy’s own motion; only an independent distance separates the two.',
      cite: ['tully2023'],
    },
  ],
  sources: [
    {
      key: 'tully2023',
      text: 'Tully, R. B., et al. 2023, Cosmicflows-4, ApJ 944, 94',
      url: 'https://doi.org/10.3847/1538-4357/ac94d8',
    },
    {
      key: 'huchra2012',
      text: 'Huchra, J. P., et al. 2012, The 2MASS Redshift Survey — Description and Data Release, ApJS 199, 26',
      url: 'https://doi.org/10.1088/0067-0049/199/2/26',
    },
    {
      key: 'geller1989',
      text: 'Geller, M. J., & Huchra, J. P. 1989, Mapping the Universe, Science 246, 897',
      url: 'https://doi.org/10.1126/science.246.4932.897',
    },
    {
      key: 'scrimgeour2012',
      text: 'Scrimgeour, M. I., et al. 2012, The WiggleZ Dark Energy Survey: the transition to large-scale cosmic homogeneity, MNRAS 425, 116',
      url: 'https://doi.org/10.1111/j.1365-2966.2012.21402.x',
    },
    {
      key: 'tempel2014',
      text: 'Tempel, E., et al. 2014, Detecting filamentary pattern in the cosmic web: a catalogue of filaments for the SDSS, MNRAS 438, 3465',
      url: 'https://doi.org/10.1093/mnras/stt2454',
    },
    {
      key: 'malavasi2020',
      text: 'Malavasi, N., et al. 2020, Characterising filaments in the SDSS volume from the galaxy distribution, A&A 642, A19',
      url: 'https://doi.org/10.1051/0004-6361/202037647',
    },
    {
      key: 'dupuy2023',
      text: 'Dupuy, A., & Courtois, H. M. 2023, Dynamic cosmography of the local Universe: Laniakea and five more watershed superclusters, A&A 678, A176',
      url: 'https://doi.org/10.1051/0004-6361/202346802',
    },
    {
      key: 'valade2024',
      text: 'Valade, A., et al. 2024, Identification of basins of attraction in the local Universe, Nature Astronomy 8, 1610',
      url: 'https://doi.org/10.1038/s41550-024-02370-0',
    },
    {
      key: 'raychaudhury1989',
      text: 'Raychaudhury, S. 1989, The distribution of galaxies in the direction of the ‘Great Attractor’, Nature 342, 251',
      url: 'https://doi.org/10.1038/342251a0',
    },
    {
      key: 'tully2014',
      text: 'Tully, R. B., Courtois, H., Hoffman, Y., & Pomarède, D. 2014, The Laniakea supercluster of galaxies, Nature 513, 71',
      url: 'https://doi.org/10.1038/nature13674',
    },
    {
      key: 'heic0813',
      text: 'ESA/Hubble, Hubble’s sweeping view of the Coma Galaxy Cluster (heic0813), press release',
      url: 'https://esahubble.org/news/heic0813/',
    },
    {
      key: 'esaperseus',
      text: 'ESA, Euclid’s view of the Perseus cluster of galaxies (2023), image caption',
      url: 'https://www.esa.int/ESA_Multimedia/Images/2023/11/Euclid_s_view_of_the_Perseus_cluster_of_galaxies',
    },
  ],
};
