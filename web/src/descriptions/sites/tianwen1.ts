import type { Description } from '../types.ts';
import { marsSiteDrawn } from './marsCommon.ts';

/**
 * Tianwen-1's lander and the Zhurong rover, in southern Utopia Planitia. Every fact from the
 * source it cites: the mission's papers, HiRISE's captions and the news of its end.
 */
export const TIANWEN_1: Description = {
  id: 'site-tianwen-1',
  lead: [
    'Forty-five years after Viking 2 looked out over Utopia Planitia, another lander came down on the same great plain, from another country. In May 2021 China, on its first mission to Mars, set down a lander and sent a rover named Zhurong, after the god of fire in Chinese mythology, rolling south across the ground — new eyes, and new questions, on the same red plain.',
    'Tianwen-1 was the China National Space Administration’s mission: an orbiter, a lander and a rover sent together. The lander touched down on 15 May 2021, Beijing time (late on the 14th by Universal Time), in southern Utopia Planitia, near the boundary between Mars’s northern lowlands and southern highlands and near what may be the shorelines of an ancient sea.',
    'Zhurong, about 240 kg, drove 1,921 metres south over 358 days. Its ground-penetrating radar saw some 70 metres of layered rock under less than 10 metres of soil, read as the deposits of repeated floods filling the Utopia basin; its spectrometer found bright crusts holding hydrated sulphates and silica, signs that water — rising groundwater or melting ice — had worked on this young terrain more recently than was thought.',
    'In May 2022, with winter coming, it went into a planned sleep. It was meant to wake that December and never did: NASA’s orbiter saw it standing in the same place from September 2022 to February 2023, and in April 2023 its chief designer said dust on its solar panels had most likely kept it from waking. The lander, the rover and the parachute that brought them down are all still there.',
  ],
  photos: [
    {
      file: 'photos/sites/site-tianwen-1/hirise-lander-rover-2021-06-06.webp',
      largeFile: 'photos/sites/site-tianwen-1/hirise-lander-rover-2021-06-06-large.webp',
      width: 640,
      height: 254,
      title: 'The lander and Zhurong from orbit, 6 June 2021',
      caption:
        'From NASA’s Mars Reconnaissance Orbiter, three weeks after landing: the lander in the middle of the pale blast pattern its engines made, and Zhurong a little to the south, having driven down from it. The bright curves are wind-blown ridges. HiRISE’s enhanced colour, which includes infrared.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/UArizona',
      licence: 'HiRISE images are in the public domain',
      date: '2021-06-06',
      sourceUrl: 'https://www.uahirise.org/ESP_069665_2055',
    },
    {
      file: 'photos/sites/site-tianwen-1/hirise-lander-rover-2021-06-11.webp',
      largeFile: 'photos/sites/site-tianwen-1/hirise-lander-rover-2021-06-11-large.webp',
      width: 640,
      height: 423,
      title: 'Five days later, 11 June 2021',
      caption:
        'The same place again: the landing site still coloured where the landing blew the dust away, and Zhurong, the dark dot below, moved farther south. HiRISE’s enhanced colour.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/UArizona',
      licence: 'HiRISE images are in the public domain',
      date: '2021-06-11',
      sourceUrl: 'https://www.uahirise.org/ESP_069731_2055',
    },
    {
      file: 'photos/sites/site-tianwen-1/hirise-rover-2022-2023.webp',
      largeFile: 'photos/sites/site-tianwen-1/hirise-rover-2022-2023-large.webp',
      width: 640,
      height: 400,
      title: 'Zhurong not moving, 2022–2023',
      caption:
        'Three HiRISE pictures of the rover, the small dark, bluish spot: on 11 March 2022, near the top; and on 8 September 2022 and 7 February 2023, in the same place lower down. It had moved between March and September, and not since. HiRISE colour.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/UArizona',
      licence: 'HiRISE images are in the public domain',
      date: '2023-02-07',
      sourceUrl: 'https://www.uahirise.org/ESP_077511_2055',
    },
    {
      file: 'photos/sites/site-tianwen-1/hirise-terrain-south.webp',
      largeFile: 'photos/sites/site-tianwen-1/hirise-terrain-south-large.webp',
      width: 640,
      height: 400,
      title: 'Where it was heading',
      caption:
        'Terrain of southern Utopia Planitia of the kind Zhurong would meet driving south: a crater, and bright ridges of wind-blown material. HiRISE, 25 cm a pixel. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2021-09-29',
      sourceUrl: 'https://images.nasa.gov/details/PIA24914',
    },
  ],
  drawnHere: [
    {
      title: 'Where the mark stands',
      text: 'At 25.066° N, 109.925° E, IAU 2000: the lander, located from landmarks in its own first panorama matched to the Tianwen-1 orbiter’s images, refined with the descent images, and checked against a later orbital image showing lander and rover — to within one pixel of that orbital map. It appears from the moment of touchdown on.',
      cite: ['wan2021'],
    },
    {
      title: 'Zhurong is not marked',
      text: 'Where it stopped has not been published as coordinates, so only the lander’s mark is here; the rover sits about 1.9 km of driving to the south.',
      cite: ['reuters2023'],
    },
    ...marsSiteDrawn('The lander, Zhurong, the heat shield and the back shell with its parachute are not drawn.'),
  ],
  measured: [
    {
      title: 'Landing',
      text: 'On 15 May 2021, Beijing time, in southern Utopia Planitia, at an elevation of −4,099.4 m, near the boundary between the lowlands and highlands and near several suspected ancient shorelines.',
      cite: ['wan2021', 'liu2021'],
    },
    {
      title: 'China’s first Mars mission',
      text: 'Tianwen-1 was China’s first mission to Mars: an orbiter, a lander and the rover Zhurong, named for the god of fire in Chinese mythology.',
      cite: ['wan2021', 'pia24914'],
    },
    {
      title: 'Zhurong',
      text: '240 kg. Planned for three months, it explored for 358 days and drove 1,921 m before going into a planned hibernation in May 2022.',
      cite: ['reuters2023'],
    },
    {
      title: 'Under the ground',
      text: 'Its ground-penetrating radar, along about 1,171 m of its drive, showed a layered structure about 70 m thick under less than 10 m of loose soil, read as sediment laid down by repeated floods. No liquid water was found in the radar’s reach; salty ice beneath cannot be ruled out.',
      cite: ['li2022'],
    },
    {
      title: 'Water, recently',
      text: 'Its short-wave infrared spectra found hydrated sulphate and silica in bright crusts on rocks of the young, Amazonian terrain, formed with a good deal of liquid water — from groundwater rising or ice beneath melting.',
      cite: ['liu2022'],
    },
    {
      title: 'It did not wake',
      text: 'Expected to wake in December 2022, it did not. HiRISE shows it moved between March and September 2022 and stayed in the same place from 8 September 2022 to 7 February 2023. In April 2023 China’s chief designer for Mars exploration, Zhang Rongqiao, said dust had most likely cut its power too far for it to wake.',
      cite: ['hirise2023', 'reuters2023'],
    },
  ],
  estimated: [],
  missing: [
    {
      title: 'Its own photographs',
      text: 'Not shown: Zhurong and the lander took many pictures, including one of the two of them together, but CNSA’s terms for reusing them could not be confirmed here, so only NASA’s pictures from orbit, which are in the public domain, are on this page.',
    },
    {
      title: 'Where Zhurong stopped',
      text: 'Not published as coordinates; it is visible in HiRISE images, but no position read from them was found published.',
      cite: ['hirise2023'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not where Viking 2 is',
      text: 'Both are in Utopia Planitia, but Viking 2 is at 48° N, 134° E and Tianwen-1 at 25° N, 110° E: about 1,760 km apart, worked out here on the 3,396 km sphere.',
      cite: ['wan2021', 'nssdcVl2'],
    },
  ],
  sources: [
    {
      key: 'wan2021',
      text: 'Wan, W., Yu, T., Di, K., et al. 2021, Visual Localization of the Tianwen-1 Lander Using Orbital, Descent and Rover Images, Remote Sens. 13, 3439',
      url: 'https://doi.org/10.3390/rs13173439',
    },
    {
      key: 'liu2021',
      text: 'Liu, J., Li, C., Zhang, R., et al. 2022, Geomorphic contexts and science focus of the Zhurong landing site on Mars, Nat. Astron. 6, 65',
      url: 'https://doi.org/10.1038/s41550-021-01519-5',
    },
    {
      key: 'li2022',
      text: 'Li, C., Zheng, Y., Wang, X., et al. 2022, Layered subsurface in Utopia Basin of Mars revealed by Zhurong rover radar, Nature 610, 308',
      url: 'https://doi.org/10.1038/s41586-022-05147-5',
    },
    {
      key: 'liu2022',
      text: 'Liu, Y., Wu, X., Zhao, Y.-Y. S., et al. 2022, Zhurong reveals recent aqueous activities in Utopia Planitia, Mars, Sci. Adv. 8, eabn8555',
      url: 'https://doi.org/10.1126/sciadv.abn8555',
    },
    {
      key: 'reuters2023',
      text: 'Reuters 2023, China breaks silence over status of Mars rover Zhurong (Al Jazeera, 25 April 2023)',
      url: 'https://www.aljazeera.com/news/2023/4/25/china-breaks-silence-over-status-of-mars-rover-zhurong',
    },
    {
      key: 'hirise2023',
      text: 'McEwen, A. 2023, Observing the Surface in the Region of the Zhurong Rover, HiRISE (ESP_077511_2055, 21 February 2023)',
      url: 'https://www.uahirise.org/ESP_077511_2055',
    },
    {
      key: 'nssdcVl2',
      text: 'NASA Space Science Data Coordinated Archive, Viking 2 Lander (1975-083C)',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-083C',
    },
    {
      key: 'pia24914',
      text: 'NASA/JPL-Caltech/University of Arizona 2021, PIA24914: The Zhurong Rover Explores Utopia Planitia (caption)',
      url: 'https://science.nasa.gov/photojournal/the-zhurong-rover-explores-utopia-planitia/',
    },
  ],
};
