import { namedSatelliteBodyId } from '../core/satelliteBodies.ts';
import type { Description } from './types.ts';

/**
 * The International Space Station: a named Earth satellite (tools/src/satellites/named.ts),
 * so its body is made at run time and its id is the satellite's. Every number here is from
 * the source it cites; the panel gives its height and the age of its elements now.
 */
export const ISS: Description = {
  id: namedSatelliteBodyId('iss'),
  lead: [
    'Since 2 November 2000 there has not been a single day when everyone was on the ground. The International Space Station has had people living aboard ever since its first crew arrived, so that anyone born since then has never known a moment when all of humanity was on Earth. It was built in orbit, piece by piece, by countries that had once raced each other into space, and it can be seen from the ground, a bright light crossing the sky in a few minutes.',
    'It is a laboratory and home about 400 kilometres up, flown together by the space agencies of the United States, Russia, Europe, Japan and Canada. Its first module, Russia’s Zarya, was launched on 20 November 1998, and dozens of launches added the rest. Today it is 109 metres from end to end — about the length of a football pitch — and weighs about 420 tonnes, with eight solar arrays giving 75 to 90 kilowatts. Inside, its crews have about 388 cubic metres to live in.',
    'It goes round Earth sixteen times a day, at about eight kilometres per second, so its crew see sixteen sunrises and sixteen sunsets every 24 hours. Nearly 3,000 experiments from researchers in more than a hundred countries had been run aboard by 2019: on the human body in weightlessness, on plants, fluids, flames and materials, and in looking down on Earth.',
    'Its crews float not because there is no gravity up there — there is almost nine-tenths as much as on the ground — but because the station and everything in it are falling around the Earth together. The thin air at that height drags on it, so it sinks a little all the time and is pushed back up now and then. Its American, European, Japanese and Canadian partners have committed to running it through 2030, Russia through at least 2028; after that a deorbit vehicle built by SpaceX is to push it down to break apart and burn up in the atmosphere. The panel gives where it is and how high now.',
  ],
  photos: [
    {
      file: 'photos/iss/zarya-unity-1998.webp',
      largeFile: 'photos/iss/zarya-unity-1998-large.webp',
      width: 640,
      height: 423,
      title: 'The first two pieces, 6 December 1998',
      caption:
        'Russia’s Zarya, the first module, approaching Space Shuttle Endeavour, which carries the American node Unity in its bay; the crew then joined the two. The start of the station, over a deck of cloud.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1998-12-06',
      sourceUrl: 'https://images.nasa.gov/details/sts088-341-015',
    },
    {
      file: 'photos/iss/expedition-1-2000.webp',
      largeFile: 'photos/iss/expedition-1-2000-large.webp',
      width: 640,
      height: 427,
      title: 'The first crew at home, 8 December 2000',
      caption:
        'The first resident crew — William Shepherd, Yuri Gidzenko and Sergei Krikalev — with the five astronauts of Space Shuttle Endeavour visiting them, in the Zvezda service module five weeks after they moved in.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2000-12-08',
      sourceUrl: 'https://images.nasa.gov/details/sts097-326-031',
    },
    {
      file: 'photos/iss/station-2011.webp',
      largeFile: 'photos/iss/station-2011-large.webp',
      width: 640,
      height: 425,
      title: 'The station from Endeavour, 29 May 2011',
      caption:
        'Seen from Space Shuttle Endeavour as it backed away at the end of its final flight. The long truss carries the solar arrays.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2011-05-29',
      sourceUrl: 'https://images.nasa.gov/details/s134e010137',
    },
    {
      file: 'photos/iss/station-2018.webp',
      largeFile: 'photos/iss/station-2018-large.webp',
      width: 640,
      height: 427,
      title: 'The station from a Soyuz, 4 October 2018',
      caption:
        'Photographed by a departing crew as their Soyuz flew around it before heading home, against the black of space with Earth’s limb below.',
      colour: 'true',
      credit: 'NASA/Roscosmos',
      licence: 'NASA media, not copyrighted',
      date: '2018-10-04',
      sourceUrl: 'https://images.nasa.gov/details/iss056e201248',
    },
    {
      file: 'photos/iss/cupola-2013.webp',
      largeFile: 'photos/iss/cupola-2013-large.webp',
      width: 640,
      height: 425,
      title: 'The Cupola, 8 December 2013',
      caption:
        'The station’s window on the world: six side windows and one looking straight down at Earth, with the controls for its robotic arm.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2013-12-08',
      sourceUrl: 'https://images.nasa.gov/details/iss038e013587',
    },
    {
      file: 'photos/earth/iss-aurora-2025.webp',
      largeFile: 'photos/earth/iss-aurora-2025-large.webp',
      width: 640,
      height: 427,
      title: 'The southern aurora from the station, 12 June 2025',
      caption:
        'The aurora australis over the Indian Ocean, photographed from about 430 km up: the station flies above it, as the green glow of oxygen is mostly 100 to 250 km above the ground.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2025-06-12',
      sourceUrl: 'https://images.nasa.gov/details/iss073e0247726',
    },
    {
      file: 'photos/sun/iss-transit-2020.webp',
      largeFile: 'photos/sun/iss-transit-2020-large.webp',
      width: 316,
      height: 640,
      title: 'Crossing the Sun, 24 June 2020',
      caption:
        'The station in silhouette against the Sun, photographed from Virginia through a solar filter, which tints the Sun orange.',
      colour: 'tinted',
      credit: 'NASA/Joel Kowsky',
      licence: 'NASA media, not copyrighted',
      date: '2020-06-24',
      sourceUrl: 'https://images.nasa.gov/details/NHQ202006240002',
    },
  ],
  drawnHere: [
    {
      title: 'Its configuration',
      text: 'The model is the station as it was about 2020: modules added since, Russia’s Nauka and Prichal, and the extra roll-out solar arrays, are not on it.',
    },
    {
      title: 'Its height',
      text: 'The panel’s height is SGP4’s, from the latest element set, above the WGS-84 ellipsoid — not its distance from Earth’s centre less one fixed radius, which would be kilometres off because Earth is flattened.',
    },
  ],
  measured: [
    {
      title: 'The first piece and the first crew',
      text: 'Zarya was launched from Baikonur on 20 November 1998, and Endeavour joined Unity to it that December. The first crew — William Shepherd, Yuri Gidzenko and Sergei Krikalev — launched on 31 October 2000 and docked two days later.',
      cite: ['isshistory'],
    },
    {
      title: 'Never empty since',
      text: 'Continuously occupied since November 2000.',
      cite: ['issfacts'],
    },
    {
      title: 'Its size',
      text: '109 m end to end; 419,725 kg; 1,005 m³ pressurised, of which 388 m³ is habitable, visiting vehicles not counted. Eight solar arrays give 75 to 90 kW.',
      cite: ['issfacts'],
    },
    {
      title: 'Its orbit',
      text: 'Sixteen orbits in 24 hours at about 8 km/s, five miles a second, some 400 km up; the panel gives its height now.',
      cite: ['issfacts', 'microgravity'],
    },
    {
      title: 'Gravity up there',
      text: 'At about 400 km Earth’s gravity is 88.8% of its strength at the surface. Its crews are weightless because they are in free fall, as the station is.',
      cite: ['microgravity'],
    },
    {
      title: 'Its science',
      text: 'Nearly 3,000 investigations through Expedition 60, in 2019, from researchers in more than 108 countries.',
      cite: ['issfacts'],
    },
  ],
  estimated: [
    {
      title: 'Its end',
      text: 'The United States, Japan, Canada and ESA’s countries have committed to operating it through 2030, Russia through at least 2028. After that, a US Deorbit Vehicle that SpaceX is building is to bring it down in a controlled re-entry, during which it is expected to break up.',
      cite: ['deorbit'],
    },
  ],
  missing: [
    {
      title: 'Its reboosts',
      text: 'Not known in advance: when it is pushed back up is planned by its controllers, and the elements catch up only afterwards. That is why it is placed only within seven days of its latest elements.',
      cite: ['vallado2006'],
    },
    {
      title: 'Who is aboard',
      text: 'Not shown: the crew and the ships docked change every few months and are in no data the app reads.',
    },
    {
      title: 'Its arrays turning',
      text: 'Not drawn: its solar arrays turn to follow the Sun as it goes round; the model’s are fixed.',
    },
  ],
  misconceptions: [
    {
      title: 'It is not beyond gravity',
      text: 'Gravity at its height is almost nine-tenths of what it is on the ground. Everything aboard floats because it is all falling together, moving sideways so fast that it keeps missing the Earth.',
      cite: ['microgravity'],
    },
    {
      title: 'It is not far away',
      text: 'About 400 km up, a little more than the distance from London to Paris, straight up. The Moon is nearly a thousand times farther.',
      cite: ['microgravity'],
    },
    {
      title: 'It does not stay up by itself',
      text: 'The thin air at that height drags on it, and it would sink and re-enter without the boosts it is given; at the end of its life it will be brought down on purpose.',
      cite: ['deorbit'],
    },
    {
      title: 'It is not one country’s station',
      text: 'It is run by five space agencies, of the United States, Russia, Europe, Japan and Canada, which have each committed to it on their own terms.',
      cite: ['deorbit', 'isshistory'],
    },
  ],
  sources: [
    {
      key: 'issfacts',
      text: 'NASA, Space Station Facts and Figures',
      url: 'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/',
    },
    {
      key: 'isshistory',
      text: 'NASA History 2018, 20 Years Ago: Space Station Construction Begins',
      url: 'https://www.nasa.gov/history/20-years-ago-space-station-construction-begins',
    },
    {
      key: 'microgravity',
      text: 'NASA Glenn Research Center, What is Microgravity?',
      url: 'https://www.nasa.gov/centers-and-facilities/glenn/what-is-microgravity',
    },
    {
      key: 'deorbit',
      text: 'NASA 2024, NASA Selects International Space Station US Deorbit Vehicle (news release, 26 June 2024)',
      url: 'https://www.nasa.gov/news-release/nasa-selects-international-space-station-us-deorbit-vehicle/',
    },
    {
      key: 'vallado2006',
      text: 'Vallado, D. A., Crawford, P., Hujsak, R., & Kelso, T. S. 2006, Revisiting Spacetrack Report #3, AIAA/AAS Astrodynamics Specialist Conference, AIAA 2006-6753 (the SGP4 that satellite.js implements)',
      url: 'https://doi.org/10.2514/6.2006-6753',
    },
  ],
};
