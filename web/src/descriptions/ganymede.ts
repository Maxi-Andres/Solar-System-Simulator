import type { Description } from './types.ts';

/**
 * Ganymede. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a map's mean brightness), the point says so. Where a figure is a model's
 * rather than a measurement, it sits under "estimated" and says which.
 */
export const GANYMEDE: Description = {
  id: 'ganymede',
  lead: [
    'Ganymede is the largest moon in the Solar System — wider than the planet Mercury — and the only moon known to make its own magnetic field, with auroras of its own. Had it gone round the Sun instead of Jupiter, it would be called a planet: what we call a world depends on where it orbits, not on what it is.',
    'It is the third of Jupiter’s four large moons, 5,262 kilometres across, but it holds less than half Mercury’s mass, because it is made of rock and ice together. Its surface is a patchwork of two kinds of ground: dark, ancient regions crowded with craters, and paler bands of younger ice furrowed by long parallel grooves where the crust was pulled apart. Fresh craters splash bright ice across both.',
    'Inside it is layered like a planet: a metallic core, a rocky mantle and a thick shell of ice — and within the ice, very probably, an ocean of salt water. The Galileo spacecraft discovered its magnetic field in 1996, and the Hubble Space Telescope later watched its auroras sway less than they should, as if something salty and conducting beneath the surface were holding them back.',
    'It goes round Jupiter in 7.15 days, twice Europa’s period and four times Io’s, keeping one face toward the planet. Galileo Galilei found it in 1610. Juno passed 1,038 kilometres above it in June 2021, and ESA’s Juice, launched in 2023, is to end its mission in orbit around Ganymede — the first spacecraft ever to orbit a moon in the outer Solar System.',
  ],
  photos: [
    {
      file: 'photos/ganymede/galileo-natural-colour-1996.webp',
      largeFile: 'photos/ganymede/galileo-natural-colour-1996-large.webp',
      width: 640,
      height: 640,
      title: 'Ganymede in natural colour, 26 June 1996',
      caption:
        'From Galileo’s first encounter. Dark areas are the older, cratered regions; light areas, younger ground broken by faults. The brownish grey is rock mixed with ice; the bright spots are recent craters and what they threw out. The finest details are about 13 km across.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1996-06-26',
      sourceUrl: 'https://images.nasa.gov/details/PIA00716',
    },
    {
      file: 'photos/ganymede/juno-green-2021.webp',
      largeFile: 'photos/ganymede/juno-green-2021-large.webp',
      width: 579,
      height: 900,
      title: 'Juno’s close pass, 7 June 2021',
      caption:
        'JunoCam through its green filter alone, a preliminary product released on the day of the pass at 1,038 km — the closest any craft had come in more than twenty years. The seams, mostly at lower right, are where the strips the spinning spacecraft took were joined. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/SwRI/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2021-06-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA24681',
    },
    {
      file: 'photos/ganymede/juno-kittu-2021.webp',
      largeFile: 'photos/ganymede/juno-kittu-2021-large.webp',
      width: 640,
      height: 640,
      title: 'Kittu, a crater with dark rays, 7 June 2021',
      caption:
        'About 15 km across. Most of Ganymede’s craters throw out bright rays; about one in a hundred has dark ones, probably from the impactor’s own material. An enhanced-colour image made by the citizen scientist Thomas Thomopoulos from JunoCam data.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/SwRI/MSSS/Thomas Thomopoulos',
      licence: 'Processed image CC BY, from NASA images not copyrighted',
      date: '2021-06-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA25012',
    },
    {
      file: 'photos/ganymede/galileo-erech-sulcus-1997.webp',
      largeFile: 'photos/ganymede/galileo-erech-sulcus-1997-large.webp',
      width: 640,
      height: 377,
      title: 'Grooved terrain, 7 May 1997',
      caption:
        'A swath of grooves, Erech Sulcus, cutting north–south through the ancient dark terrain of Marius Regio, and cut off in turn by the smoother bright terrain of Sippar Sulcus: about 950 by 560 km at 143 m per pixel. The grooves probably formed as the icy crust was pulled apart, as in rift valleys on Earth. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/Brown University',
      licence: 'NASA media, not copyrighted',
      date: '1997-05-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA01615',
    },
    {
      file: 'photos/ganymede/new-horizons-2007.webp',
      largeFile: 'photos/ganymede/new-horizons-2007-large.webp',
      width: 380,
      height: 380,
      title: 'Ganymede from New Horizons, 27 February 2007',
      caption:
        'New Horizons’ best view, from 3.5 million km on its way to Pluto, at 17 km per pixel: dark ancient terrain broken by brighter, younger swaths, and bright fresh craters. Black and white.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2007-02-27',
      sourceUrl: 'https://images.nasa.gov/details/PIA09245',
    },
    {
      file: 'photos/ganymede/galilean-family.webp',
      largeFile: 'photos/ganymede/galilean-family-large.webp',
      width: 640,
      height: 205,
      title: 'The four Galilean moons to scale',
      caption:
        'Io, Europa, Ganymede and Callisto, from Galileo images taken on several orbits with the Sun behind the spacecraft. Ganymede, the largest, shows its Jupiter-facing side. Colours enhanced to bring out differences.',
      colour: 'false',
      credit: 'NASA/JPL/DLR',
      licence: 'NASA media, not copyrighted',
      date: '1998 (released)',
      sourceUrl: 'https://images.nasa.gov/details/PIA01400',
    },
  ],
  drawnHere: [
    {
      title: 'Which ephemeris',
      text: 'Its positions are JPL’s satellite ephemeris for Jupiter’s moons, JUP365, the same one its mass comes from — not DE441, which carries only the Sun, the planets and our Moon.',
      cite: ['jplSats'],
    },
    {
      title: 'Only near today',
      text: 'JPL’s table is fetched for one year either side of the day the data were built, a sample every eight hours. Outside that year it is carried on from its orbital elements and marked approximate — still on its orbit, no longer exactly where it is.',
    },
    {
      title: 'Its face to Jupiter',
      text: 'Turned by the IAU’s model, periodic terms included, so the same face stays toward Jupiter as it really does. The IAU gives it one radius, so it is drawn as a sphere.',
      cite: ['archinal2018'],
    },
    {
      title: 'Its map, in grey',
      text: 'USGS’s global mosaic of Voyager and Galileo images; its longitude was checked here against Galileo Regio and the crater Tros. Black and white because it was mapped through a clear filter; the colour mosaics that exist are enhanced into the ultraviolet and infrared. Galileo left gaps near the poles, 4 to 5% of the map, filled with the average of the rest. At 2,048 pixels round, each pixel is about 8.1 km at the equator, worked out here.',
    },
    {
      title: 'Far too dark',
      text: 'The map’s average, read as how much light the surface reflects, is 0.08; the Moon’s map averages 0.48. Ganymede really reflects nearly four times as much light as the Moon — geometric albedo 0.44 against 0.12 — so beside the Moon it is drawn many times too dark, and darker beside Europa’s map, 0.31, than the two really are (0.44 against 0.68). Worked out here from the maps’ pixels and the fact sheets.',
      cite: ['nssdcJovian', 'nssdcMoon'],
    },
    {
      title: 'The spacecraft',
      text: 'Juno and Juice are drawn on JPL’s trajectories. Juno’s pass of 7 June 2021, and Juice’s arrival in 2031, fall outside Ganymede’s own one-year table, where it is carried on from its elements, so the app does not promise to show them meeting where they really do.',
      cite: ['pia24681', 'esaJuice'],
    },
    {
      title: 'Lighting',
      text: 'In Natural lighting, the default, its night side is black. Shadow and Flood lighting fill it in so it can be read; neither is what an eye would see.',
    },
    {
      title: 'Shadows',
      text: 'Ganymede passes through Jupiter’s shadow on every orbit and goes dark there. Its own shadow on Jupiter is the largest of the four moons’: a black core about 3,500 km across, where Ganymede hides the whole Sun, in a grey penumbra.',
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 2,631.2 km, 5,262 km across — 8% wider than Mercury, 4,879 km. Mass 1.48 × 10²³ kg: twice the Moon’s, but only 45% of Mercury’s. Mean density 1.94 g/cm³, against Mercury’s 5.43: much of it is ice. Gravity at the surface 1.43 m/s². The comparisons are worked out here from the fact sheets.',
      cite: ['jplSats', 'nssdcJovian', 'nssdcGalilean', 'nssdcMercury', 'nssdcMoon'],
    },
    {
      title: 'The largest moon',
      text: 'Its mean radius, 2,631.2 km, is the largest of any moon’s; Titan’s, the next, is 2,574.8 km.',
      cite: ['jplSats'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 1,070,400 km from Jupiter’s centre, 15 Jupiter radii; one orbit in 7.155 days, at 10.9 km/s; eccentricity 0.001, tilted 0.18° to Jupiter’s equator. Turning once per orbit, it keeps one face toward Jupiter.',
      cite: ['nssdcJovian', 'nssdcGalilean'],
    },
    {
      title: 'Surface',
      text: 'Geometric albedo 0.44; mean temperature about −160 °C. The dark regions are old and heavily cratered; the light ones younger and broken by faults, crossed by grooves that probably formed as the crust was stretched.',
      cite: ['nssdcJovian', 'nssdcGalilean', 'pia00716', 'pia01615'],
    },
    {
      title: 'Its own magnetic field',
      text: 'Found by Galileo on its first pass, in June 1996: an internal field strong enough to carve out a small magnetosphere of its own inside Jupiter’s — the only moon known to have one.',
      cite: ['kivelson1996'],
    },
    {
      title: 'Its layers',
      text: 'Galileo’s gravity measurements give a moment of inertia of 0.3105, low enough that its mass must be concentrated toward the centre: it needs a metallic core, a rocky mantle and an outer shell of ice.',
      cite: ['anderson1996'],
    },
    {
      title: 'Its auroras, and an ocean',
      text: 'Hubble watched the two auroral ovals Ganymede’s field makes. As Jupiter’s tilted field sweeps past, they rock back and forth less than they would if nothing inside resisted the change: the best fit is a salty, electrically conducting ocean under the ice.',
      cite: ['saur2015'],
    },
    {
      title: 'Juno and Juice',
      text: 'Juno passed 1,038 km above it on 7 June 2021. ESA’s Juice launched on 14 April 2023, reaches Jupiter in July 2031, and will become the first spacecraft ever to orbit a moon in the outer Solar System, Ganymede.',
      cite: ['pia24681', 'esaJuice'],
    },
  ],
  estimated: [
    {
      title: 'The ocean',
      text: 'Inferred twice over — from Galileo’s magnetometer and from the auroras’ reduced rocking — but its depth, thickness and saltiness are those of the models fitted to the signals.',
      cite: ['saur2015'],
    },
    {
      title: 'Where the field comes from',
      text: 'A field this strong is taken to be made by a dynamo in a liquid iron core, as Earth’s is; no instrument can see the core itself.',
      cite: ['kivelson1996', 'anderson1996'],
    },
  ],
  missing: [
    {
      title: 'Its colour',
      text: 'Not drawn: the map is grey. The real Ganymede is brownish grey, darker in the old terrain and paler in the young, as in the natural-colour photograph above.',
      cite: ['pia00716'],
    },
    {
      title: 'Its magnetosphere and auroras',
      text: 'Not drawn: the app models a magnetosphere and auroras only for Earth.',
      cite: ['kivelson1996', 'saur2015'],
    },
    {
      title: 'Its relief',
      text: 'Not drawn: the grooves and crater rims are a picture on a smooth sphere, and cast no shadows.',
      cite: ['pia01615'],
    },
  ],
  misconceptions: [
    {
      title: 'Titan is not the largest moon',
      text: 'Its thick, hazy atmosphere makes it look bigger than it is; its solid body is 2,574.8 km in radius, Ganymede’s 2,631.2.',
      cite: ['jplSats'],
    },
    {
      title: 'Bigger than Mercury is not heavier',
      text: 'Ganymede is 8% wider than Mercury but has 45% of its mass: Mercury is mostly iron and rock, Ganymede rock and ice.',
      cite: ['nssdcJovian', 'nssdcMercury'],
    },
    {
      title: 'Moons can have magnetic fields',
      text: 'Ganymede generates its own, as Earth and Mercury do. No other moon is known to.',
      cite: ['kivelson1996'],
    },
  ],
  sources: [
    {
      key: 'nssdcJovian',
      text: 'Williams, D. R., Jovian Satellite Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html',
    },
    {
      key: 'nssdcGalilean',
      text: 'Williams, D. R., Solar System Small Worlds Fact Sheet (the Galilean satellites compared), NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/galileanfact_table.html',
    },
    {
      key: 'nssdcMercury',
      text: 'Williams, D. R., Mercury Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html',
    },
    {
      key: 'nssdcMoon',
      text: 'Williams, D. R., Moon Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    },
    {
      key: 'jplSats',
      text: 'JPL Solar System Dynamics, Planetary Satellite Physical Parameters (GM from JUP365 and SAT441; mean radius from the IAU 2015 report)',
      url: 'https://ssd.jpl.nasa.gov/sats/phys_par/',
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
      key: 'kivelson1996',
      text: 'Kivelson, M. G., et al. 1996, Discovery of Ganymede’s magnetic field by the Galileo spacecraft, Nature 384, 537',
      url: 'https://doi.org/10.1038/384537a0',
    },
    {
      key: 'anderson1996',
      text: 'Anderson, J. D., et al. 1996, Gravitational constraints on the internal structure of Ganymede, Nature 384, 541',
      url: 'https://doi.org/10.1038/384541a0',
    },
    {
      key: 'saur2015',
      text: 'Saur, J., et al. 2015, The search for a subsurface ocean in Ganymede with Hubble Space Telescope observations of its auroral ovals, J. Geophys. Res. Space Physics 120, 1715',
      url: 'https://doi.org/10.1002/2014JA020778',
    },
    {
      key: 'esaJuice',
      text: 'ESA, Juice factsheet',
      url: 'https://www.esa.int/Science_Exploration/Space_Science/Juice/Juice_factsheet',
    },
    {
      key: 'pia00716',
      text: 'NASA/JPL Photojournal PIA00716, Ganymede Color Global (Galileo, 26 June 1996)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA00716',
    },
    {
      key: 'pia01615',
      text: 'NASA/JPL Photojournal PIA01615, Swaths of Grooved Terrain on Ganymede (Galileo, 7 May 1997)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA01615',
    },
    {
      key: 'pia24681',
      text: 'NASA/JPL Photojournal PIA24681, Juno’s Ganymede Close-up (7 June 2021)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA24681',
    },
  ],
};
