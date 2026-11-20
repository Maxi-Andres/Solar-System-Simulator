import type { Description } from '../types.ts';
import { LROC_CREDIT, LROC_LICENCE, NO_TELESCOPE, ownImagesMissing, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

/** China's landers photographed themselves and their ground; those images are not shown. */
const CNSA_IMAGES = ownImagesMissing(
  'the lander’s and the rover’s photographs are released by the China National Space Administration, and no licence clearly free to reuse with credit was found for them.',
);

const ID_3 = 'site-change-3';

/** Chang'e 3: the first soft landing on the Moon in thirty-seven years. */
export const CHANGE_3: Description = {
  id: ID_3,
  lead: [
    'For thirty-seven years, from 1976 to 2013, nothing landed gently on the Moon. Chang’e 3 broke the silence: China’s first lander, with its first rover, Yutu, the Jade Rabbit of Chinese legend who lives on the Moon.',
    'It touched down on 14 December 2013 on the northern Mare Imbrium, about 60 m east of the rim of a young crater 450 m across — a place no mission had sampled before. Yutu rolled off, drove round the lander and away across the crater’s ejecta, 114 m in all, photographing the boulders thrown out of it, until a fault left it unable to move.',
    'Yutu carried a radar that looked down through the ground as it drove. It found more than nine layers beneath the plain, the record of lava flows and impacts laid one on another since the Imbrian age: geology different from that of any Apollo or Luna site.',
    'LRO found the pair ten days after landing, the rover two bright pixels and a shadow. Over the next months it watched Yutu move round the lander and stop 17 m south-west of it, both in the bright patch the landing engine had blasted clean.',
  ],
  photos: [
    sitePhoto(ID_3, 'lro-2013', 576, 576, {
      title: 'The lander and Yutu, Christmas 2013',
      caption:
        'LRO’s narrow-angle camera on 25 December 2013, from about 150 km up, just before local sunset: the lander at the large arrow, the rover at the small one. Yutu, about 1.5 m wide, shows as two pixels because its solar panels reflect so well. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2013-12-25',
      sourceUrl: 'https://lroc.im-ldi.com/images/637',
    }),
    sitePhoto(ID_3, 'lro-four-views', 640, 640, {
      title: 'Four visits',
      caption:
        'The same patch of ground before the landing (30 June 2013), and on 25 December 2013, 21 January and 17 February 2014: the lander appears, and the rover moves round it.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2013-06-30 to 2014-02-17',
      sourceUrl: 'https://lroc.im-ldi.com/images/751',
    }),
    sitePhoto(ID_3, 'lro-yutu-2014', 600, 600, {
      title: 'Where Yutu stopped',
      caption:
        'February 2014: the lander at the blue arrow, Yutu at the yellow one, 17 m to its south-west, and at the white arrow where Yutu stood in December. The bright streak running north–south is ground swept by the landing engine.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2014-02-17',
      sourceUrl: 'https://lroc.im-ldi.com/images/751',
    }),
    sitePhoto(ID_3, 'lro-oblique', 640, 815, {
      title: 'From the side',
      caption:
        'On 16 February 2014 LRO turned 54° to the east to look at the site obliquely: the arrows mark Chang’e 3 on the plain beside its crater.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2014-02-16',
      sourceUrl: 'https://lroc.im-ldi.com/images/751',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_3, ['wagner2017', 'lroc637']),
    {
      title: 'Yutu’s drive and its radar',
      text: '114 m across the crater’s ejecta; beneath the plain, more than nine layers.',
      cite: ['xiao2015'],
    },
    {
      title: 'Where Yutu stopped',
      text: '17 m south-west of the lander, seen from LRO in January and February 2014; it had not moved between the two.',
      cite: ['lroc751'],
    },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for the lander and Yutu.' }, CNSA_IMAGES],
  misconceptions: [NO_TELESCOPE],
  sources: [
    SITE_SOURCES.wagner2017,
    { key: 'lroc637', text: 'LROC team 2013, Chang’e 3 Lander and Rover From Above', url: 'https://lroc.im-ldi.com/images/637' },
    {
      key: 'xiao2015',
      text: 'Xiao, L., et al. 2015, A young multilayered terrane of the northern Mare Imbrium revealed by Chang’E-3 mission, Science 347, 1226',
      url: 'https://doi.org/10.1126/science.1259866',
    },
    { key: 'lroc751', text: 'LROC team 2014, Chang’e 3 and Yutu from above, four views', url: 'https://lroc.im-ldi.com/images/751' },
    SITE_SOURCES.robinson2010,
  ],
};

const ID_4 = 'site-change-4';

/** Chang'e 4: the first landing on the far side, the side never seen from Earth. */
export const CHANGE_4: Description = {
  id: ID_4,
  lead: [
    'Half the Moon can never be seen from Earth, and until 2019 nothing had set down there gently: with Earth always below the horizon, a lander on the far side cannot talk to it. Chang’e 4 went anyway, speaking to Earth through a relay satellite placed beyond the Moon, and on 3 January 2019 became the first craft to land on the far side.',
    'It came down on the floor of Von Kármán, a crater 186 km across inside the South Pole–Aitken basin, about 2,500 km across: the largest, deepest and oldest impact basin known on the Moon, deep enough perhaps to have dug up its mantle. Its rover, Yutu-2, drove off to look.',
    'Yutu-2’s spectrometer found low-calcium pyroxene and olivine in the soil — minerals that may come from the Moon’s mantle, thrown out by the impact that made the nearby crater Finsen, 72 km across. By the end of February 2019 it was 69 m from the lander, and it kept on driving.',
    'LRO first saw the lander from 330 km away, looking sideways across the crater’s floor to its 3,000 m western wall; then from overhead, the rover’s shadow beside it.',
  ],
  photos: [
    sitePhoto(ID_4, 'lro-oblique', 640, 640, {
      title: 'The first look, from 330 km',
      caption:
        'On 30 January 2019 LRO, rolled 70° to the west, looked across the floor of Von Kármán from 330 km away: the lander is the bright speck between the arrows, the crater’s west wall rising more than 3,000 m behind. Reduced more than tenfold.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2019-01-30',
      sourceUrl: 'https://lroc.im-ldi.com/images/1090',
    }),
    sitePhoto(ID_4, 'lro-oblique-close', 640, 640, {
      title: 'The same view, at full resolution',
      caption:
        'A full-resolution crop of that oblique image, centred on the lander, which is only about two pixels across from so far away.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2019-01-30',
      sourceUrl: 'https://lroc.im-ldi.com/images/1090',
    }),
    sitePhoto(ID_4, 'lro-yutu-2-2019', 640, 640, {
      title: 'Yutu-2 on the move',
      caption:
        'The site before the landing (8 December 2018), twice on 1 February 2019 from different angles, and on 28 February with the Sun low and long shadows: the lander, and Yutu-2 at the arrow, 69 m from it by then.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2018-12-08 to 2019-02-28',
      sourceUrl: 'https://lroc.im-ldi.com/images/1096',
    }),
    sitePhoto(ID_4, 'lro-topography', 640, 640, {
      title: 'The ground’s height',
      caption:
        'A height map made from a pair of LRO images taken from different angles, coloured by elevation — red high, blue low — over shaded relief; the arrow marks the lander. The colours are a scale, not the ground’s.',
      colour: 'false',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2019-02-01 (released 2019-04-30)',
      sourceUrl: 'https://lroc.im-ldi.com/images/1100',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_4, ['lroc1100'], 'From a pair of LRO images taken on 1 February 2019; about 3 m.'),
    {
      title: 'What Yutu-2 found',
      text: 'Low-calcium pyroxene and olivine, in the first spectra from its infrared spectrometer: possibly mantle rock, thrown out by the impact that made the crater Finsen.',
      cite: ['li2019'],
    },
    { title: 'Its first month', text: 'By 28 February 2019 Yutu-2 was 69 m from the lander.', cite: ['lroc1096'] },
    {
      title: 'Seen from orbit',
      text: 'First on 30 January 2019, by LRO rolled 70° and 330 km to the east, the lander two pixels across; then from overhead on 1 February.',
      cite: ['lroc1090', 'lroc1100'],
    },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for the lander; Yutu-2 is not marked.' }, CNSA_IMAGES],
  misconceptions: [
    {
      title: 'The far side is not dark',
      text: 'It gets as much sunlight as the near side; it is only out of Earth’s view. Chang’e 4 landed in daylight there.',
    },
    NO_TELESCOPE,
  ],
  sources: [
    { key: 'lroc1100', text: 'LROC team 2019, Chang’e 4 lander coordinates and topography', url: 'https://lroc.im-ldi.com/images/1100' },
    {
      key: 'li2019',
      text: 'Li, C., et al. 2019, Chang’E-4 initial spectroscopic identification of lunar far-side mantle-derived materials, Nature 569, 378',
      url: 'https://doi.org/10.1038/s41586-019-1189-0',
    },
    { key: 'lroc1096', text: 'LROC team 2019, Chang’e 4 Rover on the Move', url: 'https://lroc.im-ldi.com/images/1096' },
    { key: 'lroc1090', text: 'LROC team 2019, First Look: Chang’e 4', url: 'https://lroc.im-ldi.com/images/1090' },
    SITE_SOURCES.robinson2010,
  ],
};

const ID_5 = 'site-change-5';

/** Chang'e 5: the first rock brought back from the Moon in forty-four years, and the youngest. */
export const CHANGE_5: Description = {
  id: ID_5,
  lead: [
    'The Moon’s rocks tell its age, but only where someone has picked them up: before 2020 every sample came from a handful of places visited before 1977. Chang’e 5 went to one of the youngest-looking lava plains on the Moon to bring back a piece of it.',
    'It landed at 15:11 UT on 1 December 2020 on the basalt plains of the north-eastern Ocean of Storms. It scooped and drilled its samples, loaded them into an ascent stage, and on 3 December that stage blasted off to meet the orbiter, which carried the samples home: 1,731 g, landing in China on 17 December.',
    'The rock was young indeed. Fragments of basalt crystallised 2,030 million years ago, give or take four million: the youngest lunar lava yet dated, stretching the Moon’s known volcanism by 800 to 900 million years, long after it was thought to have gone quiet.',
    'The descent stage stands where it landed. LRO found it the day after landing, and saw it again in 2021 without the ascent stage on its back.',
  ],
  photos: [
    sitePhoto(ID_5, 'lro-2020', 640, 640, {
      title: 'Chang’e 5, the day after landing',
      caption:
        'LRO’s narrow-angle camera on 2 December 2020, looking 13° off to the side: the lander is the bright spot in the box, on the dark basalt plains. 1,210 m across. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2020-12-02',
      sourceUrl: 'https://lroc.im-ldi.com/images/1172',
    }),
    sitePhoto(ID_5, 'lro-ascent-gone', 640, 320, {
      title: 'Before and after the ascent stage left',
      caption:
        'Left, the lander with its ascent stage on top, Sun 47° from overhead; right, the descent stage left behind, Sun low at 80°, its shadow long. Both at 1.2 m a pixel.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2020-12-02 and 2021-02-07',
      sourceUrl: 'https://lroc.im-ldi.com/images/1186',
    }),
    sitePhoto(ID_5, 'lro-sunset-2021', 640, 640, {
      title: 'The descent stage at sunset',
      caption: 'Just before sunset on 7 February 2021: what is left of Chang’e 5, at the arrow, casting a long shadow.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2021-02-07',
      sourceUrl: 'https://lroc.im-ldi.com/images/1186',
    }),
    sitePhoto(ID_5, 'lro-context', 640, 640, {
      title: 'The plain round it',
      caption: 'LRO’s wide-angle camera over 61 km of the plain, the landing site in the white box.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'released 2020-12-04',
      sourceUrl: 'https://lroc.im-ldi.com/images/1172',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_5, ['lroc1172'], 'To ±20 m.'),
    { title: 'What came back', text: '1,731 g of lunar rock and soil.', cite: ['nao2020'] },
    { title: 'Its age', text: 'Basalt crystallised 2,030 ± 4 million years ago, by lead–lead dating: the youngest lunar lava dated from a sample.', cite: ['liql2021'] },
    { title: 'The ascent stage', text: 'Gone from the site after 3 December 2020; LRO’s later images show the descent stage alone.', cite: ['lroc1186'] },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for the descent stage.' }, CNSA_IMAGES],
  misconceptions: [NO_TELESCOPE],
  sources: [
    { key: 'lroc1172', text: 'LROC team 2020, First Look: Chang’e 5', url: 'https://lroc.im-ldi.com/images/1172' },
    { key: 'nao2020', text: 'National Astronomical Observatories, Chinese Academy of Sciences 2020, China’s Chang’e-5 retrieves 1,731 grams of moon samples', url: 'https://english.nao.cas.cn/ne2015/News2015/202012/t20201221_260671.html' },
    {
      key: 'liql2021',
      text: 'Li, Q.-L., et al. 2021, Two-billion-year-old volcanism on the Moon from Chang’e-5 basalts, Nature 600, 54',
      url: 'https://doi.org/10.1038/s41586-021-04100-2',
    },
    { key: 'lroc1186', text: 'LROC team 2021, Chang’e 5: After Blast Off', url: 'https://lroc.im-ldi.com/images/1186' },
    SITE_SOURCES.robinson2010,
  ],
};

const ID_6 = 'site-change-6';

/** Chang'e 6: the first rock ever brought back from the far side. */
export const CHANGE_6: Description = {
  id: ID_6,
  lead: [
    'Every sample brought back from the Moon before 2024 came from the side that faces us. Chang’e 6 went to the other side, to the oldest and largest basin on the Moon, and brought back the first rock from the half no one on Earth has ever seen in the sky.',
    'It landed on 1 June 2024 on a lava plain at the southern edge of the Apollo basin, 492 km across, itself inside the vast South Pole–Aitken basin. Talking to Earth through a relay satellite, it scooped and drilled its samples, launched them from an ascent stage on its back, and the orbiter brought them home: 1,935.3 g.',
    'Most of the basalt in them erupted 2,807 million years ago — an age not found among the near side’s samples — and one fragment 4,203 million years ago, the oldest basalt yet dated among returned samples. The far side was volcanic for at least 1.4 billion years.',
    'LRO found the lander a week after it came down, on the rim of a worn crater about 50 m wide, in a halo of ground brightened by its engine.',
  ],
  photos: [
    sitePhoto(ID_6, 'lro-2024', 640, 640, {
      title: 'Chang’e 6 in the Apollo basin',
      caption:
        'LRO’s narrow-angle camera on 7 June 2024, enlarged twice: the lander is the small cluster of bright pixels at the centre, on the rim of an eroded crater about 50 m across. 552 m wide, north up. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2024-06-07',
      sourceUrl: 'https://lroc.im-ldi.com/images/1374',
    }),
    sitePhoto(ID_6, 'lro-before-after', 640, 318, {
      title: 'Before and after',
      caption:
        'The same ground on 3 March 2022 and on 7 June 2024: the lander, and round it the brighter patch where its engine swept the surface.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2022-03-03 and 2024-06-07',
      sourceUrl: 'https://lroc.im-ldi.com/images/1374',
    }),
    sitePhoto(ID_6, 'lro-colour-context', 640, 619, {
      title: 'The landing region in stretched colour',
      caption:
        'LRO’s wide-angle colour mosaic over 190 km, its colours stretched to bring out differences in the rock that an eye could hardly see: the dark lava plain where Chang’e 6 landed shows as a different hue from the older ground round it. 100 m height contours.',
      colour: 'false',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: 'released 2024-06-14',
      sourceUrl: 'https://lroc.im-ldi.com/images/1374',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID_6, ['lroc1374'], 'To ±30 m.'),
    { title: 'What came back', text: '1,935.3 g, the first samples from the far side.', cite: ['li2024'] },
    {
      title: 'Its ages',
      text: 'Basalt from two eruptions, dated by lead–lead: the main one 2,807 ± 3 million years ago, one fragment 4,203 ± 4 million.',
      cite: ['zhang2025'],
    },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for the descent stage.' }, CNSA_IMAGES],
  misconceptions: [NO_TELESCOPE],
  sources: [
    { key: 'lroc1374', text: 'LROC team 2024, Chang’e 6 landing site', url: 'https://lroc.im-ldi.com/images/1374' },
    {
      key: 'li2024',
      text: 'Li, C., et al. 2024, Nature of the lunar far-side samples returned by the Chang’E-6 mission, Natl Sci. Rev. 11, nwae328',
      url: 'https://doi.org/10.1093/nsr/nwae328',
    },
    {
      key: 'zhang2025',
      text: 'Zhang, Q. W. L., et al. 2025, Lunar farside volcanism 2.8 billion years ago from Chang’e-6 basalts, Nature 643, 356',
      url: 'https://doi.org/10.1038/s41586-024-08382-0',
    },
    SITE_SOURCES.robinson2010,
  ],
};
