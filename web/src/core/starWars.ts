import type {
  CanonSource,
  FictionRecord,
  FictionShipRecord,
  FictionStarRecord,
  FictionValue,
  FictionWork,
} from './fiction.ts';
import { idSeed, seededRandom } from './seeded.ts';
import type { Vec3 } from './vec3.ts';

/**
 * Star Wars (Phase F): the two Death Stars, each at the world its battle was fought over -- the
 * first at Yavin, the second over the forest moon of Endor -- in a galaxy of their own.
 *
 * ## The galaxy, which is the one thing invented outright
 *
 * The canon places its galaxy nowhere: "a long time ago in a galaxy far, far away" is all it says.
 * Things with no place in our sky get an invented one, fixed and said to be invented (agreed with
 * Maxi 2026-11-21). So the galaxy is a real one, picked by a rule from Laniakea's catalogue
 * (tools/src/laniakea/, galaxies.bin) and then by a seed:
 *  - a spiral, de Vaucouleurs T 3 to 6 (Sb to Scd: the canon's map shows a spiral);
 *  - at its own Cosmicflows-4 distance (flag DISTANCE_OWN), not a group's or a redshift's;
 *  - with a position angle and an inclination, so its disc can be laid out;
 *  - a D25 diameter within 10 % of the canon's 120,000 light years (from its half-light radius
 *    over the late types' calibrated 0.493, laniakea.json calibration.halfLightPerR25).
 * 595 galaxies pass; sorted by PGC number, the one at idSeed('star-wars-galaxy') mod 595 is PGC
 * 66273, ESO 107-11, an Sc spiral in Pavo, 480 million light years away by its Tully-Fisher
 * distance. Its numbers below are the catalogue's, copied; starWars.test.ts picks again from the
 * data where it is present and checks that the same galaxy comes out.
 *
 * ## Where the systems are in it: the canon's own map
 *
 * The starwars.com galaxy map (its appendix "Star Systems of the Galaxy") gives each system a
 * square of a grid, lettered west to east and numbered north to south, at 5,000 light years a
 * square; the Deep Core, the centre, is about L-11. Yavin is P-6, Endor H-16 -- each some 32,000
 * light years from the centre, on opposite sides. Each system is put at the middle of its square,
 * in the disc's plane. Laid onto the real galaxy, the map's centre on the galaxy's centre; how the
 * map is turned in the disc, which way round it is, and which side of the disc faces us are not
 * the catalogue's to say, and are seeded (idSeed('star-wars-map')).
 *
 * ## Precision
 *
 * 480 million light years is 4.5e21 km, where a double resolves about a million kilometres. So
 * only the stars are placed in the Sun's frame; every world and station hangs off its star in the
 * frame tree, and the camera sees them relative to one another (EphemerisStore.stateRelativeTo
 * sums only the links below the common ancestor) -- kilometres, not millions of them.
 *
 * Kept free of three.js and the store; types only from fiction.ts, which gathers these records,
 * so there is no import cycle.
 */

// --- Sources -----------------------------------------------------------------------------------

export const STAR_WARS: FictionWork = { title: 'Star Wars', creator: 'George Lucas', year: 1977, medium: 'film' };

/**
 * Read in the original: the films' dialogue (the scripts, checked against the films), the
 * starwars.com galaxy map, and the 2009 starwars.com Databank (Internet Archive). The rest are the
 * official reference books as Wookieepedia's footnotes cite them, the books themselves not read:
 * shown unverified.
 */
