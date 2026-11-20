import type { Description, DescriptionPhoto, DescriptionPoint, DescriptionSource } from './types.ts';

/**
 * Sirius A and its white dwarf, Sirius B. Both are catalogue stars made bodies at run time
 * (core/siriusBodies.ts), found by their designations; what is drawn of them is read off
 * core/sirius.ts, core/orbitingStars.ts and scene/SiriusOrbits.tsx. The pair shares its
 * photographs, its orbit and most of its sources.
 */

const PHOTOS: readonly DescriptionPhoto[] = [
  {
    file: 'photos/sirius/canis-major-paranal.webp',
    largeFile: 'photos/sirius/canis-major-paranal-large.webp',
    width: 640,
    height: 515,
    title: 'Sirius over the road to Paranal',
    caption:
      'The brightest star of the night is the one at the top left, the neck of Canis Major, the Greater Dog; the bright star on the right is Canopus, the second brightest. Below, the winding road up to ESO’s Very Large Telescope in Chile.',
    colour: 'true',
    credit: 'ESO/Y. Beletsky',
    licence: 'CC BY 4.0',
    date: '2009-12-03',
    sourceUrl: 'https://www.eso.org/public/images/yb_big_dog_paranal_cc/',
  },
  {
    file: 'photos/sirius/hubble-a-and-b.webp',
    largeFile: 'photos/sirius/hubble-a-and-b-large.webp',
    width: 369,
    height: 403,
    title: 'Sirius A and the white dwarf beside it, from Hubble',
    caption:
      'Sirius A, overexposed so that Sirius B — the small dot at the lower left, about 10,000 times fainter — shows at all. The cross and the rings are the telescope’s own optics. Taken on 15 October 2003 with the Wide Field and Planetary Camera 2, in light shown blue by convention.',
    colour: 'false',
    credit: 'NASA, ESA, H. Bond (STScI) and M. Barstow (University of Leicester)',
    licence: 'CC BY 4.0',
    date: '2003-10-15',
    sourceUrl: 'https://esahubble.org/images/heic0516a/',
  },
  {
    file: 'photos/sirius/chandra-xray.webp',
    largeFile: 'photos/sirius/chandra-xray-large.webp',
    width: 465,
    height: 367,
    title: 'Sirius in X-rays, 28 October 1999',
    caption:
      'In X-rays the order is reversed: the bright source is Sirius B, the hot white dwarf, and the faint one beside it is at Sirius A’s place — perhaps A’s ultraviolet leaking through the detector’s filter. Shown in false colour.',
    colour: 'false',
    credit: 'NASA/SAO/CXC',
    licence: 'Chandra media, no copyright asserted; credit requested',
    date: '1999-10-28',
    sourceUrl: 'https://chandra.harvard.edu/photo/2000/0065/',
  },
];

/** How both are placed, read off core/sirius.ts, core/orbitingStars.ts and scene/SiriusOrbits.tsx. */
const PAIR_DRAWN: readonly DescriptionPoint[] = [
  {
    title: 'Where it is',
    text:
      'On the orbit Bond et al. measured for the pair — B about A in 50.13 years, eccentricity 0.59 — shared out by their masses about a barycentre that moves on a straight line. That barycentre is worked out here, not published: Sirius A’s Hipparcos position and motion in 1991 less A’s own orbital offset and motion then. The paper does not say which node of the orbit is the ascending one, so which of the two is nearer us at a given moment is this app’s convention, not a measurement.',
    cite: ['bond2017', 'vanleeuwen2007'],
  },
  {
    title: 'Its distance',
    text:
      'The pair’s parallax as Bond et al. adopt it, 378.9 milliarcseconds — 2.64 parsecs, 8.61 light years — a weighted mean of Hipparcos’s and a ground-based one. Gaia’s parallax for B, measured in A’s glare, falls about 4 milliarcseconds short and is not used.',
    cite: ['bond2017', 'vanleeuwen2007'],
  },
  {
    title: 'The orbits',
    text: 'A’s and B’s paths about their barycentre are drawn in each star’s colour from a few pixels across until the camera is a dozen of their radii away.',
  },
];

const PAIR_ORBIT: DescriptionPoint = {
  title: 'The orbit',
  text:
    'From Hubble’s images of the pair and a century of measurements from the ground: 50.13 years round, eccentricity 0.59; the two come within 8.1 AU of each other and draw apart to 31.5. They were last closest in 1994 and will be again in 2044.',
  cite: ['bond2017'],
};

