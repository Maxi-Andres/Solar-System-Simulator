import type { Description } from '../types.ts';

/**
 * InSight, in Elysium Planitia; drawn at its HiRISE position (catalog SURFACE_CRAFT). Every
 * fact from the source it cites: NASA's and JPL's pages, the photo captions and the papers.
 */
export const INSIGHT: Description = {
  id: 'insight',
  lead: [
    'Most craft on Mars have studied its surface. InSight listened to its insides. For four years a seismometer sat on the ground of a flat plain and felt Mars shake — 1,319 times — from quakes deep in its rock and from meteorites striking its surface, and from the way those tremors travelled through the planet, people measured how thick Mars’s crust is, and how big its core.',
    'It was a NASA lander built by Lockheed Martin in Denver on the design of Phoenix, managed by JPL, with a seismometer from France’s space agency CNES and a heat probe from Germany’s DLR. It landed on 26 November 2018 in Elysium Planitia, near the equator. Its two round solar panels spanned six metres. Its arm lifted the seismometer off the deck, set it on the ground and covered it with a dome against wind and cold — the thing Viking 2’s seismometer, bolted to its lander, had lacked.',
    'Mars turned out to quake, mostly gently. The waves showed a crust 20 to 40 km thick beneath the lander, and a core that is liquid and large. Later the record was read again: a layer of molten rock seems to wrap a smaller, denser core. Some quakes were impacts, and one, in December 2021, made a fresh crater that threw up ice from beneath the surface. The heat probe never worked: the soil clumped round it and it could not hammer itself down.',
    'Dust settled on its panels year by year, and the power fell. Its last selfie, in April 2022, shows it coated in dust. It last spoke on 15 December 2022, and NASA ended the mission a week later. It still stands there, the dome still over its seismometer.',
  ],
  photos: [
    {
      file: 'photos/sites/insight/first-selfie-2018.webp',
      largeFile: 'photos/sites/insight/first-selfie-2018-large.webp',
      width: 640,
      height: 365,
      title: 'First selfie, 6 December 2018',
      caption:
        'Eleven frames from the camera on its arm, ten sols after landing: the clean solar panels, and on the deck its science instruments, not yet set down, the weather booms and antenna. The black is where no frame reached.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '2018-12-06',
      sourceUrl: 'https://images.nasa.gov/details/PIA22876',
    },
    {
      file: 'photos/sites/insight/seismometer-shield-2019.webp',
      largeFile: 'photos/sites/insight/seismometer-shield-2019-large.webp',
      width: 640,
      height: 640,
      title: 'The seismometer under its shield, 2019',
      caption:
        'The domed Wind and Thermal Shield over SEIS, the seismometer, on the ground beside the lander on sol 110, the arm above it.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '2019-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA23177',
    },
    {
      file: 'photos/sites/insight/hirise-2019.webp',
      largeFile: 'photos/sites/insight/hirise-2019-large.webp',
      width: 640,
      height: 360,
      title: 'InSight from orbit, 23 September 2019',
      caption:
        'HiRISE’s best view of it, enlarged in the inset: the two round panels, 6 m from end to end, the bright dome of the seismometer cover below, a dark halo scoured by the landing rockets, and dust-devil tracks crossing the plain. HiRISE colour, which includes infrared.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2019-09-23',
      sourceUrl: 'https://images.nasa.gov/details/PIA23376',
    },
    {
      file: 'photos/sites/insight/mole-2021.webp',
      largeFile: 'photos/sites/insight/mole-2021-large.webp',
      width: 640,
      height: 640,
      title: 'The mole comes to rest, 9 January 2021',
      caption:
        'The heat probe after its last hammering, on sol 754. Since February 2019 it had tried to burrow in to take Mars’s temperature, but the soil clumped and gave it no friction to dig against; that day the team stopped.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '2021-01-09',
      sourceUrl: 'https://images.nasa.gov/details/PIA24263',
    },
    {
      file: 'photos/sites/insight/impact-crater-2021.webp',
      largeFile: 'photos/sites/insight/impact-crater-2021-large.webp',
      width: 640,
      height: 413,
      title: 'A quake you can see, from 24 December 2021',
      caption:
        'A fresh crater in Amazonis Planitia, its debris thrown up to 37 km, from a meteoroid whose impact InSight felt; images and seismic data together dated it. White specks on the rim were water ice. Mars Reconnaissance Orbiter’s Context Camera. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2022',
      sourceUrl: 'https://images.nasa.gov/details/PIA25584',
    },
    {
      file: 'photos/sites/insight/final-selfie-2022.webp',
      largeFile: 'photos/sites/insight/final-selfie-2022-large.webp',
      width: 640,
      height: 384,
      title: 'Final selfie, 24 April 2022',
      caption:
        'On sol 1,211, far dustier than in 2018. The dusty panels made less and less power, and the arm was soon put in its retirement pose for the last time.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '2022-04-24',
      sourceUrl: 'https://images.nasa.gov/details/PIA25287',
    },
  ],
  drawnHere: [
    {
      title: 'Where it stands',
      text: 'At 4.502384° N, 135.623447° E: the lander as HiRISE located it after landing.',
      cite: ['golombek2020'],
    },
    {
      title: 'Its instruments on the ground',
      text: 'The model is NASA’s InSight as deployed, its seismometer dome and heat probe on the ground beside it: where exactly they sit is the model’s, not a measurement.',
    },
  ],
  measured: [
    {
      title: 'Who made it',
      text: 'Lockheed Martin Space in Denver built the spacecraft; JPL managed the mission, part of NASA’s Discovery Program. CNES provided the seismometer, SEIS, with its principal investigator at the Institut de Physique du Globe de Paris; DLR provided the heat probe.',
      cite: ['retire', 'pia22876'],
    },
    {
      title: 'Launch and landing',
      text: 'Launched on 5 May 2018 from Vandenberg Air Force Base, California; landed on 26 November 2018 in Elysium Planitia, near Mars’s equator. Built on the design of the Phoenix lander.',
      cite: ['insight'],
    },
    {
      title: 'Marsquakes',
      text: '1,319 recorded, including quakes from meteoroid impacts. The largest, S1222a in 2022, had a moment magnitude of 4.7, five times the seismic moment of the next largest, its waves ringing on for more than ten hours.',
      cite: ['retire', 'kawamura2023'],
    },
    {
      title: 'The crust',
      text: 'Beneath the lander, either 20 ± 5 km or 39 ± 8 km thick, depending on which of the layers the waves show is its base; across Mars, on average 24 to 72 km.',
      cite: ['knapmeyer2021'],
    },
    {
      title: 'The core',
      text: 'Liquid, and in 2021 measured at about 1,830 km in radius. A 2023 study of waves diffracted round it found instead a molten silicate layer about 150 km thick atop a smaller, denser core of 1,675 ± 30 km.',
      cite: ['stahler2021', 'khan2023'],
    },
    {
      title: 'The mole',
      text: 'The heat probe tried to hammer itself in from 28 February 2019; the soil clumped and gave it no friction. After 500 more strokes with no progress on 9 January 2021, the team gave up.',
      cite: ['pia24263', 'mole2021'],
    },
    {
      title: 'Its end',
      text: 'Dust on its solar panels cut its power. It last spoke on 15 December 2022; NASA declared the mission over on 21 December, after more than four years.',
      cite: ['retire'],
    },
  ],
  estimated: [
    {
      title: 'What lies inside',
      text: 'The crust, mantle and core are models fitted to how the waves travelled, from one seismometer: the core’s size changed by 150 km between the 2021 and 2023 readings of the same record.',
      cite: ['stahler2021', 'khan2023'],
    },
  ],
  missing: [
    {
      title: 'Mars’s heat flow',
      text: 'Not measured: the mole never reached the 3 m it needed.',
      cite: ['mole2021'],
    },
  ],
  misconceptions: [
    {
      title: 'Mars is not seismically dead',
      text: 'Viking 2’s seismometer, on its lander’s deck, felt little but the wind. Set on the ground and shielded, InSight’s felt 1,319 quakes in four years — far fewer and weaker than Earth’s, but a living planet’s.',
      cite: ['retire', 'anderson1977'],
    },
  ],
  sources: [
    {
      key: 'insight',
      text: 'NASA Science, InSight (mission page: launch, landing, design, end of mission)',
      url: 'https://science.nasa.gov/mission/insight/',
    },
    {
      key: 'retire',
      text: 'JPL 2022, NASA Retires InSight Mars Lander Mission After Years of Science (news release, 21 December 2022)',
      url: 'https://www.jpl.nasa.gov/news/nasa-retires-insight-mars-lander-mission-after-years-of-science/',
    },
    {
      key: 'mole2021',
      text: 'JPL 2021, NASA InSight’s ‘Mole’ Ends Its Journey on Mars (news release, 14 January 2021)',
      url: 'https://www.jpl.nasa.gov/news/nasa-insights-mole-ends-its-journey-on-mars/',
    },
    {
      key: 'golombek2020',
      text: 'Golombek, M., et al. 2020, Geology of the InSight landing site on Mars, Nature Communications 11, 1014',
      url: 'https://doi.org/10.1038/s41467-020-14679-1',
    },
    {
      key: 'kawamura2023',
      text: 'Kawamura, T., et al. 2023, S1222a — The Largest Marsquake Detected by InSight, Geophys. Res. Lett. 50, e2022GL101543',
      url: 'https://doi.org/10.1029/2022GL101543',
    },
    {
      key: 'knapmeyer2021',
      text: 'Knapmeyer-Endrun, B., et al. 2021, Thickness and structure of the martian crust from InSight seismic data, Science 373, 438',
      url: 'https://doi.org/10.1126/science.abf8966',
    },
    {
      key: 'stahler2021',
      text: 'Stähler, S. C., et al. 2021, Seismic detection of the martian core, Science 373, 443',
      url: 'https://doi.org/10.1126/science.abi7730',
    },
    {
      key: 'khan2023',
      text: 'Khan, A., et al. 2023, Evidence for a liquid silicate layer atop the Martian core, Nature 622, 718',
      url: 'https://doi.org/10.1038/s41586-023-06586-4',
    },
    {
      key: 'anderson1977',
      text: 'Anderson, D. L., et al. 1977, Seismology on Mars, J. Geophys. Res. 82, 4524',
      url: 'https://doi.org/10.1029/JS082i028p04524',
    },
    {
      key: 'pia22876',
      text: 'NASA/JPL-Caltech 2018, PIA22876: InSight’s First Selfie (caption)',
      url: 'https://science.nasa.gov/photojournal/insights-first-selfie/',
    },
    {
      key: 'pia24263',
      text: 'NASA/JPL-Caltech 2021, PIA24263: InSight’s Mole Comes to Rest (caption)',
      url: 'https://science.nasa.gov/photojournal/insights-mole-comes-to-rest/',
    },
  ],
};
