import type { Description } from './types.ts';

/**
 * Jupiter. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a light time), the point says so. Where a figure is a model's rather than a
 * measurement, it sits under "estimated" and says which.
 */
export const JUPITER: Description = {
  id: 'jupiter',
  lead: [
    'Jupiter is the giant that shaped the rest: its gravity stirred the young Solar System and still flings comets in and out of it. And it changed how we see ourselves — when Galileo saw four moons circling it in 1610, it was the first proof that not everything in the sky turns around the Earth.',
    'Jupiter is the largest planet: eleven Earths would fit across it, and 1,300 inside it. It holds 318 times Earth’s mass — two and a half times as much as all the other planets together. It is a giant ball of hydrogen and helium with no solid surface to stand on; what we see are the tops of its clouds, and below them the gas only gets thicker and hotter all the way down.',
    'It turns faster than any other planet, once in under ten hours, and the spin flattens it: it is 6.5% narrower from pole to pole than across the equator. The spin also stretches its weather into the bands of pale and brown cloud it is known for, with jet streams of up to 150 metres per second between them. The Great Red Spot, a storm wider than Earth, has been watched for well over a century and has been shrinking for as long as it has been measured. Juno, in orbit since 2016, found its poles covered not in bands but in clusters of cyclones.',
    'It is warm inside. Jupiter gives off more heat than it takes in from the Sun, left over from its formation. It has the strongest magnetic field of any planet, its strength in all nearly 20,000 times Earth’s, which traps a belt of radiation around it and makes auroras at both poles. It has faint rings of dust and more moons than can easily be counted: the app draws over a hundred, among them the four big ones — Io, Europa, Ganymede and Callisto.',
    'Its gravity reaches across the Solar System. It shepherds the asteroid belt, holds thousands of Trojan asteroids in its own orbit, sixty degrees ahead and behind, and swings comets onto new paths. It even moves the Sun: the two go round a common centre of mass that lies just outside the Sun’s surface.',
    'It orbits the Sun at 778 million kilometres, 5.2 times as far as Earth, where sunlight is 27 times weaker than ours and takes 43 minutes to arrive. It goes round once in 11.86 years, at 13 kilometres per second.',
  ],
  photos: [
    {
      file: 'photos/jupiter/cassini-2000.webp',
      largeFile: 'photos/jupiter/cassini-2000-large.webp',
      width: 640,
      height: 800,
      title: 'Jupiter from Cassini, December 2000',
      caption:
        'Cassini’s most detailed portrait, taken on its way to Saturn as it passed Jupiter: a mosaic from its narrow-angle camera, in true colour. The Great Red Spot is at lower right; the night side is to the right.',
      colour: 'true',
      credit: 'NASA/JPL/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2000-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA04866',
    },
    {
      file: 'photos/jupiter/hubble-red-spot-2014.webp',
      largeFile: 'photos/jupiter/hubble-red-spot-2014-large.webp',
      width: 640,
      height: 441,
      title: 'The Great Red Spot shrinking, 1995 to 2014',
      caption:
        'Jupiter from Hubble on 21 April 2014, and the Red Spot in 1995, 2009 and 2014: about 21,000 kilometres across in 1995, about 16,500 in 2014 — still wider than Earth. Three visible-light filters — violet, green and red — each shown in its own colour: near natural, but not calibrated to an eye; the 1995 inset is from an older camera with other filters.',
      colour: 'true',
      credit: 'NASA, ESA and A. Simon (Goddard Space Flight Center)',
      licence: 'NASA media, not copyrighted',
      date: '2014-04-21',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001093',
    },
    {
      file: 'photos/jupiter/hubble-three-moons-2015.webp',
      largeFile: 'photos/jupiter/hubble-three-moons-2015-large.webp',
      width: 640,
      height: 640,
      title: 'Three moons and their shadows, 24 January 2015',
      caption:
        'Europa (the small white disc at lower left, just entering), Callisto (the brown disc above it) and Io (top right, nearing the edge) crossing Jupiter, with Europa’s shadow at left and Callisto’s at upper right. Three at once happens only once or twice a decade. From Hubble, through three narrow filters — violet, green and red — each shown in its own colour: near natural, but not calibrated to an eye.',
      colour: 'true',
      credit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA)',
      licence: 'NASA media, not copyrighted',
      date: '2015-01-24',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000795',
    },
    {
      file: 'photos/jupiter/hubble-aurora-2016.webp',
      largeFile: 'photos/jupiter/hubble-aurora-2016-large.webp',
      width: 640,
      height: 638,
      title: 'The northern aurora, 2016',
      caption:
        'Hubble watched Jupiter’s auroras in ultraviolet as Juno arrived. The glowing ring over the north pole is ultraviolet light, which no eye sees, drawn in blue and laid over a separate visible-light picture of the planet.',
      colour: 'false',
      credit: 'NASA, ESA and J. Nichols (University of Leicester)',
      licence: 'NASA media, not copyrighted',
      date: '2016',
      sourceUrl: 'https://images.nasa.gov/details/hubble-captures-vivid-auroras-in-jupiters-atmosphere_28000029525_o',
    },
    {
      file: 'photos/jupiter/juno-south-pole-2017.webp',
      largeFile: 'photos/jupiter/juno-south-pole-2017-large.webp',
      width: 640,
      height: 839,
      title: 'The south pole from Juno, 2 February 2017',
      caption:
        'Looking straight down on the south pole from 102,100 kilometres: no bands, but a crowd of cyclones and white ovals. Processed from JunoCam’s images by the citizen scientist Roman Tkachenko, in enhanced colour — the contrast and colour are raised.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/SwRI/MSSS/Roman Tkachenko',
      licence: 'Enhanced image CC BY, from NASA images not copyrighted',
      date: '2017-02-02',
      sourceUrl: 'https://images.nasa.gov/details/PIA21381',
    },
    {
      file: 'photos/jupiter/juno-south-pole-infrared-2017.webp',
      largeFile: 'photos/jupiter/juno-south-pole-infrared-2017-large.webp',
      width: 520,
      height: 520,
      title: 'The same pole in infrared, 2 February 2017',
      caption:
        'The same day, Juno’s infrared mapper saw the heat coming up through the clouds at a wavelength of 5 microns: a cyclone at the pole with five around it. Bright is warm, where the clouds are thin; dark is cold, thick cloud. Light no eye can see, one band shown in a scale of colours. Cropped here from the published image.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/SwRI/ASI/INAF/JIRAM',
      licence: 'NASA media, not copyrighted',
      date: '2017-02-02',
      sourceUrl: 'https://images.nasa.gov/details/PIA23556',
    },
  ],
  drawnHere: [
    {
      title: 'Flattened, as it is',
      text: 'Drawn 6.5% shorter pole to pole than across, so its oblateness shows at a glance. Its radius is measured at the level where the pressure is 1 bar, as Earth’s sea-level air: the planet has no surface.',
      cite: ['nssdcJupiter', 'archinal2018'],
    },
    {
      title: 'One fixed picture of a moving sky',
      text: 'The map is Solar System Scope’s, a composite from NASA imagery with colour added, and it turns as one rigid shell at the IAU’s rate — System III, the period of Jupiter’s magnetic field and radio emission. The real clouds do not: the bands blow east and west at different speeds, and the Red Spot drifts in longitude by about a third of a degree a day. So where the map puts the Red Spot is not where it is on the date shown.',
      cite: ['archinal2018', 'simon2018'],
    },
    {
      title: 'Its moons',
      text: 'Io, Europa, Ganymede and Callisto on JPL’s own ephemerides, each the real triaxial shape and mapped from Voyager and Galileo images — grey, as they were photographed, except Io, which carries Galileo’s colour. The rest of the moons in JPL’s tables, over a hundred, are markers of flat dark grey: for most, nothing is known but an orbit.',
      cite: ['de440'],
    },
    {
      title: 'Juno',
      text: 'On JPL’s reconstructed and predicted trajectory, from the start of the app’s window, ten years before its data was built, to where JPL’s latest prediction for it ends, its trail fading behind it. Its orbit takes weeks, so following it costs little.',
      cite: ['de440'],
    },
    {
      title: 'The Trojans',
      text: 'The asteroids that share its orbit, 60° ahead and behind, are one of the asteroid layer’s groups, from JPL’s Small-Body Database.',
    },
    {
      title: 'Lighting',
      text: 'In Natural lighting, the default, the night side is black. Shadow and Flood lighting fill it in so it can be read; neither is what an eye would see.',
    },
  ],
  measured: [
    {
      title: 'Size and shape',
      text: 'Radius 71,492 km at the equator and 66,854 km at the poles, at the 1-bar level: a flattening of 0.0649. That is 11.2 Earths across, and 1,321 Earths by volume, worked out here from the two fact sheets.',
      cite: ['nssdcJupiter', 'nssdcEarth'],
    },
    {
      title: 'Mass',
      text: 'GM = 126.687 million km³/s², from the orbits of its moons and the spacecraft that flew past; 1.898 × 10²⁷ kg, 318 times Earth’s, and 2.5 times the other seven planets’ together, worked out here from their fact-sheet masses.',
      cite: ['nssdcJupiter'],
    },
    {
      title: 'Density and makeup',
      text: 'Mean density 1.33 g/cm³, a third more than water. Its air above the clouds is 89.8% hydrogen molecules and 10.2% helium by volume.',
      cite: ['nssdcJupiter'],
    },
    {
      title: 'Rotation',
      text: '9.925 hours: the period of its magnetic field and radio emission, which turn with its interior. The clouds do not keep to it: each band has its own speed.',
      cite: ['nssdcJupiter', 'archinal2018'],
    },
    {
      title: 'Its winds',
      text: 'Up to 150 m/s at latitudes under 30°, up to 40 m/s above. Juno’s gravity measurements show the jets are not skin-deep: they reach about 3,000 km down.',
      cite: ['nssdcJupiter', 'kaspi2018'],
    },
    {
      title: 'The Great Red Spot',
      text: 'Shrinking since it was first measured: the area within its fastest winds halved between Voyager in 1979 and Hubble in 2017, and it has grown rounder; its drift west has sped up from about 0.26° to 0.36° a day. Hubble measured it at about 21,000 km across in 1995 and about 16,500 km in 2014; Earth is 12,756 km.',
      cite: ['simon2018', 'nasaGrs2014', 'nssdcEarth'],
    },
    {
      title: 'Its poles',
      text: 'Juno found a cyclone at each pole, ringed by eight more in the north and five in the south, each thousands of kilometres across, packed in a pattern that held steady through its first orbits.',
      cite: ['adriani2018'],
    },
    {
      title: 'Its own heat',
      text: 'Measured with Cassini as it flew past: Jupiter reflects half the sunlight that falls on it — a Bond albedo of 0.503 — and gives off 7.5 watts per square metre from inside, more than the sunlight it absorbs.',
      cite: ['li2018'],
    },
    {
      title: 'Its magnetic field',
      text: 'A dipole of 4.30 gauss times Jupiter’s radius cubed, tilted 9.4° from its spin axis: a moment nearly 20,000 times Earth’s, worked out here from the two fact sheets. At its cloud tops the field is 4 to 13 gauss.',
      cite: ['nssdcJupiter', 'nssdcEarth'],
    },
    {
      title: 'Its rings',
      text: 'Found by Voyager 1 in 1979: a halo, a main ring 123,000 to 129,000 km from the centre, and beyond it the fainter Amalthea and Thebe rings, out to 280,000 km. Their optical depth is a few millionths at most — almost nothing blocks the light.',
      cite: ['owen1979', 'nssdcJupiterRings'],
    },
    {
      title: 'Its orbit',
      text: 'Semi-major axis 778.48 million km, eccentricity 0.0487: perihelion 740.6 and aphelion 816.4 million km. One orbit in 4,332.6 days, at a mean 13.06 km/s. Light takes 43 minutes from the Sun, worked out here.',
      cite: ['nssdcJupiter'],
    },
    {
      title: 'It moves the Sun',
      text: 'The Sun and Jupiter go round their common centre of mass, which lies between 706,000 and 779,000 km from the Sun’s centre as Jupiter’s distance changes — just outside the Sun’s 695,700 km surface. Worked out here from the masses and the orbit; the other planets move it further.',
      cite: ['nssdcJupiter', 'iau2015'],
    },
  ],
  estimated: [
    {
      title: 'Its interior',
      text: 'Nothing sees inside. Models fitted to Juno’s gravity measurements no longer give it a small, compact core of rock and ice: the heavy elements seem spread out, dissolved into the hydrogen through a large part of its interior, a “dilute core”. Deeper still the hydrogen is squeezed into a liquid metal, whose currents make the magnetic field.',
      cite: ['wahl2017', 'bolton2017'],
    },
    {
      title: 'Its depth of weather',
      text: 'The 3,000 km depth of the jets is not seen but inferred: the winds’ mass shifts the planet’s gravity field slightly from north to south, and a model of the flow is fitted to what Juno measured.',
      cite: ['kaspi2018'],
    },
  ],
  missing: [
    {
      title: 'Today’s clouds',
      text: 'The map is not Jupiter on any date: its bands change colour and width from year to year, storms come and go in weeks, and the Red Spot is not where the map puts it. Drawing today’s Jupiter would mean fetching the latest telescope maps, which the app does not do.',
      cite: ['simon2018'],
    },
    {
      title: 'Moons’ shadows',
      text: 'When a moon passes in front of Jupiter its shadow falls on the clouds as a black dot, as in the Hubble photograph above. Nothing here casts a shadow on another body except the ringed planets — Saturn, Uranus, Neptune — and their rings, so these transits are not drawn.',
    },
    {
      title: 'Its rings',
      text: 'Not drawn: they are dust with an optical depth of a few millionths at most, invisible unless lit from behind.',
      cite: ['nssdcJupiterRings'],
    },
    {
      title: 'Its magnetosphere and auroras',
      text: 'Not drawn: the app models a magnetosphere, radiation belts and auroras only for Earth. Jupiter’s field is tilted 9.4° from its spin axis, and its auroras shine mostly in ultraviolet, as in the Hubble photograph above.',
      cite: ['nssdcJupiter'],
    },
    {
      title: 'Its heat',
      text: 'It is drawn by reflected sunlight alone; the heat it gives off is infrared, which no eye sees.',
      cite: ['li2018'],
    },
  ],
  misconceptions: [
    {
      title: 'Not a failed star',
      text: 'It is far too light to have become one. To fuse hydrogen as a star does, a body needs about 75 to 80 times Jupiter’s mass; even the smallest brown dwarfs, which never fuse hydrogen, are over a dozen Jupiter masses. Jupiter’s heat is the slow release of the energy it formed with.',
      cite: ['burrows2001'],
    },
    {
      title: 'The Red Spot is not permanent',
      text: 'It has been shrinking for as long as it has been measured, and is about half the area it was in 1979. What will become of it is not known.',
      cite: ['simon2018'],
    },
    {
      title: 'There is nowhere to land',
      text: 'It has no surface: its gas thickens with depth into a hot, dense fluid. Its radius is defined where the pressure equals Earth’s at sea level, 1 bar.',
      cite: ['nssdcJupiter'],
    },
    {
      title: 'Not simply Earth’s shield',
      text: 'Jupiter is often said to protect Earth by sweeping up asteroids and comets. Simulations that swap it for planets of other masses find a giant planet can as easily raise the number of asteroids sent toward Earth: whether Jupiter is a shield is far from settled.',
      cite: ['horner2008'],
    },
    {
      title: 'Saturn is not the only one with rings',
      text: 'Jupiter has rings too — just dark, faint dust that Voyager 1 found only in 1979. Uranus and Neptune have them as well.',
      cite: ['owen1979'],
    },
  ],
  sources: [
    {
      key: 'nssdcJupiter',
      text: 'Williams, D. R., Jupiter Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html',
    },
    {
      key: 'nssdcJupiterRings',
      text: 'Williams, D. R., Jovian Rings Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupringfact.html',
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
      key: 'iau2015',
      text: 'Prša, A., et al. 2016, Nominal values for selected solar and planetary quantities: IAU 2015 Resolution B3, AJ 152, 41',
      url: 'https://doi.org/10.3847/0004-6256/152/2/41',
    },
    {
      key: 'simon2018',
      text: 'Simon, A. A., et al. 2018, Historical and Contemporary Trends in the Size, Drift, and Color of Jupiter’s Great Red Spot, AJ 155, 151',
      url: 'https://doi.org/10.3847/1538-3881/aaae01',
    },
    {
      key: 'nasaGrs2014',
      text: 'NASA Goddard 2014, NASA’s Hubble Shows Jupiter’s Great Red Spot is Smaller than Ever (A. Simon)',
      url: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e001093',
    },
    {
      key: 'kaspi2018',
      text: 'Kaspi, Y., et al. 2018, Jupiter’s atmospheric jet streams extend thousands of kilometres deep, Nature 555, 223',
      url: 'https://doi.org/10.1038/nature25793',
    },
    {
      key: 'adriani2018',
      text: 'Adriani, A., et al. 2018, Clusters of cyclones encircling Jupiter’s poles, Nature 555, 216',
      url: 'https://doi.org/10.1038/nature25491',
    },
    {
      key: 'li2018',
      text: 'Li, L., et al. 2018, Less absorbed solar energy and more internal heat for Jupiter, Nat. Commun. 9, 3709',
      url: 'https://doi.org/10.1038/s41467-018-06107-2',
    },
    {
      key: 'owen1979',
      text: 'Owen, T., et al. 1979, Jupiter’s rings, Nature 281, 442',
      url: 'https://doi.org/10.1038/281442a0',
    },
    {
      key: 'wahl2017',
      text: 'Wahl, S. M., et al. 2017, Comparing Jupiter interior structure models to Juno gravity measurements and the role of a dilute core, Geophys. Res. Lett. 44, 4649',
      url: 'https://doi.org/10.1002/2017GL073160',
    },
    {
      key: 'bolton2017',
      text: 'Bolton, S. J., et al. 2017, Jupiter’s interior and deep atmosphere: The initial pole-to-pole passes with the Juno spacecraft, Science 356, 821',
      url: 'https://doi.org/10.1126/science.aal2108',
    },
    {
      key: 'burrows2001',
      text: 'Burrows, A., Hubbard, W. B., Lunine, J. I., & Liebert, J. 2001, The theory of brown dwarfs and extrasolar giant planets, Rev. Mod. Phys. 73, 719',
      url: 'https://doi.org/10.1103/RevModPhys.73.719',
    },
    {
      key: 'horner2008',
      text: 'Horner, J., & Jones, B. W. 2008, Jupiter – friend or foe? I: the asteroids, Int. J. Astrobiol. 7, 251',
      url: 'https://doi.org/10.1017/S1473550408004187',
    },
  ],
};
