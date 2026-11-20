import { SGR_A_ID } from '../core/blackHoles.ts';
import type { Description } from './types.ts';

/**
 * Sagittarius A*, the black hole at the centre of the Galaxy. A body made at start
 * (core/blackHoles.ts), with S2 on its orbit; the S-stars and the central parsec are
 * core/galacticCentreStars.ts, the lens scene/BlackHoleLens.tsx. Every number here is from the
 * source it cites.
 */
export const SGR_A_STAR: Description = {
  id: SGR_A_ID,
  lead: [
    'The Sun, and every star anyone has ever seen at night, circles the centre of the Milky Way, once in some 230 million years. At that centre, 27,000 light years away, sits a black hole of more than four million times the Sun’s mass — the still point of everything we orbit. No one can see it, and for a long time no one could be sure it was there. We know it is because, for some thirty years, two teams of astronomers watched stars race round an empty-looking point, one of them all the way round in sixteen years, and worked out what must be pulling them. For that, Reinhard Genzel and Andrea Ghez shared the Nobel Prize in Physics in 2020.',
    'It is called Sagittarius A*, “A-star”, after the constellation it lies in. Its light — what little there is — set out 27,000 years ago, and in visible light none of it reaches us at all: the dust of the Galaxy’s disc dims it some trillion times. It is watched in the infrared, in radio waves and in X-rays.',
    'Its mass is packed into a space no larger than our Solar System; the black hole itself, the horizon from which nothing returns, would fit well inside Mercury’s orbit. The star S2, at its closest in May 2018, passed 120 times the Earth–Sun distance from it at 7,650 kilometres a second, and its light came out reddened by the black hole’s gravity just as Einstein’s theory says; its orbit turns, slowly, as the theory says too.',
    'In 2022 the Event Horizon Telescope — eight radio observatories across the Earth working as one telescope the size of the planet — showed its ring: glowing gas round a dark centre, the black hole’s shadow. For all its mass it is a quiet black hole, a starved one: of the gas within its reach, less than one percent ever falls in.',
  ],
  photos: [
    {
      file: 'photos/sgr-a-star/galactic-centre-dss2.webp',
      largeFile: 'photos/sgr-a-star/galactic-centre-dss2-large.webp',
      width: 548,
      height: 560,
      title: 'Toward the centre of the Milky Way',
      caption:
        'The star clouds of Sagittarius, about 3.5 degrees across, from the red and blue plates of the Digitized Sky Survey 2. The Galaxy’s centre is in this direction, but in visible light the dust between hides it completely: the dark lanes are that dust.',
      colour: 'true',
      credit: 'ESO and Digitized Sky Survey 2; acknowledgement: Davide De Martin and S. Guisard',
      licence: 'CC BY 4.0',
      date: '2009-12-11',
      sourceUrl: 'https://www.eso.org/public/images/eso0949l/',
    },
    {
      file: 'photos/sgr-a-star/eht-2022.webp',
      largeFile: 'photos/sgr-a-star/eht-2022-large.webp',
      width: 640,
      height: 640,
      title: 'The first image of Sgr A*, 2022',
      caption:
        'The Event Horizon Telescope’s image from its observations of April 2017: radio light at 1.3 mm from hot gas just outside the black hole, bent round it into a ring about 52 microarcseconds across, round the dark shadow. An average of many reconstructions, since the gas changes within minutes; radio light shown in orange.',
      colour: 'false',
      credit: 'EHT Collaboration',
      licence: 'CC BY 4.0',
      date: '2022-05-12',
      sourceUrl: 'https://www.eso.org/public/images/eso2208-eht-mwa/',
    },
    {
      file: 'photos/sgr-a-star/eht-polarised-2024.webp',
      largeFile: 'photos/sgr-a-star/eht-polarised-2024-large.webp',
      width: 640,
      height: 640,
      title: 'Sgr A* in polarised light, 2024',
      caption:
        'The same ring, with lines showing how its light is polarised — a sign of the magnetic field threading the gas at the black hole’s edge. Radio light, in false colour.',
      colour: 'false',
      credit: 'EHT Collaboration',
      licence: 'CC BY 4.0',
      date: '2024-03-27',
      sourceUrl: 'https://www.eso.org/public/images/eso2406a/',
    },
    {
      file: 'photos/sgr-a-star/gravity-s-stars-2021.webp',
      largeFile: 'photos/sgr-a-star/gravity-s-stars-2021-large.webp',
      width: 640,
      height: 262,
      title: 'Stars round the black hole, March to July 2021',
      caption:
        'Four images from GRAVITY on ESO’s Very Large Telescope Interferometer: the stars S29, S55, S62 and S300 moving round Sgr A* from month to month, S29 through its closest approach, 13 billion km from the black hole; the lines are their orbits, and the small circle below is the size of Neptune’s orbit, for scale. Infrared light at 2.2 µm, shown in orange.',
      colour: 'false',
      credit: 'ESO/GRAVITY collaboration',
      licence: 'CC BY 4.0',
      date: '2021-12-14',
      sourceUrl: 'https://www.eso.org/public/images/eso2119a/',
    },
    {
      file: 'photos/sgr-a-star/chandra-2013.webp',
      largeFile: 'photos/sgr-a-star/chandra-2013-large.webp',
      width: 640,
      height: 640,
      title: 'Sgr A* in X-rays',
      caption:
        'Chandra’s X-rays (blue) over an infrared image of the surrounding stars and gas (red and yellow), with a close-up of the X-ray glow round Sgr A* — hot gas, almost all of which never falls in.',
      colour: 'false',
      credit: 'X-ray: NASA/UMass/D. Wang et al.; infrared: NASA/STScI',
      licence: 'Chandra media, no copyright asserted; credit requested',
      date: '2013-08-29',
      sourceUrl: 'https://chandra.harvard.edu/photo/2013/sgra_gas/',
    },
  ],
  drawnHere: [
    {
      title: 'Where it is',
      text:
        'At GRAVITY’s distance, 8,275.9 ± 8.6 parsecs — about 27,000 light years — on the sky where 52 sessions of radio interferometry put it, drifting 3.1 and 5.6 milliarcseconds a year: the Sun’s own orbit reflected, for Sgr A* itself is at rest to within a few km/s. Along the line of sight it closes on us at 11.1 km/s, the Sun’s own motion toward the centre.',
      cite: ['gravity2024', 'gordon2023', 'reid2020', 'schonrich2010'],
    },
    {
      title: 'Its mass',
      text: '4.2996 million times the Sun’s, GRAVITY’s fit to the orbits of four stars, S2, S29, S38 and S55: what its horizon and its pull on S2 are worked out from.',
      cite: ['gravity2024'],
    },
    {
      title: 'S2',
      text:
        'A body of its own, on GRAVITY’s orbit for it: 0.125 arcseconds in semi-major axis, eccentricity 0.884, 16.05 years round, a Kepler ellipse. The 12 arcminutes a turn by which the orbit precesses is not drawn, nor how its light is delayed and reddened along the way. Its size and mass, 5.5 and 13.6 times the Sun’s, are models’ fits to its spectrum.',
      cite: ['gravity2024', 'gravity2020', 'habibi2017'],
    },
    {
      title: 'The stars round it',
      text:
        '38 more S-stars on the orbits of 25 years of VLT and Keck measurements — S29, S38 and S55 on GRAVITY’s newer ones — and 70 young massive stars of the central parsec where they were seen about 2005, still; round them, a model of the nuclear star cluster, none of its stars a particular star.',
      cite: ['gillessen2017', 'gravity2024', 'paumard2006'],
    },
    {
      title: 'For scale',
      text: 'While it or S2 is in focus, circles the size of Mercury’s and Earth’s orbits are laid over it — rulers, not things. Its horizon sits well inside the first.',
    },
    {
      title: 'The Galaxy’s centre',
      text:
        'The Milky Way model’s centre is drawn 126 parsecs nearer the Sun than Sgr A*: the model keeps the 8.15 kiloparsecs its spiral arms were fitted with, within that figure’s own error. At the Galaxy’s scale the two are one point.',
      cite: ['reid2019'],
    },
  ],
  measured: [
    {
      title: 'Mass and distance',
      text:
        'From the orbits of stars round it, followed for decades: 4.2996 ± 0.0118 million times the Sun’s mass at 8,275.9 ± 8.6 parsecs, with a further systematic uncertainty of about ±30 parsecs and ±40,000 solar masses. GRAVITY first measured the distance to 0.3% in 2019.',
      cite: ['gravity2024', 'gravity2019'],
    },
    {
      title: 'S2’s orbit',
      text:
        'Followed since the early 1990s by two teams, with ESO’s telescopes and with Keck; first traced round its closest point in 2002. At its closest in May 2018 it passed 120 AU from the black hole at about 7,650 km/s.',
      cite: ['nobel2020', 'schodel2002', 'ghez2008', 'gravity2018'],
    },
    {
      title: 'Einstein’s gravity, tested',
      text:
        'In 2018 S2’s light came out reddened by the black hole’s gravity as general relativity predicts; in 2020 its orbit was found to turn by 12 arcminutes a lap, again as predicted.',
      cite: ['gravity2018', 'gravity2020'],
    },
    {
      title: 'S29',
      text: 'Passed 13 billion km from the black hole in late May 2021 at 8,740 km/s, imaged by GRAVITY as it went.',
      cite: ['gravity2022'],
    },
    {
      title: 'Its ring',
      text:
        '51.8 ± 2.3 microarcseconds across at 1.3 mm, from the Event Horizon Telescope’s observations of April 2017 — the size a black hole of this mass at this distance should cast. Its polarisation shows an ordered magnetic field at the ring.',
      cite: ['eht2022', 'eht2024'],
    },
    {
      title: 'Starved',
      text: 'Chandra’s X-rays show that less than 1% of the gas within its gravitational grasp reaches the horizon; the rest is blown away.',
      cite: ['wang2013'],
    },
    {
      title: 'At rest',
      text: 'Against distant quasars it moves only by the Sun’s own orbit reflected; its own motion is a few km/s at most, which only something this heavy can keep.',
      cite: ['reid2020'],
    },
  ],
  estimated: [
    {
      title: 'Its horizon',
      text:
        'From its mass alone, if it does not spin: 12.7 million km in radius, 0.085 AU, a fifth of Mercury’s orbit; its shadow 2.6 times as wide. A spinning black hole has a smaller horizon, down to half.',
      cite: ['gravity2024'],
    },
  ],
  missing: [
    {
      title: 'Its spin',
      text: 'Not measured; the hole is drawn as one that does not spin.',
      cite: ['eht2022'],
    },
    {
      title: 'Its glowing gas',
      text:
        'The ring the EHT imaged is radio light from hot gas just outside the horizon; it flickers within minutes and flares in infrared and X-rays. None of it is drawn: what is drawn round the hole is the sky behind it, bent.',
      cite: ['eht2022'],
    },
    {
      title: 'Any view of it in visible light',
      text: 'There is none: the dust of the Galaxy’s disc dims it by some 30 magnitudes, a factor of a trillion.',
      cite: ['genzel2010'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not swallowing the Galaxy',
      text:
        'Four million Suns is a tiny share of the Galaxy’s mass, and from beyond a few light years its pull is no different from any other mass’s: stars round it go on orbits as planets go round the Sun. It does not draw things in, and it is barely feeding.',
      cite: ['gravity2024', 'wang2013'],
    },
    {
      title: 'The image is not a photograph of the hole',
      text:
        'The EHT image shows radio light from gas around the black hole, reconstructed from a planet-wide array and averaged over many possible images. The dark middle is the shadow, larger than the horizon; the hole itself cannot be seen.',
      cite: ['eht2022'],
    },
    {
      title: 'The Sun does not orbit the black hole',
      text:
        'It orbits the whole Galaxy’s mass, most of it far from the centre. Sgr A* sits at the centre, but its pull alone, from 27,000 light years, would hold the Sun on an orbit at under 2 km/s; the Sun goes round at about 250.',
      cite: ['gravity2024', 'reid2020'],
    },
  ],
  sources: [
    {
      key: 'gravity2024',
      text: 'GRAVITY Collaboration, Abd El Dayem, K., et al. 2024, Improving constraints on the extended mass distribution in the Galactic center with stellar orbits, A&A 692, A242',
      url: 'https://doi.org/10.1051/0004-6361/202452274',
    },
    {
      key: 'gravity2019',
      text: 'GRAVITY Collaboration 2019, A geometric distance measurement to the Galactic center black hole with 0.3% uncertainty, A&A 625, L10',
      url: 'https://doi.org/10.1051/0004-6361/201935656',
    },
    {
      key: 'gravity2018',
      text: 'GRAVITY Collaboration 2018, Detection of the gravitational redshift in the orbit of the star S2 near the Galactic centre massive black hole, A&A 615, L15',
      url: 'https://doi.org/10.1051/0004-6361/201833718',
    },
    {
      key: 'gravity2020',
      text: 'GRAVITY Collaboration 2020, Detection of the Schwarzschild precession in the orbit of the star S2 near the Galactic centre massive black hole, A&A 636, L5',
      url: 'https://doi.org/10.1051/0004-6361/202037813',
    },
    {
      key: 'gravity2022',
      text: 'GRAVITY Collaboration 2022, Deep images of the Galactic center with GRAVITY, A&A 657, A82',
      url: 'https://doi.org/10.1051/0004-6361/202142459',
    },
    {
      key: 'schodel2002',
      text: 'Schödel, R., Ott, T., Genzel, R., et al. 2002, A star in a 15.2-year orbit around the supermassive black hole at the centre of the Milky Way, Nature 419, 694',
      url: 'https://doi.org/10.1038/nature01121',
    },
    {
      key: 'ghez2008',
      text: 'Ghez, A. M., Salim, S., et al. 2008, Measuring Distance and Properties of the Milky Way’s Central Supermassive Black Hole with Stellar Orbits, ApJ 689, 1044',
      url: 'https://doi.org/10.1086/592738',
    },
    {
      key: 'gillessen2017',
      text: 'Gillessen, S., Plewa, P. M., et al. 2017, An Update on Monitoring Stellar Orbits in the Galactic Center, ApJ 837, 30',
      url: 'https://doi.org/10.3847/1538-4357/aa5c41',
    },
    {
      key: 'paumard2006',
      text: 'Paumard, T., Genzel, R., et al. 2006, The Two Young Star Disks in the Central Parsec of the Galaxy, ApJ 643, 1011',
      url: 'https://doi.org/10.1086/503273',
    },
    {
      key: 'habibi2017',
      text: 'Habibi, M., Gillessen, S., et al. 2017, Twelve Years of Spectroscopic Monitoring in the Galactic Center: The Closest Look at S-stars near the Black Hole, ApJ 847, 120',
      url: 'https://doi.org/10.3847/1538-4357/aa876f',
    },
    {
      key: 'gordon2023',
      text: 'Gordon, D., de Witt, A., & Jacobs, C. S. 2023, Position and Proper Motion of Sagittarius A* in the ICRF3 Frame from VLBI Absolute Astrometry, AJ 165, 49',
      url: 'https://doi.org/10.3847/1538-3881/aca65b',
    },
    {
      key: 'reid2020',
      text: 'Reid, M. J., & Brunthaler, A. 2020, The Proper Motion of Sagittarius A*. III. The Case for a Supermassive Black Hole, ApJ 892, 39',
      url: 'https://doi.org/10.3847/1538-4357/ab76cd',
    },
    {
      key: 'schonrich2010',
      text: 'Schönrich, R., Binney, J., & Dehnen, W. 2010, Local kinematics and the local standard of rest, MNRAS 403, 1829',
      url: 'https://doi.org/10.1111/j.1365-2966.2010.16253.x',
    },
    {
      key: 'reid2019',
      text: 'Reid, M. J., Menten, K. M., et al. 2019, Trigonometric Parallaxes of High-mass Star-forming Regions: Our View of the Milky Way, ApJ 885, 131',
      url: 'https://doi.org/10.3847/1538-4357/ab4a11',
    },
    {
      key: 'eht2022',
      text: 'Event Horizon Telescope Collaboration 2022, First Sagittarius A* Event Horizon Telescope Results. I. The Shadow of the Supermassive Black Hole in the Center of the Milky Way, ApJL 930, L12',
      url: 'https://doi.org/10.3847/2041-8213/ac6674',
    },
    {
      key: 'eht2024',
      text: 'Event Horizon Telescope Collaboration 2024, First Sagittarius A* Event Horizon Telescope Results. VII. Polarization of the Ring, ApJL 964, L25',
      url: 'https://doi.org/10.3847/2041-8213/ad2df0',
    },
    {
      key: 'wang2013',
      text: 'Wang, Q. D., Nowak, M. A., et al. 2013, Dissecting X-ray–Emitting Gas Around the Center of Our Galaxy, Science 341, 981',
      url: 'https://doi.org/10.1126/science.1240755',
    },
    {
      key: 'genzel2010',
      text: 'Genzel, R., Eisenhauer, F., & Gillessen, S. 2010, The Galactic Center massive black hole and nuclear star cluster, Rev. Mod. Phys. 82, 3121',
      url: 'https://doi.org/10.1103/RevModPhys.82.3121',
    },
    {
      key: 'nobel2020',
      text: 'The Royal Swedish Academy of Sciences 2020, The Nobel Prize in Physics 2020, press release',
      url: 'https://www.nobelprize.org/prizes/physics/2020/press-release/',
    },
  ],
};
