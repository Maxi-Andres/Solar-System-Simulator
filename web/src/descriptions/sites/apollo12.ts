import type { Description } from '../types.ts';
import { LROC_CREDIT, LROC_LICENCE, NASA_LICENCE, NO_TELESCOPE, PHOTOJOURNAL_LICENCE, SITE_MARK, SITE_SOURCES, sitePhoto, wherePoint } from './shared.ts';

const ID = 'site-apollo-12';

/** The Ocean of Storms, where Apollo 12 landed on purpose beside a robot. */
export const APOLLO_12: Description = {
  id: ID,
  lead: [
    'The first landing showed it could be done; the second showed it could be done on purpose. Four months after Apollo 11, Pete Conrad set Intrepid down within walking distance of a robot that had been waiting on the Moon for two and a half years — the moment people stopped merely reaching the Moon and began to go to particular places on it.',
    'Apollo 12 landed in the Ocean of Storms at 06:54:35 UT on 19 November 1969, about 180 m from Surveyor 3, which had come down on 19 April 1967. Conrad and Alan Bean went out twice, for 7 hours 45 minutes in all, while Richard Gordon orbited in the command module. They set up the first ALSEP, a six-instrument station — seismometer, magnetometer, solar-wind spectrometer and more — powered by a nuclear generator, and gathered 34.35 kg of rock and soil.',
    'On their second walk they went to Surveyor 3 and cut off pieces of it, about 10 kg in all, its television camera among them, for scientists on Earth to examine after two and a half years on the Moon. Their own colour television camera had failed on the first day: pointed at the Sun while being set up, its tube was burnt out. After 31 hours 31 minutes on the surface they left, and their emptied ascent stage was sent crashing into the Moon for the seismometer to hear.',
    'Intrepid’s descent stage, the ALSEP and Surveyor 3 are there still. LRO sees all three, the trails between them, and the shadow of the flag, which still stands.',
  ],
  photos: [
    sitePhoto(ID, 'surveyor-3', 640, 640, {
      title: 'Conrad at Surveyor 3, Intrepid behind',
      caption:
        'Two craft on the Moon in one frame: Conrad examining the television camera of Surveyor 3 before cutting it off, and on the horizon, about 180 m away, Intrepid. Bean took it. The colours are those of the film; the scene is nearly without colour.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-11-20',
      sourceUrl: 'https://images.nasa.gov/details/AS12-48-7133',
    }),
    sitePhoto(ID, 'bean', 640, 640, {
      title: 'Bean with a sample container',
      caption:
        'Bean holds a sealed container of lunar soil; Conrad, who took the picture, is reflected in his visor with the lander and the shadowed ground. The hard edges of light and shadow are what sunlight looks like with no air to soften it.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-11-19/20',
      sourceUrl: 'https://images.nasa.gov/details/AS12-49-7278',
    }),
    sitePhoto(ID, 'alsep', 640, 640, {
      title: 'Setting out the ALSEP',
      caption:
        'Bean deploying the experiment station on the first walk, photographed by Conrad, whose shadow fills the foreground. The station ran on a nuclear generator and radioed its readings to Earth.',
      colour: 'true',
      credit: 'NASA',
      licence: NASA_LICENCE,
      date: '1969-11-19',
      sourceUrl: 'https://images.nasa.gov/details/as12-47-6919',
    }),
    sitePhoto(ID, 'lro-2011', 640, 554, {
      title: 'The site from 25 km up',
      caption:
        'LRO’s narrow-angle camera from its low orbit of late 2011, at about 25 cm a pixel, labelled by the LROC team: Intrepid’s descent stage, the ALSEP, Surveyor 3 in its crater and the craters the two men walked to, joined by the darker threads of their trails. Black and white, as the camera sees.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: LROC_LICENCE,
      date: '2011 (released 2012-03-06)',
      sourceUrl: 'https://lroc.im-ldi.com/images/401',
    }),
    sitePhoto(ID, 'lro-2009', 640, 640, {
      title: 'Midday on the Ocean of Storms, 2009',
      caption:
        'The same site from LRO’s ordinary mapping orbit with the Sun high: shadows almost gone, the hardware shows as bright points and the ground the astronauts disturbed as subtle changes of brightness.',
      colour: 'true',
      credit: LROC_CREDIT,
      licence: PHOTOJOURNAL_LICENCE,
      date: 'released 2009-11-04',
      sourceUrl: 'https://images.nasa.gov/details/PIA12922',
    }),
  ],
  drawnHere: [SITE_MARK],
  measured: [
    wherePoint(ID, ['wagner2017']),
    {
      title: 'The landing',
      text: 'Touchdown 06:54:35 UT on 19 November 1969, about 180 m from Surveyor 3. Two walks, 7 h 45 min in all; liftoff 14:25:47 UT on 20 November, after 31 h 31 min on the Moon.',
      cite: ['nssdcaA12'],
    },
    {
      title: 'What came back',
      text: '34.35 kg of rock and soil, and about 10 kg of Surveyor 3.',
      cite: ['nssdcaA12'],
    },
    {
      title: 'Seen from orbit',
      text: 'In LRO’s low-altitude images of 2011, at 25 cm a pixel, the ALSEP’s cables show as a bright L: too thin to resolve, but bright because they reflect sunlight so well.',
      cite: ['lroc401', 'asu2011'],
    },
    {
      title: 'The flag stands',
      text: 'It casts a shadow in a sequence of five LRO images taken at different times of day, the shadow swinging round it as the Sun moves.',
      cite: ['fincannon2012'],
    },
  ],
  estimated: [
    {
      title: 'Its colours',
      text: 'Probably bleached white by half a century of unfiltered sunlight: a flag standing is seen from orbit, its colours cannot be.',
      cite: ['fincannon2012'],
    },
  ],
  missing: [{ title: 'The craft itself', text: 'Not drawn: one mark stands for Intrepid’s descent stage, the ALSEP and Surveyor 3.' }],
  misconceptions: [NO_TELESCOPE],
  sources: [
    SITE_SOURCES.wagner2017,
    {
      key: 'nssdcaA12',
      text: 'NASA Space Science Data Coordinated Archive, Apollo 12 Lunar Module / ALSEP',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-099C',
    },
    { key: 'lroc401', text: 'LROC team 2012, Pinpoint Landing on the Ocean of Storms', url: 'https://lroc.im-ldi.com/images/401' },
    {
      key: 'asu2011',
      text: 'Arizona State University 2011, New LROC images offer sharper views of Apollo 12, 14, 17 sites',
      url: 'https://news.asu.edu/content/new-lroc-images-offer-sharper-views-apollo-12-14-17-sites',
    },
    SITE_SOURCES.fincannon2012,
    SITE_SOURCES.robinson2010,
  ],
};
