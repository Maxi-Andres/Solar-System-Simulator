import type { Description } from '../types.ts';
import { KONOPLIV_2026, marsSiteDrawn } from './marsCommon.ts';

/**
 * Mars Pathfinder and Sojourner, in Ares Vallis. Every fact from the source it cites: NASA's
 * mission pages and history article, NSSDCA, JPL's photo captions and the mission's papers.
 */
export const MARS_PATHFINDER: Description = {
  id: 'site-mars-pathfinder',
  lead: [
    'Twenty-one years after Viking, a lander bounced onto Mars inside a ball of airbags, and two days later a six-wheeled rover 63 centimetres long rolled down a ramp onto the ground. Sojourner was the first wheeled vehicle ever driven on another planet. It went rock by rock, and the rocks it nosed up to were given names — Barnacle Bill, Yogi, Ender — as if they were neighbours.',
    'Mars Pathfinder was a NASA mission, developed and run by its Jet Propulsion Laboratory as one of its first low-cost Discovery missions. It came down on 4 July 1997 in Ares Vallis, the mouth of an ancient channel carved by floods. Instead of rockets to the ground it fell under a parachute, wrapped itself in airbags about 100 metres up and hit the surface, bouncing at least 15 times, the first time as high as a four-storey building, before it rolled to a stop and opened its petals.',
    'Sojourner weighed about 10.6 kg and was named, after an essay by a twelve-year-old girl, for Sojourner Truth, who travelled to speak for freedom and for women’s rights. It was meant to work for a week and worked for 83 days, measuring the rocks with an X-ray spectrometer and photographing the ground around it. The lander, renamed the Carl Sagan Memorial Station, watched the weather and the sky. Rounded pebbles and rocks that looked like conglomerates — pebbles cemented together — said that water had once flowed here, in a warmer, wetter past.',
    'On 27 September 1997 the lander sent its last data, and no one knows why it went quiet. Sojourner, which talked to Earth only through the lander, was never heard from again. Both are still there. From orbit, in 2006, the lander shows as a bright speck with its ramps and airbags, and its parachute lies to the south, behind a ridge it never saw.',
  ],
  photos: [
    {
      file: 'photos/sites/site-mars-pathfinder/landing-day-1997.webp',
      largeFile: 'photos/sites/site-mars-pathfinder/landing-day-1997-large.webp',
      width: 640,
      height: 480,
      title: 'Landing day, 4 July 1997',
      caption:
        'At 9:30 in the Martian morning, hours after landing: Sojourner still perched on one of the lander’s three solar petals, 65 cm long, the white airbags beside it and flood-strewn rocks beyond. A colour composite from the lander’s camera filters; the light brown of the sky is dust, but the colours are near an eye’s, not calibrated to one.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1997-07-04',
      sourceUrl: 'https://images.nasa.gov/details/PIA00608',
    },
    {
      file: 'photos/sites/site-mars-pathfinder/sojourner-yogi-1997.webp',
      largeFile: 'photos/sites/site-mars-pathfinder/sojourner-yogi-1997-large.webp',
      width: 640,
      height: 328,
      title: 'Sojourner at Yogi, July 1997',
      caption:
        'Part of the Gallery Pan, the lander camera’s first full panorama, taken over sols 8 to 10: Sojourner with its X-ray spectrometer against the large rock Yogi, its tracks behind it, Twin Peaks 1 to 2 km away on the horizon. Its colours’ saturation was raised to bring out the ground, the hue kept.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1997-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA01003',
    },
    {
      file: 'photos/sites/site-mars-pathfinder/sojourner-composite.webp',
      largeFile: 'photos/sites/site-mars-pathfinder/sojourner-composite-large.webp',
      width: 640,
      height: 110,
      title: 'Where Sojourner went',
      caption:
        'A composite: the lander camera’s panorama with Sojourner pasted in at the places it reached during the mission, round the lander. There was only ever one rover; this shows its 83 days at once.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1997',
      sourceUrl: 'https://images.nasa.gov/details/PIA09105',
    },
    {
      file: 'photos/sites/site-mars-pathfinder/rover-tracks-1997.webp',
      largeFile: 'photos/sites/site-mars-pathfinder/rover-tracks-1997-large.webp',
      width: 640,
      height: 204,
      title: 'The first wheel tracks on Mars, sol 3',
      caption:
        'Sojourner’s tracks, from one of its own cameras, as it turned towards the rock Barnacle Bill after leaving the lander by the rear ramp. That the tracks held their shape showed the soil is made of grains a micron or so across. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1997-07-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA00633',
    },
    {
      file: 'photos/sites/site-mars-pathfinder/rounded-pebble-1997.webp',
      largeFile: 'photos/sites/site-mars-pathfinder/rounded-pebble-1997-large.webp',
      width: 288,
      height: 288,
      title: 'A rounded pebble, 1997',
      caption:
        'From Sojourner: a rounded pebble 4 cm wide, a wheel track crossing the picture and bright tails of drift behind small rocks. Pebbles this round were never seen at the Viking sites; they may have weathered out of conglomerates, rocks made of pebbles and sand cemented together. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1997',
      sourceUrl: 'https://images.nasa.gov/details/PIA01133',
    },
    {
      file: 'photos/sites/site-mars-pathfinder/lander-from-rover-1997.webp',
      largeFile: 'photos/sites/site-mars-pathfinder/lander-from-rover-1997-large.webp',
      width: 411,
      height: 190,
      title: 'The lander seen by the rover, sol 33',
      caption:
        'From Sojourner’s front camera: the lander with its deflated airbags, the camera on its mast looking back at the rover and the weather mast to the right. The rock in front is Ender. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1997-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA01121',
    },
    {
      file: 'photos/sites/site-mars-pathfinder/sunset-twin-peaks-1997.webp',
      largeFile: 'photos/sites/site-mars-pathfinder/sunset-twin-peaks-1997-large.webp',
      width: 640,
      height: 160,
      title: 'After sunset over Twin Peaks, sol 21',
      caption:
        'About a minute after sunset, Twin Peaks dark against the glow. The sky stayed bright for up to two hours after the Sun set, which showed that dust reaches very high in Mars’s air. A colour composite from the camera’s filters, near an eye’s colours but not calibrated to them.',
      colour: 'false',
      credit: 'NASA/JPL/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '1997-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA00783',
    },
    {
      file: 'photos/sites/site-mars-pathfinder/hirise-lander-2006.webp',
      largeFile: 'photos/sites/site-mars-pathfinder/hirise-lander-2006-large.webp',
      width: 640,
      height: 554,
      title: 'Pathfinder from orbit, 21 December 2006',
      caption:
        'HiRISE on Mars Reconnaissance Orbiter, 25 cm a pixel: the lander (MPF, top), its back shell and parachute to the south, behind a ridge the lander never saw past, and what may be debris of its heat shield. Part of NASA’s annotated image. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2006-12-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA09105',
    },
  ],
  drawnHere: [
    {
      title: 'Where the mark stands',
      text: 'At 19.0979° N, 326.7471° E, planetocentric: the lander as HiRISE found it, tied to the frame of Mars’s laser altimeter to within 100 to 300 m. It appears from the moment of touchdown on.',
      cite: ['konopliv2026'],
    },
    ...marsSiteDrawn('Neither the lander nor Sojourner is drawn, nor Sojourner’s 100 or so metres of driving round it.'),
  ],
  measured: [
    {
      title: 'Who made it',
      text: 'Developed and managed by JPL for NASA, the second mission of NASA’s Discovery programme of low-cost spacecraft.',
      cite: ['pia00608', 'naming1995'],
    },
    {
      title: 'Landing',
      text: 'Launched on 4 December 1996. It struck the ground at 16:56:55 UT on 4 July 1997 at 18 m/s, cushioned by airbags blown up about 100 m above the surface, bounced at least 15 times — the first about 12 m high — and came to rest some 2.5 minutes later, about 1 km from where it first hit. It was the first American craft to land on airbags.',
      cite: ['nssdc', 'mpf', 'history'],
    },
    {
      title: 'Sojourner',
      text: 'About 10.6 kg, 63 cm long, 48 cm wide and 28 cm high on six wheels. It rolled onto the ground on 6 July 1997 at about 05:40 UT. Planned for seven sols, it worked for 83 days, driving about 100 m in all and never more than 12 m from the lander.',
      cite: ['mpf', 'nssdcRover', 'history', 'golombek1999'],
    },
    {
      title: 'Its name',
      text: 'Chosen in 1995 from a worldwide essay contest on heroines: the winner was Valerie Ambroise, 12, of Bridgeport, Connecticut, who wrote about Sojourner Truth. The name means “traveller”.',
      cite: ['naming1995'],
    },
    {
      title: 'What it returned',
      text: 'More than 16,500 pictures from the lander and 550 from the rover, 16 chemical analyses of rocks and soil, and 8.5 million readings of temperature, pressure and wind.',
      cite: ['golombek1999'],
    },
    {
      title: 'Water, once',
      text: 'Rounded pebbles and cobbles, and rocks that look like conglomerates, suggest flowing water in equilibrium with the air: a warmer, wetter past. Some rocks are rich in silica, a sign of crust that had melted and separated.',
      cite: ['golombek1997', 'rover1997'],
    },
    {
      title: 'Mars itself',
      text: 'Radio tracking of the lander fixed the direction of Mars’s spin axis, and with Viking’s measured how it precesses: its central metal core is 1,300 to about 2,000 km in radius. Dust devils were caught passing in the afternoons.',
      cite: ['golombek1999'],
    },
    {
      title: 'Its end',
      text: 'The last data arrived at 10:23 UTC on 27 September 1997; communications were lost for reasons unknown. The team tried for five months and ended the mission on 10 March 1998. The lander was renamed the Carl Sagan Memorial Station.',
      cite: ['pia00608', 'nssdc', 'mpf'],
    },
    {
      title: 'Found from orbit',
      text: 'HiRISE imaged it on 21 December 2006: the lander with its ramps, science deck and airbags, the back shell and parachute to the south, and four bright pieces that may be its heat shield. What the team had taken in 1997 for the back shell is more likely insulation from the heat shield.',
      cite: ['pia09105'],
    },
  ],
  estimated: [],
  missing: [
    {
      title: 'Where Sojourner is',
      text: 'Not known for certain. Its last drives are not recorded, since it could speak only through the silent lander, and the HiRISE pictures show a spot next to the lander that may be it — labelled with a question mark by the team that mapped it.',
      cite: ['pia09105'],
    },
    {
      title: 'Why it stopped',
      text: 'Not known: the lander simply fell silent, and nothing it sent says why.',
      cite: ['nssdc'],
    },
  ],
  misconceptions: [
    {
      title: 'Sojourner did not roam',
      text: 'It drove about 100 m in all, in short hops round the lander, and never went more than 12 m from it.',
      cite: ['history', 'golombek1999'],
    },
  ],
  sources: [
    {
      key: 'mpf',
      text: 'NASA Science, Mars Pathfinder (mission page: launch, landing, Sojourner, the Carl Sagan Memorial Station, findings)',
      url: 'https://science.nasa.gov/mission/mars-pathfinder/',
    },
    {
      key: 'history',
      text: 'NASA History 2021, 25 Years Ago: Mars Pathfinder Launches to Mars to Deploy Sojourner, the First Planetary Rover',
      url: 'https://www.nasa.gov/history/25-years-ago-mars-pathfinder-launches-to-mars-to-deploy-sojourner-the-first-planetary-rover-2',
    },
    {
      key: 'nssdc',
      text: 'NASA Space Science Data Coordinated Archive, Mars Pathfinder (1996-068A)',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1996-068A',
    },
    {
      key: 'nssdcRover',
      text: 'NASA Space Science Data Coordinated Archive, Mars Pathfinder Rover (Sojourner)',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=MESURPR',
    },
    {
      key: 'naming1995',
      text: 'JPL 1995, NASA Names First Rover to Explore the Surface of Mars (news release, 14 July 1995)',
      url: 'https://www.jpl.nasa.gov/news/nasa-names-first-rover-to-explore-the-surface-of-mars',
    },
    {
      key: 'golombek1997',
      text: 'Golombek, M. P., et al. 1997, Overview of the Mars Pathfinder Mission and Assessment of Landing Site Predictions, Science 278, 1743',
      url: 'https://doi.org/10.1126/science.278.5344.1743',
    },
    {
      key: 'rover1997',
      text: 'Rover Team 1997, Characterization of the Martian Surface Deposits by the Mars Pathfinder Rover, Sojourner, Science 278, 1765',
      url: 'https://doi.org/10.1126/science.278.5344.1765',
    },
    {
      key: 'golombek1999',
      text: 'Golombek, M. P., et al. 1999, Overview of the Mars Pathfinder Mission: Launch through landing, surface operations, data sets, and science results, J. Geophys. Res. 104, 8523',
      url: 'https://doi.org/10.1029/98JE02554',
    },
    {
      key: 'pia00608',
      text: 'NASA/JPL, PIA00608: Rover, Airbags & Martian Terrain (caption, with the Photojournal’s note on the mission’s end)',
      url: 'https://science.nasa.gov/photojournal/rover-airbags-and-martian-terrain/',
    },
    {
      key: 'pia09105',
      text: 'NASA/JPL/University of Arizona/USGS 2007, PIA09105: Mars Pathfinder Landing Site and Surroundings (caption and figures)',
      url: 'https://science.nasa.gov/photojournal/mars-pathfinder-landing-site-and-surroundings/',
    },
    KONOPLIV_2026,
  ],
};