const A_NEW_HOPE: CanonSource = {
  short: 'A New Hope, 1977',
  full: 'Star Wars: Episode IV – A New Hope (George Lucas, 1977), dialogue',
};
const RETURN_OF_THE_JEDI: CanonSource = {
  short: 'Return of the Jedi, 1983',
  full: 'Star Wars: Episode VI – Return of the Jedi (Richard Marquand, 1983), dialogue and script',
};
const GALAXY_MAP: CanonSource = {
  short: 'starwars.com galaxy map',
  full:
    'starwars.com, “Star Wars Galaxy Map”, appendix “Star Systems of the Galaxy” (grid squares; 1 square = 5,000 light years), ' +
    'cdnvideo.dolimg.com/cdn_assets/02834527f17e4165d39a069a88161e5e330cd883.pdf',
};
const DATABANK_2009: CanonSource = {
  short: 'starwars.com Databank, 2009',
  full:
    'starwars.com Databank, “Death Star” (2009, via the Internet Archive): “Size: 160 kilometers in diameter”; ' +
    'also James Luceno, Catalyst (Del Rey, 2016) and Pablo Hidalgo, Rogue One: The Ultimate Visual Guide (DK, 2016), as cited',
};
function wikiCited(short: string, full: string): CanonSource {
  return { short, full: `${full}, as Wookieepedia cites it`, unverified: true };
}
const ROTJ_JUNIOR = wikiCited('ROTJ junior novel, 2017', 'Ryder Windham, Return of the Jedi junior novelisation (Egmont, 2017)');
const ANH_JUNIOR = wikiCited('ANH junior novel', 'A New Hope junior novelisation (Egmont)');
const COMPLETE_LOCATIONS_2016 = wikiCited('Complete Locations, 2016', 'Star Wars: Complete Locations (DK, 2016)');
const COMPLETE_LOCATIONS_2025 = wikiCited('Complete Locations, 2025', 'Star Wars: Complete Locations, New Edition (DK, 2025)');
const ROGUE_ONE_GUIDE = wikiCited('Rogue One Visual Guide', 'Pablo Hidalgo, Rogue One: The Ultimate Visual Guide (DK, 2016)');
const ABSOLUTELY_EVERYTHING = wikiCited(
  'Absolutely Everything…, 2015',
  'Star Wars: Absolutely Everything You Need to Know (DK, 2015)',
);
const EXPLORERS_GUIDE = wikiCited('Galactic Explorer’s Guide', 'Star Wars: The Galactic Explorer’s Guide');
const TROS_DICTIONARY = wikiCited('TROS Visual Dictionary, 2019', 'Star Wars: The Rise of Skywalker: The Visual Dictionary (DK, 2019)');
const ULTIMATE_STAR_WARS = wikiCited('Ultimate Star Wars, 2015', 'Ultimate Star Wars (DK, 2015)');
const MILLENNIUM_FALCON_34 = wikiCited('Build the Millennium Falcon #34', 'Star Wars: Build the Millennium Falcon, issue 34 (partwork)');

/** Invented for good: the canon is read, and silent on it. Local, so nothing is imported at runtime from fiction.ts. */
function invented<T>(value: T, why: string): FictionValue<T> {
  return { value, invented: true, why };
}

// --- The galaxy --------------------------------------------------------------------------------

/** The catalogue's record of the galaxy the Star Wars galaxy is put at (Laniakea galaxies.bin, copied). */
export const STAR_WARS_GALAXY = {
  pgc: 66273,
  name: 'ESO 107-11',
  /** Scene frame (heliocentric, ecliptic J2000), parsecs, at its comoving distance; the record's float32 values. */
  positionPc: { x: 45_107_824, y: -90_825_896, z: -106_525_576 },
  /** Of the major axis, degrees east of north (HyperLEDA). */
  positionAngleDeg: 94.51,
  /** 0 face-on (HyperLEDA). */
  inclinationDeg: 64.44,
  /** De Vaucouleurs type: Sc. */
  tType: 5.1,
  /** D25, light years: from its half-light radius (estimated, see above). */
  diameterLy: 120_612,
  /** Its own Cosmicflows-4 distance: Tully-Fisher. */
  distanceMethod: 'Tully-Fisher (Cosmicflows-4)',
  redshift: 0.03623,
} as const;

/** The pick's rule, for the test and the About. */
export const STAR_WARS_GALAXY_RULE = {
  seedId: 'star-wars-galaxy',
  tMin: 3,
  tMax: 6,
  diameterLy: 120_000,
  tolerance: 0.1,
  halfLightPerR25: 0.493,
  candidates: 595,
} as const;

