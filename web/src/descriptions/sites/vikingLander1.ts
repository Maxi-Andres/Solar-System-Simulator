import type { Description } from '../types.ts';
import { KONOPLIV_2026, marsSiteDrawn } from './marsCommon.ts';

/**
 * Viking 1's lander, in Chryse Planitia. Every fact from the source it cites: NASA's mission
 * pages, NSSDCA's catalogue entry, the photo captions and the papers of the experiments.
 */
export const VIKING_LANDER_1: Description = {
  id: 'site-viking-1',
  lead: [
    'For all of history Mars had been a light in the sky and a place in stories. On 20 July 1976 it became a place with a ground: a camera on Viking 1’s lander looked down at its own footpad among rocks and dust, the first photograph ever taken on the surface of Mars. The lander was also sent to ask the oldest question about it — is anything alive there? — and the answer it brought back is still argued over.',
    'Viking was NASA’s, managed by its Langley Research Center; the landers were built by Martin Marietta in Denver. Each of the two Vikings was an orbiter and a lander travelling together. Viking 1’s lander touched down at 11:53:06 UT on the western slopes of Chryse Planitia, a wide plain, about 28 km from its planned point: the first site had proved rougher than expected. It ran on the heat of plutonium in two small generators, about 70 watts in all.',
    'It carried two cameras that scanned the scene line by line, an arm to scoop soil, a weather station, a seismometer and a laboratory. Three experiments fed Martian soil to look for life, and a gas chromatograph–mass spectrometer heated it to look for organic molecules. The soil reacted — in one experiment it gave off gas much as soil with microbes would — but no organic matter was found at all, and the team that looked for it judged life like Earth’s unlikely there.',
    'It was planned to work for 90 days. It worked for more than six years, and was renamed the Thomas Mutch Memorial Station in 1981. In November 1982 a faulty command sent from Earth broke contact, and it was never heard again. It is still there: in 2006 an orbiter’s camera found it, a speck three metres across, and, likely, the shell and parachute that slowed it.',
  ],
  photos: [
    {
      file: 'photos/sites/site-viking-1/first-photo-1976.webp',
      largeFile: 'photos/sites/site-viking-1/first-photo-1976-large.webp',
      width: 640,
      height: 228,
      title: 'The first photograph on Mars, 20 July 1976',
      caption:
        'Taken minutes after landing: rocks and fine dust about 1.4 m from the camera, and on the right one of the lander’s footpads. The dark band at the left may be a minute’s shadow of dust or cloud passing before the Sun as the camera scanned. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1976-07-20',
      sourceUrl: 'https://images.nasa.gov/details/PIA00381',
    },
    {
      file: 'photos/sites/site-viking-1/first-panorama-1976.webp',
      largeFile: 'photos/sites/site-viking-1/first-panorama-1976-large.webp',
      width: 640,
      height: 131,
      title: 'The first panorama, 20 July 1976',
      caption:
        'The first wide view from the surface, in the late afternoon: rocks to a horizon about 3 km away, the housing of the still-folded sampler arm at left of centre, the high-gain dish top right. The parallel lines in the sky are an artefact of the camera. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1976-07-20',
      sourceUrl: 'https://images.nasa.gov/details/PIA00383',
    },
    {
      file: 'photos/sites/site-viking-1/first-colour-1976.webp',
      largeFile: 'photos/sites/site-viking-1/first-colour-1976-large.webp',
      width: 563,
      height: 512,
      title: 'The first colour picture, 21 July 1976',
      caption:
        'Looking southeast about noon on the day after landing. The scene was scanned three times through different filters and balanced on a grey chart on the lander, so its colours are near an eye’s: orange-red soil over darker rock, and a pinkish sky lit by dust.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1976-07-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA00563',
    },
    {
      file: 'photos/sites/site-viking-1/sunset-chryse-1976.webp',
      largeFile: 'photos/sites/site-viking-1/sunset-chryse-1976-large.webp',
      width: 498,
      height: 512,
      title: 'Before sunset in Chryse, 21 August 1976',
      caption:
        'Looking southwest about 15 minutes before sunset, the Sun 3° or 4° above the horizon. The low light shows a hollow beyond the lander’s leg that higher Sun had hidden, and rocks about 30 cm across; the shadows are soft because the dusty air scatters the light.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1976-08-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA00567',
    },
    {
      file: 'photos/sites/site-viking-1/chryse-sampler-mosaic.webp',
      largeFile: 'photos/sites/site-viking-1/chryse-sampler-mosaic-large.webp',
      width: 640,
      height: 202,
      title: 'The sampler arm’s ground',
      caption:
        'Part of a mosaic from camera 1 built from frames taken on many days of the mission: the sampler arm stretched out over the ground, drifts of fine sand behind it and boulders out to the horizon. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '2001-07-30',
      sourceUrl: 'https://images.nasa.gov/details/PIA03165',
    },
    {
      file: 'photos/sites/site-viking-1/hirise-lander-2006.webp',
      largeFile: 'photos/sites/site-viking-1/hirise-lander-2006-large.webp',
      width: 640,
      height: 347,
      title: 'The lander from orbit, 2006',
      caption:
        'Viking Lander 1, about 3 m across, found by the HiRISE camera on Mars Reconnaissance Orbiter thirty years after it landed, and the likely back shell with its parachute. A part of NASA’s annotated image; the colour strip is HiRISE’s, which records infrared as well as visible light.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2006-12-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA01881',
    },
  ],
  drawnHere: [
    {
      title: 'Where the mark stands',
      text: 'At 22.2692° N, 312.0495° E, planetocentric: the lander itself as HiRISE found it, tied to the frame of Mars’s laser altimeter to within 100 to 300 m, not the point it was aimed at. It appears from the moment of touchdown on.',
      cite: ['konopliv2026'],
    },
    ...marsSiteDrawn('The lander, its back shell and parachute, and its heat shield, are a few metres across and lie hundreds of metres apart.'),
  ],
  measured: [
    {
      title: 'Who made it',
      text: 'NASA’s Langley Research Center ran the Viking project, which made it unique among NASA’s deep-space projects; Martin Marietta’s Denver division won the contract to build the landers.',
      cite: ['tomayko'],
    },
    {
      title: 'Touchdown',
      text: '20 July 1976 at 11:53:06 UT, in western Chryse Planitia, about 28 km from the planned point: the first target had proved rougher than expected.',
      cite: ['viking1'],
    },
    {
      title: 'The first picture',
      text: 'The first picture began 25 seconds after landing, a strip scanned line by line, of the ground and a footpad; it was on Earth within minutes.',
      cite: ['nssdc', 'pia00381'],
    },
    {
      title: 'Its power',
      text: 'Two plutonium-238 radioisotope generators of 30 W each, with nickel-cadmium batteries for the peaks: about 70 W in all. The orbiter ran on sunlight.',
      cite: ['nssdc', 'viking1'],
    },
    {
      title: 'Its instruments',
      text: 'Two scanning cameras, a sampler arm with a magnet, a weather boom, a seismometer, a biology laboratory, a gas chromatograph–mass spectrometer and an X-ray fluorescence spectrometer: about 91 kg in all. The seismometer never unlocked, and a pin on the arm stuck for five days before it shook loose.',
      cite: ['nssdc'],
    },
    {
      title: 'The life experiments',
      text: 'Three experiments looked for life in the soil, at both Viking sites. They found unexpected, puzzling chemical activity but no clear evidence of living things. In the labelled-release experiment, soil fed a radioactive nutrient gave off radioactive gas; heating the soil to 160 °C stopped it, as it would stop microbes — and its designers said plainly that the facts did not yet allow a conclusion either way.',
      cite: ['viking', 'levin1976'],
    },
    {
      title: 'No organic matter',
      text: 'Heated soil, one sample from the surface and one from beneath it at each site, gave off water and carbon dioxide but no organic compounds of Martian origin, down to parts per billion. Life like Earth’s, the team concluded, was unlikely at either site.',
      cite: ['biemann1977'],
    },
    {
      title: 'Six years',
      text: 'Planned for 90 days after landing, it worked for more than six years. Its last transmission came in November 1982, after a faulty command sent from Earth; NASA’s pages give both the 11th and the 13th.',
      cite: ['viking', 'viking1', 'nssdc'],
    },
    {
      title: 'Found from orbit',
      text: 'In 2006 Mars Reconnaissance Orbiter’s HiRISE camera picked out the lander, about 3 m across, confirmed by matching the topography seen from the lander, and likely spots for its heat shield and its back shell with the parachute.',
      cite: ['pia01881'],
    },
  ],
  estimated: [
    {
      title: 'What the missing organics mean',
      text: 'In 2008 Phoenix found perchlorate in Martian soil. Heated with perchlorate, organic matter mostly burns to water and carbon dioxide and leaves traces of chloromethane — which Viking 1 did detect, at 15 parts per billion, and was put down to contamination from Earth. A 2010 re-analysis worked out from it that the Chryse soil may hold 1.5 to 6.5 parts per million of organic carbon: a model, not a measurement.',
      cite: ['navarro2010'],
    },
  ],
  missing: [
    {
      title: 'Whether it found life',
      text: 'Not settled by its data. The labelled-release results look as microbes would make them, and could also be chemistry in the soil; the experiments could not tell the two apart, and their designers left the question open.',
      cite: ['viking', 'levin1976'],
    },
    {
      title: 'How it is now',
      text: 'Not known: nothing has heard from it since 1982, and from orbit it is a few pixels across. How much dust covers it cannot be seen.',
    },
  ],
  misconceptions: [
    {
      title: 'Viking did not prove Mars lifeless',
      text: 'Nor did it find life. Its experiments gave puzzling results that its own scientists could not settle; the absence of organic matter weighed against life, and that absence itself was later questioned, once Phoenix found the perchlorate that would have destroyed organics in Viking’s ovens.',
      cite: ['viking', 'biemann1977', 'navarro2010'],
    },
    {
      title: 'Mars’s daytime sky is not blue',
      text: 'The first colour pictures, balanced on a grey chart carried on the lander, show a pinkish sky: fine reddish dust in the air scatters the light.',
      cite: ['pia00563'],
    },
  ],
  sources: [
    {
      key: 'viking1',
      text: 'NASA Science, Viking 1 (mission page: launch, landing, power, end of the lander’s mission)',
      url: 'https://science.nasa.gov/mission/viking-1/',
    },
    {
      key: 'viking',
      text: 'NASA Science, Viking Project (mission page: the 90-day plan, the biology experiments, the landers’ last transmissions)',
      url: 'https://science.nasa.gov/mission/viking/',
    },
    {
      key: 'nssdc',
      text: 'NASA Space Science Data Coordinated Archive, Viking 1 Lander (1975-075C)',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C',
    },
    {
      key: 'tomayko',
      text: 'Tomayko, J. E. 1988, Computers in Spaceflight: The NASA Experience, NASA CR-182505, chapter 5, “Viking computer systems” (Langley’s project; Martin Marietta’s Denver division and the lander)',
      url: 'https://www.nasa.gov/wp-content/uploads/static/history/computers/Ch5-6.html',
    },
    {
      key: 'levin1976',
      text: 'Levin, G. V., & Straat, P. A. 1976, Viking Labeled Release Biology Experiment: Interim Results, Science 194, 1322',
      url: 'https://doi.org/10.1126/science.194.4271.1322',
    },
    {
      key: 'biemann1977',
      text: 'Biemann, K., et al. 1977, The search for organic substances and inorganic volatile compounds in the surface of Mars, J. Geophys. Res. 82, 4641',
      url: 'https://doi.org/10.1029/JS082i028p04641',
    },
    {
      key: 'navarro2010',
      text: 'Navarro-González, R., Vargas, E., de la Rosa, J., Raga, A. C., & McKay, C. P. 2010, Reanalysis of the Viking results suggests perchlorate and organics at midlatitudes on Mars, J. Geophys. Res. 115, E12010',
      url: 'https://doi.org/10.1029/2010JE003599',
    },
    {
      key: 'pia00381',
      text: 'NASA/JPL, PIA00381: First Photograph Taken On Mars Surface (caption)',
      url: 'https://science.nasa.gov/photojournal/first-photograph-taken-on-mars-surface/',
    },
    {
      key: 'pia00563',
      text: 'NASA/JPL, PIA00563: First Color Image From Viking Lander 1 (caption)',
      url: 'https://science.nasa.gov/photojournal/first-color-image-from-viking-lander-1/',
    },
    {
      key: 'pia01881',
      text: 'NASA/JPL-Caltech/University of Arizona 2006, PIA01881: Viking Lander 1 Thomas A. Mutch Memorial Station Imaged from Orbit (caption)',
      url: 'https://science.nasa.gov/photojournal/viking-lander-1-thomas-a-mutch-memorial-station-imaged-from-orbit/',
    },
    KONOPLIV_2026,
  ],
};
