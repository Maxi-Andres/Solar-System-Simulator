import type { Description } from './types.ts';

/**
 * Venus. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model.
 */
export const VENUS: Description = {
  id: 'venus',
  lead: [
    'Venus is the planet that shows how a world like ours can go wrong. Born almost Earth’s twin, it may once have had oceans; today its ground is hotter than a kitchen oven, under a sky that never clears.',
    'Venus is the second planet from the Sun and the one most like Earth in size: 12,104 kilometres across, 95% of Earth’s width, with four-fifths of its mass. After the Moon it is the brightest thing in the night sky, because it is wrapped completely in pale clouds that reflect most of the sunlight that falls on them. Those clouds never part, and they are not water: they are droplets of sulfuric acid.',
    'Under them is the hottest surface of any planet. The air is almost all carbon dioxide and so thick that the pressure on the ground is 92 times Earth’s, like being nearly a kilometre under the sea. It traps the Sun’s heat so well — a runaway greenhouse effect — that the ground stays at about 464 °C, day and night, pole and equator, hot enough to melt lead. Venus is hotter than Mercury, which is nearly twice as close to the Sun.',
    'It spins slowly, and backwards. One turn takes 243 Earth days, longer than its year of 225, and in the opposite sense to almost every other planet, so on Venus the Sun would rise in the west, and sunrise to sunrise would take 117 Earth days. Its clouds do the opposite of the ground: high winds carry them right round the planet in about four days.',
    'No one has seen its ground with their eyes. Radar sees through the clouds: NASA’s Magellan mapped almost all of it in the early 1990s, finding volcanoes, lava plains and mountain belts, and a surface young enough that it must have been largely remade by lava in the last few hundred million years. A handful of Soviet Venera landers photographed the rocks around them before the heat killed them, the longest-lived after about two hours.',
    'It orbits the Sun in a nearly perfect circle 108 million kilometres out, inside Earth’s orbit, so from here it never strays more than about 47° from the Sun: it is the “morning star” or the “evening star”, never seen at midnight. It comes closer to Earth than any other planet, to 38 million kilometres, and through a telescope it shows phases like the Moon’s. Rarely, it crosses the face of the Sun: in pairs eight years apart, the last in 2012, the next in 2117.',
  ],
  photos: [
    {
      file: 'photos/venus/moon-venus-2026.webp',
      largeFile: 'photos/venus/moon-venus-2026-large.webp',
      width: 640,
      height: 426,
      title: 'Venus and the Moon over Washington, 18 May 2026',
      caption:
        'The bright point on the left is Venus, beside a thin crescent Moon whose dark part glows faintly with earthshine. This is how almost everyone has seen Venus: a brilliant star-like light in the twilight.',
      colour: 'true',
      credit: 'NASA/Bill Ingalls',
      licence: 'NASA media, not copyrighted',
      date: '2026-05-18',
      sourceUrl: 'https://images.nasa.gov/details/NHQ202605180001',
    },
    {
      file: 'photos/venus/messenger-2007.webp',
      largeFile: 'photos/venus/messenger-2007-large.webp',
      width: 640,
      height: 640,
      title: 'From MESSENGER on its way past, 5 June 2007',
      caption:
        'In visible light Venus is a bright, almost blank disc: the cloud deck hides the ground completely and shows hardly a marking. Black and white, from the spacecraft that went on to orbit Mercury.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington',
      licence: 'NASA media, not copyrighted',
      date: '2007-06-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA10124',
    },
    {
      file: 'photos/venus/transit-2012.webp',
      largeFile: 'photos/venus/transit-2012-large.webp',
      width: 640,
      height: 640,
      title: 'Venus crossing the Sun, 5 June 2012',
      caption:
        'The round black dot near the upper left edge is Venus, in silhouette against the Sun, with sunspots scattered across the disc. The Solar Dynamics Observatory sees the photosphere in one narrow band of visible light; the orange is a tint.',
      colour: 'tinted',
      credit: 'NASA/SDO, HMI',
      licence: 'NASA media, not copyrighted',
      date: '2012-06-05',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001742',
    },
    {
      file: 'photos/venus/galileo-violet-1990.webp',
      largeFile: 'photos/venus/galileo-violet-1990-large.webp',
      width: 500,
      height: 500,
      title: 'The cloud tops in violet light, 14 February 1990',
      caption:
        'Galileo, on its way to Jupiter, through a violet filter, where the sulfuric acid clouds show their bands and the bright hoods over the poles. One filter, tinted blue to say which.',
      colour: 'tinted',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1990-02-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA00111',
    },
    {
      file: 'photos/venus/mariner-10-1974.webp',
      largeFile: 'photos/venus/mariner-10-1974-large.webp',
      width: 640,
      height: 638,
      title: 'Mariner 10, February 1974',
      caption:
        'Mariner 10’s view, reprocessed in 2020: an orange and an ultraviolet image as red and blue, green made from the two. The faint streaks and the reddish patches are what ultraviolet shows — an unknown substance in the clouds absorbs it — so the picture is more marked than an eye would see.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech; processed by Kevin M. Gill',
      licence: 'NASA media, not copyrighted',
      date: '1974-02',
      sourceUrl: 'https://images.nasa.gov/details/PIA23791',
    },
    {
      file: 'photos/venus/galileo-infrared-1990.webp',
      largeFile: 'photos/venus/galileo-infrared-1990-large.webp',
      width: 640,
      height: 640,
      title: 'The night side in infrared, 10 February 1990',
      caption:
        'Galileo looked at the dark side at 2.3 micrometres, three times the longest wavelength the eye can see, where the heat of the lower air shines up through the clouds. Clouds about 50 km up stand in its way: thin cloud shows white and red, thick cloud blue and black.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1990-02-10',
      sourceUrl: 'https://images.nasa.gov/details/PIA00112',
    },
    {
      file: 'photos/venus/magellan-globe.webp',
      largeFile: 'photos/venus/magellan-globe-large.webp',
      width: 640,
      height: 640,
      title: 'The ground under the clouds, by radar',
      caption:
        'Magellan’s radar map laid on a globe, centred on 180°E; gaps are filled with Pioneer Venus data. Bright means rough to radar, not pale. The orange hues are borrowed from the colour pictures the Venera 13 and 14 landers took on the ground — the real light down there is orange, because the thick air filters out the blue.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1996-11-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA00104',
    },
    {
      file: 'photos/venus/maat-mons.webp',
      largeFile: 'photos/venus/maat-mons-large.webp',
      width: 640,
      height: 512,
      title: 'Maat Mons, by radar, heights 22.5 times exaggerated',
      caption:
        'A volcano 8 km high, seen from 560 km to its north. Built by computer from Magellan’s radar and heights, the vertical scale stretched 22.5 times — the real slopes are gentle — and coloured, again, after the Venera landers’ pictures.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1996-03-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA00254',
    },
  ],
  drawnHere: [
    {
      title: 'Its clouds, not its ground',
      text: 'Its map is the top of the cloud deck, which is what there is to see. It is an artist’s composite, more strongly marked than Venus looks: in visible light the clouds are pale and nearly featureless, and their markings show mostly in ultraviolet.',
      cite: ['titov2018'],
    },
    {
      title: 'Clouds that turn with the ground',
      text: 'The map is fixed to the planet, so it turns once in 243 days, backwards. The real cloud tops go round in about four days, some sixty times faster than the ground beneath them; here they do not.',
      cite: ['margot2021', 'sanchezlavega2017'],
    },
    {
      title: 'Backwards, or upside down',
      text: 'The IAU puts Venus’s north pole on the same side of the Solar System as Earth’s, so it turns backwards about it. NASA’s fact sheet also gives the tilt the other way round, as 177°: the same spin, described about the opposite pole.',
      cite: ['archinal2018', 'nssdcVenus'],
    },
    {
      title: 'The brightest disc',
      text: 'It is the brightest planet in the scene because it is in the sky: its clouds send back more sunlight than any other planet, geometric albedo 0.689. In Natural lighting its night side is black, as everywhere here.',
      cite: ['nssdcVenus'],
    },
    {
      title: 'No air around it',
      text: 'The haze above its clouds is not drawn — the app models only Earth’s atmosphere — so its edge is as sharp as an airless world’s.',
    },
  ],
  measured: [
    {
      title: 'Size',
      text: 'Radius 6,051.8 km, round to within what can be measured, from Magellan’s radar altimetry, as the IAU adopts it. That is the solid surface; the cloud tops are some 70 km higher.',
      cite: ['archinal2018', 'titov2018'],
    },
    {
      title: 'Mass',
      text: 'GM = 324,858.59 km³/s², from the spacecraft that have orbited and flown past it: 4.87 × 10²⁴ kg, 81.5% of Earth’s.',
      cite: ['de440', 'nssdcVenus'],
    },
    {
      title: 'Its spin',
      text: 'Once in 243.0226 days, backwards, measured by bouncing radar off the surface from Earth. The length of its day changes by up to about 20 minutes, the thick atmosphere trading spin with the ground.',
      cite: ['margot2021'],
    },
    {
      title: 'Heat and pressure',
      text: 'At the surface, 737 K (464 °C) and 92 bar, from the landers and descent probes that reached it.',
      cite: ['nssdcVenus'],
    },
    {
      title: 'Its air',
      text: '96.5% carbon dioxide and 3.5% nitrogen, by volume, near the surface.',
      cite: ['nssdcVenus'],
    },
    {
      title: 'Its clouds',
      text: 'Sulfuric acid droplets, identified in 1974 from how the clouds polarise sunlight. The main deck lies between about 48 and 70 km up.',
      cite: ['hansen1974', 'titov2018'],
    },
    {
      title: 'Its winds',
      text: 'About 100 m/s at the cloud tops, taking them round the planet in four to five days, while the air at the ground barely moves, at 0.3 to 1 m/s.',
      cite: ['sanchezlavega2017', 'nssdcVenus'],
    },
    {
      title: 'Its surface',
      text: 'Mapped by Magellan’s radar from orbit, almost all of it, at a resolution of a few hundred metres. Venera 13 photographed the ground in colour in 1982 and lasted 127 minutes.',
      cite: ['saunders1992', 'nssdcVenera13'],
    },
    {
      title: 'Still volcanic',
      text: 'A volcanic vent on Maat Mons changed shape and grew between two Magellan radar passes eight months apart in 1991: the first direct sign of an eruption on Venus.',
      cite: ['herrick2023'],
    },
    {
      title: 'No magnetic field of its own',
      text: 'Spacecraft have found none made inside the planet; the solar wind meets its upper atmosphere directly.',
      cite: ['phillips1987'],
    },
    {
      title: 'Orbit',
      text: 'The most circular of the planets’ orbits, e = 0.0068, 108.2 million km from the Sun; one orbit takes 224.70 days.',
      cite: ['nssdcVenus'],
    },
  ],
  estimated: [
    {
      title: 'Its inside',
      text: 'Probably an iron core about 3,500 km in radius, from how its spin axis precesses, with an uncertainty of hundreds of kilometres. No seismometer has ever worked there.',
      cite: ['margot2021'],
    },
    {
      title: 'Did it once have oceans?',
      text: 'Its little remaining water is a hundred times richer in deuterium than Earth’s, a sign it has lost a great deal of water to space. Whether that water was ever an ocean is disputed: one climate model keeps oceans liquid for up to two billion years, another finds the steam never condensed at all.',
      cite: ['donahue1982', 'way2016', 'turbet2021'],
    },
    {
      title: 'How old its surface is',
      text: 'A few hundred million years on average, from counting craters on Magellan’s maps: there are too few for an older surface, so most of it was paved over by lava since.',
      cite: ['strom1994'],
    },
  ],
  missing: [
    {
      title: 'Its ground',
      text: 'Not drawn. A radar map of it exists, but radar is not light: it shows roughness and slope, not what the surface looks like, and the clouds hide it anyway. The ground’s real colours are known only from the few Venera landers’ pictures of the rocks around them.',
      cite: ['saunders1992', 'nssdcVenera13'],
    },
    {
      title: 'The glow of its night side',
      text: 'Not drawn. The ground is hot enough to glow faintly at the red end of the spectrum, and Parker Solar Probe photographed that glow through the clouds in 2020 and 2021, with the cooler highlands darker.',
      cite: ['wood2022'],
    },
    {
      title: 'What colours its clouds',
      text: 'Not known. Something in the upper clouds absorbs ultraviolet and blue light — about half the sunlight Venus absorbs — and no one has identified it.',
      cite: ['titov2018'],
    },
    {
      title: 'Phosphine',
      text: 'In 2020 a team reported phosphine in the clouds, a gas that on Earth comes mostly from life; reanalyses of the same data found no sign of it. Unsettled.',
      cite: ['greaves2021', 'villanueva2021'],
    },
  ],
  misconceptions: [
    {
      title: 'Hotter than Mercury',
      text: 'Being closer to the Sun does not make Mercury hotter. Venus’s ground, at 464 °C, is hotter than anywhere on Mercury, because its air traps the heat; Mercury has no air to hold any.',
      cite: ['nssdcVenus', 'nssdcMercury'],
    },
    {
      title: 'Earth’s twin only in size',
      text: 'It is nearly Earth’s size and mass, and nothing else alike: 92 times the pressure, no water to speak of, acid clouds, no magnetic field, a day longer than its year.',
      cite: ['nssdcVenus', 'phillips1987'],
    },
    {
      title: 'Not, on average, the closest planet',
      text: 'Venus comes nearer to Earth than any other planet, but it also spends long stretches on the far side of the Sun. Averaged over time Mercury is closer — to Earth and to every other planet.',
      cite: ['stockman2019'],
    },
    {
      title: 'The orange photographs',
      text: 'The orange globes of Venus are radar maps, coloured after the Venera landers’ pictures. From space Venus is pale yellowish-white.',
      cite: ['saunders1992'],
    },
    {
      title: 'Not water clouds',
      text: 'They are sulfuric acid.',
      cite: ['hansen1974'],
    },
  ],
  sources: [
    {
      key: 'nssdcVenus',
      text: 'Williams, D. R. 2024, Venus Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html',
    },
    {
      key: 'nssdcMercury',
      text: 'Williams, D. R. 2024, Mercury Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html',
    },
    {
      key: 'nssdcVenera13',
      text: 'NASA Space Science Data Coordinated Archive, Venera 13 Descent Craft (1981-106D)',
      url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1981-106D',
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
      key: 'margot2021',
      text: 'Margot, J.-L., et al. 2021, Spin state and moment of inertia of Venus, Nature Astronomy 5, 676',
      url: 'https://doi.org/10.1038/s41550-021-01339-7',
    },
    {
      key: 'sanchezlavega2017',
      text: 'Sánchez-Lavega, A., et al. 2017, The Atmospheric Dynamics of Venus, Space Sci. Rev. 212, 1541',
      url: 'https://doi.org/10.1007/s11214-017-0389-x',
    },
    {
      key: 'titov2018',
      text: 'Titov, D. V., et al. 2018, Clouds and Hazes of Venus, Space Sci. Rev. 214, 126',
      url: 'https://doi.org/10.1007/s11214-018-0552-z',
    },
    {
      key: 'hansen1974',
      text: 'Hansen, J. E., & Hovenier, J. W. 1974, Interpretation of the Polarization of Venus, J. Atmos. Sci. 31, 1137',
      url: 'https://doi.org/10.1175/1520-0469(1974)031<1137:IOTPOV>2.0.CO;2',
    },
    {
      key: 'saunders1992',
      text: 'Saunders, R. S., et al. 1992, Magellan Mission Summary, J. Geophys. Res. 97, 13067',
      url: 'https://doi.org/10.1029/92JE01397',
    },
    {
      key: 'herrick2023',
      text: 'Herrick, R. R., & Hensley, S. 2023, Surface changes observed on a Venusian volcano during the Magellan mission, Science 379, 1205',
      url: 'https://doi.org/10.1126/science.abm7735',
    },
    {
      key: 'phillips1987',
      text: 'Phillips, J. L., & Russell, C. T. 1987, Upper limit on the intrinsic magnetic field of Venus, J. Geophys. Res. 92, 2253',
      url: 'https://doi.org/10.1029/JA092iA03p02253',
    },
    {
      key: 'donahue1982',
      text: 'Donahue, T. M., Hoffman, J. H., Hodges, R. R., & Watson, A. J. 1982, Venus Was Wet: A Measurement of the Ratio of Deuterium to Hydrogen, Science 216, 630',
      url: 'https://doi.org/10.1126/science.216.4546.630',
    },
    {
      key: 'way2016',
      text: 'Way, M. J., et al. 2016, Was Venus the first habitable world of our solar system?, Geophys. Res. Lett. 43, 8376',
      url: 'https://doi.org/10.1002/2016GL069790',
    },
    {
      key: 'turbet2021',
      text: 'Turbet, M., et al. 2021, Day–night cloud asymmetry prevents early oceans on Venus but not on Earth, Nature 598, 276',
      url: 'https://doi.org/10.1038/s41586-021-03873-w',
    },
    {
      key: 'strom1994',
      text: 'Strom, R. G., Schaber, G. G., & Dawson, D. D. 1994, The global resurfacing of Venus, J. Geophys. Res. 99, 10899',
      url: 'https://doi.org/10.1029/94JE00388',
    },
    {
      key: 'wood2022',
      text: 'Wood, B. E., et al. 2022, Parker Solar Probe Imaging of the Night Side of Venus, Geophys. Res. Lett. 49, e2021GL096302',
      url: 'https://doi.org/10.1029/2021GL096302',
    },
    {
      key: 'greaves2021',
      text: 'Greaves, J. S., et al. 2021, Phosphine gas in the cloud decks of Venus, Nature Astronomy 5, 655',
      url: 'https://doi.org/10.1038/s41550-020-1174-4',
    },
    {
      key: 'villanueva2021',
      text: 'Villanueva, G. L., et al. 2021, No evidence of phosphine in the atmosphere of Venus from independent analyses, Nature Astronomy 5, 631',
      url: 'https://doi.org/10.1038/s41550-021-01422-z',
    },
    {
      key: 'stockman2019',
      text: 'Stockman, T., Monroe, G., & Cordner, S. 2019, Venus is not Earth’s closest neighbor, Physics Today, 12 March 2019',
      url: 'https://doi.org/10.1063/PT.6.3.20190312a',
    },
  ],
};
