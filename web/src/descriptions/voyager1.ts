import type { Description } from './types.ts';

/**
 * Voyager 1. Every number here is from the source it cites; distances that grow every day
 * are quoted with the date they hold for, and the panel gives the live ones. What the app
 * draws of it is read off its catalog entry (generated.ts) and core/heliosphere.ts.
 */
export const VOYAGER_1: Description = {
  id: 'voyager-1',
  lead: [
    'Voyager 1 is the farthest thing people have ever made, and on 18 November 2026 it became the first to be a whole light-day from Earth: a radio message sent to it now takes a day to arrive. It carries a gold-plated record of greetings, music and pictures of Earth, a message in a bottle thrown into an ocean no one may ever cross. And in 1990, from six billion kilometres out, it turned round and photographed us — the Pale Blue Dot, everything that has ever happened to anyone on a speck less than a pixel wide.',
    'It is a NASA probe launched in September 1977, sixteen days after its twin, Voyager 2, on a faster path that soon put it in front. It has a 3.7-metre dish that always points back at Earth and a 13-metre boom that holds a magnetometer away from the rest of it. It has no solar panels: it runs on the heat of decaying plutonium, turned into electricity by three radioisotope generators.',
    'Its planetary journey took three years. At Jupiter in March 1979 it saw, for the first time anywhere but on Earth, volcanoes erupting — on the moon Io — and found that Jupiter has a faint ring. At Saturn in November 1980 it flew close past Titan, the only moon with a thick atmosphere, and found it wrapped in orange haze. That pass bent its path up out of the plane of the planets, and it has been climbing away from them ever since.',
    'In December 2004 it crossed the termination shock, where the Sun’s wind suddenly slows, and on 25 August 2012, about 122 times as far from the Sun as Earth, it passed the heliopause and became the first craft in interstellar space, among the gas between the stars. It is moving at about 17 kilometres per second away from the Sun, some 3.6 times the Earth–Sun distance every year, along a path it will keep, unbound, forever. The panel gives where it is now.',
    'It is running out of power. Its generators lose about 4 watts a year, and to keep it working the team switches instruments off one at a time: since April 2026 only two are left, listening to plasma waves and measuring the magnetic field. Some day — no date is set — the last will go quiet and it will fall silent. It will keep going regardless: in about 300 years it reaches the inner edge of the Oort cloud, the distant shell of comets around the Sun, and crossing it may take 30,000.',
  ],
  photos: [
    {
      file: 'photos/voyager-1/launch-1977.webp',
      largeFile: 'photos/voyager-1/launch-1977-large.webp',
      width: 640,
      height: 804,
      title: 'Launch, 5 September 1977',
      caption:
        'Voyager 1 leaving on its Titan IIIE–Centaur rocket from Cape Canaveral at 8:56 in the morning, local time. It went second, sixteen days after Voyager 2, on the faster path.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/KSC',
      licence: 'NASA media, not copyrighted',
      date: '1977-09-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA21747',
    },
    {
      file: 'photos/voyager-1/golden-record.webp',
      largeFile: 'photos/voyager-1/golden-record-large.webp',
      width: 640,
      height: 810,
      title: 'The Golden Record before it was mounted, 1977',
      caption:
        'Voyager 1’s record being made ready to fix to the spacecraft: a 30-centimetre gold-plated copper disc of greetings, sounds, music and pictures, with instructions on its cover for playing it. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted',
      date: '1977',
      sourceUrl: 'https://images.nasa.gov/details/PIA21741',
    },
    {
      file: 'photos/voyager-1/proof-test-model.webp',
      largeFile: 'photos/voyager-1/proof-test-model-large.webp',
      width: 640,
      height: 808,
      title: 'A Voyager on test, 12 January 1977',
      caption:
        'The Voyager Proof Test Model, a full copy built to be tested, being weighed and balanced at JPL. The stack of three white cylinders stands in for the power generators; the silvery canister above them holds the magnetometer boom, folded for launch.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/KSC',
      licence: 'NASA media, not copyrighted',
      date: '1977-01-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA21477',
    },
    {
      file: 'photos/voyager-1/pale-blue-dot.webp',
      largeFile: 'photos/voyager-1/pale-blue-dot-large.webp',
      width: 453,
      height: 614,
      title: 'The Pale Blue Dot, 14 February 1990',
      caption:
        'Earth, the tiny point in the band of light right of centre, from more than six billion kilometres: a crescent 0.12 of a pixel across. The bands are sunlight scattered in the camera, pointed close to the Sun. Made from violet, blue and green filters, so its colours are near an eye’s but not quite.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1990-02-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA00452',
    },
    {
      file: 'photos/voyager-1/family-portrait.webp',
      largeFile: 'photos/voyager-1/family-portrait-large.webp',
      width: 640,
      height: 192,
      title: 'The Family Portrait, 14 February 1990',
      caption:
        'The 60 frames Voyager 1 took looking back, the first picture of the Solar System from outside, 32° above the plane of the planets. The Sun is the bright spot in the loop of wide-angle frames; the insets are the planets through the narrow-angle camera. Mercury was too close to the Sun to show, and Mars was lost in light scattered inside the camera.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1990-02-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA00451',
    },
    {
      file: 'photos/voyager-1/jupiter-red-spot-1979.webp',
      largeFile: 'photos/voyager-1/jupiter-red-spot-1979-large.webp',
      width: 640,
      height: 606,
      title: 'The Great Red Spot, 25 February 1979',
      caption:
        'Jupiter’s great storm and the tangle of waves beside it, eight days before closest approach. A colour composite from the camera’s filters, its colours stretched, as Voyager’s planet pictures usually were.',
      colour: 'false',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1979-02-25',
      sourceUrl: 'https://images.nasa.gov/details/PIA00014',
    },
    {
      file: 'photos/voyager-1/io-loki-1979.webp',
      largeFile: 'photos/voyager-1/io-loki-1979-large.webp',
      width: 640,
      height: 751,
      title: 'A volcano erupting on Io, March 1979',
      caption:
        'The blue fan on the left edge is the plume of Loki, rising into space; the dark heart-shaped ring lower down is fallout from another, Pele. The first eruptions ever seen beyond Earth. A mosaic from about 490,000 km, its colours enhanced.',
      colour: 'false',
      credit: 'NASA/JPL/USGS',
      licence: 'NASA media, not copyrighted',
      date: '1979-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA00010',
    },
    {
      file: 'photos/voyager-1/saturn-c-ring-1980.webp',
      largeFile: 'photos/voyager-1/saturn-c-ring-1980-large.webp',
      width: 500,
      height: 500,
      title: 'Saturn seen through its rings, 9 November 1980',
      caption:
        'Saturn’s edge and the shadow of its rings, seen through the faint, nearly transparent C ring, three days before closest approach. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1980-11-09',
      sourceUrl: 'https://images.nasa.gov/details/PIA01374',
    },
  ],
  drawnHere: [
    {
      title: 'Its crossings',
      text: 'Where it crossed the termination shock and the heliopause is marked in the Heliosphere layer, at the place JPL puts it on those days. They are two of the four points of either boundary anyone has measured; the surfaces drawn through them are models.',
      cite: ['stone2005', 'stone2013', 'gurnett2013'],
    },
    {
      title: 'Its planetary journey',
      text: 'Not drawn. Its trail reaches back only as far as the app’s data do, so its flybys of Jupiter and Saturn, decades before, are not in it.',
    },
  ],
  measured: [
    {
      title: 'Launch and flybys',
      text: 'Launched on 5 September 1977 at 12:56 UT; it overtook Voyager 2 on 15 December 1977. Closest to Jupiter on 5 March 1979, 280,000 km from it; closest to Saturn on 12 November 1980, 126,000 km.',
      cite: ['voyager1'],
    },
    {
      title: 'Volcanoes on Io',
      text: 'A plume rising from Io’s edge, found in a navigation image days after the Jupiter flyby: the first active volcanism seen anywhere but Earth.',
      cite: ['morabito1979', 'smith1979'],
    },
    {
      title: 'Jupiter’s ring',
      text: 'A faint, thin ring around Jupiter, unknown until Voyager 1 photographed it edge-on.',
      cite: ['smith1979'],
    },
    {
      title: 'Titan',
      text: 'A thick atmosphere with an orange haze that hid the surface completely, seen on a close pass that also bent the craft’s path up out of the plane of the planets — the trajectory planned that way before launch.',
      cite: ['smith1981', 'kohlhase1977'],
    },
    {
      title: 'The termination shock',
      text: 'Crossed on 16 December 2004 at 94 AU from the Sun, where the solar wind drops abruptly from supersonic to subsonic speed.',
      cite: ['stone2005'],
    },
    {
      title: 'Into interstellar space',
      text: 'On 25 August 2012, at 121.6 AU, the particles from the Sun around it all but vanished and cosmic rays from the galaxy jumped. The plasma it then measured is about 0.08 electrons per cubic centimetre, the density expected between the stars.',
      cite: ['stone2013', 'gurnett2013'],
    },
    {
      title: 'The farthest',
      text: 'It passed Pioneer 10 to become the most distant human-made object on 17 February 1998, at 69.4 AU, and reached one light-day from Earth, about 25.9 billion km, on 18 November 2026.',
      cite: ['voyager1'],
    },
    {
      title: 'Its speed',
      text: '17.0 km/s relative to the Sun, as of August 2024: faster than the Sun’s gravity can ever pull back.',
      cite: ['voyager1'],
    },
    {
      title: 'The Pale Blue Dot',
      text: 'Taken on 14 February 1990, among 60 frames of the first portrait of the Solar System, from more than 6 billion km and 32° above the plane of the planets. Earth was a crescent 0.12 of a pixel wide.',
      cite: ['pbd'],
    },
    {
      title: 'The Golden Record',
      text: 'A 30-centimetre gold-plated copper disc carrying greetings in 55 languages, 35 sounds of life on Earth, 90 minutes of music and 115 images, chosen for NASA by a committee chaired by Carl Sagan.',
      cite: ['voyager1', 'sagan1978'],
    },
    {
      title: 'Its power',
      text: 'Three radioisotope generators gave about 158 watts each at launch; together they lose about 4 watts a year. The low-energy charged particle instrument was switched off on 17 April 2026, leaving two: the plasma wave instrument and the magnetometer.',
      cite: ['voyager1', 'voyagerpower'],
    },
  ],
  estimated: [
    {
      title: 'How much longer it works',
      text: 'The team expects the April 2026 shutdown to buy about a year before another is needed. When the last instrument or the radio goes, it falls silent; no date is set.',
      cite: ['voyagerpower'],
    },
    {
      title: 'The Oort cloud',
      text: 'About 300 years to reach its inner edge, which may begin around 1,000 AU from the Sun, and perhaps 30,000 to pass beyond it. The cloud has never been seen directly — it is inferred from the orbits of long-period comets — so both figures depend on where its edges are taken to be.',
      cite: ['pia17046'],
    },
  ],
  missing: [
    {
      title: 'Its path before the data',
      text: 'Not drawn: the trail starts where the app’s data start, years after its last planet. Its launch, Jupiter and Saturn are outside them.',
    },
    {
      title: 'How it is pointed',
      text: 'Drawn with its dish on Earth, which is how it flies; small turns for calibration and the wobble of its thrusters are not in any data here.',
    },
    {
      title: 'Its own temperature and power',
      text: 'Not shown: how warm it is and how many watts are left are in the team’s telemetry, which the app does not read.',
    },
  ],
  misconceptions: [
    {
      title: 'It has not left the Solar System — not in every sense',
      text: 'It has left the heliosphere, the bubble the Sun’s wind blows, and is in interstellar space. But the Sun’s gravity still rules far beyond it: the Oort cloud of comets bound to the Sun lies hundreds of years ahead, and crossing it may take 30,000.',
      cite: ['pia17046', 'stone2013'],
    },
    {
      title: 'It is not the fastest craft',
      text: 'It is the fastest heading out of the Solar System, at about 17 km/s, but not the fastest ever built: Parker Solar Probe, falling toward the Sun, reaches about 190 km/s.',
      cite: ['voyager1', 'parker2026'],
    },
    {
      title: 'It did not take a picture of the whole Solar System at once',
      text: 'The Family Portrait is 60 frames pieced together; most planets are single points in narrow-angle shots, enlarged in the insets, and Mercury and Mars do not appear at all.',
      cite: ['pbd'],
    },
  ],
  sources: [
    {
      key: 'voyager1',
      text: 'NASA Science, Voyager 1 (mission page: launch, flybys, distance and speed, the Golden Record, the light-day milestone)',
      url: 'https://science.nasa.gov/mission/voyager/voyager-1/',
    },
    {
      key: 'voyagerpower',
      text: 'NASA Science 2026, NASA Shuts Off Instrument on Voyager 1 to Keep Spacecraft Operating (Voyager blog, 17 April 2026)',
      url: 'https://science.nasa.gov/blogs/voyager/2026/04/17/nasa-shuts-off-instrument-on-voyager-1-to-keep-spacecraft-operating/',
    },
    {
      key: 'kohlhase1977',
      text: 'Kohlhase, C. E., & Penzo, P. A. 1977, Voyager mission description, Space Sci. Rev. 21, 77',
      url: 'https://doi.org/10.1007/BF00200846',
    },
    {
      key: 'smith1979',
      text: 'Smith, B. A., et al. 1979, The Jupiter System Through the Eyes of Voyager 1, Science 204, 951',
      url: 'https://doi.org/10.1126/science.204.4396.951',
    },
    {
      key: 'morabito1979',
      text: 'Morabito, L. A., Synnott, S. P., Kupferman, P. N., & Collins, S. A. 1979, Discovery of Currently Active Extraterrestrial Volcanism, Science 204, 972',
      url: 'https://doi.org/10.1126/science.204.4396.972',
    },
    {
      key: 'smith1981',
      text: 'Smith, B. A., et al. 1981, Encounter with Saturn: Voyager 1 Imaging Science Results, Science 212, 163',
      url: 'https://doi.org/10.1126/science.212.4491.163',
    },
    {
      key: 'stone2005',
      text: 'Stone, E. C., et al. 2005, Voyager 1 Explores the Termination Shock Region and the Heliosheath Beyond, Science 309, 2017',
      url: 'https://doi.org/10.1126/science.1117684',
    },
    {
      key: 'stone2013',
      text: 'Stone, E. C., et al. 2013, Voyager 1 Observes Low-Energy Galactic Cosmic Rays in a Region Depleted of Heliospheric Ions, Science 341, 150',
      url: 'https://doi.org/10.1126/science.1236408',
    },
    {
      key: 'gurnett2013',
      text: 'Gurnett, D. A., Kurth, W. S., Burlaga, L. F., & Ness, N. F. 2013, In Situ Observations of Interstellar Plasma with Voyager 1, Science 341, 1489',
      url: 'https://doi.org/10.1126/science.1241681',
    },
    {
      key: 'pbd',
      text: 'NASA/JPL, Solar System Portrait — Earth as Pale Blue Dot (PIA00452) and the 60-frame mosaic (PIA00451), Photojournal',
      url: 'https://images.nasa.gov/details/PIA00452',
    },
    {
      key: 'sagan1978',
      text: 'Sagan, C., Drake, F. D., Druyan, A., Ferris, T., Lomberg, J., & Salzman Sagan, L. 1978, Murmurs of Earth: The Voyager Interstellar Record (Random House)',
    },
    {
      key: 'pia17046',
      text: 'NASA/JPL-Caltech 2013, Voyager Goes Interstellar (PIA17046): where the Solar System ends, and the Oort cloud',
      url: 'https://science.nasa.gov/photojournal/voyager-goes-interstellar-artist-concept',
    },
    {
      key: 'parker2026',
      text: 'NASA Science 2026, NASA’s Parker Solar Probe Makes 27th Swing Around the Sun (Parker Solar Probe blog, 16 March 2026)',
      url: 'https://science.nasa.gov/blogs/parker-solar-probe/2026/03/16/nasas-parker-solar-probe-makes-27th-swing-around-the-sun',
    },
  ],
};