export const LY_KM = 9_460_730_472_580.8;
export const PC_KM = 30_856_775_814_913.673;

/** The canon's grid: 5,000 light years a square; the centre, the Deep Core, at L-11. */
export const MAP_SQUARE_LY = 5_000;
const MAP_CENTRE = { column: 'L', row: 11 } as const;

/** A square's middle on the canon's map, light years east (+x) and north (+y) of the centre. */
export function mapSquareLy(square: string): { readonly east: number; readonly north: number } {
  const match = /^([A-W])-(\d{1,2})$/.exec(square);
  if (match === null) throw new Error(`Not a map square: ${square}`);
  const column = match[1]!.charCodeAt(0) - MAP_CENTRE.column.charCodeAt(0);
  const row = Number(match[2]) - MAP_CENTRE.row;
  // Letters run west to east; numbers north to south.
  return { east: column * MAP_SQUARE_LY, north: -row * MAP_SQUARE_LY };
}

/** IAU 1976 obliquity, the scene frame's tilt from the ICRS. */
const OBLIQUITY_RAD = (84_381.448 / 3_600) * (Math.PI / 180);

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function combine(a: number, u: Vec3, b: number, v: Vec3): Vec3 {
  return { x: a * u.x + b * v.x, y: a * u.y + b * v.y, z: a * u.z + b * v.z };
}

/**
 * The galaxy's disc and the map laid on it, in the scene frame: `east` and `north` the map's
 * directions, `normal` the disc's pole. The major axis lies along the catalogue's position angle on
 * the sky; the disc is tipped from face-on by the inclination about it, toward a side the seed
 * picks; the map is turned in the disc by a seeded angle and, by the seed, mirrored.
 */
export function galaxyMapFrame(): { readonly east: Vec3; readonly north: Vec3; readonly normal: Vec3 } {
  const g = STAR_WARS_GALAXY;
  const along = unit({ x: g.positionPc.x, y: g.positionPc.y, z: g.positionPc.z });
  const pole: Vec3 = { x: 0, y: Math.sin(OBLIQUITY_RAD), z: Math.cos(OBLIQUITY_RAD) };
  const skyEast = unit(cross(pole, along));
  const skyNorth = cross(along, skyEast);
  const pa = (g.positionAngleDeg * Math.PI) / 180;
  const major = combine(Math.cos(pa), skyNorth, Math.sin(pa), skyEast);
  const minor = combine(-Math.sin(pa), skyNorth, Math.cos(pa), skyEast);
  const random = seededRandom(idSeed('star-wars-map'));
  const nearSide = random() < 0.5 ? 1 : -1;
  const turn = 2 * Math.PI * random();
  const mirrored = random() < 0.5;
  const i = (g.inclinationDeg * Math.PI) / 180;
  const toward: Vec3 = { x: -along.x, y: -along.y, z: -along.z };
  const normal = unit(combine(Math.cos(i), toward, nearSide * Math.sin(i), minor));
  const inPlane = cross(normal, major);
  const east = combine(Math.cos(turn), major, Math.sin(turn), inPlane);
  const northUnmirrored = combine(-Math.sin(turn), major, Math.cos(turn), inPlane);
  const north = mirrored ? { x: -northUnmirrored.x, y: -northUnmirrored.y, z: -northUnmirrored.z } : northUnmirrored;
  return { east, north, normal };
}

/** Where a square's middle is, km from the Sun, scene frame: the galaxy's centre plus the map's offset. */
export function mapSquarePositionKm(square: string): Vec3 {
  const { east, north } = galaxyMapFrame();
  const offset = mapSquareLy(square);
  const g = STAR_WARS_GALAXY.positionPc;
  const inDisc = combine(offset.east * LY_KM, east, offset.north * LY_KM, north);
  return { x: g.x * PC_KM + inDisc.x, y: g.y * PC_KM + inDisc.y, z: g.z * PC_KM + inDisc.z };
}

