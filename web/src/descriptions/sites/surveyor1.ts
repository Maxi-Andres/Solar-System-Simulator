import type { Description } from '../types.ts';
import { LROC_CREDIT, NASA_LICENCE, NO_TELESCOPE, PHOTOJOURNAL_LICENCE, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

const ID = 'site-surveyor-1';

/** Surveyor 1: America's first soft landing, and the ground Apollo would stand on. */
export const SURVEYOR_1: Description = {
  id: ID,
  lead: [
    'Before anyone could walk on the Moon, someone had to find out whether it would hold them. Some thought its plains might be deep dust that would swallow a lander. Surveyor 1, a three-legged robot with a television camera, settled onto it gently and answered the question with its own feet.',
    'It came down on 2 June 1966 at 06:17:36 UT, at about 3 m/s, on a flat plain inside a 100 km crater north of Flamsteed, in the south-west of the Ocean of Storms: the first American craft to land softly on another world, four months after the Soviet Luna 9. Thirty-six minutes later it sent back its first picture, showing part of itself, one of its footpads, and the dark soil the pad had pressed into.',
    'Through the long lunar day it photographed its footpads and its surroundings, measured how the ground took its weight and reflected radar, and recorded its own temperatures: 10,338 pictures before nightfall on 14 June. It survived the cold of the night, took more pictures on its second day, and fell silent when its battery failed after the second sunset, on 13 July; engineers kept calling it until January 1967. In all it sent 11,240 pictures.',
    'It sits where it landed, a speck with a long shadow in LRO’s images. The ground it tested held the Apollo landers three years later.',
  ],
  photos: [
    sitePhoto(ID, 'footpad', 424, 425, {
      title: 'Its own footpad',
      caption:
        'Surveyor 1’s camera looking down at one of its footpads where it pressed into the soil: the ground was firm enough to hold a lander. A television picture, black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: NASA_LICENCE,
      date: '1966-06',
      sourceUrl: 'https://www.nasa.gov/feature/55-years-ago-surveyor-1-makes-a-soft-landing-on-the-moon',
    }),
    sitePhoto(ID, 'mosaic', 640, 420, {
      title: 'Its view of the Ocean of Storms',
      caption:
        'Many of its television frames pasted onto a curved surface, as mosaics were made then: the plain round the lander to the horizon, with parts of the spacecraft at the edge.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: NASA_LICENCE,
      date: '1966-06',
      sourceUrl: 'https://www.nasa.gov/feature/55-years-ago-surveyor-1-makes-a-soft-landing-on-the-moon',
    }),
    sitePhoto(ID, 'colour', 640, 743, {
      title: 'A colour picture, from three filters',
      caption:
        'Three exposures through red, green and blue filters combined into one. The yellow-green cast is the combination’s, not the Moon’s, whose ground is grey; the white rod is part of the spacecraft.',
      colour: 'tinted',
      credit: 'NASA/JPL',
      licence: NASA_LICENCE,
      date: '1966-06',
      sourceUrl: 'https://www.nasa.gov/feature/55-years-ago-surveyor-1-makes-a-soft-landing-on-the-moon',
    }),
    sitePhoto(ID, 'shadow', 640, 636, {
      title: 'Its shadow at the end of the day',
      caption:
        'In the late lunar afternoon the lander photographed its own long shadow across the ground, the horizon at upper right, as its first night came on.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: NASA_LICENCE,
      date: '1966-06',
      sourceUrl: 'https://images.nasa.gov/details/PIA02976',
    }),
    sitePhoto(ID, 'lro-2009', 640, 640, {
      title: 'Surveyor 1 from LRO',
      caption:
        'LRO’s narrow-angle camera, 2009: the lander, arrowed, a bright point with a shadow on the plain, 43 years after it landed. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2009-09-30',
      sourceUrl: 'https://images.nasa.gov/details/PIA12910',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID, ['wagner2017']),
    {
      title: 'The landing',
      text: 'On 2 June 1966 at 06:17:36 UT, at about 3 m/s, on the plain inside a 100 km crater north of Flamsteed, in the Ocean of Storms.',
      cite: ['nssdcaS1'],
    },
    {
      title: 'What it measured',
      text: 'The bearing strength of the soil and its radar reflectivity, and its own temperatures; 11,240 pictures over two lunar days, the last on 13 July 1966.',
      cite: ['nssdcaS1', 'nasaS1'],
    },
  ],
  estimated: [],
  missing: [{ title: 'The craft itself', text: 'Not drawn: a mark stands for the lander.' }],
  misconceptions: [
    {
      title: 'Luna 9 landed first',
      text: 'Surveyor 1 was the first American soft landing, not the first: the Soviet Luna 9 had landed in February 1966 and sent the first pictures from the surface.',
    },
    NO_TELESCOPE,
  ],
  sources: [
    SITE_SOURCES.wagner2017,
    {
      key: 'nssdcaS1',
      text: 'NASA Space Science Data Coordinated Archive, Surveyor 1',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1966-045A',
    },
    { key: 'nasaS1', text: 'NASA History 2021, 55 Years Ago: Surveyor 1 Makes a Soft Landing on the Moon', url: 'https://www.nasa.gov/feature/55-years-ago-surveyor-1-makes-a-soft-landing-on-the-moon' },
    SITE_SOURCES.robinson2010,
  ],
};
