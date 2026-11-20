import type { Description } from './types.ts';

/**
 * Polaris. A catalogue star made a body at run time (core/starBodies.ts), found by its Hipparcos
 * number; its measured facts are core/brightStars.ts's, and it is drawn as a point at Hipparcos's
 * distance. Where that distance is disputed, all three measurements are given.
 */
export const POLARIS: Description = {
  id: 'polaris',
  catalogueStar: { designations: ['HIP 11767'] },
  lead: [
    'The star the northern sky turns around. Polaris sits less than a degree from the point Earth’s axis aims at, so while every other star wheels across the sky through the night, it stays put, due north, as high above the horizon as the observer is far from the equator. For centuries travellers and sailors in the north steered by it and read their latitude off it. It will not always be there: Earth’s axis wobbles round once in about 26,000 years, and in some 12,000 years the north star will be Vega.',
    'It is not the brightest star, as is often thought — at about magnitude 2 it has dozens brighter — but it is a remarkable one. Polaris is a yellow supergiant and a Cepheid: it swells and shrinks every 3.97 days, its light rising and falling with it. Cepheids are the stars whose rhythm gives their true brightness, and so their distance — the first rung of the ladder by which the universe is measured — and Polaris is the nearest of them.',
    'It is three stars. A small telescope shows a wide companion, Polaris B, first noticed by William Herschel in 1780. A third, Polaris Ab, so close to the bright star that it was known only from its pull until Hubble photographed it in 2005, goes round it in about thirty years — and its orbit, followed since, has weighed Polaris at five times the Sun’s mass.',
    'For all that is measured of it, how far away it is is still argued: about 430 to 520 light years, depending on whose parallax is taken. For the nearest Cepheid, the star that should anchor the scale, that is an awkward thing not to know.',
  ],
  photos: [
    {
      file: 'photos/polaris/star-trails-kitt-peak.webp',
      largeFile: 'photos/polaris/star-trails-kitt-peak-large.webp',
      width: 640,
      height: 421,
      title: 'The sky turning about Polaris, Kitt Peak',
      caption:
        'A long exposure over Kitt Peak National Observatory in Arizona: as Earth turns, every star draws an arc about the north celestial pole, and Polaris, almost on it, sits at the centre of the circles, above the dome of the Mayall telescope. The yellow glow on the horizon is Tucson.',
      colour: 'true',
      credit: 'KPNO/NOIRLab/NSF/AURA',
      licence: 'CC BY 4.0',
      date: '2020-08-12',
      sourceUrl: 'https://noirlab.edu/public/images/iotw2033a/',
    },
    {
      file: 'photos/polaris/hubble-triple.webp',
      largeFile: 'photos/polaris/hubble-triple-large.webp',
      width: 640,
      height: 512,
      title: 'Polaris is three stars',
      caption:
        'A chart of where Polaris sits, at the end of the Little Dipper’s handle; Hubble’s view of Polaris A and its wide companion B; and, closer in, the faint companion Ab just beside A, seen directly for the first time. Hubble’s images are near-ultraviolet light, at 220 nm, shown in grey.',
      colour: 'false',
      credit: 'NASA, ESA, N. Evans (Harvard-Smithsonian CfA) and H. Bond (STScI)',
      licence: 'CC BY 4.0',
      date: '2006-01-09',
      sourceUrl: 'https://esahubble.org/images/opo0602a/',
    },
    {
      file: 'photos/polaris/hubble-polaris-ab.webp',
      largeFile: 'photos/polaris/hubble-polaris-ab-large.webp',
      width: 550,
      height: 550,
      title: 'Polaris A and Polaris Ab',
      caption:
        'The close companion is the small knot at the lower right of the bright Cepheid’s core, in Hubble’s near-ultraviolet image of August 2005; the spikes and the halo are the telescope’s optics.',
      colour: 'false',
      credit: 'NASA, ESA, N. Evans (Harvard-Smithsonian CfA) and H. Bond (STScI)',
      licence: 'CC BY 4.0',
      date: '2005-08',
      sourceUrl: 'https://esahubble.org/images/opo0602d/',
    },
  ],
  drawnHere: [
    {
      title: 'Where it is',
      text:
        'At Hipparcos’s distance, 133 parsecs, 434 light years, from its parallax of 7.54 ± 0.11 milliarcseconds. Two other measurements put it farther: 136.9 parsecs from the Gaia parallax of its companion Polaris B, the distance Evans et al. take, and 160 from Hubble’s parallax of Polaris B. The app keeps the catalogue’s.',
      cite: ['vanleeuwen2007', 'evans2024', 'bond2018'],
    },
    {
      title: 'Why it stays a point',
      text:
        'Its radius is measured, 46.3 times the Sun’s, but at 136.9 parsecs, not the 133 it is drawn at, and its size changes as it pulsates; a disc of it would be drawn at a size measured for another distance. So it is a point.',
      cite: ['evans2024'],
    },
    {
      title: 'What is not drawn',
      text: 'Its 3.97-day pulsation, its companions and their orbit: it shines here at its catalogue brightness, steady and alone.',
      cite: ['evans2024'],
    },
  ],
  measured: [
    {
      title: 'Its mass',
      text:
        '5.13 ± 0.28 times the Sun’s, from the orbit of Polaris Ab, followed with the CHARA Array’s interferometer from 2016 to 2021 — and brighter than models of stars predict for that mass.',
      cite: ['evans2024'],
    },
    {
      title: 'Its size and pulse',
      text:
        'Radius 46.3 times the Sun’s at 136.9 parsecs; it pulsates every 3.97 days, its measured angular size changing with it. CHARA’s images suggest spots on its surface, and a 120-day ripple in its light that may be how long it takes to turn.',
      cite: ['evans2024'],
    },
    {
      title: 'Its companions',
      text:
        'Polaris Ab, known from its pull, was first seen in Hubble’s near-ultraviolet images of 2005; its orbit about A takes about 30 years. Polaris B, far wider, has been seen since 1780.',
      cite: ['evans2008', 'evans2024', 'esahubble2006'],
    },
    {
      title: 'Its distance, three ways',
      text:
        'Hipparcos: 7.54 ± 0.11 milliarcseconds, 133 parsecs. Hubble’s Fine Guidance Sensors, for Polaris B: 6.26 ± 0.24, 160 parsecs. Gaia, for Polaris B: 136.9 parsecs. They do not agree within their errors; why is not settled.',
      cite: ['vanleeuwen2007', 'bond2018', 'evans2024'],
    },
  ],
  estimated: [
    {
      title: 'How it pulsates',
      text:
        'If it is as far as Hubble’s parallax puts it, it is so luminous that it must be pulsating in an overtone — a higher harmonic — not its fundamental mode, which then sits oddly with its period. And Polaris B’s age from models, about 2.1 billion years, does not match the young Cepheid’s: either B is not truly its companion, or one of them is the product of a merger.',
      cite: ['bond2018'],
    },
  ],
  missing: [
    {
      title: 'Which distance is right',
      text: 'Not known. Bond et al. note that Hipparcos seems to have overestimated other parallaxes too, the Pleiades’ among them, and hoped Gaia would settle it; Gaia’s for Polaris B has not. None is preferred here: the catalogue’s is simply kept.',
      cite: ['bond2018', 'evans2024'],
    },
  ],
  misconceptions: [
    {
      title: 'Not the brightest star',
      text: 'The North Star is often taken for the brightest. It is about magnitude 2; Sirius, Vega and dozens more outshine it. What sets it apart is where it is.',
      cite: ['apod2015'],
    },
    {
      title: 'Not forever the North Star',
      text: 'Earth’s axis precesses like a spinning top’s, once in about 26,000 years; in some 12,000 years Vega will be the star nearest the north pole.',
      cite: ['apod2015'],
    },
    {
      title: 'Not one star',
      text: 'It is a triple: the Cepheid, a close companion seen only by Hubble, and a wide one a small telescope shows.',
      cite: ['esahubble2006'],
    },
  ],
  sources: [
    {
      key: 'evans2024',
      text: 'Evans, N. R., Schaefer, G. H., et al. 2024, The Orbit and Dynamical Mass of Polaris: Observations with the CHARA Array, ApJ 971, 190',
      url: 'https://doi.org/10.3847/1538-4357/ad5e7a',
    },
    {
      key: 'bond2018',
      text: 'Bond, H. E., Nelan, E. P., et al. 2018, Hubble Space Telescope Trigonometric Parallax of Polaris B, Companion of the Nearest Cepheid, ApJ 853, 55',
      url: 'https://doi.org/10.3847/1538-4357/aaa3f9',
    },
    {
      key: 'evans2008',
      text: 'Evans, N. R., Schaefer, G. H., et al. 2008, Direct Detection of the Close Companion of Polaris with the Hubble Space Telescope, AJ 136, 1137',
      url: 'https://doi.org/10.1088/0004-6256/136/3/1137',
    },
    {
      key: 'vanleeuwen2007',
      text: 'van Leeuwen, F. 2007, Validation of the new Hipparcos reduction, A&A 474, 653',
      url: 'https://doi.org/10.1051/0004-6361:20078357',
    },
    {
      key: 'esahubble2006',
      text: 'ESA/Hubble 2006, Hubble Images Polaris’s Companion (opo0602a)',
      url: 'https://esahubble.org/images/opo0602a/',
    },
    {
      key: 'apod2015',
      text: 'NASA, Astronomy Picture of the Day, 8 May 2015, When Vega Is North',
      url: 'https://science.nasa.gov/image-article/apod-2015-may-8-when-vega-is-north/',
    },
    {
      key: 'ballesteros2012',
      text: 'Ballesteros, F. J. 2012, New insights into black bodies, EPL 97, 34008',
      url: 'https://doi.org/10.1209/0295-5075/97/34008',
    },
  ],
};
