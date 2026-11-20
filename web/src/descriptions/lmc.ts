import type { Description } from './types.ts';

/**
 * The Large Magellanic Cloud. Every number here is from the source it cites; where a figure is a
 * model's rather than a measurement, it sits under "estimated" and says which model. What the
 * app draws of it is read off core/localGroup.ts (GIANTS, FaceOnMap), scene/LocalGroup.tsx and
 * public/galaxies/CREDITS.md.
 */
export const LMC: Description = {
  id: 'galaxy-lmc',
  lead: [
    'From the southern hemisphere, on a moonless night, two pale patches hang in the sky like pieces broken off the Milky Way. The peoples of South America knew them long before any European, and in November 1520, just out of the strait that now bears his name, Magellan’s chronicler Antonio Pigafetta wrote of “many stars gathered together, like two clouds”. They are not clouds but galaxies, our nearest large companions, and they are falling toward us.',
    'The Large Magellanic Cloud is a galaxy 160,000 light years away, the nearest sizeable one to the Milky Way. Its distance is known to 1%, from pairs of stars that eclipse each other, and it is the first step of the ladder by which the distances of far galaxies, and the expansion of the universe, are measured. It holds more than a hundred billion times the Sun’s mass, most of it dark matter, and its stars lie in a tilted disc crossed by a bright bar.',
    'It is still making stars, fast. Its Tarantula Nebula is the most luminous region of its kind in the local universe, and the heaviest stars found lie in it. And in February 1987 one of its stars exploded: Supernova 1987A, the first supernova seen with the naked eye since 1604. A burst of neutrinos reached Earth a couple of hours before its light, and in 2024 the James Webb Space Telescope found what is most likely the neutron star it left.',
    'It may be passing us for the first time. Measured with Hubble, it moves so fast that it is probably only now falling into the Milky Way from far away, rather than circling it for billions of years; and its pull is strong enough to bend a stream of stars in the Milky Way’s own halo. In about 2.4 billion years, models say, it will merge with the Milky Way.',
  ],
  photos: [
    {
      file: 'photos/lmc/vista.webp',
      largeFile: 'photos/lmc/vista-large.webp',
      width: 640,
      height: 715,
      title: 'The whole cloud from ESO’s VISTA',
      caption:
        'Millions of its stars, from a survey of the Magellanic Clouds in three near-infrared bands, which see through most of its dust: the bar across the middle, and the Tarantula Nebula at upper left. Infrared shown as visible colours.',
      colour: 'false',
      credit: 'ESO/VMC Survey',
      licence: 'CC BY 4.0',
      date: '2019-09-13',
      sourceUrl: 'https://www.eso.org/public/images/eso1914a/',
    },
    {
      file: 'photos/lmc/gaia-map.webp',
      largeFile: 'photos/lmc/gaia-map-large.webp',
      width: 640,
      height: 640,
      title: 'The cloud as Gaia measured it, a map',
      caption:
        'Not a photograph: a map of the light Gaia recorded in each pixel from its second data release, coloured from its measurements through different filters. Its brightest, most massive stars dominate; the bar is the bright streak, the Tarantula above its middle.',
      colour: 'false',
      credit: 'ESA/Gaia/DPAC; A. Moitinho, A. F. Silva, M. Barros, C. Barata (University of Lisbon), H. Savietto (Fork Research)',
      licence: 'CC BY-SA 3.0 IGO',
      date: '2018-04-25',
      sourceUrl: 'https://www.esa.int/ESA_Multimedia/Images/2018/04/Large_Magellanic_Cloud',
    },
    {
      file: 'photos/lmc/tarantula-vst.webp',
      largeFile: 'photos/lmc/tarantula-vst-large.webp',
      width: 495,
      height: 497,
      title: 'The Tarantula and its surroundings',
      caption:
        'From ESO’s VLT Survey Telescope, in visible light — blue-green, red and deep red filters and one of hydrogen’s red glow: the Tarantula Nebula at top, star clusters, glowing clouds and the scattered remains of supernovae below.',
      colour: 'true',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '2018-05-30',
      sourceUrl: 'https://www.eso.org/public/images/eso1816a/',
    },
    {
      file: 'photos/lmc/tarantula-hubble.webp',
      largeFile: 'photos/lmc/tarantula-hubble-large.webp',
      width: 640,
      height: 654,
      title: 'Inside the Tarantula, from Hubble',
      caption:
        'A close-up of part of the nebula, where gas lit by massive young stars is threaded with dust. Blue, yellow-green and near-infrared filters, the last shown as red, so the colours are near an eye’s but not quite.',
      colour: 'false',
      credit: 'NASA, ESA',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2011-03-15',
      sourceUrl: 'https://esahubble.org/images/heic1105a/',
    },
    {
      file: 'photos/lmc/tarantula-webb.webp',
      largeFile: 'photos/lmc/tarantula-webb-large.webp',
      width: 640,
      height: 370,
      title: 'The Tarantula in infrared, from Webb',
      caption:
        'A mosaic 340 light years across: tens of thousands of young stars once hidden in dust, the massive ones pale blue at the centre of the cavity they have blown, still-buried ones red. The rust-coloured gas is rich in complex hydrocarbons. Infrared shown in visible colours.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, and STScI',
      licence: 'CC BY 4.0 (ESA/Webb)',
      date: '2022-09-06',
      sourceUrl: 'https://esawebb.org/images/weic2212a/',
    },
    {
      file: 'photos/lmc/sn1987a-before-after.webp',
      largeFile: 'photos/lmc/sn1987a-before-after-large.webp',
      width: 563,
      height: 722,
      title: 'The star before it exploded',
      caption:
        'An ESO photograph of the field before 1987, with an arrow on Sanduleak −69 202, catalogued in 1969 as a twelfth-magnitude star and classed in the 1970s as a hot blue supergiant, B3 I: the star that became Supernova 1987A. Black and white.',
      colour: 'true',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: 'released 1987-03-03',
      sourceUrl: 'https://www.eso.org/public/images/eso8705b/',
    },
    {
      file: 'photos/lmc/sn1987a-hubble.webp',
      largeFile: 'photos/lmc/sn1987a-hubble-large.webp',
      width: 640,
      height: 703,
      title: 'Supernova 1987A thirty years on, from Hubble',
      caption:
        'January 2017. At the centre, the bright ring of gas the star threw off some 20,000 years before it exploded, now lit by the blast; round it, clouds glowing in hydrogen’s red. Blue, green, hydrogen-alpha and near-infrared filters.',
      colour: 'false',
      credit: 'NASA, ESA, R. Kirshner (Harvard-Smithsonian Center for Astrophysics and Gordon and Betty Moore Foundation) and P. Challis (Harvard-Smithsonian Center for Astrophysics)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2017-02-24',
      sourceUrl: 'https://esahubble.org/images/heic1704a/',
    },
  ],
  drawnHere: [
    {
      title: 'Its face-on map',
      text: 'Where its light and dust are across the disc comes from surveys of the real cloud, its tilt undone: old stars from Spitzer’s 3.6 µm SAGE mosaic; star formation from the Southern H-Alpha Sky Survey’s hydrogen light with Spitzer’s 24 µm for what dust hides, spread by 200 pc, since most young stars’ light comes from stars that have drifted from where they formed; dust from Clark et al.’s maps made from Herschel. Each only where it was observed; past the edge of the 3.6 µm mosaic, the disc’s exponential.',
      cite: ['meixner2006', 'gaustad2001', 'clark2023'],
    },
    {
      title: 'Its glowing gas',
      text: 'Its nebulae, the Tarantula brightest, are drawn from that same hydrogen survey, not spread: in the pink of hydrogen’s two brightest visible lines, on the same exposure as its stars.',
      cite: ['gaustad2001'],
    },
    {
      title: 'Its disc',
      text: 'Of scale length 1.4 kpc, the middle of the 1.3 to 1.5 kpc van der Marel finds from star counts; tilted and turned as the motions of its stars measured by Hubble give, its north-east side nearer us.',
      cite: ['vandermarel2001', 'vandermarel2014'],
    },
    {
      title: 'Its bar',
      text: 'Not drawn as a bar: the disc is round in its model, and the bar shows only where its light is in the face-on map.',
    },
  ],
  measured: [
    {
      title: 'Distance',
      text: '49.59 ± 0.09 (statistical) ± 0.54 (systematic) kpc, 161,700 light years, from 20 eclipsing binaries: pairs of stars whose sizes and temperatures, read off how they eclipse each other, give their true brightness. A distance to 1%, the anchor for calibrating Cepheids and so the expansion rate of the universe.',
      cite: ['pietrzynski2019'],
    },
    {
      title: 'Its rotation and inner mass',
      text: 'Its disc turns at a near-flat 91.7 ± 18.8 km/s outside the centre, from the motions of its stars across the sky measured with Hubble and of old stars along the line of sight; within 8.7 kpc it holds (1.7 ± 0.7) × 10¹⁰ solar masses.',
      cite: ['vandermarel2014'],
    },
    {
      title: 'Its shape',
      text: 'Its stars thin out exponentially with distance from the centre, by a factor of e every 1.3 to 1.5 kpc; its disc is not round but intrinsically elongated, an ellipticity of 0.31.',
      cite: ['vandermarel2001'],
    },
    {
      title: 'Supernova 1987A',
      text: 'First seen in February 1987, at its brightest that May: the first supernova visible to the naked eye since Kepler’s of 1604. About two hours before its light, three observatories caught a burst of neutrinos a few seconds long. In 2024 Webb found strongly ionised argon at its centre, which needs a source of high-energy light: most likely the neutron star it left.',
      cite: ['nasasn1987a'],
    },
    {
      title: 'The star that exploded',
      text: 'Sanduleak −69 202, catalogued in 1969 as a twelfth-magnitude star and classed from ESO observations in the 1970s as a hot blue supergiant, type B3 I.',
      cite: ['eso1987'],
    },
    {
      title: 'The Tarantula',
      text: 'Its largest star-forming region, the most luminous nebula of its kind in the local universe, home to the heaviest star found.',
      cite: ['esahubbletarantula'],
    },
  ],
  estimated: [
    {
      title: 'Its whole mass',
      text: 'From how it has bent the Orphan stream of stars in the Milky Way’s halo: 1.38 (+0.27 −0.24) × 10¹¹ solar masses, most of it dark matter that reaches far beyond its stars. The Milky Way holds 3.8 × 10¹¹ within 50 kpc of its centre in the same fit.',
      cite: ['erkal2019'],
    },
    {
      title: 'A first passage',
      text: 'With the speeds Hubble measured, the Clouds are either on their first pass by the Milky Way, or, if the Milky Way is heavy enough, on an orbit twice as long as once thought, some 3 billion years. A first passage fits their irregular shapes and their speed.',
      cite: ['besla2007'],
    },
    {
      title: 'Its merger with us',
      text: 'In about 2.4 billion years (+1.2 −0.8), as Cautun et al. model it, it will sink into the Milky Way and merge with it.',
      cite: ['cautun2019'],
    },
  ],
  missing: [
    {
      title: 'Its stars, one by one',
      text: 'Not drawn: it is a volume of glow. Even Supernova 1987A is not marked.',
    },
    {
      title: 'The Magellanic Stream and Bridge',
      text: 'Not drawn: the long trail of gas the Clouds leave behind them across the sky, and the bridge between the two.',
      cite: ['besla2007'],
    },
    {
      title: 'Its motion',
      text: 'It stands still here: its motion, fast enough that it may be falling in for the first time, is not drawn.',
      cite: ['besla2007'],
    },
  ],
  misconceptions: [
    {
      title: 'Magellan did not discover them, or name them',
      text: 'The Mapuche and the Tupi-Guarani knew them long before; Amerigo Vespucci wrote of them in 1501–02; the Persian astronomer al-Sufi, around 964, may record the Large one as a white patch called the Ox. Neither Magellan nor Pigafetta named them: the Portuguese called them the Clouds of the Cape, astronomers Nubecula Major and Minor, and “Magellanic Clouds” took over only by the end of the 19th century.',
      cite: ['dennefeld2020'],
    },
    {
      title: 'They are not clouds in our galaxy',
      text: 'They look like detached pieces of the Milky Way, but they are separate galaxies, the Large one 160,000 light years away.',
      cite: ['pietrzynski2019'],
    },
    {
      title: 'Not a small hanger-on',
      text: 'It is often called a dwarf. With more than 10¹¹ solar masses it is heavy enough to have bent the Orphan stream, a river of stars in the Milky Way’s halo, measurably out of its path.',
      cite: ['erkal2019'],
    },
  ],
  sources: [
    {
      key: 'pietrzynski2019',
      text: 'Pietrzyński, G., et al. 2019, A distance to the Large Magellanic Cloud that is precise to one per cent, Nature 567, 200',
      url: 'https://doi.org/10.1038/s41586-019-0999-4',
    },
    {
      key: 'vandermarel2001',
      text: 'van der Marel, R. P. 2001, Magellanic Cloud Structure from Near-Infrared Surveys. II. Star Count Maps and the Intrinsic Elongation of the Large Magellanic Cloud, AJ 122, 1827',
      url: 'https://doi.org/10.1086/323100',
    },
    {
      key: 'vandermarel2014',
      text: 'van der Marel, R. P., & Kallivayalil, N. 2014, Third-epoch Magellanic Cloud Proper Motions. II. The Large Magellanic Cloud Rotation Field in Three Dimensions, ApJ 781, 121',
      url: 'https://doi.org/10.1088/0004-637X/781/2/121',
    },
    {
      key: 'erkal2019',
      text: 'Erkal, D., et al. 2019, The total mass of the Large Magellanic Cloud from its perturbation on the Orphan stream, MNRAS 487, 2685',
      url: 'https://doi.org/10.1093/mnras/stz1371',
    },
    {
      key: 'besla2007',
      text: 'Besla, G., et al. 2007, Are the Magellanic Clouds on Their First Passage about the Milky Way?, ApJ 668, 949',
      url: 'https://doi.org/10.1086/521385',
    },
    {
      key: 'cautun2019',
      text: 'Cautun, M., Deason, A. J., Frenk, C. S., & McAlpine, S. 2019, The aftermath of the Great Collision between our Galaxy and the Large Magellanic Cloud, MNRAS 483, 2185',
      url: 'https://doi.org/10.1093/mnras/sty3084',
    },
    {
      key: 'nasasn1987a',
      text: 'NASA Science, Webb Finds Evidence for Neutron Star at Heart of Young Supernova Remnant (2024), on Fransson, C., et al. 2024, Science',
      url: 'https://science.nasa.gov/missions/webb/webb-finds-evidence-for-neutron-star-at-heart-of-young-supernova-remnant/',
    },
    {
      key: 'eso1987',
      text: 'ESO, The star that exploded on February 23 in the Large Magellanic Cloud (eso8705b), image caption',
      url: 'https://www.eso.org/public/images/eso8705b/',
    },
    {
      key: 'esahubbletarantula',
      text: 'ESA/Hubble, Hubble snaps close-up of the Tarantula (heic1105a), image caption',
      url: 'https://esahubble.org/images/heic1105a/',
    },
    {
      key: 'dennefeld2020',
      text: 'Dennefeld, M. 2020, A History of the Magellanic Clouds and the European Exploration of the Southern Hemisphere, The Messenger 181, 37',
      url: 'https://doi.org/10.18727/0722-6691/5210',
    },
    {
      key: 'meixner2006',
      text: 'Meixner, M., et al. 2006, Spitzer Survey of the Large Magellanic Cloud: Surveying the Agents of a Galaxy’s Evolution (SAGE), AJ 132, 2268',
      url: 'https://doi.org/10.1086/508185',
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
