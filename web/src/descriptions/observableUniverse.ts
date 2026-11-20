import { OBSERVABLE_UNIVERSE_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The observable universe: no body, so opened from its breadcrumb level's panel
 * (state/levels.ts, ui/LevelFacts.tsx), which offered the CMB's until this was written. Every
 * number here is from the source it cites; where a figure is a model's rather than a
 * measurement, it sits under "estimated" and says which model. What the app draws of it is read
 * off core/cosmology.ts, scene/scale.ts (MAX_VIEW_DISTANCE_KM, OBSERVABLE_UNIVERSE_FRAMING_KM),
 * scene/cmb.ts, core/quasars.ts, core/recordHolders.ts, core/farLandmarks.ts and
 * scene/homeName.ts.
 */
export const OBSERVABLE_UNIVERSE: Description = {
  id: OBSERVABLE_UNIVERSE_DESCRIPTION_ID,
  subject: { name: 'Observable Universe', kind: 'all we can ever have seen' },
  lead: [
    'It is not the universe. It is only the part of the universe whose light has had time to reach us since the beginning — a sphere with us at its centre, as every observer anywhere is at the centre of a sphere of their own. Its edge is not a wall at the end of things, but a horizon in time: past it there is, as far as anyone can tell, more universe, whose light is still on its way, or never will arrive.',
    'The universe is 13.8 billion years old, so no light has travelled longer than that; yet the sphere is about 46 billion light years in radius. The light from its far parts set out when they were close, and the space it crossed has been stretching all the while: the places it left are now three times farther than it has travelled. At 45 billion light years lies the oldest light there is, the cosmic microwave background, sent out when the universe was 380,000 years old and first became transparent. Before that it was opaque, and nothing earlier can be seen in light.',
    'Inside it there may be some two trillion galaxies — an estimate, since most of them are too faint for any telescope yet. The deep fields show how crowded it is: a patch of sky smaller than a grain of sand at arm’s length holds thousands of galaxies, some seen as they were a few hundred million years after the beginning. The farthest confirmed, MoM-z14, is seen as it was 280 million years after the Big Bang. Between them all runs the same web of walls, threads and voids seen nearby, and the most luminous things in it, quasars, have been mapped by the hundreds of thousands to nearly 30 billion light years.',
    'Its edge moves. Every year, light from a little farther reaches us and the sphere grows. But the expansion is speeding up, and that sets a second, sadder horizon: a signal sent from Earth today can only ever reach galaxies now within about 16 to 17 billion light years. Everything beyond, though we may still see its old light, is already out of reach for ever.',
  ],
  photos: [
    {
      file: 'photos/hubble/deep-field-1995.webp',
      largeFile: 'photos/hubble/deep-field-1995-large.webp',
      width: 467,
      height: 480,
      title: 'The Hubble Deep Field, December 1995',
      caption:
        'Ten days on one tiny patch of sky near the Big Dipper that looked empty: nearly everything in it is a galaxy, some seen as they were less than a billion years after the Big Bang. The picture that showed how full the observable universe is. Ultraviolet, blue, red and near-infrared filters shown as visible colours.',
      colour: 'false',
      credit: 'NASA/JPL/STScI Hubble Deep Field Team',
      licence: 'NASA media; credit requested',
      date: '1995-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA12110',
    },
    {
      file: 'photos/hubble/xdf-2012.webp',
      largeFile: 'photos/hubble/xdf-2012-large.webp',
      width: 640,
      height: 558,
      title: 'The eXtreme Deep Field, 2012',
      caption:
        'Ten years of Hubble’s exposures stacked on the centre of the Ultra Deep Field: about 5,500 galaxies in a patch of sky much smaller than the full Moon, the faintest one ten-billionth as bright as the eye can see. Its filters reach into the near infrared, shown in visible colours.',
      colour: 'false',
      credit: 'NASA; ESA; G. Illingworth, D. Magee, and P. Oesch, University of California, Santa Cruz; R. Bouwens, Leiden University; and the HUDF09 Team',
      licence: 'NASA media; credit requested',
      date: '2012-09-25',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001651',
    },
    {
      file: 'photos/jwst/first-deep-field-2022.webp',
      largeFile: 'photos/jwst/first-deep-field-2022-large.webp',
      width: 640,
      height: 653,
      title: 'Webb’s First Deep Field, July 2022',
      caption:
        'The galaxy cluster SMACS 0723, whose mass bends and magnifies the light of galaxies far behind it into arcs. Thousands of galaxies in a patch of sky about the size of a grain of sand held at arm’s length. Near-infrared light shown in visible colours.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI',
      licence: 'NASA media; credit requested',
      date: '2022-07-12',
      sourceUrl: 'https://images.nasa.gov/details/webb_first_deep_field',
    },
    {
      file: 'photos/observable-universe/jades-goods-south.webp',
      largeFile: 'photos/observable-universe/jades-goods-south-large.webp',
      width: 640,
      height: 449,
      title: 'Part of the JADES field, from Webb',
      caption:
        'Part of GOODS-South, a patch of sky Hubble had long studied, through nine of Webb’s near-infrared filters from 0.9 to 4.4 µm: more than 45,000 galaxies, among them hundreds seen when the universe was less than 600 million years old. Colours stand for infrared bands.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, B. Robertson (UC Santa Cruz), B. Johnson (CfA), S. Tacchella (Cambridge), M. Rieke (University of Arizona), D. Eisenstein (CfA), A. Pagan (STScI)',
      licence: 'CC BY 4.0 (ESA/Webb)',
      date: '2023-06-05',
      sourceUrl: 'https://esawebb.org/images/JADES2/',
    },
    {
      file: 'photos/cmb/planck-2018.webp',
      largeFile: 'photos/cmb/planck-2018-large.webp',
      width: 640,
      height: 323,
      title: 'Its wall: the whole sky in microwaves, from Planck',
      caption:
        'The cosmic microwave background, the oldest light, from every direction at once: the edge of what can be seen in light, on an oval map of the whole sky. Its tiny temperature differences, warmer in red, cooler in blue — a few hundred millionths of a degree either side of 2.7 K. Every colour stands for a temperature.',
      colour: 'false',
      credit: 'ESA/Planck Collaboration',
      licence: '© ESA; ESA’s terms for images: educational and informational use, not commercial, with credit',
      date: '2018-07-17',
      sourceUrl: 'https://www.esa.int/ESA_Multimedia/Images/2018/07/Planck_s_view_of_the_cosmic_microwave_background',
    },
    {
      file: 'photos/observable-universe/sdss-eboss-map.webp',
      largeFile: 'photos/observable-universe/sdss-eboss-map-large.webp',
      width: 640,
      height: 361,
      title: 'The Sloan surveys’ map, inside the observable universe',
      caption:
        'Not a photograph: a map. The Sloan surveys’ galaxies and quasars in their slices of sky, in rainbow colours by kind and survey, out along a scale of how long their light has travelled, to 13.8 billion years; the outer sphere is the cosmic microwave background. We are at the centre. The insets show a typical object of each kind and the pattern measured in their spacing.',
      colour: 'false',
      credit: 'Anand Raichoor (EPFL), Ashley Ross (Ohio State University) and the SDSS Collaboration',
      licence: 'CC BY 4.0',
      date: '2020-07-19',
      sourceUrl: 'https://press.sdss.org/no-need-to-mind-the-gap/',
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The breadcrumb’s Observable Universe puts the camera 36 billion light years from the Sun, over the supergalactic pole and turned as Laniakea’s view is, so the zoom out goes on along the same line: looking back at the Sun, the microwave background’s wall behind it 81 billion light years off, filling the frame about the quasars and the record-holders. From 30 billion light years out the whole mapped Nearby Universe is a single named point.',
    },
    {
      title: 'Never outside',
      text: 'The camera never goes past 40 billion light years from the Sun, inside the microwave background’s sphere: the sphere is about the observer, and there is no outside to see it from. It is drawn as its inside, 45.3 billion light years out, behind everything — its own page says how.',
      cite: ['planck2018vi'],
    },
    {
      title: 'One instant',
      text: 'Everything is placed where it is now, at the comoving distance its redshift gives in Planck 2018’s cosmology — not where it was when its light left. MoM-z14 is drawn 33.9 billion light years off: when its light set out it was 2.2 billion, and the light has been 13.5 billion years on the way. Each panel gives all three.',
      cite: ['planck2018vi', 'naidu2025'],
    },
    {
      title: 'What fills it',
      text: 'The Sloan survey’s 750,414 quasars, each at its redshift’s distance, out to redshift 7, about 28 billion light years, each as bright as its own measured luminosity makes it from wherever the camera is; the record-holders — the farthest galaxy, quasar, star and gamma-ray burst — and the deep fields, drawn as beams from the Sun out to the farthest galaxy confirmed in each; and the Sloan galaxies’ wedges, as threads and points.',
      cite: ['lyke2020'],
    },
    {
      title: 'Its numbers',
      text: 'The radius, 46.2 billion light years, and the microwave background’s sphere, 45.3, are worked out in the app from Planck 2018’s cosmology: a Hubble constant of 67.66 km/s per megaparsec, a matter density of 0.3111 and the radiation of a 2.7255 K background.',
      cite: ['planck2018vi'],
    },
  ],
  measured: [
    {
      title: 'Its contents and age',
      text: 'From the microwave background’s ripples, with Planck’s full mission: a Hubble constant of 67.4 ± 0.5 km/s per megaparsec and a matter density of 0.315 ± 0.007 in the standard model; the rest is dark energy, consistent with a cosmological constant. The age that model gives is about 13.8 billion years.',
      cite: ['planck2018vi'],
    },
    {
      title: 'Its flatness',
      text: 'Space is flat to within the measurement: a curvature of 0.001 ± 0.002, with the baryon acoustic oscillations. How far it goes beyond what we see is not known.',
      cite: ['planck2018vi'],
    },
    {
      title: 'The farthest galaxy',
      text: 'MoM-z14, at a redshift of 14.44 confirmed by Webb’s spectrograph: seen as it was 280 million years after the Big Bang.',
      cite: ['naidu2025'],
    },
    {
      title: 'Quasars',
      text: 'The Sloan survey’s sixteenth quasar catalogue: 750,414 quasars, every one confirmed by its spectrum.',
      cite: ['lyke2020'],
    },
    {
      title: 'Deep fields',
      text: 'Webb’s JADES survey: more than 45,000 galaxies in part of the GOODS-South field, hundreds of them from when the universe was less than 600 million years old.',
      cite: ['esawebbjades'],
    },
  ],
  estimated: [
    {
      title: 'Its size',
      text: 'The comoving distance light could have come since the beginning, in Planck 2018’s model: about 46 billion light years; the microwave background’s sphere just inside it, at about 45. Not measured directly: worked out from the measured parameters.',
      cite: ['planck2018vi'],
    },
    {
      title: 'How many galaxies',
      text: 'About 2 trillion out to redshift 8, counting galaxies down to a million times the Sun’s mass in stars: almost ten times as many as an all-sky survey to the Hubble Ultra Deep Field’s depth would see. An extrapolation from how the numbers of galaxies of each mass change with time.',
      cite: ['conselice2016'],
    },
    {
      title: 'Out of reach',
      text: 'The cosmic event horizon: light sent now can reach only what is now within about 16.6 billion light years, in Planck 2018’s cosmology, as the app works it out. What lies farther we can still see, by light that left long ago, but never reach.',
      cite: ['planck2018vi', 'davis2004'],
    },
  ],
  missing: [
    {
      title: 'What lies beyond',
      text: 'Not known, and not drawn: no light from beyond the sphere has reached us. The camera stays inside it.',
    },
    {
      title: 'Before the microwave background',
      text: 'Nothing earlier can be seen in light: before it the universe was opaque.',
      cite: ['esaplanck'],
    },
    {
      title: 'Most of its galaxies',
      text: 'Mapped only in the survey’s wedges of sky and only the brighter ones: most of the observable universe’s galaxies are uncatalogued, and the space between the wedges is empty here only because no one has mapped it.',
      cite: ['conselice2016', 'lyke2020'],
    },
    {
      title: 'Dark matter and dark energy',
      text: 'Most of what is in it gives no light and is not drawn: dark matter, and the dark energy that is speeding up the expansion.',
      cite: ['planck2018vi'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not the whole universe',
      text: 'It is the part whose light has reached us, centred on us because we are the ones looking. Anyone in any galaxy has one of their own, and its edge is a horizon, not an end.',
      cite: ['davis2004'],
    },
    {
      title: 'Its radius is not 13.8 billion light years',
      text: 'Light has travelled for at most 13.8 billion years, but space has stretched behind it: the places it left are now some 46 billion light years away.',
      cite: ['planck2018vi', 'davis2004'],
    },
    {
      title: 'Galaxies receding faster than light can be seen',
      text: 'Many of the galaxies we see are, and always have been, moving away from us faster than light by the expansion. That breaks no law: relativity limits motion through space, not the stretching of space itself.',
      cite: ['davis2004'],
    },
    {
      title: 'A deep field is not a view of the edge',
      text: 'Its farthest galaxies are seen as they were long ago, not where they are: the farthest known is now about 34 billion light years away, and the light now arriving from it left when it was 2.2 billion.',
      cite: ['naidu2025', 'planck2018vi'],
    },
  ],
  sources: [
    {
      key: 'planck2018vi',
      text: 'Planck Collaboration 2020, Planck 2018 results. VI. Cosmological parameters, A&A 641, A6',
      url: 'https://doi.org/10.1051/0004-6361/201833910',
    },
    {
      key: 'esaplanck',
      text: 'ESA, Planck’s view of the cosmic microwave background (2018), image caption',
      url: 'https://www.esa.int/ESA_Multimedia/Images/2018/07/Planck_s_view_of_the_cosmic_microwave_background',
    },
    {
      key: 'davis2004',
      text: 'Davis, T. M., & Lineweaver, C. H. 2004, Expanding Confusion: Common Misconceptions of Cosmological Horizons and the Superluminal Expansion of the Universe, PASA 21, 97',
      url: 'https://doi.org/10.1071/AS03040',
    },
    {
      key: 'naidu2025',
      text: 'Naidu, R. P., et al. 2025, A Cosmic Miracle: A Remarkably Luminous Galaxy at z = 14.44 Confirmed with JWST, Open Journal of Astrophysics',
      url: 'https://arxiv.org/abs/2505.11263',
    },
    {
      key: 'lyke2020',
      text: 'Lyke, B. W., et al. 2020, The Sloan Digital Sky Survey Quasar Catalog: Sixteenth Data Release, ApJS 250, 8',
      url: 'https://doi.org/10.3847/1538-4365/aba623',
    },
    {
      key: 'conselice2016',
      text: 'Conselice, C. J., et al. 2016, The Evolution of Galaxy Number Density at z < 8 and Its Implications, ApJ 830, 83',
      url: 'https://doi.org/10.3847/0004-637X/830/2/83',
    },
    {
      key: 'esawebbjades',
      text: 'ESA/Webb, GOODS-S field (NIRCam image), JADES, image caption',
      url: 'https://esawebb.org/images/JADES2/',
    },
  ],
};
