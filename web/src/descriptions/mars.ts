import type { Description } from './types.ts';

/**
 * Mars. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a light time), the point says so. Where a figure is a model's rather than a
 * measurement, it sits under "estimated" and says which.
 */
export const MARS: Description = {
  id: 'mars',
  lead: [
    'Mars is the fourth planet from the Sun: a rocky world like Earth, about half its width — 6,792 kilometres across — and a tenth of its mass. Its gravity is 38% of ours. It is a cold desert, about −60 °C on average, under an air of carbon dioxide so thin that its pressure at the ground is less than one hundredth of Earth’s.',
    'Its surface is a record of a more active past. Olympus Mons, the largest volcano known, is about 600 kilometres wide and rises nearly 22 kilometres above the plains around it. A canyon system, Valles Marineris, cuts across its equator. Its polar caps hold water ice, and its rovers have driven over the beds of lakes and river deltas that dried up more than three billion years ago. The red is dust: fine grains coloured by iron oxide — rust — that cover almost everything.',
    'It is the planet most like ours, and the most visited. Its day is 24 hours and 40 minutes long, and its axis is tilted 25°, close to Earth’s 23.4°, so it has seasons as we do, each about twice as long. In winter part of its air freezes onto the pole as carbon-dioxide frost, and the pressure at the ground rises and falls with the seasons. Dust storms come with them, and now and then one grows to wrap the whole planet. Orbiters have mapped it since the 1970s, and NASA’s rovers Curiosity and Perseverance have been driving there since 2012 and 2021. It has two small moons, Phobos and Deimos.',
    'Earth and Mars come closest every 26 months, when Earth overtakes it on the inside. Then Mars can be as near as 55 million kilometres and outshines every star in the night sky; on the far side of the Sun it is 400 million kilometres away, and a radio message takes over twenty minutes to arrive.',
    'It orbits the Sun at an average 228 million kilometres, 1.52 times as far as Earth, so its sunlight is a little under half as strong as ours. Its orbit is far from round: its distance from the Sun swings between 207 and 249 million kilometres. It goes round once in 687 days, at an average 24 kilometres per second.',
  ],
  photos: [
    {
      file: 'photos/mars/sunset-gale-2015.webp',
      largeFile: 'photos/mars/sunset-gale-2015-large.webp',
      width: 640,
      height: 514,
      title: 'Sunset in Gale crater, 15 April 2015',
      caption:
        'Curiosity’s first sunset in colour. Mars’s fine dust scatters blue light forward, close to the direction of the Sun, so the sky around a setting Sun is blue — the reverse of Earth’s. Calibrated and white-balanced; NASA notes the camera sees colour much as an eye does, a little less sensitive to blue.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS/Texas A&M Univ.',
      licence: 'NASA media, not copyrighted',
      date: '2015-04-15',
      sourceUrl: 'https://images.nasa.gov/details/PIA19400',
    },
    {
      file: 'photos/mars/perseverance-ingenuity-2021.webp',
      largeFile: 'photos/mars/perseverance-ingenuity-2021-large.webp',
      width: 640,
      height: 471,
      title: 'Perseverance and Ingenuity in Jezero crater, 6 April 2021',
      caption:
        'A selfie stitched from 62 frames by the camera on Perseverance’s arm, with the Ingenuity helicopter about 4 metres away, days before the first powered flight on another planet. The colours are the camera’s own.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2021-04-06',
      sourceUrl: 'https://images.nasa.gov/details/PIA24542',
    },
    {
      file: 'photos/mars/curiosity-mont-mercou-2021.webp',
      largeFile: 'photos/mars/curiosity-mont-mercou-2021-large.webp',
      width: 640,
      height: 423,
      title: 'Curiosity at Mont Mercou, March 2021',
      caption:
        'Curiosity on the slopes of Mount Sharp in front of Mont Mercou, a layered outcrop 6 metres tall: 60 frames from the camera on its arm and 11 from its mast camera. The hole to its left is where it drilled the rock “Nontron”. The colours are the cameras’ own.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2021-03-26',
      sourceUrl: 'https://images.nasa.gov/details/PIA24543',
    },
    {
      file: 'photos/mars/earth-from-mars-2014.webp',
      largeFile: 'photos/mars/earth-from-mars-2014-large.webp',
      width: 640,
      height: 400,
      title: 'Earth, the evening star of Mars, 31 January 2014',
      caption:
        'Eighty minutes after sunset over Gale crater, the brightest point in the sky, a little left of centre, is Earth, 160 million kilometres away; the Moon is the fainter dot just below it — clearest in the larger view. Taken by Curiosity’s mast camera; only cosmic-ray hits were removed.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS/TAMU',
      licence: 'NASA media, not copyrighted',
      date: '2014-01-31',
      sourceUrl: 'https://images.nasa.gov/details/PIA17936',
    },
    {
      file: 'photos/mars/dust-storm-2018.webp',
      largeFile: 'photos/mars/dust-storm-2018-large.webp',
      width: 640,
      height: 361,
      title: 'Before and during the 2018 global dust storm',
      caption:
        'The same face of Mars from the Mars Reconnaissance Orbiter’s colour camera in May and in July 2018. In May: Valles Marineris at left, a regional storm at top, the spring polar cap at bottom. By July the whole planet is under dust. The storm cut off the Opportunity rover, which never woke again. NASA does not say how the colour was balanced.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2018-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA22487',
    },
    {
      file: 'photos/mars/hubble-2016.webp',
      largeFile: 'photos/mars/hubble-2016-large.webp',
      width: 640,
      height: 640,
      title: 'Mars from Hubble, 12 May 2016',
      caption:
        'Ten days before opposition, 80 million kilometres away: the frosty north polar cap at top, clouds, the dark volcanic plain Syrtis Major at the right edge with the bright Hellas basin below it, and the orange uplands of Arabia Terra in the middle. Built from four filters, one of them ultraviolet, each given a colour: near natural, but not calibrated to what an eye would see.',
      colour: 'false',
      credit:
        'NASA, ESA, the Hubble Heritage Team (STScI/AURA), J. Bell (ASU) and M. Wolff (Space Science Institute)',
      licence: 'NASA media, not copyrighted',
      date: '2016-05-12',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000332',
    },
    {
      file: 'photos/mars/viking-valles-marineris.webp',
      largeFile: 'photos/mars/viking-valles-marineris-large.webp',
      width: 640,
      height: 604,
      title: 'Valles Marineris, from 102 Viking Orbiter images',
      caption:
        'Nearly a hemisphere of Mars, with the canyon system across the middle and three of the Tharsis volcanoes at the left edge. Assembled by the USGS from images Viking Orbiter 1 took in 1980; its colour differences are enhanced about twofold, so Mars is drawn more varied than it looks.',
      colour: 'false',
      credit: 'NASA/JPL/USGS',
      licence: 'NASA media, not copyrighted',
      date: '1980',
      sourceUrl: 'https://images.nasa.gov/details/PIA00003',
    },
    {
      file: 'photos/mars/viking-olympus-mons.webp',
      largeFile: 'photos/mars/viking-olympus-mons-large.webp',
      width: 640,
      height: 592,
      title: 'Olympus Mons from Viking 1, 22 June 1978',
      caption:
        'The largest volcano known, from straight above: about 600 kilometres across, ringed by cliffs several kilometres high, with the nested craters of its summit caldera in the middle. A colour mosaic from Viking 1’s orbiter, whose filters were not an eye’s, so its colour is approximate.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1978-06-22',
      sourceUrl: 'https://images.nasa.gov/details/PIA02982',
    },
  ],
  drawnHere: [
    {
      title: 'An illustrative map',
      text: 'The map drawn is Solar System Scope’s, built on NASA imagery with colour and contrast added by its authors: more orange than Mars is. A truer map — NASA’s, from Viking, the butterscotch-brown Mars actually is — is in the app’s files but not shown, because the illustrative set is used for every planet so they read alike. It is static: no dust storm, no cloud and no change of the polar caps with the seasons.',
    },
    {
      title: 'No air',
      text: 'Mars is drawn as bare ground: its thin, dusty atmosphere — the haze at its edge in the photographs — is not modelled. Earth is the only planet here with a sky.',
    },
    {
      title: 'A smooth ellipsoid',
      text: 'Nothing models terrain. Olympus Mons is not raised, nor Valles Marineris cut: the planet is its reference ellipsoid, and a craft at the bottom of Gale crater, as Curiosity is, stands about 4.5 kilometres above where it really is.',
    },
    {
      title: 'Its rovers and lander, where they are',
      text: 'Curiosity, Perseverance and InSight are craft on the ground, each where NASA’s mission maps put the end of its latest drive, facing the heading they report, turning with Mars. The rovers move on at the end of each sol a drive is logged; the line behind them joins the ends of their drives, not the paths they drove between. InSight, which never moved, is drawn facing north, since its heading is not published.',
      cite: ['nasaMmgis'],
    },
    {
      title: 'Landing sites',
      text: 'Seven more: Viking 1 and 2, Mars Pathfinder, Spirit and Opportunity where they stopped, Phoenix, and China’s Tianwen-1 lander, each named when Mars is large on the screen. Viking 1 and Pathfinder are the hardware itself, found in the Mars Reconnaissance Orbiter’s images and tied to the laser-altimeter frame to 100–300 metres; Spirit’s and Opportunity’s last stops are their landing points found the same way plus their drives in NASA’s traverse files, summed here. Phoenix’s is its mission notebook’s; Tianwen-1’s is from orbit, descent and rover images; Viking 2’s is from NASA’s catalogue, which does not say how it was measured.',
      cite: ['konopliv2026', 'wan2021'],
    },
    {
      title: 'Its orbiters',
      text: 'The Mars Reconnaissance Orbiter, MAVEN, Mars Odyssey, Mars Express, ExoMars TGO and Hope, each on JPL’s own reconstructed trajectory. They go round in anything from under two hours to more than two days, and following every turn costs data, so they are followed only for three months either side of when the app’s data was built, and are absent outside it.',
      cite: ['de440'],
    },
    {
      title: 'Lighting',
      text: 'In Natural lighting, the default, the night side is black, as it is. Shadow lighting lifts Mars’s night side to 25 of 255 so it can be read; Flood lights it all evenly. Neither is what an eye would see.',
    },
  ],
  measured: [
    {
      title: 'Size and shape',
      text: 'Radius 3,396.2 km at the equator and 3,376.2 km at the poles, 20 km less, as the IAU gives them. Mean radius 3,389.5 km: 53% of Earth’s.',
      cite: ['nssdcMars', 'archinal2018'],
    },
    {
      title: 'Mass and gravity',
      text: 'GM = 42,828 km³/s², from the orbits of its moons and spacecraft; 6.417 × 10²³ kg, 10.7% of Earth’s mass. Surface gravity 3.73 m/s², 38% of Earth’s.',
      cite: ['nssdcMars', 'de440'],
    },
    {
      title: 'Day, year and tilt',
      text: 'It turns once in 24.623 hours; a solar day, a sol, is 24.660 hours. Its axis is tilted 25.19° to its orbit, and its year is 686.98 Earth days. It comes back to the same place relative to Earth every 779.9 days.',
      cite: ['nssdcMars'],
    },
    {
      title: 'Its air',
      text: '95.1% carbon dioxide, 2.6% nitrogen, 1.9% argon. Pressure 6.36 millibars at the mean radius — 0.6% of Earth’s 1,014 — changing from 4.0 to 8.7 with the seasons as carbon dioxide freezes onto one pole and then the other. Its density at the ground, about 0.016 kg/m³, is a seventy-sixth of Earth’s.',
      cite: ['nssdcMars', 'nssdcEarth'],
    },
    {
      title: 'Temperature',
      text: 'About 214 K, −59 °C, on average. At the Viking 1 lander a day ran from −89 °C to −31 °C.',
      cite: ['nssdcMars'],
    },
    {
      title: 'Olympus Mons',
      text: 'Mapped by the Mars Global Surveyor’s laser altimeter: about 600 km across and nearly 22 km above the plains about it, the highest relief of any volcano on Mars.',
      cite: ['plescia2004'],
    },
    {
      title: 'Water',
      text: 'Ice, not liquid. Radar sounding through the south polar cap’s layered deposits finds enough water ice in them alone to cover the whole planet 11 metres deep if melted.',
      cite: ['plaut2007'],
    },
    {
      title: 'Lakes and rivers, once',
      text: 'Curiosity found the mudstones of an ancient lake on the floor of Gale crater, water once fit for microbes to live in; Perseverance landed beside a river delta built into a lake in Jezero crater, both more than three billion years ago.',
      cite: ['grotzinger2014', 'mangold2021'],
    },
    {
      title: 'Why it is red',
      text: 'Its dust and the surface beneath are coloured by ferric iron oxides, which spectrometers in orbit map across the whole planet; the oxides formed in its later, dry eras, as water was lost.',
      cite: ['bibring2006'],
    },
    {
      title: 'Dust storms',
      text: 'In 2018 a storm grew in weeks to enclose the planet, raising the dust over Gale crater to an optical depth of 8.5 and cutting what Curiosity could see across the crater floor to 2.7 km.',
      cite: ['guzewich2019'],
    },
    {
      title: 'Its orbit',
      text: 'Semi-major axis 227.96 million km, eccentricity 0.0935: perihelion 206.65 and aphelion 249.26 million km. Mean speed 24.08 km/s. Its distance from Earth ranges from 54.6 to 401.4 million km; light takes 3 to 22 minutes to cross that, worked out here at the speed of light.',
      cite: ['nssdcMars'],
    },
  ],
  estimated: [
    {
      title: 'Its core',
      text: 'InSight’s seismometer heard waves reflected off a liquid iron core. The first reading put its radius at 1,830 ± 40 km; later models, adding a layer of molten rock above it that the first had not, make the core itself smaller: 1,650 ± 20 km in one, 1,675 ± 30 km in another. Its size is inferred from the waves’ timing through a model of the interior, and is still argued over.',
      cite: ['stahler2021', 'samuel2023', 'khan2023'],
    },
    {
      title: 'Phobos’s end',
      text: 'Phobos orbits faster than Mars turns, so the tide drags it inward. Models put it 20 to 40 million years from being torn apart into a ring.',
      cite: ['black2015'],
    },
  ],
  missing: [
    {
      title: 'Its weather and seasons',
      text: 'Dust storms, clouds and the polar caps growing and shrinking are not drawn: the map is one fixed picture. Showing the day’s Mars would mean fetching an orbiter’s daily global images, which the app does not do.',
    },
    {
      title: 'Its relief',
      text: 'No volcano, canyon or crater rises or sinks: Olympus Mons, nearly 22 kilometres above its plains, is drawn as flat as they are.',
      cite: ['plescia2004'],
    },
    {
      title: 'The rovers’ paths between drives',
      text: 'Only where each drive ended is published with its sol; the routes between are not in the data, so they are joined by straight lines.',
      cite: ['nasaMmgis'],
    },
    {
      title: 'Zhurong, Sojourner and the crashed landers',
      text: 'Zhurong drove south from the Tianwen-1 lander, and where it stopped in 2022 is not published as coordinates, so it is not marked. Sojourner is within metres of Pathfinder’s mark. Landers that crashed — Mars 2, Mars Polar Lander, Beagle 2, Schiaparelli — are not marked.',
      cite: ['wan2021'],
    },
    {
      title: 'Deimos’s surface',
      text: 'Deimos is drawn in flat colour: its only global map cannot be placed, since its two sources disagree about where longitude zero is.',
    },
  ],
  misconceptions: [
    {
      title: 'Red does not mean hot',
      text: 'Mars is red because its dust holds iron oxide — rust — not because it is warm. It averages −59 °C.',
      cite: ['bibring2006', 'nssdcMars'],
    },
    {
      title: 'Its sky is not blue, but its sunsets are',
      text: 'By day the fine dust in the air scatters yellow and red light widely across the sky, so it is not blue. Blue light gets through the same dust more easily and stays close to the Sun, so sunsets on Mars are blue.',
      cite: ['pia19400'],
    },
    {
      title: 'Not a dry planet',
      text: 'It has no liquid water on its surface now, but it has a great deal of ice: the south polar deposits alone would cover it 11 metres deep.',
      cite: ['plaut2007'],
    },
    {
      title: 'A dust storm cannot knock you over',
      text: 'The air is so thin that even the 30 m/s winds the Viking landers measured in a storm push about as hard as a 3.4 m/s breeze on Earth, worked out here from the two airs’ densities. The storm in the film The Martian could not happen; the real danger of a storm is dust blocking the sunlight for solar panels, as it did Opportunity’s.',
      cite: ['nssdcMars', 'nssdcEarth'],
    },
    {
      title: 'It is never as big as the Moon',
      text: 'At its very closest, 54.6 million km, Mars is about 25 arcseconds across — seventy times smaller than the full Moon, worked out here from its radius and distance. To the naked eye it is always a point, if a bright one.',
      cite: ['nssdcMars'],
    },
  ],
  sources: [
    {
      key: 'nssdcMars',
      text: 'Williams, D. R., Mars Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    },
    {
      key: 'nssdcEarth',
      text: 'Williams, D. R., Earth Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
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
      key: 'plescia2004',
      text: 'Plescia, J. B. 2004, Morphometric properties of Martian volcanoes, J. Geophys. Res. 109, E03003',
      url: 'https://doi.org/10.1029/2002JE002031',
    },
    {
      key: 'plaut2007',
      text: 'Plaut, J. J., et al. 2007, Subsurface Radar Sounding of the South Polar Layered Deposits of Mars, Science 316, 92',
      url: 'https://doi.org/10.1126/science.1139672',
    },
    {
      key: 'grotzinger2014',
      text: 'Grotzinger, J. P., et al. 2014, A Habitable Fluvio-Lacustrine Environment at Yellowknife Bay, Gale Crater, Mars, Science 343, 1242777',
      url: 'https://doi.org/10.1126/science.1242777',
    },
    {
      key: 'mangold2021',
      text: 'Mangold, N., et al. 2021, Perseverance rover reveals an ancient delta-lake system and flood deposits at Jezero crater, Mars, Science 374, 711',
      url: 'https://doi.org/10.1126/science.abl4051',
    },
    {
      key: 'bibring2006',
      text: 'Bibring, J.-P., et al. 2006, Global Mineralogical and Aqueous Mars History Derived from OMEGA/Mars Express Data, Science 312, 400',
      url: 'https://doi.org/10.1126/science.1122659',
    },
    {
      key: 'pia19400',
      text: 'NASA/JPL-Caltech/MSSS/Texas A&M Univ. 2015, Sunset in Mars’ Gale Crater (PIA19400), Curiosity Mastcam',
      url: 'https://images.nasa.gov/details/PIA19400',
    },
    {
      key: 'guzewich2019',
      text: 'Guzewich, S. D., et al. 2019, Mars Science Laboratory Observations of the 2018/Mars Year 34 Global Dust Storm, Geophys. Res. Lett. 46, 71',
      url: 'https://doi.org/10.1029/2018GL080839',
    },
    {
      key: 'stahler2021',
      text: 'Stähler, S. C., et al. 2021, Seismic detection of the martian core, Science 373, 443',
      url: 'https://doi.org/10.1126/science.abi7730',
    },
    {
      key: 'samuel2023',
      text: 'Samuel, H., et al. 2023, Geophysical evidence for an enriched molten silicate layer above Mars’s core, Nature 622, 712',
      url: 'https://doi.org/10.1038/s41586-023-06601-8',
    },
    {
      key: 'khan2023',
      text: 'Khan, A., et al. 2023, Evidence for a liquid silicate layer atop the Martian core, Nature 622, 718',
      url: 'https://doi.org/10.1038/s41586-023-06586-4',
    },
    {
      key: 'black2015',
      text: 'Black, B. A., & Mittal, T. 2015, The demise of Phobos and development of a Martian ring system, Nat. Geosci. 8, 913',
      url: 'https://doi.org/10.1038/ngeo2583',
    },
    {
      key: 'konopliv2026',
      text: 'Konopliv, A. S., Park, R. S., Le Maistre, S., Yseboodt, M., & Baland, R.-M. 2026, Updated Mars Orientation and Gravity Field and Indication of Decadal Changes in Rotation Rate, Planet. Sci. J. 7, 212',
      url: 'https://doi.org/10.3847/PSJ/ae9ba7',
    },
    {
      key: 'wan2021',
      text: 'Wan, W., Yu, T., Di, K., et al. 2021, Visual Localization of the Tianwen-1 Lander Using Orbital, Descent and Rover Images, Remote Sens. 13, 3439',
      url: 'https://doi.org/10.3390/rs13173439',
    },
    {
      key: 'nasaMmgis',
      text: 'NASA/JPL, Curiosity and Perseverance traverse maps (MMGIS): each drive’s sol, end point and heading',
      url: 'https://science.nasa.gov/mission/msl-curiosity/location-map/',
    },
  ],
};
