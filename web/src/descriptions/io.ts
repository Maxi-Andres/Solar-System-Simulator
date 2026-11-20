import type { Description } from './types.ts';

/**
 * Io. Every number here is from the source it cites; where one is worked out here from them
 * (a ratio, a map's mean brightness), the point says so. Where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which.
 */
export const IO: Description = {
  id: 'io',
  lead: [
    'Io is the most volcanic world we know: a moon the size of ours that never stops erupting, its face repainted so often that no impact crater has been found on it. It is a lesson in how small, regular causes add up — two neighbouring moons tug on it in rhythm, and the endless flexing is enough to melt rock.',
    'Io is the innermost of Jupiter’s four large moons, 3,643 kilometres across, a little larger than our Moon and a little heavier. It is made of rock, not ice. Hundreds of volcanoes dot it: lakes of molten lava, fields of fresh flows, and plumes of gas and frost that climb hundreds of kilometres before falling back as rings of yellow, white and red.',
    'The heat comes from Jupiter. Io goes round in 1.77 days, Europa in twice that time and Ganymede in four times; their regular tugs keep Io’s orbit slightly oval, so Jupiter’s pull on it rises and falls every orbit and its whole body is squeezed and relaxed. The friction heats its inside, and the heat leaves through its volcanoes — about a hundred thousand billion watts. Its lavas are hotter than any erupting on Earth today.',
    'It always turns the same face to Jupiter, and on every orbit it passes through Jupiter’s shadow. It loses about a tonne of gas a second to space; Jupiter’s magnetic field sweeps it up into a ring of charged particles around the planet, the Io plasma torus.',
    'Galileo Galilei found it in January 1610, with the other three. Its volcanoes were predicted in a paper published days before Voyager 1 arrived in March 1979, and found in Voyager’s own pictures a few days after. The Galileo orbiter watched them from 1996 to 2002; New Horizons, passing in 2007, caught a plume 330 kilometres high; and Juno flew close past it twice, in December 2023 and February 2024.',
  ],
  photos: [
    {
      file: 'photos/io/galileo-true-colour.webp',
      largeFile: 'photos/io/galileo-true-colour-large.webp',
      width: 640,
      height: 640,
      title: 'Io from Galileo, 3 July 1999',
      caption:
        'Galileo’s sharpest whole-disc view, 1.3 km per pixel, from 130,000 km, with the Sun almost behind the spacecraft. Its violet, green and near-infrared filters were combined to approximate what an eye would see: mostly pastel yellows and whites, with black, brown, green, orange and red around the active volcanoes.',
      colour: 'true',
      credit: 'NASA/JPL/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '1999-07-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA02308',
    },
    {
      file: 'photos/io/cassini-transit-2000.webp',
      largeFile: 'photos/io/cassini-transit-2000-large.webp',
      width: 640,
      height: 619,
      title: 'Io and its shadow crossing Jupiter, 12 December 2000',
      caption:
        'Cassini, on its way to Saturn, from 19.5 million kilometres: Io is the golden disc, its shadow the black one to its left, both against Jupiter’s clouds near the Great Red Spot. True colour from the narrow-angle camera.',
      colour: 'true',
      credit: 'NASA/JPL/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2000-12-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA02860',
    },
    {
      file: 'photos/io/voyager-loki-plume-1979.webp',
      largeFile: 'photos/io/voyager-loki-plume-1979-large.webp',
      width: 640,
      height: 751,
      title: 'The plume of Loki on the edge of Io, March 1979',
      caption:
        'Voyager 1, from about 490,000 km: the blue fountain on the left edge is the plume of the volcano Loki, and the heart-shaped ring lower down is fallout from another plume, Pele. Colour made from Voyager’s filters and stretched, as its pictures were, so it is not what an eye would see.',
      colour: 'false',
      credit: 'NASA/JPL/USGS',
      licence: 'NASA media, not copyrighted',
      date: '1979-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA00010',
    },
    {
      file: 'photos/io/new-horizons-tvashtar-2007.webp',
      largeFile: 'photos/io/new-horizons-tvashtar-2007-large.webp',
      width: 399,
      height: 852,
      title: 'The plume of Tvashtar, late February 2007',
      caption:
        'Six views by New Horizons as it passed Jupiter on the way to Pluto, from 3.1 to 2.3 million km, scaled to the same size: a plume about 330 km high, its wisps changing from frame to frame. In the last, Io’s shadow hides all but the top, and the lava at its source glows on the night side. Black and white.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Southwest Research Institute',
      licence: 'NASA media, not copyrighted',
      date: '2007-02',
      sourceUrl: 'https://images.nasa.gov/details/PIA09359',
    },
    {
      file: 'photos/io/juno-plumes-2024.webp',
      largeFile: 'photos/io/juno-plumes-2024-large.webp',
      width: 627,
      height: 351,
      title: 'Two plumes over the horizon, 3 February 2024',
      caption:
        'JunoCam, from about 3,800 km: two plumes rising side by side beyond Io’s edge, from one large volcano or two close together. Made from JunoCam’s red, green and blue images by the citizen scientist Andrea Luck; its colour balance is hers, not calibrated to an eye.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/SwRI/MSSS/Andrea Luck',
      licence: 'Processed image CC BY, from NASA images not copyrighted',
      date: '2024-02-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA26340',
    },
    {
      file: 'photos/io/juno-south-pole-2024.webp',
      largeFile: 'photos/io/juno-south-pole-2024-large.webp',
      width: 640,
      height: 640,
      title: 'The first view of Io’s south polar region, 9 April 2024',
      caption:
        'From about 16,500 km, on Juno’s 60th pass of Jupiter: the south polar region, which no earlier mission had seen well. Processed by the citizen scientists Gerald Eichstädt and Thomas Thomopoulos, its colour and contrast raised — Galileo’s true-colour view above shows the real yellows.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/SwRI/MSSS/Gerald Eichstädt/Thomas Thomopoulos',
      licence: 'Processed image CC BY, from NASA images not copyrighted',
      date: '2024-04-09',
      sourceUrl: 'https://images.nasa.gov/details/PIA25697',
    },
    {
      file: 'photos/io/galileo-loki-2001.webp',
      largeFile: 'photos/io/galileo-loki-2001-large.webp',
      width: 640,
      height: 640,
      title: 'Loki at sunset, 16 October 2001',
      caption:
        'The great volcanic crater of Loki near the line between night and day, at 1.1 km per pixel, lit from the right. Its lava flows, black when the Sun is overhead, shine here: chilled lava is glassy and reflects low sunlight like water. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2001-10-16',
      sourceUrl: 'https://images.nasa.gov/details/PIA03530',
    },
    {
      file: 'photos/io/galileo-mongibello-2000.webp',
      largeFile: 'photos/io/galileo-mongibello-2000-large.webp',
      width: 640,
      height: 450,
      title: 'Mongibello Mons, February 2000',
      caption:
        'A ridge 7 km high, lit by a low Sun from the left, at 335 metres per pixel. Few of Io’s mountains are volcanoes: most are thought to be blocks of crust pushed up along faults. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/University of Arizona/Arizona State University',
      licence: 'NASA media, not copyrighted',
      date: '2000-02',
      sourceUrl: 'https://images.nasa.gov/details/PIA03886',
    },
  ],
  drawnHere: [
    {
      title: 'Which ephemeris',
      text: 'Its positions are JPL’s satellite ephemeris for Jupiter’s moons, JUP365, the same one its mass is taken from — not DE441, which carries only the Sun, the planets and our Moon.',
      cite: ['jplSats'],
    },
    {
      title: 'Only near today',
      text: 'JPL’s table is fetched for one year either side of the day the data were built, not the ten the planets get: Io needs a sample every two hours, and the fast moons’ data are a matter of budget. Outside that year it is carried on from its orbital elements and marked approximate — still on its orbit, no longer exactly where it is.',
    },
    {
      title: 'Its shape, and its face to Jupiter',
      text: 'Not a sphere: a triaxial ellipsoid of 1,829.4 by 1,819.4 by 1,815.7 km, its long axis toward Jupiter, as the IAU gives it. It is turned by the IAU’s model, small periodic terms included, so the same face stays on Jupiter as it really does.',
      cite: ['archinal2018'],
    },
    {
      title: 'Its map',
      text: 'USGS’s global mosaic: Galileo’s colour laid over a black-and-white base of Voyager and Galileo images; its longitude was checked here against Pele and Loki Patera. The colour is the mission’s, not calibrated to an eye. At 2,048 pixels round, each pixel is about 5.6 km at the equator, worked out here from its radius. It shows Io as Voyager and Galileo saw it between 1979 and 2001; its surface has changed since.',
      cite: ['pia26486'],
    },
    {
      title: 'Its brightness is the mosaic’s',
      text: 'The map’s average, read as how much light the surface reflects, is 0.26; the Moon’s map averages 0.48. Io really reflects about five times as much light as the Moon — geometric albedo 0.62 against 0.12 — so beside the Moon it is drawn several times too dark. Worked out here from the two maps’ pixels and the two fact sheets.',
      cite: ['nssdcJovian', 'nssdcMoon'],
    },
    {
      title: 'Juno',
      text: 'Juno is drawn on JPL’s trajectory, and its two close passes of Io — 30 December 2023 and 3 February 2024 — are on it. But those dates fall outside Io’s own one-year table, where Io is carried on from its elements, so the app does not promise to show the two meeting where they met.',
      cite: ['nasaIo', 'pia26340'],
    },
    {
      title: 'Lighting',
      text: 'In Natural lighting, the default, its night side is black. Shadow and Flood lighting fill it in so it can be read; neither is what an eye would see.',
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 1,821.5 km, 3,643 km across: 5% wider than the Moon. Mass 8.93 × 10²² kg, 1.2 Moons; mean density 3.53 g/cm³, denser than the Moon’s 3.34. Gravity at the surface 1.80 m/s². The comparisons with the Moon are worked out here from the fact sheets.',
      cite: ['jplSats', 'nssdcJovian', 'nssdcGalilean', 'nssdcMoon'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 421,800 km from Jupiter’s centre, 5.9 Jupiter radii; one orbit in 1.769 days, at 17.3 km/s; eccentricity 0.004, tilted 0.04° to Jupiter’s equator. It turns once per orbit, so one face always looks at Jupiter.',
      cite: ['nssdcJovian', 'nssdcGalilean'],
    },
    {
      title: 'The resonance',
      text: 'Io, Europa and Ganymede go round in 1.769, 3.551 and 7.155 days: as near as makes no difference 1 : 2 : 4. The repeated alignments keep Io’s eccentricity from dying away, and with it the tides that heat it. The ratios are worked out here from the periods.',
      cite: ['nssdcJovian', 'peale1979'],
    },
    {
      title: 'Predicted, then found',
      text: 'Peale, Cassen and Reynolds published their calculation that tides should melt much of Io’s interior, and that volcanism might follow, in Science of 2 March 1979. Days later, Linda Morabito found a plume over Io’s edge in a Voyager 1 navigation image — the first active volcano seen beyond Earth.',
      cite: ['peale1979', 'morabito1979'],
    },
    {
      title: 'Its heat',
      text: 'Positions of the Galilean moons measured from 1891 to 2007 show their orbits changing under the tides, and the energy Io loses to them matches the heat it gives off: about 9 × 10¹³ watts, some 2 watts from every square metre of its surface.',
      cite: ['lainey2009'],
    },
    {
      title: 'Its lava',
      text: 'Galileo measured lava hotter than 1,700 K at Pillan Patera — hotter than any lava erupting on Earth now, closer to the magnesium-rich lavas of the early Earth.',
      cite: ['mcewen1998'],
    },
    {
      title: 'Its plumes',
      text: 'Tvashtar’s plume, which New Horizons watched in 2007, rose about 330 km. Juno’s camera saw two plumes side by side over the horizon in February 2024.',
      cite: ['spencer2007', 'pia26340'],
    },
    {
      title: 'Its mountains',
      text: 'Measured from their shadows and in stereo, Io’s mountains average 6.3 km high, and the tallest, Boösaule Montes, about 17.5 km. Mongibello Mons, in the photograph above, rises 7 km. Most are thought to be tilted blocks of crust, not volcanoes.',
      cite: ['schenk2001', 'pia03886'],
    },
    {
      title: 'What the colours are',
      text: 'The whites and reds of its surface are different sulfur compounds, frozen out of the plumes; the black patches are silicate rock — fresh lava.',
      cite: ['pia02860'],
    },
    {
      title: 'What it loses',
      text: 'Gas from its thin atmosphere — mostly sulfur dioxide from the volcanoes — escapes at about a tonne a second. Ionised, it fills a doughnut of plasma around Jupiter along Io’s orbit, the Io torus, which feeds Jupiter’s whole magnetosphere.',
      cite: ['bagenal2020'],
    },
    {
      title: 'It keeps changing',
      text: 'Comparing Juno’s images of 2023 and 2024 with Galileo’s and New Horizons’ found at least 20 new dark deposits — fresh lava or ash — and 14 new diffuse deposits around volcanic centres.',
      cite: ['pia26486'],
    },
  ],
  estimated: [
    {
      title: 'What is underneath',
      text: 'Two readings that disagree. Galileo’s magnetometer saw a magnetic signal induced inside Io that was fitted by a layer of partly molten rock more than 50 km thick, at least a fifth of it melt — a “magma ocean”. Then Juno’s two close passes measured how much Jupiter’s tides deform Io (a Love number k₂ of 0.125 ± 0.047), far too little for a shallow global magma ocean: its mantle is mostly solid, and the melt must rise and erupt quickly rather than pool.',
      cite: ['khurana2011', 'park2025'],
    },
    {
      title: 'Where the heat is made',
      text: 'That tides heat Io is measured, in the energy its orbit loses; where inside it the heat is made — deep in the mantle or near the surface — is a model’s answer, and models differ, which is why the volcanoes cluster where they do is still argued.',
      cite: ['lainey2009', 'park2025'],
    },
  ],
  missing: [
    {
      title: 'Its plumes and glowing lava',
      text: 'Not drawn. The plumes rise hundreds of kilometres and are seen against space at the edge of the disc; the hottest lava glows on the night side, as in the New Horizons pictures above. Here Io is a solid map, and its night side is dark.',
      cite: ['spencer2007'],
    },
    {
      title: 'Jupiter’s shadow',
      text: 'Not drawn. Io orbits almost exactly in Jupiter’s equator and passes through Jupiter’s shadow on every orbit, every 1.77 days; here it stays lit. Nothing in the app casts a shadow on another body except Saturn and its rings, so its own shadow on Jupiter, in the Cassini photograph above, is missing too.',
      cite: ['nssdcJovian', 'pia02860'],
    },
    {
      title: 'The torus',
      text: 'Not drawn: the ring of plasma it feeds, and the auroral spot its passing makes on Jupiter, belong to a magnetosphere the app models only for Earth.',
      cite: ['bagenal2020'],
    },
    {
      title: 'Its relief',
      text: 'Not drawn: the mountains up to 17.5 km and the steep-walled volcanic craters are a picture on a smooth ellipsoid, and cast no shadows.',
      cite: ['schenk2001'],
    },
    {
      title: 'Io today',
      text: 'The map is Io between 1979 and 2001. Juno has since found new lava flows and new plume deposits; no global map of today’s Io exists.',
      cite: ['pia26486'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not heated by the Sun or by its own radioactivity',
      text: 'Its surface averages about −155 °C. Its heat is tidal, made by Jupiter flexing it, and the energy taken from its orbit accounts for what it radiates.',
      cite: ['nssdcGalilean', 'lainey2009'],
    },
    {
      title: 'Its lava is rock, not sulfur',
      text: 'The yellows are sulfur and sulfur compounds coating the surface, and some flows may be sulfur; but the hot spots Galileo measured, above 1,700 K, are molten silicate rock, as on Earth — hotter, if anything.',
      cite: ['mcewen1998', 'pia02860'],
    },
    {
      title: 'No magma ocean under the crust',
      text: 'An ocean of magma beneath Io’s crust was widely reported from Galileo data in 2011. Juno’s measurement of its tides in 2024 rules out a shallow global one.',
      cite: ['khurana2011', 'park2025'],
    },
    {
      title: 'Its volcanoes are not cones',
      text: 'Few of Io’s mountains are volcanoes. Most of its volcanoes are paterae — flat-floored, steep-walled craters like Loki — and its tallest mountains are blocks of crust thrust up along faults.',
      cite: ['schenk2001', 'pia03886'],
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
      key: 'peale1979',
      text: 'Peale, S. J., Cassen, P., & Reynolds, R. T. 1979, Melting of Io by Tidal Dissipation, Science 203, 892',
      url: 'https://doi.org/10.1126/science.203.4383.892',
    },
    {
      key: 'morabito1979',
      text: 'Morabito, L. A., et al. 1979, Discovery of Currently Active Extraterrestrial Volcanism, Science 204, 972',
      url: 'https://doi.org/10.1126/science.204.4396.972',
    },
    {
      key: 'lainey2009',
      text: 'Lainey, V., et al. 2009, Strong tidal dissipation in Io and Jupiter from astrometric observations, Nature 459, 957',
      url: 'https://doi.org/10.1038/nature08108',
    },
    {
      key: 'mcewen1998',
      text: 'McEwen, A. S., et al. 1998, High-Temperature Silicate Volcanism on Jupiter’s Moon Io, Science 281, 87',
      url: 'https://doi.org/10.1126/science.281.5373.87',
    },
    {
      key: 'spencer2007',
      text: 'Spencer, J. R., et al. 2007, Io Volcanism Seen by New Horizons: A Major Eruption of the Tvashtar Volcano, Science 318, 240',
      url: 'https://doi.org/10.1126/science.1147621',
    },
    {
      key: 'schenk2001',
      text: 'Schenk, P., et al. 2001, The mountains of Io: Global and geological perspectives from Voyager and Galileo, J. Geophys. Res. 106, 33201',
      url: 'https://doi.org/10.1029/2000JE001408',
    },
    {
      key: 'bagenal2020',
      text: 'Bagenal, F., & Dols, V. 2020, The Space Environment of Io and Europa, J. Geophys. Res. Space Physics 125, e2019JA027485',
      url: 'https://doi.org/10.1029/2019JA027485',
    },
    {
      key: 'khurana2011',
      text: 'Khurana, K. K., et al. 2011, Evidence of a Global Magma Ocean in Io’s Interior, Science 332, 1186',
      url: 'https://doi.org/10.1126/science.1201425',
    },
    {
      key: 'park2025',
      text: 'Park, R. S., et al. 2025, Io’s tidal response precludes a shallow magma ocean, Nature 638, 69',
      url: 'https://doi.org/10.1038/s41586-024-08442-5',
    },
    {
      key: 'nasaIo',
      text: 'NASA Science, Io (Jupiter’s moons)',
      url: 'https://science.nasa.gov/jupiter/jupiter-moons/io/',
    },
    {
      key: 'pia02860',
      text: 'NASA/JPL Photojournal PIA02860, Io in Front of Jupiter (Cassini, 12 December 2000)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA02860',
    },
    {
      key: 'pia03886',
      text: 'NASA/JPL Photojournal PIA03886, Mountains on Io at Sunset (Galileo)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA03886',
    },
    {
      key: 'pia26340',
      text: 'NASA/JPL Photojournal PIA26340, JunoCam Captures Io Spouting Off (3 February 2024)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA26340',
    },
    {
      key: 'pia26486',
      text: 'NASA/JPL Photojournal PIA26486, Surface Changes on Io (Juno, 2023–2024)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA26486',
    },
  ],
};
