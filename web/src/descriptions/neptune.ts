import type { Description } from './types.ts';

/**
 * Neptune. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model.
 */
export const NEPTUNE: Description = {
  id: 'neptune',
  lead: [
    'Neptune is the planet found with a pen before it was seen with a telescope — proof that the laws of physics hold even at the edge of the Solar System. It is so far away that since it was discovered in 1846 it has gone round the Sun only once, finishing its first orbit in 2011.',
    'Neptune is the eighth and farthest planet from the Sun, an ice giant almost four times as wide as Earth and 17 times as massive. It is the planet found by mathematics: Urbain Le Verrier, and independently John Couch Adams, predicted where an unseen planet should be, and Johann Galle found it there on 23 September 1846.',
    'It is 30 times as far from the Sun as Earth, where sunlight is 900 times fainter, and yet it is not a still world. Its winds reach 580 metres per second, more than twice the strongest on Uranus, and it gives off 2.6 times as much energy as it absorbs from the Sun — heat from inside it. When Voyager 2 flew past in 1989 it carried a storm as wide as Earth, the Great Dark Spot; five years later it was gone.',
    'It is pale blue, only a little bluer than Uranus. The deep blue of the famous Voyager pictures was stretched to bring out its clouds, and the captions saying so got separated from the pictures; in 2024 the original images were re-processed to show what an eye would see.',
    'It has 16 known moons and faint, dark, dusty rings, the outermost bunched into bright arcs. Its largest moon, Triton, orbits it backwards — almost certainly a body from beyond Neptune that it captured — and Voyager 2 saw geysers on it, throwing dark material 8 kilometres up.',
    'It takes 165 years to go round the Sun, so it completed its first orbit since its discovery only in 2011. Its axis is tilted 28°, a little more than Earth’s, so it has seasons, each about 40 years long. Its day is about 16 hours. Only Voyager 2 has been there: on 25 August 1989 it flew 4,800 kilometres over its clouds.',
  ],
  photos: [
    {
      file: 'photos/neptune/voyager-true-colour.webp',
      largeFile: 'photos/neptune/voyager-true-colour-large.webp',
      width: 640,
      height: 315,
      title: 'Uranus and Neptune from Voyager 2, as an eye would see them',
      caption:
        'Voyager 2’s filter images of Uranus in 1986 (left) and Neptune in 1989 (right), re-processed in 2024 into true colour. Neptune is a pale blue, a little bluer than Uranus, with the Great Dark Spot and its white clouds just visible on the left.',
      colour: 'true',
      credit: 'Irwin et al. 2024, MNRAS 527, 11521, from NASA/JPL Voyager 2 data',
      licence: 'CC BY 4.0; cropped to one row of the figure, its panel label removed',
      date: '2024 (from 1986 and 1989 images)',
      sourceUrl: 'https://doi.org/10.1093/mnras/stad3761',
    },
    {
      file: 'photos/neptune/hubble-2002-2003.webp',
      largeFile: 'photos/neptune/hubble-2002-2003-large.webp',
      width: 640,
      height: 596,
      title: 'Uranus and Neptune from Hubble, 2002 and 2003, in true colour',
      caption:
        'Spectra taken across each disc by Hubble’s STIS, converted to what an eye would see. Top, at the same size and brightness; bottom, as they look from Earth, Neptune smaller and fainter because it is farther away.',
      colour: 'true',
      credit: 'Irwin et al. 2024, MNRAS 527, 11521, from NASA/ESA Hubble data',
      licence: 'CC BY 4.0',
      date: '2002 and 2003',
      sourceUrl: 'https://doi.org/10.1093/mnras/stad3761',
    },
    {
      file: 'photos/neptune/voyager-1989.webp',
      largeFile: 'photos/neptune/voyager-1989-large.webp',
      width: 640,
      height: 639,
      title: 'The famous Neptune, 20 August 1989',
      caption:
        'Voyager 2’s last whole-planet picture before closest approach, from 7 million kilometres, made from only its green and orange filters and stretched for contrast — the deep blue most people picture Neptune as. The Great Dark Spot is at the centre; the bright “Scooter” and a smaller dark spot are at lower left, near the edge.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-20',
      sourceUrl: 'https://images.nasa.gov/details/PIA01492',
    },
    {
      file: 'photos/neptune/great-dark-spot.webp',
      largeFile: 'photos/neptune/great-dark-spot-large.webp',
      width: 640,
      height: 640,
      title: 'The Great Dark Spot, August 1989',
      caption:
        'From 16 million kilometres. The dark oval is about 13,000 by 6,600 km, as long as Earth is wide, with white cirrus-like clouds above it; below it, the small bright “Scooter” went round faster than the spot. Colours enhanced, as Voyager’s Neptune pictures were.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08',
      sourceUrl: 'https://images.nasa.gov/details/PIA02245',
    },
    {
      file: 'photos/neptune/great-dark-spot-close.webp',
      largeFile: 'photos/neptune/great-dark-spot-close-large.webp',
      width: 640,
      height: 779,
      title: 'The Great Dark Spot close up, 23 August 1989',
      caption:
        'The last face-on look Voyager 2 had at the storm, from 2.8 million kilometres: feathery white clouds along its edge, in a spiral that says it turned anticlockwise. Made from the clear and green filters, so its blues are not an eye’s.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-23',
      sourceUrl: 'https://images.nasa.gov/details/PIA00052',
    },
    {
      file: 'photos/neptune/cloud-shadows.webp',
      largeFile: 'photos/neptune/cloud-shadows-large.webp',
      width: 640,
      height: 559,
      title: 'Clouds casting shadows, 25 August 1989',
      caption:
        'Two hours before closest approach, 157,000 km out: streaks of bright cloud 50 to 200 km wide at 29° north, throwing shadows on the cloud deck below — the clouds float well above it. Voyager’s colour composite, enhanced.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-25',
      sourceUrl: 'https://images.nasa.gov/details/PIA00058',
    },
    {
      file: 'photos/neptune/neptune-triton-crescents.webp',
      largeFile: 'photos/neptune/neptune-triton-crescents-large.webp',
      width: 640,
      height: 480,
      title: 'Neptune and Triton as crescents, 28 August 1989',
      caption:
        'Looking back three days after the flyby, from 4.86 million kilometres, with Triton below. From behind, Neptune is not blue: its atmosphere scatters sunlight forward. Colour made from the clear, orange and green filters.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1989-08-28',
      sourceUrl: 'https://images.nasa.gov/details/PIA02215',
    },
    {
      file: 'photos/neptune/webb-2022.webp',
      largeFile: 'photos/neptune/webb-2022-large.webp',
      width: 640,
      height: 427,
      title: 'Neptune’s rings from Webb, 2022',
      caption:
        'In infrared the rings show better than at any time since Voyager: two narrow and two broad. The bright patches on the planet are high clouds of methane ice; six small moons are the dots among the rings. Four infrared bands shown as four colours, so Neptune is not blue here.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI; image processing J. DePasquale (STScI), N. Rowe-Gurney (NASA-GSFC)',
      licence: 'NASA media; credit requested',
      date: '2022-07-12',
      sourceUrl: 'https://science.nasa.gov/asset/webb/neptune-close-up-nircam/',
    },
  ],
  drawnHere: [
    {
      title: 'Its map, in its true colour',
      text: 'Voyager 2’s clouds of 1989, in Neptune’s measured colour and brightness. The map is the illustrative one — its bands, its bright clouds and the Great Dark Spot are Voyager’s — but that map is the stretched deep blue, and a quarter as bright as Neptune is. So its colour was replaced: every pixel is Neptune’s disc colour times its own brightness against the map’s average, its bright clouds white. The colour is worked out from Neptune’s measured geometric albedo in ten bands, put through the eye’s colour response under sunlight — the way Irwin et al. made its true colour from its spectra — and comes out a pale blue, a little bluer than Uranus. Its average brightness is now 0.42, near its geometric albedo of 0.44 and Uranus’s 0.49, where it was 0.12.',
      cite: ['mallama2017', 'irwin2024', 'smith1989', 'nssdcuranus'],
    },
    {
      title: 'Why not NASA’s pale map',
      text: 'A second, pale blue-green map of Neptune from NASA was in the repository. It is painted: turbulent swirls Neptune does not have, a black strip along its southern edge, and still three times too dark. Its colour was the right direction; its clouds were not Neptune’s.',
      cite: ['smith1989'],
    },
    {
      title: 'Its rings',
      text: 'Drawn from their measurements, not a picture: Galle, Le Verrier, Lassell and Adams, each at its radius and width and as opaque as Voyager 2 measured it, in Neptune’s equatorial plane. They are faint past seeing: Adams, the densest outside its arcs, blocks 1.1% of the light crossing it face-on, the broad Galle and Lassell a hundredth of a percent. Their particles are as dark as Uranus’s, geometric albedo about 0.05, so they are drawn an eleventh as bright as Saturn’s; like Saturn’s, at a brightness that does not change with the angles of the Sun and the camera.',
      cite: ['smith1989', 'horn1990'],
    },
    {
      title: 'Turning with its clouds',
      text: 'Neptune has two days. The 16.11 hours the panel gives is its magnetic field’s, the interior’s, which Voyager 2 timed. The map turns instead in 15.97 hours, the IAU’s rate for its visible clouds — the same period as two features in its far south that Hubble followed for more than a decade without them drifting. With the other rate, the map would slip a full turn every 75 days.',
      cite: ['archinal2018', 'karkoschka2011', 'stone1989'],
    },
    {
      title: 'Its wobbling pole',
      text: 'Its pole carries the IAU’s periodic term, a slow wobble of about half a degree, once round in 688 years. Neptune is the only planet where that term is large enough to see: without it the point where the Sun stands overhead would be 0.28° from JPL’s; with it, within 0.004°.',
      cite: ['archinal2018', 'de440'],
    },
    {
      title: 'Its moons',
      text: 'Triton is drawn as a body with Voyager 2’s colour map of what it saw — its northern half was in darkness and is filled with an average. Its other moons are in the Small Moons layer, off by default.',
      cite: ['smith1989'],
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Radius 24,764 km at the equator and 24,341 km at the poles, at the 1-bar level; mass 1.02 × 10²⁶ kg, 17 Earths; mean density 1.64 g/cm³ — smaller than Uranus but denser and heavier.',
      cite: ['nssdc'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 4,515 million km, 30.1 times Earth’s; one orbit takes 60,189 days, 164.8 years, at 5.45 km/s. Axis tilted 28.32°.',
      cite: ['nssdc'],
    },
    {
      title: 'Discovery',
      text: 'By Johann Gottfried Galle on 23 September 1846, where Urbain Le Verrier’s calculation put it; John Couch Adams had made a similar prediction.',
      cite: ['nssdc'],
    },
    {
      title: 'Atmosphere',
      text: 'By volume, 80% hydrogen, 19% helium and 1.5% methane, which absorbs red light and gives it its colour. Winds of up to 580 m/s; a thin cloud of methane ice near the 1.5-bar level and a thick one below 3 bars.',
      cite: ['nssdc', 'stone1989'],
    },
    {
      title: 'Its heat',
      text: 'It gives off 2.61 ± 0.28 times the energy it absorbs from the Sun; its effective temperature is 59.3 K, against 46.6 K if it were only warmed by sunlight.',
      cite: ['pearl1991'],
    },
    {
      title: 'Magnetic field',
      text: 'A dipole tilted 47° from the rotation axis and offset from the centre by 0.55 of the planet’s radius, turning once in 16.11 hours.',
      cite: ['ness1989', 'stone1989'],
    },
    {
      title: 'The Great Dark Spot',
      text: 'An anticyclone about 13,000 by 6,600 km, as long as Earth is wide, seen by Voyager 2 in 1989. Hubble images in 1994 found it gone, and a dark spot of the same size in the northern hemisphere instead.',
      cite: ['smith1989', 'hammel1995'],
    },
    {
      title: 'Rings',
      text: 'Very dark and dusty: three main rings at 42,000, 53,000 and 63,000 km from the centre, the outer one with three thicker arcs that had blinked out stars seen from Earth in the 1980s. Voyager 2 found four new rings.',
      cite: ['smith1989', 'voyager2'],
    },
    {
      title: 'Moons',
      text: '16 known; Voyager 2 found six of them, all inside Triton’s orbit. Triton is 1,350 km in radius, orbits backwards, has a thin nitrogen atmosphere and at least two active plumes that carried dark material 8 km up.',
      cite: ['nssdc', 'voyager2', 'smith1989', 'stone1989'],
    },
    {
      title: 'Voyager 2',
      text: 'The only spacecraft to visit: closest approach 25 August 1989 at 03:56 UT, about 4,800 km above the cloud tops.',
      cite: ['voyager2'],
    },
  ],
  estimated: [
    {
      title: 'Its inside',
      text: 'No instrument has seen inside. Models that fit its mass, size, gravity and spin give a hydrogen-helium envelope over a deep layer rich in water, methane and ammonia, around a rocky core — with many mixtures fitting the same numbers.',
      cite: ['helled2020'],
    },
    {
      title: 'What its dark spots are',
      text: 'A model of its hazes fitted to Hubble and Voyager spectra explains the dark spots as a darkening, or a clearing, of its deepest haze layer, several bars down — not holes into the planet.',
      cite: ['irwin2022'],
    },
    {
      title: 'Where Triton came from',
      text: 'A backward orbit cannot form around a planet, so Triton was almost certainly captured. The leading model has it arriving as one of a pair of bodies from the Kuiper belt; Neptune kept Triton and flung its partner away.',
      cite: ['agnor2006'],
    },
  ],
  missing: [
    {
      title: 'Today’s clouds',
      text: 'Not drawn. Its weather changes within years — the Great Dark Spot of 1989 was gone by 1994 and new dark spots have come and gone since — and the map is a single fixed picture of 1989.',
      cite: ['hammel1995'],
    },
    {
      title: 'Different winds at different latitudes',
      text: 'The map turns as one piece, at a single rate. The real clouds do not: at different latitudes they move at very different speeds, up to 580 m/s, so a rigid map is right only at the latitudes that keep the rate it turns at.',
      cite: ['nssdc', 'karkoschka2011'],
    },
    {
      title: 'The Adams ring’s arcs',
      text: 'Not drawn yet. Five clumps — Fraternité, Égalité 1 and 2, Liberté, Courage — within 40° of the Adams ring, three to eight times denser than the rest of it, moving round with it. Their rate is known well; their places are not fixed: since Voyager, Courage has jumped 8° ahead and Liberté had nearly faded by 2003. Placing them needs their latest measured longitudes, which have not been brought in; drawn at a guessed place they would be a picture, not a measurement. Arago, a brightening at Lassell’s outer edge whose depth is not measured, is not drawn either.',
      cite: ['smith1989', 'depater2005'],
    },
    {
      title: 'Its rings from behind',
      text: 'Not drawn as they look. They are mostly dust, and dust shines many times brighter seen towards the Sun — Voyager 2 saw them best looking back. Here their brightness does not change with the angle, so from behind Neptune they are as faint as from in front.',
      cite: ['smith1989'],
    },
    {
      title: 'A close look since 1989',
      text: 'There has been none. Everything up close comes from a single flyby, and its maps cover only what was lit then.',
      cite: ['voyager2'],
    },
  ],
  misconceptions: [
    {
      title: 'Neptune is not deep blue',
      text: 'It is a pale blue, only a little bluer than Uranus, which has more haze. The deep blue of the pictures everyone knows came from Voyager images stretched to show its clouds; the captions saying so got separated from them over the years.',
      cite: ['irwin2024'],
    },
    {
      title: 'Its Great Dark Spot is not a fixture',
      text: 'Neptune’s dark spots come and go within a few years: the one Voyager 2 saw, as long as Earth is wide, was gone five years later.',
      cite: ['hammel1995'],
    },
    {
      title: 'Far from the Sun is not quiet',
      text: 'It gets a nine-hundredth of Earth’s sunlight and still has winds of up to 580 m/s. It radiates 2.6 times what it absorbs, and that heat from inside is thought to help drive its weather.',
      cite: ['nssdc', 'pearl1991'],
    },
    {
      title: 'It will not collide with Pluto',
      text: 'Pluto’s orbit crosses inside Neptune’s, but Pluto goes round exactly twice for every three of Neptune’s, a resonance that keeps the two far apart every time Pluto crosses.',
      cite: ['cohen1965'],
    },
    {
      title: 'It is not a gas giant like Jupiter',
      text: 'Hydrogen and helium are only its outer layer. Most of its mass is thought to be heavier material — water, methane, ammonia and rock — which is why it is called an ice giant.',
      cite: ['helled2020'],
    },
  ],
  sources: [
    {
      key: 'nssdc',
      text: 'Williams, D. R., Neptune Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html',
    },
    {
      key: 'nssdcuranus',
      text: 'Williams, D. R., Uranus Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html',
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
      key: 'irwin2024',
      text: 'Irwin, P. G. J., et al. 2024, Modelling the seasonal cycle of Uranus’s colour and magnitude, and comparison with Neptune, MNRAS 527, 11521',
      url: 'https://doi.org/10.1093/mnras/stad3761',
    },
    {
      key: 'mallama2017',
      text: 'Mallama, A., Krobusek, B., & Pavlov, H. 2017, Comprehensive wide-band magnitudes and albedos for the planets, with applications to exo-planets and Planet Nine, Icarus 282, 19',
      url: 'https://arxiv.org/abs/1609.05048',
    },
    {
      key: 'horn1990',
      text: 'Horn, L. J., Hui, J., Lane, A. L., & Colwell, J. E. 1990, Observations of Neptunian rings by Voyager photopolarimeter experiment, Geophys. Res. Lett. 17, 1745',
    },
    {
      key: 'depater2005',
      text: 'de Pater, I., et al. 2005, The dynamic neptunian ring arcs: evidence for a gradual disappearance of Liberté and resonant jump of Courage, Icarus 174, 263',
    },
    {
      key: 'irwin2022',
      text: 'Irwin, P. G. J., et al. 2022, Hazy Blue Worlds: A Holistic Aerosol Model for Uranus and Neptune, Including Dark Spots, J. Geophys. Res. Planets 127, e2022JE007189',
      url: 'https://doi.org/10.1029/2022JE007189',
    },
    {
      key: 'karkoschka2011',
      text: 'Karkoschka, E. 2011, Neptune’s rotational period suggested by the extraordinary stability of two features, Icarus 215, 439',
      url: 'https://doi.org/10.1016/j.icarus.2011.05.013',
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
      key: 'ness1989',
      text: 'Ness, N. F., et al. 1989, Magnetic Fields at Neptune, Science 246, 1473',
      url: 'https://doi.org/10.1126/science.246.4936.1473',
    },
    {
      key: 'pearl1991',
      text: 'Pearl, J. C., & Conrath, B. J. 1991, The albedo, effective temperature, and energy balance of Neptune, as determined from Voyager data, J. Geophys. Res. 96, 18921',
      url: 'https://doi.org/10.1029/91JA01087',
    },
    {
      key: 'hammel1995',
      text: 'Hammel, H. B., et al. 1995, Hubble Space Telescope Imaging of Neptune’s Cloud Structure in 1994, Science 268, 1740',
      url: 'https://doi.org/10.1126/science.268.5218.1740',
    },
    {
      key: 'voyager2',
      text: 'NASA Science, Voyager 2 (mission page: the Uranus and Neptune encounters)',
      url: 'https://science.nasa.gov/mission/voyager/voyager-2/',
    },
    {
      key: 'helled2020',
      text: 'Helled, R., Nettelmann, N., & Guillot, T. 2020, Uranus and Neptune: Origin, Evolution and Internal Structure, Space Sci. Rev. 216, 38',
      url: 'https://doi.org/10.1007/s11214-020-00660-3',
    },
    {
      key: 'agnor2006',
      text: 'Agnor, C. B., & Hamilton, D. P. 2006, Neptune’s capture of its moon Triton in a binary–planet gravitational encounter, Nature 441, 192',
      url: 'https://doi.org/10.1038/nature04792',
    },
    {
      key: 'cohen1965',
      text: 'Cohen, C. J., & Hubbard, E. C. 1965, Libration of the close approaches of Pluto to Neptune, AJ 70, 10',
      url: 'https://doi.org/10.1086/109674',
    },
  ],
};
