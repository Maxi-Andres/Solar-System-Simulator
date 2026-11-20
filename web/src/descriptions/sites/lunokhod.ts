import type { Description, DescriptionPoint } from '../types.ts';
import { LROC_CREDIT, LROC_LICENCE, NO_TELESCOPE, PHOTOJOURNAL_LICENCE, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

/** The two Soviet rovers' own panoramas: whose they are and on what terms is not clear here. */
const PANORAMAS: DescriptionPoint = {
  title: 'Its own pictures',
  text: 'Not reproduced here: the rover’s television panoramas belong to the Soviet programme’s successors, and no licence clearly free to reuse with credit was found for them. Only LRO’s views are shown.',
};

const MURPHY_2011 = {
  key: 'murphy2011',
  text: 'Murphy, T. W., et al. 2011, Laser ranging to the lost Lunokhod 1 reflector, Icarus 211, 1103',
  url: 'https://doi.org/10.1016/j.icarus.2010.11.010',
};

const ID_1 = 'site-lunokhod-1';

/** Lunokhod 1: the first robot to rove another world, and the reflector found again in 2010. */
export const LUNOKHOD_1: Description = {
  id: ID_1,
  lead: [
    'Months before any astronaut drove on the Moon, a Soviet robot did: Lunokhod 1, an eight-wheeled tub with a lid of solar cells, steered by a crew on Earth who watched its television pictures and told it where to go. It was the first rover on another world, and it worked for ten and a half months.',
    'The lander Luna 17 set it down on Mare Imbrium, the Sea of Rains, on 17 November 1970; it rolled down a ramp and set off. Over eleven lunar days it drove 10.5 km, photographing its way, testing the soil and measuring its chemistry, sleeping through each two-week night under its closed lid. After the night that began on 14 September 1971 it did not answer, and the mission was declared over on 4 October 1971, 322 days after landing.',
    'It carried a French-built laser reflector. For nearly forty years nobody knew exactly where the rover had stopped, and lasers fired from Earth found nothing. In March 2010 LRO’s camera picked it out, and within weeks a telescope in New Mexico bounced a laser off it almost at once: the reflector turned out to be in excellent condition, returning a stronger signal than its twin on Lunokhod 2.',
    'It stands where it stopped, its lander a short drive away amid the looping tracks it made leaving.',
  ],
  photos: [
    sitePhoto(ID_1, 'lro-rover', 640, 640, {
      title: 'Lunokhod 1 at its last stop',
      caption:
        'LRO’s narrow-angle camera: the rover in its final parking place on Mare Imbrium, enlarged in the inset, its shadow beside it. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'released 2012-03-14',
      sourceUrl: 'https://lroc.im-ldi.com/images/402',
    }),
    sitePhoto(ID_1, 'lro-luna-17', 640, 640, {
      title: 'Luna 17 and the tracks',
      caption:
        'The lander that brought it, its ramps still reaching down to the ground, and round it the rover’s first tracks, looping away from it.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'released 2012-03-14',
      sourceUrl: 'https://lroc.im-ldi.com/images/402',
    }),
    sitePhoto(ID_1, 'lro-2010', 640, 640, {
      title: 'The landing site, found in 2010',
      caption:
        'One of the LRO images that settled where Luna 17 came down: the lander at the arrow on the plain of Mare Imbrium.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2010-03-17',
      sourceUrl: 'https://images.nasa.gov/details/PIA12967',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_1, ['wagner2017'], 'This is where the rover stopped, not where Luna 17 landed.'),
    {
      title: 'Its drive',
      text: '10.5 km over eleven lunar days and nights, 322 Earth days, from November 1970 to its last contact in September 1971.',
      cite: ['lroc402'],
    },
    {
      title: 'Its reflector',
      text: 'Found again on 22 April 2010 by the Apache Point Observatory’s laser, aimed by LRO’s position for the rover; its position since known to a few centimetres.',
      cite: ['murphy2011', 'lroc402'],
    },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for the rover.' }, PANORAMAS],
  misconceptions: [NO_TELESCOPE],
  sources: [SITE_SOURCES.wagner2017, { key: 'lroc402', text: 'LROC team 2012, Lunokhod 1 Revisited', url: 'https://lroc.im-ldi.com/images/402' }, MURPHY_2011, SITE_SOURCES.robinson2010],
};

const ID_2 = 'site-lunokhod-2';

/** Lunokhod 2: the longest drive on the Moon for decades, ended by a scoop of dust. */
export const LUNOKHOD_2: Description = {
  id: ID_2,
  lead: [
    'A machine on the Moon can be undone by a handful of dust. Lunokhod 2 drove further than any vehicle on another world had, across the floor of a flooded crater, until its lid brushed a crater wall, scooped up soil, and dropped it on the radiators that kept it cool.',
    'Luna 21 landed it on the floor of Le Monnier, a crater on the edge of the Sea of Serenity whose rim was broken open and flooded by lava, on 15 January 1973. The rover drove south, then turned back north across the crater floor, 37 km in all.',
    'Around 9 May its open lid touched the wall of a crater and was covered with soil; when the lid closed for the night, the soil fell onto the radiators, and when it opened again the rover overheated and failed. The mission was declared over on 4 June 1973.',
    'It is parked there facing south-east, its lid still open. It too carries a French-built laser reflector, which laser stations still reach, though it returns less light than Lunokhod 1’s and is hard to use in the lunar day.',
  ],
  photos: [
    sitePhoto(ID_2, 'lro-rover', 640, 640, {
      title: 'Lunokhod 2, lid open',
      caption:
        'LRO’s narrow-angle camera: the rover parked facing south-east with its lid still open, as it stopped in 1973. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'released 2012-03-13',
      sourceUrl: 'https://lroc.im-ldi.com/images/699',
    }),
    sitePhoto(ID_2, 'lro-luna-21', 450, 450, {
      title: 'Luna 21 and the start of the tracks',
      caption:
        'The lander that brought it, at the inset, with the rover’s tracks leading away; one of LRO’s first looks at the site.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2010-03-19',
      sourceUrl: 'https://images.nasa.gov/details/PIA12976',
    }),
    sitePhoto(ID_2, 'le-monnier', 640, 526, {
      title: 'Le Monnier crater',
      caption:
        'LRO’s wide-angle view of the flooded crater on the edge of the Sea of Serenity, its seaward rim gone, with the places of the lander and the rover marked in red by the LROC team.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'released 2012-03-13',
      sourceUrl: 'https://lroc.im-ldi.com/images/699',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_2, ['wagner2017'], 'This is where the rover stopped, not where Luna 21 landed.'),
    {
      title: 'Its drive',
      text: '37 km, south and then north across the crater floor, from 15 January to its end in May 1973; the mission was declared over on 4 June.',
      cite: ['lroc699'],
    },
    {
      title: 'Its reflector',
      text: 'Still reached by laser stations, but returning about a quarter of the light Lunokhod 1’s does, and hard to use while the Sun is up.',
      cite: ['murphy2011'],
    },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for the rover.' }, PANORAMAS],
  misconceptions: [NO_TELESCOPE],
  sources: [SITE_SOURCES.wagner2017, { key: 'lroc699', text: 'LROC team 2012, Lunokhod 2 Revisited', url: 'https://lroc.im-ldi.com/images/699' }, MURPHY_2011, SITE_SOURCES.robinson2010],
};
