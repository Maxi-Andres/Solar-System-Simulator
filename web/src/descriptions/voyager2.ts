import type { Description } from './types.ts';

/**
 * Voyager 2. Every number here is from the source it cites; distances that grow every day
 * are quoted with the date they hold for, and the panel gives the live ones. What the app
 * draws of it is read off its catalog entry (generated.ts) and core/heliosphere.ts.
 */
export const VOYAGER_2: Description = {
  id: 'voyager-2',
  lead: [
    'Everything humanity has seen up close of Uranus and Neptune, it has seen through Voyager 2. Nearly forty years on, no other craft has been back to either: the only close views of two whole worlds, their rings and their moons, come from a single pass each by a probe launched in 1977. It then went on to become the second thing people have made to reach the space between the stars.',
    'It is NASA’s twin of Voyager 1, built alike: a 3.7-metre dish that always points back at Earth, a 13-metre magnetometer boom, and no solar panels — it runs on the heat of decaying plutonium, through three radioisotope generators. It was launched first, on 20 August 1977, on a slower path that let it visit all four giant planets, one after another, in a line-up of the outer planets that comes round only about once every 175 years.',
    'It flew past Jupiter in 1979 and Saturn in 1981, then reached Uranus in January 1986 and found ten new moons and a magnetic field tilted far from the planet’s axis. In August 1989 it passed 4,800 kilometres above Neptune’s clouds and saw a storm as wide as Earth, the Great Dark Spot, and geysers on Neptune’s large moon Triton throwing dark material kilometres high.',
    'On 5 November 2018, 119 times as far from the Sun as Earth, it crossed the heliopause into interstellar space. Unlike its twin, whose plasma instrument failed in 1980, it could measure the Sun’s wind directly as it stopped. It moves at about 15 kilometres per second away from the Sun, heading south of the plane of the planets, while Voyager 1 climbs north of it. The panel gives where it is now.',
    'Its generators lose about 4 watts of power a year. In 2025 the team switched off one more instrument, and in 2026 rearranged how its heaters and devices draw power to keep the last three running at least another year. One day it will fall silent; it will go on drifting, and in about 300 years reach the inner edge of the Oort cloud.',
  ],
  photos: [
    {
      file: 'photos/voyager-2/launch-1977.webp',
      largeFile: 'photos/voyager-2/launch-1977-large.webp',
      width: 640,
      height: 814,
      title: 'Launch, 20 August 1977',
      caption:
        'Voyager 2 leaving on its Titan IIIE–Centaur from Cape Canaveral at 10:29 in the morning, local time, the first of the two to go.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '1977-08-20',
      sourceUrl: 'https://images.nasa.gov/details/PIA21744',
    },
    {
      file: 'photos/voyager-2/testing-1977.webp',
      largeFile: 'photos/voyager-2/testing-1977-large.webp',
      width: 640,
      height: 509,
      title: 'Being worked on at JPL, 23 March 1977',
      caption:
        'Engineers in clean-room suits on and around Voyager 2, five months before launch. The white dish on top is the 3.7-metre antenna that still points at Earth.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '1977-03-23',
      sourceUrl: 'https://images.nasa.gov/details/PIA21736',
    },
    {
      file: 'photos/voyager-2/encapsulation-1977.webp',
      largeFile: 'photos/voyager-2/encapsulation-1977-large.webp',
      width: 640,
      height: 810,
      title: 'Into its shroud, August 1977',
      caption:
        'At Kennedy Space Center’s Spacecraft Assembly and Encapsulation Facility, the payload fairing hangs over Voyager 2; it was enclosed on 2 August 1977, to be shielded on the way up through the atmosphere. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/KSC',
      licence: 'NASA media, not copyrighted',
      date: '1977-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA21743',
    },
    {
      file: 'photos/voyager-2/hoisting-1977.webp',
      largeFile: 'photos/voyager-2/hoisting-1977-large.webp',
      width: 640,
      height: 689,
      title: 'Hoisted onto its rocket, August 1977',
      caption: 'Voyager 2, sealed in its fairing, lifted up the launch tower to be attached to its Titan–Centaur at Cape Canaveral.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/KSC',
      licence: 'NASA media, not copyrighted',
      date: '1977-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA21727',
    },
    {
      file: 'photos/voyager-2/europa-1979.webp',
      largeFile: 'photos/voyager-2/europa-1979-large.webp',
      width: 640,
      height: 618,
      title: 'Europa, 9 July 1979',
      caption:
        'Jupiter’s moon Europa at closest approach: a smooth shell of ice criss-crossed by dark streaks where the crust has cracked and filled from below, with very few craters. A colour composite from the camera’s filters, not quite an eye’s colours.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1979-07-09',
      sourceUrl: 'https://images.nasa.gov/details/PIA00459',
    },
    {
      file: 'photos/voyager-2/neptune-clouds-1989.webp',
      largeFile: 'photos/voyager-2/neptune-clouds-1989-large.webp',
      width: 640,
      height: 559,
      title: 'Clouds casting shadows on Neptune, 25 August 1989',
      caption:
        'Two hours before closest approach, bright streaks of cloud at 29° north, high enough above the deck beneath to cast shadows on it, with the Sun to the lower left; 11 km a pixel. A colour composite from the camera’s filters, not quite an eye’s colours.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-25',
      sourceUrl: 'https://images.nasa.gov/details/PIA00058',
    },
    {
      file: 'photos/voyager-2/saturn-1981.webp',
      largeFile: 'photos/voyager-2/saturn-1981-large.webp',
      width: 640,
      height: 640,
      title: 'Saturn, 21 July 1981',
      caption:
        'Saturn a month before closest approach, which NASA released as a true-colour picture. The two small dots below it are the moons Rhea and Dione.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1981-07-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA00030',
    },
    {
      file: 'photos/voyager-2/uranus-crescent-1986.webp',
      largeFile: 'photos/voyager-2/uranus-crescent-1986-large.webp',
      width: 540,
      height: 800,
      title: 'Uranus as a crescent, January 1986',
      caption:
        'Looking back after the flyby of 24 January 1986, a view no one had had before. A colour composite from the camera’s filters, which NASA does not call true colour; the thin crescent shows almost none.',
      colour: 'false',
      credit: 'NASA/JPL/USGS',
      licence: 'NASA media, not copyrighted',
      date: '1986-01',
      sourceUrl: 'https://images.nasa.gov/details/PIA00346',
    },
    {
      file: 'photos/voyager-2/miranda-1986.webp',
      largeFile: 'photos/voyager-2/miranda-1986-large.webp',
      width: 640,
      height: 648,
      title: 'Miranda, 24 January 1986',
      caption:
        'The smallest of Uranus’s five large moons, about 470 km across, as a mosaic from the day of closest approach, seen from below its south pole: a patchwork of grooved and cratered ground. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/USGS',
      licence: 'NASA media, not copyrighted',
      date: '1986-01-24',
      sourceUrl: 'https://images.nasa.gov/details/PIA01490',
    },
    {
      file: 'photos/neptune/voyager-1989.webp',
      largeFile: 'photos/neptune/voyager-1989-large.webp',
      width: 640,
      height: 639,
      title: 'Neptune, 20 August 1989',
      caption:
        'The picture of Neptune everyone knows, from 7 million km, with the Great Dark Spot at the centre. Made from two filters and stretched to bring out the clouds: Neptune is not this blue.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-20',
      sourceUrl: 'https://images.nasa.gov/details/PIA01492',
    },
    {
      file: 'photos/neptune/voyager-true-colour.webp',
      largeFile: 'photos/neptune/voyager-true-colour-large.webp',
      width: 640,
      height: 315,
      title: 'Uranus and Neptune as an eye would see them',
      caption:
        'Voyager 2’s own filter images of Uranus in 1986 and Neptune in 1989, re-processed in 2024 into true colour: both pale, Neptune only a little bluer.',
      colour: 'true',
      credit: 'Irwin et al. 2024, MNRAS 527, 11521, from NASA/JPL Voyager 2 data',
      licence: 'CC BY 4.0; cropped to one row of the figure, its panel label removed',
      date: '2024 (from 1986 and 1989 images)',
      sourceUrl: 'https://doi.org/10.1093/mnras/stad3761',
    },
    {
      file: 'photos/voyager-2/triton-1989.webp',
      largeFile: 'photos/voyager-2/triton-1989-large.webp',
      width: 640,
      height: 497,
      title: 'Triton, August 1989',
      caption:
        'Neptune’s largest moon, coated in nitrogen frost. The pinkish south polar cap is streaked with dark material blown out by geysers. Its orange, violet and ultraviolet images are shown as red, green and blue, so the colours are shifted from an eye’s.',
      colour: 'false',
      credit: 'NASA/JPL/USGS',
      licence: 'NASA media, not copyrighted',
      date: '1989-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA00317',
    },
    {
      file: 'photos/voyager-2/neptune-rings-1989.webp',
      largeFile: 'photos/voyager-2/neptune-rings-1989-large.webp',
      width: 640,
      height: 468,
      title: 'Neptune’s rings, 26 August 1989',
      caption:
        'Two exposures of almost ten minutes each, the day after closest approach; the glare in the middle is Neptune’s overexposed crescent. The two main rings appear complete over the stretch imaged. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-26',
      sourceUrl: 'https://images.nasa.gov/details/PIA01997',
    },
  ],
  drawnHere: [
    {
      title: 'Its crossings',
      text: 'Where it crossed the termination shock and the heliopause is marked in the Heliosphere layer, at the place JPL puts it on those days: two of the four points of either boundary anyone has measured. The surfaces drawn through them are models.',
      cite: ['stone2008', 'stone2019'],
    },
    {
      title: 'Its planetary journey',
      text: 'Not drawn. Its trail reaches back only as far as the app’s data do, so its four planetary flybys, decades before, are not in it.',
    },
  ],
  measured: [
    {
      title: 'Launch and flybys',
      text: 'Launched on 20 August 1977 at 14:29 UT. Closest to Jupiter on 9 July 1979, 645,000 km from it; to Saturn on 26 August 1981, 101,000 km; to Uranus on 24 January 1986, 81,500 km; and on 25 August 1989 at 03:56 UT, about 4,800 km above Neptune’s cloud tops.',
      cite: ['voyager2'],
    },
    {
      title: 'Uranus',
      text: 'Ten moons no one had seen, and a magnetic field tilted 58.6° from the planet’s axis of rotation, its centre a third of the planet’s radius off the planet’s own.',
      cite: ['stone1986', 'smith1986', 'nssdcuranus'],
    },
    {
      title: 'Neptune',
      text: 'Six new moons, the Great Dark Spot, winds of hundreds of metres a second, complete rings, and active plumes on Triton carrying dark material about 8 km up.',
      cite: ['stone1989', 'smith1989'],
    },
    {
      title: 'The termination shock',
      text: 'Crossed between 30 August and 1 September 2007, several times as the shock moved back and forth, at 83.7 AU — about 10 AU closer to the Sun than where Voyager 1 found it, so the heliosphere is lopsided.',
      cite: ['stone2008'],
    },
    {
      title: 'Into interstellar space',
      text: 'On 5 November 2018, at 119.0 AU, the particles from the Sun around it fell away and the galaxy’s cosmic rays rose; its plasma instrument — the one that stopped working on Voyager 1 in 1980 — saw the solar wind’s flow stop, and the magnetic field and plasma waves confirmed it.',
      cite: ['stone2019', 'richardson2019', 'burlaga2019', 'gurnett2019', 'jplv2'],
    },
    {
      title: 'Its speed',
      text: '15.4 km/s relative to the Sun, as of November 2017: on no closed orbit, never to return.',
      cite: ['voyager2'],
    },
    {
      title: 'Its power',
      text: 'Three radioisotope generators that lose about 4 watts a year between them. Its low-energy charged particle instrument was switched off in March 2025; in 2026 a reconfiguration of its power and heating, which the team called the “Big Bang”, bought its last three instruments at least another year.',
      cite: ['voyagerpower', 'voyager2power'],
    },
    {
      title: 'Its Golden Record',
      text: 'It carries the same gold-plated copper record as its twin, with pictures, greetings in 55 languages, sounds and music of Earth, and a cover that says how to play it and where it came from. Voyager 1’s description reads the record and its cover in full.',
      cite: ['groverview'],
    },
  ],
  estimated: [
    {
      title: 'The Oort cloud',
      text: 'About 300 years to reach its inner edge, and perhaps 30,000 to fly beyond it. The cloud itself is inferred from comets’ orbits, never seen, so both figures rest on where its edges are taken to be.',
      cite: ['jplv2'],
    },
    {
      title: 'How much longer it works',
      text: 'With the 2026 power changes the team expects its three instruments to keep going at least a year more. No end date is set.',
      cite: ['voyager2power'],
    },
  ],
  missing: [
    {
      title: 'Its path before the data',
      text: 'Not drawn: the trail starts where the app’s data start, long after Neptune. Its four planets are outside them.',
    },
    {
      title: 'A second look at Uranus and Neptune',
      text: 'There has been none: everything up close of both, and of their moons, is from its single pass each, and only what was lit then.',
      cite: ['voyager2'],
    },
    {
      title: 'Its own temperature and power',
      text: 'Not shown: how warm it is and how many watts are left are in the team’s telemetry, which the app does not read.',
    },
  ],
  misconceptions: [
    {
      title: 'Voyager 2 was launched first',
      text: 'It left on 20 August 1977, sixteen days before Voyager 1, which took a faster path and overtook it that December.',
      cite: ['voyager2', 'voyager1'],
    },
    {
      title: 'Neptune is not the deep blue of its pictures',
      text: 'The famous blue was a stretch for contrast. Voyager 2’s own images, re-processed in true colour, show Neptune pale and only a little bluer than Uranus.',
      cite: ['irwin2024'],
    },
    {
      title: 'The heliopause is not a wall at one distance',
      text: 'The Voyagers met the boundaries at different distances — the termination shock at 94 and 83.7 AU, the heliopause at 121.6 and 119.0 — because the bubble is lopsided and breathes with the solar cycle.',
      cite: ['stone2008', 'stone2019'],
    },
    {
      title: 'Interstellar space is not the end of the Solar System',
      text: 'Past the heliopause the Sun’s wind is gone, but its gravity still holds the Oort cloud of comets, hundreds of years ahead of it. In NASA’s words, neither Voyager has left the Solar System, “and won’t be leaving anytime soon”.',
      cite: ['jplv2'],
    },
  ],
  sources: [
    {
      key: 'voyager2',
      text: 'NASA Science, Voyager 2 (mission page: launch, the four flybys, speed)',
      url: 'https://science.nasa.gov/mission/voyager/voyager-2/',
    },
    {
      key: 'groverview',
      text: 'NASA Science, Golden Record Overview (Voyager mission pages)',
      url: 'https://science.nasa.gov/mission/voyager/voyager-golden-record-overview/',
    },
    {
      key: 'voyager1',
      text: 'NASA Science, Voyager 1 (mission page)',
      url: 'https://science.nasa.gov/mission/voyager/voyager-1/',
    },
    {
      key: 'voyagerpower',
      text: 'NASA Science 2026, NASA Shuts Off Instrument on Voyager 1 to Keep Spacecraft Operating (Voyager blog, 17 April 2026; also Voyager 2’s 2025 shutdown)',
      url: 'https://science.nasa.gov/blogs/voyager/2026/04/17/nasa-shuts-off-instrument-on-voyager-1-to-keep-spacecraft-operating/',
    },
    {
      key: 'voyager2power',
      text: 'NASA Science 2026, NASA Engineers Help Prolong Voyager 2’s Science Mission (Voyager blog, 4 August 2026)',
      url: 'https://science.nasa.gov/blogs/voyager/2026/08/04/nasa-engineers-help-prolong-voyager-2s-science-mission/',
    },
    {
      key: 'jplv2',
      text: 'NASA/JPL 2018, NASA’s Voyager 2 Probe Enters Interstellar Space (news release, 10 December 2018)',
      url: 'https://www.jpl.nasa.gov/news/nasas-voyager-2-probe-enters-interstellar-space/',
    },
    {
      key: 'stone1986',
      text: 'Stone, E. C., & Miner, E. D. 1986, The Voyager 2 Encounter with the Uranian System, Science 233, 39',
      url: 'https://doi.org/10.1126/science.233.4759.39',
    },
    {
      key: 'smith1986',
      text: 'Smith, B. A., et al. 1986, Voyager 2 in the Uranian System: Imaging Science Results, Science 233, 43',
      url: 'https://doi.org/10.1126/science.233.4759.43',
    },
    {
      key: 'nssdcuranus',
      text: 'Williams, D. R., Uranus Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html',
    },
    {
      key: 'stone1989',
      text: 'Stone, E. C., & Miner, E. D. 1989, The Voyager 2 Encounter with the Neptunian System, Science 246, 1417',
      url: 'https://doi.org/10.1126/science.246.4936.1417',
    },
    {
      key: 'smith1989',
      text: 'Smith, B. A., et al. 1989, Voyager 2 at Neptune: Imaging Science Results, Science 246, 1422',
      url: 'https://doi.org/10.1126/science.246.4936.1422',
    },
    {
      key: 'stone2008',
      text: 'Stone, E. C., et al. 2008, An asymmetric solar wind termination shock, Nature 454, 71',
      url: 'https://doi.org/10.1038/nature07022',
    },
    {
      key: 'stone2019',
      text: 'Stone, E. C., Cummings, A. C., Heikkila, B. C., & Lal, N. 2019, Cosmic ray measurements from Voyager 2 as it crossed into interstellar space, Nat. Astron. 3, 1013',
      url: 'https://doi.org/10.1038/s41550-019-0928-3',
    },
    {
      key: 'richardson2019',
      text: 'Richardson, J. D., Belcher, J. W., Garcia-Galindo, P., & Burlaga, L. F. 2019, Voyager 2 plasma observations of the heliopause and interstellar medium, Nat. Astron. 3, 1019',
      url: 'https://doi.org/10.1038/s41550-019-0929-2',
    },
    {
      key: 'burlaga2019',
      text: 'Burlaga, L. F., et al. 2019, Magnetic field and particle measurements made by Voyager 2 at and near the heliopause, Nat. Astron. 3, 1007',
      url: 'https://doi.org/10.1038/s41550-019-0920-y',
    },
    {
      key: 'gurnett2019',
      text: 'Gurnett, D. A., & Kurth, W. S. 2019, Plasma densities near and beyond the heliopause from the Voyager 1 and 2 plasma wave instruments, Nat. Astron. 3, 1024',
      url: 'https://doi.org/10.1038/s41550-019-0918-5',
    },
    {
      key: 'irwin2024',
      text: 'Irwin, P. G. J., et al. 2024, Modelling the seasonal cycle of Uranus’s colour and magnitude, and comparison with Neptune, MNRAS 527, 11521',
      url: 'https://doi.org/10.1093/mnras/stad3761',
    },
  ],
};
