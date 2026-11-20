import { SOLAR_NEIGHBOURHOOD_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The Solar Neighbourhood: no body, so opened from its breadcrumb level's panel
 * (state/levels.ts, ui/LevelFacts.tsx). Every number here is from the source it cites; where a
 * figure is a model's rather than a measurement, it sits under "estimated" and says which model.
 * What the app draws of it is read off scene/scale.ts (the level's framing), scene/homeName.ts,
 * scene/distanceRings.ts, core/stars3d.ts and tools/src/stars/build3d.ts, core/localInterstellar.ts
 * and core/stellarFlybys.ts.
 */
export const SOLAR_NEIGHBOURHOOD: Description = {
  id: SOLAR_NEIGHBOURHOOD_DESCRIPTION_ID,
  subject: { name: 'Solar Neighbourhood', kind: 'the stars about the Sun' },
  lead: [
    'These are the stars near enough to be called neighbours. A radio message sent from Earth on the day someone is born would, by the end of a long life, have reached the stars within some eighty light years — a quarter of the way across this map — and only those within forty could have answered in time. Even the nearest, Proxima Centauri, is 4.25 light years away: a question to it and its answer take eight and a half years.',
    'The neighbourhood drawn here is the sphere 100 parsecs — 326 light years — about the Sun: the volume the Gaia spacecraft has counted very nearly star by star. Its catalogue of nearby stars holds 331,312 objects, down to the faintest red dwarfs. Most of the neighbours are such dwarfs, far too faint for the eye: of the 540 stars, brown dwarfs and planets known within 10 parsecs, in 339 systems, about six in ten of the stars are red M dwarfs, and Proxima itself takes a telescope to see. The night sky’s bright stars are mostly the rare luminous ones, many of them far beyond this map.',
    'Where we are in the galaxy is the Orion Spur, or Local Arm, a short arm between the Sagittarius and Perseus arms, in a cavity of hot, thin gas a thousand light years wide called the Local Bubble. It was blown by a series of supernovae that began about 14 million years ago; the Sun drifted into it some 5 million years ago, and now sits nearly at its middle. Every young star and star-forming cloud within 500 light years lies on its wall, made from the gas the explosions swept up. Close in, the Sun is passing through a patchwork of small clouds of warm gas: four of them, the Local Interstellar Cloud among them, touch the edge of its own bubble, the heliosphere.',
    'Nothing here stands still. Every star is moving, and the constellations are only how they line up from here, now. About 70,000 years ago a small pair of stars, Scholz’s Star, passed through the outer Oort cloud; in about 1.3 million years Gliese 710 will pass a sixth of a light year from the Sun. And the map’s edge is no edge of anything: it is where the census stops. The stars go on beyond it as they are inside, for thousands of light years.',
  ],
  photos: [
    {
      file: 'photos/alpha-centauri/southern-cross-film.webp',
      largeFile: 'photos/alpha-centauri/southern-cross-film-large.webp',
      width: 616,
      height: 380,
      title: 'The nearest star system, beside the Southern Cross',
      caption:
        'A 70-minute exposure on Kodak Ektachrome film by ESO’s Claus Madsen. Alpha Centauri, 4.37 light years away, is the bright yellowish star at the middle left — A and B together, far too close to split at this scale; the Southern Cross is to the right, every one of its stars farther off.',
      colour: 'true',
      credit: 'ESO/Claus Madsen',
      licence: 'CC BY 4.0',
      date: '2005-12-21',
      sourceUrl: 'https://www.eso.org/public/images/eso0542a/',
    },
    {
      file: 'photos/alpha-centauri/dss2-sky.webp',
      largeFile: 'photos/alpha-centauri/dss2-sky-large.webp',
      width: 552,
      height: 560,
      title: 'Alpha Centauri and Proxima, two degrees apart',
      caption:
        'Assembled from the photographic plates of the Digitized Sky Survey 2. A and B blaze as one; their blue halo is the plates’ doing, for the pair is pale yellow, like the Sun. Proxima Centauri, the nearest star of all, is the faint red one toward the lower right: a neighbour that no eye has ever seen.',
      colour: 'true',
      credit: 'Digitized Sky Survey 2; acknowledgement: Davide De Martin/Mahdi Zamani (via ESO)',
      licence: 'CC BY 4.0, as ESO publishes it',
      date: '2016-08-24',
      sourceUrl: 'https://www.eso.org/public/images/eso1629i/',
    },
    {
      file: 'photos/proxima-centauri/hubble-2013.webp',
      largeFile: 'photos/proxima-centauri/hubble-2013-large.webp',
      width: 604,
      height: 592,
      title: 'Proxima Centauri from Hubble',
      caption:
        'The nearest star, a red dwarf, through Hubble’s Wide Field and Planetary Camera 2, in red and near-infrared light shown in colour — so not an eye’s colours. The spikes are the telescope’s optics.',
      colour: 'false',
      credit: 'ESA/Hubble & NASA',
      licence: 'CC BY 4.0',
      date: '2013-10-28',
      sourceUrl: 'https://esahubble.org/images/potw1343a/',
    },
    {
      file: 'photos/sirius/canis-major-paranal.webp',
      largeFile: 'photos/sirius/canis-major-paranal-large.webp',
      width: 640,
      height: 515,
      title: 'Sirius, a neighbour 8.6 light years off',
      caption:
        'The brightest star of the night, at the top left: bright because it is both luminous and near. The bright star on the right is Canopus, the second brightest, which is far farther and far more luminous. Below, the road up to ESO’s Very Large Telescope in Chile.',
      colour: 'true',
      credit: 'ESO/Y. Beletsky',
      licence: 'CC BY 4.0',
      date: '2009-12-03',
      sourceUrl: 'https://www.eso.org/public/images/yb_big_dog_paranal_cc/',
    },
    {
      file: 'photos/solar-neighbourhood/hyades.webp',
      largeFile: 'photos/solar-neighbourhood/hyades-large.webp',
      width: 640,
      height: 373,
      title: 'The Hyades, and Aldebaran in front of them',
      caption:
        'A star cluster in Taurus about 150 light years away, its stars born together some 625 million years ago — inside this map. The bright orange star at the upper left is Aldebaran: it looks a member, and is not; at 65 light years it is less than half as far. Assembled from the blue, red and near-infrared plates of the Digitized Sky Survey 2, so not quite an eye’s colours.',
      colour: 'false',
      credit: 'NOIRLab/NSF/AURA/Digitized Sky Survey 2',
      licence: 'CC BY 4.0',
      date: '2020-08-04',
      sourceUrl: 'https://noirlab.edu/public/images/noirlab2018e/',
    },
    {
      file: 'photos/solar-neighbourhood/fomalhaut-webb-2023.webp',
      largeFile: 'photos/solar-neighbourhood/fomalhaut-webb-2023-large.webp',
      width: 640,
      height: 573,
      title: 'A neighbour’s own belts of dust, from Webb',
      caption:
        'The young star Fomalhaut, 25 light years away, in mid-infrared light no eye can see: three nested belts of dust reaching 23 billion km from it, the inner two never seen before Webb — most likely shaped by planets no one has seen yet. Another sun’s Kuiper belt. The ragged black spot at the centre is where the detector saturated.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, A. Pagan (STScI), A. Gáspár (University of Arizona)',
      licence: 'CC BY 4.0 (ESA/Webb)',
      date: '2023-05-08',
      sourceUrl: 'https://esawebb.org/images/weic2312a/',
    },
    {
      file: 'photos/solar-neighbourhood/gaia-motion-400000-years.webp',
      largeFile: 'photos/solar-neighbourhood/gaia-motion-400000-years-large.webp',
      width: 640,
      height: 360,
      title: 'Where the neighbours are going, a visualisation',
      caption:
        'Not a photograph: some 40,000 stars within 100 parsecs, each drawn as the trail it will make across the sky over the next 400,000 years, from the motions Gaia measured for its Early Data Release 3 — over Gaia’s own map of the whole sky, the plane of the galaxy across the middle.',
      colour: 'false',
      credit: 'ESA/Gaia/DPAC; acknowledgement: A. Brown, S. Jordan, T. Roegiers, X. Luri, E. Masana, T. Prusti and A. Moitinho',
      licence: 'CC BY-SA 3.0 IGO',
      date: '2020-12-03',
      sourceUrl: 'https://www.esa.int/ESA_Multimedia/Images/2020/12/Gaia_s_stellar_motion_for_the_next_400_thousand_years',
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The breadcrumb’s Solar Neighbourhood puts the camera 50 light years from the Sun: from there the 10-light-year ring, a dozen star systems inside it, fills most of the frame’s height. The level begins 10,000 AU out — a convention for naming the view, not a boundary — and once the whole 100-parsec sphere is under 24 pixels across, the Sun’s point is named the Solar Neighbourhood: a place in the galaxy.',
    },
    {
      title: 'Its stars, each where it is measured',
      text: 'Inside 100 parsecs, every star of Gaia’s Catalogue of Nearby Stars, at the distance its parallax gives, as bright as its measured luminosity makes it from wherever the camera is, coloured by its measured colour. Beyond, only the sky’s stars to eighth magnitude whose parallax is good enough — the brightest Gaia and Hipparcos measured. So the 100-parsec sphere shows as a bright ball, and its edge is drawn as a dashed ring in the star map’s colour, named for what it is: where the census stops.',
      cite: ['smart2021', 'gaia2023'],
    },
    {
      title: 'Rulers',
      text: 'Rings at 1, 5, 10, 50 and 100 light years, in the plane of Earth’s orbit as the planets’ orbits are: a ruler laid on the picture to read distances off, not anything there.',
    },
    {
      title: 'Moving',
      text: 'Every star goes on a straight line from its measured position and velocity; over a hundred thousand years the galaxy’s pull bends such a path by a few percent. The paths of Scholz’s Star and Gliese 710 across their passages through the Oort cloud are drawn in the Notable Stars layer.',
      cite: ['mamajek2015', 'delafuente2022'],
    },
    {
      title: 'The gas about us',
      text: 'The Local Interstellar Medium layer: the inner wall of the Local Bubble as Pelgrims et al. found it in Lallement et al.’s 3D map of the dust — along each line of sight, where the dust first rises; the Radcliffe Wave as Konietzka et al.’s best-fit model; and the Local Interstellar Cloud as the shape Linsky et al. fitted to the gas towards 62 stars. Each faint, as light along the line of sight through a thin shell: they are gas too thin to see, and a map of where they are.',
      cite: ['pelgrims2020', 'lallement2019', 'konietzka2024', 'linsky2019'],
    },
  ],
  measured: [
    {
      title: 'The census of 100 parsecs',
      text: 'Gaia’s Catalogue of Nearby Stars: 331,312 objects with a chance of lying within 100 parsecs, estimated to hold at least 92% of the stars there down to the coolest red dwarfs, of type M9.',
      cite: ['smart2021'],
    },
    {
      title: 'Within 10 parsecs',
      text: '540 stars, brown dwarfs and planets in 339 systems; about 27% of them multiple; about 61% of the stars and brown dwarfs red M dwarfs, more than half of those between M3 and M5.',
      cite: ['reyle2021'],
    },
    {
      title: 'The nearest star',
      text: 'Proxima Centauri, 4.25 light years away by Gaia’s parallax.',
      cite: ['gaia2023'],
    },
    {
      title: 'Where in the galaxy',
      text: 'In the Orion Spur, the Local Arm, a small partial arm between the Sagittarius and Perseus arms; its course is traced by the parallaxes of masers in star-forming regions.',
      cite: ['nasafacts', 'reid2019'],
    },
    {
      title: 'The Local Bubble',
      text: 'A cavity of hot, thin gas walled by cold, dusty gas, its inner wall found where the dust begins along each line of sight. Nearly all the star-forming clouds near the Sun lie on its surface, their young stars moving outward from it.',
      cite: ['pelgrims2020', 'zucker2022'],
    },
    {
      title: 'The Radcliffe Wave',
      text: 'A narrow chain of dense gas 2.7 kiloparsecs long, holding most of the star-forming regions near the Sun and about three million times the Sun’s mass of gas, undulating above and below the galaxy’s plane by up to about 160 parsecs; and it is oscillating.',
      cite: ['alves2020', 'konietzka2024'],
    },
    {
      title: 'A constellation is not a group',
      text: 'The Hyades, in Taurus, are about 150 light years away; Aldebaran, which seems to be one of them, is 65 and unrelated.',
      cite: ['apodhyades'],
    },
  ],
  estimated: [
    {
      title: 'The bubble’s history',
      text: 'Traced back from the motions of the young stars on its wall: a burst of star birth and then of supernovae near its centre, beginning about 14 million years ago, swept the gas into a shell that broke up into the nearby molecular clouds. About 15 supernovae; the Sun entered it about 5 million years ago and is now near its centre. It is about 1,000 light years wide.',
      cite: ['zucker2022', 'cfa2022'],
    },
    {
      title: 'The cloud the Sun is in',
      text: 'Four partly ionised clouds touch the outer heliosphere; the Local Interstellar Cloud’s shape is fitted to the gas absorbed in the light of 62 stars, assuming an even density.',
      cite: ['linsky2019'],
    },
    {
      title: 'Passing stars',
      text: 'Scholz’s Star, a low-mass pair, passed about 52,000 AU from the Sun some 70,000 years ago, almost certainly through the outer Oort cloud; Gliese 710 will pass 0.052 parsecs away, about 10,700 AU, in 1.29 million years. Both are computed from measured motions.',
      cite: ['mamajek2015', 'delafuente2022'],
    },
    {
      title: 'Distances near the edge',
      text: 'About 9% of the catalogue’s objects probably lie just outside 100 parsecs: each has a probability of being inside, not a certainty.',
      cite: ['smart2021'],
    },
  ],
  missing: [
    {
      title: 'The stars past the census',
      text: 'Not drawn beyond 100 parsecs unless bright: the faint stars carry on there as they do inside, but only the sky’s brightest are placed, so the sphere shows as a ball the real neighbourhood is not.',
    },
    {
      title: 'The coldest neighbours',
      text: 'The coolest brown dwarfs are too faint for Gaia, and its census of them is not complete; some are still being found nearby.',
      cite: ['reyle2021'],
    },
    {
      title: 'The hot gas itself',
      text: 'The Local Bubble’s hot, thin gas gives almost no light an eye could see: only its wall is drawn, and that faintly.',
    },
  ],
  misconceptions: [
    {
      title: 'The neighbourhood has no edge',
      text: 'The ball of stars round the Sun, dark outside, is where the census stops, not where the stars do: the Sun is not in a cluster at the edge of the stars.',
      cite: ['smart2021'],
    },
    {
      title: 'The nearest stars are not the brightest',
      text: 'Most of them are red dwarfs no eye can see. Most of the bright stars of the night are rare luminous ones, seen from much farther.',
      cite: ['reyle2021'],
    },
    {
      title: 'Constellations are not neighbourhoods',
      text: 'Their stars lie at very different distances and only line up from here: Aldebaran in front of the Hyades, at less than half their distance.',
      cite: ['apodhyades'],
    },
    {
      title: 'The stars are not fixed',
      text: 'Every one of them is moving; over hundreds of thousands of years the constellations come apart, and in 1.3 million years a star will pass through the Oort cloud.',
      cite: ['esagaiamotion', 'delafuente2022'],
    },
  ],
  sources: [
    {
      key: 'smart2021',
      text: 'Gaia Collaboration, Smart, R. L., et al. 2021, Gaia Early Data Release 3: The Gaia Catalogue of Nearby Stars, A&A 649, A6',
      url: 'https://doi.org/10.1051/0004-6361/202039498',
    },
    {
      key: 'reyle2021',
      text: 'Reylé, C., et al. 2021, The 10 parsec sample in the Gaia era, A&A 650, A201',
      url: 'https://doi.org/10.1051/0004-6361/202140985',
    },
    {
      key: 'gaia2023',
      text: 'Gaia Collaboration, Vallenari, A., et al. 2023, Gaia Data Release 3: Summary of the content and survey properties, A&A 674, A1',
      url: 'https://doi.org/10.1051/0004-6361/202243940',
    },
    {
      key: 'nasafacts',
      text: 'NASA Science, Solar System: Facts',
      url: 'https://science.nasa.gov/solar-system/solar-system-facts/',
    },
    {
      key: 'reid2019',
      text: 'Reid, M. J., et al. 2019, Trigonometric Parallaxes of High-mass Star-forming Regions: Our View of the Milky Way, ApJ 885, 131',
      url: 'https://doi.org/10.3847/1538-4357/ab4a11',
    },
    {
      key: 'zucker2022',
      text: 'Zucker, C., et al. 2022, Star formation near the Sun is driven by expansion of the Local Bubble, Nature 601, 334',
      url: 'https://doi.org/10.1038/s41586-021-04286-5',
    },
    {
      key: 'cfa2022',
      text: 'Harvard Gazette, How a bubble gives birth to young stars (12 January 2022)',
      url: 'https://news.harvard.edu/gazette/story/2022/01/astronomers-find-origin-of-stars-that-surround-earth',
    },
    {
      key: 'pelgrims2020',
      text: 'Pelgrims, V., et al. 2020, Modeling the magnetized Local Bubble from dust data, A&A 636, A17',
      url: 'https://doi.org/10.1051/0004-6361/201937157',
    },
    {
      key: 'lallement2019',
      text: 'Lallement, R., et al. 2019, Gaia-2MASS 3D maps of Galactic interstellar dust within 3 kpc, A&A 625, A135',
      url: 'https://doi.org/10.1051/0004-6361/201834695',
    },
    {
      key: 'linsky2019',
      text: 'Linsky, J. L., Redfield, S., & Tilipman, D. 2019, The Interface between the Outer Heliosphere and the Inner Local ISM, ApJ 886, 41',
      url: 'https://doi.org/10.3847/1538-4357/ab498a',
    },
    {
      key: 'alves2020',
      text: 'Alves, J., et al. 2020, A Galactic-scale gas wave in the solar neighbourhood, Nature 578, 237',
      url: 'https://doi.org/10.1038/s41586-019-1874-z',
    },
    {
      key: 'konietzka2024',
      text: 'Konietzka, R., et al. 2024, The Radcliffe Wave is oscillating, Nature 628, 62',
      url: 'https://doi.org/10.1038/s41586-024-07127-3',
    },
    {
      key: 'mamajek2015',
      text: 'Mamajek, E. E., et al. 2015, The Closest Known Flyby of a Star to the Solar System, ApJ 800, L17',
      url: 'https://doi.org/10.1088/2041-8205/800/1/L17',
    },
    {
      key: 'delafuente2022',
      text: 'de la Fuente Marcos, R., & de la Fuente Marcos, C. 2022, An Update on the Future Flyby of Gliese 710 to the Solar System Using Gaia DR3, RNAAS 6, 136',
      url: 'https://doi.org/10.3847/2515-5172/ac7b95',
    },
    {
      key: 'apodhyades',
      text: 'NASA, Astronomy Picture of the Day, The Hyades Star Cluster (22 January 2020)',
      url: 'https://science.nasa.gov/image-article/apod-2020-january-22-the-hyades-star-cluster/',
    },
    {
      key: 'esagaiamotion',
      text: 'ESA, Gaia’s stellar motion for the next 400 thousand years (2020), image caption',
      url: 'https://www.esa.int/ESA_Multimedia/Images/2020/12/Gaia_s_stellar_motion_for_the_next_400_thousand_years',
    },
  ],
};
