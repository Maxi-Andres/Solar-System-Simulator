import type { Description } from './types.ts';

/**
 * The Sun. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model.
 */
export const SUN: Description = {
  id: 'sun',
  lead: [
    'Every sunrise anyone has ever seen, every meal ever eaten and every breath of oxygen a plant ever made began as light from this one star. People worshipped it for most of history; it turned out to be one star among hundreds of billions in our galaxy, and the only one close enough to keep us alive.',
    'The Sun is a star — the only one close enough to see as a disc. It is a ball of hot gas, mostly hydrogen and helium, 1.39 million kilometres across: 109 Earths would fit side by side across its face. It holds 99.86% of all the mass in the Solar System, and its gravity keeps everything else in orbit around it, from Jupiter to the smallest grain of dust.',
    'It shines because of nuclear fusion. In its core, every second, about 600 million tonnes of hydrogen are squeezed into helium, and the mass that goes missing comes out as energy. That energy works its way out for a very long time before it leaves the visible surface, the photosphere, at 5,772 K. The photosphere is not solid: it is just the depth where the gas becomes see-through. Above it lie the chromosphere and the corona, over a million degrees hot, which the eye sees only during a total eclipse.',
    'The corona never stops blowing outward. That flow, the solar wind, carries the Sun’s magnetic field across the whole Solar System at 400 to 750 kilometres per second, and it fills a bubble around us, the heliosphere, far beyond Pluto. When a gust of it — a flare or a coronal mass ejection — hits Earth’s magnetic field, it lights up the auroras and can disturb satellites and power grids.',
    'Almost everything on Earth runs on it. Its light warms the planet and drives the weather, the winds and the ocean currents; the tilt of Earth’s axis toward and away from it gives the seasons; plants live on it, and so does everything that eats them.',
    'It sits in a small arm of the Milky Way, the Local Arm or Orion Spur, about 27,000 light years from the galaxy’s centre. It carries the whole Solar System around that centre at about 250 kilometres per second — nine hundred thousand kilometres an hour — and still takes about 230 million years to go round once. It is 4.57 billion years old, roughly halfway through its life.',
  ],
  photos: [
    {
      file: 'photos/sun/eclipse-2017.webp',
      largeFile: 'photos/sun/eclipse-2017-large.webp',
      width: 640,
      height: 427,
      title: 'The corona at totality, 21 August 2017',
      caption:
        'The total eclipse of 2017: the Moon covers the photosphere and the corona shows, white, as it is. The pink at the edge is the chromosphere and its prominences, glowing in hydrogen’s red line.',
      colour: 'true',
      credit: 'NASA/Carla Thomas',
      licence: 'NASA media, not copyrighted',
      date: '2017-08-21',
      sourceUrl: 'https://images.nasa.gov/details/AFRC2017-0233-008',
    },
    {
      file: 'photos/sun/eclipse-artemis-ii.webp',
      largeFile: 'photos/sun/eclipse-artemis-ii-large.webp',
      width: 640,
      height: 427,
      title: 'Eclipsed by the Moon, seen from Orion, 6 April 2026',
      caption:
        'The Artemis II crew, flying past the Moon, saw it cover the Sun for nearly 54 minutes. The halo is the corona, the zodiacal light, or both — NASA says the science community is still working out which — and with the disc hidden, stars show around it.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2026-04-06',
      sourceUrl: 'https://images.nasa.gov/details/art002e009301',
    },
    {
      file: 'photos/sun/sdo-sunspot-2014.webp',
      largeFile: 'photos/sun/sdo-sunspot-2014-large.webp',
      width: 640,
      height: 640,
      title: 'The largest sunspot of its cycle, October 2014',
      caption:
        'The Solar Dynamics Observatory’s view of the visible surface, with the biggest sunspot group of solar cycle 24, wider than ten Earths. Its orange is a tint added for the picture: the photosphere is white.',
      colour: 'tinted',
      credit: 'NASA/SDO',
      licence: 'NASA media, not copyrighted',
      date: '2014-10-23',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000923',
    },
    {
      file: 'glossary/sun.webp',
      largeFile: 'glossary/large/sun.webp',
      width: 406,
      height: 400,
      title: 'A spotless Sun, March 2017',
      caption:
        'On the way to solar minimum, eleven days with no sunspots at all. The picture blends the filtered visible disc with an extreme-ultraviolet image, so its colours are a convention, not what an eye would see.',
      colour: 'false',
      credit: 'NASA/GSFC/Solar Dynamics Observatory',
      licence: 'NASA media, not copyrighted',
      date: '2017-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA21569',
    },
    {
      file: 'photos/sun/mercury-transit-2019.webp',
      largeFile: 'photos/sun/mercury-transit-2019-large.webp',
      width: 640,
      height: 507,
      title: 'Mercury crossing the Sun, 11 November 2019',
      caption:
        'The small black dot low on the disc is Mercury, a planet 4,880 km across, seen from Washington through a solar filter. The filter tints the Sun orange; the picture is still the best sense of scale there is.',
      colour: 'tinted',
      credit: 'NASA/Bill Ingalls',
      licence: 'NASA media, not copyrighted',
      date: '2019-11-11',
      sourceUrl: 'https://images.nasa.gov/details/NHQ201911110001',
    },
    {
      file: 'photos/sun/iss-transit-2020.webp',
      largeFile: 'photos/sun/iss-transit-2020-large.webp',
      width: 316,
      height: 640,
      title: 'The Space Station crossing the Sun, 24 June 2020',
      caption:
        'The International Space Station, 109 metres across with five people aboard, in silhouette as it crosses the disc at about 8 kilometres per second, photographed through a solar filter from Fredericksburg, Virginia.',
      colour: 'tinted',
      credit: 'NASA/Joel Kowsky',
      licence: 'NASA media, not copyrighted',
      date: '2020-06-24',
      sourceUrl: 'https://images.nasa.gov/details/NHQ202006240002',
    },
    {
      file: 'photos/sun/sdo-prominence-2012.webp',
      largeFile: 'photos/sun/sdo-prominence-2012-large.webp',
      width: 612,
      height: 802,
      title: 'A prominence erupting, 16 April 2012',
      caption:
        'Gas held up by the magnetic field breaks loose from the Sun’s edge. Seen by the Solar Dynamics Observatory in extreme ultraviolet, light no eye can see, shown in red by convention.',
      colour: 'false',
      credit: 'NASA/SDO',
      licence: 'NASA media, not copyrighted',
      date: '2012-04-16',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001767',
    },
    {
      file: 'photos/sun/sdo-x-flare-2014.webp',
      largeFile: 'photos/sun/sdo-x-flare-2014-large.webp',
      width: 640,
      height: 591,
      title: 'A flare, 19 October 2014',
      caption:
        'The bright burst at the left edge is an X-class flare, the strongest kind, from the same giant sunspot group as the photo above. Extreme ultraviolet at 131 ångströms, shown in teal by convention.',
      colour: 'false',
      credit: 'NASA/SDO',
      licence: 'NASA media, not copyrighted',
      date: '2014-10-19',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000934',
    },
    {
      file: 'photos/sun/soho-cme-2002.webp',
      largeFile: 'photos/sun/soho-cme-2002-large.webp',
      width: 640,
      height: 567,
      title: 'A coronal mass ejection, 8 January 2002',
      caption:
        'Around a billion tonnes of the corona thrown into space. SOHO’s coronagraph hides the bright disc and sees the corona around it; an ultraviolet image of the Sun from another day is laid over the hidden disc. A composite, in false colour.',
      colour: 'false',
      credit: 'SOHO (ESA & NASA), LASCO and EIT',
      licence: 'SOHO data, free to use with credit',
      date: '2002-01-08',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e002109',
    },
    {
      file: 'photos/sun/sdo-two-wavelengths-2015.webp',
      largeFile: 'photos/sun/sdo-two-wavelengths-2015-large.webp',
      width: 640,
      height: 360,
      title: 'The same Sun in two colours of ultraviolet, December 2015',
      caption:
        'Left, 304 ångströms, from the chromosphere; right, 171 ångströms, from the corona, where the gas traces the magnetic field’s loops. Each wavelength shows gas at its own temperature, and each is given a colour so they can be told apart.',
      colour: 'false',
      credit: 'NASA/SDO',
      licence: 'NASA media, not copyrighted',
      date: '2015-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA20214',
    },
  ],
  drawnHere: [
    {
      title: 'Overexposed, on purpose',
      text: 'Its disc is drawn far brighter than the planets, because it is: its surface is 154,000 times as bright as sunlit Earth, more than any screen can show beside a planet. The exposure is chosen so the red channel saturates across the disc and the last of the granulation survives in the blue; the disc then averages the colour NASA’s own render of it has.',
    },
    {
      title: 'Its colour',
      text: 'The surface map is a false-colour convention, as every global map of the Sun is. Its glare, and the Sun seen as a star from far away, take its measured colour, B−V = 0.65, through the same blackbody-and-eye path every star in the app takes.',
      cite: ['ramirez2012'],
    },
    {
      title: 'Its glare',
      text: 'The halo around it is the eye’s own, measured point-spread function, at the disc’s real illuminance: nothing about it is a setting.',
    },
    {
      title: 'Not at the centre',
      text: 'It is drawn where JPL puts it, which is not the Solar System’s centre of mass. Jupiter and Saturn pull it around the barycentre by as much as about two of its own radii, so the centre the planets orbit is often outside the Sun.',
      cite: ['de440'],
    },
  ],
  measured: [
    {
      title: 'Size',
      text: 'Radius 695,700 km, the IAU’s nominal value, from the photosphere’s measured edge. Almost perfectly round: its equatorial radius is only about 6 km longer than its polar one.',
      cite: ['iau2015', 'kuhn2012'],
    },
    {
      title: 'Mass',
      text: 'GM = 132,712,440,041 km³/s², from the motions of the planets and spacecraft — known far better than G itself, so the mass, 1.989 × 10³⁰ kg, is the less exact number.',
      cite: ['de440'],
    },
    {
      title: 'Light',
      text: 'It gives off 3.828 × 10²⁶ watts; at Earth’s distance that is 1,361 watts on every square metre facing it, measured from orbit above the air.',
      cite: ['iau2015', 'kopp2011'],
    },
    {
      title: 'Temperature',
      text: 'The photosphere’s effective temperature is 5,772 K, from its total light and its size.',
      cite: ['iau2015'],
    },
    {
      title: 'Rotation',
      text: 'Followed by its sunspots and by its light’s Doppler shift: about 25 days at the equator and about 35 near the poles — a gas turns at different speeds at different latitudes.',
      cite: ['snodgrass1990'],
    },
    {
      title: 'What it is made of',
      text: 'By mass, 73.8% hydrogen, 24.9% helium and 1.3% everything else, from the dark lines in its spectrum and the most primitive meteorites, which formed from the same cloud; the helium, which leaves no lines in the photosphere, from the Sun’s vibrations.',
      cite: ['asplund2009'],
    },
    {
      title: 'Age',
      text: '4.567 billion years: the age of the oldest solids in meteorites, the first things to condense around the young Sun, dated by the decay of uranium into lead.',
      cite: ['connelly2012'],
    },
    {
      title: 'Its wind',
      text: 'Measured where it blows, by spacecraft: a slow wind of about 400 km/s from near the equator and a fast one of about 750 km/s from the poles, which Ulysses found flying over them.',
      cite: ['mccomas2000'],
    },
    {
      title: 'Its path around the galaxy',
      text: 'About 250 km/s around the galactic centre, from the apparent drift of Sagittarius A* across our sky as the Sun carries us past it, measured by radio interferometry; 27,000 light years from it, by the stars orbiting the black hole.',
      cite: ['reid2020', 'gravity2019'],
    },
  ],
  estimated: [
    {
      title: 'Its core',
      text: 'About 15.7 million kelvin and 150 times the density of water: no instrument can see inside, so these are the standard solar model’s figures — a model that has to match the Sun’s size, light, age and composition, and that the Sun’s own vibrations (helioseismology) and its neutrinos test from outside.',
      cite: ['bahcall2005'],
    },
    {
      title: 'How old its light is',
      text: 'Sunlight is 8 minutes 19 seconds old when it reaches Earth, but the energy it carries left the core long before: bounced from atom to atom, it takes on the order of 170,000 years to reach the surface. The figure is a model’s, and estimates range over tens of thousands to a few hundred thousand years.',
      cite: ['mitalas1992'],
    },
    {
      title: 'Its future',
      text: 'In about 5 billion years it runs out of hydrogen in its core and swells into a red giant, probably swallowing Mercury and Venus; then it sheds its outer layers and ends as a white dwarf about the size of Earth.',
      cite: ['schroder2008'],
    },
  ],
  missing: [
    {
      title: 'No true-colour map of its surface',
      text: 'The surface map is not the Sun on any particular day: the real photosphere is covered in granules about 1,000 km across that each last around ten minutes, and its sunspots come and go over days. No global true-colour map exists, because the Sun has no fixed surface to map.',
      cite: ['nordlund2009'],
    },
    {
      title: 'Today’s sunspots',
      text: 'Not drawn. The Solar Dynamics Observatory photographs the Sun every 12 seconds; showing the day’s spots would mean fetching its images live, which the app does not do yet.',
    },
    {
      title: 'The corona and chromosphere',
      text: 'Not drawn. The corona is a million times fainter than the disc, so at any exposure that shows the planets it would be invisible anyway; the eclipse photos above show it as it is. The solar wind it blows out is drawn only where it ends, in the Heliosphere layer, as a model.',
    },
    {
      title: 'Its differential rotation',
      text: 'The map turns as one piece, at the IAU’s single rate, where the real Sun’s equator laps its poles.',
      cite: ['archinal2018'],
    },
    {
      title: 'Its inside',
      text: 'The core, the radiative zone and the convection zone are not drawn: nothing measures them directly, and they could not be seen anyway.',
    },
  ],
  misconceptions: [
    {
      title: 'A “yellow dwarf” that is neither',
      text: 'It is often called a yellow dwarf. Its colour is white, and it is not small: “dwarf” only means it is still fusing hydrogen in its core, as most stars are for most of their lives. Astronomers call it a G-type main-sequence star, G2 V.',
      cite: ['ramirez2012'],
    },
    {
      title: 'The Sun is white, not yellow',
      text: 'Outside the atmosphere its light is white: its colour sits near the middle of what our eyes see. It looks yellow from the ground, and red at sunset, because air scatters away the blue — the same scattering that makes the sky blue.',
      cite: ['ramirez2012'],
    },
    {
      title: 'It is not burning',
      text: 'Nothing in it burns, as fire burns: there is no oxygen fire. It shines by nuclear fusion, hydrogen nuclei joined into helium in its core.',
    },
    {
      title: 'It is not an average star',
      text: 'Most stars are red dwarfs, smaller, cooler and far fainter than the Sun; of its neighbours within 33 light years (10 parsecs), most are. The Sun is brighter than the great majority of stars in the galaxy.',
      cite: ['reyle2021'],
    },
    {
      title: 'The planets do not orbit its centre',
      text: 'They orbit the Solar System’s centre of mass, and so does the Sun — watch it drift here over the years.',
      cite: ['de440'],
    },
    {
      title: 'It will not explode',
      text: 'It is far too light to end as a supernova. It will swell, shed its outer layers as a planetary nebula, and fade as a white dwarf.',
      cite: ['schroder2008'],
    },
  ],
  sources: [
    {
      key: 'iau2015',
      text: 'Prša, A., et al. 2016, Nominal values for selected solar and planetary quantities: IAU 2015 Resolution B3, AJ 152, 41',
      url: 'https://doi.org/10.3847/0004-6256/152/2/41',
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
      key: 'kuhn2012',
      text: 'Kuhn, J. R., et al. 2012, The Precise Solar Shape and Its Variability, Science 337, 1638',
      url: 'https://doi.org/10.1126/science.1223231',
    },
    {
      key: 'kopp2011',
      text: 'Kopp, G., & Lean, J. L. 2011, A new, lower value of total solar irradiance: Evidence and climate significance, Geophys. Res. Lett. 38, L01706',
      url: 'https://doi.org/10.1029/2010GL045777',
    },
    {
      key: 'snodgrass1990',
      text: 'Snodgrass, H. B., & Ulrich, R. K. 1990, Rotation of Doppler features in the solar photosphere, ApJ 351, 309',
      url: 'https://doi.org/10.1086/168467',
    },
    {
      key: 'asplund2009',
      text: 'Asplund, M., Grevesse, N., Sauval, A. J., & Scott, P. 2009, The Chemical Composition of the Sun, ARA&A 47, 481',
      url: 'https://doi.org/10.1146/annurev.astro.46.060407.145222',
    },
    {
      key: 'connelly2012',
      text: 'Connelly, J. N., et al. 2012, The Absolute Chronology and Thermal Processing of Solids in the Solar Protoplanetary Disk, Science 338, 651',
      url: 'https://doi.org/10.1126/science.1226919',
    },
    {
      key: 'bahcall2005',
      text: 'Bahcall, J. N., Serenelli, A. M., & Basu, S. 2005, New Solar Opacities, Abundances, Helioseismology, and Neutrino Fluxes, ApJ 621, L85',
      url: 'https://doi.org/10.1086/428929',
    },
    {
      key: 'mitalas1992',
      text: 'Mitalas, R., & Sills, K. R. 1992, On the photon diffusion time scale for the Sun, ApJ 401, 759',
      url: 'https://doi.org/10.1086/172103',
    },
    {
      key: 'schroder2008',
      text: 'Schröder, K.-P., & Connon Smith, R. 2008, Distant future of the Sun and Earth revisited, MNRAS 386, 155',
      url: 'https://doi.org/10.1111/j.1365-2966.2008.13022.x',
    },
    {
      key: 'nordlund2009',
      text: 'Nordlund, Å., Stein, R. F., & Asplund, M. 2009, Solar Surface Convection, Living Rev. Sol. Phys. 6, 2',
      url: 'https://doi.org/10.12942/lrsp-2009-2',
    },
    {
      key: 'ramirez2012',
      text: 'Ramírez, I., et al. 2012, The UBV(RI)C Colors of the Sun, ApJ 752, 5',
      url: 'https://doi.org/10.1088/0004-637X/752/1/5',
    },
    {
      key: 'reyle2021',
      text: 'Reylé, C., et al. 2021, The 10 parsec sample in the Gaia era, A&A 650, A201',
      url: 'https://doi.org/10.1051/0004-6361/202140985',
    },
    {
      key: 'mccomas2000',
      text: 'McComas, D. J., et al. 2000, Solar wind observations over Ulysses’ first full polar orbit, J. Geophys. Res. 105, 10419',
      url: 'https://doi.org/10.1029/1999JA000383',
    },
    {
      key: 'reid2020',
      text: 'Reid, M. J., & Brunthaler, A. 2020, The Proper Motion of Sagittarius A*. III. The Case for a Supermassive Black Hole, ApJ 892, 39',
      url: 'https://doi.org/10.3847/1538-4357/ab76cd',
    },
    {
      key: 'gravity2019',
      text: 'GRAVITY Collaboration 2019, A geometric distance measurement to the Galactic center black hole with 0.3% uncertainty, A&A 625, L10',
      url: 'https://doi.org/10.1051/0004-6361/201935656',
    },
  ],
};
