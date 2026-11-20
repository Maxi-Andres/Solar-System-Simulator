import type { Description } from '../types.ts';
import { KONOPLIV_2026, marsSiteDrawn, MER_NOTEBOOK } from './marsCommon.ts';

/**
 * Spirit, where it stopped: Troy, beside Home Plate in Gusev crater. Every fact from the source
 * it cites: NASA's mission pages and releases, and JPL's photo captions.
 */
export const SPIRIT: Description = {
  id: 'site-spirit',
  lead: [
    'Spirit was built to last three months. It worked for six years, climbed a hill named for an astronaut who died coming home, and when one of its wheels jammed it drove backwards, dragging it — and the dead wheel, scraping the ground, turned up the best evidence it ever found that Mars once had hot water. Its end came in a patch of soft sand, where it could not get out, and then the winter came.',
    'It was one of NASA’s twin Mars Exploration Rovers, managed by JPL, with a science payload led by Steve Squyres of Cornell University. It bounced down on airbags inside Gusev crater on 4 January 2004 (3 January in California), aimed there because the crater may once have held a lake. From there it set off for hills on the horizon, which NASA named for the seven astronauts lost with the Space Shuttle Columbia eleven months before.',
    'In the Columbia Hills it found a surprising variety of rock, a low plateau called Home Plate that keeps the trace of an ancient explosion, and, in 2007, soil nine-tenths silica, left most likely by hot springs or steam vents. It reached the summit of Husband Hill in September 2005. Its solar panels gathered dust, and more than once whirlwinds of wind, dust devils, swept them clean.',
    'On 1 May 2009, near Home Plate, its wheels broke through a crust into soft soil at a place called Troy, and months of attempts could not free it. In January 2010 it became a stationary research station. It last spoke on 22 March 2010. NASA stopped listening on 25 May 2011, after 7.7 kilometres and six years on Mars. It is still at Troy, and orbiters can see it there.',
  ],
  photos: [
    {
      file: 'photos/sites/site-spirit/columbia-hills-2004.webp',
      largeFile: 'photos/sites/site-spirit/columbia-hills-2004-large.webp',
      width: 640,
      height: 389,
      title: 'The Columbia Hills from the landing site, 2004',
      caption:
        'Looking east from where Spirit landed, its airbags in the foreground: the seven hills named on 2 February 2004 for the crew of the Space Shuttle Columbia, 2.9 to 4.4 km away — Anderson, Brown, Chawla, Clark, Husband, McCool and Ramon. A colour composite from the panoramic camera; NASA’s caption does not say how near an eye’s its colours are.',
      colour: 'false',
      credit: 'NASA/JPL/Cornell',
      licence: 'NASA media, not copyrighted',
      date: '2004-02-02',
      sourceUrl: 'https://images.nasa.gov/details/PIA05200',
    },
    {
      file: 'photos/sites/site-spirit/sunset-gusev-2005.webp',
      largeFile: 'photos/sites/site-spirit/sunset-gusev-2005-large.webp',
      width: 640,
      height: 493,
      title: 'Sunset in Gusev, 19 May 2005',
      caption:
        'The Sun setting behind the rim of Gusev crater, about 80 km away, at 6:07 in the evening of sol 489. The blue glow round it would be seen by an eye there; the red of the sky farther off is exaggerated, an effect of the camera’s infrared filter. The Sun looks two-thirds the size it does from Earth.',
      colour: 'false',
      credit: 'NASA/JPL/Texas A&M/Cornell',
      licence: 'NASA media, not copyrighted',
      date: '2005-05-19',
      sourceUrl: 'https://images.nasa.gov/details/PIA07997',
    },
    {
      file: 'photos/sites/site-spirit/mcmurdo-panorama-2006.webp',
      largeFile: 'photos/sites/site-spirit/mcmurdo-panorama-2006-large.webp',
      width: 640,
      height: 181,
      title: 'Winter Haven: the McMurdo panorama, 2006',
      caption:
        'From April to October 2006 Spirit sat out the southern winter on a slope called Low Ridge, its panels tilted to the Sun, and took this full circle, its own deck in the middle. Left of centre, the trench dug by its dead right-front wheel shows bright soil beneath; Husband Hill is on the horizon at right. Approximate true colour: the team’s best estimate of what an eye would see.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
      licence: 'NASA media, not copyrighted',
      date: '2006-10-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA16440',
    },
    {
      file: 'photos/sites/site-spirit/silica-soil-2007.webp',
      largeFile: 'photos/sites/site-spirit/silica-soil-2007-large.webp',
      width: 640,
      height: 640,
      title: 'Soil nine-tenths silica, 2007',
      caption:
        'The bright patch “Gertrude Weise”, turned up on 29 March 2007 by the wheel Spirit drags, about 90% silica: water, probably hot, must have concentrated it. The track is about 20 cm wide. Approximate true colour, from three of the panoramic camera’s filters.',
      colour: 'true',
      credit: 'NASA/JPL/Cornell',
      licence: 'NASA media, not copyrighted',
      date: '2007-05-06',
      sourceUrl: 'https://images.nasa.gov/details/PIA09491',
    },
    {
      file: 'photos/sites/site-spirit/view-from-troy-2009.webp',
      largeFile: 'photos/sites/site-spirit/view-from-troy-2009-large.webp',
      width: 640,
      height: 119,
      title: 'Stuck at Troy, 28 April 2009',
      caption:
        'From the navigation camera, five sols after the wheels began to sink: the tracks it came by run off to the north, Husband Hill is on the right of the horizon. Five more drives moved it a few centimetres, its wheels slipping more than 99%. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '2009-04-28',
      sourceUrl: 'https://images.nasa.gov/details/PIA12142',
    },
    {
      file: 'photos/sites/site-spirit/calypso-panorama-troy-2009.webp',
      largeFile: 'photos/sites/site-spirit/calypso-panorama-troy-2009-large.webp',
      width: 640,
      height: 141,
      title: 'Troy: the Calypso panorama, May–June 2009',
      caption:
        'Hundreds of frames round the place Spirit was caught: Home Plate fills the right half, Husband Hill is in the distance at the centre. The bright soil in the foreground is the soft layer its wheels broke into. The black is where no frames were taken. Approximate true colour.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Cornell University',
      licence: 'NASA media, not copyrighted',
      date: '2009-06-20',
      sourceUrl: 'https://images.nasa.gov/details/PIA12203',
    },
    {
      file: 'photos/sites/site-spirit/hirise-troy-2009.webp',
      largeFile: 'photos/sites/site-spirit/hirise-troy-2009-large.webp',
      width: 640,
      height: 523,
      title: 'Spirit at Troy from orbit, 13 June 2009',
      caption:
        'The pale disc is Home Plate, about 80 m across; the bright dot just left of it, at nine o’clock, is Spirit, then more than a month in the soft soil. HiRISE on Mars Reconnaissance Orbiter. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2009-06-13',
      sourceUrl: 'https://images.nasa.gov/details/PIA12205',
    },
  ],
  drawnHere: [
    {
      title: 'Where the mark stands',
      text: 'At 14.6076° S, 175.5290° E, worked out here, since no coordinates of the stopped rover have been published: its landing point as HiRISE found it, plus every drive in NASA’s traverse file for Spirit, east and north metres on the 3,396.19 km sphere. It lands on NASA’s own “14.6° S, 175.5° E” for Troy. The mark stands there from the landing on, not along the 7.7 km it drove.',
      cite: ['konopliv2026', 'merNotebook', 'pia12205'],
    },
    ...marsSiteDrawn('Spirit, its lander — the Columbia Memorial Station — and its 7.7 km of tracks are not drawn.'),
  ],
  measured: [
    {
      title: 'Who made it',
      text: 'NASA’s Mars Exploration Rovers, Spirit and Opportunity, were managed by JPL; Steve Squyres of Cornell University was principal investigator of their science payload.',
      cite: ['opportunityEnd', 'pia05200'],
    },
    {
      title: 'Launch and landing',
      text: 'Launched on 10 June 2003. It reached the surface at 20:35 Pacific time on 3 January 2004 — 04:35 UT on the 4th — inside Gusev crater, cushioned by four airbags of the kind Mars Pathfinder used.',
      cite: ['spirit'],
    },
    {
      title: 'The Columbia Hills',
      text: 'Named by NASA on 2 February 2004 for the seven astronauts of Space Shuttle Columbia, lost on 1 February 2003: seven hills 2.9 to 4.4 km east of the landing site. Spirit reached the summit of Husband Hill, named for Columbia’s commander, on 29 September 2005.',
      cite: ['pia05200', 'spirit'],
    },
    {
      title: 'What it found',
      text: 'A surprising variety of bedrock in the Columbia Hills; at Home Plate, signs of an ancient explosion; and soil about 90% silica, most likely from hot springs or steam vents, turned up in 2007 by the right-front wheel it dragged.',
      cite: ['spirit', 'pia09491'],
    },
    {
      title: 'Cleaned by the wind',
      text: 'Dust devils swept its solar panels: in March 2005 its power rose from about 60% to 93% of what it had at landing.',
      cite: ['spirit'],
    },
    {
      title: 'Stuck',
      text: 'Its wheels began to sink on 23 April 2009 and it was embedded by 1 May, at Troy, beside Home Plate. Months of tests with test rovers at JPL and attempts on Mars failed; in late January 2010 its mission became a stationary one.',
      cite: ['spirit', 'pia12142', 'pia12205'],
    },
    {
      title: 'Its end',
      text: 'Nothing was heard from it after 22 March 2010. NASA ended its attempts to regain contact on 25 May 2011. Planned for 90 Martian days, it worked for 6 years, 2 months and 19 days and drove 7.73 km.',
      cite: ['spirit'],
    },
  ],
  estimated: [
    {
      title: 'Its last stop, in coordinates',
      text: 'The mark’s latitude and longitude are a sum of drives, not a measurement of the rover: the HiRISE landing point, to 100 to 300 m in the MOLA frame, plus the traverse. The same sum for Opportunity lands within 0.001° of a radio-tracked stop.',
      cite: ['konopliv2026', 'merNotebook'],
    },
  ],
  missing: [
    {
      title: 'Why it fell silent',
      text: 'Not known. It went into the Martian winter stuck and was never heard again; NASA’s pages do not say what failed.',
      cite: ['spirit'],
    },
  ],
  misconceptions: [
    {
      title: 'Dust did not simply smother it',
      text: 'Dust settling on its solar panels did not simply wear it down: the wind cleaned them too — dust devils swept them more than once, and in March 2005 its power rose from about 60% to 93%.',
      cite: ['spirit'],
    },
  ],
  sources: [
    {
      key: 'spirit',
      text: 'NASA Science, Spirit (mission page: launch, landing, findings, Troy, the end of the mission)',
      url: 'https://science.nasa.gov/mission/mer-spirit/',
    },
    {
      key: 'opportunityEnd',
      text: 'JPL 2019, NASA’s Opportunity Rover Mission on Mars Comes to End (news release, 13 February 2019)',
      url: 'https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/',
    },
    {
      key: 'pia05200',
      text: 'NASA/JPL/Cornell 2004, PIA05200: NASA Dedicates Mars Landmarks to Columbia Crew (caption)',
      url: 'https://science.nasa.gov/photojournal/nasa-dedicates-mars-landmarks-to-columbia-crew/',
    },
    {
      key: 'pia09491',
      text: 'NASA/JPL/Cornell 2007, PIA09491: Silica-Rich Soil Found by Spirit (caption)',
      url: 'https://science.nasa.gov/photojournal/silica-rich-soil-found-by-spirit/',
    },
    {
      key: 'pia12142',
      text: 'NASA/JPL-Caltech 2009, PIA12142: Spirit’s View from Troy (caption)',
      url: 'https://science.nasa.gov/photojournal/spirits-view-from-troy/',
    },
    {
      key: 'pia12205',
      text: 'NASA/JPL-Caltech/University of Arizona 2009, PIA12205: Orbital View of Spirit at Troy (caption)',
      url: 'https://science.nasa.gov/photojournal/orbital-view-of-spirit-at-troy/',
    },
    KONOPLIV_2026,
    MER_NOTEBOOK,
  ],
};
