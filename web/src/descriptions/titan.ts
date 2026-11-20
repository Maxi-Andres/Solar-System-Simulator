import type { Description } from './types.ts';

/**
 * Titan. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a surface gravity, a map's mean brightness), the point says so. Where a
 * figure is a model's rather than a measurement, it sits under "estimated" and says which.
 */
export const TITAN: Description = {
  id: 'titan',
  lead: [
    'Titan is the only world besides Earth known to have rain, rivers, lakes and seas on its surface — but the rain is methane, the seas are liquid hydrocarbons, and the ground they lie on is ice at 180 degrees below zero, under an orange sky. It is Earth’s landscape built from different materials, and the most distant place where anything made by people has landed.',
    'Titan is Saturn’s largest moon, 5,150 kilometres across: wider than the planet Mercury, and second among moons only to Ganymede. It is the only moon with a thick atmosphere — mostly nitrogen, like Earth’s, with a few per cent of methane — and the pressure at its ground is one and a half times ours at sea level. High up, sunlight breaks the methane apart, and the fragments build a thick orange haze that hides the surface from any eye.',
    'Cassini, orbiting Saturn from 2004 to 2017, looked through the haze in the infrared and with radar, and found a landscape shaped like Earth’s: fields of dunes, river channels, and near the north pole seas of liquid methane and ethane — the largest, Kraken Mare, stretching 1,200 kilometres; Ligeia Mare is 160 metres deep where its radar reached the bottom. Methane evaporates, forms clouds and falls as rain, as water does here. Deeper down, Titan’s tides suggest an ocean of water beneath its icy crust.',
    'On 14 January 2005 the European probe Huygens, carried there by Cassini, descended by parachute for two and a half hours and landed on damp ground strewn with rounded pebbles of ice, sending back data for another 72 minutes. NASA’s Dragonfly, a rotorcraft, is to launch no earlier than July 2028 and reach Titan in late 2034, to fly from place to place across it.',
    'Titan goes round Saturn in 16 days, 1.22 million kilometres out, always with the same face toward the planet. Christiaan Huygens discovered it on 25 March 1655 — the first moon found after Jupiter’s four.',
  ],
  photos: [
    {
      file: 'photos/titan/cassini-saturn-2011.webp',
      largeFile: 'photos/titan/cassini-saturn-2011-large.webp',
      width: 640,
      height: 655,
      title: 'Titan in front of Saturn, 21 May 2011',
      caption:
        'Cassini’s red, green and blue images combined into natural colour, from 2.3 million km: Titan is a featureless orange ball, its surface hidden by haze; at its top, the north polar hood shows as a detached layer. Saturn’s rings are seen almost edge-on.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2011-05-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA14909',
    },
    {
      file: 'photos/titan/cassini-hazes-2011.webp',
      largeFile: 'photos/titan/cassini-hazes-2011-large.webp',
      width: 640,
      height: 455,
      title: 'Orange and blue haze, 11 September 2011',
      caption:
        'Toward the south pole from 134,000 km, in natural colour: the main haze is orange, and above it a thin, detached layer looks blue, probably because its particles are smaller.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2011-09-11',
      sourceUrl: 'https://images.nasa.gov/details/PIA14913',
    },
    {
      file: 'photos/titan/huygens-descent-mosaic-2005.webp',
      largeFile: 'photos/titan/huygens-descent-mosaic-2005-large.webp',
      width: 640,
      height: 639,
      title: 'The landing site from the descending Huygens, 14 January 2005',
      caption:
        'Huygens’ own images, taken between 7 and 0.5 km up, assembled into one view: a bright ridge cut by a dozen dark channels, like river valleys. The white points are the probe’s track, and the landing site is near the continuation of one of the channels. Black and white.',
      colour: 'true',
      credit: 'ESA/NASA/JPL/University of Arizona',
      licence: 'Released by NASA (Photojournal), ESA co-credited',
      date: '2005-01-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA06439',
    },
    {
      file: 'photos/titan/huygens-surface-2005.webp',
      largeFile: 'photos/titan/huygens-surface-2005-large.webp',
      width: 317,
      height: 630,
      title: 'On the surface of Titan, 14 January 2005',
      caption:
        'Huygens’ view after landing. The two stones just below the middle are about 15 and 4 cm across, 85 cm from the probe, rounded and eroded at their bases as if by flowing liquid. The camera saw in black and white; the colour was added from the probe’s own measurements of the light’s spectrum, to give a better idea of the real colour. Cropped from its white frame.',
      colour: 'tinted',
      credit: 'ESA/NASA/JPL/University of Arizona',
      licence: 'Released by NASA (Photojournal), ESA co-credited',
      date: '2005-01-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA07232',
    },
    {
      file: 'photos/titan/cassini-lakes-2017.webp',
      largeFile: 'photos/titan/cassini-lakes-2017-large.webp',
      width: 640,
      height: 478,
      title: 'The northern seas, 11 September 2017',
      caption:
        'From Cassini’s last encounter with Titan, four days before its end, through the near-infrared filter at 938 nm that sees through the haze: Punga Mare above the centre, Ligeia Mare below, Kraken Mare stretching off to the left, and many smaller lakes. The few bright specks are clouds. One infrared band, shown in grey.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2017-09-11',
      sourceUrl: 'https://images.nasa.gov/details/PIA22481',
    },
    {
      file: 'photos/titan/cassini-radar-ligeia-mare.webp',
      largeFile: 'photos/titan/cassini-radar-ligeia-mare-large.webp',
      width: 587,
      height: 560,
      title: 'Ligeia Mare by radar, 2006–2007',
      caption:
        'A mosaic of Cassini’s radar images, about 500 km across. Radar is not light: the liquid, which returns almost none of it, is black, and the solid ground, which returns more, is coloured yellow to white by a chosen scale.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/ASI/Cornell',
      licence: 'NASA media, not copyrighted',
      date: '2006–2007',
      sourceUrl: 'https://images.nasa.gov/details/PIA17031',
    },
    {
      file: 'photos/titan/vims-sunglint-2014.webp',
      largeFile: 'photos/titan/vims-sunglint-2014-large.webp',
      width: 640,
      height: 640,
      title: 'Sunlight glinting off a sea, 21 August 2014',
      caption:
        'Cassini’s infrared spectrometer saw the Sun reflected, mirror-like, off Kraken Mare — proof of a smooth liquid surface — together with the northern seas. Red is 5.0 microns, green 2.0 and blue 1.3: wavelengths that pass through the haze, none of them visible to an eye, which would see only haze.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/University of Arizona/University of Idaho',
      licence: 'NASA media, not copyrighted',
      date: '2014-08-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA18432',
    },
    {
      file: 'photos/titan/vims-globes.webp',
      largeFile: 'photos/titan/vims-globes-large.webp',
      width: 640,
      height: 433,
      title: 'Six faces of Titan’s surface, from 13 years of Cassini data',
      caption:
        'Cassini’s infrared spectrometer looked through the haze in the few windows where it thins. Each colour is a ratio of two infrared wavelengths, chosen to hide seams and bring out differences in what the ground is made of: no eye would see these colours, or the surface at all.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/University of Nantes/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2004–2017',
      sourceUrl: 'https://images.nasa.gov/details/PIA21923',
    },
  ],
  drawnHere: [
    {
      title: 'Its surface, not its haze',
      text: 'The one thing everyone would see — a smooth orange ball — is not drawn. The map is Cassini’s mosaic at 938 nm, a near-infrared wavelength where the haze thins enough for the camera to see the ground: the only way anyone has seen Titan’s surface from orbit. So here Titan is a grey, mottled moon with dark seas and the bright continent Xanadu, a view no eye could have.',
      cite: ['porco2005', 'pia14909'],
    },
    {
      title: 'No atmosphere',
      text: 'The app draws an atmosphere only for Earth, and Titan’s haze is not a cloud map that could be laid on a sphere. Its limb has no glow, the Sun is not dimmed or reddened by it, and the night side is black.',
    },
    {
      title: 'Which ephemeris',
      text: 'Its positions are JPL’s satellite ephemeris for Saturn’s moons, SAT441, the same one its mass comes from — not DE441, which carries only the Sun, the planets and our Moon.',
      cite: ['jplSats'],
    },
    {
      title: 'Only near today',
      text: 'JPL’s table is fetched for one year either side of the day the data were built, a sample every sixteen hours. Outside that year it is carried on from its orbital elements and marked approximate — still on its orbit, no longer exactly where it is.',
    },
    {
      title: 'Its shape, and its face to Saturn',
      text: 'An ellipsoid of 2,575.15 by 2,574.78 by 2,574.47 km, as the IAU gives it — round to within a kilometre — its long axis toward Saturn, turned by the IAU’s model so the same face stays on Saturn.',
      cite: ['archinal2018'],
    },
    {
      title: 'The map’s registration and grain',
      text: 'USGS’s global mosaic of Cassini’s 938 nm images, 4 km per pixel at the source, its longitude checked here against Xanadu and Belet; at 2,048 pixels round, each pixel here is about 7.9 km at the equator, worked out here.',
    },
    {
      title: 'Cassini',
      text: 'Cassini is drawn on JPL’s trajectory from the start of the app’s window to its end on 15 September 2017, so its last Titan flybys are on its path; but 2017 is outside Titan’s own one-year table, where Titan is carried on from its elements, so the app does not promise to show the two meeting where they did.',
      cite: ['pia22481'],
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 2,574.8 km, 5,150 km across — 6% wider than Mercury. Mass 1.35 × 10²³ kg: 1.8 Moons, but only 41% of Mercury’s. Mean density 1.88 g/cm³, about half rock and half ice. Gravity at the surface 1.35 m/s², worked out here from its GM and radius — a seventh of Earth’s.',
      cite: ['jplSats', 'nssdcSaturnian', 'nssdcMercury', 'nssdcMoon'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 1,221,870 km from Saturn’s centre, 20.3 Saturn radii; one orbit in 15.945 days; eccentricity 0.029, tilted 0.33° to Saturn’s equator. Turning once per orbit, it keeps one face toward Saturn.',
      cite: ['nssdcSaturnian'],
    },
    {
      title: 'Discovery',
      text: 'By Christiaan Huygens, on 25 March 1655.',
      cite: ['nasaTitanExploration'],
    },
    {
      title: 'At the ground',
      text: 'Huygens measured 93.65 K, about −180 °C, and a pressure of 1,467 hectopascals — 1.45 times Earth’s at sea level.',
      cite: ['fulchignoni2005'],
    },
    {
      title: 'What the air is made of',
      text: 'Nitrogen, with methane making up 1.41% of it in the stratosphere and rising to 4.92% near the surface. When Huygens’ warm inlet touched the ground, methane evaporated from it: the soil is damp with it.',
      cite: ['niemann2005'],
    },
    {
      title: 'The descent',
      text: 'Huygens took 2 hours 27 minutes to descend, came out of the haze only about 30 km above the ground, and Cassini, relaying, received 72 minutes of data from the surface.',
      cite: ['lebreton2005', 'pia07234'],
    },
    {
      title: 'The ground',
      text: 'Rounded pebbles, 4 to 15 cm across, of water ice, on darker, finer material, with signs of erosion at their bases; seen from above, a bright ridge cut by dark, branching channels.',
      cite: ['tomasko2005', 'pia07232'],
    },
    {
      title: 'Lakes and seas',
      text: 'Cassini’s radar found lakes near the north pole in July 2006. The three seas are Kraken Mare, stretching 1,200 km, Ligeia Mare, 500 km wide, and Punga Mare, 390 km across.',
      cite: ['stofan2007', 'pia22481'],
    },
    {
      title: 'How deep',
      text: 'On 23 May 2013 Cassini’s radar caught echoes from both the surface and the bottom of Ligeia Mare along its track: it is about 160 m deep at its deepest.',
      cite: ['mastrogiuseppe2014'],
    },
    {
      title: 'Liquid, seen',
      text: 'The Sun’s reflection, mirror-like, off Kraken Mare in August 2014 shows the seas are smooth liquid.',
      cite: ['pia18432'],
    },
    {
      title: 'Rain',
      text: 'After a large storm in September 2010, a broad region near the equator darkened and then brightened again over months: the ground had been soaked by methane rain and dried.',
      cite: ['turtle2011'],
    },
    {
      title: 'Its tides',
      text: 'Cassini’s flybys measured how Saturn’s pull deforms Titan around its eccentric orbit: far more than a rigid ice-and-rock body would allow.',
      cite: ['iess2012'],
    },
    {
      title: 'Brightness',
      text: 'Seen through its haze, it reflects 22% of the light that falls on it straight back (geometric albedo 0.22).',
      cite: ['nssdcSaturnian'],
    },
  ],
  estimated: [
    {
      title: 'An ocean of water inside',
      text: 'The large tidal flexing is best explained by a global ocean of liquid water, probably salty, beneath an ice shell; its depth is a model’s.',
      cite: ['iess2012'],
    },
    {
      title: 'What the seas hold',
      text: 'From how little of the radar Ligeia Mare absorbed on its way to the bottom and back, its liquid is a nearly pure mix of methane and ethane, with little else dissolved or suspended in it.',
      cite: ['mastrogiuseppe2014'],
    },
  ],
  missing: [
    {
      title: 'Its haze and its colour',
      text: 'Not drawn: Titan as an eye would see it is a featureless orange globe with a thin blue outer layer, as in the photographs above. Here it is its infrared surface, in grey.',
      cite: ['pia14909', 'porco2005'],
    },
    {
      title: 'Clouds and rain',
      text: 'Not drawn: methane clouds come and go, and storms soak the ground; the map is fixed.',
      cite: ['turtle2011'],
    },
    {
      title: 'Saturn’s shadow',
      text: 'Not drawn: Saturn casts its shadow only on its rings here, so Titan stays lit when it passes behind Saturn near the equinoxes.',
    },
    {
      title: 'Huygens and Dragonfly',
      text: 'Neither is drawn: Huygens landed in 2005, before the app’s window, and Dragonfly has not launched.',
      cite: ['lebreton2005', 'nasaDragonfly'],
    },
    {
      title: 'Relief',
      text: 'Not drawn: its dunes, hills and river valleys are a picture on a smooth ellipsoid.',
      cite: ['pia06439'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not the largest moon',
      text: 'Its haze makes it look bigger than it is; its solid body is 2,574.8 km in radius, Ganymede’s 2,631.2.',
      cite: ['jplSats'],
    },
    {
      title: 'Its seas are not water',
      text: 'They are liquid hydrocarbons — methane and ethane — at about −180 °C. Water there is rock-hard ice: the pebbles Huygens landed among are made of it.',
      cite: ['mastrogiuseppe2014', 'fulchignoni2005', 'tomasko2005'],
    },
    {
      title: 'A thick atmosphere does not make it hot',
      text: 'Unlike Venus’s, Titan’s dense air lies on ground at 93.65 K, about −180 °C.',
      cite: ['fulchignoni2005'],
    },
    {
      title: 'The orange is the air, not the ground',
      text: 'The colour seen from space is the haze. Through the haze, in the infrared, the surface is a landscape of dark dunes, bright highlands and dark seas.',
      cite: ['porco2005', 'pia14909'],
    },
  ],
  sources: [
    {
      key: 'nssdcSaturnian',
      text: 'Williams, D. R., Saturnian Satellite Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html',
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
      text: 'JPL Solar System Dynamics, Planetary Satellite Physical Parameters (GM from SAT441 and JUP365; mean radius from the IAU 2015 report)',
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
      key: 'nasaTitanExploration',
      text: 'NASA Science, Titan: Exploration',
      url: 'https://science.nasa.gov/saturn/moons/titan/exploration/',
    },
    {
      key: 'fulchignoni2005',
      text: 'Fulchignoni, M., et al. 2005, In situ measurements of the physical characteristics of Titan’s environment, Nature 438, 785',
      url: 'https://doi.org/10.1038/nature04314',
    },
    {
      key: 'niemann2005',
      text: 'Niemann, H. B., et al. 2005, The abundances of constituents of Titan’s atmosphere from the GCMS instrument on the Huygens probe, Nature 438, 779',
      url: 'https://doi.org/10.1038/nature04122',
    },
    {
      key: 'lebreton2005',
      text: 'Lebreton, J.-P., et al. 2005, An overview of the descent and landing of the Huygens probe on Titan, Nature 438, 758',
      url: 'https://doi.org/10.1038/nature04347',
    },
    {
      key: 'tomasko2005',
      text: 'Tomasko, M. G., et al. 2005, Rain, winds and haze during the Huygens probe’s descent to Titan’s surface, Nature 438, 765',
      url: 'https://doi.org/10.1038/nature04126',
    },
    {
      key: 'stofan2007',
      text: 'Stofan, E. R., et al. 2007, The lakes of Titan, Nature 445, 61',
      url: 'https://doi.org/10.1038/nature05438',
    },
    {
      key: 'mastrogiuseppe2014',
      text: 'Mastrogiuseppe, M., et al. 2014, The bathymetry of a Titan sea, Geophys. Res. Lett. 41, 1432',
      url: 'https://doi.org/10.1002/2013GL058618',
    },
    {
      key: 'turtle2011',
      text: 'Turtle, E. P., et al. 2011, Rapid and Extensive Surface Changes Near Titan’s Equator: Evidence of April Showers, Science 331, 1414',
      url: 'https://doi.org/10.1126/science.1201063',
    },
    {
      key: 'iess2012',
      text: 'Iess, L., et al. 2012, The Tides of Titan, Science 337, 457',
      url: 'https://doi.org/10.1126/science.1219631',
    },
    {
      key: 'porco2005',
      text: 'Porco, C. C., et al. 2005, Imaging of Titan from the Cassini spacecraft, Nature 434, 159',
      url: 'https://doi.org/10.1038/nature03436',
    },
    {
      key: 'nasaDragonfly',
      text: 'NASA Science, Dragonfly (mission page)',
      url: 'https://science.nasa.gov/mission/dragonfly/',
    },
    {
      key: 'pia14909',
      text: 'NASA/JPL Photojournal PIA14909, Titan Up Front (Cassini, 21 May 2011)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA14909',
    },
    {
      key: 'pia06439',
      text: 'NASA/JPL Photojournal PIA06439, Titan’s Surface #2 (Huygens DISR descent mosaic)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA06439',
    },
    {
      key: 'pia07232',
      text: 'NASA/JPL Photojournal PIA07232, First Color View of Titan’s Surface (Huygens, 14 January 2005)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA07232',
    },
    {
      key: 'pia07234',
      text: 'NASA/JPL Photojournal PIA07234, Descent Through Clouds to Surface (Huygens DISR)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA07234',
    },
    {
      key: 'pia22481',
      text: 'NASA/JPL Photojournal PIA22481, Titan Lakes (Cassini, 11 September 2017)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA22481',
    },
    {
      key: 'pia18432',
      text: 'NASA/JPL Photojournal PIA18432, Specular Spectacular (Cassini VIMS, 21 August 2014)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA18432',
    },
  ],
};
