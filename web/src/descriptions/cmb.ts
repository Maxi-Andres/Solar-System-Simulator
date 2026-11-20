import { CMB_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The cosmic microwave background: no body, so opened from the breadcrumb's Observable Universe
 * list (BodyPicker.tsx), and nothing in it is worked out from a body's data. Every number here
 * is from the source it cites; where a figure is a model's rather than a measurement, it sits
 * under "estimated" and says which model. What the app draws of it is read off scene/cmb.ts,
 * scene/CosmicMicrowaveBackground.tsx, core/cosmology.ts and public/cmb/.
 */
export const CMB: Description = {
  id: CMB_DESCRIPTION_ID,
  subject: { name: 'Cosmic microwave background', kind: 'the oldest light' },
  lead: [
    'Look far enough in any direction and you are looking back in time, to the oldest light there is. It set out when the universe was about 380,000 years old — before there were any stars or galaxies, when everything was a glowing fog of hydrogen and helium — and it has been travelling ever since, for almost 13.8 billion years. It arrives from every direction at once, and it is the nearest thing we have to a photograph of the universe as a newborn.',
    'Until then the universe was so hot that its gas was a plasma, and light could not get far before bouncing off a free electron. As it cooled, the electrons settled into atoms and the fog cleared: the light that was in it went free. It left as the glow of a gas near 3,000 degrees; the expansion of the universe has since stretched it about 1,100 times, into microwaves at 2.7 degrees above absolute zero, which no eye can see.',
    'It was found by accident. In 1965 Arno Penzias and Robert Wilson, working with a 20-foot horn antenna of Bell Labs at Holmdel, New Jersey, could not get rid of a faint hiss, the same wherever they pointed, as if from something at 3.5 degrees above absolute zero. A group at Princeton, building an instrument to look for exactly that, recognised it at once: the heat left over from the Big Bang, which had been predicted in the late 1940s. Penzias and Wilson shared the 1978 Nobel Prize in physics for it.',
    'It is almost perfectly even. The COBE satellite showed its spectrum is that of a perfect glowing body, and in 1992 it found the first ripples in it, differences of a few hundred-thousandths. Planck later mapped them across the whole sky. Those ripples are the slightly denser and thinner regions of the young universe — the seeds from which, pulled together by gravity, every galaxy grew, ours included.',
  ],
  photos: [
    {
      file: 'photos/cmb/planck-2018.webp',
      largeFile: 'photos/cmb/planck-2018-large.webp',
      width: 640,
      height: 323,
      title: 'The whole sky in microwaves, from Planck',
      caption:
        'Planck’s final map of the cosmic microwave background, the whole sky on an oval: its tiny temperature differences, warmer in red, cooler in blue — a few hundred millionths of a degree either side of 2.7 K. The light is microwaves, so every colour here stands for a temperature, not for light anyone could see. The same Planck data the app draws.',
      colour: 'false',
      credit: 'ESA/Planck Collaboration',
      licence: '© ESA; ESA’s terms for images: educational and informational use, not commercial, with credit',
      date: '2018-07-17',
      sourceUrl: 'https://www.esa.int/ESA_Multimedia/Images/2018/07/Planck_s_view_of_the_cosmic_microwave_background',
    },
    {
      file: 'photos/cmb/cobe-dmr.webp',
      largeFile: 'photos/cmb/cobe-dmr-large.webp',
      width: 640,
      height: 960,
      title: 'COBE’s sky at 53 GHz, three ways',
      caption:
        'Four years of COBE data. Top, on a scale of 0 to 4 K: the same everywhere. Middle, the contrast raised: one half of the sky a few thousandths of a degree warmer, from our own motion through it. Bottom, that taken away: ripples of tens of millionths of a degree, and our galaxy’s own microwaves across the middle.',
      colour: 'false',
      credit: 'NASA/COBE Science Team',
      licence: 'NASA media, not copyrighted',
      date: '1990s',
      sourceUrl: 'https://lambda.gsfc.nasa.gov/product/cobe/cobe_image_table.html',
    },
    {
      file: 'photos/cmb/cobe-dmr-foregrounds.webp',
      largeFile: 'photos/cmb/cobe-dmr-foregrounds-large.webp',
      width: 640,
      height: 960,
      title: 'Taking away the dipole, then the galaxy',
      caption:
        'COBE’s 53 GHz map before the dipole of our motion is taken off, after it, and after a model of the Milky Way’s own emission is subtracted too, its plane greyed out: what is left is the background itself.',
      colour: 'false',
      credit: 'NASA/COBE Science Team',
      licence: 'NASA media, not copyrighted',
      date: '1990s',
      sourceUrl: 'https://lambda.gsfc.nasa.gov/product/cobe/cobe_image_table.html',
    },
    {
      file: 'photos/cmb/cobe-firas-spectrum.webp',
      largeFile: 'photos/cmb/cobe-firas-spectrum-large.webp',
      width: 640,
      height: 426,
      title: 'Its spectrum, a perfect glow',
      caption:
        'A plot, not a picture: the brightness of the background at each wavelength, against the curve the hot Big Bang predicts for a glowing body at a single temperature. COBE’s FIRAS measured it; theory and observation agree.',
      colour: 'false',
      credit: 'NASA/COBE Science Team',
      licence: 'NASA media, not copyrighted',
      date: '1990s',
      sourceUrl: 'https://lambda.gsfc.nasa.gov/product/cobe/cobe_image_table.html',
    },
    {
      file: 'photos/cmb/cobe-wmap-planck.webp',
      largeFile: 'photos/cmb/cobe-wmap-planck-large.webp',
      width: 640,
      height: 355,
      title: 'COBE, WMAP and Planck',
      caption:
        'The same patch of sky as three satellites saw it, each sharper than the last: NASA’s COBE, NASA’s WMAP and ESA’s Planck. The spacecraft above the maps are drawings.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/ESA',
      licence: 'NASA media; credit requested',
      date: '2013-03-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA16874',
    },
    {
      file: 'photos/cmb/planck-anomalies.webp',
      largeFile: 'photos/cmb/planck-anomalies-large.webp',
      width: 640,
      height: 360,
      title: 'What does not fit, from Planck',
      caption:
        'Planck’s map, and below it its largest features only: the ripples are stronger on one half of the sky than the other, against the simple model in which the sky is the same in every direction. Red warmer, blue cooler.',
      colour: 'false',
      credit: 'ESA and the Planck Collaboration',
      licence: 'NASA media; credit requested',
      date: '2013-03-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA16877',
    },
  ],
  drawnHere: [
    {
      title: 'A wall all round, seen from inside',
      text: 'A sphere about the Sun at the distance its light has come, 13,880 Mpc — 45.3 billion light years — in Planck 2018’s cosmology. It is not a thing out there but a time: every observer anywhere is at the centre of a sphere of their own, so there is no outside to see it from, and the camera never goes past 40 billion light years from the Sun. It is drawn as its inside, behind everything it encloses, every way the camera turns.',
      cite: ['planck2018vi'],
    },
    {
      title: 'Only far out',
      text: 'None of it nearer than 3 billion light years from the Sun, all of it from 15 billion: nearer, at the scales of the galaxy, the Local Group or Laniakea, it is the sky’s microwave glow, which no eye sees, and a wall there would be a backdrop to views it has nothing to do with.',
    },
    {
      title: 'Planck’s map on it',
      text: 'Planck’s 2018 SMICA map of its temperature, with the Galactic plane and bright sources filled in where they were masked, laid out as 2,048 by 1,024 cells in Galactic coordinates, a step of 4 millionths of a kelvin each. Seen from inside, it is the sky as seen from here, not its mirror image: the Cold Spot lies toward Eridanus, where it is in the sky.',
      cite: ['planck2018iv'],
    },
    {
      title: 'True colour, the default',
      text: 'Today it is a 2.7255 K glow, all of it in microwaves: to an eye, black. When it left it was 1,090.8 times hotter, 2,973 K, the colour of a candle flame, and that is the colour drawn — the light as it was when it left. Its ripples are a hundred-thousandth of its temperature, a difference drawn as it is would be invisible, so each point is drawn as a glow at 2,973 K times one plus a thousand times its departure from the mean: a warm spot yellower and brighter, a cold one redder and dimmer, as they would be, only more. Its brightness is a display level, not that of a 2,973 K surface.',
      cite: ['fixsen2009', 'planck2018vi'],
    },
    {
      title: 'Planck’s colours, a choice',
      text: 'The Layers panel can switch it to the colour scale Planck’s own maps use, dark blue through a pale cream at the mean to dark red, over 300 millionths of a kelvin either way: the picture of it everyone has seen. Those colours are a scale, not light.',
      cite: ['planck2018iv'],
    },
  ],
  measured: [
    {
      title: 'Its temperature',
      text: '2.72548 ± 0.00057 K, from COBE’s FIRAS measurements recalibrated with WMAP and the literature together.',
      cite: ['fixsen2009'],
    },
    {
      title: 'Its spectrum',
      text: 'A blackbody, the glow of a body at a single temperature, as the hot Big Bang predicts: measured by COBE’s FIRAS, built to measure it from 0.1 to 10 mm.',
      cite: ['mather1994', 'cobe'],
    },
    {
      title: 'Its discovery',
      text: 'In 1965 Penzias and Wilson, with a 20-foot horn antenna at Holmdel, New Jersey, found an excess of 3.5 K from empty space in every direction; Dicke’s group at Princeton read it as radiation left from the hot early universe. It had been predicted by Gamow in 1948 and by Alpher and Herman in 1950. Penzias and Wilson shared the 1978 Nobel Prize in physics for it.',
      cite: ['penzias1965', 'cosmictimes', 'nasahistory'],
    },
    {
      title: 'Our motion through it',
      text: 'One half of the sky is 3.365 ± 0.027 thousandths of a kelvin warmer than the other: the Doppler shift of our own motion. The Local Group moves at 627 ± 22 km/s with respect to it.',
      cite: ['kogut1993'],
    },
    {
      title: 'Its ripples',
      text: 'First found by COBE’s DMR in 1992; mapped by Planck across the whole sky to the finest detail yet. In the map drawn here their root mean square is about 104 millionths of a kelvin. They correspond to regions of slightly different density, the seeds of all later structure.',
      cite: ['smoot1992', 'esaplanck', 'planck2018iv'],
    },
    {
      title: 'When it left',
      text: 'When the universe was about 380,000 years old.',
      cite: ['esaplanck'],
    },
  ],
  estimated: [
    {
      title: 'Its distance and its redshift',
      text: 'Its light has been stretched 1,090.8 times, a redshift of 1089.8, and the place it left from is now 13,880 Mpc away — 45.3 billion light years, much farther than the 13.8 billion years it has travelled, because space has expanded meanwhile. Both come from the cosmological model fitted to Planck’s data, with a Hubble constant of 67.4 ± 0.5 km/s/Mpc and a matter density of 0.315.',
      cite: ['planck2018vi'],
    },
    {
      title: 'The age of the universe',
      text: 'About 13.8 billion years, from the same model fitted to the background’s ripples.',
      cite: ['planck2018vi', 'nasacompare'],
    },
  ],
  missing: [
    {
      title: 'Its polarisation',
      text: 'Not drawn: the light is also slightly polarised, and Planck mapped that too; only its temperature is drawn.',
      cite: ['planck2018iv'],
    },
    {
      title: 'Its dipole',
      text: 'Not drawn: the warmer and cooler halves our motion gives the sky are taken out of Planck’s map of the background.',
      cite: ['kogut1993'],
    },
    {
      title: 'Its finest detail',
      text: 'Planck’s map has some fifty million pixels; drawn here as two million cells, the finest ripples are averaged out.',
      cite: ['planck2018iv'],
    },
    {
      title: 'What lies behind it',
      text: 'Nothing earlier can be seen in light: before it the universe was opaque.',
      cite: ['esaplanck'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not the edge of the universe',
      text: 'It is a time, not a place: the moment the universe became transparent, seen at the distance its light has come from. Anyone anywhere sees their own such sphere round them.',
    },
    {
      title: 'It is not 13.8 billion light years away',
      text: 'Its light has travelled 13.8 billion years, but the gas that sent it is now some 45 billion light years away: the universe expanded while the light was on its way.',
      cite: ['planck2018vi'],
    },
    {
      title: 'Its famous colours are not its own',
      text: 'The blue-and-orange maps are a temperature scale for microwaves no eye can see. When it left, it glowed like something at 3,000 K, an orange-white; today, to an eye, it is black.',
      cite: ['fixsen2009', 'planck2018vi'],
    },
    {
      title: 'Tiny ripples, everything from them',
      text: 'They are differences of a few parts in a hundred thousand, and from them came every galaxy.',
      cite: ['smoot1992', 'esaplanck'],
    },
  ],
  sources: [
    {
      key: 'esaplanck',
      text: 'ESA, Planck’s view of the cosmic microwave background (2018), image caption',
      url: 'https://www.esa.int/ESA_Multimedia/Images/2018/07/Planck_s_view_of_the_cosmic_microwave_background',
    },
    {
      key: 'planck2018vi',
      text: 'Planck Collaboration 2020, Planck 2018 results. VI. Cosmological parameters, A&A 641, A6',
      url: 'https://doi.org/10.1051/0004-6361/201833910',
    },
    {
      key: 'planck2018iv',
      text: 'Planck Collaboration 2020, Planck 2018 results. IV. Diffuse component separation, A&A 641, A4',
      url: 'https://doi.org/10.1051/0004-6361/201833881',
    },
    {
      key: 'fixsen2009',
      text: 'Fixsen, D. J. 2009, The Temperature of the Cosmic Microwave Background, ApJ 707, 916',
      url: 'https://doi.org/10.1088/0004-637X/707/2/916',
    },
    {
      key: 'mather1994',
      text: 'Mather, J. C., et al. 1994, Measurement of the cosmic microwave background spectrum by the COBE FIRAS instrument, ApJ 420, 439',
      url: 'https://doi.org/10.1086/173574',
    },
    {
      key: 'smoot1992',
      text: 'Smoot, G. F., et al. 1992, Structure in the COBE differential microwave radiometer first-year maps, ApJ 396, L1',
      url: 'https://doi.org/10.1086/186504',
    },
    {
      key: 'kogut1993',
      text: 'Kogut, A., et al. 1993, Dipole Anisotropy in the COBE Differential Microwave Radiometer First-Year Sky Maps, ApJ 419, 1',
      url: 'https://arxiv.org/abs/astro-ph/9312056',
    },
    {
      key: 'penzias1965',
      text: 'Penzias, A. A., & Wilson, R. W. 1965, A Measurement of Excess Antenna Temperature at 4080 Mc/s, ApJ 142, 419',
      url: 'https://doi.org/10.1086/148307',
    },
    {
      key: 'cosmictimes',
      text: 'NASA Imagine the Universe, Cosmic Times 1965: Mysterious Cosmic “Murmur”',
      url: 'https://imagine.gsfc.nasa.gov/educators/programs/cosmictimes/online_edition/1965/murmur.html',
    },
    {
      key: 'nasahistory',
      text: 'NASA Goddard, J. Mather’s cosmology pages: History of the CMB',
      url: 'https://asd.gsfc.nasa.gov/archive/mather/cosmology/history.html',
    },
    {
      key: 'cobe',
      text: 'NASA LAMBDA, COBE slide set (DIRBE, DMR, FIRAS images and captions)',
      url: 'https://lambda.gsfc.nasa.gov/product/cobe/cobe_image_table.html',
    },
    {
      key: 'nasacompare',
      text: 'NASA/JPL, The Universe Comes into Sharper Focus (PIA16874)',
      url: 'https://images.nasa.gov/details/PIA16874',
    },
  ],
};
