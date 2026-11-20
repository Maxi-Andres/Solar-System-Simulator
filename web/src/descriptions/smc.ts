import type { Description } from './types.ts';

/**
 * The Small Magellanic Cloud. Every number here is from the source it cites; where a figure is a
 * model's rather than a measurement, it sits under "estimated" and says which model. What the
 * app draws of it is read off core/skyMap.ts, scene/SkyVolume.tsx, core/localGroup.ts (GIANTS)
 * and public/galaxies/CREDITS.md.
 */
export const SMC: Description = {
  id: 'galaxy-smc',
  lead: [
    'The smaller of the two pale patches of the southern sky is a whole galaxy, 200,000 light years away, being pulled apart. Its own stars taught us how to measure the universe: from 25 of them, in 1912, Henrietta Swan Leavitt found that the slower a Cepheid star pulses the brighter it truly is — the rule by which Hubble later found Andromeda to be a galaxy, and by which the expansion of the universe is measured still.',
    'The Small Magellanic Cloud is a dwarf galaxy, a satellite of the Milky Way like its larger neighbour. From Earth it looks like a smudge a few degrees long, but it is not flat: pulled on by the Large Cloud, it is stretched out along our line of sight, its stars spread over 7 to 10 kiloparsecs of depth — deeper than it is wide, a cigar seen almost end-on.',
    'It is poorer than the Milky Way in the elements heavier than hydrogen and helium, much as galaxies were 2 to 3 billion years after the Big Bang, when the universe was making stars fastest; so its star-forming regions, NGC 346 brightest among them, are a window on how stars formed then. The James Webb Space Telescope has found dust in the discs round its newborn stars, the stuff planets are made of, where little had been expected.',
    'Between it and the Large Cloud runs a bridge of gas and young stars, and behind the two trails a long stream of gas: what their pull on each other, and the Milky Way’s on both, has torn from them. Close to it on the sky, but nothing to do with it, shines 47 Tucanae, one of the Milky Way’s own globular clusters, far in front.',
  ],
  photos: [
    {
      file: 'photos/smc/clouds-over-paranal.webp',
      largeFile: 'photos/smc/clouds-over-paranal-large.webp',
      width: 640,
      height: 420,
      title: 'Both Clouds over Paranal',
      caption:
        'The two Magellanic Clouds above the dome of the Residencia at ESO’s Paranal Observatory in Chile: the Large one higher, the Small one lower left. A long-exposure photograph, so they look brighter than to the eye.',
      colour: 'true',
      credit: 'Y. Beletsky (LCO)/ESO',
      licence: 'CC BY 4.0',
      date: 'released 2014-10-01',
      sourceUrl: 'https://www.eso.org/public/images/beletsky_paranal_10f/',
    },
    {
      file: 'photos/smc/vista.webp',
      largeFile: 'photos/smc/vista-large.webp',
      width: 640,
      height: 567,
      title: 'The Small Cloud from ESO’s VISTA',
      caption:
        'The largest infrared picture of it, millions of its stars seen through the dust, in three near-infrared bands shown as visible colours. The bright ball at right is 47 Tucanae, a globular cluster of our own galaxy in front of it; the red patches are its star-forming regions.',
      colour: 'false',
      credit: 'ESO/VISTA VMC',
      licence: 'CC BY 4.0',
      date: '2017-05-03',
      sourceUrl: 'https://www.eso.org/public/images/eso1714a/',
    },
    {
      file: 'photos/smc/gaia-map.webp',
      largeFile: 'photos/smc/gaia-map-large.webp',
      width: 640,
      height: 640,
      title: 'The Small Cloud as Gaia measured it, a map',
      caption:
        'Not a photograph: a map of the light Gaia recorded in each pixel, coloured from its measurements through different filters. 47 Tucanae is the bright spot at lower left, its dark centre an artefact — too many stars packed there for Gaia to send them all.',
      colour: 'false',
      credit: 'ESA/Gaia/DPAC; A. Moitinho, A. F. Silva, M. Barros, C. Barata (University of Lisbon), H. Savietto (Fork Research)',
      licence: 'CC BY-SA 3.0 IGO',
      date: '2018-04-25',
      sourceUrl: 'https://www.esa.int/ESA_Multimedia/Images/2018/04/Small_Magellanic_Cloud',
    },
    {
      file: 'photos/smc/ngc346-hubble.webp',
      largeFile: 'photos/smc/ngc346-hubble-large.webp',
      width: 563,
      height: 658,
      title: 'NGC 346 from Hubble',
      caption:
        'The bright cluster at the centre of its largest star-forming region; the light of its hot young stars is eating into the gas and dust round it, carving arcs and ragged filaments. Visible, hydrogen-alpha and near-infrared filters.',
      colour: 'false',
      credit: 'NASA, ESA and A. Nota (ESA/STScI, STScI/AURA)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2005-11-10',
      sourceUrl: 'https://esahubble.org/images/heic0514a/',
    },
    {
      file: 'photos/smc/ngc346-webb.webp',
      largeFile: 'photos/smc/ngc346-webb-large.webp',
      width: 640,
      height: 930,
      title: 'NGC 346 from Webb',
      caption:
        'The same region in four near-infrared bands, shown as blue, cyan, orange and red: ribbons of gas and dust, and stars down to a tenth of the Sun’s mass still forming in them.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI, A. Pagan (STScI)',
      licence: 'CC BY 4.0 (ESA/Webb)',
      date: '2023-01-11',
      sourceUrl: 'https://esawebb.org/images/weic2301a/',
    },
    {
      file: 'photos/smc/ngc602-webb.webp',
      largeFile: 'photos/smc/ngc602-webb-large.webp',
      width: 640,
      height: 419,
      title: 'NGC 602 from Webb',
      caption:
        'A young star cluster near the outskirts of the Small Cloud, in surroundings much like the early universe’s, poor in elements heavier than hydrogen and helium. In it Webb found candidates for the first young brown dwarfs seen outside the Milky Way. Near- and mid-infrared shown as visible colours.',
      colour: 'false',
      credit: 'ESA/Webb, NASA & CSA, P. Zeidler, E. Sabbi, A. Nota, M. Zamani (ESA/Webb)',
      licence: 'CC BY 4.0 (ESA/Webb)',
      date: '2024-10-23',
      sourceUrl: 'https://esawebb.org/images/weic2425a/',
    },
  ],
  drawnHere: [
    {
      title: 'As seen from Earth, with its depth',
      text: 'It is no disc, so it has no face-on map: its maps are of the sky as we see it — old stars from Spitzer’s 3.6 µm SAGE-SMC mosaic, star formation from the Southern H-Alpha Sky Survey with Spitzer’s 24 µm, dust from Clark et al.’s Herschel maps, and its glowing hydrogen — and each point of them is spread along our line of sight by where its stars lie: the old stars’ light by OGLE’s RR Lyrae, the young stars’, their gas’s and the dust’s by OGLE’s Cepheids younger than 150 million years. From Earth the sum is its photographs; from beside it, a cigar pointing at the Sun.',
      cite: ['gordon2011', 'gaustad2001', 'clark2023', 'jd2016', 'jd2017'],
    },
    {
      title: 'How deep, where',
      text: 'At its centre the old stars come out 62.1 kpc away, spread 3.0 kpc either way along the line of sight, and the young ones 61.8 kpc, spread 2.8 kpc; the young lie nearer to the north-east, where the Cepheids put its younger, closer part. Each catalogue is scaled so its stars at the centre sit at the eclipsing binaries’ distance: the two period–luminosity relations disagree by some 4 kpc there.',
      cite: ['graczyk2020', 'jd2016'],
    },
    {
      title: 'What is compact',
      text: 'Its star-forming regions, clusters and knots of dust are not spread through the whole depth — each would become a tube kiloparsecs long pointing at the Sun — but put at their population’s mean distance, as deep as they are wide: where along the depth each one really lies is not measured.',
    },
    {
      title: 'What is not its own',
      text: '47 Tucanae and NGC 362, globular clusters of the Milky Way that lie in front of it, are taken out of its maps; past the area Herschel observed, no dust is drawn rather than dust made up.',
      cite: ['harris1996', 'clark2023'],
    },
  ],
  measured: [
    {
      title: 'Distance',
      text: '62.44 ± 0.47 (statistical) ± 0.81 (systematic) kpc, about 204,000 light years, to its centre, from 15 detached eclipsing binaries.',
      cite: ['graczyk2020'],
    },
    {
      title: 'Its depth',
      text: 'The same binaries form an elongated structure steeply inclined to the sky: the nearest and the farthest are some 10 kpc apart, and its depth along the line of sight reaches about 7 kpc.',
      cite: ['graczyk2020'],
    },
    {
      title: 'Its shape, from its oldest stars',
      text: 'Its RR Lyrae, old pulsating stars, fill a smooth ellipsoid with axes in the ratio 1 : 1.10 : 2.13, the longest along the line of sight.',
      cite: ['jd2017'],
    },
    {
      title: 'Its shape, from its young stars',
      text: 'Its Cepheids are not so regular: an ellipsoid with two large structures off its axes, the northern one nearer and younger, the south-western one farther and older; their ages peak at 110 and 220 million years.',
      cite: ['jd2016'],
    },
    {
      title: 'Leavitt’s law',
      text: 'In 1912 Henrietta Swan Leavitt published the relation between period and luminosity for 25 variable stars of the Small Cloud, later known to be Cepheids. Re-measured with modern data in 2025, her relation agrees well with today’s; its scatter is halved.',
      cite: ['breuval2025'],
    },
    {
      title: 'Its metals, and NGC 346',
      text: 'It has lower concentrations of elements heavier than hydrogen and helium than the Milky Way, as galaxies had some 2 to 3 billion years after the Big Bang. In NGC 346 Webb sees protostars as small as a tenth of the Sun and, for the first time, dust in the discs round them.',
      cite: ['esawebb346'],
    },
  ],
  estimated: [
    {
      title: 'Why it is stretched',
      text: 'Its shape and the Bridge are read as the work of the Large Cloud’s pull; in the Bridge the two Clouds’ halos of old stars overlap. The Clouds may be on their first pass by the Milky Way.',
      cite: ['jd2017', 'besla2007'],
    },
  ],
  missing: [
    {
      title: 'Its stars, one by one',
      text: 'Not drawn: it is a volume of glow, the light of all its stars summed.',
    },
    {
      title: 'The Bridge and the Magellanic Stream',
      text: 'Not drawn: the map of its star formation ends 4° from its centre, where the Bridge begins, and the gas trailing behind the Clouds is not drawn at all.',
    },
    {
      title: 'Its motion',
      text: 'It stands still here.',
    },
  ],
  misconceptions: [
    {
      title: '47 Tucanae is not part of it',
      text: 'The bright ball of stars beside it on the sky is a globular cluster of the Milky Way, far in front.',
      cite: ['harris1996', 'esovista'],
    },
    {
      title: 'It is not a small flat disc',
      text: 'It looks like a smudge on the sky, but it is deeper along our line of sight than it is wide across it.',
      cite: ['graczyk2020', 'jd2017'],
    },
    {
      title: 'Magellan did not name it',
      text: 'Astronomers called it Nubecula Minor, the Portuguese the Clouds of the Cape; “Magellanic Clouds” became the name only at the end of the 19th century.',
      cite: ['dennefeld2020'],
    },
  ],
  sources: [
    {
      key: 'graczyk2020',
      text: 'Graczyk, D., et al. 2020, A Distance Determination to the Small Magellanic Cloud with an Accuracy of Better than Two Percent Based on Late-type Eclipsing Binary Stars, ApJ 904, 13',
      url: 'https://doi.org/10.3847/1538-4357/abbb2b',
    },
    {
      key: 'jd2016',
      text: 'Jacyszyn-Dobrzeniecka, A. M., et al. 2016, OGLE-ing the Magellanic System: Three-Dimensional Structure of the Clouds and the Bridge Using Classical Cepheids, Acta Astronomica 66, 149',
      url: 'https://arxiv.org/abs/1602.09141',
    },
    {
      key: 'jd2017',
      text: 'Jacyszyn-Dobrzeniecka, A. M., et al. 2017, OGLE-ing the Magellanic System: Three-Dimensional Structure of the Clouds and the Bridge Using RR Lyrae Stars, Acta Astronomica 67, 1',
      url: 'https://doi.org/10.32023/0001-5237/67.1.1',
    },
    {
      key: 'breuval2025',
      text: 'Breuval, L., Huang, C. D., & Riess, A. G. 2025, The Legacy of Henrietta Leavitt: A Re-analysis of the First Cepheid Period–Luminosity Relation, PASP 137, 044001',
      url: 'https://doi.org/10.1088/1538-3873/adc5a1',
    },
    {
      key: 'esawebb346',
      text: 'ESA, Webb inspects NGC 346 (2023)',
      url: 'https://www.esa.int/ESA_Multimedia/Images/2023/01/Webb_inspects_NGC_346',
    },
    {
      key: 'esovista',
      text: 'ESO, VISTA’s view of the Small Magellanic Cloud (eso1714a), image caption',
      url: 'https://www.eso.org/public/images/eso1714a/',
    },
    {
      key: 'besla2007',
      text: 'Besla, G., et al. 2007, Are the Magellanic Clouds on Their First Passage about the Milky Way?, ApJ 668, 949',
      url: 'https://doi.org/10.1086/521385',
    },
    {
      key: 'dennefeld2020',
      text: 'Dennefeld, M. 2020, A History of the Magellanic Clouds and the European Exploration of the Southern Hemisphere, The Messenger 181, 37',
      url: 'https://doi.org/10.18727/0722-6691/5210',
    },
    {
      key: 'harris1996',
      text: 'Harris, W. E. 1996, A Catalog of Parameters for Globular Clusters in the Milky Way, AJ 112, 1487 (2010 edition)',
      url: 'https://doi.org/10.1086/118116',
    },
    {
      key: 'gordon2011',
      text: 'Gordon, K. D., et al. 2011, Surveying the Agents of Galaxy Evolution in the Tidally Stripped, Low Metallicity Small Magellanic Cloud (SAGE-SMC), AJ 142, 102',
      url: 'https://doi.org/10.1088/0004-6256/142/4/102',
    },
    {
      key: 'gaustad2001',
      text: 'Gaustad, J. E., McCullough, P. R., Rosing, W., & Van Buren, D. 2001, A Robotic Wide-Angle Hα Survey of the Southern Sky, PASP 113, 1326',
      url: 'https://doi.org/10.1086/323969',
    },
    {
      key: 'clark2023',
      text: 'Clark, C. J. R., et al. 2023, The Quest for the Missing Dust. II. Two Orders of Magnitude of Evolution in the Dust-to-gas Ratio Resolved within Local Group Galaxies, ApJ 946, 42',
      url: 'https://doi.org/10.3847/1538-4357/acbb66',
    },
  ],
};