// --- The stars ---------------------------------------------------------------------------------

/**
 * The reality check every Star Wars entry shares: the galaxy is real and so is its distance; the
 * light we see from it left some 470 million years ago (z 0.036), so "a long time ago" is, for once,
 * right.
 */
const GALAXY_LINE =
  'ESO 107-11 is a real Sc spiral, 480 million light years away: its light left it when life on Earth was still in the sea. ' +
  'That Star Wars happens there is invented here; the canon names no galaxy.';

const YAVIN_STAR: FictionStarRecord = {
  id: 'yavin-star',
  name: 'Yavin',
  aliases: ['Yavin system', 'Yavin’s sun'],
  work: STAR_WARS,
  kind: 'star',
  anchorLine: 'In the Outer Rim, square P-6 of the canon’s map, laid on the real galaxy ESO 107-11',
  position: 'invented',
  mapSquare: { value: 'P-6', source: GALAXY_MAP },
  temperatureK: invented(4_600, 'The canon says an orange K main-sequence star; a K4 dwarf’s temperature, chosen.'),
  radiusSun: invented(0.71, 'A K4 dwarf’s radius, chosen: the canon gives none.'),
  massSun: invented(0.73, 'A K4 dwarf’s mass, chosen: the canon gives none. Yavin Prime’s orbit is drawn with it.'),
  facts: [
    { label: 'Type', value: { value: 'orange, K, main sequence', source: MILLENNIUM_FALCON_34 } },
    { label: 'Region', value: { value: 'Outer Rim, Gordian Reach', source: GALAXY_MAP } },
  ],
  realityCheck: GALAXY_LINE,
};

const ENDOR_I: FictionStarRecord = {
  id: 'endor-i',
  name: 'Endor I',
  aliases: ['Endor system'],
  work: STAR_WARS,
  kind: 'star',
  anchorLine: 'In the Outer Rim, square H-16 of the canon’s map, laid on the real galaxy ESO 107-11',
  position: 'invented',
  mapSquare: { value: 'H-16', source: GALAXY_MAP },
  temperatureK: invented(5_800, 'The canon names two stars and gives neither a type: a Sun-like star, chosen.'),
  radiusSun: invented(1, 'Sun-like, chosen.'),
  massSun: invented(1, 'Sun-like, chosen. Endor’s orbit is drawn with it.'),
  facts: [
    { label: 'Stars', value: { value: 'two, Endor I and Endor II', source: ABSOLUTELY_EVERYTHING } },
    { label: 'Region', value: { value: 'Outer Rim, Moddell sector', source: GALAXY_MAP } },
  ],
  realityCheck: GALAXY_LINE,
};

const ENDOR_II: FictionStarRecord = {
  id: 'endor-ii',
  name: 'Endor II',
  aliases: [],
  work: STAR_WARS,
  kind: 'star',
  anchorLine: 'Companion of Endor I, square H-16 of the canon’s map',
  position: 'invented',
  mapSquare: { value: 'H-16', source: GALAXY_MAP },
  temperatureK: invented(3_400, 'The canon gives no type: a red dwarf, chosen, so the pair reads as two stars in the moon’s sky without heating it.'),
  radiusSun: invented(0.4, 'A red dwarf’s, chosen.'),
  massSun: invented(0.4, 'A red dwarf’s, chosen.'),
  companionOf: {
    id: 'endor-i',
    separationAu: invented(300, 'The canon gives none: far enough that Endor’s orbit about Endor I stays stable; held still, its own orbit of thousands of years not drawn.'),
  },
  facts: [{ label: 'Stars', value: { value: 'two, Endor I and Endor II', source: ABSOLUTELY_EVERYTHING } }],
  realityCheck: GALAXY_LINE,
};

export const STAR_WARS_STARS: readonly FictionStarRecord[] = [YAVIN_STAR, ENDOR_I, ENDOR_II];

