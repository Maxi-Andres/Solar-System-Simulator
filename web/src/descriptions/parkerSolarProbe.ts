import type { Description } from './types.ts';

/**
 * Parker Solar Probe. Every number here is from the source it cites; distances that change
 * every day are quoted with the date they hold for, and the panel gives the live ones. What
 * the app draws of it is read off its catalog entry (generated.ts).
 */
export const PARKER_SOLAR_PROBE: Description = {
  id: 'parker-solar-probe',
  lead: [
    'For all of history the Sun has been something we could only look at from far away. Parker Solar Probe is the first thing people have sent into it: since 2021 it has flown through the corona, the Sun’s outer atmosphere, again and again, and on Christmas Eve 2024 it passed 6.2 million kilometres from the visible surface at about 690,000 kilometres an hour — the fastest anything made by people has ever moved. It carries the name of Eugene Parker, who worked out in 1958 that a wind must blow from the Sun, and who lived to watch it launch to measure that wind at its source.',
    'It is a NASA probe of 685 kilograms, built by the Johns Hopkins Applied Physics Laboratory and launched on 12 August 2018 on a Delta IV Heavy rocket. It is small, about three metres tall, and almost all of it hides in the shadow of a heat shield 11.43 centimetres thick, made of carbon composite, whose sunward face can reach nearly 1,400 °C. Its instruments measure the particles and magnetic fields around it and photograph the corona and the solar wind beside it.',
    'Getting there is the hard part. Earth carries everything launched from it round the Sun at nearly 30 kilometres per second, and to fall toward the Sun a craft has to lose that sideways speed. Parker did it with seven flybys of Venus, each shrinking its orbit, until its closest passes reached under 10 solar radii from the Sun’s centre. Its orbit now takes about 88 days; at the far end it swings out to near Venus’s orbit, and at the near end it plunges through the corona.',
    'It has found that the solar wind near the Sun is full of “switchbacks”, sudden kinks where the magnetic field folds back on itself; that on 28 April 2021 it crossed into the region where the Sun’s magnetic field, not the outflowing wind, is in charge — the first touch of the Sun — and that the dust between the planets thins out close to the Sun. Its primary mission ended in 2025, and it keeps flying the same orbit while NASA decides what comes next. The panel gives where it is now.',
  ],
  photos: [
    {
      file: 'photos/parker-solar-probe/heat-shield-2018.webp',
      largeFile: 'photos/parker-solar-probe/heat-shield-2018-large.webp',
      width: 640,
      height: 961,
      title: 'Fitting the heat shield, 27 June 2018',
      caption:
        'The shield, the dark disc in the blue frame, lowered onto the spacecraft by crane at the Astrotech facility near Kennedy Space Center. Everything it protects has to fit in its shadow.',
      colour: 'true',
      credit: 'NASA/Glenn Benson',
      licence: 'NASA media, not copyrighted',
      date: '2018-06-27',
      sourceUrl: 'https://images.nasa.gov/details/KSC-20180627-PH_GEB01_0043',
    },
    {
      file: 'photos/parker-solar-probe/launch-2018.webp',
      largeFile: 'photos/parker-solar-probe/launch-2018-large.webp',
      width: 640,
      height: 595,
      title: 'Launch, 12 August 2018',
      caption:
        'A Delta IV Heavy lifting off from Cape Canaveral at 3:31 in the morning, local time, its three cores burning together.',
      colour: 'true',
      credit: 'NASA/Bill Ingalls',
      licence: 'NASA media, not copyrighted',
      date: '2018-08-12',
      sourceUrl: 'https://images.nasa.gov/details/NHQ201808120013',
    },
    {
      file: 'photos/parker-solar-probe/eugene-parker-2018.webp',
      largeFile: 'photos/parker-solar-probe/eugene-parker-2018-large.webp',
      width: 640,
      height: 960,
      title: 'Eugene Parker watching it go, 12 August 2018',
      caption:
        'Eugene Parker, seated, watches the launch of the first NASA mission named after a living person; standing behind him is Nicky Fox, then the mission’s project scientist.',
      colour: 'true',
      credit: 'NASA/Glenn Benson',
      licence: 'NASA media, not copyrighted',
      date: '2018-08-12',
      sourceUrl: 'https://images.nasa.gov/details/KSC-20180812-PH_GEB01_0045',
    },
    {
      file: 'photos/parker-solar-probe/wispr-corona-2024.webp',
      largeFile: 'photos/parker-solar-probe/wispr-corona-2024-large.webp',
      width: 640,
      height: 683,
      title: 'Inside the corona, 25 December 2024',
      caption:
        'From WISPR, its camera looking out beside the heat shield, the day after its closest pass ever: streams of the solar wind flowing outward, the Sun itself off the frame to the left. The closest images of the Sun’s atmosphere ever taken. Black and white.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins APL/Naval Research Lab',
      licence: 'NASA media, not copyrighted',
      date: '2024-12-25',
      sourceUrl: 'https://svs.gsfc.nasa.gov/14865/',
    },
    {
      file: 'photos/parker-solar-probe/wispr-streamers-2021.webp',
      largeFile: 'photos/parker-solar-probe/wispr-streamers-2021-large.webp',
      width: 640,
      height: 461,
      title: 'Flying past coronal streamers, August 2021',
      caption:
        'Six WISPR frames from its ninth close pass: bright streamers in the corona, seen first from below and then from above as the probe flew by them — a view no one had had before. Black and white.',
      colour: 'true',
      credit: 'NASA/Johns Hopkins APL/Naval Research Laboratory',
      licence: 'NASA media, not copyrighted',
      date: '2021-08',
      sourceUrl: 'https://svs.gsfc.nasa.gov/14055/',
    },
    {
      file: 'photos/parker-solar-probe/wispr-venus-2020.webp',
      largeFile: 'photos/parker-solar-probe/wispr-venus-2020-large.webp',
      width: 640,
      height: 738,
      title: 'The night side of Venus, July 2020',
      caption:
        'From its third Venus flyby. The glow is the hot surface showing through the clouds in red and near-infrared light; the dark area is Aphrodite Terra, high ground that is cooler. The bright rim may be nightglow, from oxygen high in its atmosphere. Black and white.',
      colour: 'true',
      credit: 'NASA/APL/NRL',
      licence: 'NASA media, not copyrighted',
      date: '2020-07',
      sourceUrl: 'https://svs.gsfc.nasa.gov/14095/',
    },
  ],
  drawnHere: [
    {
      title: 'Its loops',
      text: 'Its trail shows one turn of its current orbit, brightest where it has just been, so the fast plunge past the Sun and the slow arc out toward Venus’s orbit are told apart. It needs more samples than any other craft here — about 93,000 over the data’s window — because at its closest it covers some 190 km every second.',
    },
  ],
  measured: [
    {
      title: 'The wind it is named for',
      text: 'In 1958 Eugene Parker showed that the Sun’s hot corona cannot stay bound to it and must stream outward as a supersonic wind, carrying the Sun’s magnetic field into a spiral. The mission bears his name; he died on 15 March 2022, aged 94.',
      cite: ['parker1958', 'parker'],
    },
    {
      title: 'Launch',
      text: 'On 12 August 2018 at 07:31 UT, on a Delta IV Heavy; 685 kg at launch.',
      cite: ['parker'],
    },
    {
      title: 'Its record pass',
      text: 'On 24 December 2024, 6.2 million km (3.8 million miles) from the Sun’s surface at about 687,000 km/h (430,000 mph), about 191 km/s — faster than anything made by people has ever moved — and matched on every close pass since, the 27th on 11 March 2026.',
      cite: ['parker2024', 'parker2026'],
    },
    {
      title: 'The heat shield',
      text: 'A carbon-composite shield 11.43 cm thick, made to take nearly 1,377 °C on its sunward face.',
      cite: ['parker'],
    },
    {
      title: 'The first touch',
      text: 'On 28 April 2021 it crossed below the Alfvén critical surface, about 18.8 solar radii from the Sun’s centre: the boundary inside which the Sun’s magnetic field, not the outflowing wind, controls the plasma. That is where the corona is taken to end, and it is the sense in which it touched the Sun.',
      cite: ['kasper2021'],
    },
    {
      title: 'Switchbacks',
      text: 'On its first passes it found the slow solar wind full of sudden reversals of the magnetic field, with spikes in the wind’s speed, and showed that wind coming from a small coronal hole near the Sun’s equator.',
      cite: ['kasper2019', 'bale2019'],
    },
    {
      title: 'Thinning dust',
      text: 'Its camera saw the faint glow of the dust between the planets dimming as it looked closer in toward the Sun — the first sign of the dust-free zone around a star, long predicted.',
      cite: ['howard2019'],
    },
    {
      title: 'Venus’s surface',
      text: 'Flying past Venus’s night side, the same camera saw the hot surface glowing through the clouds in visible and near-infrared light: the first visible-light images of Venus’s surface taken from space.',
      cite: ['wood2022'],
    },
  ],
  estimated: [
    {
      title: 'The plan that got it there',
      text: 'Seven Venus flybys over almost seven years, to bring its closest passes down to 9.86 solar radii from the Sun’s centre; the passes it has flown match the design.',
      cite: ['fox2016', 'parker2026'],
    },
    {
      title: 'What comes next',
      text: 'Its baseline mission plan ended with the pass of 19 June 2025; it stays in this orbit observing as the solar cycle declines, and NASA is reviewing what it does from late 2026.',
      cite: ['parker2025', 'parker2026'],
    },
  ],
  missing: [
    {
      title: 'The corona it flies through',
      text: 'Not drawn: the corona is a million times fainter than the Sun’s disc, invisible at any exposure that shows the planets.',
    },
    {
      title: 'Its exact attitude',
      text: 'Drawn with its heat shield square to the Sun, as it flies at its closest; small tilts it makes farther out are in no data here.',
    },
  ],
  misconceptions: [
    {
      title: 'It did not land on, or touch, a surface',
      text: 'The Sun has no solid surface. “Touching the Sun” means flying through the corona, below the boundary where the Sun’s magnetic field still holds the gas.',
      cite: ['kasper2021'],
    },
    {
      title: 'Falling into the Sun is the hard way',
      text: 'It takes more energy to reach the Sun than to leave the Solar System: a craft from Earth starts with Earth’s 30 km/s round the Sun and must lose it. Hence the big rocket and the seven Venus flybys.',
      cite: ['fox2016'],
    },
    {
      title: 'It is not the fastest because of its engines',
      text: 'Its record speed comes from falling toward the Sun, as a comet speeds up near it; its own thrusters only steer.',
      cite: ['fox2016', 'parker2026'],
    },
    {
      title: 'The corona’s million degrees do not melt it',
      text: 'The corona is that hot but extremely thin, so it carries little heat; what the shield has to stop is sunlight, nearly 500 times as intense at its closest as at Earth.',
      cite: ['fox2016'],
    },
  ],
  sources: [
    {
      key: 'parker',
      text: 'NASA Science, Parker Solar Probe (mission page: launch, mass, heat shield, Eugene Parker)',
      url: 'https://science.nasa.gov/mission/parker-solar-probe/',
    },
    {
      key: 'parker2026',
      text: 'NASA Science 2026, NASA’s Parker Solar Probe Makes 27th Swing Around the Sun (Parker Solar Probe blog, 16 March 2026)',
      url: 'https://science.nasa.gov/blogs/parker-solar-probe/2026/03/16/nasas-parker-solar-probe-makes-27th-swing-around-the-sun/',
    },
    {
      key: 'parker2024',
      text: 'NASA Science 2024, NASA’s Parker Solar Probe Makes History With Closest Pass to Sun (27 December 2024)',
      url: 'https://science.nasa.gov/science-research/heliophysics/nasas-parker-solar-probe-makes-history-with-closest-pass-to-sun/',
    },
    {
      key: 'parker2025',
      text: 'NASA Science 2025, Parker Solar Probe Completes 24th Close Approach to Sun (Parker Solar Probe blog, 23 June 2025)',
      url: 'https://science.nasa.gov/blogs/parker-solar-probe/2025/06/23/parker-solar-probe-completes-24th-close-approach-to-sun',
    },
    {
      key: 'fox2016',
      text: 'Fox, N. J., et al. 2016, The Solar Probe Plus Mission: Humanity’s First Visit to Our Star, Space Sci. Rev. 204, 7',
      url: 'https://doi.org/10.1007/s11214-015-0211-6',
    },
    {
      key: 'parker1958',
      text: 'Parker, E. N. 1958, Dynamics of the Interplanetary Gas and Magnetic Fields, ApJ 128, 664',
      url: 'https://doi.org/10.1086/146579',
    },
    {
      key: 'kasper2021',
      text: 'Kasper, J. C., et al. 2021, Parker Solar Probe Enters the Magnetically Dominated Solar Corona, Phys. Rev. Lett. 127, 255101',
      url: 'https://doi.org/10.1103/PhysRevLett.127.255101',
    },
    {
      key: 'kasper2019',
      text: 'Kasper, J. C., et al. 2019, Alfvénic velocity spikes and rotational flows in the near-Sun solar wind, Nature 576, 228',
      url: 'https://doi.org/10.1038/s41586-019-1813-z',
    },
    {
      key: 'bale2019',
      text: 'Bale, S. D., et al. 2019, Highly structured slow solar wind emerging from an equatorial coronal hole, Nature 576, 237',
      url: 'https://doi.org/10.1038/s41586-019-1818-7',
    },
    {
      key: 'howard2019',
      text: 'Howard, R. A., et al. 2019, Near-Sun observations of an F-corona decrease and K-corona fine structure, Nature 576, 232',
      url: 'https://doi.org/10.1038/s41586-019-1807-x',
    },
    {
      key: 'wood2022',
      text: 'Wood, B. E., et al. 2022, Parker Solar Probe Imaging of the Night Side of Venus, Geophys. Res. Lett. 49, e2021GL096302',
      url: 'https://doi.org/10.1029/2021GL096302',
    },
  ],
};
