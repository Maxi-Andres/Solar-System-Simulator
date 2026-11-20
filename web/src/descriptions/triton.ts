import type { Description } from './types.ts';

/**
 * Triton. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a surface gravity, a map's mean brightness), the point says so. Where a
 * figure is a model's rather than a measurement, it sits under "estimated" and says which.
 */
export const TRITON: Description = {
  id: 'triton',
  lead: [
    'Triton goes round Neptune backwards — the only large moon in the Solar System that does — and a moon cannot form that way: it is a world from the Kuiper belt, a cousin of Pluto, that Neptune caught. Its geysers were the last great surprise of Voyager 2’s twelve-year tour of the giant planets, and in the more than thirty-five years since, no spacecraft has been back.',
    'Triton is by far the largest of Neptune’s moons, 2,705 kilometres across, a fifth smaller than our Moon. Its surface is mostly frozen nitrogen, at about 38 degrees above absolute zero — −235 °C — and reflects most of the sunlight that reaches it. Over it lies a thin atmosphere, also of nitrogen, at about a sixty-thousandth of Earth’s pressure at sea level.',
    'It is not a dead world. Voyager 2 saw dark plumes rising 8 kilometres from its south polar cap and trailing 150 kilometres downwind, and dozens of dark streaks left by others. Its surface has very few craters — it is probably less than 50 million years old, perhaps less than 10 — and much of it is a strange dimpled ground, the “cantaloupe terrain”, with plains that look flooded by icy lava.',
    'Its orbit is an almost perfect circle, 355,000 kilometres from Neptune, tilted 157° — that is, backwards — and it takes 5.9 days to go round, always with the same face toward Neptune. The leading explanation of its capture is that it arrived as one of a pair of bodies orbiting each other: Neptune kept Triton and flung its partner away. Tides from that capture, and from its tilted orbit since, may still keep an ocean liquid under its ice.',
    'William Lassell discovered it on 10 October 1846, 17 days after Neptune itself was found. Everything seen of it up close comes from Voyager 2’s single pass on 25 August 1989, when Triton’s northern hemisphere was in darkness.',
  ],
  photos: [
    {
      file: 'photos/triton/voyager-global-colour.webp',
      largeFile: 'photos/triton/voyager-global-colour-large.webp',
      width: 640,
      height: 498,
      title: 'Triton from Voyager 2, August 1989',
      caption:
        'A global mosaic in colour made from orange, violet and ultraviolet images, shown as red, green and blue — so the colours are shifted from what an eye would see. The pinkish ground is the vast south polar cap, streaked dark by plume deposits; a bluish-green band crosses near the equator; the north, at the top, was in shadow.',
      colour: 'false',
      credit: 'NASA/JPL/USGS',
      licence: 'NASA media, not copyrighted',
      date: '1989-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA00317',
    },
    {
      file: 'photos/triton/voyager-plume-1989.webp',
      largeFile: 'photos/triton/voyager-plume-1989-large.webp',
      width: 640,
      height: 1108,
      title: 'A geyser erupting, August 1989',
      caption:
        'Three Voyager 2 images about 45 minutes apart: a plume throws a cloud of dark particles about 8 km up into the thin atmosphere, and the wind carries it some 150 km to the right; in the last, the cloud’s shadow can be made out. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA14449',
    },
    {
      file: 'photos/triton/voyager-south-polar-streaks.webp',
      largeFile: 'photos/triton/voyager-south-polar-streaks-large.webp',
      width: 640,
      height: 636,
      title: 'Dark streaks on the polar cap, 25 August 1989',
      caption:
        'About 50 dark streaks on the bright south polar terrain, each from a dark spot a few kilometres across, some more than 160 km long — material from vents, laid down downwind. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-25',
      sourceUrl: 'https://images.nasa.gov/details/PIA00059',
    },
    {
      file: 'photos/triton/voyager-false-colour.webp',
      largeFile: 'photos/triton/voyager-false-colour-large.webp',
      width: 424,
      height: 499,
      title: 'A boundary in false colour, 25 August 1989',
      caption:
        'From 190,000 km, violet, green and ultraviolet images combined: the edge between dark ground and patchy light ground, under a thin pinkish layer, with wind-blown streaks running from small vents. The pink may be methane altered by radiation; the colours are not an eye’s.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-25',
      sourceUrl: 'https://images.nasa.gov/details/PIA02214',
    },
    {
      file: 'photos/triton/voyager-northern-plains.webp',
      largeFile: 'photos/triton/voyager-northern-plains-large.webp',
      width: 640,
      height: 528,
      title: 'Low sun over the north, August 1989',
      caption:
        'From under 80,000 km, with the Sun just above the horizon: low cliffs, and a smooth plain with a single fresh crater — the only clear impact crater in view. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA02208',
    },
    {
      file: 'photos/triton/cantaloupe-terrain.webp',
      largeFile: 'photos/triton/cantaloupe-terrain-large.webp',
      width: 640,
      height: 417,
      title: 'Cantaloupe terrain, in perspective',
      caption:
        'Not a photograph from the ground: Voyager images laid over a topographic map made from them, in 2009. In front, the dimpled cantaloupe terrain, mounds a few hundred metres high; behind, walled plains about 150 m deep and 200 to 250 km across. The relief is exaggerated 25 times. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/Universities Space Research Association/Lunar & Planetary Institute',
      licence: 'NASA media, not copyrighted',
      date: '2009 (from 1989 images)',
      sourceUrl: 'https://images.nasa.gov/details/PIA12186',
    },
    {
      file: 'photos/triton/neptune-triton-crescents.webp',
      largeFile: 'photos/triton/neptune-triton-crescents-large.webp',
      width: 640,
      height: 480,
      title: 'Neptune and Triton as crescents, 28 August 1989',
      caption:
        'Voyager 2 looking back three days after its flyby, from 4.86 million km: Neptune above, Triton below, both lit from behind. Colour made from the clear, orange and green filters.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-28',
      sourceUrl: 'https://images.nasa.gov/details/PIA02215',
    },
  ],
  drawnHere: [
    {
      title: 'Its wandering pole',
      text: 'The pole the panel gives is only the centre of its motion. Triton’s orbit, and with it its locked spin axis, swings around Neptune’s pole, and the IAU’s model carries nine periodic terms for it: the right ascension of the pole drawn swings by up to 32° and its declination by up to 23°, once round in about 690 years, and its face to Neptune swings with it. The period is worked out here from the model’s rate.',
      cite: ['archinal2018'],
    },
    {
      title: 'Backwards, and locked',
      text: 'It turns backwards against the IAU’s north pole — the sign the app gives it, checked against JPL: drawn the other way, the point beneath Neptune came out 5.5° from Horizons on every date. That is the same sense it goes round in, so the same face stays toward Neptune.',
      cite: ['archinal2018'],
    },
    {
      title: 'Which ephemeris',
      text: 'Its positions are JPL’s satellite ephemeris for Neptune’s moons, as Horizons serves it — its mass is NEP097’s, and JPL delivered a successor covering Triton, NEP098, in 2026 — not DE441, which carries only the Sun, the planets and our Moon.',
      cite: ['jplSats'],
    },
    {
      title: 'Only near today',
      text: 'JPL’s table is fetched for one year either side of the day the data were built, a sample every seven hours. Outside that year it is carried on from its orbital elements and marked approximate — still on its orbit, no longer exactly where it is.',
    },
    {
      title: 'Its map, and the half no one saw',
      text: 'USGS’s colour mosaic of Voyager 2’s images, its longitude checked here against Tuonela Planitia: orange, violet and ultraviolet filters combined, uncalibrated. Its northern 39%, in darkness when Voyager passed, is filled with the average of what was seen: nothing there is an observation. At 2,048 pixels round, each pixel is about 4.1 km at the equator, worked out here.',
      cite: ['stone1989'],
    },
    {
      title: 'Its brightness is the mosaic’s',
      text: 'The map’s average, read as how much light the surface reflects, is 0.33; the Moon’s map averages 0.48. Triton really reflects about six times as much light as the Moon — geometric albedo 0.72 against 0.12 — so beside the Moon it is drawn several times too dark. Worked out here from the two maps’ pixels and the fact sheets.',
      cite: ['nssdcNeptunian', 'nssdcMoon'],
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 1,352.6 km, 2,705 km across: 22% smaller than the Moon. Mass 2.14 × 10²² kg, under a third of the Moon’s; mean density 2.06 g/cm³ — rock and ice. Gravity at the surface 0.78 m/s², worked out here from its GM and radius.',
      cite: ['jplSats', 'nssdcNeptunian', 'nssdcMoon'],
    },
    {
      title: 'A backward orbit',
      text: 'Average distance 354,760 km from Neptune’s centre, 14.3 Neptune radii; one orbit in 5.877 days, retrograde, inclined 157.3°; eccentricity 0.000016, almost a perfect circle. Turning once per orbit, it keeps one face toward Neptune.',
      cite: ['nssdcNeptunian'],
    },
    {
      title: 'Discovery',
      text: 'By William Lassell, on 10 October 1846, 17 days after Neptune itself.',
      cite: ['nasaTriton'],
    },
    {
      title: 'Temperature',
      text: 'The shape of the nitrogen-ice absorption in its spectrum gives a surface temperature of 38 ± 1 K, matching what Voyager 2’s infrared measurements found.',
      cite: ['tryka1993', 'conrath1989'],
    },
    {
      title: 'Atmosphere',
      text: 'Voyager 2’s radio signal, passing through it, gave a surface pressure of 16 ± 3 microbars — about a sixty-thousandth of Earth’s, worked out here. It is nitrogen with a little methane.',
      cite: ['tyler1989', 'nasaTriton'],
    },
    {
      title: 'Brightness',
      text: 'Geometric albedo 0.72: it reflects most of the light that falls on it.',
      cite: ['nssdcNeptunian'],
    },
    {
      title: 'Geysers',
      text: 'At least two active plumes, columns rising about 8 km and then trailing dark clouds some 150 km downwind; around 50 dark streaks on the south polar cap mark others.',
      cite: ['soderblom1990', 'pia00059'],
    },
    {
      title: 'A young surface',
      text: 'So few craters that its surface is less than 50 million years old everywhere, and probably less than 10 million if most of its craters were made by debris orbiting Neptune.',
      cite: ['schenk2007'],
    },
    {
      title: 'Cantaloupe terrain',
      text: 'Ground covered with irregular mounds a few hundred metres high and a few kilometres across, probably where blobs of warmer ice rose through the crust; nearby, walled plains about 150 m deep and 200 to 250 km across.',
      cite: ['pia12186', 'smith1989'],
    },
    {
      title: 'Voyager 2',
      text: 'The only visit: a single flyby on 25 August 1989, after Neptune. Its pictures cover only the hemisphere then in sunlight.',
      cite: ['stone1989', 'smith1989'],
    },
  ],
  estimated: [
    {
      title: 'A captured world',
      text: 'A backward orbit cannot form around a planet, so Triton was captured. The leading model has it arriving as half of a binary pair from the Kuiper belt, the other half flung away by Neptune in the encounter.',
      cite: ['agnor2006'],
    },
    {
      title: 'An ocean',
      text: 'Heated first by its capture and now by tides from its tilted orbit, Triton is thought likely to hold a liquid ocean under its ice — a strong case, but not a measurement: no spacecraft has carried a magnetometer or gravity experiment close enough to test it.',
      cite: ['hansen2021'],
    },
    {
      title: 'What drives the geysers',
      text: 'One explanation, from Voyager’s scientists: sunlight passing through clear nitrogen ice warms dark material below it, the nitrogen gas beneath builds up pressure and escapes through vents, carrying the dark dust up. It is a model; other heat sources, from inside, have been proposed.',
      cite: ['soderblom1990', 'hansen2021'],
    },
  ],
  missing: [
    {
      title: 'Its northern half',
      text: 'Never photographed: it was in seasonal darkness during Voyager 2’s flyby. The map fills it with an average.',
      cite: ['stone1989'],
    },
    {
      title: 'Its geysers and atmosphere',
      text: 'Not drawn: the plumes, their drifting clouds, and the thin haze Voyager saw at the limb.',
      cite: ['soderblom1990', 'smith1989'],
    },
    {
      title: 'Neptune’s shadow',
      text: 'Not drawn: nothing in the app casts a shadow on another body except Saturn and its rings, so Triton stays lit when it passes behind Neptune.',
    },
    {
      title: 'Its relief',
      text: 'Not drawn: the cantaloupe mounds and walled plains are a picture on a smooth sphere.',
      cite: ['pia12186'],
    },
  ],
  misconceptions: [
    {
      title: 'It did not form with Neptune',
      text: 'Moons that form with their planet go round the way it spins. Triton goes the other way, so it came from elsewhere.',
      cite: ['agnor2006', 'nssdcNeptunian'],
    },
    {
      title: 'Backwards in its orbit, not in its spin',
      text: 'It does not turn against its own orbit: tidally locked, it turns once per orbit in the same sense it goes round, so it always shows Neptune one face. It is backwards only against Neptune’s spin.',
      cite: ['nssdcNeptunian', 'archinal2018'],
    },
    {
      title: 'Cold is not inactive',
      text: 'At 38 K it is one of the coldest surfaces ever measured, and it still has geysers, and a surface younger than the dinosaurs’ extinction.',
      cite: ['tryka1993', 'soderblom1990', 'schenk2007'],
    },
  ],
  sources: [
    {
      key: 'nssdcNeptunian',
      text: 'Williams, D. R., Neptunian Satellite Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptuniansatfact.html',
    },
    {
      key: 'nssdcMoon',
      text: 'Williams, D. R., Moon Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    },
    {
      key: 'jplSats',
      text: 'JPL Solar System Dynamics, Planetary Satellite Physical Parameters (GM from NEP097; mean radius from the IAU 2015 report)',
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
      key: 'nasaTriton',
      text: 'NASA Science, Triton (Neptune’s moons)',
      url: 'https://science.nasa.gov/neptune/moons/triton/',
    },
    {
      key: 'stone1989',
      text: 'Stone, E. C., & Miner, E. D. 1989, The Voyager 2 Encounter with the Neptunian System, Science 246, 1417',
      url: 'https://doi.org/10.1126/science.246.4936.1417',
    },
    {
      key: 'smith1989',
      text: 'Smith, B. A., et al. 1989, Voyager 2 at Neptune: Imaging Science Results, Science 246, 1422',
      url: 'https://doi.org/10.1126/science.246.4936.1422',
    },
    {
      key: 'tyler1989',
      text: 'Tyler, G. L., et al. 1989, Voyager Radio Science Observations of Neptune and Triton, Science 246, 1466',
      url: 'https://doi.org/10.1126/science.246.4936.1466',
    },
    {
      key: 'conrath1989',
      text: 'Conrath, B., et al. 1989, Infrared Observations of the Neptunian System, Science 246, 1454',
      url: 'https://doi.org/10.1126/science.246.4936.1454',
    },
    {
      key: 'tryka1993',
      text: 'Tryka, K. A., et al. 1993, Spectroscopic Determination of the Phase Composition and Temperature of Nitrogen Ice on Triton, Science 261, 751',
      url: 'https://doi.org/10.1126/science.261.5122.751',
    },
    {
      key: 'soderblom1990',
      text: 'Soderblom, L. A., et al. 1990, Triton’s Geyser-Like Plumes: Discovery and Basic Characterization, Science 250, 410',
      url: 'https://doi.org/10.1126/science.250.4979.410',
    },
    {
      key: 'schenk2007',
      text: 'Schenk, P. M., & Zahnle, K. 2007, On the negligible surface age of Triton, Icarus 192, 135',
      url: 'https://doi.org/10.1016/j.icarus.2007.07.004',
    },
    {
      key: 'agnor2006',
      text: 'Agnor, C. B., & Hamilton, D. P. 2006, Neptune’s capture of its moon Triton in a binary–planet gravitational encounter, Nature 441, 192',
      url: 'https://doi.org/10.1038/nature04792',
    },
    {
      key: 'hansen2021',
      text: 'Hansen, C. J., et al. 2021, Triton: Fascinating Moon, Likely Ocean World, Compelling Destination!, Planet. Sci. J. 2, 137',
      url: 'https://doi.org/10.3847/PSJ/abffd2',
    },
    {
      key: 'pia00059',
      text: 'NASA/JPL Photojournal PIA00059, Triton South Polar Terrain (Voyager 2, 25 August 1989)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA00059',
    },
    {
      key: 'pia12186',
      text: 'NASA/JPL Photojournal PIA12186, Triton’s Cantaloupe Terrain (from Voyager 2 topography, 2009)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA12186',
    },
  ],
};