// --- The worlds --------------------------------------------------------------------------------

/** Earth's radius, km, for gravity from a mass and a radius. */
const EARTH_RADIUS_KM = 6_371;

/** A mass, Earths, for a surface gravity `g` and a radius: g R². */
function massForGravity(g: number, radiusKm: number): number {
  return g * (radiusKm / EARTH_RADIUS_KM) ** 2;
}

/** A plane for a system whose orientation nobody gives: on the sky's axes at its star, as exoplanets.ts draws one. */
function skyPlane(seedId: string): Pick<FictionRecord['orbit'], 'inclinationDeg' | 'nodeDeg'> {
  const random = seededRandom(idSeed(seedId));
  return {
    inclinationDeg: invented(30 + 40 * random(), 'Canon silent: seeded.'),
    nodeDeg: invented(360 * random(), 'Canon silent: seeded.'),
  };
}

const YAVIN_PLANE = skyPlane('yavin-plane');
const ENDOR_PLANE = skyPlane('endor-plane');

const YAVIN_RADIUS_KM = 100_000;
const YAVIN_4_RADIUS_KM = 10_200 / 2;
const FOREST_MOON_RADIUS_KM = 4_900 / 2;

const YAVIN_PRIME: FictionRecord = {
  id: 'yavin-prime',
  name: 'Yavin Prime',
  aliases: ['Yavin', 'the planet Yavin'],
  work: STAR_WARS,
  kind: 'planet',
  anchor: { kind: 'fictionStar', id: 'yavin-star' },
  anchorLine: 'Orbits Yavin, in Star Wars’ galaxy laid on the real ESO 107-11',
  position: 'invented',
  look: { kind: 'world', palette: 'banded-giant', seed: 41, tint: [0.92, 0.5, 0.18] },
  radiusKm: { value: YAVIN_RADIUS_KM, source: ANH_JUNIOR, basis: 'half of “nearly 200,000 km”' },
  // Legends gives 4 g at the cloud tops; at this radius that is 3.1 Jupiters.
  massEarth: invented(massForGravity(4, YAVIN_RADIUS_KM), 'Canon silent; from the 4 g Legends gives, at this radius: 3.1 Jupiters.'),
  orbit: {
    semiMajorAxisKm: invented(5 * 149_597_870.7, 'From the period, about Yavin’s chosen mass.'),
    eccentricity: invented(0, 'Canon silent.'),
    periodDays: { value: 4_818, source: COMPLETE_LOCATIONS_2016, basis: 'Yavin 4’s year' },
    drawnFromPeriod: true,
    ...YAVIN_PLANE,
  },
  facts: [
    { label: 'Colour', value: { value: 'orange', source: ULTIMATE_STAR_WARS } },
    {
      label: 'Moons',
      value: { value: 26, source: ROGUE_ONE_GUIDE },
      note: 'Complete Locations (2016) says 13; only Yavin 4 is drawn',
    },
  ],
  realityCheck: 'A giant 1.4 times Jupiter’s width is possible for a young or hot one. The rest is fiction. ' + GALAXY_LINE,
};

const YAVIN_4: FictionRecord = {
  id: 'yavin-4',
  name: 'Yavin 4',
  aliases: ['Yavin IV', 'the fourth moon of Yavin'],
  work: STAR_WARS,
  kind: 'moon',
  anchor: { kind: 'fiction', id: 'yavin-prime' },
  anchorLine: 'A moon of Yavin Prime, in the galaxy laid on the real ESO 107-11',
  position: 'invented',
  look: { kind: 'world', palette: 'jungle-moon', seed: 44, clouds: 0.35 },
  radiusKm: { value: YAVIN_4_RADIUS_KM, source: COMPLETE_LOCATIONS_2025 },
  massEarth: invented(massForGravity(1, YAVIN_4_RADIUS_KM), 'Canon silent; Legends gives standard gravity, 1 g, at this radius.'),
  orbit: {
    // 200,000 km across at 1.2 million km: 9.5 degrees.
    semiMajorAxisKm: invented(1_200_000, 'Canon silent: chosen so Yavin Prime spans about 9.5° of its sky.'),
    eccentricity: invented(0, 'Canon silent.'),
    ...YAVIN_PLANE,
  },
  facts: [
    { label: 'Year', value: { value: 4_818, source: COMPLETE_LOCATIONS_2016 }, unit: 'days' },
    { label: 'Rebel base', value: { value: 'on this moon, on the far side of Yavin', source: A_NEW_HOPE } },
  ],
  realityCheck: 'A habitable moon of a giant planet is a real possibility astronomers look for; none is known. ' + GALAXY_LINE,
};

