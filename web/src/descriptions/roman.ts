import type { Description } from './types.ts';

/**
 * The Nancy Grace Roman Space Telescope. Every number here is from the source it cites; it
 * launched on 30 August 2026 and is still being commissioned, so what it has done is dated.
 * What the app draws of it is read off its catalog entry (generated.ts), which hangs it from
 * Earth.
 */
export const ROMAN: Description = {
  id: 'roman',
  lead: [
    'About two thirds of everything the universe holds is something no one has seen or understood: something that seems to push its expansion ever faster, named dark energy long before anyone could say what it is. The Nancy Grace Roman Space Telescope was built to measure it, and to count the planets of our galaxy — including worlds drifting alone between the stars, with no sun at all. It carries the name of a woman discouraged from astronomy since childhood, who became NASA’s first Chief of Astronomy and won the approval of the telescope that became Hubble, which is why she is called its mother.',
    'It is a NASA infrared observatory with a mirror 2.4 metres across, as large as Hubble’s but less than a quarter of its weight. What sets it apart is how much sky it takes in at once: a field of view at least a hundred times Hubble’s, onto a 300-megapixel camera of 18 detectors. NASA puts it at surveying the sky a thousand times faster than Hubble. Its second instrument, a coronagraph, is a test of the technology for photographing planets around other stars directly: it blocks a star’s glare to see the planets beside it, billions of times fainter.',
    'Its main surveys will measure the shapes and distances of hundreds of millions of galaxies, whose images are bent slightly by the matter between them and us, to pin down dark energy about ten times more precisely than before. Toward the crowded centre of the galaxy it will watch some 200 million stars for the brief brightening when a planet passes in front of one — microlensing, which finds planets by their gravity rather than their light, even planets with no star at all.',
    'It was finished at NASA’s Goddard Space Flight Center in November 2025 and launched on a Falcon Heavy from Kennedy Space Center on 30 August 2026, ahead of schedule and on budget. Like Webb, it is bound for the Sun–Earth L2 point, about 1.5 million kilometres beyond Earth, on a three-month journey. Its first images are to be released on 7 December 2026. The panel gives where it is now.',
  ],
  photos: [
    {
      file: 'photos/roman/nancy-roman-2017.webp',
      largeFile: 'photos/roman/nancy-roman-2017-large.webp',
      width: 640,
      height: 494,
      title: 'Nancy Grace Roman at Goddard, 2017',
      caption:
        'The astronomer the telescope is named for, aged 91, visiting the James Webb Space Telescope and the Hubble team at NASA Goddard; Webb’s gold mirror is behind her. She died the following year.',
      colour: 'true',
      credit: 'NASA/GSFC/Bill Hrybyk',
      licence: 'NASA media, not copyrighted',
      date: '2017-03-31',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20170331_2017-11028_014',
    },
    {
      file: 'photos/roman/complete-2025.webp',
      largeFile: 'photos/roman/complete-2025-large.webp',
      width: 640,
      height: 426,
      title: 'Complete, November 2025',
      caption:
        'The observatory whole for the first time, in the largest clean room at NASA Goddard in Greenbelt, Maryland, after its inner and outer halves were joined on 25 November 2025. The dark panels at the top are its solar arrays, which also shade the telescope.',
      colour: 'true',
      credit: 'NASA/Jolearra Tshiteya',
      licence: 'NASA media, not copyrighted',
      date: '2025-11',
      sourceUrl: 'https://www.nasa.gov/missions/roman-space-telescope/nasa-completes-nancy-grace-roman-space-telescope-construction/',
    },
    {
      file: 'photos/roman/rotate-vertical-2026.webp',
      largeFile: 'photos/roman/rotate-vertical-2026-large.webp',
      width: 640,
      height: 1024,
      title: 'Turned upright at Kennedy, 25 June 2026',
      caption:
        'Days after arriving in Florida by barge, the observatory is rotated to vertical in the Payload Hazardous Servicing Facility at Kennedy Space Center.',
      colour: 'true',
      credit: 'NASA/Sydney Rohde (Rocz)',
      licence: 'NASA media, not copyrighted',
      date: '2026-06-25',
      sourceUrl: 'https://images.nasa.gov/details/KSC-20260625-PH-SER01_0001',
    },
    {
      file: 'photos/roman/solar-array-sunshield-2026.webp',
      largeFile: 'photos/roman/solar-array-sunshield-2026-large.webp',
      width: 640,
      height: 999,
      title: 'Cleaning its solar array sun shield, 14 July 2026',
      caption:
        'Technicians inspect the six solar panels that power the observatory and shade the telescope beneath them: the two in the middle are fixed, the four outer ones unfolded once in orbit.',
      colour: 'true',
      credit: 'NASA/Sydney Rohde (Rocz)',
      licence: 'NASA media, not copyrighted',
      date: '2026-07-14',
      sourceUrl: 'https://images.nasa.gov/details/KSC-20260714-PH-SER01_0003',
    },
    {
      file: 'photos/roman/plaque-2026.webp',
      largeFile: 'photos/roman/plaque-2026-large.webp',
      width: 640,
      height: 427,
      title: 'A plaque and 1,350,144 names, 28 July 2026',
      caption:
        'The commemorative plaque fixed to the observatory in honour of Nancy Grace Roman, with a memory card holding the names of 1,350,144 people from around the world, among them the astronauts of Artemis II and III.',
      colour: 'true',
      credit: 'NASA/Jolearra Tshiteya',
      licence: 'NASA media, not copyrighted',
      date: '2026-07-28',
      sourceUrl: 'https://images.nasa.gov/details/KSC-20260728-PH-JMT01_0003',
    },
    {
      file: 'photos/roman/full-stack-2026.webp',
      largeFile: 'photos/roman/full-stack-2026-large.webp',
      width: 640,
      height: 479,
      title: 'Mated to its adapter, 7 August 2026',
      caption:
        'The observatory mated to its payload adapter and a strut payload attach fitting, built for large, heavy loads, which hold it to the Falcon Heavy’s second stage.',
      colour: 'true',
      credit: 'NASA/Jolearra Tshiteya',
      licence: 'NASA media, not copyrighted',
      date: '2026-08-07',
      sourceUrl: 'https://images.nasa.gov/details/KSC-20260807-PH-JMT01_0002',
    },
    {
      file: 'photos/roman/encapsulated-2026.webp',
      largeFile: 'photos/roman/encapsulated-2026-large.webp',
      width: 640,
      height: 854,
      title: 'Sealed in its fairing, 24 August 2026',
      caption:
        'Encapsulated for launch, the fairing painted with the mission’s name; it shields the observatory on the way to the pad, through the atmosphere and in the first minutes of flight.',
      colour: 'true',
      credit: 'NASA/Sydney Rohde (Rocz)',
      licence: 'NASA media, not copyrighted',
      date: '2026-08-24',
      sourceUrl: 'https://images.nasa.gov/details/KSC-20260824-PH-SER02_0001',
    },
    {
      file: 'photos/roman/launch-2026.webp',
      largeFile: 'photos/roman/launch-2026-large.webp',
      width: 640,
      height: 351,
      title: 'Launch, 30 August 2026',
      caption:
        'Its Falcon Heavy lifting off from Launch Complex 39A at Kennedy Space Center at 7:26 in the morning, local time. The observatory separated 31 minutes later.',
      colour: 'true',
      credit: 'NASA/Joel Kowsky',
      licence: 'NASA media, not copyrighted',
      date: '2026-08-30',
      sourceUrl: 'https://images.nasa.gov/details/NHQ202608300015-2',
    },
  ],
  drawnHere: [],
  measured: [
    {
      title: 'Launch',
      text: 'On 30 August 2026 at 7:26 a.m. EDT, on a SpaceX Falcon Heavy from Launch Complex 39A at Kennedy Space Center. It separated from the rocket 31 minutes into the flight, and its solar panels and lower sun shade were deployed 1 hour 23 minutes after launch. It weighed 8,056 kg at launch, well under the 9,800 kg it had been planned around.',
      cite: ['romanlaunch', 'romanfuel'],
    },
    {
      title: 'Unfolding',
      text: 'Its high-gain antenna, 5.6 feet (1.7 m) wide, finished deploying on 31 August; its aperture cover, the sunshade over the telescope’s opening, sprang up on three booms on 1 September.',
      cite: ['romanvisor'],
    },
    {
      title: 'First light, of a kind',
      text: 'On 22 September 2026 its coronagraph saw starlight for the first time — a faint star in the Large Magellanic Cloud, which showed the instrument can form a focused image. Its guidance held the telescope steady to better than a hundred-thousandth of a degree for half an hour at a time.',
      cite: ['romancgi'],
    },
    {
      title: 'The telescope',
      text: 'A primary mirror 2.4 m across, the size of Hubble’s, weighing 186 kg — less than a quarter of Hubble’s. Its Wide Field Instrument is a 300-megapixel infrared camera of 18 detectors of 4K each, with a field of view at least 100 times Hubble’s.',
      cite: ['romanobs', 'romanlaunch', 'roman'],
    },
    {
      title: 'Built',
      text: 'Its two halves, inner and outer, were joined on 25 November 2025 in the largest clean room at NASA’s Goddard Space Flight Center. Its coronagraph was designed and built by JPL.',
      cite: ['romancomplete'],
    },
  ],
  estimated: [
    {
      title: 'How long it can work',
      text: 'It was designed for a five-year primary mission and five more extended. With a first course correction that used under a tenth of the fuel budgeted for it, and a lighter launch than planned, the team now counts fuel for at least 22 years.',
      cite: ['romanfuel'],
    },
    {
      title: 'Dark energy',
      text: 'Its High-Latitude Wide-Area Survey, more than 5,000 square degrees — about 12 percent of the sky — in just under a year and a half, is to measure dark energy about ten times more precisely than now, through weak lensing, the echoes of early sound waves in how galaxies are spread, and thousands of supernovae.',
      cite: ['romanhlwas', 'romande'],
    },
    {
      title: 'Planets',
      text: 'Its Galactic Bulge survey is predicted to find about 1,400 planets bound to stars by microlensing, some 200 of them three Earth masses or less, and about 250 free-floating planets down to the mass of Mars. NASA adds that it could find as many as 100,000 planets passing in front of their stars.',
      cite: ['penny2019', 'johnson2020', 'romanexo'],
    },
  ],
  missing: [
    {
      title: 'Its first images',
      text: 'None released yet: it is still in its commissioning, testing and aligning its instruments. NASA is to release its first images on 7 December 2026.',
      cite: ['romanalign', 'romanfirst'],
    },
    {
      title: 'What it is looking at',
      text: 'Not drawn: it turns from field to field on a survey plan no data here carry. It is drawn with its solar array sun shield to the Sun, which is how it must fly; its pointing beyond that is not known here.',
    },
  ],
  misconceptions: [
    {
      title: 'It is not a bigger Hubble',
      text: 'Its mirror is the same size as Hubble’s. What it has is a field of view at least a hundred times wider, which turns pictures of a patch of sky into surveys of hundreds of millions of galaxies.',
      cite: ['romanobs', 'roman'],
    },
    {
      title: 'Microlensing does not photograph planets',
      text: 'It finds them by their gravity: when a star or planet lines up almost exactly with a more distant star, it bends that star’s light and briefly brightens it. The planet itself is never seen — which is how it can find planets that have no star to shine on them.',
      cite: ['romanexo'],
    },
    {
      title: 'Nancy Grace Roman did not build Hubble',
      text: 'She is called the mother of Hubble for her work getting it approved by Congress, one of the biggest challenges of her career. She had joined NASA in early 1959, months after it was founded, and became its first Chief of Astronomy.',
      cite: ['nancy'],
    },
  ],
  sources: [
    {
      key: 'roman',
      text: 'NASA Science, Nancy Grace Roman Space Telescope (mission page)',
      url: 'https://science.nasa.gov/mission/roman-space-telescope/',
    },
    {
      key: 'romanobs',
      text: 'NASA Science, The Roman Observatory (mission page: mirror, instruments, orbit)',
      url: 'https://science.nasa.gov/mission/roman-space-telescope/roman-observatory/',
    },
    {
      key: 'nancy',
      text: 'NASA Science, Who Is Nancy Grace Roman? (mission page)',
      url: 'https://science.nasa.gov/mission/roman-space-telescope/who-is-nancy-grace-roman/',
    },
    {
      key: 'romancomplete',
      text: 'NASA/JPL 2025, NASA Completes Nancy Grace Roman Space Telescope Construction (4 December 2025)',
      url: 'https://www.jpl.nasa.gov/news/nasa-completes-nancy-grace-roman-space-telescope-construction/',
    },
    {
      key: 'romanlaunch',
      text: 'NASA 2026, NASA’s Dark Universe-Seeking Nancy Grace Roman Space Telescope Launches (news release, 30 August 2026)',
      url: 'https://www.nasa.gov/news-release/nasas-dark-universe-seeking-nancy-grace-roman-space-telescope-launches/',
    },
    {
      key: 'romanvisor',
      text: 'NASA Science 2026, NASA Roman Space Telescope’s Antenna, ‘Visor’ Deployed (Roman blog, 1 September 2026)',
      url: 'https://science.nasa.gov/blogs/roman/2026/09/01/nasa-roman-space-telescopes-antenna-visor-deployed/',
    },
    {
      key: 'romanfuel',
      text: 'NASA Science 2026, Fuel Savings Double Potential Lifetime for NASA’s Roman Mission (Roman blog, 14 September 2026)',
      url: 'https://science.nasa.gov/blogs/roman/2026/09/14/fuel-savings-double-potential-lifetime-for-nasas-roman-mission/',
    },
    {
      key: 'romancgi',
      text: 'NASA Science 2026, NASA Checks Roman Guidance System, Takes First Coronagraph Observation (Roman blog, 30 September 2026)',
      url: 'https://science.nasa.gov/blogs/roman/2026/09/30/nasa-checks-roman-guidance-system-takes-first-coronagraph-observation/',
    },
    {
      key: 'romanalign',
      text: 'NASA Science 2026, Instruments on NASA’s Roman Space Telescope Get in Sync for Science (Roman blog, 13 November 2026)',
      url: 'https://science.nasa.gov/blogs/roman/2026/11/13/instruments-on-nasas-roman-space-telescope-get-in-sync-for-science/',
    },
    {
      key: 'romanfirst',
      text: 'NASA 2026, NASA Invites Media, Public to View Roman Telescope’s First Images (media advisory M26-088, 17 November 2026)',
      url: 'https://www.nasa.gov/news-release/nasa-invites-media-public-to-view-roman-telescopes-first-images/',
    },
    {
      key: 'romanhlwas',
      text: 'NASA Science, High-Latitude Wide-Area Survey (Roman mission page)',
      url: 'https://science.nasa.gov/mission/roman-space-telescope/high-latitude-wide-area-survey/',
    },
    {
      key: 'romande',
      text: 'NASA Science, Dark Energy (Roman mission page)',
      url: 'https://science.nasa.gov/mission/roman-space-telescope/dark-energy/',
    },
    {
      key: 'romanexo',
      text: 'NASA Science, Exoplanets (Roman mission page: microlensing and transits)',
      url: 'https://science.nasa.gov/mission/roman-space-telescope/exoplanets/',
    },
    {
      key: 'penny2019',
      text: 'Penny, M. T., Gaudi, B. S., et al. 2019, Predictions of the WFIRST Microlensing Survey. I. Bound Planet Detection Rates, ApJS 241, 3',
      url: 'https://doi.org/10.3847/1538-4365/aafb69',
    },
    {
      key: 'johnson2020',
      text: 'Johnson, S. A., Penny, M., et al. 2020, Predictions of the Nancy Grace Roman Space Telescope Galactic Exoplanet Survey. II. Free-floating Planet Detection Rates, AJ 160, 123',
      url: 'https://doi.org/10.3847/1538-3881/aba75b',
    },
  ],
};
