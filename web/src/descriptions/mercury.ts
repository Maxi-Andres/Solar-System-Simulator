import type { Description } from './types.ts';

/**
 * Mercury. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model.
 */

const MESSENGER_CREDIT = 'NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington';

export const MERCURY: Description = {
  id: 'mercury',
  lead: [
    'Mercury is the planet nearest the Sun and, strangely, one of the hardest to reach: falling toward the Sun speeds a spacecraft up, and slowing down enough to stay there takes years of flybys. A small, scorched world that still carries, almost untouched, the scars of the Solar System’s violent youth.',
    'Mercury is the smallest planet and the one closest to the Sun: a grey, airless ball of rock and iron 4,880 kilometres across, only about 40% wider than the Moon. It looks like the Moon too, covered in craters, but it is a very different world inside. Two moons, Jupiter’s Ganymede and Saturn’s Titan, are wider than Mercury, yet Mercury has more than twice the mass of either.',
    'That is because most of it is metal. Its iron core reaches out to more than four-fifths of its radius, a far bigger share than Earth’s, and part of it is still molten: it makes a weak magnetic field, the only one among the small rocky planets apart from Earth’s. As the planet cooled, it shrank by several kilometres, and its crust wrinkled into cliffs hundreds of kilometres long.',
    'It has a strange rhythm. A year on Mercury takes 88 Earth days, and it turns on its axis exactly three times for every two trips round the Sun, so from sunrise to sunrise takes 176 Earth days. With no air to hold heat, the ground at noon reaches about 430 °C and at night falls to about −170 °C. And yet there is ice: at the poles, in craters whose floors the Sun never reaches, water ice has lain in the dark for a very long time.',
    'From Earth it is hard to see. It never strays far from the Sun in our sky, so it shows only low in the twilight, just after sunset or just before sunrise. Even so, averaged over time, it is the planet closest to Earth — and to every other planet. About thirteen times a century it crosses the face of the Sun as a small black dot.',
    'It follows the most stretched orbit of the eight planets, from 46 to 70 million kilometres from the Sun, and it is the fastest, at 47 kilometres per second on average. Its orbit slowly turns, a little faster than Newton’s gravity can explain — a puzzle solved by Einstein’s general relativity in 1915. Two spacecraft have studied it up close: Mariner 10, which flew past three times in 1974 and 1975, and MESSENGER, which orbited it from 2011 to 2015. A third, BepiColombo, has flown past it six times since 2021 and is due to enter orbit around it in November 2026.',
  ],
  photos: [
    {
      file: 'photos/mercury/true-colour-2008.webp',
      largeFile: 'photos/mercury/true-colour-2008-large.webp',
      width: 640,
      height: 680,
      title: 'Which one is true colour? 6 October 2008',
      caption:
        'MESSENGER’s second flyby, the same view four ways. Top left, one filter in black and white; the other three put the same filters at 480, 560 and 630 nanometres in blue, green and red, each stretched a little differently. All three are fair “true colour”: Mercury’s real colours are so faint that how the picture is adjusted decides them.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Arizona State University/Carnegie Institution of Washington',
      licence: 'NASA media, not copyrighted',
      date: '2008-10-06',
      sourceUrl: 'https://images.nasa.gov/details/PIA11364',
    },
    {
      file: 'photos/mercury/messenger-globe.webp',
      largeFile: 'photos/mercury/messenger-globe-large.webp',
      width: 640,
      height: 640,
      title: 'The whole planet, from MESSENGER’s mosaic',
      caption:
        'MESSENGER’s images laid onto a globe and seen from above 0°N, 0°E, at 2.5 km per pixel. The rayed crater near the bottom is Debussy; the ringed basin near the right-hand edge is Rachmaninoff. Black and white, which is close to how grey Mercury really is.',
      colour: 'true',
      credit: MESSENGER_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2011-11-29',
      sourceUrl: 'https://images.nasa.gov/details/PIA15160',
    },
    {
      file: 'photos/mercury/mariner-10-1974.webp',
      largeFile: 'photos/mercury/mariner-10-1974-large.webp',
      width: 640,
      height: 845,
      title: 'The first close look, Mariner 10, 29 March 1974',
      caption:
        'More than 140 television frames taken about two hours after Mariner 10’s first pass, as it sped away. Its three flybys saw the same sunlit half each time, so for 33 years this was most of what anyone knew of Mercury’s surface. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/Northwestern University',
      licence: 'NASA media, not copyrighted',
      date: '1974-03-29',
      sourceUrl: 'https://images.nasa.gov/details/PIA02418',
    },
    {
      file: 'photos/mercury/hollows-2011.webp',
      largeFile: 'photos/mercury/hollows-2011-large.webp',
      width: 640,
      height: 686,
      title: 'Hollows on a crater floor, 3 October 2011',
      caption:
        'The bright, shallow pits on the floor and wall of this 30 km crater are hollows, found only on Mercury: the ground seems to be losing something that turns to vapour, and they look young enough to be forming still. MESSENGER’s narrow-angle camera, 23 metres per pixel, black and white.',
      colour: 'true',
      credit: MESSENGER_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2011-10-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA15064',
    },
    {
      file: 'photos/mercury/last-images-2015.webp',
      largeFile: 'photos/mercury/last-images-2015-large.webp',
      width: 508,
      height: 512,
      title: 'One of the last, 29 April 2015',
      caption:
        'Taken the day before MESSENGER, out of fuel, struck the surface. At 1.7 metres per pixel it is among the sharpest pictures of Mercury ever made: the largest crater here is 330 metres across. Black and white.',
      colour: 'true',
      credit: MESSENGER_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-04-29',
      sourceUrl: 'https://images.nasa.gov/details/PIA19445',
    },
    {
      file: 'photos/mercury/enhanced-colour.webp',
      largeFile: 'photos/mercury/enhanced-colour-large.webp',
      width: 640,
      height: 360,
      title: 'Mercury in enhanced colour',
      caption:
        'The faint colour differences of the true-colour pictures, stretched until they shout. Tan is smooth plains of old lava — the big tan circle upper right of centre is the Caloris basin; dark blue is a dark, carbon-rich crust; light blue and white are the rays of young craters. Not what an eye would see.',
      colour: 'false',
      credit: MESSENGER_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2013-02-18',
      sourceUrl: 'https://images.nasa.gov/details/PIA16853',
    },
    {
      file: 'photos/mercury/polar-ice.webp',
      largeFile: 'photos/mercury/polar-ice-large.webp',
      width: 640,
      height: 348,
      title: 'Ice at the north pole',
      caption:
        'MESSENGER’s mosaic of the north polar region, with the deposits the Arecibo radar telescope found bright to radar laid over it in yellow. They sit in craters whose floors never see the Sun, and MESSENGER’s measurements showed they are water ice. The yellow is a convention; the ice itself lies in darkness.',
      colour: 'false',
      credit: MESSENGER_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-04-16',
      sourceUrl: 'https://images.nasa.gov/details/PIA19411',
    },
  ],
  drawnHere: [
    {
      title: 'An illustrative map',
      text: 'Its map is a composite made by its authors from NASA imagery, grey, with its contrast raised; it is not a calibrated product. MESSENGER’s own global mosaic is 759 MB, and the colour version that is easy to get is the enhanced one, further from the truth than this.',
    },
    {
      title: 'Its day',
      text: 'It turns at the IAU’s rate, which locks it at three turns for every two orbits; nothing about its day is set by hand, so its 176-day solar day comes out as it is. Wind the clock forward and the terminator crawls across it.',
      cite: ['archinal2018', 'nssdcMercury'],
    },
    {
      title: 'Followed closely',
      text: 'The fastest planet, so its position is sampled from JPL every day, not every few: between samples, the interpolation puts it within 9.7 km of JPL’s own position at worst.',
      cite: ['de440'],
    },
    {
      title: 'Lit as an airless world',
      text: 'In Natural lighting its night side is black, as it is: with no air to scatter sunlight past the terminator, the edge between day and night is sharp. Flood and Shadow light the night side so it can be read, and are named so as not to be taken for the truth.',
    },
    {
      title: 'Its spacecraft',
      text: 'BepiColombo, ESA’s and JAXA’s mission to Mercury, is drawn on its JPL trajectory with ESA’s own model of it.',
      cite: ['benkhoff2021'],
    },
  ],
  measured: [
    {
      title: 'Size',
      text: 'Radius 2,440.5 km at the equator and 2,438.3 km at the poles, from MESSENGER’s mapping, as the IAU adopts them: it is very nearly round.',
      cite: ['archinal2018'],
    },
    {
      title: 'Mass and density',
      text: 'GM = 22,031.87 km³/s², from the paths of spacecraft that flew past and orbited it: 3.30 × 10²³ kg. With its size that gives a mean density of 5.43 grams per cubic centimetre, second only to Earth’s, and Earth is squeezed denser by its own weight; Mercury is dense because it is mostly iron.',
      cite: ['de440', 'nssdcMercury'],
    },
    {
      title: 'Orbit',
      text: 'The most eccentric of the planets’ orbits, e = 0.2056: 46.0 million km from the Sun at perihelion and 69.8 at aphelion. One orbit takes 87.969 days, at 47.36 km/s on average.',
      cite: ['nssdcMercury'],
    },
    {
      title: 'A turning orbit',
      text: 'The long axis of its orbit turns by 574 arcseconds a century against the stars. The other planets’ pull accounts for all but 43 of them; those 43 are what general relativity predicts, and that match was its first success.',
      cite: ['clemence1947'],
    },
    {
      title: 'Its spin',
      text: 'Once in 58.65 days, found by radar in 1965 — until then it was thought to keep one face to the Sun. That is two-thirds of its year exactly: a 3:2 resonance, held by the Sun’s tides on its stretched orbit. A solar day, sunrise to sunrise, is 176 Earth days.',
      cite: ['pettengill1965', 'colombo1965', 'nssdcMercury'],
    },
    {
      title: 'Temperature',
      text: 'From about 700 K (430 °C) at noon near perihelion to about 100 K (−170 °C) before dawn: the widest swing of any planet, because nothing holds the heat.',
      cite: ['vasavada1999'],
    },
    {
      title: 'Ice at the poles',
      text: 'Radar from Earth found deposits in polar craters that reflect radar as ice does; MESSENGER’s neutron spectrometer found the hydrogen they would need to be water ice, and its laser and camera saw them in the craters’ permanent shadow, below about 100 K.',
      cite: ['lawrence2013', 'vasavada1999'],
    },
    {
      title: 'Its magnetic field',
      text: 'Global and made inside it, like Earth’s, but less than a hundredth as strong, and its centre lies about 480 km north of the planet’s.',
      cite: ['anderson2011', 'nssdcMercury'],
    },
    {
      title: 'Shrinking',
      text: 'Long cliffs, thrust faults, cross its surface; added up, they show the planet’s radius has shrunk by up to about 7 km as its interior cooled.',
      cite: ['byrne2014'],
    },
    {
      title: 'Hollows',
      text: 'Shallow, bright, flat-floored pits tens of metres to a few kilometres across, fresh and uncratered: something in the rock is escaping, perhaps still today.',
      cite: ['blewett2011'],
    },
    {
      title: 'How much has been seen',
      text: 'Mariner 10 photographed about 45% of the surface in 1974–75; MESSENGER’s flybys and four years in orbit covered all of it.',
      cite: ['solomon2008'],
    },
  ],
  estimated: [
    {
      title: 'Its core',
      text: 'About 2,020 km in radius, more than four-fifths of the planet’s, and at least partly liquid: inferred from how it wobbles as it turns and from its gravity field, through models of its interior, not seen.',
      cite: ['margot2012', 'hauck2013'],
    },
    {
      title: 'Why it is so dark',
      text: 'Its surface reflects less light than the Moon’s although it holds little iron, which usually darkens rock. The best explanation is carbon, as graphite, perhaps from an ancient crust that floated on an ocean of magma.',
      cite: ['peplowski2016'],
    },
  ],
  missing: [
    {
      title: 'Its colours',
      text: 'The map is grey. Mercury’s real colours are faint browns and greys that only careful processing brings out, and no calibrated true-colour global map of them has been published at a size the app could load.',
    },
    {
      title: 'Hollows, scarps and small craters',
      text: 'The map is 2,048 pixels round the equator, about 7.5 km to a pixel: the largest craters and basins show, but hollows, most scarps and anything smaller do not.',
      cite: ['blewett2011'],
    },
    {
      title: 'Its polar ice',
      text: 'Not drawn: it lies in permanent shadow, so it could not be seen anyway, and the map does not mark it.',
      cite: ['lawrence2013'],
    },
    {
      title: 'Its thin exosphere and its magnetic field',
      text: 'Mercury has a trace of gas — sodium, potassium, calcium and more — far too thin to be called an air, and a small magnetosphere. Neither is drawn: the app models a magnetosphere for Earth only.',
      cite: ['nssdcMercury', 'anderson2011'],
    },
    {
      title: 'Why it is mostly iron',
      text: 'Not known. A giant impact that stripped away much of its rock, or a birthplace near the Sun where iron was richer, are both proposed; BepiColombo is meant to help decide.',
      cite: ['benkhoff2021'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not the hottest planet',
      text: 'Venus is, although it is nearly twice as far from the Sun: its thick air traps the heat at 464 °C day and night, where Mercury averages about 167 °C and freezes every night.',
      cite: ['nssdcMercury', 'nssdcVenus'],
    },
    {
      title: 'One side does not always face the Sun',
      text: 'For decades it was thought to keep one face to the Sun, as the Moon keeps one face to Earth. Radar showed in 1965 that it turns three times for every two orbits, so every part of it gets day and night.',
      cite: ['pettengill1965', 'colombo1965'],
    },
    {
      title: 'The closest planet to Earth',
      text: 'On average it is Mercury, not Venus. Venus comes nearest of all, but it also spends long stretches on the far side of the Sun; Mercury never gets far from it, so over time it averages closest — to every planet.',
      cite: ['stockman2019'],
    },
    {
      title: 'Ice, this close to the Sun',
      text: 'Its poles hold water ice. Its axis is almost upright, 0.034°, so the floors of some polar craters never see the Sun at all.',
      cite: ['lawrence2013', 'nssdcMercury'],
    },
    {
      title: 'Not just a bigger Moon',
      text: 'It looks like the Moon, but the Moon is mostly rock with a small core; Mercury is mostly core.',
      cite: ['hauck2013'],
    },
  ],
  sources: [
    {
      key: 'nssdcMercury',
      text: 'Williams, D. R. 2024, Mercury Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html',
    },
    {
      key: 'nssdcVenus',
      text: 'Williams, D. R. 2024, Venus Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html',
    },
    {
      key: 'de440',
      text: 'Park, R. S., et al. 2021, The JPL Planetary and Lunar Ephemerides DE440 and DE441, AJ 161, 105',
      url: 'https://doi.org/10.3847/1538-3881/abd414',
    },
    {
      key: 'archinal2018',
      text: 'Archinal, B. A., et al. 2018, Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015, Celest. Mech. Dyn. Astron. 130, 22',
      url: 'https://doi.org/10.1007/s10569-017-9805-5',
    },
    {
      key: 'pettengill1965',
      text: 'Pettengill, G. H., & Dyce, R. B. 1965, A Radar Determination of the Rotation of the Planet Mercury, Nature 206, 1240',
      url: 'https://doi.org/10.1038/2061240a0',
    },
    {
      key: 'colombo1965',
      text: 'Colombo, G. 1965, Rotational Period of the Planet Mercury, Nature 208, 575',
      url: 'https://doi.org/10.1038/208575a0',
    },
    {
      key: 'clemence1947',
      text: 'Clemence, G. M. 1947, The Relativity Effect in Planetary Motions, Rev. Mod. Phys. 19, 361',
      url: 'https://doi.org/10.1103/RevModPhys.19.361',
    },
    {
      key: 'vasavada1999',
      text: 'Vasavada, A. R., Paige, D. A., & Wood, S. E. 1999, Near-Surface Temperatures on Mercury and the Moon and the Stability of Polar Ice Deposits, Icarus 141, 179',
      url: 'https://doi.org/10.1006/icar.1999.6175',
    },
    {
      key: 'lawrence2013',
      text: 'Lawrence, D. J., et al. 2013, Evidence for Water Ice Near Mercury’s North Pole from MESSENGER Neutron Spectrometer Measurements, Science 339, 292',
      url: 'https://doi.org/10.1126/science.1229953',
    },
    {
      key: 'anderson2011',
      text: 'Anderson, B. J., et al. 2011, The Global Magnetic Field of Mercury from MESSENGER Orbital Observations, Science 333, 1859',
      url: 'https://doi.org/10.1126/science.1211001',
    },
    {
      key: 'byrne2014',
      text: 'Byrne, P. K., et al. 2014, Mercury’s global contraction much greater than earlier estimates, Nature Geosci. 7, 301',
      url: 'https://doi.org/10.1038/ngeo2097',
    },
    {
      key: 'blewett2011',
      text: 'Blewett, D. T., et al. 2011, Hollows on Mercury: MESSENGER Evidence for Geologically Recent Volatile-Related Activity, Science 333, 1856',
      url: 'https://doi.org/10.1126/science.1211681',
    },
    {
      key: 'solomon2008',
      text: 'Solomon, S. C., et al. 2008, Return to Mercury: A Global Perspective on MESSENGER’s First Mercury Flyby, Science 321, 59',
      url: 'https://doi.org/10.1126/science.1159706',
    },
    {
      key: 'margot2012',
      text: 'Margot, J.-L., et al. 2012, Mercury’s moment of inertia from spin and gravity data, J. Geophys. Res. 117, E00L09',
      url: 'https://doi.org/10.1029/2012JE004161',
    },
    {
      key: 'hauck2013',
      text: 'Hauck, S. A., et al. 2013, The curious case of Mercury’s internal structure, J. Geophys. Res. Planets 118, 1204',
      url: 'https://doi.org/10.1002/jgre.20091',
    },
    {
      key: 'peplowski2016',
      text: 'Peplowski, P. N., et al. 2016, Remote sensing evidence for an ancient carbon-bearing crust on Mercury, Nature Geosci. 9, 273',
      url: 'https://doi.org/10.1038/ngeo2669',
    },
    {
      key: 'stockman2019',
      text: 'Stockman, T., Monroe, G., & Cordner, S. 2019, Venus is not Earth’s closest neighbor, Physics Today, 12 March 2019',
      url: 'https://doi.org/10.1063/PT.6.3.20190312a',
    },
    {
      key: 'benkhoff2021',
      text: 'Benkhoff, J., et al. 2021, BepiColombo — Mission Overview and Science Goals, Space Sci. Rev. 217, 90',
      url: 'https://doi.org/10.1007/s11214-021-00861-4',
    },
  ],
};
