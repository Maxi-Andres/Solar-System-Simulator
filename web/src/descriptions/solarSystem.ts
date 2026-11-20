import { SOLAR_SYSTEM_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The Solar System: no body, so opened from its breadcrumb level's panel (state/levels.ts,
 * ui/LevelFacts.tsx), and nothing in it is worked out from a body's data. Every number here is
 * from the source it cites; where a figure is a model's rather than a measurement, it sits under
 * "estimated" and says which model. What the app draws of it is read off scene/scale.ts (the
 * level's framing), core/heliosphere.ts and scene/Heliosphere.tsx, core/belt.ts, core/comets.ts
 * and tools/src/belt/sbdb.ts.
 */
export const SOLAR_SYSTEM: Description = {
  id: SOLAR_SYSTEM_DESCRIPTION_ID,
  subject: { name: 'Solar System', kind: 'our planetary system' },
  lead: [
    'Everything that has ever happened to anyone has happened inside it. Every person who has ever lived was born on one of its planets, and no one has been farther from that planet than round the Moon. Of all the craft ever launched, five are on paths that will carry them out of it for good — Pioneers 10 and 11, the two Voyagers and New Horizons — and none has left it yet. The farthest, Voyager 1, launched in 1977, came to be one light-day from Earth on 18 November 2026: it will be some 300 years reaching the inner edge of the Oort cloud, and perhaps 30,000 more crossing it.',
    'It is the Sun and everything the Sun’s gravity holds: eight planets, five dwarf planets, hundreds of moons, more than a million and a half catalogued asteroids, thousands of comets, and dust. The Sun alone has more than 99 parts in every hundred of the mass. All of it formed together, about 4.6 billion years ago, from a cloud of gas and dust that fell in on itself and flattened into a spinning disc — which is why the planets still go round in nearly one plane, all the same way. The date is read from the oldest grains in meteorites, by the decay of their uranium into lead.',
    'It is almost all empty. Sunlight takes eight minutes to reach Earth and four hours to reach Neptune, thirty times as far out; all the asteroids of the belt together weigh less than the Moon. Past Neptune lies the Kuiper belt of icy bodies, Pluto among them. At some 120 times Earth’s distance the wind of charged particles the Sun blows out is stopped by the thin gas between the stars, at a boundary called the heliopause: Voyager 1 crossed it in 2012, Voyager 2 in 2018. And far beyond, from a few thousand to perhaps a hundred thousand times Earth’s distance — a light year and a half, more than a third of the way to the nearest star — the Oort cloud is thought to hold the comets that fall in from every direction.',
    'So where does it end? Not at Pluto, and not at the heliopause either: that is where the Sun’s wind ends, not its pull. NASA counts the Voyagers as in interstellar space but still inside the Solar System, which by gravity goes on through the Oort cloud — a cloud no one has ever seen, inferred in 1950 by Jan Oort from the orbits of comets. Its outer edge is where the tides of the galaxy and the pull of passing stars take over from the Sun’s, and stars do pass: in about 1.3 million years Gliese 710 will go through the Oort cloud a sixth of a light year from the Sun. The edge is a slope, not a line.',
  ],
  photos: [
    {
      file: 'photos/voyager-1/family-portrait.webp',
      largeFile: 'photos/voyager-1/family-portrait-large.webp',
      width: 640,
      height: 192,
      title: 'The Family Portrait, 14 February 1990',
      caption:
        'The first picture of the Solar System from outside: 60 frames Voyager 1 took looking back from 32° above their plane. The Sun is the bright spot in the loop of wide-angle frames; the insets are the planets through the narrow-angle camera. Mercury was too close to the Sun to show, and Mars was lost in light scattered inside the camera.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1990-02-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA00451',
    },
    {
      file: 'photos/solar-system/messenger-portrait-2010.webp',
      largeFile: 'photos/solar-system/messenger-portrait-2010-large.webp',
      width: 640,
      height: 165,
      title: 'The same, from the inside out, 2010',
      caption:
        'MESSENGER’s answer to Voyager’s portrait, taken on its way to Mercury: 34 wide-angle frames of 3 and 16 November 2010, the planets in the narrow-angle insets — Venus, Earth and the Moon, Jupiter with its four large moons, Mars, Mercury and Saturn. Uranus and Neptune, 3.0 and 4.4 billion km away, were too faint for even its longest exposure, ten seconds; their places are marked. Part of the Milky Way is at the bottom. Black and white.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington',
      licence: 'NASA media, not copyrighted',
      date: '2010-11-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA14074',
    },
    {
      file: 'photos/earth/pale-blue-dot.webp',
      largeFile: 'photos/earth/pale-blue-dot-large.webp',
      width: 640,
      height: 800,
      title: 'The Pale Blue Dot, 14 February 1990',
      caption:
        'Earth in one of the Family Portrait’s frames, from about 6 billion km: the speck inside the band of scattered sunlight, smaller than one pixel. Green, blue and violet filters shown as red, green and blue; reprocessed in 2020 and cropped here around Earth.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech; processed by Kevin M. Gill',
      licence: 'NASA media, not copyrighted',
      date: '1990-02-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA23645',
    },
    {
      file: 'photos/saturn/day-the-earth-smiled-2013.webp',
      largeFile: 'photos/saturn/day-the-earth-smiled-2013-large.webp',
      width: 640,
      height: 249,
      title: 'The Day the Earth Smiled, 19 July 2013',
      caption:
        'Cassini in Saturn’s shadow, looking back toward the Sun: 141 wide-angle images combined in natural colour. Earth is a pale dot below the rings at lower right, clearest in the larger view. The first time the people of Earth were told in advance that their picture would be taken from so far away.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/SSI',
      licence: 'NASA media, not copyrighted',
      date: '2013-07-19',
      sourceUrl: 'https://images.nasa.gov/details/PIA17172',
    },
    {
      file: 'photos/voyager-1/earth-moon-1977.webp',
      largeFile: 'photos/voyager-1/earth-moon-1977-large.webp',
      width: 565,
      height: 790,
      title: 'Earth and the Moon, 18 September 1977',
      caption:
        'Thirteen days after launch, from 11.66 million km: the first picture of Earth and the Moon together taken by a spacecraft, both crescents, the Moon at the top. Three colour-filter images combined, and the Moon brightened three times against Earth so both show.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1977-09-18',
      sourceUrl: 'https://images.nasa.gov/details/PIA00013',
    },
    {
      file: 'photos/solar-system/artemis-ii-planets-2026.webp',
      largeFile: 'photos/solar-system/artemis-ii-planets-2026-large.webp',
      width: 640,
      height: 427,
      title: 'The Sun behind the Moon, from Orion, 6 April 2026',
      caption:
        'Taken by a camera on one of Orion’s solar wings as the Artemis II crew flew past the Moon’s far side: the Moon, much larger than the Sun from there, hid it for nearly an hour. The glow round it is zodiacal light — the Solar System’s own dust lit by the Sun — and the two bright points to the right of the Moon are Saturn and Mars.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2026-04-06',
      sourceUrl: 'https://images.nasa.gov/details/art002e015967',
    },
    {
      file: 'photos/solar-system/zodiacal-light-2021.webp',
      largeFile: 'photos/solar-system/zodiacal-light-2021-large.webp',
      width: 640,
      height: 910,
      title: 'The zodiacal light over Utah, 1 March 2021',
      caption:
        'The flat disc of the Solar System seen edge-on from inside it, as a faint cone of light rising from the horizon: sunlight scattered by the dust between the planets. The Pleiades are near the top of the cone, with Mars just below them.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '2021-03-01',
      sourceUrl: 'https://images.nasa.gov/details/PIA24432',
    },
    {
      file: 'photos/sun/eclipse-2017.webp',
      largeFile: 'photos/sun/eclipse-2017-large.webp',
      width: 640,
      height: 427,
      title: 'The corona at totality, 21 August 2017',
      caption:
        'The Moon exactly covering the Sun, seen from Earth, photographed from NASA Armstrong’s Gulfstream III: the corona, the Sun’s outer atmosphere, shows white, as it is; the red beads are sunlight through the valleys at the Moon’s edge.',
      colour: 'true',
      credit: 'NASA/Carla Thomas',
      licence: 'NASA media, not copyrighted',
      date: '2017-08-21',
      sourceUrl: 'https://images.nasa.gov/details/AFRC2017-0233-008',
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The breadcrumb’s Solar System puts the camera 188 AU from the Sun, 30° above the plane of Earth’s orbit, so that the frame’s half-height is one and a half times Neptune’s orbit: Neptune’s path is whole on any screen, and so are Pluto’s, Haumea’s and Makemake’s on a wide one; only Eris’s, out to 97 AU, runs off it. From there the inner planets are the crowd about the Sun they really are — Mars about 18 pixels from it on a 1,080-pixel screen.',
    },
    {
      title: 'Everything at its true size and distance',
      text: 'Nothing is enlarged. The planets, moons and spacecraft are where JPL’s ephemerides put them, at their real sizes, so from this view every one of them is far smaller than a pixel and is shown by its mark and its orbit; even the Sun’s disc is a tenth of a pixel, and what shows of it is its light.',
    },
    {
      title: 'Its small bodies',
      text: 'Every asteroid in JPL’s Small-Body Database — 1,580,469 when the data was built, on 16 November 2026, from the main belt to the Kuiper belt — each on its own orbit, worked out on the graphics card every frame by Kepler’s equation — the brightest 84,885 unless more are asked for in the Layers panel; and its 4,000-odd comets, each on its own path about the Sun, a third of them on parabolas or hyperbolas.',
      cite: ['sbdb'],
    },
    {
      title: 'The heliosphere',
      text: 'The four places the Voyagers crossed its two boundaries are marked where each craft was that day. Between them, Parker’s 1961 model: the termination shock a sphere at the crossings’ mean distance, 88.9 AU; the heliopause his surface r = a / cos(ν/2), with a = 111.7 AU fitted to both crossings, its nose turned to where the interstellar gas comes from, as IBEX measured it. Its tail is not known, so it is drawn only to 150° from the nose, fading from 110°.',
      cite: ['parker1961', 'mccomas2015', 'stone2005', 'stone2008', 'stone2013', 'stone2019'],
    },
    {
      title: 'The Oort cloud',
      text: 'Two shells of even, faint glow, labelled as inferred and never seen: the inner (Hills) cloud from 2,000 to 20,000 AU and the outer to 100,000, the round figures of Dones et al.’s review. Even, because its real density is itself a model’s; shown from the camera 1,000 AU out, and gone again far out among the stars.',
      cite: ['dones2004', 'hills1981'],
    },
    {
      title: 'Where the app says it ends',
      text: 'From 10,000 AU out the breadcrumb calls the view the Solar Neighbourhood, and from 150 light years the Sun’s point stops being named the Solar System. Both are conventions for naming what is on the screen, not a boundary anything physical draws.',
    },
  ],
  measured: [
    {
      title: 'What is in it',
      text: 'Eight planets; five officially named dwarf planets — Ceres, Pluto, Haumea, Makemake and Eris; hundreds of moons. The IAU’s 2006 definition is what separates a planet from a dwarf planet: a planet has cleared the neighbourhood of its orbit.',
      cite: ['iau2006', 'nasafacts'],
    },
    {
      title: 'Its age',
      text: 'The oldest solids, calcium–aluminium-rich grains in meteorites, formed 4,567.30 ± 0.16 million years ago, by the decay of uranium to lead; the round grains called chondrules began forming at the same time, over about 3 million years.',
      cite: ['connelly2012'],
    },
    {
      title: 'The Sun’s share',
      text: 'The Sun gathered more than 99% of the matter; all the asteroids together have less mass than the Moon.',
      cite: ['nasafacts', 'nasaasteroids'],
    },
    {
      title: 'Its small bodies, catalogued',
      text: 'JPL’s Small-Body Database held 1,580,469 asteroids with orbits on 16 November 2026. The main belt alone is estimated to hold between 1.1 and 1.9 million asteroids larger than a kilometre, and millions of smaller ones.',
      cite: ['sbdb', 'nasaasteroids'],
    },
    {
      title: 'The heliosphere’s boundaries, crossed',
      text: 'Voyager 1 crossed the termination shock, where the solar wind drops below the speed of sound, on 16 December 2004 at 94.0 AU; Voyager 2 at 83.7 AU in 2007, on the other side of the Sun’s path. Voyager 1 crossed the heliopause, into the gas between the stars, on 25 August 2012 at 121.6 AU; Voyager 2 on 5 November 2018 at 119.0 AU. These four points are all of it that has been measured in place.',
      cite: ['stone2005', 'stone2008', 'stone2013', 'stone2019'],
    },
    {
      title: 'One light-day',
      text: 'Voyager 1 came to be one light-day from Earth, more than 16 billion miles, on 18 November 2026: the first thing people made to be that far.',
      cite: ['svs15120'],
    },
  ],
  estimated: [
    {
      title: 'The Oort cloud',
      text: 'Never seen: inferred by Oort from the original orbits of long-period comets, which fall in from every direction from very far out. NASA gives it as a shell from 5,000 to 100,000 AU, as far as 1.6 light years; Hills proposed an inner, denser part, from about 2,000 AU.',
      cite: ['oort1950', 'hills1981', 'nasafacts'],
    },
    {
      title: 'How far the Sun’s pull reaches',
      text: 'Its gravity may hold things out to about 2 light years, beyond which the galaxy’s tides and passing stars win.',
      cite: ['voyagerfaq'],
    },
    {
      title: 'The heliosphere’s shape',
      text: 'Not known past the four crossings. Its tail is a long comet’s tail in the classic models, two lobes in Opher et al.’s, and almost a sphere in Dialynas et al.’s reading of the energetic atoms it sends back.',
      cite: ['parker1961', 'opher2015', 'dialynas2017'],
    },
    {
      title: 'A star through the Oort cloud',
      text: 'Gliese 710 will pass 0.052 parsecs from the Sun, about 10,700 AU, in 1.29 million years — through the Oort cloud — from Gaia DR3’s measurements of its motion.',
      cite: ['delafuente2022'],
    },
    {
      title: 'Its orbit round the galaxy',
      text: 'The whole Solar System goes round the centre of the Milky Way at about 828,000 km/h, once in about 230 million years.',
      cite: ['nasafacts'],
    },
  ],
  missing: [
    {
      title: 'Anything in the Oort cloud',
      text: 'No object has been seen in it, and there are no images of it: what is drawn is a region, and says so.',
      cite: ['nasaoort'],
    },
    {
      title: 'What has not been found',
      text: 'Only what is catalogued is drawn: most of the millions of small asteroids, and most of the Kuiper belt, are still undiscovered. So is the giant planet Batygin and Brown proposed in 2016 to explain why the orbits of the farthest known objects cluster — a hypothesis, not a body, and not drawn.',
      cite: ['nasaasteroids', 'batygin2016'],
    },
    {
      title: 'Its dust and its wind',
      text: 'Not drawn: the dust between the planets, which is the zodiacal light, and the solar wind filling the heliosphere — only the wind’s boundaries are.',
    },
  ],
  misconceptions: [
    {
      title: 'It does not end at Pluto',
      text: 'Pluto’s orbit runs from 4,435 to 7,304 million km from the Sun, 30 to 49 AU; the heliopause is about 120 AU out; the Oort cloud is thought to reach 100,000. Pluto is nearer the Sun than the Solar System’s edge by a factor of thousands.',
      cite: ['nssdcpluto', 'stone2013', 'nasafacts'],
    },
    {
      title: 'Voyager 1 has not left it',
      text: 'It left the heliosphere, the bubble of the Sun’s wind, in 2012, and is in interstellar space — but by NASA’s definition still inside the Solar System, which goes on through the Oort cloud it will not reach for some 300 years.',
      cite: ['voyagerfaq'],
    },
    {
      title: 'The pictures of it are not to scale',
      text: 'Earth is 12,742 km across and 150 million km from the Sun: drawn with both true, as here, every planet is a speck. A picture where the planets can be seen side by side has shrunk the distances between them by a factor of thousands.',
    },
    {
      title: 'The asteroid belt is not crowded',
      text: 'All its asteroids together have less mass than the Moon, spread round an orbit hundreds of millions of kilometres long.',
      cite: ['nasaasteroids'],
    },
  ],
  sources: [
    {
      key: 'nasafacts',
      text: 'NASA Science, Solar System: Facts',
      url: 'https://science.nasa.gov/solar-system/solar-system-facts/',
    },
    {
      key: 'iau2006',
      text: 'International Astronomical Union 2006, Resolutions B5, Definition of a Planet in the Solar System, and B6, Pluto (XXVIth General Assembly)',
      url: 'https://www.iau.org/Iau/Publications/List-of-Resolutions/',
    },
    {
      key: 'connelly2012',
      text: 'Connelly, J. N., et al. 2012, The Absolute Chronology and Thermal Processing of Solids in the Solar Protoplanetary Disk, Science 338, 651',
      url: 'https://doi.org/10.1126/science.1226919',
    },
    {
      key: 'nssdcpluto',
      text: 'Williams, D. R., Pluto Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html',
    },
    {
      key: 'nasaasteroids',
      text: 'NASA Science, Asteroids: Facts',
      url: 'https://science.nasa.gov/solar-system/asteroids/facts/',
    },
    {
      key: 'sbdb',
      text: 'JPL Solar System Dynamics, Small-Body Database Query API (queried 16 November 2026)',
      url: 'https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html',
    },
    {
      key: 'voyagerfaq',
      text: 'NASA Science, Voyager: Frequently Asked Questions',
      url: 'https://science.nasa.gov/mission/voyager/frequently-asked-questions/',
    },
    {
      key: 'svs15120',
      text: 'NASA Scientific Visualization Studio, How Far Away Is Voyager 1? One Light-Day, Explained (12 November 2026)',
      url: 'https://svs.gsfc.nasa.gov/15120',
    },
    {
      key: 'stone2005',
      text: 'Stone, E. C., et al. 2005, Voyager 1 Explores the Termination Shock Region and the Heliosheath Beyond, Science 309, 2017',
      url: 'https://doi.org/10.1126/science.1117684',
    },
    {
      key: 'stone2008',
      text: 'Stone, E. C., et al. 2008, An asymmetric solar wind termination shock, Nature 454, 71',
      url: 'https://doi.org/10.1038/nature07022',
    },
    {
      key: 'stone2013',
      text: 'Stone, E. C., et al. 2013, Voyager 1 Observes Low-Energy Galactic Cosmic Rays in a Region Depleted of Heliospheric Ions, Science 341, 150',
      url: 'https://doi.org/10.1126/science.1236408',
    },
    {
      key: 'stone2019',
      text: 'Stone, E. C., et al. 2019, Cosmic ray measurements from Voyager 2 as it crossed into interstellar space, Nature Astronomy 3, 1013',
      url: 'https://doi.org/10.1038/s41550-019-0928-3',
    },
    {
      key: 'parker1961',
      text: 'Parker, E. N. 1961, The Stellar-Wind Regions, ApJ 134, 20',
      url: 'https://doi.org/10.1086/147124',
    },
    {
      key: 'mccomas2015',
      text: 'McComas, D. J., et al. 2015, Local Interstellar Medium: Six Years of Direct Sampling by IBEX, ApJS 220, 22',
      url: 'https://doi.org/10.1088/0067-0049/220/2/22',
    },
    {
      key: 'opher2015',
      text: 'Opher, M., et al. 2015, Magnetized Jets Driven by the Sun: The Structure of the Heliosphere Revisited, ApJ 800, L28',
      url: 'https://doi.org/10.1088/2041-8205/800/2/L28',
    },
    {
      key: 'dialynas2017',
      text: 'Dialynas, K., et al. 2017, The bubble-like shape of the heliosphere observed by Voyager and Cassini, Nature Astronomy 1, 0115',
      url: 'https://doi.org/10.1038/s41550-017-0115',
    },
    {
      key: 'oort1950',
      text: 'Oort, J. H. 1950, The structure of the cloud of comets surrounding the Solar System and a hypothesis concerning its origin, Bull. Astron. Inst. Netherlands 11, 91',
      url: 'https://ui.adsabs.harvard.edu/abs/1950BAN....11...91O',
    },
    {
      key: 'hills1981',
      text: 'Hills, J. G. 1981, Comet showers and the steady-state infall of comets from the Oort cloud, AJ 86, 1730',
      url: 'https://doi.org/10.1086/113058',
    },
    {
      key: 'dones2004',
      text: 'Dones, L., Weissman, P. R., Levison, H. F., & Duncan, M. J. 2004, Oort cloud formation and dynamics, in Comets II, 153',
      url: 'https://ui.adsabs.harvard.edu/abs/2004come.book..153D',
    },
    {
      key: 'nasaoort',
      text: 'NASA Science, Oort Cloud',
      url: 'https://science.nasa.gov/solar-system/oort-cloud/',
    },
    {
      key: 'delafuente2022',
      text: 'de la Fuente Marcos, R., & de la Fuente Marcos, C. 2022, An Update on the Future Flyby of Gliese 710 to the Solar System Using Gaia DR3, RNAAS 6, 136',
      url: 'https://doi.org/10.3847/2515-5172/ac7b95',
    },
    {
      key: 'batygin2016',
      text: 'Batygin, K., & Brown, M. E. 2016, Evidence for a Distant Giant Planet in the Solar System, AJ 151, 22',
      url: 'https://doi.org/10.3847/0004-6256/151/2/22',
    },
  ],
};
