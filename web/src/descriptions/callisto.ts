import type { Description } from './types.ts';

/**
 * Callisto. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a map's mean brightness), the point says so. Where a figure is a model's
 * rather than a measurement, it sits under "estimated" and says which.
 */
export const CALLISTO: Description = {
  id: 'callisto',
  lead: [
    'Callisto is the most heavily cratered world known: little has happened to its surface for some four billion years except things hitting it, and it has kept nearly every scar. Earth went through the same bombardment; wind, water and moving plates erased it here, and on Callisto it is still there to read.',
    'It is the outermost of Jupiter’s four large moons, 4,821 kilometres across — almost as wide as Mercury, with a third of its mass, because it is rock and ice together. Its surface is dark, dusty ice spattered with bright craters, where impacts dug down to cleaner ice. Its largest scar, Valhalla, is a bull’s-eye of rings 4,000 kilometres across around a bright centre 600 kilometres wide.',
    'Unlike Ganymede, it seems never to have fully separated into layers: its rock and ice are only partly settled toward the centre, so its inside never got very hot. And yet Galileo’s magnetometer found at Callisto the same signal as at Europa — something under the ice that conducts electricity, most likely a salty ocean.',
    'It orbits farthest out, 1.88 million kilometres from Jupiter, once in 16.7 days, outside the rhythm that locks Io, Europa and Ganymede together and heats the inner two. It keeps one face toward Jupiter. Galileo Galilei found it in 1610, the Voyagers photographed it in 1979, and the Galileo spacecraft flew past it again and again from 1996 to 2001.',
  ],
  photos: [
    {
      file: 'photos/callisto/galileo-natural-colour-1997.webp',
      largeFile: 'photos/callisto/galileo-natural-colour-1997-large.webp',
      width: 372,
      height: 344,
      title: 'Callisto in approximate natural colour, 5 November 1997',
      caption:
        'The Jupiter-facing side from 68,400 km, with Valhalla’s bright centre just above the middle, from Galileo’s near-infrared, green and violet filters at 14 km per pixel. The published image sets this beside a false-colour version; this is its natural-colour half.',
      colour: 'true',
      credit: 'NASA/JPL/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '1997-11-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA01298',
    },
    {
      file: 'photos/callisto/galileo-global-colour-2001.webp',
      largeFile: 'photos/callisto/galileo-global-colour-2001-large.webp',
      width: 640,
      height: 651,
      title: 'The only complete colour globe, May 2001',
      caption:
        'Galileo’s one complete global colour image of Callisto. Bright scars on a darker surface: the bright areas are thought to be mainly ice, the dark ones eroded, ice-poor material. Its pinks and blues are much stronger than in the natural-colour view above, so its colour has been stretched.',
      colour: 'false',
      credit: 'NASA/JPL/DLR',
      licence: 'NASA media, not copyrighted',
      date: '2001-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA03456',
    },
    {
      file: 'photos/callisto/voyager-2-1979.webp',
      largeFile: 'photos/callisto/voyager-2-1979-large.webp',
      width: 640,
      height: 640,
      title: 'Callisto from Voyager 2, 7 July 1979',
      caption:
        'From 1.1 million km, contrast enhanced: craters to the horizon, the bright ones younger, having exposed fresh ice. Another ring structure is at the top. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1979-07-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA02253',
    },
    {
      file: 'photos/callisto/galileo-valhalla-1997.webp',
      largeFile: 'photos/callisto/galileo-valhalla-1997-large.webp',
      width: 640,
      height: 491,
      title: 'Valhalla',
      caption:
        'A global view of 5 November 1997, in colour, with Valhalla’s bright centre, and part of its rings at 400 m per pixel from 25 June 1997, in black and white: the outer rings are troughs, probably fractures in the crust made by the impact.',
      colour: 'true',
      credit: 'NASA/JPL/Arizona State University',
      licence: 'NASA media, not copyrighted',
      date: '1997',
      sourceUrl: 'https://images.nasa.gov/details/PIA01649',
    },
    {
      file: 'photos/callisto/galileo-landslides-1997.webp',
      largeFile: 'photos/callisto/galileo-landslides-1997-large.webp',
      width: 640,
      height: 800,
      title: 'Landslides inside craters, 16 September 1997',
      caption:
        'Two landslides 3 to 3.5 km long inside craters, on a patch 55 by 44 km seen at 100 m per pixel. With no air or water to lubricate them they still ran kilometres, which suggests very fine-grained surface material. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/Arizona State University',
      licence: 'NASA media, not copyrighted',
      date: '1997-09-16',
      sourceUrl: 'https://images.nasa.gov/details/PIA01095',
    },
    {
      file: 'photos/callisto/new-horizons-2007.webp',
      largeFile: 'photos/callisto/new-horizons-2007-large.webp',
      width: 500,
      height: 302,
      title: 'Callisto from New Horizons, February 2007',
      caption:
        'From 4.7 and 4.2 million km, on the far side of Jupiter as New Horizons passed on its way to Pluto. Every bright spot is a crater; Valhalla is the bright patch at ten o’clock. Black and white.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2007-02',
      sourceUrl: 'https://images.nasa.gov/details/PIA09258',
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
      text: 'JPL’s table is fetched for one year either side of the day the data were built, a sample every sixteen hours. Outside that year it is carried on from its orbital elements and marked approximate — still on its orbit, no longer exactly where it is.',
    },
    {
      title: 'Its face to Jupiter',
      text: 'Turned by the IAU’s model, periodic terms included, so the same face stays toward Jupiter. The IAU gives it one radius, so it is drawn as a sphere.',
      cite: ['archinal2018'],
    },
    {
      title: 'Its map, in grey',
      text: 'USGS’s global mosaic of Voyager and Galileo images; its longitude was checked here against Valhalla. Black and white because it was mapped through a clear filter. Galileo left gaps near the poles, 4 to 5% of the map, filled with the average of the rest. At 2,048 pixels round, each pixel is about 7.4 km at the equator, worked out here.',
    },
    {
      title: 'Far too dark',
      text: 'The map’s average, read as how much light the surface reflects, is 0.05; the Moon’s map averages 0.48. Callisto, dark as it is, really reflects more light than the Moon — geometric albedo 0.19 against 0.12 — so beside the Moon it is drawn about fifteen times too dark. Worked out here from the two maps’ pixels and the fact sheets.',
      cite: ['nssdcJovian', 'nssdcMoon'],
    },
    {
      title: 'Lighting',
      text: 'In Natural lighting, the default, its night side is black. Shadow and Flood lighting fill it in so it can be read; neither is what an eye would see.',
    },
    {
      title: 'Shadows',
      text: 'Callisto goes dark when it passes through Jupiter’s shadow — which, so far out, it misses altogether for years at a time, whenever Jupiter’s pole is tipped toward or away from the Sun. Its own shadow on Jupiter is the softest of the four moons’: a black core about 1,600 km across in a grey penumbra 8,000 km wide.',
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 2,410.3 km, 4,821 km across: 99% of Mercury’s width. Mass 1.08 × 10²³ kg, a third of Mercury’s and 1.5 Moons; mean density 1.83 g/cm³, the lowest of the four large moons. Gravity at the surface 1.24 m/s². The comparisons are worked out here from the fact sheets.',
      cite: ['jplSats', 'nssdcJovian', 'nssdcGalilean', 'nssdcMercury', 'nssdcMoon'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 1,882,700 km from Jupiter’s centre, 26.3 Jupiter radii; one orbit in 16.689 days, at 8.2 km/s; eccentricity 0.007, tilted 0.19° to Jupiter’s equator. Its period is 2.33 times Ganymede’s, worked out here: no simple ratio, so it is outside the resonance of the inner three.',
      cite: ['nssdcJovian', 'nssdcGalilean'],
    },
    {
      title: 'Surface',
      text: 'Geometric albedo 0.19, the darkest of the four; mean temperature about −155 °C. NASA calls it the most heavily cratered object in the Solar System, and its surface dates back more than four billion years.',
      cite: ['nssdcJovian', 'nssdcGalilean', 'nasaCallisto', 'pia02253'],
    },
    {
      title: 'Valhalla',
      text: 'A multi-ring impact structure about 4,000 km across around a bright centre about 600 km wide; its outer rings are troughs, probably fractures the impact made in the crust.',
      cite: ['pia01649'],
    },
    {
      title: 'A smooth dark blanket',
      text: 'Galileo’s closest images, down to 30 m per pixel, found surprisingly few small craters: a dark, smooth layer covers much of the surface, and the small craters seem to have been eroded away, perhaps as ice sublimates and leaves the dark dust behind.',
      cite: ['greeley2000', 'pia01297'],
    },
    {
      title: 'Its inside, from its gravity',
      text: 'Galileo’s flybys give a moment of inertia of 0.3549 — far higher than Ganymede’s 0.31 — so its mass is much less concentrated toward the centre.',
      cite: ['anderson2001', 'anderson1998'],
    },
    {
      title: 'A conducting layer',
      text: 'Galileo’s magnetometer found a field induced inside Callisto by Jupiter’s changing field, as at Europa: the sign of a layer, beneath the ice, that conducts electricity.',
      cite: ['khurana1998', 'zimmer2000'],
    },
  ],
  estimated: [
    {
      title: 'Only partly separated',
      text: 'Read through a model that assumes Callisto has relaxed to the shape its spin and Jupiter’s tides would give a fluid, its moment of inertia means rock and ice only partly settled apart — a mixed interior of rock and ice under an icy outer layer, with no need for a separate metal core.',
      cite: ['anderson1998', 'anderson2001'],
    },
    {
      title: 'An ocean',
      text: 'A salty ocean under the ice is what best fits the induced field, though its depth, thickness and saltiness are those of the models fitted to the signal.',
      cite: ['khurana1998', 'zimmer2000'],
    },
  ],
  missing: [
    {
      title: 'Its colour',
      text: 'Not drawn: the map is grey. The real Callisto is a dark brownish grey with bright, bluish-white craters, as in the natural-colour photograph above.',
      cite: ['pia01298'],
    },
    {
      title: 'Its relief',
      text: 'Not drawn: the rings of Valhalla and the crater rims are a picture on a smooth sphere, and cast no shadows.',
      cite: ['pia01649'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not just an icy Moon',
      text: 'It looks cratered like the Moon, but it is half as dense (1.83 g/cm³ against 3.34), made of ice and rock rather than rock, and its surface is short of the small craters that crowd the Moon’s.',
      cite: ['nssdcGalilean', 'nssdcMoon', 'greeley2000'],
    },
    {
      title: 'Old outside is not dead inside',
      text: 'Its surface has barely changed in four billion years, and still the magnetometer data point to liquid water underneath.',
      cite: ['pia02253', 'khurana1998'],
    },
    {
      title: 'It is not the smallest of the four',
      text: 'It is the darkest and the farthest, but it is the second largest, after Ganymede; Europa is the smallest.',
      cite: ['jplSats'],
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
      text: 'JPL Solar System Dynamics, Planetary Satellite Physical Parameters (GM from JUP365; mean radius from the IAU 2015 report)',
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
      key: 'anderson1998',
      text: 'Anderson, J. D., et al. 1998, Distribution of Rock, Metals, and Ices in Callisto, Science 280, 1573',
      url: 'https://doi.org/10.1126/science.280.5369.1573',
    },
    {
      key: 'anderson2001',
      text: 'Anderson, J. D., et al. 2001, Shape, Mean Radius, Gravity Field, and Interior Structure of Callisto, Icarus 153, 157',
      url: 'https://doi.org/10.1006/icar.2001.6664',
    },
    {
      key: 'khurana1998',
      text: 'Khurana, K. K., et al. 1998, Induced magnetic fields as evidence for subsurface oceans in Europa and Callisto, Nature 395, 777',
      url: 'https://doi.org/10.1038/27394',
    },
    {
      key: 'zimmer2000',
      text: 'Zimmer, C., Khurana, K. K., & Kivelson, M. G. 2000, Subsurface Oceans on Europa and Callisto: Constraints from Galileo Magnetometer Observations, Icarus 147, 329',
      url: 'https://doi.org/10.1006/icar.2000.6456',
    },
    {
      key: 'greeley2000',
      text: 'Greeley, R., et al. 2000, Galileo views of the geology of Callisto, Planet. Space Sci. 48, 829',
      url: 'https://doi.org/10.1016/S0032-0633(00)00050-7',
    },
    {
      key: 'nasaCallisto',
      text: 'NASA Science, Callisto (Jupiter’s moons)',
      url: 'https://science.nasa.gov/jupiter/jupiter-moons/callisto/',
    },
    {
      key: 'pia01298',
      text: 'NASA/JPL Photojournal PIA01298, Global Color Variations on Callisto (Galileo, 5 November 1997)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA01298',
    },
    {
      key: 'pia01297',
      text: 'NASA/JPL Photojournal PIA01297, View of Callisto at Increasing Resolutions (Galileo)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA01297',
    },
    {
      key: 'pia01649',
      text: 'NASA/JPL Photojournal PIA01649, The Valhalla Multi-ring Structure on Callisto (Galileo)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA01649',
    },
    {
      key: 'pia02253',
      text: 'NASA/JPL Photojournal PIA02253, Callisto (Voyager 2, 7 July 1979)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA02253',
    },
  ],
};
