import type { Description } from '../types.ts';
import { LROC_CREDIT, LROC_LICENCE, NO_TELESCOPE, ownImagesMissing, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

const ID_C3 = 'site-chandrayaan-3';

/** Chandrayaan-3: India's landing, the farthest south any craft had then come down. */
export const CHANDRAYAAN_3: Description = {
  id: ID_C3,
  lead: [
    'Four years after its first lander crashed, India tried again and set down gently, making it the fourth country to land on the Moon — and the first to do it so far south, toward the pole where sunlight never reaches the floors of some craters and ice is thought to lie.',
    'The Vikram lander touched down on 23 August 2023 in the highlands about 600 km from the south pole, at 69.4° S, farther south than any craft before it. Its small rover, Pragyan, rolled down a ramp and spent the two weeks of lunar daylight driving about the site and measuring the ground; then lander and rover were put to sleep for the night and did not wake.',
    'Pragyan’s alpha-particle X-ray spectrometer made 23 measurements: the first of the chemistry of the soil at high southern latitudes. The ground proved fairly uniform and made mostly of ferroan anorthosite, the light rock thought to have floated to the top of a molten ocean that covered the young Moon — with a little more magnesium than expected, from darker rock mixed in.',
    'Four days after the landing LRO, tilted 42° to the side, photographed Vikram: a dark shadow in a bright halo of soil swept by its engine.',
  ],
  photos: [
    sitePhoto(ID_C3, 'lro-oblique', 640, 640, {
      title: 'Vikram from LRO, four days after landing',
      caption:
        'LRO’s narrow-angle camera, looking 42° off to the side, 1,738 m across: the lander is at the centre, its dark shadow against the bright halo where its rocket plume disturbed the fine soil. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2023-08-27',
      sourceUrl: 'https://lroc.im-ldi.com/images/1314',
    }),
    sitePhoto(ID_C3, 'lro-oblique-close', 640, 640, {
      title: 'The lander and its halo, enlarged',
      caption:
        'The middle of that image, about 340 m across, enlarged three times here: Vikram’s shadow and the brightened ground round it.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2023-08-27',
      sourceUrl: 'https://lroc.im-ldi.com/images/1314',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_C3, ['lroc1314'], 'Its longitude to two decimals, about ±300 m.'),
    {
      title: 'What Pragyan found',
      text: '23 measurements of the ground’s elements near the landing site: fairly uniform, mostly ferroan anorthosite, a product of the crystallising magma ocean, with more magnesium relative to calcium than that rock alone would give.',
      cite: ['vadawale2024'],
    },
  ],
  estimated: [],
  missing: [
    { title: 'The craft itself', text: 'Not drawn: a mark stands for Vikram; Pragyan, nearby, is not marked.' },
    ownImagesMissing('Vikram’s and Pragyan’s photographs are ISRO’s, and no licence clearly free to reuse with credit was found for them.'),
  ],
  misconceptions: [
    {
      title: 'It did not land at the south pole',
      text: 'About 600 km from it, at 69° south: the farthest south of any landing until then, but well short of the polar craters where ice is sought.',
      cite: ['lroc1314'],
    },
    NO_TELESCOPE,
  ],
  sources: [
    { key: 'lroc1314', text: 'LROC team 2023, Chandrayaan-3 Seen From Orbit', url: 'https://lroc.im-ldi.com/images/1314' },
    {
      key: 'vadawale2024',
      text: 'Vadawale, S. V., et al. 2024, Chandrayaan-3 APXS elemental abundance measurements at lunar high latitude, Nature 633, 327',
      url: 'https://doi.org/10.1038/s41586-024-07870-7',
    },
    SITE_SOURCES.robinson2010,
  ],
};

const ID_SLIM = 'site-slim';

/** SLIM: Japan's pinpoint landing, upended at the last moment. */
export const SLIM: Description = {
  id: ID_SLIM,
  lead: [
    'Landers had always aimed for a place kilometres wide and taken what they got. SLIM, Japan’s first lander, was built to land where it was told, within about a hundred metres — the kind of precision a future mission needs to set down beside a particular rock. It did, and then fell over.',
    'It came down at 15:20 UT on 19 January 2024 (00:20 the next morning in Japan) on the slope beside Shioli, a fresh crater 270 m across near the crater Theophilus. Fifty metres up, one of its two main engines lost its thrust — its nozzle appears to have broken off and fallen — and with one engine it could only slow its fall. It drifted east and touched down about 55 m from its target, but sideways, and settled in an attitude it was never meant to have, its solar cells facing west, away from the morning Sun.',
    'Just before touchdown it dropped two tiny rovers, LEV-1 and LEV-2, which reached the ground. Its own position before the engine failed was within about 10 m of the target, perhaps 3 to 4 m: the first pinpoint landing. When the afternoon Sun came round to its cells it woke and photographed the rocks round it; it survived three lunar nights, was last heard from on 28 April 2024, and JAXA ended its operations on 23 August.',
    'LRO saw it five days after landing, near noon: a bright speck, and around it a faint change in the ground where its exhaust swept the dust.',
  ],
  photos: [
    sitePhoto(ID_SLIM, 'lro-2024', 640, 640, {
      title: 'SLIM from LRO',
      caption:
        'LRO’s narrow-angle camera from about 80 km up, the Sun 14° from overhead: the lander at the arrow, and the bright ejecta of the young crater Shioli to the left. 880 m across, 80 cm a pixel. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2024-01-24',
      sourceUrl: 'https://lroc.im-ldi.com/images/1358',
    }),
    sitePhoto(ID_SLIM, 'lro-before-after', 640, 318, {
      title: 'Before and after',
      caption: 'The same ground before the landing and five days after it, enlarged twice, 440 m across: the lander appears, and the surface round it is subtly brightened.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'before and 2024-01-24',
      sourceUrl: 'https://lroc.im-ldi.com/images/1358',
    }),
    sitePhoto(ID_SLIM, 'lro-plume-ratio', 480, 480, {
      title: 'What the exhaust did',
      caption:
        'The after image divided by the before image, so that only what changed stands out: the ground round the lander brightened by its engine, enhanced far beyond what an eye could see.',
      colour: 'false',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2024-01-24',
      sourceUrl: 'https://lroc.im-ldi.com/images/1358',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_SLIM, ['lroc1358']),
    {
      title: 'How close',
      text: 'About 55 m east of its target where it touched down, pushed sideways by the failed engine; within about 10 m, perhaps 3 to 4 m, before the failure.',
      cite: ['jaxa2024a'],
    },
    {
      title: 'Its engine',
      text: 'About 50 m up, the thrust of one main engine was lost — most likely because its nozzle broke and fell — leaving one engine that could only just hold the craft against the Moon’s gravity.',
      cite: ['jaxa2024doc'],
    },
    {
      title: 'Its life on the surface',
      text: 'Survived three lunar nights; last contact 28 April 2024; operations ended 23 August 2024.',
      cite: ['jaxa2024b'],
    },
  ],
  estimated: [],
  missing: [
    { title: 'The craft itself', text: 'Not drawn: a mark stands for SLIM; the two small rovers are not marked.' },
    ownImagesMissing(
      'SLIM’s own pictures, and LEV-2’s famous one of SLIM on its nose, are JAXA’s and its partners’, whose terms allow no modification and leave images shared with other owners to them.',
    ),
  ],
  misconceptions: [NO_TELESCOPE],
  sources: [
    { key: 'lroc1358', text: 'LROC team 2024, SLIM landing site', url: 'https://lroc.im-ldi.com/images/1358' },
    { key: 'jaxa2024a', text: 'JAXA 2024, Outcome for the Smart Lander for Investigating Moon (SLIM)’s Moon Landing (press release, 25 January)', url: 'https://global.jaxa.jp/press/2024/01/20240125-1_e.html' },
    { key: 'jaxa2024doc', text: 'JAXA 2024, SLIM landing results, press briefing material (25 January)', url: 'https://global.jaxa.jp/press/2024/01/file/jaxa_doc01_20240125_e.pdf' },
    { key: 'jaxa2024b', text: 'JAXA 2024, Conclusion of SLIM operations on the lunar surface (press release, 26 August)', url: 'https://global.jaxa.jp/press/2024/08/20240826-1_e.html' },
    SITE_SOURCES.robinson2010,
  ],
};

const ID_BG = 'site-blue-ghost-1';

/** Blue Ghost 1: the first commercial landing to go wholly right. */
export const BLUE_GHOST_1: Description = {
  id: ID_BG,
  lead: [
    'For almost sixty years only governments landed on the Moon, and the first companies to try crashed or tipped over. In 2025 one did it and everything worked: Firefly Aerospace’s Blue Ghost, carrying ten instruments for NASA, came down upright on 2 March and worked through a whole lunar day.',
    'It landed in Mare Crisium, the Sea of Crises, among volcanic ground near the small mountain Mons Latreille, beside the rim of a crater 12 m across. Over more than 14 days of sunlight its instruments ran: a drill blown by gas into the ground to measure the heat flowing out of the Moon, a receiver that picked up the signals of Earth’s navigation satellites from the Moon, an X-ray camera that watched the solar wind strike Earth’s magnetic field.',
    'On 14 March it photographed a total eclipse of the Sun by Earth, seen from the Moon, and on 16 March the sunset over its own landing site. It kept working a few hours into the night; its last data reached Earth that evening.',
    'LRO saw it the day after landing, its shadow making it easy to find, and the dust its engine had blown aside; and later from 65 km to the side, a speck in the low light.',
  ],
  photos: [
    sitePhoto(ID_BG, 'lro-2025', 640, 640, {
      title: 'Blue Ghost from above',
      caption:
        'LRO’s narrow-angle camera on 3 March 2025, looking straight down, 1,040 m across: the lander beside the rim of a 12 m crater, easy to spot by its shadow. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2025-03-03',
      sourceUrl: 'https://lroc.im-ldi.com/images/1407',
    }),
    sitePhoto(ID_BG, 'lro-overview', 640, 640, {
      title: 'Its corner of Mare Crisium',
      caption:
        'A wider, reduced view, 4,160 m across: the lander at the small arrow, a volcanic depression at upper left and the cone of Mons Latreille at lower right.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2025-03-03',
      sourceUrl: 'https://lroc.im-ldi.com/images/1407',
    }),
    sitePhoto(ID_BG, 'lro-before-after', 640, 318, {
      title: 'Before and after',
      caption: 'The site on 17 January 2021 and on 3 March 2025: the lander appears, and round it the ground its engine plume disturbed.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2021-01-17 and 2025-03-03',
      sourceUrl: 'https://lroc.im-ldi.com/images/1407',
    }),
    sitePhoto(ID_BG, 'lro-oblique', 640, 640, {
      title: 'Looking back toward the Sun',
      caption:
        'From 65 km west, LRO tilted 39°, with the Sun low beyond the scene — a phase angle of 113° that makes the ground glow and the lander, in the zoomed box, hard to pick out. 1,300 m across.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'released 2025-03-21',
      sourceUrl: 'https://lroc.im-ldi.com/images/1410',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_BG, ['lroc1407']),
    {
      title: 'Its mission',
      text: 'Landed 2 March 2025; all ten NASA instruments worked on the surface; more than 14 days of operations, 346 hours of daylight; 119 GB of data sent home; the last received about 23:15 UT on 16 March.',
      cite: ['firefly2025'],
    },
  ],
  estimated: [],
  missing: [
    { title: 'The craft itself', text: 'Not drawn: a mark stands for the lander.' },
    ownImagesMissing('Blue Ghost’s own photographs, its eclipse and its sunset among them, are Firefly Aerospace’s, and no licence clearly free to reuse with credit was found for them.'),
  ],
  misconceptions: [NO_TELESCOPE],
  sources: [
    { key: 'lroc1407', text: 'LROC team 2025, Blue Ghost Lunar Lander Seen From Above', url: 'https://lroc.im-ldi.com/images/1407' },
    { key: 'firefly2025', text: 'Firefly Aerospace 2025, Firefly Aerospace Successfully Completes 14 Days of Surface Operations on the Moon', url: 'https://fireflyspace.com/news/firefly-aerospace-successfully-completes-14-days-of-surface-operations-on-the-moon/' },
    SITE_SOURCES.robinson2010,
  ],
};
