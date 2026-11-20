import type { Description } from '../types.ts';
import { marsSiteDrawn } from './marsCommon.ts';

/**
 * Viking 2's lander, in Utopia Planitia. Every fact from the source it cites: NASA's mission
 * pages, NSSDCA's catalogue entry, the photo captions and the papers of the experiments.
 */
export const VIKING_LANDER_2: Description = {
  id: 'site-viking-2',
  lead: [
    'A second landing is how one place becomes a planet. Viking 2’s lander came down 7,500 km from its twin, on a different plain, and found the same pink sky and the same red soil — and, as winter came, frost on the ground.',
    'It is the second of NASA’s two Viking landers, built like the first, and it touched down on 3 September 1976, 45 days after Viking 1, in Utopia Planitia, a vast plain far to the north. It landed hard on one side — a thruster fired just before touchdown — and settled with a foot on a rock, tilted 8°, so its horizon looks crooked in its pictures. Like its twin it ran on two plutonium generators and carried cameras, a weather station, an arm and a laboratory to look for life.',
    'Its experiments behaved as Viking 1’s had: the soil reacted strangely, giving off gas when fed nutrient as if something lived in it, but held no organic matter that its ovens could find. Unlike its twin, its seismometer worked. It mostly felt the wind shaking the lander, and perhaps one small marsquake, which was enough to show that Mars is far quieter than Earth and that a seismometer would have to be set on the ground, away from the lander, to hear it — as InSight’s was, 42 years later.',
    'It watched Utopia through nearly two Martian years. In the winters a thin coat of frost, thinner than a sheet of paper, formed on the rocks and soil and lingered for months. Its batteries failed in April 1980 and it was switched off, after 1,281 Martian days. It is still there, found from orbit in 2006 with the shell that carried it down.',
  ],
  photos: [
    {
      file: 'photos/sites/site-viking-2/first-photo-1976.webp',
      largeFile: 'photos/sites/site-viking-2/first-photo-1976-large.webp',
      width: 640,
      height: 203,
      title: 'Viking 2’s first picture, 3 September 1976',
      caption:
        'Taken minutes after landing: rocks of 10 to 20 cm, many full of holes like volcanic rock, and the lander’s footpad, its bowl filled with soil thrown up by the engines. The boulder above it may have been turned over by the foot. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1976-09-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA00396',
    },
    {
      file: 'photos/sites/site-viking-2/first-panorama-1976.webp',
      largeFile: 'photos/sites/site-viking-2/first-panorama-1976-large.webp',
      width: 640,
      height: 125,
      title: 'Utopia Planitia, 3 September 1976',
      caption:
        'The second picture, sweeping 330° from northwest to southeast: rocks up to several metres across out to the horizon, and no dunes. The dip in the horizon is an illusion of the lander’s 8° tilt; the ground is more level than at Viking 1’s site. The Sun is just out of the picture above the bright sky. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1976-09-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA00399',
    },
    {
      file: 'photos/sites/site-viking-2/first-colour-1976.webp',
      largeFile: 'photos/sites/site-viking-2/first-colour-1976-large.webp',
      width: 626,
      height: 512,
      title: 'The first colour picture from Utopia, 1976',
      caption:
        'Looking northeast in the afternoon, the Sun behind the camera: a sky as pink as over Chryse and rocks and soil of almost the same colours, more than 6,000 km away. The horizon is tilted by the lander’s lean.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1976-09',
      sourceUrl: 'https://images.nasa.gov/details/PIA00568',
    },
    {
      file: 'photos/sites/site-viking-2/summer-afternoon-1976.webp',
      largeFile: 'photos/sites/site-viking-2/summer-afternoon-1976-large.webp',
      width: 457,
      height: 350,
      title: 'A summer afternoon, 6 September 1976',
      caption:
        'Looking south over a nearly level plain strewn with rocks up to a metre across, many porous and spongy like volcanic rock, with fine material drifted against them. The mast with the orange cable is the antenna that heard commands from Earth.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1976-09-06',
      sourceUrl: 'https://images.nasa.gov/details/PIA00569',
    },
    {
      file: 'photos/sites/site-viking-2/frost-1977.webp',
      largeFile: 'photos/sites/site-viking-2/frost-1977-large.webp',
      width: 206,
      height: 512,
      title: 'Frost, 25 September 1977',
      caption:
        'Late-winter frost in patches round dark rocks, looking southeast over the lander. It was first seen twelve sols earlier, and the white against the red soil confirmed it was frost.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1977-09-25',
      sourceUrl: 'https://images.nasa.gov/details/PIA00573',
    },
    {
      file: 'photos/sites/site-viking-2/frost-1979.webp',
      largeFile: 'photos/sites/site-viking-2/frost-1979-large.webp',
      width: 478,
      height: 512,
      title: 'Frost again, 18 May 1979',
      caption:
        'The frost back one Martian year later, almost to the day: a coat of water ice perhaps a thousandth of an inch thick on the rocks and soil. Relayed to Earth by Viking Orbiter 1.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1979-05-18',
      sourceUrl: 'https://images.nasa.gov/details/PIA00571',
    },
    {
      file: 'photos/sites/site-viking-2/hirise-lander-2006.webp',
      largeFile: 'photos/sites/site-viking-2/hirise-lander-2006-large.webp',
      width: 640,
      height: 612,
      title: 'The lander from orbit, 2006',
      caption:
        'Viking Lander 2, about 3 m across, and its back shell, found by Mars Reconnaissance Orbiter’s HiRISE camera on ground broken into polygons, a pattern usual at these latitudes and perhaps due to ice deep below. A part of NASA’s annotated image. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2006-12-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA01882',
    },
  ],
  drawnHere: [
    {
      title: 'Where the mark stands',
      text: 'At 47.6673° N, 134.2809° E: NASA’s catalogue entry for the lander, which says neither the frame nor how the position was found. HiRISE has located the lander, but no coordinates of it from those images have been found published.',
      cite: ['nssdc', 'pia01882'],
    },
    ...marsSiteDrawn('The lander, its back shell and its heat shield are a few metres across and lie hundreds of metres apart.'),
  ],
  measured: [
    {
      title: 'Touchdown',
      text: '3 September 1976 at 22:58:20 UT, about 200 km west of the crater Mie in Utopia Planitia, 7,500 km northeast of Viking 1. A thruster fired 0.4 seconds before touchdown, cracking the ground and raising dust; it settled with one leg on a rock, tilted 8.2°.',
      cite: ['nssdc', 'pia00396'],
    },
    {
      title: 'Its power',
      text: 'Two plutonium-238 radioisotope generators of 30 W each, with nickel-cadmium batteries for the peaks.',
      cite: ['nssdc'],
    },
    {
      title: 'The life experiments',
      text: 'The labelled-release experiment gave off radioactive gas from fed soil much as it had at Viking 1’s site, remarkably alike at the two; the gas chromatograph–mass spectrometer found no organic compounds of Martian origin, down to parts per billion. Together, no clear evidence of life.',
      cite: ['levin1976', 'biemann1977', 'viking'],
    },
    {
      title: 'Listening for marsquakes',
      text: 'Its seismometer ran from 4 September 1976. Fixed on the lander, it mostly recorded the wind shaking it. In its first five months it felt nothing large — Mars is less active than Earth — and one possible local quake, of magnitude about 3, on sol 80, when there were no wind data to rule out a gust. Its team wrote that a seismometer set apart from the lander would be about a thousand times quieter.',
      cite: ['anderson1977'],
    },
    {
      title: 'Frost',
      text: 'First seen in September 1977, late in the northern winter, and again in May 1979 almost exactly a Martian year later, staying about 100 days: a coat of water ice perhaps a thousandth of an inch thick.',
      cite: ['pia00573', 'pia00571'],
    },
    {
      title: 'Its end',
      text: 'It worked for 1,281 Martian days. Its batteries failed and it was turned off on 11 April 1980, the date of its last data.',
      cite: ['nssdc', 'viking'],
    },
    {
      title: 'Found from orbit',
      text: 'In 2006 HiRISE located the lander, about 3 m across, confirmed by matching the topography seen from the lander, and likely spots for its heat shield and back shell.',
      cite: ['pia01882'],
    },
  ],
  estimated: [
    {
      title: 'Organic matter after all?',
      text: 'Viking 2’s ovens did give off traces of dichloromethane, put down at the time to contamination from Earth. A 2010 re-analysis, after Phoenix found perchlorate in Martian soil, worked out that the Utopia soil may hold 0.7 to 2.6 parts per million of organic carbon, destroyed by the perchlorate as it was heated: a model, not a measurement.',
      cite: ['navarro2010'],
    },
  ],
  missing: [
    {
      title: 'Its exact position',
      text: 'Not published as coordinates from HiRISE, as Viking 1’s is; the mark stands at the catalogue’s position, and how far that is from the lander is not known here.',
      cite: ['nssdc'],
    },
    {
      title: 'What the frost was',
      text: 'When it was first seen, the team thought it might be a mixture of water and carbon-dioxide ice, since it lasted for days; by 1979 they described it as water ice brought down by dust grains weighted with frozen carbon dioxide. Neither was measured directly.',
      cite: ['pia00573', 'pia00571'],
    },
  ],
  misconceptions: [
    {
      title: 'Its horizon is not tilted',
      text: 'The slope in its panoramas is the lander leaning 8° on a rock; the plain is more nearly level than Viking 1’s.',
      cite: ['pia00399', 'nssdc'],
    },
  ],
  sources: [
    {
      key: 'viking',
      text: 'NASA Science, Viking Project (mission page: the biology experiments, the landers’ last transmissions)',
      url: 'https://science.nasa.gov/mission/viking/',
    },
    {
      key: 'nssdc',
      text: 'NASA Space Science Data Coordinated Archive, Viking 2 Lander (1975-083C)',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-083C',
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
      key: 'anderson1977',
      text: 'Anderson, D. L., et al. 1977, Seismology on Mars, J. Geophys. Res. 82, 4524',
      url: 'https://doi.org/10.1029/JS082i028p04524',
    },
    {
      key: 'pia00396',
      text: 'NASA/JPL, PIA00396: Viking Lander 2’s First Picture On The Surface Of Mars (caption)',
      url: 'https://science.nasa.gov/photojournal/viking-lander-2s-first-picture-on-the-surface-of-mars/',
    },
    {
      key: 'pia00399',
      text: 'NASA/JPL, PIA00399: Northern Plains Of Mars (caption)',
      url: 'https://science.nasa.gov/photojournal/northern-plains-of-mars/',
    },
    {
      key: 'pia00573',
      text: 'NASA/JPL, PIA00573: Frost at the Viking Lander 2 Site (caption)',
      url: 'https://science.nasa.gov/photojournal/frost-at-the-viking-lander-2-site/',
    },
    {
      key: 'pia00571',
      text: 'NASA/JPL, PIA00571: Ice on Mars Utopia Planitia Again (caption)',
      url: 'https://science.nasa.gov/photojournal/ice-on-mars-utopia-planitia-again/',
    },
    {
      key: 'pia01882',
      text: 'NASA/JPL-Caltech/University of Arizona 2006, PIA01882: Viking Lander 2 Gerald A. Soffen Memorial Station Imaged from Orbit (caption)',
      url: 'https://science.nasa.gov/photojournal/viking-lander-2-gerald-a-soffen-memorial-station-imaged-from-orbit/',
    },
  ],
};
