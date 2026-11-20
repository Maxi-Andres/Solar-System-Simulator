import type { Description } from '../types.ts';
import { LROC_CREDIT, LROC_LICENCE, NASA_LICENCE, NO_TELESCOPE, PHOTOJOURNAL_LICENCE, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

const ID = 'site-apollo-16';

/** Descartes: the highlands, and a lesson in being wrong. */
export const APOLLO_16: Description = {
  id: ID,
  lead: [
    'Apollo 16 went to the bright highlands that cover most of the Moon, to find volcanoes, and found none. Every rock they picked up was the wreckage of impacts. Being wrong was the discovery: the highlands are not lava but a crust beaten and remade by collisions for billions of years.',
    'It was the first landing in the highlands. A fault in the command module’s main engine kept John Young and Charles Duke circling for hours in their lunar module, Orion, beside Ken Mattingly in Casper, while mission control decided whether to land at all; they came down at 02:23:35 UT on 21 April 1972, about 270 m north and 60 m west of the planned point, on the Cayley plain near the Descartes mountains.',
    'In three walks, 20 hours 14 minutes in all, they drove 27 km, stopped at 11 places — up Stone Mountain to the south, out to North Ray crater, 240 m deep, in the north — and gathered 95.71 kg of rock and soil. They set out an ALSEP and a far-ultraviolet camera, a telescope for light that never reaches the ground on Earth. After 71 hours on the surface they left at 01:25:48 UT on 24 April.',
    'Orion’s descent stage, the rover, the instruments and the flag are there. LRO sees the flag’s shadow swing round it from image to image: it still stands.',
  ],
  photos: [
    sitePhoto(ID, 'young-salute', 640, 640, {
      title: 'Young jumps as he salutes',
      caption:
        'On the first walk Young leaps from the ground as he salutes the flag, photographed by Duke: in the Moon’s weak gravity even a jump in a full suit and backpack lifts him clear. Orion is on the left with the rover beside it, Stone Mountain behind.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1972-04-21',
      sourceUrl: 'https://images.nasa.gov/details/as16-113-18339',
    }),
    sitePhoto(ID, 'orion-rover', 640, 663, {
      title: 'Orion and the rover',
      caption:
        'The lunar module and the Lunar Roving Vehicle on the first walk, photographed by Duke; Young is behind the rover, Stone Mountain in the left background.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1972-04-21',
      sourceUrl: 'https://images.nasa.gov/details/as16-107-17436',
    }),
    sitePhoto(ID, 'north-ray-boulder', 640, 667, {
      title: 'Duke at a boulder by North Ray crater',
      caption:
        'On the third walk, Duke studies the face of a large boulder at North Ray crater, the camera on his chest; photographed by Young. Rock like this, thrown out by the impact that made the crater, was what they had come for.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1972-04-23',
      sourceUrl: 'https://images.nasa.gov/details/as16-116-18649',
    }),
    sitePhoto(ID, 'lro-2011', 640, 640, {
      title: 'The site from LRO’s low orbit',
      caption:
        'LRO’s narrow-angle camera in late 2011, 250 m across, labelled by the LROC team: the descent stage with its shadow, the rover parked to the east beside the magnetometer, the experiments and the geophone line to the south-west, and the rover tracks.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2011 (released 2012-04-23)',
      sourceUrl: 'https://lroc.im-ldi.com/images/520',
    }),
    sitePhoto(ID, 'lro-high-sun', 570, 570, {
      title: 'Footsteps under a high Sun',
      caption:
        'The same place with the Sun nearly overhead: no shadows to speak of, so what shows is the ground the crew disturbed — a dark halo round the lander and dark paths out to the instruments and the rover’s last parking place.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2010-07-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA13247',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID, ['wagner2017']),
    {
      title: 'The landing',
      text: 'Touchdown 02:23:35 UT on 21 April 1972. Three walks, 20 h 14 min in all, covering 27 km with 11 stops; liftoff 01:25:48 UT on 24 April, after 71 h 2 min on the Moon.',
      cite: ['nssdcaA16'],
    },
    { title: 'What came back', text: '95.71 kg of rock and soil.', cite: ['nssdcaA16'] },
    {
      title: 'What the rocks were',
      text: 'Impact breccias, almost every one: fragments broken and welded together by collisions, not lava. The Cayley plain is made by impacts, not volcanoes.',
      cite: ['lroc1252'],
    },
    {
      title: 'The flag stands',
      text: 'Its shadow shows in a sequence of seven LRO images, moving round it with the Sun.',
      cite: ['fincannon2012'],
    },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for Orion’s descent stage, the rover and the instruments.' }],
  misconceptions: [
    {
      title: 'The Moon’s bright highlands are not volcanic',
      text: 'They were expected to be, from the smooth plains seen from orbit. The samples showed otherwise: an ancient crust broken up by impacts.',
      cite: ['lroc1252'],
    },
    NO_TELESCOPE,
  ],
  sources: [
    SITE_SOURCES.wagner2017,
    {
      key: 'nssdcaA16',
      text: 'NASA Space Science Data Coordinated Archive, Apollo 16 Lunar Module / ALSEP',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1972-031C',
    },
    { key: 'lroc1252', text: 'LROC team 2022, Apollo 16 50th Anniversary: A New Landscape', url: 'https://lroc.im-ldi.com/images/1252' },
    SITE_SOURCES.fincannon2012,
    SITE_SOURCES.robinson2010,
  ],
};
