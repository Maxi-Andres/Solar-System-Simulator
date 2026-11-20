import { LOCAL_VOLUME_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The Local Volume: no body, so opened from its breadcrumb level's panel (state/levels.ts,
 * ui/LevelFacts.tsx). Every number here is from the source it cites; where a figure is a
 * model's rather than a measurement, it sits under "estimated" and says which model. What the
 * app draws of it is read off core/localVolume.ts, tools/src/localVolume/localVolume.ts,
 * core/localStructure.ts, scene/scale.ts (the level's framing) and scene/homeName.ts.
 */
export const LOCAL_VOLUME: Description = {
  id: LOCAL_VOLUME_DESCRIPTION_ID,
  subject: { name: 'Local Volume', kind: 'the galaxies about the Local Group' },
  lead: [
    'Step back from the Local Group and our home turns out to be a quiet suburb. The galaxies about us lie mostly in one thin, flat sheet, and beside it is the Local Void, one of the emptiest places near us, its centre at least 75 million light years away. We are moving away from it at some 260 kilometres a second: not pushed, but pulled by the matter everywhere else, with almost nothing inside the void to pull back.',
    'The Local Volume is the name for the galaxies within about 11 megaparsecs, 36 million light years. A catalogue of them lists 869, nearly all dwarfs. Among them are groups much like our own: the Sculptor group about the dusty spiral NGC 253; M81 and M82, two galaxies pulling at each other; Centaurus A, a giant elliptical with a black hole firing jets, and M83 near it; IC 342 and the Maffei galaxies, hidden behind the dust of our own galaxy’s disc; and the loose clouds of galaxies in Canes Venatici. Round the Local Group, a ring of the largest of them — the Council of Giants — lies in the same sheet.',
    'This is about as far as galaxies can be measured star by star. In these galaxies Hubble picks out single red giants in the thin outskirts, and the brightest red giants all top out at nearly the same brightness — so how faint they look gives the distance. Cepheids do the same for a few spirals. Where no star can be measured, a distance is estimated from how fast a spiral turns, from a galaxy’s group, or from its speed away from us, and those are less sure.',
    'Here the expansion of the universe is plain to see — the farther a galaxy, the faster it recedes — but it is not all that moves. The motion of the Local Sheet, and ours with it — 631 kilometres a second, once the expansion is taken out — is three pulls added together: away from the Local Void, toward the Virgo Cluster 17 megaparsecs off, and, strongest, toward the far concentration of galaxies about the Centaurus Cluster. Just past the Local Volume’s edge lies Virgo itself, the nearest great cluster.',
  ],
  photos: [
    {
      file: 'photos/local-volume/m81-hubble.webp',
      largeFile: 'photos/local-volume/m81-hubble-large.webp',
      width: 640,
      height: 430,
      title: 'M81, from Hubble',
      caption:
        'The largest galaxy of the M81 group, 3.6 megaparsecs away, about 12 million light years: so near that Hubble resolves its single stars, its star clusters and its glowing gas. Its spiral arms wind all the way into its centre. Blue, visible and infrared light.',
      colour: 'false',
      credit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA). Acknowledgement: A. Zezas and J. Huchra (Harvard-Smithsonian Center for Astrophysics)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2007-05-28',
      sourceUrl: 'https://esahubble.org/images/heic0710a/',
    },
    {
      file: 'photos/local-volume/m82-hubble.webp',
      largeFile: 'photos/local-volume/m82-hubble-large.webp',
      width: 640,
      height: 499,
      title: 'M82, M81’s neighbour, from Hubble',
      caption:
        'A starburst galaxy: at its centre stars are being born ten times as fast as in the whole Milky Way, a burst tied to its pull with M81. The red plumes are hydrogen blown out above and below its disc by the winds of its young stars. Four filters, visible to infrared, and one for glowing hydrogen.',
      colour: 'false',
      credit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA). Acknowledgement: J. Gallagher (University of Wisconsin), M. Mountain (STScI) and P. Puxley (NSF)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2006-04-24',
      sourceUrl: 'https://esahubble.org/images/heic0604a/',
    },
    {
      file: 'photos/local-volume/centaurus-a.webp',
      largeFile: 'photos/local-volume/centaurus-a-large.webp',
      width: 640,
      height: 674,
      title: 'Centaurus A, in three kinds of light',
      caption:
        'A giant elliptical galaxy crossed by a lane of dust, 3.8 megaparsecs away. Its stars and dust are in close to true colour, from the Wide Field Imager at La Silla; laid over them, in orange, the lobes and jets from its central black hole seen at 870 µm by APEX, and in blue the hot gas Chandra sees in X-rays. A composite: the lobes are invisible to any eye.',
      colour: 'false',
      credit: 'ESO/WFI (optical); MPIfR/ESO/APEX/A. Weiss et al. (submillimetre); NASA/CXC/CfA/R. Kraft et al. (X-ray)',
      licence: 'CC BY 4.0',
      date: '2009-01-28',
      sourceUrl: 'https://www.eso.org/public/images/eso0903a/',
    },
    {
      file: 'photos/local-volume/ngc253-wfi.webp',
      largeFile: 'photos/local-volume/ngc253-wfi-large.webp',
      width: 640,
      height: 580,
      title: 'NGC 253, the Sculptor Galaxy',
      caption:
        'One of the brightest and dustiest spirals in the sky, the largest of the Sculptor group, 3.9 megaparsecs away, seen nearly edge-on from La Silla. The inset is its centre from the VLT and Hubble, in infrared, where a black hole like the Milky Way’s seems to lie. Visible and hydrogen filters.',
      colour: 'false',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '2009-01-19',
      sourceUrl: 'https://www.eso.org/public/images/eso0902a/',
    },
    {
      file: 'photos/local-volume/m83-wfi.webp',
      largeFile: 'photos/local-volume/m83-wfi-large.webp',
      width: 640,
      height: 640,
      title: 'M83, the Southern Pinwheel',
      caption:
        'A barred spiral like ours, about 15 million light years away in Hydra, some 40,000 light years across, from the Wide Field Imager at La Silla through blue, visual and red filters — about as an eye would see it.',
      colour: 'true',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '2008-09-02',
      sourceUrl: 'https://www.eso.org/public/images/eso0825a/',
    },
    {
      file: 'photos/local-volume/m101-hubble.webp',
      largeFile: 'photos/local-volume/m101-hubble-large.webp',
      width: 640,
      height: 500,
      title: 'M101, the Pinwheel, from Hubble',
      caption:
        'A giant spiral in Ursa Major, about 25 million light years away and 170,000 light years across — nearly twice the Milky Way’s width — its pink knots huge regions of star birth. Hubble’s mosaic, its outskirts filled in from ground-based telescopes.',
      colour: 'false',
      credit: 'ESA & NASA; acknowledgement: K.D. Kuntz, F. Bresolin, J. Trauger, J. Mould, Y.-H. Chu; image processing: Davide De Martin (ESA/Hubble); CFHT: J.-C. Cuillandre/Coelum; NOAO: G. Jacoby, B. Bohannan, M. Hanna/NOAO/AURA/NSF',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2006-02-28',
      sourceUrl: 'https://esahubble.org/images/heic0602a/',
    },
    {
      file: 'photos/local-volume/m51-hubble.webp',
      largeFile: 'photos/local-volume/m51-hubble-large.webp',
      width: 640,
      height: 444,
      title: 'M51, the Whirlpool, from Hubble',
      caption:
        'A grand-design spiral near the Local Volume’s edge, its arms perhaps drawn out by NGC 5195, the small yellowish galaxy at the tip of one of them, which is passing behind it. Pink are its star-forming regions, blue its young clusters. Taken in January 2005.',
      colour: 'false',
      credit: 'NASA, ESA, S. Beckwith (STScI) and the Hubble Heritage Team (STScI/AURA)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2005-04-25',
      sourceUrl: 'https://esahubble.org/images/heic0506a/',
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The breadcrumb’s Local Volume puts the camera 100 million light years from the Sun, over the supergalactic pole, so the Local Sheet is seen face-on: the frame’s half-height is 7.4 megaparsecs, the groups about Sculptor, M81, Centaurus A, IC 342 and Canes Venatici inside it, and its half-width at 16:9 is 13 megaparsecs, past the 11-megaparsec edge, with the Virgo Cluster just beyond on the right. From Laniakea’s view outward the Local Volume is one place among its clusters, its galaxies’ names folded into its own, and then “You are here”.',
    },
    {
      title: 'Its galaxies, each where it is measured',
      text: 'The Updated Nearby Galaxy Catalog’s galaxies, less those McConnachie’s Local Group catalogue already holds: each on its sky position and at its catalogued distance, as bright as its measured light, of its measured shape. When the data was built, about a quarter of the distances were from the tip of the red giant branch, a quarter from how fast the galaxy turns, and about a third were estimates — the galaxy’s group’s distance, or its velocity’s — which its panel says.',
      cite: ['karachentsev2013', 'mcconnachie2012'],
    },
    {
      title: 'As volumes of light',
      text: 'Each a glow in space whose light along every line of sight is its surface brightness, by its kind: a dwarf as the Local Group’s dwarfs are, an ellipsoid; an elliptical by de Vaucouleurs’s law; a spiral as a disc, with a bulge for the earlier types. The catalogue gives no half-light radius, so it is estimated as 0.53 of the galaxy’s catalogued diameter’s radius, the median ratio of the galaxies both it and the Virgo catalogue measure — right to within a factor of 1.5.',
      cite: ['karachentsev2013', 'kim2014'],
    },
    {
      title: 'What is not known of each, said',
      text: 'Where a galaxy’s position angle is not measured, which way it is elongated on the sky is not known, and it is drawn round on the sky; its panel says so. Which side of a disc is nearer is measured for none. The Maffei galaxies are corrected for the Milky Way’s dust in front of them, as for all — so they come out among the brightest, as they would be seen from outside our galaxy.',
    },
    {
      title: 'The Local Sheet and the Council',
      text: 'In the Local Structure layer, off at first: McCall’s plane through the giant galaxies within 6 megaparsecs, and his ring, the Council of Giants, 3.75 megaparsecs in radius. Fits to where galaxies are, not things that shine.',
      cite: ['mccall2014'],
    },
  ],
  measured: [
    {
      title: 'The catalogue',
      text: '869 galaxies with distances within 11 megaparsecs, or velocities corrected to the Local Group under 600 km/s.',
      cite: ['karachentsev2013'],
    },
    {
      title: 'Star-by-star distances',
      text: 'The tip of the red giant branch, measured in deep Hubble images of galaxies’ outskirts, is a distance method as precise as Cepheids and independent of them, little troubled by dust or crowding.',
      cite: ['freedman2019'],
    },
    {
      title: 'Our motion',
      text: 'The Local Sheet’s motion, with the expansion taken out, is 631 km/s, the sum of three parts: 259 km/s away from the Local Void, 185 km/s toward the Virgo Cluster and its surroundings 17 megaparsecs away, and 455 km/s toward a concentration beyond 3,000 km/s centred near the Centaurus Cluster. Random motions within the Local Sheet are small.',
      cite: ['tully2008'],
    },
    {
      title: 'The Local Void',
      text: 'Its centre at least 23 megaparsecs away, 75 million light years; a dwarf galaxy in it moves away from its centre at 230 km/s or more.',
      cite: ['tully2008'],
    },
  ],
  estimated: [
    {
      title: 'The Council of Giants',
      text: 'The giant galaxies within 6 megaparsecs lie on a ring of radius 3.75 megaparsecs about the Local Group, in the Local Sheet, which is distinct from the larger Local Supercluster in both its shape and its motions.',
      cite: ['mccall2014'],
    },
    {
      title: 'Distances from velocity',
      text: 'For the galaxies with no measured distance, the catalogue’s estimate from their velocity by the Hubble law, or their group’s distance: the first can be badly wrong this close in, where a galaxy’s own motion is a large part of its velocity.',
      cite: ['karachentsev2013', 'tully2008'],
    },
  ],
  missing: [
    {
      title: 'What lies behind the Milky Way',
      text: 'Galaxies behind the dust of our own disc are hard to find: the Maffei galaxies, among the nearest large ones, are dimmed by some five and seven magnitudes in blue light by it. Few are catalogued there, and the map is thin.',
      cite: ['karachentsev2013'],
    },
    {
      title: 'The faintest dwarfs',
      text: 'Only the catalogued galaxies are drawn; the faintest dwarfs this far off are still being found.',
      cite: ['karachentsev2013'],
    },
    {
      title: 'Their gas and dark matter',
      text: 'Not drawn: their hydrogen, which in many dwarfs reaches far past their stars, and their dark halos. Their motions are not drawn either: every galaxy stands where it is.',
    },
  ],
  misconceptions: [
    {
      title: 'Galaxies are not spread evenly',
      text: 'Near us they lie in a thin sheet beside a great void; random motions within the sheet are small, as if it were one quiet stream.',
      cite: ['tully2008'],
    },
    {
      title: 'We are not standing still',
      text: 'Even with the expansion taken out, our galaxy moves at hundreds of kilometres a second, drawn toward Virgo and Centaurus and away from the Void.',
      cite: ['tully2008'],
    },
    {
      title: 'Its edge is a catalogue’s',
      text: 'The 11-megaparsec edge is where the catalogue was drawn, not a boundary in space: the galaxies carry on past it.',
      cite: ['karachentsev2013'],
    },
  ],
  sources: [
    {
      key: 'karachentsev2013',
      text: 'Karachentsev, I. D., Makarov, D. I., & Kaisina, E. I. 2013, Updated Nearby Galaxy Catalog, AJ 145, 101',
      url: 'https://doi.org/10.1088/0004-6256/145/4/101',
    },
    {
      key: 'mcconnachie2012',
      text: 'McConnachie, A. W. 2012, The Observed Properties of Dwarf Galaxies in and around the Local Group, AJ 144, 4',
      url: 'https://doi.org/10.1088/0004-6256/144/1/4',
    },
    {
      key: 'kim2014',
      text: 'Kim, S., et al. 2014, The Extended Virgo Cluster Catalog, ApJS 215, 22',
      url: 'https://doi.org/10.1088/0067-0049/215/2/22',
    },
    {
      key: 'freedman2019',
      text: 'Freedman, W. L., et al. 2019, The Carnegie-Chicago Hubble Program. VIII. An Independent Determination of the Hubble Constant Based on the Tip of the Red Giant Branch, ApJ 882, 34',
      url: 'https://doi.org/10.3847/1538-4357/ab2f73',
    },
    {
      key: 'tully2008',
      text: 'Tully, R. B., et al. 2008, Our Peculiar Motion Away from the Local Void, ApJ 676, 184',
      url: 'https://doi.org/10.1086/527428',
    },
    {
      key: 'mccall2014',
      text: 'McCall, M. L. 2014, A Council of Giants, MNRAS 440, 405',
      url: 'https://doi.org/10.1093/mnras/stu199',
    },
  ],
};