const DISCOVERY: DescriptionPoint = {
  title: 'How B was found',
  text:
    'In 1844 Friedrich Bessel found Sirius weaving as it moved across the sky and saw that something dark must be pulling it. In 1862 Alvan G. Clark and his father, the telescope makers, saw that something: Sirius B.',
  cite: ['bond2017'],
};

const COMMON_SOURCES: readonly DescriptionSource[] = [
  {
    key: 'bond2017',
    text: 'Bond, H. E., Schaefer, G. H., et al. 2017, The Sirius System and Its Astrophysical Puzzles: Hubble Space Telescope and Ground-based Astrometry, ApJ 840, 70',
    url: 'https://doi.org/10.3847/1538-4357/aa6af8',
  },
  {
    key: 'vanleeuwen2007',
    text: 'van Leeuwen, F. 2007, Validation of the new Hipparcos reduction, A&A 474, 653',
    url: 'https://doi.org/10.1051/0004-6361:20078357',
  },
  {
    key: 'esahubble2005',
    text: 'ESA/Hubble 2005, Astronomers use Hubble to ‘weigh’ Dog Star’s companion (release heic0516)',
    url: 'https://esahubble.org/news/heic0516/',
  },
  {
    key: 'ballesteros2012',
    text: 'Ballesteros, F. J. 2012, New insights into black bodies, EPL 97, 34008',
    url: 'https://doi.org/10.1209/0295-5075/97/34008',
  },
];

export const SIRIUS_A: Description = {
  id: 'sirius',
  catalogueStar: { designations: ['HIP 32349', 'alf CMa A'] },
  lead: [
    'The brightest star in the night sky, watched and named for as long as people have written about the sky. It is bright less because it is great than because it is near: 8.6 light years away, one of the Sun’s closest neighbours. And beside it, ten thousand times fainter, goes Sirius B, the nearest white dwarf — the burnt-out core of a star that was once the heavier of the two, the Sun’s mass in a ball smaller than Earth: the end that waits for the Sun.',
    'Sirius A is a hot white star: twice the Sun’s mass, 1.7 times its width, its surface nearly 10,000 degrees, and about 25 times as luminous. It is young, some 240 million years old, a twentieth of the Sun’s age. Its name comes from the Greek for “glowing”; it is the Dog Star, in the constellation Canis Major.',
    'In 1844 Friedrich Bessel noticed that Sirius weaves as it moves across the sky and concluded that something unseen was pulling it; in 1862 the telescope makers Alvan Clark and his son saw it. The two stars go round each other every 50 years, coming within 8 times the Earth–Sun distance and drawing apart to 31; they were last closest in 1994 and will be again in 2044.',
  ],
  photos: PHOTOS,
  drawnHere: PAIR_DRAWN,
  measured: [
    {
      title: 'Mass',
      text: '2.063 ± 0.023 times the Sun’s, weighed by the orbit together with the parallax and A’s own motion about the barycentre.',
      cite: ['bond2017'],
    },
    {
      title: 'Size, temperature and light',
      text:
        'Radius 1.7144 times the Sun’s, about 1.19 million km, from its angular diameter measured by interferometry, at Bond et al.’s parallax; surface 9,845 K; 24.7 times the Sun’s luminosity.',
      cite: ['davis2011', 'bond2017'],
    },
    PAIR_ORBIT,
    DISCOVERY,
    {
      title: 'No third body',
      text: 'Hubble’s astrometry rules out a third body going round either star down to 15 to 25 Jupiter masses.',
      cite: ['bond2017'],
    },
  ],
  estimated: [
    {
      title: 'Its age',
      text:
        'About 237 to 247 million years, ± 15, from models of how a star of its mass, size and light evolves — which fit only if it holds slightly fewer heavy elements than the Sun. It agrees with Sirius B’s age, worked out separately.',
      cite: ['bond2017'],
    },
  ],
  missing: [
    {
      title: 'Planets',
      text: 'None is known; none larger than 15 to 25 Jupiter masses can be there, and smaller ones have not been ruled out.',
      cite: ['bond2017'],
    },
    {
      title: 'Its surface',
      text: 'Not mapped: the disc is drawn plain, darker only toward its edge, with the Sun’s limb darkening taken as its own.',
    },
  ],
  misconceptions: [
    {
      title: 'Bright, not mighty',
      text:
        'Sirius is the brightest star in the sky because it is close. At 25 times the Sun’s light it is modest beside the supergiants of the sky, which look fainter only because they are hundreds of times farther away.',
      cite: ['bond2017'],
    },
    {
      title: 'Not one star',
      text: 'It looks single to the eye; its white dwarf is there beside it, ten thousand times fainter and lost in its glare.',
      cite: ['esahubble2005'],
    },
  ],
  sources: [
    ...COMMON_SOURCES,
    {
      key: 'davis2011',
      text: 'Davis, J., Ireland, M. J., et al. 2011, The Angular Diameter and Fundamental Parameters of Sirius A, PASA 28, 58',
      url: 'https://doi.org/10.1071/as10010',
    },
  ],
};

