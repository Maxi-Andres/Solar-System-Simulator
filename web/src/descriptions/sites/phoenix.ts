import type { Description } from '../types.ts';
import { marsSiteDrawn } from './marsCommon.ts';

/**
 * Phoenix, on the arctic plain of Vastitas Borealis. Every fact from the source it cites:
 * NASA's mission page, JPL's photo captions and the mission's papers in Science.
 */
export const PHOENIX: Description = {
  id: 'site-phoenix',
  lead: [
    'Phoenix went to the Martian arctic to dig for ice, and found it before it had dug at all. When its rockets blew away the soil beneath it on landing, there it was — a smooth, bright floor a few centimetres down — and when its arm dug, chunks of it lay in the trench for a few days and vanished into the thin air. Water, frozen, a hand’s width under the dust of another world.',
    'Phoenix was a NASA lander led by the University of Arizona, managed by JPL and built by Lockheed Martin in Denver. It touched down on 25 May 2008 at 68° north, on an arctic plain called Vastitas Borealis, slowing to the ground on rockets. The ground there is cracked into polygons, as permafrost on Earth is.',
    'It dug trenches with a robotic arm and baked and wetted the soil in its laboratories. Heated, the ice gave off water. The soil was alkaline, held calcium carbonate — a mineral that forms in water — and perchlorate, a salt that would later make scientists reread Viking’s search for organic matter. Its laser, shining up into the sky, found clouds of ice crystals forming each day and falling back towards the ground: snow, falling from Martian clouds.',
    'Its end was planned. As autumn came the Sun sank, its solar panels gave less and less, and in November 2008 it fell silent, as planned. That winter carbon-dioxide frost, as much as several decimetres of it, blanketed the plain and the lander on it. When an orbiter looked again in 2010, it was coated in dust and one of its two round solar panels seemed to have collapsed under the weight.',
  ],
  photos: [
    {
      file: 'photos/sites/site-phoenix/descending-2008.webp',
      largeFile: 'photos/sites/site-phoenix/descending-2008-large.webp',
      width: 640,
      height: 318,
      title: 'Phoenix under its parachute, 25 May 2008',
      caption:
        'Seen by HiRISE on Mars Reconnaissance Orbiter as it came down: the lander hanging from its parachute, enlarged in the inset, against the 10 km crater Heimdall. It only looks as if it is falling into the crater; it was about 20 km in front of it. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2008-05-25',
      sourceUrl: 'https://images.nasa.gov/details/PIA10705',
    },
    {
      file: 'photos/sites/site-phoenix/panorama-2008.webp',
      largeFile: 'photos/sites/site-phoenix/panorama-2008-large.webp',
      width: 640,
      height: 151,
      title: 'The arctic plain, 2008',
      caption:
        'Hundreds of frames from the first weeks: the polygon-cracked ground, like permafrost on Earth, the lander’s two round solar panels and deck, the weather mast with its wind gauge, and at right the trenches its arm dug. Approximate true colour.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/University of Arizona/Texas A&M University',
      licence: 'NASA media, not copyrighted',
      date: '2008',
      sourceUrl: 'https://images.nasa.gov/details/PIA13804',
    },
    {
      file: 'photos/sites/site-phoenix/ice-under-lander-2008.webp',
      largeFile: 'photos/sites/site-phoenix/ice-under-lander-2008-large.webp',
      width: 512,
      height: 256,
      title: 'Ice under the lander, sol 5',
      caption:
        'From the camera on the arm, looking under the lander towards its south leg: smooth, level surfaces swept clear of soil by the rocket exhaust at landing, the descent thrusters at the top. More and more of it showed, and it was ice beneath a thin blanket of soil. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/University of Arizona/Max Planck Institute',
      licence: 'NASA media, not copyrighted',
      date: '2008-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA10741',
    },
    {
      file: 'photos/sites/site-phoenix/disappearing-ice-2008.webp',
      largeFile: 'photos/sites/site-phoenix/disappearing-ice-2008-large.webp',
      width: 512,
      height: 1024,
      title: 'Ice vanishing, 15 and 18 June 2008',
      caption:
        'The trench “Dodo-Goldilocks” on sols 20 and 24: lumps in the lower left of the upper frame are gone four days later, turned straight to vapour as ice does in Mars’s thin air. Colour from the lander’s stereo camera filters.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/University of Arizona/Texas A&M University',
      licence: 'NASA media, not copyrighted',
      date: '2008-06-18',
      sourceUrl: 'https://images.nasa.gov/details/PIA10906',
    },
    {
      file: 'photos/sites/site-phoenix/snow-white-trench-2008.webp',
      largeFile: 'photos/sites/site-phoenix/snow-white-trench-2008-large.webp',
      width: 512,
      height: 512,
      title: 'The “Snow White” trench, 23 July 2008',
      caption:
        'After the arm had scraped it, on sol 58, to reach a hard layer of soil that may hold frozen water: 4 to 5 cm deep, about 23 cm wide and 60 cm long. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/University of Arizona/Texas A&M University',
      licence: 'NASA media, not copyrighted',
      date: '2008-07-23',
      sourceUrl: 'https://images.nasa.gov/details/PIA10978',
    },
    {
      file: 'photos/sites/site-phoenix/hirise-2008-2010.webp',
      largeFile: 'photos/sites/site-phoenix/hirise-2008-2010-large.webp',
      width: 640,
      height: 350,
      title: 'Before and after a Martian winter, 2008 and 2010',
      caption:
        'Phoenix from HiRISE on 20 July 2008 and 7 May 2010, in nearly the same light: in 2008 a bright glint and blue panels; in 2010 dust-covered, and the shadow of its western solar panel gone. HiRISE colour includes infrared, so it is not what an eye would see.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2010-05-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA13158',
    },
  ],
  drawnHere: [
    {
      title: 'Where the mark stands',
      text: 'At 68.2188° N, 234.2508° E: the lander’s position in the Phoenix Analyst’s Notebook, in the IAU 2000 areocentric frame. It appears from the moment of touchdown on.',
      cite: ['phxNotebook'],
    },
    ...marsSiteDrawn('The lander, its heat shield and its back shell with the parachute are a few metres across and lie hundreds of metres apart.'),
  ],
  measured: [
    {
      title: 'Who made it',
      text: 'Led by the University of Arizona for NASA; project management by JPL; the spacecraft developed by Lockheed Martin Space Systems in Denver.',
      cite: ['pia13804'],
    },
    {
      title: 'Landing',
      text: 'Launched on 4 August 2007; landed on 25 May 2008 in the Green Valley of Vastitas Borealis, at 68.22° N, 234.25° E — the first successful landing of a stationary lander on Mars since Viking 2, about 32 years earlier.',
      cite: ['phoenix'],
    },
    {
      title: 'Ice',
      text: 'A layer of ice 5 to 15 cm below the soil. Under the lander the rocket exhaust laid bare smooth, level surfaces of it; in a trench, lumps of it turned to vapour within four days; and on 31 July 2008 its thermal and evolved-gas analyser confirmed water from a heated sample.',
      cite: ['smith2009', 'pia10741', 'pia10906', 'phoenix'],
    },
    {
      title: 'The soil',
      text: 'Alkaline, unlike the soils the Mars Exploration Rovers met; with calcium carbonate, and most of its soluble chlorine in the form of perchlorate. Together these suggest the soil was altered by liquid water in the geologically recent past.',
      cite: ['boynton2009', 'hecht2009'],
    },
    {
      title: 'Snow from clouds',
      text: 'Its lidar, a laser shone up into the sky, found clouds of water-ice crystals forming each day and precipitating back towards the surface.',
      cite: ['whiteway2009'],
    },
    {
      title: 'Its end',
      text: 'Planned for 90 days, extended to 30 September 2008. As planned, it fell silent in November 2008, about six months after landing, when its solar panels stopped working in the dark Martian winter.',
      cite: ['phoenix', 'pia13804'],
    },
    {
      title: 'After the winter',
      text: 'In HiRISE images of 7 May 2010 the lander, heat shield and back shell are covered in dust, and the shadow of the western solar panel is gone. At 68° north, carbon-dioxide frost forms up to several decimetres thick each winter, and the panels were not built to bear it: the team concluded the western one collapsed.',
      cite: ['pia13158'],
    },
  ],
  estimated: [],
  missing: [
    {
      title: 'How much frost lay on it',
      text: 'Not measured: nothing was working to weigh it. That the frost broke a panel is read from a missing shadow in an orbiter’s picture.',
      cite: ['pia13158'],
    },
  ],
  misconceptions: [
    {
      title: 'Perchlorate is not a sign of life',
      text: 'Nor of its absence. NASA said plainly that finding it neither confirmed nor refuted life; what it changed was how Viking’s missing organic matter is read, since perchlorate destroys organics when soil is heated.',
      cite: ['phoenix', 'navarro2010'],
    },
    {
      title: 'Mars is not dry',
      text: 'Its surface is, but at Phoenix’s site there is a layer of ice 5 to 15 cm under the soil.',
      cite: ['smith2009'],
    },
  ],
  sources: [
    {
      key: 'phoenix',
      text: 'NASA Science, Phoenix (mission page: launch, landing, the ice, TEGA’s water, perchlorate, the end of the mission)',
      url: 'https://science.nasa.gov/mission/phoenix/',
    },
    {
      key: 'phxNotebook',
      text: 'PDS Geosciences Node, Washington University in St. Louis, Phoenix Analyst’s Notebook (the lander’s position, IAU 2000 areocentric)',
      url: 'https://an.rsl.wustl.edu/phx/',
    },
    {
      key: 'smith2009',
      text: 'Smith, P. H., et al. 2009, H₂O at the Phoenix Landing Site, Science 325, 58',
      url: 'https://doi.org/10.1126/science.1172339',
    },
    {
      key: 'boynton2009',
      text: 'Boynton, W. V., et al. 2009, Evidence for Calcium Carbonate at the Mars Phoenix Landing Site, Science 325, 61',
      url: 'https://doi.org/10.1126/science.1172768',
    },
    {
      key: 'hecht2009',
      text: 'Hecht, M. H., et al. 2009, Detection of Perchlorate and the Soluble Chemistry of Martian Soil at the Phoenix Lander Site, Science 325, 64',
      url: 'https://doi.org/10.1126/science.1172466',
    },
    {
      key: 'whiteway2009',
      text: 'Whiteway, J. A., et al. 2009, Mars Water-Ice Clouds and Precipitation, Science 325, 68',
      url: 'https://doi.org/10.1126/science.1172344',
    },
    {
      key: 'navarro2010',
      text: 'Navarro-González, R., Vargas, E., de la Rosa, J., Raga, A. C., & McKay, C. P. 2010, Reanalysis of the Viking results suggests perchlorate and organics at midlatitudes on Mars, J. Geophys. Res. 115, E12010',
      url: 'https://doi.org/10.1029/2010JE003599',
    },
    {
      key: 'pia10741',
      text: 'NASA/JPL-Caltech/University of Arizona 2008, PIA10741: Hard Substrate, Possibly Ice, Uncovered Under the Mars Lander (caption)',
      url: 'https://science.nasa.gov/photojournal/hard-substrate-possibly-ice-uncovered-under-the-mars-lander/',
    },
    {
      key: 'pia10906',
      text: 'NASA/JPL-Caltech/University of Arizona/Texas A&M University 2008, PIA10906: Disappearing Ice (caption)',
      url: 'https://science.nasa.gov/photojournal/disappearing-ice/',
    },
    {
      key: 'pia13804',
      text: 'NASA/JPL-Caltech/University of Arizona/Texas A&M University 2011, PIA13804: Mars Panorama of Phoenix Landing Site and Lander Deck (caption)',
      url: 'https://science.nasa.gov/photojournal/mars-panorama-of-phoenix-landing-site-and-lander-deck/',
    },
    {
      key: 'pia13158',
      text: 'NASA/JPL-Caltech/University of Arizona 2010, PIA13158: Image from Mars Orbit Indicates Solar Panels on Phoenix Lander May Have Collapsed (caption)',
      url: 'https://science.nasa.gov/photojournal/image-from-mars-orbit-indicates-solar-panels-on-phoenix-lander-may-have-collapsed/',
    },
  ],
};
