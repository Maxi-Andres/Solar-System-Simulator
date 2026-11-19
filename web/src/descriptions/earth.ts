import type { Description } from './types.ts';

/**
 * Earth. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model. What the app draws of
 * it is read off scene/atmosphere.ts, scene/earthExtras.ts, core/magnetosphere.ts and
 * core/aurora.ts.
 */
export const EARTH: Description = {
  id: 'earth',
  lead: [
    'Earth is home. Every person who has ever lived, every forest and reef, every language and every story has happened here, on a ball of rock a little under 13,000 kilometres wide. It is the only place in the universe where life is known to exist. Astronomers have now found more than six thousand planets around other stars and searched Mars for half a century, and nowhere else has anything living turned up yet — which may say more about how little of the universe we can search than about how rare life is. For now, this is the one world we know where matter woke up, looked around, and began to ask what it is.',
    'It is the third planet from the Sun and the largest of the four rocky planets, 12,742 kilometres across, and the densest planet of all. From space it is mostly blue and white: oceans cover 71% of its surface, and at any moment clouds cover about two-thirds of it.',
    'What sets it apart is water that stays liquid on the surface, at temperatures and pressures that let it. Its air is mostly nitrogen and oxygen — the oxygen made by living things over billions of years — and it scatters the blue of sunlight more than the red, which is why the sky is blue and the planet’s edge glows from space. Deep inside, molten iron in the outer core stirs up a magnetic field, and the crust is broken into plates that drift a few centimetres a year, building mountains and opening oceans.',
    'It orbits 150 million kilometres from the Sun; sunlight takes 8 minutes 19 seconds to arrive. Its axis is tilted 23.4°, and that tilt — not its distance from the Sun — makes the seasons: Earth is in fact nearest the Sun in early January, in the middle of the northern winter. The Moon, its one large natural satellite, raises the tides and helps keep that tilt steady.',
    'Its magnetic field holds off the solar wind about 65,000 kilometres out on the Sun’s side, carving a bubble around the planet, the magnetosphere. Particles from the Sun that get in are led down toward the poles, where they light the auroras; others are trapped in the Van Allen radiation belts. Inside that bubble now fly tens of thousands of satellites and pieces of debris.',
    'It turns once every 23 hours 56 minutes against the stars, so a point on the equator moves at about 1,670 km/h, and it goes round the Sun at nearly 30 kilometres per second, once a year, while the Sun carries it around the galaxy. It formed 4.54 billion years ago, with the rest of the Solar System.',
  ],
  photos: [
    {
      file: 'photos/earth/blue-marble-1972.webp',
      largeFile: 'photos/earth/blue-marble-1972-large.webp',
      width: 640,
      height: 640,
      title: 'The Blue Marble, 7 December 1972',
      caption:
        'Taken by the Apollo 17 crew on the way to the Moon, with the Sun behind them, so the whole disc is lit: Africa and Arabia, Madagascar, and the Antarctic ice cap under the swirls of the southern storms.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1972-12-07',
      sourceUrl: 'https://images.nasa.gov/details/as17-148-22727',
    },
    {
      file: 'photos/earth/earthrise-1968.webp',
      largeFile: 'photos/earth/earthrise-1968-large.webp',
      width: 640,
      height: 640,
      title: 'Earthrise, 24 December 1968',
      caption:
        'Apollo 8, the first crew to orbit the Moon, saw Earth come up over its horizon. The lunar ground in front is about 570 km away; on Earth, 384,000 km beyond, the line between day and night crosses Africa.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1968-12-24',
      sourceUrl: 'https://images.nasa.gov/details/as08-14-2383',
    },
    {
      file: 'photos/earth/epic-2015.webp',
      largeFile: 'photos/earth/epic-2015-large.webp',
      width: 640,
      height: 640,
      title: 'The whole sunlit Earth, 6 July 2015',
      caption:
        'The first image from NASA’s EPIC camera on DSCOVR, 1.5 million km away toward the Sun: North and Central America, the turquoise shallows of the Caribbean. Its red, green and blue channels, combined. The blue haze over everything is real: it is sunlight scattered by the air, the same physics this app draws.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2015-07-06',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000678',
    },
    {
      file: 'photos/earth/artemis-ii-night-2026.webp',
      largeFile: 'photos/earth/artemis-ii-night-2026-large.webp',
      width: 640,
      height: 427,
      title: 'Earth’s night side by moonlight, from Orion, 2 April 2026',
      caption:
        'An Artemis II astronaut photographed the night side after the burn that sent them to the Moon. It looks sunlit but is lit by the Moon. Green auroras glow at the top and bottom edges, city lights line the coasts, a thin sunlit rim shows at lower right, and beyond it a cone of zodiacal light rises to the bright point of Venus.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2026-04-02',
      sourceUrl: 'https://images.nasa.gov/details/art002e000192',
    },
    {
      file: 'photos/earth/earthset-2026.webp',
      largeFile: 'photos/earth/earthset-2026-large.webp',
      width: 640,
      height: 427,
      title: 'Earthset, from behind the Moon, 6 April 2026',
      caption:
        'Fifty-seven years after Earthrise, the Artemis II crew watched Earth sink behind the Moon’s far side during their seven-hour lunar flyby.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2026-04-06',
      sourceUrl: 'https://images.nasa.gov/details/art002e021278',
    },
    {
      file: 'photos/earth/iss-aurora-2025.webp',
      largeFile: 'photos/earth/iss-aurora-2025-large.webp',
      width: 640,
      height: 427,
      title: 'The southern aurora from the Space Station, 12 June 2025',
      caption:
        'The aurora australis arcs over the Indian Ocean between Australia and Antarctica, photographed from about 430 km up. Its green is oxygen’s light, from mostly 100 to 250 km above the ground.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2025-06-12',
      sourceUrl: 'https://images.nasa.gov/details/iss073e0247726',
    },
    {
      file: 'photos/earth/pale-blue-dot.webp',
      largeFile: 'photos/earth/pale-blue-dot-large.webp',
      width: 640,
      height: 800,
      title: 'The Pale Blue Dot, 14 February 1990',
      caption:
        'Earth from Voyager 1, about 6 billion km away: the speck inside the band of scattered sunlight, smaller than one pixel. Taken 34 minutes before Voyager’s cameras were switched off for good. Green, blue and violet filters shown as red, green and blue, so strictly false colour; reprocessed in 2020 and cropped here around Earth. Carl Sagan, who asked for it to be taken, wrote of that speck: “That’s here. That’s home. That’s us.”',
      colour: 'false',
      credit: 'NASA/JPL-Caltech; processed by Kevin M. Gill',
      licence: 'NASA media, not copyrighted',
      date: '1990-02-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA23645',
    },
    {
      file: 'photos/earth/black-marble-2012.webp',
      largeFile: 'photos/earth/black-marble-2012-large.webp',
      width: 640,
      height: 360,
      title: 'City lights, 2012',
      caption:
        'Cloud-free night lights from the Suomi NPP satellite, gathered over 312 orbits in April and October 2012 and laid over a daytime image of the ground. The same survey gives this app its city lights. Its sensor sees one broad band, so the lights’ colour is added.',
      colour: 'false',
      credit: 'NASA Earth Observatory/NOAA NGDC',
      licence: 'NASA media, not copyrighted',
      date: '2012',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001593',
    },
  ],
  drawnHere: [
    {
      title: 'Its map',
      text: 'An illustrative composite of NASA imagery, without clouds, drawn 30% less saturated than the file, a judgement made by eye against NASA’s own render. NASA’s Blue Marble Next Generation, calibrated true colour, is in the app too but not drawn.',
    },
    {
      title: 'A real sky',
      text: 'Its air scatters sunlight as air does, by Rayleigh’s law, with the scattering worked out from the refractive index of air rather than chosen: straight down at 550 nm it comes to an optical depth of 0.0976, against the 0.097 published. That is why the haze is strongest at the edge, where a line of sight crosses about seventy times more air than straight down, and why the light near the terminator turns orange.',
      cite: ['bodhaine1999'],
    },
    {
      title: 'Ozone',
      text: '300 Dobson units of it, from 10 to 40 km up, absorbing at its measured cross-sections. Looking straight down it hardly matters; for sunlight grazing the high air over the terminator it takes out green and red, so the band there turns blue above its orange, as the sky does after sunset.',
      cite: ['serdyuchenko2014', 'hulburt1953'],
    },
    {
      title: 'Clouds',
      text: 'A cloud map from NASA’s MODIS instruments, on its own sphere 5 km up, so cloud tops stay lit just after the ground below goes dark. Read as an optical depth, with the gain set so 17.3% of the disc is solid cloud, as in the render of NASA’s Eyes. It drifts west at 6 m/s, the trade winds’ speed: right at the equator, wrong at mid-latitudes, where the winds blow east.',
    },
    {
      title: 'The sea’s glint',
      text: 'The oceans reflect the Sun at water’s refractive index, 1.333, and are as rough as Cox and Munk measured the sea to be from its glitter at a 7 m/s wind. The land/water mask is derived from a NASA map: 69.7% water, against the true 70.9%.',
      cite: ['coxmunk1954', 'eakins2010'],
    },
    {
      title: 'City lights',
      text: 'From the 2012 night-light survey of Suomi NPP’s Day/Night Band. They come up where the Sun is 18° below the horizon, the end of astronomical twilight, so they trail the terminator by about 2,000 km. Their brightness is chosen — scaled honestly against the daylit side every city would be black — and so is their colour: the sensor records no colour, and the amber is sodium street lighting taken halfway to white.',
      cite: ['miller2013'],
    },
    {
      title: 'Its magnetic surroundings',
      text: 'The Magnetosphere layer draws them as standard models for quiet, typical conditions: the magnetopause 10.25 Earth radii out toward the Sun, the bow shock 13.7, the Van Allen belts as shells of the magnetic field, about the dipole axis of the 2020 field model. The Kármán line, 100 km up, is a convention.',
      cite: ['shue1998', 'farris1991', 'ganushkina2011', 'alken2021', 'mcdowell2018'],
    },
    {
      title: 'Auroras',
      text: 'The Auroras layer draws NOAA’s live OVATION Prime forecast, fetched when it is on, as oxygen’s green glow 90 to 260 km up over the night side, and only within an hour of the forecast’s time: for any other date nobody knows where the ovals were.',
      cite: ['newell2009'],
    },
    {
      title: 'Its wandering pole',
      text: 'The IAU’s model includes the slow drift of Earth’s axis, precession, so over centuries the pole moves against the stars here as it does.',
      cite: ['archinal2018'],
    },
  ],
  measured: [
    {
      title: 'Size and shape',
      text: '6,378.137 km to the equator, 6,356.752 km to the poles: the spin flattens it by 21 km.',
      cite: ['archinal2018', 'nssdcEarth'],
    },
    {
      title: 'Mass',
      text: 'GM = 398,600.4355 km³/s², from the orbits of satellites and the Moon: 5.97 × 10²⁴ kg. Mean density 5.51 grams per cubic centimetre, the highest of any planet.',
      cite: ['de440', 'nssdcEarth'],
    },
    {
      title: 'Its turn',
      text: '23 h 56 min 4 s against the stars; 24 h from noon to noon, because it also moves round the Sun. The Moon’s tides brake it: on balance, over the last 2,700 years, the day has lengthened by about 1.8 milliseconds a century.',
      cite: ['nssdcEarth', 'stephenson2016'],
    },
    {
      title: 'Orbit',
      text: '147.1 million km from the Sun at its nearest and 152.1 at its farthest, eccentricity 0.0167; once round in 365.256 days, at 29.78 km/s.',
      cite: ['nssdcEarth'],
    },
    {
      title: 'Tilt',
      text: '23.44° between its axis and its orbit.',
      cite: ['nssdcEarth'],
    },
    {
      title: 'Its air',
      text: 'By volume, in dry air, 78.08% nitrogen, 20.95% oxygen, 0.93% argon and 420 parts per million of carbon dioxide; 1,014 hPa at sea level on average.',
      cite: ['nssdcEarth'],
    },
    {
      title: 'Water and cloud',
      text: 'Oceans cover 70.9% of the surface, by the global relief model. MODIS finds about 67% of the planet under cloud at any time.',
      cite: ['eakins2010', 'king2013'],
    },
    {
      title: 'Its inside',
      text: 'Earthquake waves map it: a rocky crust and mantle, a liquid iron outer core from 3,480 km from the centre, and a solid inner core 1,220 km in radius.',
      cite: ['dziewonski1981'],
    },
    {
      title: 'Its magnetic field',
      text: 'Close to a bar magnet’s, its axis tilted about 9° from the spin axis: it met the surface in the north at 80.65°N, 72.68°W in 2020, and it moves year by year.',
      cite: ['alken2021'],
    },
    {
      title: 'Age',
      text: '4.54 billion years, from the decay of uranium into lead in meteorites and the oldest rocks.',
      cite: ['dalrymple2001'],
    },
  ],
  estimated: [
    {
      title: 'How hot its core is',
      text: 'About 6,200 K where the solid inner core meets the liquid outer core, from the melting point of iron measured in the laboratory at that pressure.',
      cite: ['anzellini2013'],
    },
    {
      title: 'The tilt over time',
      text: 'It nods between about 22° and 24.5° in a cycle of 41,000 years, one of the slow rhythms that pace the ice ages, computed from the planets’ pull.',
      cite: ['laskar2004'],
    },
    {
      title: 'The Moon’s steadying hand',
      text: 'Without the Moon, the models say, Earth’s tilt could swing chaotically by tens of degrees; with the Moon it swings by little more than a degree either way.',
      cite: ['laskar1993'],
    },
    {
      title: 'Its future',
      text: 'As the Sun slowly brightens, in about a billion years it will be too hot here for liquid oceans; in about 7.6 billion years the swelling red giant Sun will probably swallow Earth.',
      cite: ['schroder2008'],
    },
  ],
  missing: [
    {
      title: 'Whether we are alone',
      text: 'Not known. No life has been found beyond Earth: not on Mars, which landers and rovers have searched since Viking in 1976, and not on any of the more than six thousand planets confirmed around other stars, only a handful of whose atmospheres can yet be read at all. Absence of evidence, so far, from a search that has barely begun.',
      cite: ['exoplanetArchive', 'klein1978'],
    },
    {
      title: 'Today’s weather',
      text: 'Not drawn. The clouds are a fixed composite of MODIS passes over weeks in 2001, never the weather on the date shown, and moving them does not make them true.',
    },
    {
      title: 'The seasons on the ground',
      text: 'Not drawn. The map is one picture: snow and sea ice do not spread in winter, and forests do not green in spring.',
    },
    {
      title: 'Haze, and the light that bounces',
      text: 'The sky scatters light once only, with no dust or haze in it and no bending of light. So there is none of the white haze low in a real sky, twilight past the terminator comes out about six times too faint and too red, and the Sun sets about half a degree early.',
    },
    {
      title: 'Eclipses',
      text: 'The Moon’s shadow on Earth in a solar eclipse is not drawn, nor Earth’s shadow on the Moon.',
    },
    {
      title: 'The magnetosphere as it is today',
      text: 'The boundaries are drawn at their typical places; in a storm the real magnetopause is pushed in by several Earth radii.',
      cite: ['shue1998'],
    },
    {
      title: 'Its inside and its life',
      text: 'Neither is drawn: the layers are known only through earthquake waves, and nothing alive shows at this scale except as city lights.',
      cite: ['dziewonski1981'],
    },
  ],
  misconceptions: [
    {
      title: 'Seasons are not distance',
      text: 'Earth is nearest the Sun, 147.1 million km, in early January, in northern winter. The seasons come from the tilt: whichever half leans toward the Sun gets it higher in the sky and for longer each day.',
      cite: ['nssdcEarth', 'de440'],
    },
    {
      title: 'One turn is not 24 hours',
      text: 'It turns once in 23 h 56 min 4 s. The 24-hour day is from noon to noon, about four minutes longer, because each day Earth has also moved a little along its orbit.',
      cite: ['nssdcEarth'],
    },
    {
      title: 'Not a perfect sphere',
      text: 'Its spin flattens it: the poles are 21 km nearer the centre than the equator.',
      cite: ['archinal2018'],
    },
    {
      title: 'The sky is not blue because of the sea',
      text: 'It is blue because air molecules scatter short wavelengths much more than long ones. The sea is blue for its own reasons, mostly because water absorbs red light.',
      cite: ['bodhaine1999'],
    },
    {
      title: 'The north magnetic pole',
      text: 'It is not at the geographic North Pole: in 2020 the field’s axis met the surface about 9° away, in the Canadian Arctic, and it moves. And the pole a compass’s north end seeks is, physically, a south magnetic pole.',
      cite: ['alken2021'],
    },
    {
      title: 'Where space begins',
      text: 'The 100 km Kármán line is a convention, not a boundary in the air, which thins gradually; some argue for 80 km.',
      cite: ['mcdowell2018'],
    },
  ],
  sources: [
    {
      key: 'nssdcEarth',
      text: 'Williams, D. R. 2024, Earth Fact Sheet, NASA Space Science Data Coordinated Archive',
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
      key: 'stephenson2016',
      text: 'Stephenson, F. R., Morrison, L. V., & Hohenkerk, C. Y. 2016, Measurement of the Earth’s rotation: 720 BC to AD 2015, Proc. R. Soc. A 472, 20160404',
      url: 'https://doi.org/10.1098/rspa.2016.0404',
    },
    {
      key: 'eakins2010',
      text: 'Eakins, B. W., & Sharman, G. F. 2010, Volumes of the World’s Oceans from ETOPO1, NOAA National Geophysical Data Center',
      url: 'https://web.archive.org/web/2016/https://www.ngdc.noaa.gov/mgg/global/etopo1_ocean_volumes.html',
    },
    {
      key: 'king2013',
      text: 'King, M. D., Platnick, S., Menzel, W. P., Ackerman, S. A., & Hubanks, P. A. 2013, Spatial and Temporal Distribution of Clouds Observed by MODIS Onboard the Terra and Aqua Satellites, IEEE Trans. Geosci. Remote Sens. 51, 3826',
      url: 'https://doi.org/10.1109/TGRS.2012.2227333',
    },
    {
      key: 'dziewonski1981',
      text: 'Dziewonski, A. M., & Anderson, D. L. 1981, Preliminary reference Earth model, Phys. Earth Planet. Inter. 25, 297',
      url: 'https://doi.org/10.1016/0031-9201(81)90046-7',
    },
    {
      key: 'alken2021',
      text: 'Alken, P., et al. 2021, International Geomagnetic Reference Field: the thirteenth generation, Earth Planets Space 73, 49',
      url: 'https://doi.org/10.1186/s40623-020-01288-x',
    },
    {
      key: 'dalrymple2001',
      text: 'Dalrymple, G. B. 2001, The age of the Earth in the twentieth century: a problem (mostly) solved, Geol. Soc. London Spec. Publ. 190, 205',
      url: 'https://doi.org/10.1144/GSL.SP.2001.190.01.14',
    },
    {
      key: 'anzellini2013',
      text: 'Anzellini, S., Dewaele, A., Mezouar, M., Loubeyre, P., & Morard, G. 2013, Melting of Iron at Earth’s Inner Core Boundary Based on Fast X-ray Diffraction, Science 340, 464',
      url: 'https://doi.org/10.1126/science.1233514',
    },
    {
      key: 'laskar2004',
      text: 'Laskar, J., et al. 2004, A long-term numerical solution for the insolation quantities of the Earth, A&A 428, 261',
      url: 'https://doi.org/10.1051/0004-6361:20041335',
    },
    {
      key: 'laskar1993',
      text: 'Laskar, J., Joutel, F., & Robutel, P. 1993, Stabilization of the Earth’s obliquity by the Moon, Nature 361, 615',
      url: 'https://doi.org/10.1038/361615a0',
    },
    {
      key: 'schroder2008',
      text: 'Schröder, K.-P., & Connon Smith, R. 2008, Distant future of the Sun and Earth revisited, MNRAS 386, 155',
      url: 'https://doi.org/10.1111/j.1365-2966.2008.13022.x',
    },
    {
      key: 'bodhaine1999',
      text: 'Bodhaine, B. A., Wood, N. B., Dutton, E. G., & Slusser, J. R. 1999, On Rayleigh Optical Depth Calculations, J. Atmos. Oceanic Technol. 16, 1854',
      url: 'https://doi.org/10.1175/1520-0426(1999)016<1854:ORODC>2.0.CO;2',
    },
    {
      key: 'serdyuchenko2014',
      text: 'Serdyuchenko, A., et al. 2014, High spectral resolution ozone absorption cross-sections – Part 2: Temperature dependence, Atmos. Meas. Tech. 7, 625',
      url: 'https://doi.org/10.5194/amt-7-625-2014',
    },
    {
      key: 'hulburt1953',
      text: 'Hulburt, E. O. 1953, Explanation of the Brightness and Color of the Sky, Particularly the Twilight Sky, J. Opt. Soc. Am. 43, 113',
      url: 'https://doi.org/10.1364/JOSA.43.000113',
    },
    {
      key: 'coxmunk1954',
      text: 'Cox, C., & Munk, W. 1954, Measurement of the Roughness of the Sea Surface from Photographs of the Sun’s Glitter, J. Opt. Soc. Am. 44, 838',
      url: 'https://doi.org/10.1364/JOSA.44.000838',
    },
    {
      key: 'miller2013',
      text: 'Miller, S. D., et al. 2013, Illuminating the Capabilities of the Suomi National Polar-Orbiting Partnership (NPP) Visible Infrared Imaging Radiometer Suite (VIIRS) Day/Night Band, Remote Sens. 5, 6717',
      url: 'https://doi.org/10.3390/rs5126717',
    },
    {
      key: 'shue1998',
      text: 'Shue, J.-H., et al. 1998, Magnetopause location under extreme solar wind conditions, J. Geophys. Res. 103, 17691',
      url: 'https://doi.org/10.1029/98JA01103',
    },
    {
      key: 'farris1991',
      text: 'Farris, M. H., Petrinec, S. M., & Russell, C. T. 1991, The thickness of the magnetosheath: Constraints on the polytropic index, Geophys. Res. Lett. 18, 1821',
      url: 'https://doi.org/10.1029/91GL02090',
    },
    {
      key: 'ganushkina2011',
      text: 'Ganushkina, N. Y., et al. 2011, Locations of boundaries of outer and inner radiation belts as observed by Cluster and Double Star, J. Geophys. Res. 116, A09234',
      url: 'https://doi.org/10.1029/2010JA016376',
    },
    {
      key: 'newell2009',
      text: 'Newell, P. T., Sotirelis, T., & Wing, S. 2009, Diffuse, monoenergetic, and broadband aurora: The global precipitation budget, J. Geophys. Res. 114, A09207',
      url: 'https://doi.org/10.1029/2009JA014326',
    },
    {
      key: 'mcdowell2018',
      text: 'McDowell, J. C. 2018, The edge of space: Revisiting the Karman Line, Acta Astronaut. 151, 668',
      url: 'https://doi.org/10.1016/j.actaastro.2018.07.003',
    },
    {
      key: 'exoplanetArchive',
      text: 'NASA Exoplanet Archive, 6,470 confirmed planets as of 19 November 2026, NASA Exoplanet Science Institute',
      url: 'https://exoplanetarchive.ipac.caltech.edu/',
    },
    {
      key: 'klein1978',
      text: 'Klein, H. P. 1978, The Viking biological experiments on Mars, Icarus 34, 666',
      url: 'https://doi.org/10.1016/0019-1035(78)90053-2',
    },
  ],
};