export const SIRIUS_B: Description = {
  id: 'sirius-b',
  catalogueStar: { designations: ['alf CMa B', 'GJ 244 B'] },
  lead: [
    'A star that has died. Sirius B was once the heavier and brighter of the pair; it used up its fuel first, swelled, shed its outer layers and left only its core — a white dwarf, the Sun’s mass packed into a ball smaller than Earth, so dense that a teaspoon of it would weigh more than ten tonnes. It makes no energy any more. It only cools, slowly, as the Sun will one day when its own fuel is gone.',
    'It is the nearest white dwarf, 8.6 light years away, beside the brightest star in the sky, and ten thousand times fainter than it. Its pull was felt before it was seen: in 1844 Friedrich Bessel noticed Sirius weaving as it moved and concluded that something unseen was tugging it, and in 1862 the telescope makers Alvan Clark and his son found it.',
    'Its surface is at 25,000 degrees, hotter than Sirius A’s, but it is so small that in visible light it is a faint speck in its partner’s glare; in X-rays it outshines it. Its gravity at the surface is over 400,000 times Earth’s, and the light leaving it is stretched to redder wavelengths climbing out — a stretch Hubble measured, weighing the star by it at 98% of the Sun’s mass.',
  ],
  photos: PHOTOS,
  drawnHere: [
    ...PAIR_DRAWN,
    {
      title: 'Its colour',
      text:
        'Taken, as every star’s is, from its catalogue colour index — B−V −0.07, transformed from Gaia’s photometry — read as a blackbody. That is about 11,000 K: B−V does not pin down a white dwarf’s temperature, and B is drawn less blue than its 25,369 K surface would be.',
      cite: ['ballesteros2012', 'bond2017'],
    },
  ],
  measured: [
    {
      title: 'Mass',
      text: '1.018 ± 0.011 times the Sun’s, weighed by the orbit; Hubble’s measurement of its gravitational redshift gave 98% of the Sun’s, independently.',
      cite: ['bond2017', 'barstow2005', 'esahubble2005'],
    },
    {
      title: 'Size and temperature',
      text:
        'Radius 0.008098 ± 0.000046 times the Sun’s — 5,630 km, smaller than Earth’s 6,371 — from how much light it gives at its distance; surface 25,369 ± 46 K, from fitting model atmospheres to Hubble’s spectra of it.',
      cite: ['bond2017'],
    },
    PAIR_ORBIT,
    DISCOVERY,
  ],
  estimated: [
    {
      title: 'Its age',
      text:
        'It has been cooling as a white dwarf for about 126 million years, and was a star for about a hundred million years before that: 228 ± 10 million years in all, from models — consistent with Sirius A’s own age.',
      cite: ['bond2017'],
    },
    {
      title: 'Its density',
      text: 'From its mass and radius: about 2.7 tonnes to the cubic centimetre on average, so a 5 cm³ teaspoon would hold some 13 tonnes.',
      cite: ['bond2017'],
    },
  ],
  missing: [
    {
      title: 'Its past',
      text:
        'How the two stars may have affected each other when B swelled into a giant is not known; there is no direct evidence that they interacted, and their orbit is still strongly elongated.',
      cite: ['bond2017'],
    },
  ],
  misconceptions: [
    {
      title: 'It does not burn',
      text: 'A white dwarf has used up its nuclear fuel: no fusion goes on in it any more. It shines by the heat it still holds, and fades as it cools.',
      cite: ['esahubble2005'],
    },
    {
      title: 'Small is not light',
      text: 'It is smaller than Earth and still heavier than the Sun: its size says nothing of its mass.',
      cite: ['bond2017'],
    },
  ],
  sources: [
    ...COMMON_SOURCES,
    {
      key: 'barstow2005',
      text: 'Barstow, M. A., Bond, H. E., et al. 2005, Hubble Space Telescope spectroscopy of the Balmer lines in Sirius B, MNRAS 362, 1134',
      url: 'https://doi.org/10.1111/j.1365-2966.2005.09359.x',
    },
  ],
};
