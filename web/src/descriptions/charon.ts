import type { Description } from './types.ts';

const NH_CREDIT = 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute';

/**
 * Charon. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model. What the app draws of it
 * is read off its catalog entry (tools/src/catalog.ts, moonRotation.ts) and
 * public/textures/CREDITS.md.
 */
export const CHARON: Description = {
  id: 'charon',
  lead: [
    'Charon is less a moon than a partner. It is half Pluto’s width, heavy enough that the two swing together round a point in the empty space between them, and over billions of years each has slowed the other until both keep the same face turned to each other for ever. From one side of Pluto, Charon hangs in the sky without rising or setting; from the other side it is never seen at all. A pair of worlds that have settled into a permanent, mutual gaze.',
    'Charon is the largest of Pluto’s five moons, 1,212 kilometres across — more than half of Pluto’s 2,377 — the largest moon in the Solar System relative to the body it orbits. It is made of water ice and rock, about 1.7 times as dense as water, and is grey where Pluto is tan and red, except for a dark reddish cap over its north pole.',
    'That cap, nicknamed Mordor Macula, is thought to be painted by Pluto: gas escaping from Pluto’s atmosphere freezes onto Charon’s pole in its decades-long winter night, and is turned by sunlight into reddish compounds. Below it, a belt of canyons longer and deeper than the Grand Canyon crosses the moon, cracks thought to have opened as an ancient ocean froze and expanded, and south of them lie smoother plains resurfaced long ago, probably from inside. Charon has no atmosphere, and it seems to have been quiet for about four billion years.',
    'It was found in 1978, at the U.S. Naval Observatory in Flagstaff, by James Christy, who noticed that Pluto’s blurry image grew a bump that came and went every 6.4 days. He named it after the ferryman of the dead in Greek myth — its first letters also those of his wife, Charlene.',
    'Charon goes round Pluto every 6.39 days, 19,600 kilometres away — twenty times closer than our Moon is to Earth — exactly as long as Pluto takes to turn. The pair is thought to have formed in a collision between two large bodies early in the Solar System, much as Earth and the Moon may have; Pluto’s four small moons may be debris from the same impact. New Horizons photographed it on 14 July 2015.',
  ],
  photos: [
    {
      file: 'photos/pluto/pluto-charon-portrait.webp',
      largeFile: 'photos/pluto/pluto-charon-portrait-large.webp',
      width: 640,
      height: 360,
      title: 'Charon beside Pluto, July 2015',
      caption:
        'Two New Horizons images a day apart set side by side in approximately true colour, sizes and brightness approximated; the real gap is far wider. Charon is grey, Pluto tan.',
      colour: 'true',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-13/14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19717',
    },
    {
      file: 'photos/charon/lorri-2015.webp',
      largeFile: 'photos/charon/lorri-2015-large.webp',
      width: 640,
      height: 640,
      title: 'Charon, 10 hours before closest approach',
      caption:
        'From 470,000 km, features down to about 4.6 km: the dark north polar region at the top, the belt of canyons across the middle, cratered ground at upper left and smoother, fractured plains at lower right. Black and white: LORRI has no colour filters.',
      colour: 'true',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19932',
    },
    {
      file: 'photos/charon/serenity-chasma.webp',
      largeFile: 'photos/charon/serenity-chasma-large.webp',
      width: 617,
      height: 342,
      title: 'Serenity Chasma, a canyon on Charon',
      caption:
        'One of the canyons of the belt that crosses Charon, from 78,700 km, with signs of long landslides down its walls. The scale bar at upper left is NASA’s. Black and white, as LORRI takes them.',
      colour: 'true',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA21128',
    },
    {
      file: 'photos/charon/plutoshine.webp',
      largeFile: 'photos/charon/plutoshine-large.webp',
      width: 640,
      height: 769,
      title: 'Charon’s night side, lit by Pluto',
      caption:
        'Taken a day after the flyby, 150,000 km beyond Pluto, looking back: Charon’s dark side is faintly lit by sunlight reflected off Pluto, its south — which was in a winter night — glimpsed this way. The bright crescent on the right is the sunlit edge, overexposed. Stars behind. Black and white.',
      colour: 'true',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-15',
      sourceUrl: 'https://images.nasa.gov/details/PIA11708',
    },
    {
      file: 'photos/charon/enhanced-colour.webp',
      largeFile: 'photos/charon/enhanced-colour-large.webp',
      width: 640,
      height: 640,
      title: 'Charon in enhanced colour',
      caption:
        'The Ralph camera’s blue, red and near-infrared images combined and stretched to show differences in the surface: the reddish polar cap, Mordor Macula, at the top, the canyon belt across the middle. Its real colours are more muted; Charon is mostly grey.',
      colour: 'false',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19968',
    },
    {
      file: 'photos/charon/with-pluto.webp',
      largeFile: 'photos/charon/with-pluto-large.webp',
      width: 640,
      height: 640,
      title: 'Two different worlds, processed alike',
      caption:
        'Charon (upper left) and Pluto in enhanced colour, both treated the same way so they can be compared: Charon’s red pole matches the red of Pluto’s equatorial band. Relative sizes about right; the distance between them is not.',
      colour: 'false',
      credit: NH_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA19966',
    },
    {
      file: 'photos/charon/hubble-1994.webp',
      largeFile: 'photos/charon/hubble-1994-large.webp',
      width: 640,
      height: 333,
      title: 'Pluto and Charon from Hubble, 21 February 1994',
      caption:
        'Through ESA’s Faint Object Camera, the clearest view of the pair before New Horizons: two blurred discs, Pluto at lower left, Charon at upper right. Single-band images shown in a false orange scale.',
      colour: 'tinted',
      credit: 'Dr. R. Albrecht, ESA/ESO Space Telescope European Coordinating Facility; NASA',
      licence: 'NASA media; credit requested',
      date: '1994-02-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA00827',
    },
    {
      file: 'photos/charon/hubble-nix-hydra.webp',
      largeFile: 'photos/charon/hubble-nix-hydra-large.webp',
      width: 504,
      height: 504,
      title: 'Pluto, Charon, Nix and Hydra from Hubble',
      caption:
        'Pluto is the bright centre with its diffraction spikes, Charon just beside it, and the two faint dots to the right are Nix and Hydra, the small moons Hubble found in 2005. A single band, tinted blue.',
      colour: 'tinted',
      credit: 'NASA, ESA, H. Weaver (JHUAPL), A. Stern (SwRI), and the HST Pluto Companion Search Team',
      licence: 'NASA media, not copyrighted',
      date: '2006-02-15',
      sourceUrl: 'https://images.nasa.gov/details/PIA12453',
    },
  ],
  drawnHere: [
    {
      title: 'Its map',
      text: 'USGS’s global mosaic from New Horizons’ LORRI and Ralph images, at 300 m a pixel, downscaled to 2,048 pixels round — about 1.9 km a pixel at the equator. It is grey: the reddish polar cap shows only as darker ground, not in its colour. The hemisphere New Horizons flew over is sharp; the far side, seen only on approach, is blurred.',
      cite: ['pia21862', 'nimmo2017'],
    },
    {
      title: 'Its south is invented',
      text: 'Terrain south of about 30°S was in a polar night during the flyby. That part of the mosaic, 35% of it, is filled with the average of what was seen. Nothing there is an observation.',
      cite: ['pia21862'],
    },
    {
      title: 'Facing Pluto',
      text: 'It turns about the same IAU pole as Pluto, at the same rate, with its prime meridian set 180° from Pluto’s, so the two stay face to face as they really do: Charon always shows Pluto the same hemisphere, and always hangs over the same side of Pluto.',
      cite: ['archinal2018', 'nssdc'],
    },
    {
      title: 'Where it is, and for how long',
      text: 'From JPL’s PLU060 ephemeris about Pluto’s own centre, every 12 hours: measured against JPL, the worst error between samples is 2.95 km, half a hundredth of its radius. Its table covers a year either side of the app’s build; outside it, Charon moves on its orbital elements, and is marked approximate.',
      cite: ['de440'],
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 606.0 ± 1.0 km, from the edge of its disc in New Horizons’ images. Mass 1.586 × 10²¹ kg, an eighth of Pluto’s; density 1,700 kg/m³; gravity at the surface 0.29 m/s².',
      cite: ['nimmo2017', 'nssdc'],
    },
    {
      title: 'Orbit',
      text: 'An average 19,596 km from Pluto, on a circular orbit in Pluto’s equator, once every 6.3872 days — Pluto’s own day, so both are locked face to face.',
      cite: ['nssdc'],
    },
    {
      title: 'Discovery',
      text: 'By James Christy and Robert Harrington at the U.S. Naval Observatory in Flagstaff in June 1978: Pluto’s photographic images were elongated, and the elongation came and went with a period of 6.39 days. Christy named it for the ferryman of Greek myth; the first four letters are those of his wife Charlene.',
      cite: ['nasacharon', 'christy1978'],
    },
    {
      title: 'Surface',
      text: 'Mostly water ice, with ammonia in small fresh craters, and much simpler in colour than Pluto: neutral grey at low latitudes, reddish around the north pole. It reflects about 42% of the light that falls on it (geometric albedo 0.42).',
      cite: ['grundy2016', 'nssdc'],
    },
    {
      title: 'Tectonics',
      text: 'A belt of canyons and scarps crosses the hemisphere New Horizons saw: the crust stretched by about 1% overall, early in its history. One canyon, Argo Chasma, is about 700 km long and up to about 9 km deep — longer than the Grand Canyon and more than five times as deep. South of the belt, smoother plains were resurfaced, probably by cryovolcanism, nearly four billion years ago. Nothing suggests activity today.',
      cite: ['beyer2017', 'nasaargo', 'moore2016'],
    },
    {
      title: 'No atmosphere',
      text: 'None was detected by New Horizons.',
      cite: ['stern2015'],
    },
  ],
  estimated: [
    {
      title: 'The red cap comes from Pluto',
      text: 'A model of Charon’s polar winters: methane escaping from Pluto is cold-trapped on Charon’s winter pole and broken down by light into heavier, reddish compounds that stay. It reproduces the observed colour pattern; it is a model, matched to images of both poles.',
      cite: ['grundy2016nature'],
    },
    {
      title: 'A frozen ocean',
      text: 'The stretching of its crust is what an ancient global ocean would do as it froze and expanded; that is the explanation its tectonics suggest, not an observation of the ocean.',
      cite: ['beyer2017'],
    },
    {
      title: 'A collision made it',
      text: 'Hydrodynamic simulations show a collision between two bodies of about Pluto’s size could leave an intact Charon in orbit; the four small moons, icy and battered, fit as debris of the same event.',
      cite: ['canup2005', 'weaver2016'],
    },
  ],
  missing: [
    {
      title: 'Its colour',
      text: 'Not drawn: the map is grey, so the red of Mordor Macula is missing.',
      cite: ['grundy2016'],
    },
    {
      title: 'Its southern hemisphere',
      text: 'Seen only faintly, by light reflected from Pluto; the map’s south is a uniform fill.',
      cite: ['pia21862', 'grundy2016nature'],
    },
    {
      title: 'Its relief',
      text: 'Not drawn: the canyons and mountains are shades on a smooth sphere, and nothing casts a shadow.',
      cite: ['beyer2017'],
    },
  ],
  misconceptions: [
    {
      title: 'Charon does not simply go round Pluto',
      text: 'Both go round their common centre of mass. Because Charon has an eighth of Pluto’s mass, that point lies about 2,100 km from Pluto’s centre — outside Pluto, some 900 km above its surface (from the fact sheet’s masses and distance). Here Pluto is drawn at its own centre, so it can be seen swinging round it.',
      cite: ['nssdc'],
    },
    {
      title: 'Its red cap is not its own',
      text: 'The reddish pole is thought to be made of material from Pluto’s atmosphere, not of anything from inside Charon.',
      cite: ['grundy2016nature'],
    },
    {
      title: 'It has no atmosphere of its own',
      text: 'Unlike Pluto, it has none that New Horizons could detect.',
      cite: ['stern2015'],
    },
  ],
  sources: [
    {
      key: 'nssdc',
      text: 'Williams, D. R., Pluto Fact Sheet (with Charon), NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html',
    },
    {
      key: 'nasacharon',
      text: 'NASA Science, Charon',
      url: 'https://science.nasa.gov/dwarf-planets/pluto/moons/charon/',
    },
    {
      key: 'nasaargo',
      text: 'NASA 2016, A ‘Super Grand Canyon’ on Pluto’s Moon Charon (Argo Chasma, about 430 miles long and up to 5.5 miles deep)',
      url: 'https://www.nasa.gov/missions/a-super-grand-canyon-on-plutos-moon-charon/',
    },
    {
      key: 'christy1978',
      text: 'Christy, J. W., & Harrington, R. S. 1978, The satellite of Pluto, AJ 83, 1005',
      url: 'https://doi.org/10.1086/112284',
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
      key: 'grundy2016',
      text: 'Grundy, W. M., et al. 2016, Surface compositions across Pluto and Charon, Science 351, aad9189',
      url: 'https://doi.org/10.1126/science.aad9189',
    },
    {
      key: 'grundy2016nature',
      text: 'Grundy, W. M., et al. 2016, The formation of Charon’s red poles from seasonally cold-trapped volatiles, Nature 539, 65',
      url: 'https://doi.org/10.1038/nature19340',
    },
    {
      key: 'beyer2017',
      text: 'Beyer, R. A., et al. 2017, Charon tectonics, Icarus 287, 161',
      url: 'https://doi.org/10.1016/j.icarus.2016.12.018',
    },
    {
      key: 'moore2016',
      text: 'Moore, J. M., et al. 2016, The geology of Pluto and Charon through the eyes of New Horizons, Science 351, 1284',
      url: 'https://doi.org/10.1126/science.aad7055',
    },
    {
      key: 'canup2005',
      text: 'Canup, R. M. 2005, A Giant Impact Origin of Pluto-Charon, Science 307, 546',
      url: 'https://doi.org/10.1126/science.1106818',
    },
    {
      key: 'weaver2016',
      text: 'Weaver, H. A., et al. 2016, The small satellites of Pluto as observed by New Horizons, Science 351, aae0030',
      url: 'https://doi.org/10.1126/science.aae0030',
    },
    {
      key: 'pia21862',
      text: 'NASA/JHUAPL/SwRI 2017, Global Mosaics of Pluto and Charon (PIA21862): terrain south of about 30°S was in darkness during the flyby',
      url: 'https://images.nasa.gov/details/PIA21862',
    },
  ],
};
