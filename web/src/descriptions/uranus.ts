import type { Description } from './types.ts';

/**
 * Uranus. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model.
 */
export const URANUS: Description = {
  id: 'uranus',
  lead: [
    'Uranus is a world knocked onto its side, rolling around the Sun with its poles where its equator should be, so that each pole has decades of daylight and then decades of night. Only one spacecraft has ever been there, Voyager 2, in a single flyby in 1986; almost everything known about it up close comes from that brief visit.',
    'Uranus is the seventh planet from the Sun, an ice giant four times as wide as Earth and 14.5 times as massive. It was the first planet found with a telescope: William Herschel saw it on 13 March 1781 and took it at first for a comet. Through a small telescope it is a pale greenish-blue disc with almost nothing on it.',
    'It lies on its side. Its axis is tipped 98° from upright, so over its 84-year orbit each pole has about 42 years of sunlight and then 42 years of night. Its colour comes from methane, which absorbs red light, and from a haze whose thickness changes with those long seasons. Under the clouds, most of its mass is thought to be water, methane and ammonia — the “ices” of an ice giant — as a hot, dense fluid around a rocky core, although nobody knows in what proportions.',
    'It is an odd planet in other ways too. It gives off barely more heat than it gets from the Sun, unlike every other giant, and no one knows why. Its magnetic field is tilted 60° from its axis and its centre is pushed a third of the way out from the planet’s. It has 13 known rings, narrow and dark, first found in 1977 when they dimmed a star passing behind them, and 29 known moons as of 2025.',
    'Only one spacecraft has ever been there. Voyager 2 flew 81,500 kilometres from it on 24 January 1986, found ten moons and two rings, and saw almost no clouds. Since then Hubble, the large telescopes on the ground and Webb have watched storms come and go, and a bright cap grow over the north pole as northern summer comes on; the solstice is in 2028.',
    'It orbits 19 times as far from the Sun as Earth does, 2.87 billion kilometres, where sunlight takes 2 hours 40 minutes to arrive, at 6.8 kilometres per second. Its day, timed by its aurorae, is 17 hours 14 minutes 52 seconds — and because its axis is tipped past the vertical, it turns backwards compared with Earth.',
  ],
  photos: [
    {
      file: 'photos/uranus/voyager-1986.webp',
      largeFile: 'photos/uranus/voyager-1986-large.webp',
      width: 640,
      height: 640,
      title: 'Uranus from Voyager 2, January 1986',
      caption:
        'The planet as Voyager 2 saw it on approach, its south pole, then facing the Sun, near the centre: a pale, almost featureless green-blue. NASA’s page does not say how it was processed; its colour matches Voyager’s calibrated true-colour view, further down.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '1986-01',
      sourceUrl: 'https://images.nasa.gov/details/PIA18182',
    },
    {
      file: 'photos/uranus/seasons-2014-2022.webp',
      largeFile: 'photos/uranus/seasons-2014-2022-large.webp',
      width: 640,
      height: 625,
      title: 'Nine years of Uranus in true colour, 2014–2022',
      caption:
        'Hubble’s yearly images converted to what an eye would see, north at the top, with the equator and 35° north and south marked. As northern summer approaches, the paler north pole swings down towards the middle of the disc and grows more pronounced.',
      colour: 'true',
      credit: 'Irwin et al. 2024, MNRAS 527, 11521, from NASA/ESA Hubble OPAL data',
      licence: 'CC BY 4.0',
      date: '2014–2022',
      sourceUrl: 'https://doi.org/10.1093/mnras/stad3761',
    },
    {
      file: 'photos/uranus/muse-2021-voyager-1986.webp',
      largeFile: 'photos/uranus/muse-2021-voyager-1986-large.webp',
      width: 640,
      height: 335,
      title: 'Uranus in 2021 and 1986, in true colour',
      caption:
        'Left, from the Very Large Telescope’s MUSE spectrograph in 2021; right, from Voyager 2’s filter images in 1986, both turned into what an eye would see and set with the south pole down. Thirty-five years apart and almost the same colour.',
      colour: 'true',
      credit: 'Irwin et al. 2024, MNRAS 527, 11521, from ESO VLT and NASA Voyager 2 data',
      licence: 'CC BY 4.0',
      date: '2021 and 1986',
      sourceUrl: 'https://doi.org/10.1093/mnras/stad3761',
    },
    {
      file: 'photos/uranus/voyager-true-false.webp',
      largeFile: 'photos/uranus/voyager-true-false-large.webp',
      width: 640,
      height: 320,
      title: 'The same Uranus in true and false colour, 17 January 1986',
      caption:
        'Left, through blue, green and orange filters, as an eye would see it. Right, the ultraviolet, violet and orange images shown as blue, green and red, with the contrast pushed hard: a dark hood over the south pole ringed by lighter bands, all there in the left-hand picture but too faint to see.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1986-01-17',
      sourceUrl: 'https://images.nasa.gov/details/PIA00032',
    },
    {
      file: 'photos/uranus/webb-2023.webp',
      largeFile: 'photos/uranus/webb-2023-large.webp',
      width: 640,
      height: 640,
      title: 'Uranus and its rings from Webb, 6 February 2023',
      caption:
        'In infrared, where the rings show far better than in visible light: the bright outer ε ring and the fainter ones inside it. The white glow on the right is the north polar cap, on the side facing the Sun, with bright clouds, probably storms, at its edge. Two infrared bands shown in blue and orange.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI; image processing J. DePasquale (STScI)',
      licence: 'NASA media; credit requested',
      date: '2023-02-06',
      sourceUrl: 'https://science.nasa.gov/asset/webb/uranus-nircam-image/',
    },
    {
      file: 'photos/uranus/hubble-aurora.webp',
      largeFile: 'photos/uranus/hubble-aurora-large.webp',
      width: 640,
      height: 542,
      title: 'Aurorae on Uranus, 2012 and 2014',
      caption:
        'A composite: Voyager 2’s picture of the planet, Hubble’s of its ring, and Hubble’s ultraviolet images of its aurorae, the white patches, which flared when gusts of solar wind arrived. The colours are a convention; the aurorae shine in ultraviolet.',
      colour: 'false',
      credit: 'ESA/Hubble & NASA, L. Lamy / Observatoire de Paris',
      licence: 'CC BY 4.0',
      date: '2017-04-03',
      sourceUrl: 'https://esahubble.org/images/potw1714a/',
    },
  ],
  drawnHere: [
    {
      title: 'Lying on its side',
      text: 'Its pole is the IAU’s, and it turns backwards about it; the same axis seen from its other end is the 97.77° tilt the fact sheets quote. Nothing is set by hand: the seasons follow from the pole and JPL’s orbit, so near the 2028 solstice the app shows what the sky does — the north pole turned nearly to the Sun, nearly all its northern half in continuous day and nearly all its southern half in a night that lasts years, decades near the pole.',
      cite: ['archinal2018', 'nssdc', 'hubble2022'],
    },
    {
      title: 'Its map',
      text: 'An illustrative map: smooth bands of pale cyan, darker towards the south, with no storm or cloud in it. Its average brightness, 0.51, is close to Uranus’s measured geometric albedo, 0.49, and its colour close to the pale green-blue of true-colour pictures; it is not a map of any day’s clouds.',
      cite: ['nssdc', 'irwin2024'],
    },
    {
      title: 'Its day, and its drift',
      text: 'It turns at the IAU’s rate, 17.24 hours, the period Voyager 2 timed from its magnetic field in 1986. Hubble’s aurorae have since given 17.247864 hours, 28 seconds longer; at that difference the Voyager-era longitudes have drifted round more than nine times since 1986. On a map with no features the drift cannot be seen.',
      cite: ['archinal2018', 'lamy2025'],
    },
    {
      title: 'Its moons',
      text: 'Miranda, Ariel, Umbriel, Titania and Oberon are drawn as bodies, each on JPL’s orbit and turned by the IAU’s model, with Voyager 2’s maps of their southern halves; their northern halves were in darkness in 1986 and are filled with an average. Its small moons are in the Small Moons layer, off by default.',
      cite: ['archinal2018', 'voyager2'],
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Radius 25,559 km at the equator and 24,973 km at the poles, at the 1-bar level; mass 8.68 × 10²⁵ kg, 14.5 Earths; mean density 1.27 g/cm³, a quarter of Earth’s.',
      cite: ['nssdc'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 2,867 million km, 19.2 times Earth’s; one orbit takes 30,685 days, 84 years, at 6.79 km/s.',
      cite: ['nssdc'],
    },
    {
      title: 'Tilt and day',
      text: 'Axis 97.77° from the perpendicular to its orbit. Day 17.247864 ± 0.000010 hours, from eleven years of Hubble images of its aurorae — 28 seconds longer than Voyager 2’s 17.24, which was too uncertain to keep track of longitude for more than a few years.',
      cite: ['nssdc', 'lamy2025'],
    },
    {
      title: 'Discovery',
      text: 'By William Herschel, on 13 March 1781, with a telescope he had built himself; he reported it to the Royal Society as a comet.',
      cite: ['herschel1781'],
    },
    {
      title: 'Atmosphere',
      text: 'By volume, 82.5% hydrogen, 15.2% helium and 2.3% methane. The methane absorbs red light, which is what makes it green-blue. Winds of up to 250 m/s.',
      cite: ['nssdc', 'pia00032'],
    },
    {
      title: 'Its heat',
      text: 'Voyager 2’s infrared spectrometer found it giving off only 1.06 ± 0.08 times the energy it absorbs from the Sun — consistent with no internal heat at all. Its effective temperature is 59.1 K.',
      cite: ['pearl1990'],
    },
    {
      title: 'Magnetic field',
      text: 'A dipole tilted 60° from the rotation axis and offset from the centre by 0.3 of the planet’s radius, so the field at the cloud tops ranges from about 0.1 to 1.1 gauss.',
      cite: ['ness1986'],
    },
    {
      title: 'Rings',
      text: 'Thirteen. The first five were found in 1977 from Earth, when a star blinked behind them before and after passing behind the planet; nine were known by 1986, when Voyager 2 added two; Hubble found the two outermost, faint and dusty, reported in 2006.',
      cite: ['elliot1977', 'voyager2', 'showalter2006'],
    },
    {
      title: 'Moons',
      text: '29 known. Voyager 2 found ten; the 29th, S/2025 U1, about 10 km across, was found in Webb images taken on 2 February 2025.',
      cite: ['voyager2', 'webbmoon2025'],
    },
    {
      title: 'Seasons',
      text: 'Its equinox was in 2007, its northern summer solstice is in 2028, and Hubble has watched its north polar cap brighten year after year in between. Its colour and brightness change over the seasons: greener at the solstices, as polar methane thins and a haze layer grows more reflective.',
      cite: ['hubble2022', 'irwin2024'],
    },
  ],
  estimated: [
    {
      title: 'Its inside',
      text: 'No instrument has seen inside. Models that fit its mass, size, gravity field and spin put a hydrogen-helium envelope over a deep layer of water, methane and ammonia, probably a hot ionic fluid that carries the magnetic field, around a core of rock — but many different mixtures fit the same few numbers, and the layers may blend into one another.',
      cite: ['helled2020'],
    },
    {
      title: 'Why it lies on its side',
      text: 'Most likely from collisions with large bodies while it was forming. Its regular moons orbit in its tipped equator, the same way it spins. A disc of debris round it would settle into the new equator after a blow, but after a single blow tipping an upright Uranus past 90° the moons that formed from it would go round backwards; for them to go round forwards, Uranus must already have been tilted before the last blow — so at least two collisions.',
      cite: ['morbidelli2012'],
    },
    {
      title: 'Its colour through the seasons',
      text: 'A model of its haze and methane, fitted to 70 years of brightness measurements from Lowell Observatory and Hubble, reproduces how it greens and pales over its orbit. The model is fitted, and the particles it needs are inferred, not sampled.',
      cite: ['irwin2024'],
    },
  ],
  missing: [
    {
      title: 'Its clouds and storms',
      text: 'Not drawn. Voyager 2 saw almost none, but they are there: Keck and Gemini images since 2012 show bright storms and changing cloud patterns, and its north polar cap has grown brighter every year. A map is a single fixed picture and this one has none of them.',
      cite: ['sromovsky2015', 'hubble2022'],
    },
    {
      title: 'Its rings',
      text: 'Not drawn. They are real and measured — thirteen of them, narrow and nearly black — but the app draws rings only for Saturn so far.',
      cite: ['elliot1977', 'showalter2006'],
    },
    {
      title: 'Its newest moon',
      text: 'S/2025 U1, found by Webb in 2025, is not yet in the JPL tables the app’s moons come from (October 2026), so it is not drawn.',
      cite: ['webbmoon2025'],
    },
    {
      title: 'A close look since 1986',
      text: 'There has been none. Everything up close comes from a single flyby that lasted a few days, in the depth of southern summer, with the northern hemisphere dark. The US planetary science decadal survey made a Uranus orbiter and atmospheric probe its top priority for a new flagship mission.',
      cite: ['voyager2', 'decadal2022'],
    },
    {
      title: 'Its magnetic field and aurorae',
      text: 'Neither is drawn: the field’s tilt and offset are measured, but the app does not draw any planet’s magnetosphere except Earth’s.',
      cite: ['ness1986'],
    },
  ],
  misconceptions: [
    {
      title: 'It does not roll along its orbit',
      text: 'Its axis keeps pointing the same way in space as it goes round, like every planet’s. Lying on its side means its poles take turns facing the Sun, 42 years apart, with its equator facing it at the equinoxes in between — not that it rolls like a wheel.',
      cite: ['archinal2018', 'hubble2022'],
    },
    {
      title: 'Uranus and Neptune are nearly the same colour',
      text: 'Uranus is pale green-blue and Neptune only slightly bluer, because Uranus has more haze. The idea that Neptune is a much deeper blue comes from Voyager pictures of it that were stretched to bring out its clouds.',
      cite: ['irwin2024'],
    },
    {
      title: 'It is not the coldest because it is far',
      text: 'Neptune is half as far again from the Sun and gets less than half the sunlight, yet the two radiate at the same temperature, 59 K: Neptune makes up the difference with heat from inside, and Uranus has almost none.',
      cite: ['pearl1990', 'pearl1991'],
    },
    {
      title: 'It is not featureless',
      text: 'Voyager 2 caught it at a quiet time. Seen since, especially in infrared, it has bright storms, banded clouds and a polar cap that changes with the seasons.',
      cite: ['sromovsky2015', 'hubble2022'],
    },
    {
      title: 'An ice giant is not made of ice',
      text: 'The “ices” are what the material is — water, methane and ammonia — not its state. Inside, at thousands of degrees and enormous pressure, it is thought to be a hot, dense fluid.',
      cite: ['helled2020'],
    },
  ],
  sources: [
    {
      key: 'nssdc',
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
      key: 'herschel1781',
      text: 'Herschel, W. 1781, Account of a Comet, Phil. Trans. R. Soc. Lond. 71, 492',
      url: 'https://doi.org/10.1098/rstl.1781.0056',
    },
    {
      key: 'lamy2025',
      text: 'Lamy, L., et al. 2025, A new rotation period and longitude system for Uranus, Nature Astronomy 9, 658',
      url: 'https://doi.org/10.1038/s41550-025-02492-z',
    },
    {
      key: 'irwin2024',
      text: 'Irwin, P. G. J., et al. 2024, Modelling the seasonal cycle of Uranus’s colour and magnitude, and comparison with Neptune, MNRAS 527, 11521',
      url: 'https://doi.org/10.1093/mnras/stad3761',
    },
    {
      key: 'pia00032',
      text: 'NASA/JPL 1996, Uranus in True and False Color (PIA00032), Voyager 2 imaging',
      url: 'https://images.nasa.gov/details/PIA00032',
    },
    {
      key: 'pearl1990',
      text: 'Pearl, J. C., et al. 1990, The albedo, effective temperature, and energy balance of Uranus, as determined from Voyager IRIS data, Icarus 84, 12',
      url: 'https://doi.org/10.1016/0019-1035(90)90155-3',
    },
    {
      key: 'pearl1991',
      text: 'Pearl, J. C., & Conrath, B. J. 1991, The albedo, effective temperature, and energy balance of Neptune, as determined from Voyager data, J. Geophys. Res. 96, 18921',
      url: 'https://doi.org/10.1029/91JA01087',
    },
    {
      key: 'ness1986',
      text: 'Ness, N. F., et al. 1986, Magnetic Fields at Uranus, Science 233, 85',
      url: 'https://doi.org/10.1126/science.233.4759.85',
    },
    {
      key: 'elliot1977',
      text: 'Elliot, J. L., Dunham, E., & Mink, D. 1977, The rings of Uranus, Nature 267, 328',
      url: 'https://doi.org/10.1038/267328a0',
    },
    {
      key: 'showalter2006',
      text: 'Showalter, M. R., & Lissauer, J. J. 2006, The Second Ring-Moon System of Uranus: Discovery and Dynamics, Science 311, 973',
      url: 'https://doi.org/10.1126/science.1122882',
    },
    {
      key: 'voyager2',
      text: 'NASA Science, Voyager 2 (mission page: the Uranus and Neptune encounters)',
      url: 'https://science.nasa.gov/mission/voyager/voyager-2/',
    },
    {
      key: 'webbmoon2025',
      text: 'NASA Webb blog 2025, New Moon Discovered Orbiting Uranus Using NASA’s Webb Telescope, 19 August 2025',
      url: 'https://science.nasa.gov/blogs/webb/2025/08/19/new-moon-discovered-orbiting-uranus-using-nasas-webb-telescope/',
    },
    {
      key: 'hubble2022',
      text: 'NASA Science, Uranus (Nov. 2014 and Nov. 2022), Hubble Space Telescope: A. Simon, M. Wong, J. DePasquale',
      url: 'https://science.nasa.gov/asset/hubble/uranus-nov-2014-and-nov-2022/',
    },
    {
      key: 'helled2020',
      text: 'Helled, R., Nettelmann, N., & Guillot, T. 2020, Uranus and Neptune: Origin, Evolution and Internal Structure, Space Sci. Rev. 216, 38',
      url: 'https://doi.org/10.1007/s11214-020-00660-3',
    },
    {
      key: 'morbidelli2012',
      text: 'Morbidelli, A., et al. 2012, Explaining why the uranian satellites have equatorial prograde orbits despite the large planetary obliquity, Icarus 219, 737',
      url: 'https://doi.org/10.1016/j.icarus.2012.03.025',
    },
    {
      key: 'sromovsky2015',
      text: 'Sromovsky, L. A., et al. 2015, High S/N Keck and Gemini AO imaging of Uranus during 2012–2014: New cloud patterns, increasing activity, and improved wind measurements, Icarus 258, 192',
      url: 'https://doi.org/10.1016/j.icarus.2015.05.029',
    },
    {
      key: 'decadal2022',
      text: 'National Academies of Sciences, Engineering, and Medicine 2022, Origins, Worlds, and Life: A Decadal Strategy for Planetary Science and Astrobiology 2023–2032',
      url: 'https://doi.org/10.17226/26522',
    },
  ],
};
