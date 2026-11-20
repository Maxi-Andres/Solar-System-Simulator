import type { Description } from '../types.ts';
import { LROC_CREDIT, LROC_LICENCE, NASA_LICENCE, NO_TELESCOPE, PHOTOJOURNAL_LICENCE, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

const ID = 'site-apollo-11';

/** Tranquility Base: where people first stood on another world. */
export const APOLLO_11: Description = {
  id: ID,
  lead: [
    'For as long as there have been people, the Moon was a light in the sky, out of reach. On 20 July 1969 two of them stood on it. Everyone who has lived since lives in a world where that has happened, and the place where it happened is still there, unchanged, with the footprints in it.',
    'Apollo 11’s lunar module, Eagle, came down in the Sea of Tranquillity at 20:17:40 UT. Its target lay among the boulders thrown out of West crater, so Neil Armstrong flew it on, west, to a smoother patch beyond. At 02:56 UT on 21 July he stepped off the ladder: “That’s one small step for [a] man, one giant leap for mankind.” Buzz Aldrin followed him; Michael Collins circled overhead in the command module, Columbia.',
    'They were outside for about two and a quarter hours, never more than about 100 metres from Eagle. They set up the flag, a seismometer and a laser reflector, spoke to President Nixon by radio-telephone, left a packet of memorial items, and gathered 21.55 kg of rock and soil. After 21 hours and 36 minutes on the Moon they lifted off in Eagle’s upper half, and as it rose Aldrin saw the flag blown over.',
    'What they left is there still: the descent stage, with its plaque on the leg — “Here men from the planet Earth first set foot upon the Moon, July 1969, A.D. We came in peace for all mankind” — the seismometer, long silent, and the reflector, which observatories on Earth still fire lasers at. From orbit LRO sees the descent stage, the instruments and, as dark threads in the soil, the paths the two men walked.',
  ],
  photos: [
    sitePhoto(ID, 'aldrin', 640, 625, {
      title: 'Buzz Aldrin at Tranquility Base, 20 July 1969',
      caption:
        'Photographed by Armstrong with a Hasselblad on 70 mm colour film: Aldrin beside one of Eagle’s legs, Armstrong and the lander reflected in his gold visor. The ground is grey because the Moon is; the sky is black because there is no air to scatter sunlight, and the stars are too faint for an exposure set for sunlit ground.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-07-20',
      sourceUrl: 'https://images.nasa.gov/details/as11-40-5903',
    }),
    sitePhoto(ID, 'bootprint', 640, 643, {
      title: 'A bootprint',
      caption:
        'A bootprint in the fine grey soil, photographed close up on the 70 mm Hasselblad. With no wind and no rain on the Moon, nothing wipes it out but the slow rain of tiny meteorites.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-07-20',
      sourceUrl: 'https://images.nasa.gov/details/as11-40-5878',
    }),
    sitePhoto(ID, 'flag', 640, 662, {
      title: 'Aldrin beside the flag',
      caption:
        'Taken by Armstrong: the flag held out by a rod along its top, Eagle on the left, the ground trampled with bootprints. It fell when the ascent stage left.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-07-20',
      sourceUrl: 'https://images.nasa.gov/details/as11-40-5875',
    }),
    sitePhoto(ID, 'easep', 640, 640, {
      title: 'The instruments, deployed',
      caption:
        'Aldrin just after setting out the experiments: the seismometer in front of him, the laser reflector beyond it, the flag in the middle distance, the black-and-white television camera on the left and Eagle on the right. Photographed by Armstrong.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-07-20',
      sourceUrl: 'https://images.nasa.gov/details/as11-40-5948',
    }),
    sitePhoto(ID, 'plaque', 640, 623, {
      title: 'The plaque, on the ladder',
      caption:
        'The plaque on the strut behind Eagle’s ladder, uncovered on the Moon: the steel sheet that protected it in flight has been taken off. Sunlight on the gold foil of the descent stage colours the shadows round it.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-07-20',
      sourceUrl: 'https://images.nasa.gov/details/as11-40-5899',
    }),
    sitePhoto(ID, 'plaque-replica', 640, 527, {
      title: 'What the plaque says',
      caption:
        'A replica photographed before the flight, readable as the original on the Moon is not in the surface photographs: Earth’s two hemispheres, the words, and the signatures of the three astronauts and the President. Stainless steel, 9 by 7⅝ inches.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-07',
      sourceUrl: 'https://images.nasa.gov/details/S69-39334',
    }),
    sitePhoto(ID, 'lro-high-noon', 640, 640, {
      title: 'Tranquility Base from LRO, at noon',
      caption:
        'LRO’s narrow-angle camera with the Sun almost overhead, at half a metre a pixel: the descent stage is the bright spot, the instruments a few metres from it, and the astronauts’ paths show dark where their boots turned over the soil — the longest, east toward Little West crater, Armstrong’s. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'released 2009-11-09',
      sourceUrl: 'https://lroc.im-ldi.com/images/65',
    }),
    sitePhoto(ID, 'lro-2009', 640, 640, {
      title: 'The site and West crater, 2009',
      caption:
        'A wider view by the same camera, a month after its first look at the site: the descent stage, the reflector and seismometer, Little West, and and to the east West crater, whose boulders Armstrong flew past to land.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2009-09-29',
      sourceUrl: 'https://images.nasa.gov/details/PIA12909',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID, ['wagner2017'], 'This one to about 0.3 m.'),
    {
      title: 'The landing',
      text: 'Touchdown 20:17:40 UT on 20 July 1969. Armstrong on the surface at 02:56:15 UT on 21 July; the hatch closed again at 05:11:13 UT. Liftoff 17:54:01 UT, after 21 h 36 min on the Moon.',
      cite: ['nssdcaA11'],
    },
    {
      title: 'What came back',
      text: '21.55 kg of rock and soil, from a walk of about 250 m in all, neither man going more than about 100 m from the lander.',
      cite: ['nssdcaA11'],
    },
    {
      title: 'The reflector, still in use',
      text: 'A panel of corner-cube prisms that sends a laser pulse straight back where it came from. Timing the round trip from observatories on Earth measures the distance to the Moon to within millimetres, and it is how the Moon is known to be drawing away from Earth.',
      cite: ['murphy2013'],
    },
    {
      title: 'Seen from orbit',
      text: 'LRO’s narrow-angle camera, from about 50 km up, at half a metre a pixel: the descent stage, the instruments and the astronauts’ trails, all where the crew’s photographs put them.',
      cite: ['lroc65', 'robinson2010'],
    },
  ],
  estimated: [
    {
      title: 'The flag now',
      text: 'Lying in the dust, if it is anywhere: Aldrin saw it fall, and LRO’s images show no shadow of a standing flag here, as they do at three of the later sites.',
      cite: ['fincannon2012'],
    },
  ],
  missing: [
    { title: 'The craft itself', text: 'Not drawn: a mark stands for the descent stage and everything round it.' },
    {
      title: 'The footprints, one by one',
      text: 'No camera in orbit can make out a single bootprint: at half a metre a pixel, LRO sees only where many of them together darkened the ground.',
      cite: ['lroc65'],
    },
  ],
  misconceptions: [
    {
      title: 'The flag is not waving',
      text: 'With no air to hold it out, a flag would hang limp, so NASA hung it from a horizontal rod along its top. The creases in it are where it was folded, and it moved only while it was being handled.',
      cite: ['platoff1993'],
    },
    {
      title: 'It did happen',
      text: 'The landing can be checked without trusting a word of NASA’s: laser stations of several countries still bounce pulses off the reflector the crew set down, and LRO, a camera that arrived forty years later, photographs the lander and the trails just where the 1969 photographs put them.',
      cite: ['murphy2013', 'lroc65'],
    },
    NO_TELESCOPE,
  ],
  sources: [
    SITE_SOURCES.wagner2017,
    {
      key: 'nssdcaA11',
      text: 'NASA Space Science Data Coordinated Archive, Apollo 11 Lunar Module / EASEP',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C',
    },
    SITE_SOURCES.murphy2013,
    { key: 'lroc65', text: 'LROC team 2009, High Noon at Tranquility Base', url: 'https://lroc.im-ldi.com/images/65' },
    SITE_SOURCES.robinson2010,
    SITE_SOURCES.fincannon2012,
    SITE_SOURCES.platoff1993,
  ],
};
