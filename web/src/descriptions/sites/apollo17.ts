import type { Description } from '../types.ts';
import { LROC_CREDIT, LROC_LICENCE, NASA_LICENCE, NO_TELESCOPE, PHOTOJOURNAL_LICENCE, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

const ID = 'site-apollo-17';

/** Taurus–Littrow: the last time anyone stood on the Moon. */
export const APOLLO_17: Description = {
  id: ID,
  lead: [
    'The last bootprints anyone has left on another world are here, in a valley at the edge of the Sea of Serenity. Since December 1972 no one has gone back; every person alive under the age of about fifty-four was born into a world in which nobody stands on the Moon.',
    'Eugene Cernan and Harrison Schmitt — a geologist, the only scientist among the twelve who walked there — landed their lunar module, Challenger, in the Taurus–Littrow valley at 19:54:57 UT on 11 December 1972, while Ronald Evans orbited above. In three walks, 22 hours 4 minutes in all, they drove about 30 km between the valley’s massifs and gathered 110.52 kg of rock and soil, the most of any mission.',
    'At Shorty crater Schmitt saw that the grey ground was orange where they had scuffed it: soil made of tiny beads of volcanic glass, thought to have been sprayed out in fire-fountain eruptions billions of years ago. At the end of the last walk they unveiled the plaque on Challenger’s leg — “Here man completed his first explorations of the Moon, December 1972, A.D. May the spirit of peace in which we came be reflected in the lives of all mankind” — and Cernan was the last to step off the surface. They lifted off at 22:54:37 UT on 14 December, after 75 hours.',
    'The descent stage, the ALSEP and the rover are still there, and the flag, which LRO sees casting its shadow. In LRO’s sharpest images the rover’s double tracks can be told from the single trails of the two men, the last paths people have walked on the Moon.',
  ],
  photos: [
    sitePhoto(ID, 'schmitt-flag-earth', 640, 640, {
      title: 'Schmitt, the flag and Earth',
      caption:
        'Photographed by Cernan: Schmitt beside the flag, with Earth, some 380,000 km away, above it. Earth hangs at nearly the same place in the sky the whole time at a site like this, because the Moon keeps one face toward it.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1972-12',
      sourceUrl: 'https://images.nasa.gov/details/AS17-134-20384',
    }),
    sitePhoto(ID, 'cernan-rover', 640, 640, {
      title: 'Cernan drives the rover',
      caption:
        'Early on the first walk Cernan tries out the Lunar Roving Vehicle beside Challenger, the massif rising behind; photographed by Schmitt.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1972-12-11',
      sourceUrl: 'https://images.nasa.gov/details/as17-147-22527',
    }),
    sitePhoto(ID, 'orange-soil', 640, 640, {
      title: 'The orange soil at Shorty crater',
      caption:
        'The orange streak Schmitt spotted on the second walk, in the colour of the film: the colour of the glass beads it is made of, not a trick of the light. No other crew found any.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1972-12-12',
      sourceUrl: 'https://images.nasa.gov/details/as17-137-20989',
    }),
    sitePhoto(ID, 'plaque-replica', 640, 555, {
      title: 'The last plaque',
      caption:
        'A photographic replica of the plaque left on Challenger’s ladder: Earth’s two hemispheres, the Moon’s near side with the six landing sites, the words, and the signatures of Cernan, Evans, Schmitt and the President.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1972-12',
      sourceUrl: 'https://images.nasa.gov/details/S72-55169',
    }),
    sitePhoto(ID, 'lro-2011', 600, 600, {
      title: 'Challenger from 25 km up',
      caption:
        'LRO’s narrow-angle camera on one of its lowest passes, August 2011, 150 m across, at 25 cm a pixel: the descent stage with its shadow, and the tracks the rover and the astronauts left around it. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2011-08 (released 2011-09-06)',
      sourceUrl: 'https://lroc.im-ldi.com/images/379',
    }),
    sitePhoto(ID, 'lro-rover', 640, 640, {
      title: 'The rover from orbit and from the ground',
      caption:
        'The LROC team’s comparison: LRO’s view of the rover enlarged as far as it goes — a few pixels and a shadow — beside a NASA drawing of the car and the crew’s photograph of it at its final parking place.',
      colour: 'true',
      credit: `${LROC_CREDIT}; NASA (photograph AS17-143-21932 and drawing)`,
      licence: LROC_LICENCE,
      date: 'released 2011-09-06',
      sourceUrl: 'https://lroc.im-ldi.com/images/379',
    }),
    sitePhoto(ID, 'lro-2009', 640, 640, {
      title: 'The flag, from orbit, 2009',
      caption:
        'An enlargement of an LRO image from 2009 with the descent stage at centre and, arrowed by the LROC team, the flag — a speck and the thin shadow it casts.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2009-10-28',
      sourceUrl: 'https://images.nasa.gov/details/PIA12920',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID, ['wagner2017']),
    {
      title: 'The landing',
      text: 'Touchdown 19:54:57 UT on 11 December 1972, on the south-eastern rim of the Sea of Serenity. Three walks, 22 h 4 min in all, covering about 30 km; the last ended at 05:40:56 UT on 14 December; liftoff 22:54:37 UT that day, after about 75 hours on the Moon.',
      cite: ['nssdcaA17'],
    },
    { title: 'What came back', text: '110.52 kg of samples, the orange soil among them.', cite: ['nssdcaA17'] },
    {
      title: 'The last trails',
      text: 'In LRO’s low-altitude images of 2011, at 25 cm a pixel, the rover’s paired tracks and the astronauts’ footpaths are told apart, the rover parked east of the lander where the crew left it.',
      cite: ['lroc2011low', 'asu2011'],
    },
    {
      title: 'The flag stands',
      text: 'Its shadow shows in a sequence of six LRO images.',
      cite: ['fincannon2012'],
    },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for Challenger’s descent stage, the rover and the instruments.' }],
  misconceptions: [
    {
      title: 'Nobody has been back',
      text: 'Artemis II flew four people round the Moon in April 2026, the first so far since 1972, but did not land: these are still the last bootprints.',
    },
    NO_TELESCOPE,
  ],
  sources: [
    SITE_SOURCES.wagner2017,
    {
      key: 'nssdcaA17',
      text: 'NASA Space Science Data Coordinated Archive, Apollo 17 Lunar Module / ALSEP',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1972-096C',
    },
    SITE_SOURCES.lroc2011low,
    {
      key: 'asu2011',
      text: 'Arizona State University 2011, New LROC images offer sharper views of Apollo 12, 14, 17 sites',
      url: 'https://news.asu.edu/content/new-lroc-images-offer-sharper-views-apollo-12-14-17-sites',
    },
    SITE_SOURCES.fincannon2012,
    SITE_SOURCES.robinson2010,
  ],
};
