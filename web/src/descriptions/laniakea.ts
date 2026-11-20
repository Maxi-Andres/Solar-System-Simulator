import type { Description } from './types.ts';

/**
 * Laniakea. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model. What the app draws of it
 * is read off core/laniakea.ts, scene/Laniakea.tsx and tools/src/laniakea/ (watersheds.ts,
 * landmarks.ts). Its body is the structure "Laniakea Supercluster" (structureBodyId), which is
 * made once Laniakea's catalogue has loaded.
 */
export const LANIAKEA: Description = {
  id: 'structure-laniakea-supercluster',
  lead: [
    'Laniakea is Hawaiian for “immense heaven”. It is the name given in 2014 to the vast region of the universe we live in: some hundred thousand galaxies, ours among them, across 500 million light years. It has no edge you could see. Its border is drawn the way a watershed is on a map of mountains — not by where things are, but by which way they are flowing.',
    'Every galaxy is carried away from every other by the expansion of the universe. On top of that, gravity pulls each one toward where matter is densest, and those extra motions can be measured: from a galaxy’s redshift one gets its total speed away from us, from an independent distance — the brightness of its pulsating stars, its supernovae, how fast its disc spins — how much of that is the expansion, and what is left over is its own motion. Mapped across thousands of galaxies, those motions run like streams down valleys. Laniakea is the basin in which they all drain toward the same place.',
    'That place lies behind the Milky Way, toward the constellations Centaurus and Norma, where the dust of our own galaxy hides most of what lies beyond: the Great Attractor, found in the 1980s from galaxies streaming toward it. Laniakea holds about 10¹⁷ times the Sun’s mass, and the Milky Way lies on its outskirts.',
    'Where its border runs is still being argued. The newest catalogue of galaxy distances, Cosmicflows-4, reconstructed one way finds Laniakea a basin of its own; reconstructed another, it finds the Milky Way’s flow ending at the Shapley Supercluster, and Laniakea only a part of Shapley’s far larger basin — and an analysis of the uncertainties slightly prefers that. We may live in something bigger than we named.',
  ],
  photos: [
    {
      file: 'photos/laniakea/great-attractor-field.webp',
      largeFile: 'photos/laniakea/great-attractor-field-large.webp',
      width: 640,
      height: 660,
      title: 'Toward the Great Attractor, from Hubble',
      caption:
        'No photograph of Laniakea can exist: it is defined by motions, not by an edge, and we are inside it. This is a part of it — a patch of the Norma Cluster, 220 million light years away, where its mass pulls hardest. The foreground is crowded with the Milky Way’s own stars, the hardest place in the sky to look through; the edge-on spiral is ESO 137-002. Blue and near-infrared filters.',
      colour: 'false',
      credit: 'ESA/Hubble & NASA',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2013-01-14',
      sourceUrl: 'https://esahubble.org/images/potw1302a/',
    },
    {
      file: 'photos/laniakea/norma-eso137-001.webp',
      largeFile: 'photos/laniakea/norma-eso137-001-large.webp',
      width: 640,
      height: 637,
      title: 'A galaxy stripped in the Norma Cluster',
      caption:
        'ESO 137-001 plunging through the Norma Cluster’s hot gas at nearly 4.5 million miles an hour, some 7 million km/h: its own gas is torn out behind it, in blue tendrils where young stars have formed, and in a stream seen only in X-rays, from Chandra, in purple. Hubble with Chandra; not an eye’s colours.',
      colour: 'false',
      credit: 'NASA, ESA, CXC',
      licence: 'NASA media, not copyrighted; credit requested',
      date: '2014-03-04',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001178',
    },
    {
      file: 'photos/laniakea/centaurus-ngc4696.webp',
      largeFile: 'photos/laniakea/centaurus-ngc4696-large.webp',
      width: 640,
      height: 302,
      title: 'NGC 4696, at the heart of the Centaurus Cluster',
      caption:
        'The largest galaxy of the Centaurus Cluster, some 120 million light years away, with a huge dust lane, about 30,000 light years across, sweeping across its face. Blue and near-infrared filters.',
      colour: 'false',
      credit: 'ESA/Hubble and NASA',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2010-08-12',
      sourceUrl: 'https://esahubble.org/images/heic1013a/',
    },
    {
      file: 'photos/laniakea/virgo-cluster.webp',
      largeFile: 'photos/laniakea/virgo-cluster-large.webp',
      width: 640,
      height: 638,
      title: 'The Virgo Cluster',
      caption:
        'The Virgo Cluster from the Digitized Sky Survey: its galaxies are the small smudges. Made from its blue and near-infrared plates, so not quite an eye’s colours.',
      colour: 'false',
      credit: 'ESO/Digitized Sky Survey 2',
      licence: 'CC BY 4.0',
      date: '2009-05-20',
      sourceUrl: 'https://www.eso.org/public/images/eso0919c/',
    },
    {
      file: 'photos/laniakea/virgo-m87-halo.webp',
      largeFile: 'photos/laniakea/virgo-m87-halo-large.webp',
      width: 640,
      height: 494,
      title: 'The faint light between Virgo’s galaxies',
      caption:
        'A very deep picture of the Virgo Cluster’s core, M87 the large galaxy at lower left: the diffuse light between the galaxies belongs to the cluster itself. The black discs are where bright foreground stars were taken out. One colour, tinted.',
      colour: 'tinted',
      credit: 'Chris Mihos (Case Western Reserve University)/ESO',
      licence: 'CC BY 4.0',
      date: '2009-05-20',
      sourceUrl: 'https://www.eso.org/public/images/eso0919a/',
    },
    {
      file: 'photos/laniakea/virgo-m84.webp',
      largeFile: 'photos/laniakea/virgo-m84-large.webp',
      width: 640,
      height: 592,
      title: 'Galaxies of the Virgo Cluster from La Silla',
      caption:
        'The giant elliptical Messier 84 at the centre and the edge-on spiral NGC 4388 at lower left, taken in April 2000 with the Wide Field Imager at ESO’s La Silla Observatory. Black and white.',
      colour: 'true',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '2003-01-16',
      sourceUrl: 'https://www.eso.org/public/images/eso0304a/',
    },
  ],
  drawnHere: [
    {
      title: 'Its border',
      text: 'The basin the Cosmicflows-4 galaxies’ reconstruction gives, as Dupuy and Courtois traced its watersheds — every point followed downstream to the attractor it ends at — read from their published grid of 7.8 Mpc/h cells: a smoothed surface netted from it, faint and lit at its rim so it reads as an outline, with a faint glow inside. The Basins layer. From inside, weaker, and nothing of it within 60 Mpc of the camera.',
      cite: ['dupuy2023', 'courtois2023'],
    },
    {
      title: 'The other answer, beside it',
      text: 'The Shapley Basin layer draws the reconstruction from the Cosmicflows-4 groups, where the Milky Way’s flow ends at Shapley and Laniakea is a part of Shapley’s basin. Neither is drawn as the truth.',
      cite: ['dupuy2023', 'valade2024'],
    },
    {
      title: 'Its galaxies',
      text: '86,899 galaxies out to 700 Mpc, each a point holding all its light: Cosmicflows-4’s measured distances and the 2MASS Redshift Survey’s redshifts merged, each at its own distance, its group’s, or — a fifth of them — its redshift’s. Where each is placed is comoving, one instant, not where its light left it: the farthest light left 2.2 billion years ago.',
      cite: ['tully2023', 'huchra2012'],
    },
    {
      title: 'Its flow',
      text: 'The Flow Lines layer: the velocity field’s streamlines as ribbons tapering to where they end, a brightening running down each at the field’s speed sped up — not time passing: at 400 km/s a galaxy goes 1 Mpc in 2.4 billion years.',
      cite: ['courtois2023'],
    },
    {
      title: 'Its mark',
      text: 'At its attractor, where the reconstruction’s flow converges, about 7,400 km/s away by the expansion: an estimate from the velocity field, not a measured place. It is framed as a sphere of its basin’s volume, though its real shape is the basin’s.',
      cite: ['dupuy2023'],
    },
  ],
  measured: [
    {
      title: 'Galaxy distances',
      text: 'Cosmicflows-4: distances to 55,877 galaxies, gathered into 38,065 groups, by eight methods — mostly the Tully–Fisher relation of spirals and the Fundamental Plane of ellipticals, and Type Ia supernovae, Cepheids, the tip of the red giant branch and others — consistent with a Hubble constant of 74.6 ± 0.8 km/s/Mpc.',
      cite: ['tully2023'],
    },
    {
      title: 'The Great Attractor',
      text: 'Found in 1988 from elliptical galaxies streaming toward a point behind the Milky Way’s plane, at galactic longitude 307°, latitude +9°, about 4,350 km/s away by the expansion.',
      cite: ['lyndenbell1988'],
    },
    {
      title: 'The Norma Cluster',
      text: 'About 220 million light years away, behind the densest dust of the Milky Way: the concentrated mass of the region astronomers call the Great Attractor.',
      cite: ['potw1302a'],
    },
  ],
  estimated: [
    {
      title: 'Laniakea, as named',
      text: 'From the earlier Cosmicflows-2 distances: the volume within the surface where the flows diverge, about 160 Mpc — 500 million light years — across, holding about 10¹⁷ solar masses in some 100,000 galaxies.',
      cite: ['tully2014', 'uh2014'],
    },
    {
      title: 'Its border, from Cosmicflows-4',
      text: 'The density and velocity fields fitted to Cosmicflows-4 by a Hamiltonian Monte Carlo method, at Ωm 0.3 and H₀ 74.6, from the galaxies’ distances and from the groups’. Their watersheds, traced by Dupuy and Courtois, give Laniakea from the galaxies’ fit a basin of 1.9 million (Mpc/h)³; from the groups’ fit the Milky Way’s flow ends at Shapley, whose basin then takes in Laniakea.',
      cite: ['courtois2023', 'dupuy2023'],
    },
    {
      title: 'Ours, or Shapley’s?',
      text: 'Valade et al. reconstruct the basins as probabilities over the grouped Cosmicflows-4, out to some 30,000 km/s, and find a slight preference for Laniakea being part of the much larger Shapley basin.',
      cite: ['valade2024'],
    },
  ],
  missing: [
    {
      title: 'A picture of it',
      text: 'None can exist. Its border is a line in a velocity field, not a thing that shines, and we are inside it; seen from outside, it would look like any other part of the web of galaxies.',
      cite: ['tully2014'],
    },
    {
      title: 'The galaxies hidden by the Milky Way',
      text: 'Not drawn where not catalogued: behind the dust of our own galaxy’s plane, toward the Great Attractor itself, few galaxies are measured, and the map is thin there.',
      cite: ['potw1302a'],
    },
    {
      title: 'Their motions',
      text: 'The galaxies stand still; only the flow lines show which way they go.',
    },
  ],
  misconceptions: [
    {
      title: 'It has no edge of galaxies',
      text: 'Superclusters are interconnected, with no clear boundaries between them. Laniakea is defined instead as the volume within which galaxies’ own motions, once the cosmic expansion is taken out, all point inward: its border is where the flow turns, not where galaxies stop.',
      cite: ['tully2014', 'uh2014'],
    },
    {
      title: 'The Great Attractor is not a single object',
      text: 'It is a region of extra mass, where the Norma Cluster lies, behind the Milky Way — not a black hole or a mystery body.',
      cite: ['potw1302a', 'lyndenbell1988'],
    },
    {
      title: 'Laniakea’s border is not settled',
      text: 'Two reconstructions of the same data disagree on whether our basin is Laniakea or Shapley’s, and the data slightly prefer Shapley’s.',
      cite: ['dupuy2023', 'valade2024'],
    },
  ],
  sources: [
    {
      key: 'tully2014',
      text: 'Tully, R. B., Courtois, H., Hoffman, Y., & Pomarède, D. 2014, The Laniakea supercluster of galaxies, Nature 513, 71',
      url: 'https://doi.org/10.1038/nature13674',
    },
    {
      key: 'uh2014',
      text: 'University of Hawaiʻi News, UH scientist maps supercluster of galaxies, names it Laniakea (3 September 2014)',
      url: 'https://www.hawaii.edu/news/2014/09/03/uh-scientist-maps-supercluster-of-galaxies-names-it-laniakea/',
    },
    {
      key: 'tully2023',
      text: 'Tully, R. B., et al. 2023, Cosmicflows-4, ApJ 944, 94',
      url: 'https://doi.org/10.3847/1538-4357/ac94d8',
    },
    {
      key: 'courtois2023',
      text: 'Courtois, H. M., et al. 2023, Gravity in the local Universe: Density and velocity fields using CosmicFlows-4, A&A 670, L15',
      url: 'https://doi.org/10.1051/0004-6361/202245331',
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
      key: 'lyndenbell1988',
      text: 'Lynden-Bell, D., et al. 1988, Spectroscopy and photometry of elliptical galaxies. V. Galaxy streaming toward the new supergalactic center, ApJ 326, 19',
      url: 'https://doi.org/10.1086/166066',
    },
    {
      key: 'huchra2012',
      text: 'Huchra, J. P., et al. 2012, The 2MASS Redshift Survey — Description and Data Release, ApJS 199, 26',
      url: 'https://doi.org/10.1088/0067-0049/199/2/26',
    },
    {
      key: 'potw1302a',
      text: 'ESA/Hubble, A busy patch of the Great Attractor (potw1302a), image caption',
      url: 'https://esahubble.org/images/potw1302a/',
    },
  ],
};
