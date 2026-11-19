import type { Description } from './types.ts';

/**
 * The Moon. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model.
 */
export const MOON: Description = {
  id: 'moon',
  lead: [
    'Every person who has ever looked up at night has seen the same face of the Moon. It is the only other world people have walked on — twelve of them, between 1969 and 1972 — and the footprints they left are still there, with no wind to wipe them away.',
    'The Moon is Earth’s only natural satellite: a ball of rock 3,474 kilometres across, a little more than a quarter of Earth’s width, with 81 times less mass. It has almost no air, no liquid water and no weather, so the craters of four and a half billion years of impacts are still there. The dark patches seen from Earth, the maria or “seas”, are plains of lava that flooded old impact basins, most of them between 3.7 and 3.3 billion years ago.',
    'It probably formed 4.51 billion years ago from the debris of a collision between the young Earth and a body about the mass of Mars. Its crust is 34 to 43 kilometres thick on average, and its far side, never seen from Earth, has almost none of the dark maria of the near side.',
    'It always turns the same face to Earth, spinning once for each orbit. Its pull raises Earth’s tides, and the tides in turn push it slowly away, 3.8 centimetres a year, measured by bouncing lasers off reflectors left on its surface. Its phases are only its sunlit half seen from changing angles; when it passes through Earth’s shadow it turns red, a lunar eclipse.',
    'It is the only other world people have stood on. Twelve astronauts walked on it between 1969 and 1972 and brought back 382 kilograms of rock and soil. Since then robots have kept going: China’s Chang’e 4 made the first landing on the far side in 2019, and Chang’e 6 brought back the first rock from there in 2024. In April 2026 the four astronauts of Artemis II flew around it, the first people to go so far since 1972.',
    'It orbits Earth at an average 384,400 kilometres — light crosses that in 1.3 seconds — once every 27.3 days, but its phases repeat every 29.5 days, because Earth moves on around the Sun in the meantime. Its orbit is tilted 5° to Earth’s, which is why there is not an eclipse every month. Earth and Moon both circle their common centre of mass, which lies 4,670 kilometres from Earth’s centre, inside the Earth.',
  ],
  photos: [
    {
      file: 'photos/moon/apollo11-aldrin.webp',
      largeFile: 'photos/moon/apollo11-aldrin-large.webp',
      width: 640,
      height: 625,
      title: 'Buzz Aldrin on the Moon, 20 July 1969',
      caption:
        'Apollo 11 in the Sea of Tranquillity, photographed by Neil Armstrong, who is reflected in Aldrin’s visor beside the lander. The ground is grey, as it is: the Moon has almost no colour. The sky is black because there is no air to scatter sunlight.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1969-07-20',
      sourceUrl: 'https://images.nasa.gov/details/as11-40-5903',
    },
    {
      file: 'photos/moon/apollo17-boulder.webp',
      largeFile: 'photos/moon/apollo17-boulder-large.webp',
      width: 640,
      height: 663,
      title: 'Harrison Schmitt beside a split boulder, 13 December 1972',
      caption:
        'Apollo 17, the last crewed landing, in the Taurus-Littrow valley; Schmitt, a geologist, is the small figure on the left, photographed by Eugene Cernan.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1972-12-13',
      sourceUrl: 'https://images.nasa.gov/details/as17-140-21496',
    },
    {
      file: 'photos/moon/apollo11-full-moon.webp',
      largeFile: 'photos/moon/apollo11-full-moon-large.webp',
      width: 640,
      height: 643,
      title: 'The whole Moon from Apollo 11, 21 July 1969',
      caption:
        'Taken on the way home, from about 18,500 km. Seen from beside the Moon rather than from Earth, so the face is turned: part of the familiar near side with its dark maria, part of the far side, bright and cratered.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '1969-07-21',
      sourceUrl: 'https://images.nasa.gov/details/as11-44-6667',
    },
    {
      file: 'photos/moon/dscovr-far-side.webp',
      largeFile: 'photos/moon/dscovr-far-side-large.webp',
      width: 640,
      height: 640,
      title: 'The far side, fully lit, crossing Earth, July 2015',
      caption:
        'From a million miles, 1.6 million kilometres, by the DSCOVR satellite’s EPIC camera: the side of the Moon never seen from Earth, in full sunlight, passing in front of the Pacific. Almost no dark maria. The thin green edge on its right is an artefact: the Moon moved between the colour exposures, which are taken one after another.',
      colour: 'true',
      credit: 'NASA/NOAA',
      licence: 'NASA media, not copyrighted',
      date: '2015-07-16',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000670',
    },
    {
      file: 'photos/moon/artemis-ii-moon.webp',
      largeFile: 'photos/moon/artemis-ii-moon-large.webp',
      width: 640,
      height: 427,
      title: 'The Moon from Orion, 6 April 2026',
      caption:
        'The Artemis II crew’s view during their flyby: more than two-thirds of the Moon, with the Orientale basin on the border between the near and far sides and the dark, round floor of Grimaldi crater to its north-east.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2026-04-06',
      sourceUrl: 'https://images.nasa.gov/details/art002e009627',
    },
    {
      file: 'photos/moon/artemis-ii-orientale.webp',
      largeFile: 'photos/moon/artemis-ii-orientale-large.webp',
      width: 640,
      height: 427,
      title: 'The rings of the Orientale basin, 6 April 2026',
      caption:
        'One of the Moon’s youngest and best-kept large impact basins, almost 1,000 km across, photographed by the Artemis II crew: concentric rings of mountains around a small dark lava floor. Hardly visible from Earth, on the Moon’s western edge.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2026-04-06',
      sourceUrl: 'https://images.nasa.gov/details/art002e012090',
    },
    {
      file: 'photos/moon/eclipse-2025.webp',
      largeFile: 'photos/moon/eclipse-2025-large.webp',
      width: 640,
      height: 640,
      title: 'A total lunar eclipse, 14 March 2025',
      caption:
        'Seventeen exposures over one night in Ohio, combined into a circle: the Moon enters Earth’s shadow, turns red at totality — lit only by sunlight bent and reddened through Earth’s atmosphere, every sunrise and sunset at once — and comes out again.',
      colour: 'true',
      credit: 'NASA/Sara Lowthian-Hanna',
      licence: 'NASA media, not copyrighted',
      date: '2025-03-14',
      sourceUrl: 'https://images.nasa.gov/details/GRC-2025-C-01619',
    },
    {
      file: 'photos/moon/galileo-false-colour.webp',
      largeFile: 'photos/moon/galileo-false-colour-large.webp',
      width: 500,
      height: 795,
      title: 'What the Moon is made of, from Galileo, 7 December 1992',
      caption:
        'Galileo, on its way to Jupiter, flew past the Moon and photographed it through several filters; the differences are exaggerated here. Blue is soil rich in titanium, as in Mare Tranquillitatis where Apollo 11 landed; orange, lavas poorer in it, as in Mare Serenitatis; red, the highlands, poor in titanium and iron.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1992-12-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA00129',
    },
  ],
  drawnHere: [
    {
      title: 'Its map',
      text: 'NASA’s mosaic of more than 100,000 images from the Lunar Reconnaissance Orbiter’s wide-angle camera, its 643, 566 and 415 nm bands taken as red, green and blue, with the exposure and white balance set to look as an eye would see it; NASA says it is made for appearance rather than science. Between 70° north and south it is LRO’s colour; nearer the poles, a grey brightness map from LRO’s laser altimeter. At 2,048 pixels round, each pixel is about 5.3 km at the equator.',
      cite: ['svs4720', 'robinson2010'],
    },
    {
      title: 'Both sides, equally',
      text: 'The far side is mapped as well as the near side: LRO has photographed all of it. Turn the Moon round here and it is what DSCOVR saw — bright highlands and almost no maria.',
      cite: ['svs4720', 'dscovr'],
    },
    {
      title: 'Its wobble, from the rotation model',
      text: 'It turns at a steady rate on a tilted axis, following the IAU’s model with its thirteen periodic terms, while JPL’s orbit carries it nearer and farther and above and below Earth’s line of sight. The libration that lets Earth see 59% of the Moon over time is not added: it follows from those two. On 10 May 2026, JPL puts the point beneath Earth 7.0° west of the Moon’s prime meridian, and on 1 September 2026 5.6° south of its equator; the app turns it to within 0.007° of JPL. The pole agrees with JPL’s to 0.002°, and the 6.67° tilt of its axis to its orbit comes out of the pole and the orbit, to within 0.2°, without being put in.',
      cite: ['archinal2018', 'de440', 'svs10836'],
    },
    {
      title: 'How close to JPL',
      text: 'Sampled once a day from JPL and interpolated: checked against JPL over three orbits, the worst error was 4.2 km, under a four-hundredth of its own radius.',
      cite: ['de440'],
    },
    {
      title: 'Its phases',
      text: 'Lit only by the Sun, in the Natural lighting mode, so its phases are simply what is lit and what is not, seen from wherever the camera is. The Flood and Shadow modes brighten its night side so it can be made out; that light is a legibility aid, not earthshine.',
    },
    {
      title: 'The landing sites',
      text: 'Sixteen places where craft came down, from Surveyor 1 and the six Apollo landings to Chang’e 6 and Blue Ghost 1 — each where an orbiter’s camera later found the hardware, not where the mission aimed. LRO’s narrow-angle camera places most of them to a few metres, Apollo 11’s to 0.3 m, and a few of the newest to tens or hundreds of metres. Named once the Moon is large on screen, and only on the side facing the camera; the Landing Sites layer is on by default.',
      cite: ['wagner2017'],
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 1,737.4 km — 1,738.1 at the equator and 1,736.0 at the poles; mass 7.346 × 10²² kg, 1.23% of Earth’s; mean density 3.34 g/cm³. Gravity at the surface is 1.62 m/s², a sixth of Earth’s.',
      cite: ['nssdc'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 384,400 km, from about 363,300 at perigee to 405,500 at apogee; eccentricity 0.055; tilted 5.145° to the ecliptic. It goes round in 27.32 days and from new Moon to new Moon in 29.53.',
      cite: ['nssdc'],
    },
    {
      title: 'Moving away',
      text: 'By 38.30 ± 0.08 mm a year, from more than four decades of timing laser pulses to reflectors on its surface. Earth’s tides carry momentum out to the Moon, so the Moon recedes while Earth’s day lengthens.',
      cite: ['williams2016'],
    },
    {
      title: 'Age',
      text: '4.51 billion years, from zircon crystals in Apollo samples: the Moon had formed within the first 60 million years of the Solar System.',
      cite: ['barboni2017'],
    },
    {
      title: 'Its crust',
      text: 'The GRAIL spacecraft’s map of its gravity puts the highland crust at a density of 2,550 kg/m³, about 12% empty space from billions of years of impacts, and the crust between 34 and 43 km thick on average.',
      cite: ['wieczorek2013'],
    },
    {
      title: 'The maria',
      text: 'Dated by counting craters on them, calibrated by the samples: volcanism lasted from about 4 to about 1.2 billion years ago, most of the lava erupting between 3.7 and 3.3 billion years ago.',
      cite: ['hiesinger2003'],
    },
    {
      title: 'Temperature and air',
      text: 'At the equator, from 95 K at night to 390 K at noon. Its whole atmosphere weighs about 25 tonnes; its pressure at the surface at night is 3 × 10⁻¹⁵ bar, where Earth’s is about 1 bar.',
      cite: ['nssdc'],
    },
    {
      title: 'Water ice',
      text: 'In craters near its poles that sunlight never reaches. LCROSS crashed a rocket stage into one in 2009 and found water in the plume; infrared spectra from India’s Chandrayaan-1 show ice exposed at the surface.',
      cite: ['colaprete2010', 'li2018'],
    },
    {
      title: 'What came back',
      text: 'Six Apollo landings, 1969–1972, returned 382 kg in about 2,200 samples. Chang’e 4 landed in Von Kármán crater on the far side in 2019, and Chang’e 6 returned far-side basalt that erupted 2.8 billion years ago.',
      cite: ['curator', 'li2019', 'zhang2025'],
    },
    {
      title: 'Its brightness',
      text: 'It reflects only about 11% of the light that falls on it (Bond albedo 0.11) — less than half of what Earth reflects, 0.30, which earthshine itself has been used to measure.',
      cite: ['nssdc', 'goode2001'],
    },
  ],
  estimated: [
    {
      title: 'How it formed',
      text: 'The leading model is a giant impact: simulations of a body about the mass of Mars striking the young Earth at a glancing angle throw out enough iron-poor debris to make the Moon. It explains the Moon’s size and its small iron core; it remains a model, and others are still proposed.',
      cite: ['canup2001'],
    },
    {
      title: 'Its core',
      text: 'Re-analysed seismograms from the Apollo seismometers suggest a solid inner core about 240 km in radius inside a fluid outer core about 330 km in radius. No instrument has been there; the figures are a model fitted to faint signals.',
      cite: ['weber2011'],
    },
    {
      title: 'What it does for Earth’s seasons',
      text: 'Calculations show that without the Moon, Earth’s tilt would wander chaotically by tens of degrees over millions of years; the Moon’s pull holds it steady, and with it the seasons.',
      cite: ['laskar1993'],
    },
  ],
  missing: [
    {
      title: 'Its mountains and craters in relief',
      text: 'Not drawn. The Moon is a smooth sphere carrying a map, so the terminator is a clean curve where the real one is ragged with crater rims and peaks catching the light, and nothing casts a shadow. Its heights are measured, by LRO’s laser altimeter, but no terrain is modelled.',
      cite: ['svs4720'],
    },
    {
      title: 'Earthshine',
      text: 'Not drawn. Sunlight reflected off Earth lights the Moon’s night side faintly but plainly — the “old Moon in the new Moon’s arms” — and here its night side is black.',
      cite: ['goode2001'],
    },
    {
      title: 'Eclipses',
      text: 'The Sun, Earth and Moon line up exactly when they really do, because their positions are JPL’s; but neither Earth nor the Moon casts a shadow on the other here. During a lunar eclipse the Moon stays fully lit, and during a solar eclipse no shadow crosses the Earth.',
      cite: ['de440'],
    },
    {
      title: 'The poles in colour',
      text: 'Beyond 70° north and south the map has no colour, only the altimeter’s grey; and the ice in the permanently shadowed craters is not shown.',
      cite: ['svs4720', 'li2018'],
    },
    {
      title: 'The hardware itself',
      text: 'Landers, rovers and the flags are far too small for a 5 km pixel: the landing sites are marks, not pictures.',
      cite: ['wagner2017'],
    },
  ],
  misconceptions: [
    {
      title: 'There is no dark side',
      text: 'The far side gets as much sunlight as the near side: at new Moon, when the side facing us is dark, the far side is in full day. “Dark” meant unknown. It was first photographed, sunlit, by Luna 3 in October 1959, and DSCOVR saw it fully lit in 2015.',
      cite: ['luna3', 'dscovr'],
    },
    {
      title: 'The phases are not Earth’s shadow',
      text: 'The Sun always lights half the Moon; the phases are how much of that half faces us as it goes round. Earth’s shadow falls on it only in a lunar eclipse, which can happen only at full Moon.',
      cite: ['nasaphases'],
    },
    {
      title: 'It does spin',
      text: 'Showing one face means it turns exactly once per orbit, once every 27.3 days. A Moon that did not spin would show us all of itself each month.',
      cite: ['nssdc'],
    },
    {
      title: 'It is not bigger near the horizon',
      text: 'Measured, it is slightly smaller there: the observer is then about one Earth radius farther from it than when it is overhead. The bigger horizon Moon is in the brain — experiments show the eye judges it farther away and so larger.',
      cite: ['kaufman2000', 'nssdc'],
    },
    {
      title: 'It is not white',
      text: 'It reflects about 11% of the light that falls on it, less than half as much as Earth does. It looks bright only against a black sky.',
      cite: ['nssdc', 'goode2001'],
    },
  ],
  sources: [
    {
      key: 'nssdc',
      text: 'Williams, D. R., Moon Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
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
      key: 'svs4720',
      text: 'NASA Scientific Visualization Studio, CGI Moon Kit (4720), from LRO camera and altimeter data',
      url: 'https://svs.gsfc.nasa.gov/4720',
    },
    {
      key: 'robinson2010',
      text: 'Robinson, M. S., et al. 2010, Lunar Reconnaissance Orbiter Camera (LROC) Instrument Overview, Space Sci. Rev. 150, 81',
      url: 'https://doi.org/10.1007/s11214-010-9634-2',
    },
    {
      key: 'svs10836',
      text: 'NASA Scientific Visualization Studio 2011, Moon Wobble (10836)',
      url: 'https://svs.gsfc.nasa.gov/10836',
    },
    {
      key: 'wagner2017',
      text: 'Wagner, R. V., et al. 2017, Coordinates of anthropogenic features on the Moon, Icarus 283, 92',
      url: 'https://doi.org/10.1016/j.icarus.2016.05.011',
    },
    {
      key: 'williams2016',
      text: 'Williams, J. G., & Boggs, D. H. 2016, Secular tidal changes in lunar orbit and Earth rotation, Celest. Mech. Dyn. Astron. 126, 89',
      url: 'https://doi.org/10.1007/s10569-016-9702-3',
    },
    {
      key: 'barboni2017',
      text: 'Barboni, M., et al. 2017, Early formation of the Moon 4.51 billion years ago, Science Advances 3, e1602365',
      url: 'https://doi.org/10.1126/sciadv.1602365',
    },
    {
      key: 'wieczorek2013',
      text: 'Wieczorek, M. A., et al. 2013, The Crust of the Moon as Seen by GRAIL, Science 339, 671',
      url: 'https://doi.org/10.1126/science.1231530',
    },
    {
      key: 'hiesinger2003',
      text: 'Hiesinger, H., et al. 2003, Ages and stratigraphy of mare basalts in Oceanus Procellarum, Mare Nubium, Mare Cognitum, and Mare Insularum, J. Geophys. Res. 108, 5065',
      url: 'https://doi.org/10.1029/2002JE001985',
    },
    {
      key: 'colaprete2010',
      text: 'Colaprete, A., et al. 2010, Detection of Water in the LCROSS Ejecta Plume, Science 330, 463',
      url: 'https://doi.org/10.1126/science.1186986',
    },
    {
      key: 'li2018',
      text: 'Li, S., et al. 2018, Direct evidence of surface exposed water ice in the lunar polar regions, PNAS 115, 8907',
      url: 'https://doi.org/10.1073/pnas.1802345115',
    },
    {
      key: 'curator',
      text: 'NASA Astromaterials Acquisition and Curation Office, Lunar Rocks and Soils from Apollo Missions',
      url: 'https://curator.jsc.nasa.gov/lunar/',
    },
    {
      key: 'li2019',
      text: 'Li, C., et al. 2019, Chang’E-4 initial spectroscopic identification of lunar far-side mantle-derived materials, Nature 569, 378',
      url: 'https://doi.org/10.1038/s41586-019-1189-0',
    },
    {
      key: 'zhang2025',
      text: 'Zhang, Q. W. L., et al. 2025, Lunar farside volcanism 2.8 billion years ago from Chang’e-6 basalts, Nature 643, 356',
      url: 'https://doi.org/10.1038/s41586-024-08382-0',
    },
    {
      key: 'goode2001',
      text: 'Goode, P. R., et al. 2001, Earthshine observations of the Earth’s reflectance, Geophys. Res. Lett. 28, 1671',
      url: 'https://doi.org/10.1029/2000GL012580',
    },
    {
      key: 'canup2001',
      text: 'Canup, R. M., & Asphaug, E. 2001, Origin of the Moon in a giant impact near the end of the Earth’s formation, Nature 412, 708',
      url: 'https://doi.org/10.1038/35089010',
    },
    {
      key: 'weber2011',
      text: 'Weber, R. C., et al. 2011, Seismic Detection of the Lunar Core, Science 331, 309',
      url: 'https://doi.org/10.1126/science.1199375',
    },
    {
      key: 'laskar1993',
      text: 'Laskar, J., Joutel, F., & Robutel, P. 1993, Stabilization of the Earth’s obliquity by the Moon, Nature 361, 615',
      url: 'https://doi.org/10.1038/361615a0',
    },
    {
      key: 'luna3',
      text: 'NASA Space Science Data Coordinated Archive, Luna 3: the first images of the lunar far side',
      url: 'https://nssdc.gsfc.nasa.gov/imgcat/html/object_page/lu3_2.html',
    },
    {
      key: 'dscovr',
      text: 'NASA 2015, From a Million Miles Away, NASA Camera Shows Moon Crossing Face of Earth (DSCOVR EPIC)',
      url: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000670',
    },
    {
      key: 'nasaphases',
      text: 'NASA Science, Moon Phases',
      url: 'https://science.nasa.gov/moon/moon-phases/',
    },
    {
      key: 'kaufman2000',
      text: 'Kaufman, L., & Kaufman, J. H. 2000, Explaining the moon illusion, PNAS 97, 500',
      url: 'https://doi.org/10.1073/pnas.97.1.500',
    },
  ],
};
