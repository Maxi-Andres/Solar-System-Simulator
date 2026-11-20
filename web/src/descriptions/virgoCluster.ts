import { VIRGO_CLUSTER_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The Virgo Cluster: no body, so opened from its breadcrumb level's panel (state/levels.ts,
 * ui/LevelFacts.tsx). Every number here is from the source it cites; where a figure is a
 * model's rather than a measurement, it sits under "estimated" and says which model. What the
 * app draws of it is read off core/localVolume.ts (ELLIPTICAL_FITS, virgoCentre),
 * tools/src/localVolume/localVolume.ts (VIRGO_SUBSTRUCTURES, virgoPlacement) and scene/scale.ts
 * (VIRGO_FRAMING_KM).
 */
export const VIRGO_CLUSTER: Description = {
  id: VIRGO_CLUSTER_DESCRIPTION_ID,
  subject: { name: 'Virgo Cluster', kind: 'the nearest great cluster of galaxies' },
  lead: [
    'The nearest great city of galaxies. The light we see from it set out some 54 million years ago — about twelve million years after the asteroid that ended the age of the dinosaurs. Our Local Group is falling toward it, and will never arrive: we lie far outside the reach within which its pull has stopped the expansion of the universe, so even as we fall, the distance between us grows.',
    'Some 2,000 galaxies have been catalogued in its part of the sky, 16.5 megaparsecs away — 54 million light years — in the direction of the constellation Virgo. At its heart is M87, a giant elliptical galaxy of several trillion stars; around M49, a second giant, is a second clump, and behind both lie looser clouds of galaxies, one some 40% farther and two twice as far. Within some 7 megaparsecs of its centre everything is falling inward, and from that infall the cluster is weighed at about 800 trillion times the Sun’s mass, most of it dark matter.',
    'At M87’s centre is a black hole of 6.5 billion Suns, and from it a jet of plasma blasts out 3,000 light years. In 2019 a network of radio telescopes spanning the Earth, the Event Horizon Telescope, made the first image of a black hole’s shadow from it: a ring of glowing gas about 40 millionths of an arcsecond across — a credit card on the Moon, seen from Earth — dark at its middle.',
    'A cluster is not a quiet place. Thin gas fills the space between its galaxies, and a galaxy falling through it has its own gas torn out behind it as a tail; starlight lies scattered between the galaxies, stripped from them; M86 and M87 are moving toward each other. And it is still growing: the galaxies about it are falling in. Across its middle runs Markarian’s Chain, a curve of galaxies on the sky, at least seven of which move together.',
  ],
  photos: [
    {
      file: 'photos/laniakea/virgo-cluster.webp',
      largeFile: 'photos/laniakea/virgo-cluster-large.webp',
      width: 640,
      height: 638,
      title: 'The heart of the cluster',
      caption:
        'The Virgo Cluster from the Digitized Sky Survey 2’s plates, taken with the Palomar 48-inch Schmidt: M87 is at the centre, M84 and M86 the two bright galaxies of the group to its right, where Markarian’s Chain begins. Nearly every smudge is a galaxy. Blue and near-infrared plates, so not quite an eye’s colours.',
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
      title: 'The light between its galaxies',
      caption:
        'A very deep picture of the cluster’s core from the Burrell Schmidt telescope, M87 the large galaxy at lower left: the faint glow between the galaxies is starlight belonging to the cluster itself. The black discs are where bright foreground stars were taken out. One colour, tinted.',
      colour: 'tinted',
      credit: 'Chris Mihos (Case Western Reserve University)/ESO',
      licence: 'CC BY 4.0',
      date: '2009-05-20',
      sourceUrl: 'https://www.eso.org/public/images/eso0919a/',
    },
    {
      file: 'photos/virgo-cluster/m87-jet-hubble.webp',
      largeFile: 'photos/virgo-cluster/m87-jet-hubble-large.webp',
      width: 640,
      height: 512,
      title: 'M87 and its jet, from Hubble',
      caption:
        'The giant galaxy at the cluster’s heart, several trillion stars, and a jet of plasma 3,000 light years long blasting from its central black hole, shown blue. The faint points around it are some of its thousands of globular star clusters. Ultraviolet among its filters, so not an eye’s colours.',
      colour: 'false',
      credit: 'NASA, ESA, A. Lessing (Stanford University), E. Baltz (Stanford University), M. Shara (AMNH), J. DePasquale (STScI)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2024-09-26',
      sourceUrl: 'https://esahubble.org/images/heic2411b/',
    },
    {
      file: 'photos/virgo-cluster/eht-m87-2019.webp',
      largeFile: 'photos/virgo-cluster/eht-m87-2019-large.webp',
      width: 640,
      height: 372,
      title: 'The first image of a black hole, 2019',
      caption:
        'M87’s black hole from the Event Horizon Telescope, eight radio telescopes across the Earth timed by atomic clocks and combined into one: radio waves 1.3 mm long, recorded in April 2017, the image reconstructed from them. The dark centre is the shadow; the horizon itself, just under 40 billion km across, is about 2.5 times smaller. The colours stand for brightness, not for light anyone could see.',
      colour: 'false',
      credit: 'EHT Collaboration',
      licence: 'CC BY 4.0',
      date: '2019-04-10',
      sourceUrl: 'https://www.eso.org/public/images/eso1907a/',
    },
    {
      file: 'photos/virgo-cluster/eht-m87-polarised-2021.webp',
      largeFile: 'photos/virgo-cluster/eht-m87-polarised-2021-large.webp',
      width: 640,
      height: 646,
      title: 'The same black hole in polarised light, 2021',
      caption:
        'The lines show which way the radio waves are polarised, a trace of the magnetic field about the shadow: the first time polarisation was measured this close to the edge of a black hole. A reconstruction from radio data, in colours that stand for brightness.',
      colour: 'false',
      credit: 'EHT Collaboration',
      licence: 'CC BY 4.0',
      date: '2021-03-24',
      sourceUrl: 'https://www.eso.org/public/images/eso2105a/',
    },
    {
      file: 'photos/laniakea/virgo-m84.webp',
      largeFile: 'photos/laniakea/virgo-m84-large.webp',
      width: 640,
      height: 592,
      title: 'M84 and NGC 4388, from La Silla',
      caption:
        'Two of the cluster’s galaxies: the giant elliptical Messier 84, one end of Markarian’s Chain, at the centre, and the edge-on spiral NGC 4388 at lower left, taken in April 2000 with the Wide Field Imager at ESO’s La Silla Observatory. Black and white.',
      colour: 'true',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '2003-01-16',
      sourceUrl: 'https://www.eso.org/public/images/eso0304a/',
    },
    {
      file: 'photos/virgo-cluster/ic3418-tail.webp',
      largeFile: 'photos/virgo-cluster/ic3418-tail-large.webp',
      width: 640,
      height: 319,
      title: 'A galaxy losing its gas, IC 3418',
      caption:
        'A small galaxy that plunged into the gas of the cluster, and the tail of young stars that formed in what was torn out of it. Left, GALEX’s far and near ultraviolet in dark and light blue with the Sloan survey’s visible light in green and red: the tail shows. Right, the visible light alone: it does not. IC 3413, another member, is to its right.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/SDSS',
      licence: 'NASA media, not copyrighted',
      date: '2010-06-17',
      sourceUrl: 'https://images.nasa.gov/details/PIA13192',
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The breadcrumb’s Virgo Cluster centres on M87 and puts the camera 60 million light years from it, over the supergalactic pole, the Sun off to the left: the frame’s half-height, 4.4 megaparsecs, holds the members as they lie on the sky about M87, and its half-width, 8 megaparsecs, their depth along our line of sight, which runs across the frame.',
    },
    {
      title: 'Its galaxies',
      text: 'The Extended Virgo Cluster Catalog’s galaxies, photometered on Sloan images — only the certain members, inside the infall model’s caustic: those outside it are by definition not members, and the farther clouds are mostly such. Each as bright as its measured light and of its measured size, drawn as a volume of light as the Local Volume’s galaxies are. The giant ellipticals are Kormendy et al.’s own profile fits, out to their faint envelopes, which the catalogue’s photometry misses: M87 came out of it 1.0′ across and 0.6 magnitudes too faint.',
      cite: ['kim2014', 'kormendy2009'],
    },
    {
      title: 'Their distances',
      text: '79 members at their own distances, measured from how grainy their light looks — surface brightness fluctuations, by Mei et al. The rest, which have none, are placed by the cluster’s measured structure: each in its substructure on the sky — M87’s at 16.7 megaparsecs, M49’s at 16.4, the W′ cloud at 22.9, the W and M clouds at twice M87’s — and in front of or behind it by a draw from the cluster’s measured depth, 0.6 megaparsecs, seeded by its name so it stays put. Their panels say their distance is estimated.',
      cite: ['mei2007', 'gavazzi1999'],
    },
    {
      title: 'Its centre',
      text: 'The level is centred on M87, at its own measured distance, 17.2 megaparsecs: the middle of the cluster’s main body. Its panel shows the distance live, from the Sun.',
      cite: ['mei2007'],
    },
  ],
  measured: [
    {
      title: 'Its distance and depth',
      text: 'From the surface brightness fluctuations of 84 early-type galaxies imaged by Hubble: a mean of 16.5 ± 0.1 (± 1.1 systematic) megaparsecs for the 79 in the main body; M87’s subcluster at 16.7 ± 0.2 and M49’s at 16.4 ± 0.2; 2.4 ± 0.4 megaparsecs from back to front; the W′ cloud at about 23. The main body is slightly triaxial, its long axis 20–40° from our line of sight.',
      cite: ['mei2007'],
    },
    {
      title: 'Its catalogues',
      text: 'Binggeli, Sandage and Tammann’s Virgo Cluster Catalog of 1985 listed 2,096 galaxies in its area. The Extended Virgo Cluster Catalog of 2014: 1,589 galaxies under 3,000 km/s from Sloan data, 676 of them not in the older catalogue, with membership decided by an infall model.',
      cite: ['binggeli1985', 'kim2014'],
    },
    {
      title: 'Its farther clouds',
      text: 'The W and M clouds, by the H-band Fundamental Plane and Tully–Fisher relations, about twice as far as the cluster’s main body.',
      cite: ['gavazzi1999'],
    },
    {
      title: 'M87’s black hole',
      text: 'The Event Horizon Telescope’s 2017 observations at 1.3 mm: a ring 42 ± 3 microarcseconds across, its centre dark — the shadow predicted for a black hole — giving a mass of 6.5 billion Suns. Part of the ring is polarised, up to about 15%, its angles running nearly round the ring: a trace of the magnetic field there.',
      cite: ['eht2019a', 'eht2019f', 'heic2411', 'eht2021'],
    },
    {
      title: 'Its jet',
      text: 'About 3,000 light years long in Hubble’s images, blasting from the black hole; novae go off twice as often near it as elsewhere in the galaxy.',
      cite: ['heic2411'],
    },
    {
      title: 'Its core in motion',
      text: 'M87’s halo of stars is cut short at about a million light years across, and M87 and M86 are moving toward each other.',
      cite: ['eso0919'],
    },
  ],
  estimated: [
    {
      title: 'Its mass and its reach',
      text: 'From the infall of the galaxies about it, measured with Hubble, under the assumption of spherical, radial infall: a zero-velocity radius of 7.2 ± 0.7 megaparsecs and a total mass of (8.0 ± 2.3) × 10¹⁴ times the Sun’s, in good agreement with its virial mass; no great mass of dark matter lies past its virial radius.',
      cite: ['karachentsev2014'],
    },
    {
      title: 'Our fall toward it',
      text: 'Of the Local Sheet’s motion, with the expansion taken out, 185 km/s is toward Virgo and its surroundings.',
      cite: ['tully2008'],
    },
    {
      title: 'When its light left',
      text: '54 million light years is a light-travel time of about 54 million years; the extinction that ended the non-avian dinosaurs was about 66 million years ago.',
      cite: ['mei2007', 'renne2013'],
    },
  ],
  missing: [
    {
      title: 'The possible members',
      text: 'Not drawn: the catalogue’s galaxies outside the infall model’s caustic, about a third of it, the W and M clouds’ galaxies mostly among them, whose distances are not known to a factor of two.',
      cite: ['kim2014'],
    },
    {
      title: 'Its gas, its scattered light and its dark matter',
      text: 'Not drawn: the hot, thin gas that fills the cluster, the starlight scattered between its galaxies, and the dark matter that is most of its mass. Only its galaxies’ own light is.',
    },
    {
      title: 'Most of its distances',
      text: 'Only 79 members have their own measured distance; the rest are placed by a draw from the cluster’s depth, true to the cluster as a whole but not to any one galaxy.',
      cite: ['mei2007'],
    },
  ],
  misconceptions: [
    {
      title: 'We are not in it',
      text: 'Its pull has stopped the expansion only within about 7 megaparsecs of its centre; we are some 16 megaparsecs away, falling toward it but carried away faster.',
      cite: ['karachentsev2014', 'tully2008'],
    },
    {
      title: 'The black hole image is not a photograph',
      text: 'It is reconstructed from radio waves 1.3 mm long recorded at telescopes thousands of kilometres apart; its colours stand for brightness. And it shows the shadow, not the black hole, which is about 2.5 times smaller.',
      cite: ['eso1907'],
    },
    {
      title: 'A cluster is not finished',
      text: 'Galaxies are still falling into it from all round, and are stripped of their gas as they plunge through it.',
      cite: ['karachentsev2014'],
    },
  ],
  sources: [
    {
      key: 'mei2007',
      text: 'Mei, S., et al. 2007, The ACS Virgo Cluster Survey. XIII. SBF Distance Catalog and the Three-dimensional Structure of the Virgo Cluster, ApJ 655, 144',
      url: 'https://doi.org/10.1086/509598',
    },
    {
      key: 'binggeli1985',
      text: 'Binggeli, B., Sandage, A., & Tammann, G. A. 1985, Studies of the Virgo Cluster. II. A catalog of 2096 galaxies in the Virgo Cluster area, AJ 90, 1681',
      url: 'https://doi.org/10.1086/113874',
    },
    {
      key: 'kim2014',
      text: 'Kim, S., et al. 2014, The Extended Virgo Cluster Catalog, ApJS 215, 22',
      url: 'https://doi.org/10.1088/0067-0049/215/2/22',
    },
    {
      key: 'gavazzi1999',
      text: 'Gavazzi, G., et al. 1999, The 3D structure of the Virgo cluster from H-band Fundamental Plane and Tully–Fisher distance determinations, MNRAS 304, 595',
      url: 'https://doi.org/10.1046/j.1365-8711.1999.02350.x',
    },
    {
      key: 'kormendy2009',
      text: 'Kormendy, J., Fisher, D. B., Cornell, M. E., & Bender, R. 2009, Structure and Formation of Elliptical and Spheroidal Galaxies, ApJS 182, 216',
      url: 'https://doi.org/10.1088/0067-0049/182/1/216',
    },
    {
      key: 'karachentsev2014',
      text: 'Karachentsev, I. D., et al. 2014, Infall of Nearby Galaxies into the Virgo Cluster as Traced with Hubble Space Telescope, ApJ 782, 4',
      url: 'https://doi.org/10.1088/0004-637X/782/1/4',
    },
    {
      key: 'tully2008',
      text: 'Tully, R. B., et al. 2008, Our Peculiar Motion Away from the Local Void, ApJ 676, 184',
      url: 'https://doi.org/10.1086/527428',
    },
    {
      key: 'eht2019a',
      text: 'Event Horizon Telescope Collaboration 2019, First M87 Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole, ApJL 875, L1',
      url: 'https://doi.org/10.3847/2041-8213/ab0ec7',
    },
    {
      key: 'eht2019f',
      text: 'Event Horizon Telescope Collaboration 2019, First M87 Event Horizon Telescope Results. VI. The Shadow and Mass of the Central Black Hole, ApJL 875, L6',
      url: 'https://doi.org/10.3847/2041-8213/ab1141',
    },
    {
      key: 'eht2021',
      text: 'Event Horizon Telescope Collaboration 2021, First M87 Event Horizon Telescope Results. VII. Polarization of the Ring, ApJL 910, L12',
      url: 'https://doi.org/10.3847/2041-8213/abe71d',
    },
    {
      key: 'eso1907',
      text: 'ESO, First Image of a Black Hole (eso1907a), image caption',
      url: 'https://www.eso.org/public/images/eso1907a/',
    },
    {
      key: 'heic2411',
      text: 'ESA/Hubble, M87 (heic2411b), image caption',
      url: 'https://esahubble.org/images/heic2411b/',
    },
    {
      key: 'eso0919',
      text: 'ESO, Giant Galaxy Messier 87 finally sized up (eso0919), press release',
      url: 'https://www.eso.org/public/news/eso0919/',
    },
    {
      key: 'renne2013',
      text: 'Renne, P. R., et al. 2013, Time Scales of Critical Events Around the Cretaceous-Paleogene Boundary, Science 339, 684',
      url: 'https://doi.org/10.1126/science.1230492',
    },
  ],
};
