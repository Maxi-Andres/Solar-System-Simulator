import type { Description } from '../types.ts';
import { LROC_CREDIT, NASA_LICENCE, NO_TELESCOPE, PHOTOJOURNAL_LICENCE, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

const ID = 'site-apollo-14';

/** Fra Mauro: the landing that came after Apollo 13 did not. */
export const APOLLO_14: Description = {
  id: ID,
  lead: [
    'Apollo 14 went where Apollo 13 should have gone. An oxygen tank had burst on the way out, and that crew came home without landing; nine months later Alan Shepard — the first American in space, grounded for years by an ear disorder — and Edgar Mitchell set down at Fra Mauro, in hills thought to be the debris thrown out when the Imbrium basin was blasted open.',
    'Their lunar module, Antares, landed at 09:18:11 UT on 5 February 1971; Stuart Roosa orbited in Kitty Hawk. On the first walk they set out the ALSEP and a laser reflector. On the second they hauled a two-wheeled cart, the Modularized Equipment Transporter, up the slope toward Cone crater, a young crater whose rim was expected to hold rock from deep below. Lost among hummocks that all looked alike, tired and behind time, they turned back about 30 m short of its rim without knowing how close they were.',
    'In two walks, 9 hours 23 minutes in all, they covered 3.45 km and gathered 42.28 kg of rock and soil. Before climbing aboard, Shepard fixed a 6-iron head to a sampling handle and hit two golf balls. They left after 33 hours 31 minutes.',
    'From orbit their trail up toward Cone crater can still be followed, a dark thread across the bright ground, and its end at the rim they never saw.',
  ],
  photos: [
    sitePhoto(ID, 'shepard-flag', 640, 652, {
      title: 'Shepard and the flag',
      caption:
        'Early on the first walk: Shepard by the flag, the third set up on the Moon. The shadows of the lunar module, of Mitchell taking the photograph and of the folding S-band antenna lie across the ground. The blue cast is the film’s.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1971-02-05',
      sourceUrl: 'https://images.nasa.gov/details/as14_66_09232',
    }),
    sitePhoto(ID, 'met', 640, 640, {
      title: 'Mitchell and the cart',
      caption:
        'Mitchell beside the Modularized Equipment Transporter, the hand-pulled cart that carried tools and samples, on the second walk, with the lunar module far behind.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1971-02-06',
      sourceUrl: 'https://images.nasa.gov/details/as14-64-9140',
    }),
    sitePhoto(ID, 'retroreflector', 640, 640, {
      title: 'The laser reflector',
      caption:
        'The reflector as the crew left it on the first walk: a tilted panel of glass corner cubes, set to face Earth, with bootprints round it. It is one of the reflectors laser stations still use.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1971-02-05',
      sourceUrl: 'https://images.nasa.gov/details/as14-67-09386',
    }),
    sitePhoto(ID, 'cone-boulder', 640, 640, {
      title: 'A boulder on the flank of Cone crater',
      caption:
        'One of the big boulders in the field near Cone crater’s rim, looking west by south-west, with the lunar module far off in the background: rock thrown out from beneath the surface when the crater formed.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1971-02-06',
      sourceUrl: 'https://images.nasa.gov/details/as14-68-9448',
    }),
    sitePhoto(ID, 'lro-cone-crater', 640, 640, {
      title: 'The trail toward Cone crater, 2009',
      caption:
        'One of LRO’s first images of the site, before its camera was fully calibrated, 1.6 km across: the bright, rough-rimmed Cone crater at upper right, and the astronauts’ trail running toward it from the landing site. The faint vertical stripes are from the camera, not the ground.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2009-08-19',
      sourceUrl: 'https://images.nasa.gov/details/PIA12897',
    }),
    sitePhoto(ID, 'lro-2011', 438, 438, {
      title: 'Antares and the ALSEP from LRO',
      caption:
        'The descent stage at lower right with its shadow, the ALSEP at the arrow, and between them the dark tracks of the astronauts, in LRO’s narrow-angle camera.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2011-02-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA14003',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID, ['wagner2017']),
    {
      title: 'The landing',
      text: 'Touchdown 09:18:11 UT on 5 February 1971 in the highlands near Fra Mauro. Two walks, 9 h 23 min in all, covering 3.45 km; liftoff 18:48:42 UT on 6 February, after 33 h 31 min on the Moon.',
      cite: ['nssdcaA14'],
    },
    { title: 'What came back', text: '42.28 kg of samples.', cite: ['nssdcaA14'] },
    {
      title: 'How close to Cone crater',
      text: 'About 30 m short of its rim: their trail, followed in LRO’s images, ends there.',
      cite: ['pia12897'],
    },
    {
      title: 'The reflector, still in use',
      text: 'Like Apollo 11’s and Apollo 15’s, it returns laser pulses fired from Earth, timing the distance to the Moon to millimetres.',
      cite: ['murphy2013'],
    },
  ],
  estimated: [],
  missing: [
    { title: 'The craft itself', text: 'Not drawn: a mark stands for Antares’s descent stage and the instruments round it.' },
    {
      title: 'The flag now',
      text: 'Not known: LRO’s images show no clear shadow of it, which may be the angle of the flag or the resolution rather than its fall.',
      cite: ['fincannon2012'],
    },
  ],
  misconceptions: [NO_TELESCOPE],
  sources: [
    SITE_SOURCES.wagner2017,
    {
      key: 'nssdcaA14',
      text: 'NASA Space Science Data Coordinated Archive, Apollo 14 Lunar Module / ALSEP',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1971-008C',
    },
    { key: 'pia12897', text: 'NASA/GSFC/Arizona State University 2009, Trail of Discovery at Fra Mauro (PIA12897)', url: 'https://science.nasa.gov/photojournal/trail-of-discovery-at-fra-mauro' },
    SITE_SOURCES.murphy2013,
    SITE_SOURCES.fincannon2012,
    SITE_SOURCES.robinson2010,
  ],
};
