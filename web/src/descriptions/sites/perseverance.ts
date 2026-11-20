import type { Description } from '../types.ts';

/**
 * Perseverance and Ingenuity, in Jezero crater; the rover drawn on NASA's traverse (catalog
 * SURFACE_CRAFT, core/surface.ts). Every fact from the source it cites: NASA's and JPL's pages
 * and releases, the photo captions and the Cheyava Falls paper.
 */
export const PERSEVERANCE: Description = {
  id: 'perseverance',
  lead: [
    'Perseverance was sent to Mars to look for signs of past life itself, and to keep the best of what it finds for people on Earth to study: rock cores sealed in tubes, waiting for a ride home. It carried a passenger, too — a small helicopter named Ingenuity, with a scrap of the Wright brothers’ first aeroplane on board, which on 19 April 2021 lifted off and hovered in an air a hundred times thinner than ours: the first powered, controlled flight on another planet.',
    'It is NASA’s, built and run by JPL, and a near-twin of Curiosity in shape: 1,025 kg, 3 m long, powered by the heat of 4.8 kg of plutonium dioxide. On 18 February 2021 a sky crane lowered it into Jezero crater, 45 km across, where more than 3.5 billion years ago rivers spilled over the rim and filled a lake, and left a delta of mud and sand at its edge — the kind of place where life, if there was any, could have left a trace.',
    'Ingenuity was meant to make five test flights in a month. It made 72 over nearly three years, until a rough landing on 18 January 2024 broke its rotor blades; it still stands where it came down. Perseverance drove on. In January 2023 it laid ten tubes on the ground at a place called Three Forks — a back-up cache in case it could not deliver its own.',
    'In July 2024, at the edge of an old river valley, it found a reddish rock, Cheyava Falls, spotted with tiny pale rings edged in black, like a leopard’s coat. On Earth, spots like these often form where microbes feed on chemical reactions in mud. NASA calls it a potential biosignature — something that may have a biological origin but needs more study. Its core is in a tube in the rover’s belly. By October 2026 it had driven farther than Opportunity’s 45 km, and it is still driving.',
  ],
  photos: [
    {
      file: 'photos/sites/perseverance/hirise-descent-2021.webp',
      largeFile: 'photos/sites/perseverance/hirise-descent-2021-large.webp',
      width: 640,
      height: 361,
      title: 'Falling into Jezero, 18 February 2021',
      caption:
        'The descent stage holding Perseverance, its parachute trailing, photographed by HiRISE from about 700 km while both craft raced along at kilometres a second. The ancient river delta enters the crater from the left. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2021-02-18',
      sourceUrl: 'https://images.nasa.gov/details/PIA24270',
    },
    {
      file: 'photos/sites/perseverance/ingenuity-first-flight-2021.webp',
      largeFile: 'photos/sites/perseverance/ingenuity-first-flight-2021-large.webp',
      width: 640,
      height: 476,
      title: 'Ingenuity after the first flight, 19 April 2021',
      caption:
        'The helicopter back on the ground after the first powered, controlled flight on another planet, seen by the rover’s Mastcam-Z. Not white-balanced: a preliminary calibrated natural-colour composite, roughly as an eye there would see it.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/ASU/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2021-04-19',
      sourceUrl: 'https://images.nasa.gov/details/PIA24550',
    },
    {
      file: 'photos/sites/perseverance/kodiak-2021.webp',
      largeFile: 'photos/sites/perseverance/kodiak-2021-large.webp',
      width: 640,
      height: 853,
      title: 'Kodiak, a remnant of the delta, April 2021',
      caption:
        'A flat-topped hill 2.2 km away and 250 m wide whose layers record sediment laid down slowly in a river delta, then floods. Enhanced colour: the bands processed to bring out differences.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/ASU/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2021-04-18',
      sourceUrl: 'https://images.nasa.gov/details/PIA24802',
    },
    {
      file: 'photos/sites/perseverance/three-forks-selfie-2023.webp',
      largeFile: 'photos/sites/perseverance/three-forks-selfie-2023-large.webp',
      width: 640,
      height: 598,
      title: 'With its sample depot, 22 January 2023',
      caption:
        'A selfie of 59 frames from the camera on its arm at Three Forks, with some of the ten tubes it left there: the ninth, “Atsah”, lies in front of it. NASA’s caption gives no colour adjustment.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2023-01-22',
      sourceUrl: 'https://images.nasa.gov/details/PIA25681',
    },
    {
      file: 'photos/sites/perseverance/cheyava-falls-selfie-2024.webp',
      largeFile: 'photos/sites/perseverance/cheyava-falls-selfie-2024-large.webp',
      width: 640,
      height: 454,
      title: 'With Cheyava Falls, 23 July 2024',
      caption:
        '62 frames from the arm’s camera: left of the rover, the arrowhead-shaped rock Cheyava Falls, about a metre long, with the dark hole of its core and the white patch it abraded, at the edge of the river valley Neretva Vallis. NASA’s caption gives no colour adjustment.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2024-07-23',
      sourceUrl: 'https://images.nasa.gov/details/PIA26344',
    },
    {
      file: 'photos/sites/perseverance/leopard-spots-2024.webp',
      largeFile: 'photos/sites/perseverance/leopard-spots-2024-large.webp',
      width: 640,
      height: 466,
      title: 'The “leopard spots”, 18 July 2024',
      caption:
        'White veins of calcium sulphate run along the rock; between them, a reddish band of hematite with millimetre-sized pale patches ringed in black. On Earth such spots form when reactions turn hematite from red to white, reactions microbes can live on. NASA’s caption gives no colour adjustment.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2024-07-18',
      sourceUrl: 'https://images.nasa.gov/details/PIA26368',
    },
    {
      file: 'photos/sites/perseverance/ingenuity-rotor-shadow-2024.webp',
      largeFile: 'photos/sites/perseverance/ingenuity-rotor-shadow-2024-large.webp',
      width: 640,
      height: 474,
      title: 'Ingenuity’s broken blade, January 2024',
      caption:
        'After its 72nd and last flight, on 18 January 2024, Ingenuity’s own colour camera caught the shadow of a rotor blade damaged in a rough landing. It never flew again. NASA’s caption gives no colour adjustment.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '2024-01-18',
      sourceUrl: 'https://images.nasa.gov/details/PIA26243',
    },
  ],
  drawnHere: [
    {
      title: 'Not where Horizons stops',
      text: 'JPL Horizons’ file for Perseverance stops in February 2026; the app follows the rover’s own published traverse instead.',
    },
    {
      title: 'Ingenuity and the depot are not drawn',
      text: 'The helicopter, where it last landed, and the ten tubes at Three Forks are not in the scene: no position of them is read here, and they are small.',
    },
  ],
  measured: [
    {
      title: 'Who made it',
      text: 'Built by JPL, which runs its operations for NASA. Ingenuity was built by JPL too, with help from NASA’s Ames and Langley centres, AeroVironment, Qualcomm and SolAero.',
      cite: ['biosignature2025', 'pia26243'],
    },
    {
      title: 'The rover',
      text: '1,025 kg; 3 m long, 2.7 m wide, 2.2 m tall; six wheels 52.5 cm across. A Multi-Mission Radioisotope Thermoelectric Generator with 4.8 kg of plutonium dioxide gives about 110 W at launch, a few percent less each year, over a 14-year design life. 43 sample tubes.',
      cite: ['components'],
    },
    {
      title: 'Launch and landing',
      text: 'Launched on 30 July 2020; landed on 18 February 2021 in Jezero crater, 45 km wide, on the western edge of Isidis Planitia, by the sky crane manoeuvre Curiosity used. More than 3.5 billion years ago rivers spilled into the crater and formed a lake.',
      cite: ['m2020', 'skycrane'],
    },
    {
      title: 'Ingenuity',
      text: 'The first powered, controlled flight on another planet, on 19 April 2021. Designed for up to five test flights in 30 days, it made 72, more than two hours in the air, flying more than 14 times farther than planned. Its last flight was on 18 January 2024; one or more rotor blades were damaged on landing, and NASA ended the mission on 25 January. It carries a swatch from the Wright Flyer.',
      cite: ['ingenuityEnd', 'm2020'],
    },
    {
      title: 'Oxygen from the air',
      text: 'MOXIE, an experiment on board, made oxygen from the carbon dioxide of Mars’s air.',
      cite: ['m2020'],
    },
    {
      title: 'The Three Forks depot',
      text: 'Ten tubes laid on the ground between 21 December 2022 and 28 January 2023, the first sample depot on another world: a back-up for the samples in the rover.',
      cite: ['depot2023'],
    },
    {
      title: 'Cheyava Falls',
      text: 'Found in July 2024 in the Bright Angel formation at the edge of Neretva Vallis, an old river valley 400 m wide. Its core, “Sapphire Canyon”, holds organic matter with vivianite, an iron phosphate, and greigite, an iron sulphide, in the leopard spots: minerals that on Earth often form in reactions microbes drive. The results were published in Nature in September 2025.',
      cite: ['biosignature2025', 'hurowitz2025', 'pia26368'],
    },
    {
      title: 'Samples and distance',
      text: '27 rock cores by September 2025. On 11 October 2026 it had driven 45.22 km, past Opportunity’s record.',
      cite: ['biosignature2025', 'm2020'],
    },
  ],
  estimated: [],
  missing: [
    {
      title: 'Whether Cheyava Falls holds a sign of life',
      text: 'Not known. Its finders ask whether the spots formed through life or through chemistry that only mimics it; more data, or further study, are needed to tell.',
      cite: ['biosignature2025', 'hurowitz2025'],
    },
    {
      title: 'When the samples come home',
      text: 'Not settled: they wait in the rover and at Three Forks for a mission to fetch them, which has not flown.',
      cite: ['depot2023'],
    },
  ],
  misconceptions: [
    {
      title: 'A potential biosignature is not life found',
      text: 'NASA’s term means a substance or structure that might have a biological origin but needs more data before anyone can say whether life was there or not.',
      cite: ['biosignature2025'],
    },
  ],
  sources: [
    {
      key: 'm2020',
      text: 'NASA Science, Mars 2020: Perseverance Rover (mission page: launch, landing, Jezero, Ingenuity, MOXIE, distance)',
      url: 'https://science.nasa.gov/mission/mars-2020-perseverance/',
    },
    {
      key: 'components',
      text: 'NASA Science, Perseverance Rover Components (mass, size, wheels, power, sample tubes)',
      url: 'https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/',
    },
    {
      key: 'skycrane',
      text: 'JPL 2024, Here’s How Curiosity’s Sky Crane Changed the Way NASA Explores Mars (news, 7 August 2024)',
      url: 'https://www.jpl.nasa.gov/news/heres-how-curiositys-sky-crane-changed-the-way-nasa-explores-mars/',
    },
    {
      key: 'ingenuityEnd',
      text: 'JPL 2024, After Three Years on Mars, NASA’s Ingenuity Helicopter Mission Ends (news release, 25 January 2024)',
      url: 'https://www.jpl.nasa.gov/news/after-three-years-on-mars-nasas-ingenuity-helicopter-mission-ends/',
    },
    {
      key: 'depot2023',
      text: 'JPL 2023, NASA’s Perseverance Rover Completes Mars Sample Depot (news release, 28 January 2023)',
      url: 'https://www.jpl.nasa.gov/news/nasas-perseverance-rover-completes-mars-sample-depot/',
    },
    {
      key: 'biosignature2025',
      text: 'JPL 2025, NASA Says Mars Rover Discovered Potential Biosignature Last Year (news release, 10 September 2025)',
      url: 'https://www.jpl.nasa.gov/news/nasa-says-mars-rover-discovered-potential-biosignature-last-year/',
    },
    {
      key: 'hurowitz2025',
      text: 'Hurowitz, J. A., et al. 2025, Redox-driven mineral and organic associations in Jezero Crater, Mars, Nature 645, 332',
      url: 'https://doi.org/10.1038/s41586-025-09413-0',
    },
    {
      key: 'pia26243',
      text: 'NASA/JPL-Caltech 2024, PIA26243: Ingenuity Spots the Shadow of Its Damaged Rotor Blade (caption)',
      url: 'https://science.nasa.gov/photojournal/ingenuity-spots-the-shadow-of-its-damaged-rotor-blade/',
    },
    {
      key: 'pia26368',
      text: 'NASA/JPL-Caltech/MSSS 2024, PIA26368: Perseverance Finds a Rock With ‘Leopard Spots’ (caption)',
      url: 'https://science.nasa.gov/photojournal/perseverance-finds-a-rock-with-leopard-spots/',
    },
  ],
};
