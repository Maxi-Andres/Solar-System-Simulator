import type { Description } from './types.ts';

/**
 * Saturn. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a light time), the point says so. Where a figure is a model's rather than a
 * measurement, it sits under "estimated" and says which.
 */
export const SATURN: Description = {
  id: 'saturn',
  lead: [
    'Saturn is the second-largest planet: nine and a half Earths across, 95 times Earth’s mass. Like Jupiter it is a giant of hydrogen and helium with no solid surface, but it is far less dense — the least dense of all the planets, less dense than water. It spins in about ten and a half hours, and is the most flattened planet: almost a tenth shorter from pole to pole than across.',
    'Its rings are what make it famous. The main rings span 273,000 kilometres, more than two-thirds of the way from Earth to the Moon, yet they are only tens of metres thick. They are not solid: they are countless pieces of almost pure water ice, from grains of dust to boulders the size of houses, each on its own orbit. All together they weigh less than half as much as Saturn’s small moon Mimas. How old they are is still argued over: perhaps far younger than Saturn, perhaps as old.',
    'Its pale bands hide fast weather. Winds at its equator reach 400 metres per second. Around its north pole a jet stream runs in a near-perfect hexagon, wider than Earth, and every few decades a great white storm breaks out and wraps around the whole planet, as one did in 2010 and 2011.',
    'It has hundreds of moons, and the app draws nearly three hundred. Titan, the largest, has a thicker atmosphere than Earth’s, and in 2005 the Huygens probe landed on it. Enceladus, a small icy moon, sprays jets of water ice into space from cracks at its south pole. The Cassini spacecraft orbited Saturn for thirteen years and ended by diving into it in 2017.',
    'It orbits the Sun at 1.43 billion kilometres, 9.6 times as far as Earth, where sunlight is a ninety-second of ours and takes 80 minutes to arrive. A year there lasts 29.4 of ours. Its axis is tilted 26.7°, so over each orbit the rings open wide toward the Sun and toward us, then close to a thin line at its equinoxes, twice a Saturn year.',
  ],
  photos: [
    {
      file: 'photos/saturn/day-the-earth-smiled-2013.webp',
      largeFile: 'photos/saturn/day-the-earth-smiled-2013-large.webp',
      width: 640,
      height: 249,
      title: 'The Day the Earth Smiled, 19 July 2013',
      caption:
        'Cassini in Saturn’s shadow, looking back toward the Sun: 141 wide-angle images in red, green and blue, combined in natural colour. Backlit, the dusty outer rings glow — the faint E ring is the wide blue halo, fed by Enceladus. Earth is a pale dot below the rings at lower right, clearest in the larger view; seven moons are in the frame too.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/SSI',
      licence: 'NASA media, not copyrighted',
      date: '2013-07-19',
      sourceUrl: 'https://images.nasa.gov/details/PIA17172',
    },
    {
      file: 'photos/saturn/cassini-2004.webp',
      largeFile: 'photos/saturn/cassini-2004-large.webp',
      width: 640,
      height: 327,
      title: 'Saturn from Cassini, October 2004',
      caption:
        'Cassini’s first great global portrait, three months after arriving: a mosaic of 126 images in natural colour. Saturn’s shadow falls across the rings at left; the north, in winter then, is the blue of a clear upper atmosphere.',
      colour: 'true',
      credit: 'NASA/JPL/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2004-10',
      sourceUrl: 'https://images.nasa.gov/details/PIA06193',
    },
    {
      file: 'photos/saturn/ring-shadows-2007.webp',
      largeFile: 'photos/saturn/ring-shadows-2007-large.webp',
      width: 640,
      height: 224,
      title: 'Ring shadows on Saturn, 6 December 2007',
      caption:
        'The rings cast dark bands across the northern clouds, and near the pole the moon Tethys casts an elongated shadow; Tethys, Dione and Enceladus are the bright dots. A natural-colour mosaic in red, green and blue, from 1.7 million kilometres.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2007-12-06',
      sourceUrl: 'https://images.nasa.gov/details/PIA18320',
    },
    {
      file: 'photos/saturn/hexagon-2013-2017.webp',
      largeFile: 'photos/saturn/hexagon-2013-2017-large.webp',
      width: 640,
      height: 320,
      title: 'The hexagon, June 2013 and April 2017',
      caption:
        'The six-sided jet stream around the north pole, four years apart, in natural colour. In 2013 its inside was blue; by 2017, as summer approached, sunlight had filled it with a yellowish smog, leaving only the eye of the polar vortex blue.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Space Science Institute/Hampton University',
      licence: 'NASA media, not copyrighted',
      date: '2013–2017',
      sourceUrl: 'https://images.nasa.gov/details/PIA21611',
    },
    {
      file: 'photos/saturn/ringshine-2017.webp',
      largeFile: 'photos/saturn/ringshine-2017-large.webp',
      width: 640,
      height: 223,
      title: 'The night side by ringshine, 14 September 2017',
      caption:
        'One of Cassini’s very last mosaics, the day before it dived into Saturn: the night side, lit only by sunlight reflected from the rings, over the place the spacecraft would enter the atmosphere. Red, green and blue filters, near natural colour.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2017-09-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA21903',
    },
    {
      file: 'photos/saturn/rings-infrared-vims.webp',
      largeFile: 'photos/saturn/rings-infrared-vims-large.webp',
      width: 640,
      height: 477,
      title: 'What the rings are made of',
      caption:
        'The strip is an infrared map of the A, B and C rings by Cassini’s spectrometer: blue-green where the ice is purest or its grains largest, red where there is more non-icy material or the grains are smaller. Laid over a natural-colour mosaic; the strip’s colours are a code, not light.',
      colour: 'false',
      credit:
        'NASA/JPL-Caltech/Space Science Institute/G. Ugarkovic (ISS); NASA/JPL-Caltech/University of Arizona/CNRS/LPG-Nantes (VIMS)',
      licence: 'NASA media, not copyrighted',
      date: '2019 (released)',
      sourceUrl: 'https://images.nasa.gov/details/PIA23170',
    },
  ],
  drawnHere: [
    {
      title: 'The flattest planet, as it is',
      text: 'Drawn 9.8% shorter pole to pole than across. The map is wrapped on a sphere and then flattened, so a feature can sit up to about 3° from its true latitude at mid-latitudes, worked out here from the flattening — more here than on any other body.',
      cite: ['nssdcSaturn'],
    },
    {
      title: 'The rings, at their real radii, in the real plane',
      text: 'The rings lie in Saturn’s equatorial plane, turned by the IAU’s pole, so they open and close as Saturn goes round the Sun. Their map is Solar System Scope’s radial strip, whose radii are not published: they were fitted here against the surveyed edges of the C ring, the B ring, the Cassini Division and the A ring, giving 69,942 to 141,880 km. The fit is good to about 1,400 km — wider than the 325-km Encke Gap it draws. Every division is present and roughly placed; none is at its surveyed radius.',
      cite: ['archinal2018', 'nssdcSaturnRings'],
    },
    {
      title: 'Their brightness is a choice',
      text: 'The rings are drawn at one constant brightness, whatever the angles of the Sun and the camera — the one place in the app knowingly not measured. A physical model of how a slab of ice particles scatters light was built and corrected four times, and still brightened 3.6 times too much seen edge-on, where reference images do not brighten at all. The bands come from the map’s opacity; their colour is a neutral grey, matched to NASA’s own render.',
    },
    {
      title: 'Shadows both ways',
      text: 'Saturn casts its real shadow across the rings from its flattened outline, and the rings cast theirs back on Saturn, sweeping across it over its year and changing hemispheres at equinox. How much light the rings block is the map’s opacity corrected toward the published optical depths of the C, B and A rings and the Cassini Division, and how dark the deepest shadow gets is calibrated against NASA’s render rather than derived.',
      cite: ['nssdcSaturnRings'],
    },
    {
      title: 'An illustrative map',
      text: 'The planet’s map is Solar System Scope’s, a composite from NASA imagery with colour added. It turns as one rigid shell at the IAU’s rate of 10.656 hours.',
      cite: ['archinal2018'],
    },
    {
      title: 'Its moons',
      text: 'Mimas, Enceladus, Tethys, Dione, Rhea, Titan and Iapetus on JPL’s own ephemerides, each the real shape and mapped from Cassini’s images — grey, as they were photographed through a clear filter, and Titan’s surface as Cassini saw it through the haze, in infrared. The rest of the moons in JPL’s tables, nearly three hundred, are markers of flat dark grey, 128 of them announced in 2025 alone: of most, nothing is known but an orbit.',
      cite: ['de440'],
    },
    {
      title: 'Cassini',
      text: 'On JPL’s trajectory from the start of the app’s window, ten years before its data was built, to its last plunge into Saturn on 15 September 2017.',
      cite: ['de440', 'spilker2019'],
    },
  ],
  measured: [
    {
      title: 'Size and shape',
      text: 'Radius 60,268 km at the equator and 54,364 km at the poles, at the 1-bar level: a flattening of 0.098, the largest of any planet. That is 9.4 Earths across and 763 by volume, worked out here from the two fact sheets.',
      cite: ['nssdcSaturn', 'nssdcEarth'],
    },
    {
      title: 'Mass and density',
      text: 'GM = 37.931 million km³/s², from the orbits of its moons and of Cassini; 5.683 × 10²⁶ kg, 95 times Earth’s. Mean density 0.687 g/cm³ — the lowest of the planets, and below water’s 1.',
      cite: ['nssdcSaturn'],
    },
    {
      title: 'What it is made of',
      text: 'Its air above the clouds is 96.3% hydrogen molecules and 3.25% helium by volume, with traces of methane and ammonia; its clouds are ammonia ice above, water ice deeper.',
      cite: ['nssdcSaturn'],
    },
    {
      title: 'Its winds',
      text: 'Up to 400 m/s at latitudes under 30°, up to 150 m/s above. The great storm of 2010–2011 showed the jets run deep: its clouds were carried by winds below the visible deck.',
      cite: ['nssdcSaturn', 'sanchezLavega2011'],
    },
    {
      title: 'The hexagon',
      text: 'A jet stream around the north pole with six nearly straight sides, found in Voyager’s images and still there when Cassini arrived a quarter of a century later; its colour changes with the seasons.',
      cite: ['godfrey1988', 'spilker2019'],
    },
    {
      title: 'The rings’ layout',
      text: 'The C ring from 74,658 km, the B ring from 91,975 to 117,507 km, the Cassini Division, and the A ring from 122,340 to 136,780 km; inside them the faint D ring, outside them the narrow F ring and the faint G and E rings, the E ring reaching 480,000 km. The main rings are 5 to 30 metres thick.',
      cite: ['nssdcSaturnRings'],
    },
    {
      title: 'The rings’ mass',
      text: 'Weighed by Cassini on its last orbits, flying between the rings and the planet: 1.54 × 10¹⁹ kg, about 0.41 of Mimas’s mass.',
      cite: ['iess2019'],
    },
    {
      title: 'The rings’ makeup',
      text: 'Almost all water ice, with a few per cent or less of rocky and organic material that darkens and reddens them, more in the C ring and the Cassini Division than in the A and B rings.',
      cite: ['cuzzi2010'],
    },
    {
      title: 'Spokes',
      text: 'Dark or bright radial streaks of charged dust that come and go across the B ring with the seasons: none were seen from October 1998 until Cassini found them again in September 2005.',
      cite: ['mitchell2006'],
    },
    {
      title: 'Titan and Enceladus',
      text: 'Huygens descended through Titan’s nitrogen atmosphere and landed on 14 January 2005, its surface pressure about one and a half times Earth’s. Cassini found Enceladus’s south pole venting jets of water ice from warm fractures.',
      cite: ['lebreton2005', 'porco2006'],
    },
    {
      title: 'Its orbit',
      text: 'Semi-major axis 1,432.0 million km, eccentricity 0.0520: perihelion 1,357.6 and aphelion 1,506.5 million km. One orbit in 10,755.7 days — 29.4 years — at a mean 9.67 km/s, its axis tilted 26.73°. Light takes 80 minutes from the Sun, worked out here.',
      cite: ['nssdcSaturn'],
    },
  ],
  estimated: [
    {
      title: 'How long its day is',
      text: 'Not known to the minute. Its magnetic field is lined up with its spin axis, so it gives no wobble to time the interior by, and its radio period changed while Cassini watched. The IAU’s 10.656 hours, from Voyager’s radio measurements, is what the app turns it by; waves in the rings set off by Saturn’s interior give 10 hours 33 minutes 38 seconds, uncertain by a minute or two — and in a day the two drift about 7° apart, worked out here.',
      cite: ['archinal2018', 'nssdcSaturn', 'mankovich2019'],
    },
    {
      title: 'Its core',
      text: 'The same ring waves, with Cassini’s gravity data, say the core is not a compact ball: about 17 Earth masses of ice and rock mixed with hydrogen and helium, grading outward through the inner 60% of Saturn’s radius.',
      cite: ['mankovichFuller2021'],
    },
    {
      title: 'How old the rings are',
      text: 'Their ice is so clean that, darkened at the rate meteoroid dust falls in, they would be only 10 to 100 million years old. A 2025 study finds that most of that dust is vaporised and lost on impact rather than mixed in, so the rings could be as old as Saturn. Not settled.',
      cite: ['iess2019', 'hyodo2025'],
    },
  ],
  missing: [
    {
      title: 'The light of the rings',
      text: 'Real rings change brightness with the angles of the Sun and the viewer, and their unlit face shows the sparse rings bright and the dense B ring dark. Drawn here at one constant brightness, they do neither; getting it right needs a measured phase curve for ring particles and a full multiple-scattering solution.',
    },
    {
      title: 'Fine ring structure',
      text: 'Thousands of ringlets, waves and gaps narrower than the map’s 1,400-km precision, the spokes, and the dusty D, G and E rings are not drawn.',
      cite: ['nssdcSaturnRings', 'mitchell2006'],
    },
    {
      title: 'Its weather and seasons',
      text: 'The map is one fixed picture: no hexagon changing colour, no storms, no blue northern winter. The real bands blow at different speeds and none of them turns at exactly the map’s rate.',
      cite: ['godfrey1988', 'sanchezLavega2011'],
    },
    {
      title: 'Moons’ shadows',
      text: 'A moon’s shadow on Saturn or on the rings, as Tethys’s in the photograph above, is not drawn: only Saturn and its rings shadow each other here.',
    },
    {
      title: 'Its magnetosphere and auroras',
      text: 'Not drawn: the app models these only for Earth.',
    },
  ],
  misconceptions: [
    {
      title: '“It would float in water”',
      text: 'Its average density, 0.687 g/cm³, is below water’s, which is where the saying comes from. But it is an average: Saturn has no surface to float on, its core is many times denser than water, and its gas would mix into any ocean rather than ride on it — never mind that no ocean could be big enough.',
      cite: ['nssdcSaturn', 'mankovichFuller2021'],
    },
    {
      title: 'The rings are not solid, or thick',
      text: 'They are separate pieces of ice, each orbiting on its own, and the main rings are at most about 30 metres thick across 273,000 km. Shrunk to a kilometre across, they would be no thicker than a sheet of paper — worked out here from those figures.',
      cite: ['nssdcSaturnRings', 'cuzzi2010'],
    },
    {
      title: 'The rings did not vanish in 2025',
      text: 'Headlines said they would disappear. In March 2025 Earth passed through their plane, so we saw them edge-on, a few tens of metres thick, too thin to see from here; they have been opening again since. It happens twice in every 29.4-year orbit, as the IAU’s pole and JPL’s orbits put it.',
      cite: ['archinal2018', 'de440', 'nssdcSaturnRings'],
    },
    {
      title: 'Not the only ringed planet',
      text: 'Jupiter, Uranus and Neptune have rings too: Saturn’s are just the only bright ones, because they are clean ice where the others are dark dust and rock.',
      cite: ['cuzzi2010'],
    },
    {
      title: 'Its day is not known precisely',
      text: 'Textbooks give 10 hours 39 minutes, from Voyager’s radio measurements; the ring waves say 10 hours 33 minutes. Six minutes is a large uncertainty for a planet’s day.',
      cite: ['nssdcSaturn', 'mankovich2019'],
    },
  ],
  sources: [
    {
      key: 'nssdcSaturn',
      text: 'Williams, D. R., Saturn Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html',
    },
    {
      key: 'nssdcSaturnRings',
      text: 'Williams, D. R., Saturnian Rings Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html',
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
      key: 'iess2019',
      text: 'Iess, L., et al. 2019, Measurement and implications of Saturn’s gravity field and ring mass, Science 364, eaat2965',
      url: 'https://doi.org/10.1126/science.aat2965',
    },
    {
      key: 'hyodo2025',
      text: 'Hyodo, R., Genda, H., & Madeira, G. 2025, Pollution resistance of Saturn’s ring particles during micrometeoroid impact, Nat. Geosci. 18, 44',
      url: 'https://doi.org/10.1038/s41561-024-01598-9',
    },
    {
      key: 'cuzzi2010',
      text: 'Cuzzi, J. N., et al. 2010, An Evolving View of Saturn’s Dynamic Rings, Science 327, 1470',
      url: 'https://doi.org/10.1126/science.1179118',
    },
    {
      key: 'mitchell2006',
      text: 'Mitchell, C. J., Horányi, M., Havnes, O., & Porco, C. C. 2006, Saturn’s Spokes: Lost and Found, Science 311, 1587',
      url: 'https://doi.org/10.1126/science.1123783',
    },
    {
      key: 'godfrey1988',
      text: 'Godfrey, D. A. 1988, A hexagonal feature around Saturn’s north pole, Icarus 76, 335',
      url: 'https://doi.org/10.1016/0019-1035(88)90075-9',
    },
    {
      key: 'sanchezLavega2011',
      text: 'Sánchez-Lavega, A., et al. 2011, Deep winds beneath Saturn’s upper clouds from a seasonal long-lived planetary-scale storm, Nature 475, 71',
      url: 'https://doi.org/10.1038/nature10203',
    },
    {
      key: 'mankovich2019',
      text: 'Mankovich, C., Marley, M. S., Fortney, J. J., & Movshovitz, N. 2019, Cassini Ring Seismology as a Probe of Saturn’s Interior. I. Rigid Rotation, ApJ 871, 1',
      url: 'https://doi.org/10.3847/1538-4357/aaf798',
    },
    {
      key: 'mankovichFuller2021',
      text: 'Mankovich, C., & Fuller, J. 2021, A diffuse core in Saturn revealed by ring seismology, Nat. Astron. 5, 1103',
      url: 'https://doi.org/10.1038/s41550-021-01448-3',
    },
    {
      key: 'spilker2019',
      text: 'Spilker, L. 2019, Cassini-Huygens’ exploration of the Saturn system: 13 years of discovery, Science 364, 1046',
      url: 'https://doi.org/10.1126/science.aat3760',
    },
    {
      key: 'lebreton2005',
      text: 'Lebreton, J.-P., et al. 2005, An overview of the descent and landing of the Huygens probe on Titan, Nature 438, 758',
      url: 'https://doi.org/10.1038/nature04347',
    },
    {
      key: 'porco2006',
      text: 'Porco, C. C., et al. 2006, Cassini Observes the Active South Pole of Enceladus, Science 311, 1393',
      url: 'https://doi.org/10.1126/science.1123013',
    },
  ],
};
