import { namedSatelliteBodyId } from '../core/satelliteBodies.ts';
import type { Description } from './types.ts';

/**
 * The Hubble Space Telescope: a named Earth satellite (tools/src/satellites/named.ts), so
 * its body is made at run time and its id is the satellite's. Every number here is from the
 * source it cites; its height, which drag lowers year by year, is quoted with whose figure
 * it is, and the panel gives it now.
 */
export const HUBBLE: Description = {
  id: namedSatelliteBodyId('hubble'),
  lead: [
    'Hubble changed what people picture when they think of the universe. Before it, the deep sky was mostly smudges in photographs taken through moving air; after it, schoolbooks and phone screens are full of its pillars of gas, its colliding galaxies, and its Deep Field — a patch of sky that looked empty, which turned out to hold thousands of galaxies, most of them home to billions of stars. It helped measure how fast the universe is expanding, and helped show that the expansion is speeding up. And it was nearly a failure: its mirror was made the wrong shape, and astronauts flew up to fix it.',
    'It is a telescope with a 2.4-metre mirror, 13.2 metres long, built by NASA with the European Space Agency and named after the astronomer Edwin Hubble. Space Shuttle Discovery left it in orbit in April 1990. Above the atmosphere it sees sharply, and in ultraviolet light the air would block, as well as in visible and near-infrared light.',
    'Weeks after launch its first images were blurred: the main mirror had been polished very precisely to the wrong curve, off by about two micrometres at its edge. In December 1993 astronauts installed corrective optics and a new camera, and its images became as sharp as designed. Shuttle crews visited it five times in all, the last in 2009, to repair and upgrade it; there have been none since.',
    'It is not far away. It circles Earth only a few hundred kilometres up — NASA’s mission page gives about 483 km and one turn every 95 minutes, figures it has since sunk below — at some 27,000 kilometres an hour, slowly sinking as the thin air drags on it. Since 2024 it has been pointing with a single gyroscope, keeping another in reserve, and NASA expects it to keep working through this decade and possibly into the next. The panel gives its height now.',
  ],
  photos: [
    {
      file: 'photos/hubble/deploy-1990.webp',
      largeFile: 'photos/hubble/deploy-1990-large.webp',
      width: 640,
      height: 633,
      title: 'Leaving Discovery, 25 April 1990',
      caption:
        'Hubble held above the shuttle’s payload bay by its robotic arm while a solar-array wing swings out from where it was stowed along its side, before it was let go. Earth’s limb behind it.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1990-04-25',
      sourceUrl: 'https://images.nasa.gov/details/s31-76-016',
    },
    {
      file: 'photos/hubble/servicing-1993.webp',
      largeFile: 'photos/hubble/servicing-1993-large.webp',
      width: 640,
      height: 637,
      title: 'The repair, 8 December 1993',
      caption:
        'Astronaut Kathryn Thornton working on Hubble during the fourth spacewalk of the first servicing mission, the one that fixed its eyesight.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1993-12-08',
      sourceUrl: 'https://images.nasa.gov/details/STS061-098-0K',
    },
    {
      file: 'photos/hubble/m100-before-after.webp',
      largeFile: 'photos/hubble/m100-before-after-large.webp',
      width: 640,
      height: 492,
      title: 'Before and after the fix: the galaxy M100',
      caption:
        'The core of the galaxy M100 through the first Wide Field and Planetary Camera, left, and through its replacement with corrective optics built in, right, installed in December 1993. Colour composites from the cameras’ filters.',
      colour: 'false',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1994',
      sourceUrl: 'https://images.nasa.gov/details/9408670',
    },
    {
      file: 'photos/hubble/after-servicing-2002.webp',
      largeFile: 'photos/hubble/after-servicing-2002-large.webp',
      width: 640,
      height: 423,
      title: 'Free again, 9 March 2002',
      caption:
        'Hubble drifting away from Space Shuttle Columbia over Earth’s horizon after the fourth of its five servicing missions. It is only a few hundred kilometres up, as close to the ground as the shuttle was.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2002-03-09',
      sourceUrl: 'https://images.nasa.gov/details/S109E5707',
    },
    {
      file: 'photos/hubble/grappled-2009.webp',
      largeFile: 'photos/hubble/grappled-2009-large.webp',
      width: 640,
      height: 413,
      title: 'Caught for the last time, 13 May 2009',
      caption:
        'Hubble over Earth, just grappled by Atlantis’s robot arm on the fifth and last servicing mission: one of its two solar arrays on the left, the open door over its aperture at the top right.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2009-05-13',
      sourceUrl: 'https://images.nasa.gov/details/s125e006948',
    },
    {
      file: 'photos/hubble/spacewalk-2009.webp',
      largeFile: 'photos/hubble/spacewalk-2009-large.webp',
      width: 640,
      height: 410,
      title: 'The last spacewalk on Hubble, 18 May 2009',
      caption:
        'John Grunsfeld, on the end of Atlantis’s arm, at work on the telescope; the thin blue line behind is Earth’s atmosphere edge-on. In seven hours he and Andrew Feustel replaced a battery group and a guidance sensor and fitted three new thermal blankets over its electronics.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2009-05-18',
      sourceUrl: 'https://images.nasa.gov/details/s125e009990',
    },
    {
      file: 'photos/hubble/shoemaker-levy-1994.webp',
      largeFile: 'photos/hubble/shoemaker-levy-1994-large.webp',
      width: 640,
      height: 480,
      title: 'A comet’s scars on Jupiter, July–August 1994',
      caption:
        'Four snapshots of one dark impact site, made by two pieces of comet Shoemaker–Levy 9 that struck Jupiter on 17 and 18 July 1994 and changed again by a third on 21 July, watched as it spread over the following month. Black and white.',
      colour: 'true',
      credit: 'H. Hammel, MIT and NASA',
      licence: 'NASA media, not copyrighted',
      date: '1994',
      sourceUrl: 'https://images.nasa.gov/details/PIA01265',
    },
    {
      file: 'photos/hubble/sombrero-2003.webp',
      largeFile: 'photos/hubble/sombrero-2003-large.webp',
      width: 640,
      height: 358,
      title: 'The Sombrero galaxy, May–June 2003',
      caption:
        'Messier 104, about 28 million light years away and 50,000 across, seen nearly edge-on: thick lanes of dust wrapped round a bright core that holds a black hole of about a billion Suns. Six pictures stitched together, each through red, green and blue filters: close to natural colour.',
      colour: 'true',
      credit: 'NASA/STScI/AURA',
      licence: 'NASA media, not copyrighted',
      date: '2003',
      sourceUrl: 'https://images.nasa.gov/details/PIA15226',
    },
    {
      file: 'photos/hubble/crab-2005.webp',
      largeFile: 'photos/hubble/crab-2005-large.webp',
      width: 640,
      height: 640,
      title: 'The Crab Nebula, released December 2005',
      caption:
        'What is left of a star whose explosion Chinese astronomers recorded in 1054, about 6,500 light years away and some six light years across, with a pulsar at its heart spinning about 30 times a second. Twenty-four exposures pieced together, through filters for the light of oxygen and sulphur, each given a colour.',
      colour: 'false',
      credit: 'NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2005-12-01',
      sourceUrl: 'https://esahubble.org/images/heic0515a/',
    },
    {
      file: 'photos/hubble/horsehead-2013.webp',
      largeFile: 'photos/hubble/horsehead-2013-large.webp',
      width: 640,
      height: 669,
      title: 'The Horsehead Nebula in infrared, April 2013',
      caption:
        'A cloud of gas and dust, dark against glowing gas in visible light, made translucent here by infrared, with stars and distant galaxies behind it. Released for the 23rd anniversary of its launch. Infrared shown in visible colours.',
      colour: 'false',
      credit: 'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)',
      licence: 'NASA media, not copyrighted',
      date: '2013-04-19',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001518',
    },
    {
      file: 'photos/hubble/andromeda-2015.webp',
      largeFile: 'photos/hubble/andromeda-2015-large.webp',
      width: 640,
      height: 198,
      title: 'Andromeda, star by star, January 2015',
      caption:
        'A 61,000-light-year stretch of the nearest large galaxy, 2.5 million light years away, from its central bulge at the left out into its disk: over 100 million stars, each resolved, in 7,398 exposures over 411 pointings. Young blue stars mark where stars are forming; dark lanes are dust. Assembled from Hubble’s filters with a ground-based picture, and not given as natural colour.',
      colour: 'false',
      credit: 'NASA, ESA, J. Dalcanton, B.F. Williams, and L.C. Johnson (University of Washington), the PHAT team, and R. Gendler',
      licence: 'NASA media, not copyrighted',
      date: '2015-01-05',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000839',
    },
    {
      file: 'photos/hubble/deep-field-1995.webp',
      largeFile: 'photos/hubble/deep-field-1995-large.webp',
      width: 467,
      height: 480,
      title: 'The Hubble Deep Field, December 1995',
      caption:
        'Ten days on one tiny patch of sky near the Big Dipper that looked empty: nearly everything in it is a galaxy, some seen as they were less than a billion years after the Big Bang. Made from ultraviolet, blue, red and near-infrared filters shown as visible colours.',
      colour: 'false',
      credit: 'NASA/JPL/STScI Hubble Deep Field Team',
      licence: 'NASA media; credit requested',
      date: '1995-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA12110',
    },
    {
      file: 'photos/hubble/xdf-2012.webp',
      largeFile: 'photos/hubble/xdf-2012-large.webp',
      width: 640,
      height: 558,
      title: 'The eXtreme Deep Field, 2012',
      caption:
        'Ten years of exposures stacked on the centre of the Hubble Ultra Deep Field: about 5,500 galaxies in a patch of sky much smaller than the full Moon, the faintest one ten-billionth as bright as the eye can see. Its filters reach into the near infrared, shown in visible colours.',
      colour: 'false',
      credit: 'NASA; ESA; G. Illingworth, D. Magee, and P. Oesch, University of California, Santa Cruz; R. Bouwens, Leiden University; and the HUDF09 Team',
      licence: 'NASA media; credit requested',
      date: '2012-09-25',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001651',
    },
    {
      file: 'photos/hubble/pillars-infrared-2014.webp',
      largeFile: 'photos/hubble/pillars-infrared-2014-large.webp',
      width: 491,
      height: 460,
      title: 'The Pillars of Creation in near infrared, January 2015',
      caption:
        'Hubble’s return, in 2014, to its most famous subject, in near-infrared light that passes through much of the dust: the pillars turn to ghostly outlines and the stars behind and inside them appear. Infrared bands shown as visible colours.',
      colour: 'false',
      credit: 'NASA, ESA, and the Hubble Heritage Team (STScI/AURA)',
      licence: 'NASA media; credit requested',
      date: '2015-01',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000842',
    },
  ],
  drawnHere: [
    {
      title: 'Its height',
      text: 'The panel’s height is SGP4’s, from the latest element set, above the WGS-84 ellipsoid: it is lower each year, as drag takes its toll.',
    },
  ],
  measured: [
    {
      title: 'The telescope',
      text: '13.2 m long, with a primary mirror 2.4 m across; about 10,800 kg at launch and 12,200 kg after its last servicing.',
      cite: ['hubble'],
    },
    {
      title: 'Its orbit',
      text: 'About 483 km above the surface, once round in about 95 minutes at about 27,000 km/h, as NASA’s mission page gives them (page as of September 2026). Those are not its figures now: drag lowers it year by year, and the panel gives its height today.',
      cite: ['hubble'],
    },
    {
      title: 'The flaw',
      text: 'Its primary mirror was ground to the wrong shape by about 2 micrometres — a fiftieth of a hair’s width — so light from its edge and its centre did not focus at one point. Found two months after launch.',
      cite: ['m100'],
    },
    {
      title: 'The fix and the visits',
      text: 'The first servicing crew, in December 1993, replaced the main camera with one whose optics corrected the flaw and added corrective mirrors for the other instruments. Crews came five times in all.',
      cite: ['m100', 'hubble'],
    },
    {
      title: 'The Deep Field',
      text: 'In December 1995 it pointed for about ten days at a small patch of sky with nothing known in it, and found it full of faint galaxies, many seen as they were billions of years ago.',
      cite: ['williams1996'],
    },
    {
      title: 'The Ultra Deep Field',
      text: 'Its deepest single field, taken in 2003 and 2004: about 10,000 galaxies in a patch a tenth the width of the full Moon.',
      cite: ['beckwith2006'],
    },
    {
      title: 'The expansion speeding up',
      text: 'Distant supernovae, several of them measured by Hubble, were fainter than a slowing universe allows: in 1998–1999 two teams found the expansion accelerating.',
      cite: ['riess1998', 'perlmutter1999'],
    },
    {
      title: 'How fast it expands',
      text: 'Its Key Project measured the Hubble constant at 72 ± 8 km/s per megaparsec in 2001; with later cameras the SH0ES team reached 73.04 ± 1.04 in 2022 — a value that disagrees with what the early universe predicts, the “Hubble tension”.',
      cite: ['freedman2001', 'riess2022'],
    },
    {
      title: 'Its output',
      text: 'More than 1.7 million observations and over 23,000 peer-reviewed papers, as NASA counts them.',
      cite: ['hubble'],
    },
  ],
  estimated: [
    {
      title: 'How long it lasts',
      text: 'Since June 2024 it points with one gyroscope, holding another in reserve; NASA expects it to go on making discoveries through this decade and possibly into the next. With no shuttle to boost it, drag will eventually bring it down.',
      cite: ['hubblegyro'],
    },
  ],
  missing: [
    {
      title: 'What it is looking at',
      text: 'Not known here: it turns from target to target on an observing plan no data here carry. It is drawn with its solar arrays on the Sun, which it keeps within a few degrees of them, but where its tube points is a guess.',
    },
    {
      title: 'Its exact path beyond a week',
      text: 'Not drawn: its elements are good for days, and outside seven days of them it is not placed at all, rather than placed wrong.',
      cite: ['vallado2006'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not far away',
      text: 'It circles only a few hundred kilometres above the ground, in the same kind of low orbit as the Space Station. It sees deep into the universe because it is above the air, not because it is any closer to the stars.',
      cite: ['hubble'],
    },
    {
      title: 'Its pictures are not taken in colour',
      text: 'Its cameras record black-and-white images through filters, many of them ultraviolet or infrared; colour pictures combine them, and the colours are often a convention.',
      cite: ['williams1996'],
    },
    {
      title: 'The flawed mirror was not a minor blur',
      text: 'It was a precise mistake — the mirror ground perfectly to the wrong shape — which is why it could be corrected with optics made to the opposite error.',
      cite: ['m100'],
    },
    {
      title: 'Webb did not replace it',
      text: 'Webb sees mostly infrared; Hubble’s ultraviolet and visible light is something Webb cannot see. Both are working.',
      cite: ['gardner2023', 'hubble'],
    },
  ],
  sources: [
    {
      key: 'hubble',
      text: 'NASA Science, Hubble Space Telescope (mission overview: size, orbit, servicing, output)',
      url: 'https://science.nasa.gov/mission/hubble/overview/',
    },
    {
      key: 'hubblegyro',
      text: 'NASA Science 2024, NASA’s Hubble Restarts Science in New Pointing Mode (14 June 2024; first published 31 May 2024 as NASA’s Hubble Temporarily Pauses Science)',
      url: 'https://science.nasa.gov/missions/hubble/nasas-hubble-restarts-science-in-new-pointing-mode/',
    },
    {
      key: 'm100',
      text: 'NASA Marshall Space Flight Center, History of Hubble Space Telescope: the M100 galactic nucleus with WF/PC1 and WFPC2 (image 9408670, caption on the spherical aberration and its correction)',
      url: 'https://images.nasa.gov/details/9408670',
    },
    {
      key: 'williams1996',
      text: 'Williams, R. E., et al. 1996, The Hubble Deep Field: Observations, Data Reduction, and Galaxy Photometry, AJ 112, 1335',
      url: 'https://doi.org/10.1086/118105',
    },
    {
      key: 'beckwith2006',
      text: 'Beckwith, S. V. W., et al. 2006, The Hubble Ultra Deep Field, AJ 132, 1729',
      url: 'https://doi.org/10.1086/507302',
    },
    {
      key: 'riess1998',
      text: 'Riess, A. G., et al. 1998, Observational Evidence from Supernovae for an Accelerating Universe and a Cosmological Constant, AJ 116, 1009',
      url: 'https://doi.org/10.1086/300499',
    },
    {
      key: 'perlmutter1999',
      text: 'Perlmutter, S., et al. 1999, Measurements of Ω and Λ from 42 High-Redshift Supernovae, ApJ 517, 565',
      url: 'https://doi.org/10.1086/307221',
    },
    {
      key: 'freedman2001',
      text: 'Freedman, W. L., et al. 2001, Final Results from the Hubble Space Telescope Key Project to Measure the Hubble Constant, ApJ 553, 47',
      url: 'https://doi.org/10.1086/320638',
    },
    {
      key: 'riess2022',
      text: 'Riess, A. G., et al. 2022, A Comprehensive Measurement of the Local Value of the Hubble Constant with 1 km/s/Mpc Uncertainty from the Hubble Space Telescope and the SH0ES Team, ApJL 934, L7',
      url: 'https://doi.org/10.3847/2041-8213/ac5c5b',
    },
    {
      key: 'gardner2023',
      text: 'Gardner, J. P., et al. 2023, The James Webb Space Telescope Mission, PASP 135, 068001',
      url: 'https://doi.org/10.1088/1538-3873/acd1b5',
    },
    {
      key: 'vallado2006',
      text: 'Vallado, D. A., Crawford, P., Hujsak, R., & Kelso, T. S. 2006, Revisiting Spacetrack Report #3, AIAA/AAS Astrodynamics Specialist Conference, AIAA 2006-6753 (the SGP4 that satellite.js implements)',
      url: 'https://doi.org/10.2514/6.2006-6753',
    },
  ],
};