const ENDOR: FictionRecord = {
  id: 'endor',
  name: 'Endor',
  aliases: ['the gas giant Endor', 'Endor (planet)'],
  work: STAR_WARS,
  kind: 'planet',
  anchor: { kind: 'fictionStar', id: 'endor-i' },
  anchorLine: 'Orbits Endor I, in Star Wars’ galaxy laid on the real ESO 107-11',
  position: 'invented',
  look: { kind: 'world', palette: 'banded-giant', seed: 46, tint: [0.55, 0.68, 0.62] },
  radiusKm: { value: 48_951 / 2, source: TROS_DICTIONARY },
  massEarth: invented(17.15, 'Canon silent: Neptune’s, a giant its size.'),
  orbit: {
    semiMajorAxisKm: invented(149_597_870.7, 'From the period, about Endor I’s chosen mass.'),
    eccentricity: invented(0, 'Canon silent.'),
    periodDays: { value: 402, source: ABSOLUTELY_EVERYTHING, basis: 'the forest moon’s year' },
    drawnFromPeriod: true,
    ...ENDOR_PLANE,
  },
  facts: [{ label: 'Moons', value: { value: '9 major, 48 smaller', source: TROS_DICTIONARY } }],
  realityCheck: 'Planets about one star of a wide pair are common. ' + GALAXY_LINE,
};

const FOREST_MOON: FictionRecord = {
  id: 'forest-moon-of-endor',
  name: 'Forest Moon of Endor',
  aliases: ['Endor', 'Sanctuary Moon', 'the forest moon'],
  work: STAR_WARS,
  kind: 'moon',
  anchor: { kind: 'fiction', id: 'endor' },
  anchorLine: 'A moon of Endor, in the galaxy laid on the real ESO 107-11',
  position: 'invented',
  look: { kind: 'world', palette: 'jungle-moon', seed: 48, tint: [0.16, 0.34, 0.14], clouds: 0.4 },
  radiusKm: { value: FOREST_MOON_RADIUS_KM, source: ABSOLUTELY_EVERYTHING },
  massEarth: invented(
    massForGravity(0.85, FOREST_MOON_RADIUS_KM),
    'The canon says only “light” gravity; Legends’ 0.85 g, at this radius.',
  ),
  orbit: {
    semiMajorAxisKm: invented(400_000, 'Canon silent: chosen so Endor spans about 7° of its sky.'),
    eccentricity: invented(0, 'Canon silent.'),
    ...ENDOR_PLANE,
  },
  facts: [
    { label: 'Day', value: { value: 18, source: EXPLORERS_GUIDE }, unit: 'hours', note: 'not turned: the sphere does not spin' },
    { label: 'Year', value: { value: 402, source: ABSOLUTELY_EVERYTHING }, unit: 'days' },
    { label: 'Gravity', value: { value: 'light', source: COMPLETE_LOCATIONS_2016 } },
  ],
  realityCheck: 'A forested moon this small would struggle to hold an air like Earth’s for long. ' + GALAXY_LINE,
};

export const STAR_WARS_WORLDS: readonly FictionRecord[] = [YAVIN_PRIME, YAVIN_4, ENDOR, FOREST_MOON];

// --- The stations ------------------------------------------------------------------------------

