import type { Description } from './types.ts';

/**
 * New Horizons. Every number here is from the source it cites; distances that grow every
 * day are quoted with the date they hold for, and the panel gives the live ones. What the
 * app draws of it is read off its catalog entry (generated.ts).
 */
export const NEW_HORIZONS: Description = {
  id: 'new-horizons',
  lead: [
    'For 85 years after it was found, Pluto was a smudge of a few pixels — and then, in July 2015, a piano-sized probe flew past it and showed us a world with a great pale heart. There were mountains of ice, glaciers of frozen nitrogen, and blue haze in layers above them, on a planet so far out that sunlight there is a thousandth of ours. Three and a half years later it showed us something older still: Arrokoth, a small snowman of two lobes that has barely changed since the Sun’s planets were forming.',
    'New Horizons is a NASA probe of 478 kilograms, launched on 19 January 2006 faster than anything had ever left Earth: its rocket’s third stage sent it away at about 58,500 kilometres an hour. It has no solar panels — sunlight is too weak where it is going — and runs on a single radioisotope generator, which gave about 250 watts at launch and less every year since. It slept through most of its nine-year cruise, woken now and then for checks.',
    'A pass by Jupiter in February 2007 bent its path and cut three years off the trip; on the way it watched a volcano on Io throw up a plume far into space. On 14 July 2015 it flew about 12,500 kilometres above Pluto, too fast to stop or orbit, taking its pictures in a few hours. It found Pluto’s heart to be in part a basin of nitrogen ice a thousand kilometres wide with no craters at all — a surface young and still changing — and Charon, its largest moon, with a dark red pole. On 1 January 2019 it passed 3,500 kilometres from Arrokoth, the most distant object ever explored up close.',
    'It is now in the Kuiper belt, the ring of icy bodies beyond Neptune, about 60 times as far from the Sun as Earth in October 2024 and moving out by some 480 million kilometres a year, on a path the Sun will never pull back. It studies the solar wind and the dust and gas out there; in 2023 NASA extended it until it leaves the Kuiper belt, expected in 2028 or 2029. The panel gives where it is now.',
  ],
  photos: [
    {
      file: 'photos/new-horizons/rtg-fit-check-2005.webp',
      largeFile: 'photos/new-horizons/rtg-fit-check-2005-large.webp',
      width: 640,
      height: 425,
      title: 'New Horizons before launch, 7 November 2005',
      caption:
        'The spacecraft in its gold thermal blanket at Kennedy Space Center, with its power generator — the black finned cylinder — fitted for a check. The dish at the top is the one it still talks to Earth through.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2005-11-07',
      sourceUrl: 'https://images.nasa.gov/details/KSC-05pd2462',
    },
    {
      file: 'photos/new-horizons/launch-2006.webp',
      largeFile: 'photos/new-horizons/launch-2006-large.webp',
      width: 640,
      height: 419,
      title: 'Launch, 19 January 2006',
      caption:
        'Its Atlas V lifts off from Cape Canaveral at 2 p.m. local time, among the launch pad’s four lightning masts, on the third attempt in as many days.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2006-01-19',
      sourceUrl: 'https://images.nasa.gov/details/KSC-06pd0099',
    },
    {
      file: 'photos/new-horizons/io-tvashtar-2007.webp',
      largeFile: 'photos/new-horizons/io-tvashtar-2007-large.webp',
      width: 399,
      height: 852,
      title: 'A volcano on Io, February 2007',
      caption:
        'The plume of Tvashtar, the umbrella at the top of each frame, in the best of the pictures its telescopic camera took during the Jupiter flyby in late February: it changed shape from frame to frame. Black and white.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2007-02',
      sourceUrl: 'https://images.nasa.gov/details/PIA09359',
    },
    {
      file: 'photos/new-horizons/pluto-2015.webp',
      largeFile: 'photos/new-horizons/pluto-2015-large.webp',
      width: 640,
      height: 640,
      title: 'Pluto and its heart, 13 July 2015',
      caption:
        'The last and sharpest picture sent home before the flyby, from 768,000 km. The pale heart is Tombaugh Regio. Its telescopic camera sees in black and white; colour was added from the Ralph camera’s lower-resolution images through blue, red and near-infrared filters, so it is not quite what an eye would see.',
      colour: 'false',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2015-07-13',
      sourceUrl: 'https://images.nasa.gov/details/PIA20291',
    },
    {
      file: 'photos/new-horizons/pluto-crescent-2015.webp',
      largeFile: 'photos/new-horizons/pluto-crescent-2015-large.webp',
      width: 640,
      height: 360,
      title: 'Looking back at Pluto, 14 July 2015',
      caption:
        'Fifteen minutes after closest approach, from 18,000 km, toward the Sun: more than a dozen layers of haze run all the way round, and the night side shows rugged plateaus in silhouette. The streaks in the sky are stars smeared by the camera’s motion. Black and white.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA20038',
    },
    {
      file: 'photos/new-horizons/pluto-blue-haze-2015.webp',
      largeFile: 'photos/new-horizons/pluto-blue-haze-2015-large.webp',
      width: 640,
      height: 360,
      title: 'Pluto’s blue sky, 14 July 2015',
      caption:
        'Its receding crescent three and a half hours after closest approach, from 200,000 km, in approximate true colour. The haze is a smog sunlight makes from methane; its tiny particles scatter blue light most, as haze can on Earth.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA21590',
    },
    {
      file: 'photos/new-horizons/pluto-enhanced-2015.webp',
      largeFile: 'photos/new-horizons/pluto-enhanced-2015-large.webp',
      width: 640,
      height: 640,
      title: 'Pluto in enhanced colour, 14 July 2015',
      caption:
        'Blue, red and near-infrared images, their differences exaggerated so that ground of different make-up shows in different colours. Pluto is not this colourful: its real colours are pale browns and reds.',
      colour: 'false',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19952',
    },
    {
      file: 'photos/new-horizons/charon-enhanced-2015.webp',
      largeFile: 'photos/new-horizons/charon-enhanced-2015-large.webp',
      width: 640,
      height: 640,
      title: 'Charon in enhanced colour, 14 July 2015',
      caption:
        'Pluto’s largest moon, 1,214 km across, just before closest approach. The reddish north pole, Mordor Macula, stands out; the colours are processed to show differences in the ground, not as an eye would see them.',
      colour: 'false',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19968',
    },
    {
      file: 'photos/new-horizons/arrokoth-2019.webp',
      largeFile: 'photos/new-horizons/arrokoth-2019-large.webp',
      width: 640,
      height: 914,
      title: 'Arrokoth, 1 January 2019',
      caption:
        'A Kuiper belt object 35 km long, two lobes that came together gently long ago. Sharp black-and-white images with colour laid over them: NASA calls the colour enhanced, though close to what an eye would see.',
      colour: 'false',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute/Roman Tkachenko',
      licence: 'NASA media, not copyrighted',
      date: '2019-01-01',
      sourceUrl: 'https://science.nasa.gov/resource/enhanced-color-composite-image-of-kuiper-belt-object-arrokoth-2014-mu69',
    },
  ],
  drawnHere: [
    {
      title: 'Its encounters',
      text: 'Pluto and Arrokoth are bodies of their own here — Arrokoth with the New Horizons team’s own shape model of its two lobes. The app’s data reach back ten years from when they were built, so the Arrokoth flyby of 1 January 2019 can be watched by setting the clock to it; the Pluto flyby of 2015 is before the data begin, and is not in its trail.',
    },
  ],
  measured: [
    {
      title: 'Launch',
      text: 'On 19 January 2006 at 19:00 UT, on an Atlas V. Its third stage gave it about 16.3 km/s, 36,400 miles an hour, relative to Earth: the highest launch speed of anything made.',
      cite: ['nh'],
    },
    {
      title: 'The craft',
      text: '478 kg at launch, with a 2.1 m dish. One radioisotope generator gave about 250 watts at launch and about 200 by the time it reached Pluto.',
      cite: ['nh', 'fountain2008'],
    },
    {
      title: 'Jupiter',
      text: 'Closest on 28 February 2007 at 05:43 UT; the swing past it cut three years off the trip. It then slept, in hibernation from mid-2007, through most of the cruise.',
      cite: ['nh', 'guo2008'],
    },
    {
      title: 'Pluto',
      text: 'Closest on 14 July 2015 at 11:49 UT, about 12,500 km above the surface. Pluto measured 1,187 km in radius, larger than thought; its thin nitrogen atmosphere carries a global haze, layered, reaching about 150 km up.',
      cite: ['stern2015', 'nh'],
    },
    {
      title: 'The heart',
      text: 'The western half of the pale heart, Sputnik Planitia, is a basin about 1,000 km wide filled with nitrogen ice that flows like a glacier. No craters were found on it at all, so its surface is geologically very young; mountains of water ice up to a few kilometres high stand at its edge.',
      cite: ['moore2016', 'nh'],
    },
    {
      title: 'Charon',
      text: '606 km in radius, with a dark reddish region over its north pole, and canyons that suggest it once had a liquid ocean inside that froze and split its crust.',
      cite: ['stern2015', 'moore2016'],
    },
    {
      title: 'Arrokoth',
      text: 'Passed on 1 January 2019, 3,500 km away: the farthest world ever explored up close. A contact binary about 35 km long — two lobes, flattened, joined at a narrow neck — red, and lightly cratered.',
      cite: ['nh', 'stern2019', 'spencer2020'],
    },
    {
      title: 'Where it is',
      text: 'About 60 AU from the Sun on 1 October 2024, moving out at about 300 million miles — some 480 million km — a year.',
      cite: ['nh'],
    },
  ],
  estimated: [
    {
      title: 'How Arrokoth formed',
      text: 'Its two lobes are thought to have formed together from a collapsing cloud of pebbles and merged at walking pace — a few metres a second or less. That fits models in which the first planetesimals grew by such gentle collapse rather than by violent collisions.',
      cite: ['mckinnon2020'],
    },
    {
      title: 'How long it works',
      text: 'In 2023 NASA extended it until it leaves the Kuiper belt, expected in 2028 or 2029; its generator weakens every year, and how long after that it can run is the team’s estimate to make.',
      cite: ['nhext'],
    },
  ],
  missing: [
    {
      title: 'Most of Pluto’s far side',
      text: 'Not mapped in detail: the hemisphere facing it at closest approach was seen sharply, the other only from far away days earlier.',
      cite: ['stern2015'],
    },
    {
      title: 'Its attitude',
      text: 'Drawn with its dish on Earth, which is how it spends most of its time; when it turned to point its cameras, that pointing is in no data here.',
    },
  ],
  misconceptions: [
    {
      title: 'It did not stop at Pluto',
      text: 'It flew past far too fast to brake into orbit with any fuel it could carry; everything it learned up close came from a few days around closest approach.',
      cite: ['stern2015', 'guo2008'],
    },
    {
      title: 'Pluto is not a dead ball of ice',
      text: 'Its uncratered nitrogen plains, flowing glaciers and hazy atmosphere show a world still active today, four and a half billion years after it formed.',
      cite: ['moore2016'],
    },
    {
      title: 'It was launched to a planet that stopped being one',
      text: 'In August 2006, seven months after launch, the International Astronomical Union defined a planet so that Pluto is not one, but a dwarf planet. The probe’s mission did not change.',
      cite: ['iau2006'],
    },
    {
      title: 'The fastest launch is not the fastest craft',
      text: 'No craft has left Earth faster, but it is now moving out slower than Voyager 1, which is also farther ahead, so it will never catch it.',
      cite: ['nh', 'voyager1'],
    },
  ],
  sources: [
    {
      key: 'nh',
      text: 'NASA Science, New Horizons (mission page: launch, Jupiter, Pluto, Arrokoth, the craft and its power)',
      url: 'https://science.nasa.gov/mission/new-horizons/',
    },
    {
      key: 'nhext',
      text: 'NASA 2023, NASA’s New Horizons to Continue Exploring Outer Solar System',
      url: 'https://www.nasa.gov/missions/new-horizons/nasas-new-horizons-to-continue-exploring-outer-solar-system',
    },
    {
      key: 'fountain2008',
      text: 'Fountain, G. H., et al. 2008, The New Horizons Spacecraft, Space Sci. Rev. 140, 23',
      url: 'https://doi.org/10.1007/s11214-008-9374-8',
    },
    {
      key: 'guo2008',
      text: 'Guo, Y., & Farquhar, R. W. 2008, New Horizons Mission Design, Space Sci. Rev. 140, 49',
      url: 'https://doi.org/10.1007/s11214-007-9242-y',
    },
    {
      key: 'stern2015',
      text: 'Stern, S. A., et al. 2015, The Pluto system: Initial results from its exploration by New Horizons, Science 350, aad1815',
      url: 'https://doi.org/10.1126/science.aad1815',
    },
    {
      key: 'moore2016',
      text: 'Moore, J. M., et al. 2016, The geology of Pluto and Charon through the eyes of New Horizons, Science 351, 1284',
      url: 'https://doi.org/10.1126/science.aad7055',
    },
    {
      key: 'stern2019',
      text: 'Stern, S. A., et al. 2019, Initial results from the New Horizons exploration of 2014 MU69, a small Kuiper Belt object, Science 364, eaaw9771',
      url: 'https://doi.org/10.1126/science.aaw9771',
    },
    {
      key: 'spencer2020',
      text: 'Spencer, J. R., et al. 2020, The geology and geophysics of Kuiper Belt object (486958) Arrokoth, Science 367, eaay3999',
      url: 'https://doi.org/10.1126/science.aay3999',
    },
    {
      key: 'mckinnon2020',
      text: 'McKinnon, W. B., et al. 2020, The solar nebula origin of (486958) Arrokoth, a primordial contact binary in the Kuiper Belt, Science 367, eaay6620',
      url: 'https://doi.org/10.1126/science.aay6620',
    },
    {
      key: 'iau2006',
      text: 'International Astronomical Union 2006, Resolution B5: Definition of a Planet in the Solar System, and B6: Pluto (XXVI General Assembly, Prague)',
      url: 'https://www.iau.org/Iau/Publications/List-of-Resolutions/',
    },
    {
      key: 'voyager1',
      text: 'NASA Science, Voyager 1 (mission page: its speed and distance)',
      url: 'https://science.nasa.gov/mission/voyager/voyager-1/',
    },
  ],
};
