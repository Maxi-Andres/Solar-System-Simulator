import type { Description } from './types.ts';

const NH_CREDIT = 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute';

/**
 * Pluto. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model. What the app draws of it
 * is read off its catalog entry (tools/src/catalog.ts), public/textures/CREDITS.md and
 * scene/shading.ts.
 */
export const PLUTO: Description = {
  id: 'pluto',
  lead: [
    'For 76 years Pluto was the ninth planet, the small cold world at the end of every schoolroom chart; in 2006 astronomers decided it was the first of a new kind of thing instead. Pluto itself did not change. When New Horizons reached it in 2015, after nine and a half years in flight, it found not a frozen leftover but a world with mountains of ice, blue skies, and a great plain of nitrogen ice so freshly renewed that not one impact crater has been found on it — a reminder that the far edge of the Solar System is not where things stop happening, only where we had stopped looking.',
    'Pluto is a dwarf planet in the Kuiper belt, the wide ring of icy bodies beyond Neptune. It is 2,377 kilometres across — about two-thirds the width of our Moon, with a sixth of its mass — a ball of rock and water ice under a skin of frozen nitrogen, methane and carbon monoxide. It reflects about half the sunlight that falls on it, and its colours run from almost white to a deep reddish brown, the red coming from organic compounds made when sunlight and radiation break up methane.',
    'Its best-known feature is the pale “heart” New Horizons photographed. The left lobe, Sputnik Planitia, is a basin filled with nitrogen ice that slowly churns like a lava lamp, in cells tens of kilometres wide, renewing its surface so fast that it is no more than about ten million years old. Mountains of water ice up to 3.5 kilometres high stand at its edge, glaciers of nitrogen flow into it, and over everything lies a thin atmosphere of nitrogen with more than a dozen layers of haze, which scatter sunlight blue. The shape of the basin and its position suggest there may still be a liquid ocean beneath the ice.',
    'Pluto is not alone. Charon, its largest moon, is half its width, and the two turn round a point in space between them, each always showing the other the same face; four small moons, Styx, Nix, Kerberos and Hydra, circle the pair. In 2006 the International Astronomical Union defined a planet as a round body orbiting the Sun that has also cleared the neighbourhood of its orbit. Pluto shares its zone with thousands of other Kuiper belt objects, so it became a “dwarf planet”, the prototype of a new category. The decision followed the discovery of Eris, which first seemed larger than Pluto: either the list of planets would keep growing, or a line had to be drawn. Many planetary scientists still disagree with where it was drawn.',
    'Pluto takes 248 years to go round the Sun, on an orbit so stretched and tilted that it ranges from 30 to 49 times Earth’s distance, and from 1979 to 1999 it was closer to the Sun than Neptune. The two never come near each other: Pluto goes round exactly twice for every three of Neptune’s orbits. Sunlight takes about five and a half hours to reach it at its average distance. Its day is 6.4 Earth days long, and it spins on its side, its axis tipped about 120°, so that it turns backwards with respect to its orbit.',
  ],
  photos: [
    {
      file: 'photos/pluto/true-colour-2015.webp',
      largeFile: 'photos/pluto/true-colour-2015-large.webp',
      width: 640,
      height: 360,
      title: 'Pluto in true colour, July 2015',
      caption:
        'Four LORRI images, taken from 450,000 km, combined with colour from the Ralph camera, as an eye would see it: pale tans and the dark red-brown band of Cthulhu at lower left, beside the bright “heart”. The lower right edge has less colour coverage.',
      colour: 'true',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA19857',
    },
    {
      file: 'photos/pluto/pluto-charon-portrait.webp',
      largeFile: 'photos/pluto/pluto-charon-portrait-large.webp',
      width: 640,
      height: 360,
      title: 'Pluto and Charon together, July 2015',
      caption:
        'Two New Horizons images taken a day apart and set side by side, in approximately true colour, with their sizes, brightness and orientation approximated; their real separation is far greater. Pluto is tan, Charon grey.',
      colour: 'true',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-13/14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19717',
    },
    {
      file: 'photos/pluto/blue-haze-crescent.webp',
      largeFile: 'photos/pluto/blue-haze-crescent-large.webp',
      width: 640,
      height: 360,
      title: 'Pluto’s blue haze, looking back at the Sun',
      caption:
        'Taken 3.5 hours after closest approach, from 200,000 km, with the Sun behind Pluto: its atmosphere glows in layers of haze. The blue is real, in approximate true colour — the tiny haze particles scatter blue light, as haze can on Earth. Six LORRI images with colour from the Ralph camera.',
      colour: 'true',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA21590',
    },
    {
      file: 'photos/pluto/mountains-haze.webp',
      largeFile: 'photos/pluto/mountains-haze-large.webp',
      width: 640,
      height: 273,
      title: 'Mountains, ice plains and haze at sunset',
      caption:
        'Fifteen minutes after closest approach, from 18,000 km, looking back towards the Sun: the flat ice of Sputnik Planitia on the right, rugged mountains up to 3,500 m high on the left, and more than a dozen layers of haze above the horizon. The scene is 1,250 km wide. Black and white: LORRI has no colour filters.',
      colour: 'true',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19948',
    },
    {
      file: 'photos/pluto/enhanced-colour.webp',
      largeFile: 'photos/pluto/enhanced-colour-large.webp',
      width: 640,
      height: 640,
      title: 'Pluto’s colours, exaggerated',
      caption:
        'The Ralph camera’s blue, red and near-infrared images, with the differences between them stretched into blues, yellows, oranges and deep reds, so that terrains of different make-up stand apart. Pluto does not look like this; the true-colour view above is what an eye would see.',
      colour: 'false',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19952',
    },
    {
      file: 'photos/pluto/close-up-strip.webp',
      largeFile: 'photos/pluto/close-up-strip-large.webp',
      width: 640,
      height: 160,
      title: 'The sharpest strip, 77–85 m a pixel',
      caption:
        'An 80 km-wide strip taken from 17,000 km, about 15 minutes before closest approach: from cratered badlands on the left, across the jumbled blocks of the al-Idrisi mountains, to the edge of Sputnik Planitia’s ice plain, divided into cells, on the right. LORRI images with lower-resolution colour added, enhanced.',
      colour: 'false',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA20213',
    },
    {
      file: 'photos/pluto/hubble-2002-2003.webp',
      largeFile: 'photos/pluto/hubble-2002-2003-large.webp',
      width: 640,
      height: 512,
      title: 'The best view before New Horizons: Hubble, 2002–2003',
      caption:
        'Not single photographs: a map built from many Hubble images, each Pluto only a few pixels across, drawn on a globe at twelve longitudes, with colour worked out from two filters to approximate what an eye would see. Bright and dark patches, and nothing sharper — all anyone could see of Pluto until 2015.',
      colour: 'true',
      credit: 'NASA, ESA, and M. Buie (Southwest Research Institute)',
      licence: 'NASA media, not copyrighted',
      date: '2002–2003',
      sourceUrl: 'https://images.nasa.gov/details/PIA18179',
    },
  ],
  drawnHere: [
    {
      title: 'Its map',
      text: 'New Horizons’ global colour mosaic, PIA11707: images from the Ralph camera’s three colour filters, downscaled to 2,048 pixels round — about 3.6 km a pixel at the equator. The hemisphere New Horizons flew over, centred on Sputnik Planitia, is sharp; the rest was seen only from farther away, days earlier, and is blurred. NASA’s caption does not say whether its colours are natural or enhanced; beside the true-colour view above, its red band is deeper.',
      cite: ['pia11707', 'nimmo2017'],
    },
    {
      title: 'Its south is invented',
      text: 'In July 2015 Pluto’s southern hemisphere was in a polar winter night, and terrain south of about 30°S could not be photographed. The mosaic is black over 30% of its area — measured here, from about 33°S at most longitudes and from as far south as 55°S at a few; that area is filled with the average colour of the rest, rgb(135, 112, 104), blended at the edge so there is no seam. Nothing in the fill is an observation.',
      cite: ['pia21862'],
    },
    {
      title: 'Too dark',
      text: 'The map’s average brightness, measured here from the shipped file, is about 0.2 in linear terms, and it is drawn as a matte surface of that reflectance; Pluto really reflects much more of the light that falls on it: geometric albedo 0.52, Bond albedo 0.72. So Pluto is drawn several times darker than it is. (The scene’s sunlight is not dimmed with distance at all, for any body.)',
      cite: ['nssdc'],
    },
    {
      title: 'Turning backwards, in the IAU’s terms',
      text: 'The pole and the spin are the IAU’s. For a dwarf planet the IAU’s north pole is the one the spin points out of by the right-hand rule, so Pluto’s rotation angle always increases; but that pole lies 119.5° from the pole of its orbit, so it turns backwards with respect to the way it goes round the Sun — both statements describe the same rotation. The map is drawn against the same pole, which is what puts Sputnik Planitia where it is: on the side of Pluto that never faces Charon.',
      cite: ['archinal2018', 'nssdc', 'nimmo2016'],
    },
    {
      title: 'Its wobble about the barycentre',
      text: 'Pluto is drawn at its own centre, not at the centre of mass it shares with Charon, so it can be seen swinging round that point every 6.39 days. From the fact sheet’s masses and distance the point lies about 2,100 km from Pluto’s centre, some 900 km above its surface. That wobble is why Pluto is sampled every two days rather than the weeks its 248-year orbit would allow; measured against JPL, the worst interpolation error is 5.1 km.',
      cite: ['nssdc', 'de440'],
    },
    {
      title: 'Its moons',
      text: 'Charon is drawn as a body, with its own New Horizons map. Styx, Nix, Kerberos and Hydra, from the same PLU060 ephemeris, are in the Small Moons layer, off by default; their elongated shapes are drawn as spheres, at the radius JPL’s records give for each.',
      cite: ['weaver2016'],
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 1,188.3 ± 1.6 km, from the edge of its disc in New Horizons’ images, and round to within the measurement. Mass 1.303 × 10²² kg, 0.2% of Earth’s; density 1,854 kg/m³; gravity at the surface 0.62 m/s², 6% of Earth’s.',
      cite: ['nimmo2017', 'nssdc'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 5,870 million km, 39.2 times Earth’s, from 4,435 million at perihelion to 7,304 million at aphelion; eccentricity 0.24; tilted 17.2° to the ecliptic. One orbit takes 90,560 days, 248 years, at an average 4.64 km/s. From 1979 to 1999 it was nearer the Sun than Neptune.',
      cite: ['nssdc', 'nasapluto'],
    },
    {
      title: 'Its day and its tilt',
      text: 'It turns once in 153.29 hours, 6.39 days — the same time Charon takes to go round — and its axis lies 119.5° from its orbit’s, so it spins backwards.',
      cite: ['nssdc'],
    },
    {
      title: 'Discovery and name',
      text: 'Found by Clyde Tombaugh on 18 February 1930 at Lowell Observatory in Flagstaff. The name was suggested by Venetia Burney, an eleven-year-old girl in Oxford.',
      cite: ['nssdc', 'nasapluto', 'nasacharon'],
    },
    {
      title: 'Its surface',
      text: 'Ices of nitrogen, methane and carbon monoxide, moved about by sublimation, condensation and glacial flow, over a bedrock of water ice that shows through in places; provinces of very different colour. Its brightest plain, Sputnik Planitia, has no craters at all, which makes its surface no older than about 10 million years; other terrains are cratered and up to about 4 billion years old.',
      cite: ['grundy2016', 'moore2016'],
    },
    {
      title: 'Mountains and glaciers',
      text: 'Ranges of water-ice blocks up to about 3,500 m high along the edge of Sputnik Planitia, and glaciers flowing into it from the highlands to its east. Temperatures at the surface run from about −226 to −240 °C.',
      cite: ['pia19948', 'moore2016', 'nasapluto'],
    },
    {
      title: 'Atmosphere',
      text: 'About 99% nitrogen, with methane and carbon monoxide; the pressure at the surface is about 10 to 13 millionths of a bar. Haze in more than a dozen layers reaches above 200 km. Its upper atmosphere turned out colder and more compact than expected, so it escapes to space far more slowly than predicted.',
      cite: ['stern2015', 'nssdc', 'pia19948', 'gladstone2016'],
    },
    {
      title: 'Moons',
      text: 'Five: Charon, and four small ones — Styx about 10 km across, Kerberos 19 km long, Nix 48 km and Hydra 62 km. The small four are elongated, bright, and spin much faster than they go round. Nix and Hydra were found in Hubble images in 2005.',
      cite: ['nssdc', 'weaver2016', 'weaver2006'],
    },
    {
      title: 'New Horizons',
      text: 'The only spacecraft to visit. Launched on 19 January 2006, it made its closest approach at 11:49 UT on 14 July 2015 and flew on into the Kuiper belt.',
      cite: ['newhorizons'],
    },
  ],
  estimated: [
    {
      title: 'An ocean under the ice',
      text: 'Sputnik Planitia lies almost exactly on the line between Pluto and Charon, where a heavy mass would settle as Pluto’s spin and Charon’s tides turned it. A basin is a hollow, not a heavy mass — unless a liquid ocean below pushed up under the thinned crust. Without an ocean, the basin would need an implausibly thick layer of nitrogen, over 40 km. A model’s inference, not a detection.',
      cite: ['nimmo2016'],
    },
    {
      title: 'Where its haze comes from',
      text: 'Thought to be a photochemical smog: sunlight breaks up methane high in the atmosphere into hydrocarbons such as acetylene and ethylene, which gather into particles a fraction of a micrometre across and settle in layers.',
      cite: ['pia21590', 'gladstone2016'],
    },
    {
      title: 'How it got Charon',
      text: 'Simulations show that a collision between two bodies of about Pluto’s size could leave an intact Charon in orbit, much as the Moon is thought to have formed from Earth; the small moons would be debris from the same event.',
      cite: ['canup2005', 'weaver2016'],
    },
  ],
  missing: [
    {
      title: 'Its southern hemisphere',
      text: 'Not known in any detail: it was dark when New Horizons passed. The map’s south is a uniform fill.',
      cite: ['pia21862'],
    },
    {
      title: 'Its atmosphere and haze',
      text: 'Not drawn. Pluto is a bare sphere here: no thin blue limb, no haze layers 200 km high, though they are the most striking thing in New Horizons’ departing pictures.',
      cite: ['pia21590'],
    },
    {
      title: 'Its relief',
      text: 'Not drawn. The mountains, the pitted ice and the cells of Sputnik Planitia are only shades on a smooth sphere; nothing casts a shadow.',
      cite: ['moore2016'],
    },
    {
      title: 'Its seasons',
      text: 'The map is one moment, July 2015. Pluto’s surface changes as its ices move with its 248-year seasons: Hubble’s maps of 2002–2003 already differed from those of 1994.',
      cite: ['buie2010', 'grundy2016'],
    },
  ],
  misconceptions: [
    {
      title: 'It was not demoted for being small',
      text: 'The IAU’s 2006 definition asks three things of a planet: that it orbit the Sun, be massive enough to pull itself round, and have cleared the neighbourhood around its orbit. Pluto passes the first two and not the third, so it is a dwarf planet — and the IAU named it the prototype of a new category of trans-Neptunian objects. Nothing about Pluto changed; a definition did. Many planetary scientists prefer a geophysical one, by which anything massive enough to be round, Pluto and the large moons included, is a planet.',
      cite: ['iau2006', 'metzger2022'],
    },
    {
      title: 'Eris is not bigger',
      text: 'Eris was announced as larger than Pluto, and that set off the 2006 debate. Measured since, Pluto is slightly the wider, 1,188 km in radius against Eris’s 1,163 km; Eris is the more massive, by about a quarter.',
      cite: ['brown2005', 'nimmo2017', 'sicardy2011', 'brownschaller2007'],
    },
    {
      title: 'It is not a dead ball of ice',
      text: 'Its largest plain has been resurfaced within the last ten million years, its glaciers flow, its atmosphere has weather and haze, and it may hide an ocean. New Horizons was expected to find an old, cratered world.',
      cite: ['moore2016', 'stern2015', 'nimmo2016'],
    },
    {
      title: 'It will not hit Neptune',
      text: 'Its orbit crosses inside Neptune’s, but it goes round exactly twice for every three of Neptune’s orbits, a resonance that keeps the two far apart whenever Pluto crosses.',
      cite: ['cohen1965'],
    },
    {
      title: 'It is not dark',
      text: 'Its ices reflect about half the sunlight that reaches them. Even at its distance, noon on Pluto is about 300 times brighter than full moonlight on Earth.',
      cite: ['nssdc', 'nasapluto'],
    },
  ],
  sources: [
    {
      key: 'nssdc',
      text: 'Williams, D. R., Pluto Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html',
    },
    {
      key: 'nasapluto',
      text: 'NASA Science, Pluto: Facts',
      url: 'https://science.nasa.gov/dwarf-planets/pluto/facts/',
    },
    {
      key: 'nasacharon',
      text: 'NASA Science, Charon (on its discovery, near the site of Pluto’s at Lowell Observatory)',
      url: 'https://science.nasa.gov/dwarf-planets/pluto/moons/charon/',
    },
    {
      key: 'newhorizons',
      text: 'NASA Science, New Horizons (mission page)',
      url: 'https://science.nasa.gov/mission/new-horizons/',
    },
    {
      key: 'iau2006',
      text: 'International Astronomical Union 2006, Resolutions B5, Definition of a Planet in the Solar System, and B6, Pluto (XXVIth General Assembly)',
      url: 'https://www.iau.org/Iau/Publications/List-of-Resolutions/',
    },
    {
      key: 'metzger2022',
      text: 'Metzger, P. T., et al. 2022, Moons are planets: Scientific usefulness versus cultural teleology in the taxonomy of planetary science, Icarus 374, 114768',
      url: 'https://doi.org/10.1016/j.icarus.2021.114768',
    },
    {
      key: 'archinal2018',
      text: 'Archinal, B. A., et al. 2018, Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015, Celest. Mech. Dyn. Astron. 130, 22',
      url: 'https://doi.org/10.1007/s10569-017-9805-5',
    },
    {
      key: 'de440',
      text: 'Park, R. S., et al. 2021, The JPL Planetary and Lunar Ephemerides DE440 and DE441, AJ 161, 105',
      url: 'https://doi.org/10.3847/1538-3881/abd414',
    },
    {
      key: 'stern2015',
      text: 'Stern, S. A., et al. 2015, The Pluto system: Initial results from its exploration by New Horizons, Science 350, aad1815',
      url: 'https://doi.org/10.1126/science.aad1815',
    },
    {
      key: 'nimmo2017',
      text: 'Nimmo, F., et al. 2017, Mean radius and shape of Pluto and Charon from New Horizons images, Icarus 287, 12',
      url: 'https://doi.org/10.1016/j.icarus.2016.06.027',
    },
    {
      key: 'moore2016',
      text: 'Moore, J. M., et al. 2016, The geology of Pluto and Charon through the eyes of New Horizons, Science 351, 1284',
      url: 'https://doi.org/10.1126/science.aad7055',
    },
    {
      key: 'grundy2016',
      text: 'Grundy, W. M., et al. 2016, Surface compositions across Pluto and Charon, Science 351, aad9189',
      url: 'https://doi.org/10.1126/science.aad9189',
    },
    {
      key: 'gladstone2016',
      text: 'Gladstone, G. R., et al. 2016, The atmosphere of Pluto as observed by New Horizons, Science 351, aad8866',
      url: 'https://doi.org/10.1126/science.aad8866',
    },
    {
      key: 'weaver2016',
      text: 'Weaver, H. A., et al. 2016, The small satellites of Pluto as observed by New Horizons, Science 351, aae0030',
      url: 'https://doi.org/10.1126/science.aae0030',
    },
    {
      key: 'weaver2006',
      text: 'Weaver, H. A., et al. 2006, Discovery of two new satellites of Pluto, Nature 439, 943',
      url: 'https://doi.org/10.1038/nature04547',
    },
    {
      key: 'nimmo2016',
      text: 'Nimmo, F., et al. 2016, Reorientation of Sputnik Planitia implies a subsurface ocean on Pluto, Nature 540, 94',
      url: 'https://doi.org/10.1038/nature20148',
    },
    {
      key: 'canup2005',
      text: 'Canup, R. M. 2005, A Giant Impact Origin of Pluto-Charon, Science 307, 546',
      url: 'https://doi.org/10.1126/science.1106818',
    },
    {
      key: 'buie2010',
      text: 'Buie, M. W., et al. 2010, Pluto and Charon with the Hubble Space Telescope. II. Resolving changes on Pluto’s surface and a map for Charon, AJ 139, 1128',
      url: 'https://doi.org/10.1088/0004-6256/139/3/1128',
    },
    {
      key: 'cohen1965',
      text: 'Cohen, C. J., & Hubbard, E. C. 1965, Libration of the close approaches of Pluto to Neptune, AJ 70, 10',
      url: 'https://doi.org/10.1086/109674',
    },
    {
      key: 'brown2005',
      text: 'Brown, M. E., Trujillo, C. A., & Rabinowitz, D. L. 2005, Discovery of a Planetary-sized Object in the Scattered Kuiper Belt, ApJ 635, L97',
      url: 'https://doi.org/10.1086/499336',
    },
    {
      key: 'sicardy2011',
      text: 'Sicardy, B., et al. 2011, A Pluto-like radius and a high albedo for the dwarf planet Eris from an occultation, Nature 478, 493',
      url: 'https://doi.org/10.1038/nature10550',
    },
    {
      key: 'brownschaller2007',
      text: 'Brown, M. E., & Schaller, E. L. 2007, The Mass of Dwarf Planet Eris, Science 316, 1585',
      url: 'https://doi.org/10.1126/science.1139415',
    },
    {
      key: 'pia11707',
      text: 'NASA/JHUAPL/SwRI 2017, Pluto Color Map (PIA11707)',
      url: 'https://images.nasa.gov/details/PIA11707',
    },
    {
      key: 'pia21862',
      text: 'NASA/JHUAPL/SwRI 2017, Global Mosaics of Pluto and Charon (PIA21862): terrain south of about 30°S was in darkness during the flyby',
      url: 'https://images.nasa.gov/details/PIA21862',
    },
    {
      key: 'pia19948',
      text: 'NASA/JHUAPL/SwRI 2015, Pluto’s Majestic Mountains, Frozen Plains and Foggy Hazes (PIA19948)',
      url: 'https://images.nasa.gov/details/PIA19948',
    },
    {
      key: 'pia21590',
      text: 'NASA/JHUAPL/SwRI 2017, Blue Rays: New Horizons’ High-Res Farewell to Pluto (PIA21590)',
      url: 'https://images.nasa.gov/details/PIA21590',
    },
  ],
};