/** The models' sizes: their diameters, metres (scene/fiction/looks/deathStar.ts scales to them). */
export const DEATH_STAR_DIAMETER_M = 160_000;
export const DEATH_STAR_II_DIAMETER_M = 200_000;

const DEATH_STAR: FictionShipRecord = {
  id: 'death-star',
  name: 'Death Star',
  aliases: ['Death Star I', 'DS-1', 'DS-1 Orbital Battle Station'],
  work: STAR_WARS,
  kind: 'ship',
  anchorLine: 'Orbiting Yavin Prime, as at the Battle of Yavin',
  position: 'invented',
  look: { kind: 'ship', design: 'death-star' },
  lengthM: {
    value: DEATH_STAR_DIAMETER_M,
    source: DATABANK_2009,
    basis: 'its diameter',
  },
  station: {
    about: 'yavin-prime',
    mode: 'orbit',
    // "Orbiting the planet at maximum velocity. The moon with the Rebel base will be in range in
    // thirty minutes." No distance is given.
    radiusKm: invented(600_000, 'Canon silent: inside Yavin 4’s orbit, so it comes round the planet to reach the moon, as in the film.'),
    phaseDeg: invented(180, 'Canon silent: opposite Yavin 4 at J2000.'),
    aim: 'yavin-4',
  },
  facts: [
    { label: 'Diameter, Legends', value: { value: '120 km', source: DATABANK_2009 }, note: 'the older figure, “unretconned” in 2013' },
    { label: 'Levels', value: { value: 357, source: ABSOLUTELY_EVERYTHING } },
    { label: 'Crew', value: { value: 'about 1.2 million', source: ROGUE_ONE_GUIDE } },
    { label: 'Exhaust port', value: { value: 'two metres wide', source: A_NEW_HOPE } },
    { label: 'Fate', value: { value: 'destroyed at the Battle of Yavin', source: A_NEW_HOPE } },
  ],
  realityCheck:
    'Shown with the second Death Star, though in the story they never existed at once. Nothing so large has been built; ' +
    'the largest thing in orbit, the ISS, is 109 m across. ' + GALAXY_LINE,
};

const DEATH_STAR_II: FictionShipRecord = {
  id: 'death-star-ii',
  name: 'Death Star II',
  aliases: ['Second Death Star', 'DS-2'],
  work: STAR_WARS,
  kind: 'ship',
  anchorLine: 'Held over the Forest Moon of Endor, as at the Battle of Endor',
  position: 'invented',
  look: { kind: 'ship', design: 'death-star-ii' },
  lengthM: { value: DEATH_STAR_II_DIAMETER_M, source: ROTJ_JUNIOR, basis: 'its diameter' },
  station: {
    about: 'forest-moon-of-endor',
    mode: 'hold',
    radiusKm: invented(
      FOREST_MOON_RADIUS_KM + 3_000,
      'Canon gives no altitude; it is held in a “stationary orbit” by the shield generator’s field (Ultimate Star Wars, 2015). ' +
        '3,000 km up, so it stands about 4° across in the moon’s sky.',
    ),
    // No aim: turned out from the moon, as in the film it fires on the Rebel fleet, not the moon.
  },
  facts: [
    { label: 'State', value: { value: 'half-completed', source: RETURN_OF_THE_JEDI } },
    { label: 'Diameter, Legends', value: { value: '160 km; 900 km', source: DATABANK_2009 } },
    { label: 'Levels', value: { value: 560, source: ABSOLUTELY_EVERYTHING } },
    { label: 'Aboard', value: { value: '2,471,647', source: ABSOLUTELY_EVERYTHING } },
    { label: 'Fate', value: { value: 'destroyed at the Battle of Endor', source: RETURN_OF_THE_JEDI } },
  ],
  realityCheck:
    'Shown with the first Death Star, though in the story they never existed at once; no orbit holds a station still over one place ' +
    'that close. ' + GALAXY_LINE,
};

export const STAR_WARS_STATIONS: readonly FictionShipRecord[] = [DEATH_STAR, DEATH_STAR_II];
