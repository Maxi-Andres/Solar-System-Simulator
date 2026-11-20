import type { Description } from '../types.ts';
import { KONOPLIV_2026, marsSiteDrawn, MER_NOTEBOOK } from './marsCommon.ts';

/**
 * Opportunity, where it stopped: Perseverance Valley, on the rim of Endeavour crater. Every fact
 * from the source it cites: NASA's mission page and releases, JPL's captions and the papers.
 */
export const OPPORTUNITY: Description = {
  id: 'site-opportunity',
  lead: [
    'Opportunity was meant to work for 90 days and drive a kilometre. It drove 45, more than a marathon, over fourteen years, and in the little crater it landed in it found what it had been sent to look for: rocks that had formed in water. When it fell silent in a dust storm that turned day into night, people around the world mourned a machine as if it had been a friend — and the words they quoted as its last were not its own.',
    'It was the second of NASA’s twin Mars Exploration Rovers, managed by JPL, with a science payload led by Steve Squyres of Cornell University. On 25 January 2004 (the 24th in California) its airbags hit the plains of Meridiani Planum, bounced and rolled into a crater only 22 metres wide, Eagle crater — and in the crater’s wall was bare layered rock.',
    'In that rock it found sulphate salts and small round grains of hematite, nicknamed blueberries, that grow inside rock soaked by water: Meridiani had once been flooded now and then by shallow water that dried away, a place where life could have lived. It went on to Endurance crater, to Victoria, and from 2011 to the rim of Endeavour, 22 km wide, where in a vein of gypsum it found the trace of water that had flowed through cracks in the ground. In March 2015 it became the first human enterprise to travel a marathon’s distance on another world.',
    'In June 2018 a dust storm wrapped the whole planet and blotted out the Sun over Perseverance Valley, on the inner slope of Endeavour’s rim. Opportunity’s last message, on 10 June, said in numbers that its power was nearly gone and the sky was very dark. NASA sent more than a thousand commands into the silence and on 13 February 2019 said goodbye. It still stands in Perseverance Valley, a blip in orbiters’ pictures.',
  ],
  photos: [
    {
      file: 'photos/sites/site-opportunity/lion-king-eagle-2004.webp',
      largeFile: 'photos/sites/site-opportunity/lion-king-eagle-2004-large.webp',
      width: 640,
      height: 126,
      title: 'Eagle crater: the “Lion King” panorama, 2004',
      caption:
        'Taken on sols 58 and 60 as Opportunity was leaving the crater it landed in: the empty lander at the centre, the outcrop of layered rock it studied along the rim, its tracks, and the plains of Meridiani beyond. 558 images; approximate true colour.',
      colour: 'true',
      credit: 'NASA/JPL/Cornell',
      licence: 'NASA media, not copyrighted',
      date: '2004-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA05755',
    },
    {
      file: 'photos/sites/site-opportunity/blueberries-2004.webp',
      largeFile: 'photos/sites/site-opportunity/blueberries-2004-large.webp',
      width: 640,
      height: 340,
      title: '“Blueberries”, February 2004',
      caption:
        'Round grains in the soil near the outcrop called Stone Mountain, from the microscopic imager on the rover’s arm: one of the sharpest pictures it ever took. They are hematite concretions, grown inside rock soaked by water. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/Cornell/USGS',
      licence: 'NASA media, not copyrighted',
      date: '2004-02-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA05273',
    },
    {
      file: 'photos/sites/site-opportunity/victoria-cape-verde-2006.webp',
      largeFile: 'photos/sites/site-opportunity/victoria-cape-verde-2006-large.webp',
      width: 640,
      height: 84,
      title: 'Victoria crater from Cape Verde, 2006',
      caption:
        'Hundreds of frames from the top of a promontory on the scalloped rim, from 16 October to 7 November 2006; the cliff of Cape St. Mary, about 15 m tall, is at left, and the far side of the crater 800 m away. Approximate true colour.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Cornell',
      licence: 'NASA media, not copyrighted',
      date: '2006-11-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA09104',
    },
    {
      file: 'photos/sites/site-opportunity/homestake-vein-2011.webp',
      largeFile: 'photos/sites/site-opportunity/homestake-vein-2011-large.webp',
      width: 640,
      height: 443,
      title: 'The Homestake vein, November 2011',
      caption:
        'A bright vein about a thumb wide and 45 cm long on the rim of Endeavour crater, rich in calcium and sulphur — gypsum, left by water flowing through a crack. Three exposures of the microscopic imager blended. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '2011-11-04',
      sourceUrl: 'https://images.nasa.gov/details/PIA15035',
    },
    {
      file: 'photos/sites/site-opportunity/self-portrait-2014.webp',
      largeFile: 'photos/sites/site-opportunity/self-portrait-2014-large.webp',
      width: 640,
      height: 500,
      title: 'Self-portrait, March 2014',
      caption:
        'Opportunity from above, after gusts of wind had cleaned much of the dust off its solar panels: by mid-April they gave more than 620 watt-hours a day, against less than 375 in January. The camera’s mast is not in the picture, but its shadow is. Approximate true colour.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Cornell Univ./Arizona State Univ.',
      licence: 'NASA media, not copyrighted',
      date: '2014-03-24',
      sourceUrl: 'https://images.nasa.gov/details/PIA18079',
    },
    {
      file: 'photos/sites/site-opportunity/last-panorama-2018.webp',
      largeFile: 'photos/sites/site-opportunity/last-panorama-2018-large.webp',
      width: 640,
      height: 143,
      title: 'The last panorama, May–June 2018',
      caption:
        '354 frames from Perseverance Valley, where it stopped, from 13 May to 10 June 2018: its tracks coming down from the rim of Endeavour crater. A few frames at bottom left are black and white — it had no time to take them through the other filters before the dust storm swept in. True colour, from three filters.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Cornell/ASU',
      licence: 'NASA media, not copyrighted',
      date: '2018-06-10',
      sourceUrl: 'https://images.nasa.gov/details/PIA22909',
    },
    {
      file: 'photos/sites/site-opportunity/hirise-eagle-2017.webp',
      largeFile: 'photos/sites/site-opportunity/hirise-eagle-2017-large.webp',
      width: 640,
      height: 503,
      title: 'Eagle crater from orbit, 8 April 2017',
      caption:
        'The bright landing platform Opportunity left in 2004, inside the 22 m crater it rolled into, and its back shell and parachute, lower left. HiRISE’s colour comes from red, blue-green and infrared light, not three visible colours, so the back shell looks blue.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/Univ. of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2017-04-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA21494',
    },
    {
      file: 'photos/sites/site-opportunity/hirise-after-storm-2018.webp',
      largeFile: 'photos/sites/site-opportunity/hirise-after-storm-2018-large.webp',
      width: 640,
      height: 410,
      title: 'After the storm, 20 September 2018',
      caption:
        'Perseverance Valley from Mars Reconnaissance Orbiter, 268 km up, once the dust had largely cleared: Opportunity is a blip in it, silent since June. HiRISE colour, from red, blue-green and infrared light.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/Univ. of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2018-09-20',
      sourceUrl: 'https://images.nasa.gov/details/PIA22549',
    },
  ],
  drawnHere: [
    {
      title: 'Where the mark stands',
      text: 'At 2.3344° S, 354.6510° E, worked out here, since no coordinates of the stopped rover have been published: its landing point as HiRISE found it, plus every drive in NASA’s traverse file to its last, on sol 5081, east and north metres on the 3,396.19 km sphere. The same sum puts its 2011–12 winter stop within 0.001° of where radio tracking put it. The mark stands there from the landing on, not along the 45 km it drove.',
      cite: ['konopliv2026', 'merNotebook'],
    },
    ...marsSiteDrawn('Opportunity, its lander in Eagle crater and its 45 km of tracks are not drawn.'),
  ],
  measured: [
    {
      title: 'Who made it',
      text: 'NASA’s Mars Exploration Rovers were managed by JPL; Steve Squyres of Cornell University was principal investigator of their science payload.',
      cite: ['opportunityEnd'],
    },
    {
      title: 'Launch and landing',
      text: 'Launched on 7 July 2003; landed on 25 January 2004, Universal Time, in Meridiani Planum. Its airbag-wrapped lander hit the ground near Eagle crater, 22 m across, then bounced and rolled into it.',
      cite: ['opportunity', 'pia21494'],
    },
    {
      title: 'Water at Eagle crater',
      text: 'The outcrop is sedimentary rock: grains of weathered basalt, sulphate salts making up several tens of percent of it, and hematite concretions. Its layering shows water as well as wind moved the grains. It records shallow surface water that came and went, evaporating and drying — conditions that, for a time, suited life.',
      cite: ['squyres2004'],
    },
    {
      title: 'Its journey',
      text: 'To Endurance crater, 750 m away, from March 2004; to Victoria crater in September 2006, entering it on 11 September 2007; to Endeavour crater on 9 August 2011. In March 2015 it passed a marathon’s distance, the first human enterprise to do so on another world.',
      cite: ['opportunity'],
    },
    {
      title: 'Gypsum at Endeavour',
      text: 'Veins rich in gypsum cut the rocks beside the crater’s rim: minerals laid down by water at low temperature flowing up through the ground, conditions that may for a while have been habitable.',
      cite: ['squyres2012', 'pia15035'],
    },
    {
      title: 'Records',
      text: '220 m driven in one day, on 20 March 2005; slopes as steep as 32° climbed, an off-Earth record; 45.16 km in all.',
      cite: ['opportunityEnd', 'opportunity'],
    },
    {
      title: 'Its end',
      text: 'Silent since 10 June 2018, when a planet-wide dust storm darkened the sky over the solar-powered rover. More than a thousand commands were sent to wake it; NASA declared the mission over on 13 February 2019. Designed for 90 sols and 1,000 m.',
      cite: ['opportunityEnd', 'opportunity'],
    },
  ],
  estimated: [
    {
      title: 'Its last stop, in coordinates',
      text: 'A sum of drives, not a measurement of the rover: the HiRISE landing point, tied to the MOLA frame to 100 to 300 m, plus the traverse.',
      cite: ['konopliv2026', 'merNotebook'],
    },
  ],
  missing: [
    {
      title: 'What failed',
      text: 'Not known. It never spoke again after the storm, so what finally failed cannot be told from anything it sent.',
      cite: ['opportunityEnd'],
    },
  ],
  misconceptions: [
    {
      title: '“My battery is low and it’s getting dark”',
      text: 'Not Opportunity’s words. Its last transmission was telemetry — numbers. A reporter, Jacob Margolis, put what two of the mission’s team told him about it into that sentence on Twitter, as his own interpretation; the deputy project scientist, Abigail Fraeman, said it “basically said we had no power left”, and the project manager, John Callas, that it told them the skies were incredibly dark.',
      cite: ['margolis2019'],
    },
  ],
  sources: [
    {
      key: 'opportunity',
      text: 'NASA Science, Opportunity (mission page: launch, landing, its journey, distance, the end of the mission)',
      url: 'https://science.nasa.gov/mission/mer-opportunity/',
    },
    {
      key: 'opportunityEnd',
      text: 'JPL 2019, NASA’s Opportunity Rover Mission on Mars Comes to End (news release, 13 February 2019)',
      url: 'https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/',
    },
    {
      key: 'margolis2019',
      text: 'Margolis, J. 2019, How A Tweet About The Mars Rover Dying Blew Up On The Internet And Made People Cry, LAist, 16 February 2019',
      url: 'https://laist.com/news/jpl-mars-rover-opportunity-battery-is-low-and-its-getting-dark',
    },
    {
      key: 'squyres2004',
      text: 'Squyres, S. W., et al. 2004, In Situ Evidence for an Ancient Aqueous Environment at Meridiani Planum, Mars, Science 306, 1709',
      url: 'https://doi.org/10.1126/science.1104559',
    },
    {
      key: 'squyres2012',
      text: 'Squyres, S. W., et al. 2012, Ancient Impact and Aqueous Processes at Endeavour Crater, Mars, Science 336, 570',
      url: 'https://doi.org/10.1126/science.1220476',
    },
    {
      key: 'pia15035',
      text: 'NASA/JPL-Caltech 2011, PIA15035: Close-up View of Homestake Vein (caption)',
      url: 'https://science.nasa.gov/photojournal/close-up-view-of-homestake-vein/',
    },
    {
      key: 'pia21494',
      text: 'NASA/JPL-Caltech/Univ. of Arizona 2017, PIA21494: Rover Landing Hardware at Eagle Crater, Mars (caption)',
      url: 'https://science.nasa.gov/photojournal/rovers-landing-hardware-at-eagle-crater-mars/',
    },
    KONOPLIV_2026,
    MER_NOTEBOOK,
  ],
};
