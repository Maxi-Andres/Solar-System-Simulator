import type { Description } from '../types.ts';
import { LROC_CREDIT, LROC_LICENCE, NASA_LICENCE, NO_TELESCOPE, PHOTOJOURNAL_LICENCE, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

const ID = 'site-apollo-15';

/** Hadley–Apennine: the first landing with a car, among the Moon's highest mountains. */
export const APOLLO_15: Description = {
  id: ID,
  lead: [
    'The first three landings were walks; Apollo 15 was an expedition. David Scott and James Irwin landed between the Apennine mountains and the winding canyon of Hadley Rille, stayed almost three days, and drove: the first time people travelled across another world on wheels.',
    'Their lunar module, Falcon, landed at 22:16:29 UT on 30 July 1971, while Alfred Worden orbited above. In three walks, 18 hours 35 minutes in all, they covered 27.9 km with the Lunar Roving Vehicle — up the slope of Hadley Delta, where the car stood on an 18° slope with a wheel in the air, and along the rim of the Rille — and gathered 77.31 kg of rock and soil. They set out an ALSEP of seven instruments, among them a probe drilled into the ground to measure the heat flowing out of the Moon, and a laser reflector.',
    'On the last day, in front of the television camera, Scott dropped a hammer and a feather together, and with no air to hold the feather back they hit the ground together. Before leaving he laid a small figure and a plaque in memory of the fourteen American and Soviet astronauts and cosmonauts who had died. Falcon’s upper half lifted off at 17:11:22 UT on 2 August, after 66 hours 55 minutes on the Moon.',
    'The descent stage, the instruments and the rover are still there. From LRO the rover can be picked out where it was parked for the last time, east of the lander, its tracks running back across the plain.',
  ],
  photos: [
    sitePhoto(ID, 'irwin-rover', 640, 640, {
      title: 'Irwin at the rover, Mount Hadley behind',
      caption:
        'Irwin works at the Lunar Roving Vehicle on the first walk, looking north-east to Mount Hadley; the shadow in the foreground is Falcon’s. Photographed by Scott.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1971-07-31',
      sourceUrl: 'https://images.nasa.gov/details/as15-86-11603',
    }),
    sitePhoto(ID, 'scott-flag', 640, 671, {
      title: 'Scott salutes the flag',
      caption:
        'Toward the end of the second walk, Scott beside the flag, Falcon at the right. Hadley Delta behind rises about 4,000 m above the plain; its foot is about 5 km away, though nothing in an airless view shows it. Photographed by Irwin.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1971-08-01',
      sourceUrl: 'https://images.nasa.gov/details/as15-88-11863',
    }),
    sitePhoto(ID, 'rover', 640, 669, {
      title: 'The rover, alone',
      caption:
        'The Lunar Roving Vehicle, its dish antenna up, looking north toward the edge of Mount Hadley at upper right.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1971-07-31 to 08-02',
      sourceUrl: 'https://images.nasa.gov/details/as15-88-11901',
    }),
    sitePhoto(ID, 'rille', 640, 631, {
      title: 'Across Hadley Rille',
      caption:
        'A telephoto view across the Rille to its far wall, strewn with boulders that have rolled down it: the winding channel is thought to have been cut by flowing lava.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1971-08-02',
      sourceUrl: 'https://images.nasa.gov/details/as15-89-12100',
    }),
    sitePhoto(ID, 'lro-2011', 640, 640, {
      title: 'Falcon and the rover from 25 km up',
      caption:
        'LRO’s narrow-angle camera from its low orbit of 2011, labelled by the LROC team: the descent stage near the centre, the ALSEP to the north-west, the rover parked at the far right, and arrows on its tracks. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2011 (released 2012-03-05)',
      sourceUrl: 'https://lroc.im-ldi.com/images/491',
    }),
    sitePhoto(ID, 'lro-rille-stations', 640, 640, {
      title: 'Their stops on the Rille’s rim',
      caption:
        'LRO’s view of the edge of Hadley Rille, the bouldery band running across the image, with the third walk’s stations 9, 9A and 10 marked.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2010-04-16',
      sourceUrl: 'https://images.nasa.gov/details/PIA13058',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID, ['wagner2017']),
    {
      title: 'The landing',
      text: 'Touchdown 22:16:29 UT on 30 July 1971. Three walks, 18 h 35 min in all, covering 27.9 km; liftoff 17:11:22 UT on 2 August, after 66 h 55 min on the Moon.',
      cite: ['nssdcaA15'],
    },
    { title: 'What came back', text: '77.31 kg of rock and soil.', cite: ['nssdcaA15'] },
    {
      title: 'The slope at Station 6a',
      text: 'About 18°, measured here from LRO’s stereo images: the slope on which a photograph shows the rover with one wheel off the ground.',
      cite: ['lroc491'],
    },
    {
      title: 'The reflector, still in use',
      text: 'The largest of the three Apollo reflectors, and the one laser stations use most.',
      cite: ['murphy2013'],
    },
  ],
  estimated: [],
  missing: [
    { title: 'The craft itself', text: 'Not drawn: a mark stands for Falcon’s descent stage, the rover and the instruments.' },
    {
      title: 'The flag now',
      text: 'Not known. The rover’s television, left running, showed it standing a few hours after liftoff; LRO’s images show no clear shadow.',
      cite: ['fincannon2012'],
    },
  ],
  misconceptions: [
    {
      title: 'Heavy things do not fall faster',
      text: 'Scott’s hammer and feather reached the ground together: in a vacuum every body falls at the same rate, and it is only air that holds a feather back on Earth.',
      cite: ['nssdcaA15'],
    },
    NO_TELESCOPE,
  ],
  sources: [
    SITE_SOURCES.wagner2017,
    {
      key: 'nssdcaA15',
      text: 'NASA Space Science Data Coordinated Archive, Apollo 15 Lunar Module / ALSEP',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1971-063C',
    },
    { key: 'lroc491', text: 'LROC team 2012, Follow the Tracks', url: 'https://lroc.im-ldi.com/images/491' },
    SITE_SOURCES.murphy2013,
    SITE_SOURCES.fincannon2012,
    SITE_SOURCES.robinson2010,
  ],
};
