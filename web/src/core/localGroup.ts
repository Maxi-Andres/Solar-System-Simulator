import type { BodyDefinition, BodyId, LocalGroupCatalog } from '@sss/tools/types';

import { astrometricState } from './alphaCentauri.ts';
import type { BeltFetchers } from './belt.ts';
import type { Searchable } from './beltNames.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes } from './exoplanets.ts';
import { normalizeName } from './search.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * The Local Group (G1): the galaxies about the Milky Way and Andromeda, and their neighbours
 * out to 3 Mpc -- each at its measured distance and on its sky position, of its measured
 * size, shape and orientation, and as bright as its measured light.
 *
 * ## Measured
 *
 * - **The dwarfs**, 140-odd, from McConnachie's catalogue (2012, AJ 144, 4; its January 2021
 *   version, local-group.json, tools/src/localGroup/): centre, distance modulus, V (corrected
 *   for the reddening in front), half-light radius on the major axis, ellipticity, the major
 *   axis's position angle, and the rest its panel lists.
 * - **The four big ones** from their own papers (GIANTS below): Andromeda, which the
 *   catalogue does not list, and Triangulum and the two Magellanic Clouds, whose catalogue
 *   entries give no size or shape -- their discs are not what a dwarf's profile describes.
 *   Each one's distance is the latest and most precise there is, from Cepheids or eclipsing
 *   binaries; the catalogue's position is kept.
 *
 * ## How each is drawn
 *
 * As a volume of light: a luminosity density in space, whose integral along every line of
 * sight is the surface brightness there (scene/LocalGroup.tsx). Its total is the galaxy's
 * luminosity, L = 10^(-0.4 (M_V - M_V,Sun)) with M_V = V - (m-M)0. Its shape is a profile:
 *
 * - **A dwarf**: a Plummer ellipsoid (Plummer 1911), rho = rho0 (1 + m^2)^(-5/2), whose
 *   projected half-light radius is its scale -- the catalogue's half-light radius is its
 *   major axis, that times 1 - e its minor, on the sky at its position angle. Its depth along
 *   the line of sight is not measured for any of them: it is given the geometric mean of the
 *   two, sqrt(a b) -- neither a disc seen face-on nor a cigar seen end-on.
 * - **A disc** (Andromeda, Triangulum, the Large Cloud): exponential in radius, of its
 *   measured scale length, and in height, a fifth of that -- Hubble's intrinsic flattening of
 *   0.2, the one inclinations are worked out with, since the thickness of the light is
 *   measured for none of the three -- at its measured inclination and position angle.
 *   Andromeda's bulge beside it, a Prugniel-Simien sphere whose projection is the Sersic
 *   profile Courteau et al. fit (n 2.2, R_e 1.0 kpc), with the 24 % of its light they find
 *   in it.
 * - **The Small Cloud**: an exponential ellipsoid, of Gonidakis et al.'s scale length on the
 *   sky, elongated along the line of sight as Graczyk et al.'s eclipsing binaries show it.
 *
 * A galaxy whose size is not in the catalogue is drawn as its mark alone, and its panel says
 * so; one with no V, the same.
 */

// ---------------------------------------------------------------------------------------
// The galaxies

/** What a galaxy's light is drawn as (see the header). */
export type GalaxyModel =
  | {
      readonly kind: 'plummer';
      /** Semi-axes, pc: major and minor on the sky, and along the line of sight. */
      readonly majorPc: number;
      readonly minorPc: number;
      readonly depthPc: number;
      /** The major axis's position angle on the sky, degrees east of north. */
      readonly positionAngleDeg: number;
    }
  | {
      readonly kind: 'disc';
      readonly scaleLengthPc: number;
      readonly scaleHeightPc: number;
      /** 0 face-on, 90 edge-on. */
      readonly inclinationDeg: number;
      /** The major axis -- the line of nodes -- on the sky, degrees east of north. */
      readonly positionAngleDeg: number;
      /** Where on the sky, degrees east of north, the half of the disc nearer us lies. */
      readonly nearSideDeg: number;
      /** A bulge, its share of the light, and its Sersic fit. */
      readonly bulge: { readonly share: number; readonly effectiveRadiusPc: number; readonly sersicN: number } | null;
    }
  | {
      readonly kind: 'exponential-ellipsoid';
      /** Scale lengths, pc: major and minor on the sky, and along the line of sight. */
      readonly majorPc: number;
      readonly minorPc: number;
      readonly depthPc: number;
      readonly positionAngleDeg: number;
    };

export interface LocalGroupGalaxy {
  /** For its body id: "m31", "andromeda-xxi". */
  readonly key: string;
  readonly name: string;
  readonly otherNames: readonly string[];
  /** Its entry in McConnachie's catalogue, if it has one. */
  readonly catalogueIndex: number | null;
  /** McConnachie's asterisk: a dwarf galaxy or a star cluster, not yet known which. */
  readonly ambiguous: boolean;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly distancePc: number;
  /** The distance's uncertainty either way, pc; null where none is given. */
  readonly distanceUpPc: number | null;
  readonly distanceDownPc: number | null;
  /** Whose distance it is. */
  readonly distanceSource: string;
  /** V, corrected for the reddening in front; null where not measured. */
  readonly vMag: number | null;
  /** B-V its light is drawn in: estimated, by whether it has gas (see colourIndex). */
  readonly colourIndex: number;
  readonly model: GalaxyModel | null;
  /** Whose shape it is. */
  readonly shapeSource: string;
  /** Is it one of the four big ones, a body from the start. */
  readonly giant: boolean;
}

const hms = (h: number, m: number, s: number): number => (h + m / 60 + s / 3600) * 15;
const dms = (sign: 1 | -1, d: number, m: number, s: number): number => sign * (d + m / 60 + s / 3600);
const modulusToPc = (modulus: number): number => 10 ** (1 + modulus / 5);

/**
 * The four big ones, from their papers. Positions are McConnachie's (2012, Table 1).
 *
 * - **Andromeda (M31)**: 761 +/- 11 kpc, (m-M)0 = 24.407 +/- 0.032 from HST Cepheids (Li et
 *   al. 2021, ApJ 920, 84). V_T = 3.44 (RC3: de Vaucouleurs et al. 1991) less A_V = 0.21,
 *   Schlegel et al. 1998's reddening at its centre (as NED gives it). Disc scale length 5.3
 *   kpc and bulge n 2.2, R_e 1.0 kpc, the light 23 % bulge, 73 % disc, 4 % halo (Courteau et
 *   al. 2011, ApJ 739, 20): the halo left out, the bulge 24 % of the rest. Inclination 77 deg
 *   and the major axis at 38 deg, the values in use since de Vaucouleurs 1958 (ApJ 128,
 *   465); its north-west side the near one, where its dust lanes cross its bulge (Walterbos
 *   & Kennicutt 1988, A&A 198, 61).
 * - **Triangulum (M33)**: (m-M)0 = 24.622 +/- 0.030 from HST Cepheids (Breuval et al. 2023,
 *   ApJ 951, 118), 839 kpc. V = 5.7 (McConnachie). Inclination 52 deg, major axis 22.5 deg
 *   (Warner, Wright & Baldwin 1973, MNRAS 163, 163), scale length 1.6 kpc (Kam et al. 2015,
 *   MNRAS 449, 4048, at 3.6 um). Which side is nearer is not measured here: the west.
 * - **Large Magellanic Cloud**: 49.59 +/- 0.09 (statistical) +/- 0.54 (systematic) kpc from
 *   eclipsing binaries (Pietrzynski et al. 2019, Nature 567, 200). V = 0.4 (McConnachie).
 *   Inclination 34.0 deg, line of nodes 139.1 deg, from proper motions and old stars' radial
 *   velocities (van der Marel & Kallivayalil 2014, ApJ 781, 121), the north-east side nearer;
 *   scale length 1.4 kpc, the middle of the 1.3-1.5 van der Marel 2001 (AJ 122, 1827) finds.
 *   Its bar is not drawn.
 * - **Small Magellanic Cloud**: 62.44 +/- 0.47 +/- 0.81 kpc from eclipsing binaries (Graczyk
 *   et al. 2020, ApJ 904, 13). V = 2.2 (McConnachie). The old stars' exponential scale length
 *   1.25 kpc, centred at 0h51m, -73 07.2', the major axis north-east to south-west at 4.8 by
 *   3.8 kpc (Gonidakis et al. 2009, A&A 496, 375) -- the axis taken at 49 deg, Harris &
 *   Zaritsky 2006's (AJ 131, 2514) -- and 1.5 times as deep along the line of sight as across
 *   it: Graczyk et al.'s binaries span 7 kpc of depth against its 4.8 kpc on the sky.
 */
export const GIANTS: readonly LocalGroupGalaxy[] = [
  {
    key: 'm31',
    name: 'Andromeda Galaxy',
    otherNames: ['M31', 'NGC 224', 'Andromeda'],
    catalogueIndex: null,
    ambiguous: false,
    raDeg: hms(0, 42, 44.3),
    decDeg: dms(1, 41, 16, 9),
    distancePc: modulusToPc(24.407),
    distanceUpPc: modulusToPc(24.407 + 0.032) - modulusToPc(24.407),
    distanceDownPc: modulusToPc(24.407) - modulusToPc(24.407 - 0.032),
    distanceSource: 'Li et al. 2021, Cepheids',
    vMag: 3.44 - 0.206,
    colourIndex: 0.85,
    model: {
      kind: 'disc',
      scaleLengthPc: 5300,
      scaleHeightPc: 0.2 * 5300,
      inclinationDeg: 77,
      positionAngleDeg: 38,
      nearSideDeg: 38 + 270,
      bulge: { share: 0.23 / 0.96, effectiveRadiusPc: 1000, sersicN: 2.2 },
    },
    shapeSource: 'Courteau et al. 2011',
    giant: true,
  },
  {
    key: 'm33',
    name: 'Triangulum Galaxy',
    otherNames: ['M33', 'NGC 598', 'Triangulum'],
    catalogueIndex: null,
    ambiguous: false,
    raDeg: hms(1, 33, 50.9),
    decDeg: dms(1, 30, 39, 37),
    distancePc: modulusToPc(24.622),
    distanceUpPc: modulusToPc(24.622 + 0.03) - modulusToPc(24.622),
    distanceDownPc: modulusToPc(24.622) - modulusToPc(24.622 - 0.03),
    distanceSource: 'Breuval et al. 2023, Cepheids',
    vMag: 5.7,
    colourIndex: 0.55,
    model: {
      kind: 'disc',
      scaleLengthPc: 1600,
      scaleHeightPc: 0.2 * 1600,
      inclinationDeg: 52,
      positionAngleDeg: 22.5,
      nearSideDeg: 22.5 + 270,
      bulge: null,
    },
    shapeSource: 'Warner et al. 1973; Kam et al. 2015',
    giant: true,
  },
  {
    key: 'lmc',
    name: 'Large Magellanic Cloud',
    otherNames: ['LMC', 'Nubecula Major'],
    catalogueIndex: null,
    ambiguous: false,
    raDeg: hms(5, 23, 34.5),
    decDeg: dms(-1, 69, 45, 22),
    distancePc: 49_590,
    distanceUpPc: Math.hypot(90, 540),
    distanceDownPc: Math.hypot(90, 540),
    distanceSource: 'Pietrzyński et al. 2019, eclipsing binaries',
    vMag: 0.4,
    colourIndex: 0.5,
    model: {
      kind: 'disc',
      scaleLengthPc: 1400,
      scaleHeightPc: 0.2 * 1400,
      inclinationDeg: 34,
      positionAngleDeg: 139.1,
      nearSideDeg: 139.1 - 90,
      bulge: null,
    },
    shapeSource: 'van der Marel & Kallivayalil 2014; van der Marel 2001',
    giant: true,
  },
  {
    key: 'smc',
    name: 'Small Magellanic Cloud',
    otherNames: ['SMC', 'NGC 292', 'Nubecula Minor'],
    catalogueIndex: null,
    ambiguous: false,
    raDeg: hms(0, 51, 0),
    decDeg: dms(-1, 73, 7, 12),
    distancePc: 62_440,
    distanceUpPc: Math.hypot(470, 810),
    distanceDownPc: Math.hypot(470, 810),
    distanceSource: 'Graczyk et al. 2020, eclipsing binaries',
    vMag: 2.2,
    colourIndex: 0.45,
    model: {
      kind: 'exponential-ellipsoid',
      majorPc: 1250,
      minorPc: 1250 * (3.8 / 4.8),
      depthPc: 1250 * 1.5,
      positionAngleDeg: 49,
    },
    shapeSource: 'Gonidakis et al. 2009; Graczyk et al. 2020',
    giant: true,
  },
];

/** The catalogue's entries the four replace. */
const REPLACED = new Set(['Triangulum', 'LMC', 'SMC']);

/**
 * The colour a galaxy's light is drawn in, B-V: estimated, for the catalogue gives none. One
 * rich in gas -- a fifth of a solar mass of HI or more for each solar luminosity -- is forming
 * stars, and its light is a young population's, B-V 0.45; one with less is old, 0.75 -- the
 * colours of a dwarf irregular and a dwarf spheroidal (Mateo 1998, ARA&A 36, 435). In the
 * catalogue the irregulars have a solar mass or so per luminosity (WLM 1.5, NGC 6822 1.3), the
 * spheroidals a hundredth (Fornax, NGC 185) to a tenth (Sculptor's, which may not be its own).
 */
export const GAS_RICH = 0.2;

export function colourIndex(hiMassMillionSun: number | null, luminositySun: number | null): number {
  if (hiMassMillionSun === null || luminositySun === null || luminositySun <= 0) {
    return 0.75;
  }
  return (hiMassMillionSun * 1e6) / luminositySun >= GAS_RICH ? 0.45 : 0.75;
}

const ARCMIN = Math.PI / 180 / 60;

/** A catalogue entry as a galaxy. */
export function catalogueGalaxy(c: LocalGroupCatalog, k: number): LocalGroupGalaxy {
  const distancePc = c.distancePc[k]!;
  const rh = c.halfLightArcmin[k] ?? null;
  const e = c.ellipticity[k] ?? null;
  const major = rh === null ? null : Math.tan(rh * ARCMIN) * distancePc;
  const minor = major === null ? null : major * (1 - Math.min(Math.max(e ?? 0, 0), 0.95));
  const modulus = c.distanceModulus[k]!;
  const up = c.distanceModulusUp[k] ?? null;
  const down = c.distanceModulusDown[k] ?? null;
  return {
    key: galaxyKey(c.catalogueName[k]!),
    name: c.name[k]!,
    otherNames: c.otherNames[k]!,
    catalogueIndex: k,
    ambiguous: c.ambiguous[k]!,
    raDeg: c.raDeg[k]!,
    decDeg: c.decDeg[k]!,
    distancePc,
    distanceUpPc: up === null ? null : modulusToPc(modulus + up) - distancePc,
    distanceDownPc: down === null ? null : distancePc - modulusToPc(modulus - down),
    distanceSource: 'McConnachie 2012 (2021 version)',
    vMag: c.vMag[k] ?? null,
    colourIndex: colourIndex(c.hiMassMillionSun[k] ?? null, luminosityOf(c.vMag[k] ?? null, distancePc)),
    model:
      major === null || minor === null
        ? null
        : {
            kind: 'plummer',
            majorPc: major,
            minorPc: minor,
            depthPc: Math.sqrt(major * minor),
            positionAngleDeg: c.positionAngleDeg[k] ?? 0,
          },
    shapeSource: 'McConnachie 2012 (2021 version)',
    giant: false,
  };
}

/** "AndromedaXXI" is andromeda-xxi, "*Tucana3" tucana-3, "NGC6822" ngc-6822. */
export function galaxyKey(catalogueName: string): string {
  return catalogueName
    .replace(/^\*/, '')
    .replace(/[()]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Za-z])(\d)/g, '$1-$2')
    .replace(/[^A-Za-z0-9+]+/g, '-')
    .toLowerCase();
}

// ---------------------------------------------------------------------------------------
// Light

/** The Sun's absolute V (Willmer 2018, ApJS 236, 47). */
const SUN_ABSOLUTE_V = 4.81;

/** Its luminosity, solar V luminosities; null with no V. */
export function galaxyLuminosity(galaxy: LocalGroupGalaxy): number | null {
  return luminosityOf(galaxy.vMag, galaxy.distancePc);
}

function luminosityOf(vMag: number | null, distancePc: number): number | null {
  if (vMag === null) {
    return null;
  }
  const absolute = vMag - 5 * Math.log10(distancePc / 10);
  return 10 ** (-0.4 * (absolute - SUN_ABSOLUTE_V));
}

export function absoluteMagnitude(galaxy: LocalGroupGalaxy): number | null {
  return galaxy.vMag === null ? null : galaxy.vMag - 5 * Math.log10(galaxy.distancePc / 10);
}

/**
 * Surface brightness, mag/arcsec^2, of a column of `lPerPc2` solar V luminosities per square
 * parsec: a square parsec at 10 pc is 20.6265^2 arcsec^2, so mu = M_V,Sun + 21.572 - 2.5
 * log10(Sigma). Independent of distance, as surface brightness is.
 */
export function surfaceBrightness(lPerPc2: number): number {
  return SUN_ABSOLUTE_V + 21.572 - 2.5 * Math.log10(lPerPc2);
}

/** The inverse: solar V luminosities per square parsec at `mu` mag/arcsec^2. */
export function columnAt(mu: number): number {
  return 10 ** (-0.4 * (mu - SUN_ABSOLUTE_V - 21.572));
}

/** Lanczos's gamma function (g 7, nine terms): to 1e-13 over what is asked of it here. */
export function gamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.PI / (Math.sin(Math.PI * x) * gamma(1 - x));
  }
  const z = x - 1;
  let a = c[0]!;
  const t = z + g + 0.5;
  for (let i = 1; i < g + 2; i += 1) {
    a += c[i]! / (z + i);
  }
  return Math.sqrt(2 * Math.PI) * t ** (z + 0.5) * Math.exp(-t) * a;
}

/**
 * The Prugniel-Simien sphere (Prugniel & Simien 1997, A&A 321, 111), rho = rho0 (r/R_e)^-p
 * exp(-b (r/R_e)^(1/n)), whose projection is very nearly Sersic's profile of index n and
 * effective radius R_e: p = 1 - 0.6097/n + 0.05463/n^2 (Lima Neto et al. 1999, MNRAS 309,
 * 481), b = 2n - 1/3 + 0.009876/n (Prugniel & Simien 1997). Its luminosity is 4 pi rho0
 * R_e^3 n b^(-n(3-p)) Gamma(n(3-p)).
 */
export function prugnielSimien(n: number): { readonly p: number; readonly b: number; readonly unitLuminosity: number } {
  const p = 1 - 0.6097 / n + 0.05463 / (n * n);
  const b = 2 * n - 1 / 3 + 0.009876 / n;
  return { p, b, unitLuminosity: 4 * Math.PI * n * b ** (-n * (3 - p)) * gamma(n * (3 - p)) };
}

/**
 * A galaxy's light as what its shader needs: the central luminosity density of each part,
 * solar V luminosities per cubic parsec, so that the parts add up to its luminosity.
 */
export function centralDensities(galaxy: LocalGroupGalaxy): { readonly main: number; readonly bulge: number } | null {
  const luminosity = galaxyLuminosity(galaxy);
  const model = galaxy.model;
  if (luminosity === null || model === null) {
    return null;
  }
  switch (model.kind) {
    case 'plummer':
      // Integral of (1 + m^2)^(-5/2) over all space: 4 pi a b c / 3.
      return { main: (3 * luminosity) / (4 * Math.PI * model.majorPc * model.minorPc * model.depthPc), bulge: 0 };
    case 'exponential-ellipsoid':
      // Of e^-m: 8 pi a b c.
      return { main: luminosity / (8 * Math.PI * model.majorPc * model.minorPc * model.depthPc), bulge: 0 };
    case 'disc': {
      const share = model.bulge?.share ?? 0;
      // Of e^(-R/h - |z|/h_z): 4 pi h^2 h_z.
      const main = ((1 - share) * luminosity) / (4 * Math.PI * model.scaleLengthPc ** 2 * model.scaleHeightPc);
      if (model.bulge === null) {
        return { main, bulge: 0 };
      }
      const { unitLuminosity } = prugnielSimien(model.bulge.sersicN);
      return { main, bulge: (share * luminosity) / (unitLuminosity * model.bulge.effectiveRadiusPc ** 3) };
    }
  }
}

// ---------------------------------------------------------------------------------------
// Where, and which way it faces

/** Its centre about the Sun, scene frame, km, standing still (see the tool's header). */
export function galaxyState(galaxy: LocalGroupGalaxy): StateVector {
  const state = astrometricState({
    raDeg: galaxy.raDeg,
    decDeg: galaxy.decDeg,
    parallaxMas: 1000 / galaxy.distancePc,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    radialVelocityKmS: 0,
  });
  return { position: state.position, velocity: { x: 0, y: 0, z: 0 } };
}

/** Its centre about the Sun, scene frame, pc. */
export function galaxyPositionPc(galaxy: LocalGroupGalaxy): Vec3 {
  const { position } = galaxyState(galaxy);
  return { x: position.x / PARSEC_KM, y: position.y / PARSEC_KM, z: position.z / PARSEC_KM };
}

/**
 * The galaxy's own axes, scene frame: for a disc, its major axis (the line of nodes), the
 * in-plane axis at right angles to it -- towards the far side -- and its normal; for an
 * ellipsoid, its major and minor axes on the sky and the line of sight away from the Sun.
 */
export function galaxyAxes(galaxy: LocalGroupGalaxy): { readonly u: Vec3; readonly v: Vec3; readonly w: Vec3 } {
  const at = galaxyPositionPc(galaxy);
  const n = Math.hypot(at.x, at.y, at.z);
  const { east, north, away } = skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
  const rad = Math.PI / 180;
  const onSky = (paDeg: number): Vec3 => {
    const pa = paDeg * rad;
    return {
      x: Math.cos(pa) * north.x + Math.sin(pa) * east.x,
      y: Math.cos(pa) * north.y + Math.sin(pa) * east.y,
      z: Math.cos(pa) * north.z + Math.sin(pa) * east.z,
    };
  };
  const model = galaxy.model;
  const pa = model?.positionAngleDeg ?? 0;
  const major = onSky(pa);
  if (model === null || model.kind !== 'disc') {
    return { u: major, v: onSky(pa + 90), w: away };
  }
  // The minor axis on the sky, on the far side: away from the near side's direction.
  const farOnSky = onSky(model.nearSideDeg + 180);
  const i = model.inclinationDeg * rad;
  // Tipped by i out of the sky: its far half goes away from us.
  const v = {
    x: Math.cos(i) * farOnSky.x + Math.sin(i) * away.x,
    y: Math.cos(i) * farOnSky.y + Math.sin(i) * away.y,
    z: Math.cos(i) * farOnSky.z + Math.sin(i) * away.z,
  };
  const w = {
    x: major.y * v.z - major.z * v.y,
    y: major.z * v.x - major.x * v.z,
    z: major.x * v.y - major.y * v.x,
  };
  return { u: major, v, w };
}

/**
 * Half the extent of its box, pc, along its own axes (galaxyAxes): out to where its light is
 * a ten-thousandth of its centre's, or less.
 */
export function galaxyExtentPc(galaxy: LocalGroupGalaxy): readonly [number, number, number] | null {
  const model = galaxy.model;
  if (model === null) {
    return null;
  }
  switch (model.kind) {
    case 'plummer':
      // The column at 8 scale radii is (1 + 64)^-2 of the centre's.
      return [8 * model.majorPc, 8 * model.minorPc, 8 * model.depthPc];
    case 'exponential-ellipsoid':
      return [8 * model.majorPc, 8 * model.minorPc, 8 * model.depthPc];
    case 'disc': {
      const r = 7 * model.scaleLengthPc;
      return [r, r, 7 * model.scaleHeightPc];
    }
  }
}

/**
 * How far from its centre the camera stands when going to it, km: all of it in view, its
 * light out to where it fades into the dark -- four scale lengths of a disc, three scale radii
 * of a dwarf -- in the inner half of the frame's height.
 */
export function galaxyFramingKm(galaxy: LocalGroupGalaxy): number {
  const model = galaxy.model;
  const pc =
    model === null
      ? 2000
      : model.kind === 'disc'
        ? 7 * 4 * model.scaleLengthPc
        : model.kind === 'plummer'
          ? 7 * 3 * model.majorPc
          : 7 * 4 * model.majorPc;
  return pc * PARSEC_KM;
}

/** Earth's view of it: the camera on the Sun's side, looking out, north up. */
export function galaxyEarthView(galaxy: LocalGroupGalaxy): { direction: [number, number, number]; up: [number, number, number] } {
  const at = galaxyPositionPc(galaxy);
  const n = Math.hypot(at.x, at.y, at.z);
  const { north, away } = skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
  return { direction: [-away.x, -away.y, -away.z], up: [north.x, north.y, north.z] };
}

// ---------------------------------------------------------------------------------------
// The archive: the catalogue with the four, as search reads it

export interface LocalGroupArchive {
  /** The four big ones first, then the catalogue's, in its order. */
  readonly galaxies: readonly LocalGroupGalaxy[];
  readonly catalog: LocalGroupCatalog | null;
  readonly search: Searchable;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseLocalGroupCatalog(raw: unknown): LocalGroupCatalog {
  if (!isRecord(raw) || typeof raw['count'] !== 'number' || !Array.isArray(raw['name'])) {
    throw new Error('local-group.json is not a catalogue of galaxies.');
  }
  for (const [column, values] of Object.entries(raw)) {
    if (Array.isArray(values) && values.length !== raw['count']) {
      throw new Error(`local-group.json's ${column} does not have one entry each.`);
    }
  }
  return raw as unknown as LocalGroupCatalog;
}

/** The catalogue last read, for the panels: what it measures beyond what the galaxies keep. */
let readCatalog: LocalGroupCatalog | null = null;

export function localGroupCatalog(): LocalGroupCatalog | null {
  return readCatalog;
}

export function indexLocalGroup(catalog: LocalGroupCatalog | null): LocalGroupArchive {
  if (catalog !== null) {
    readCatalog = catalog;
  }
  const galaxies = [...GIANTS];
  if (catalog !== null) {
    for (let k = 0; k < catalog.count; k += 1) {
      if (!REPLACED.has(catalog.catalogueName[k]!)) {
        galaxies.push(catalogueGalaxy(catalog, k));
      }
    }
  }
  return {
    galaxies,
    catalog,
    search: {
      display: galaxies.map((galaxy) => normalizeName(galaxy.name)),
      designation: galaxies.map((galaxy) => normalizeName(galaxy.otherNames.join(' '))),
    },
  };
}

export async function loadLocalGroupArchive(fetchers: BeltFetchers, basePath = '/'): Promise<LocalGroupArchive> {
  const raw = await fetchers.json(`${basePath}data/local-group.json`);
  if (raw === null) {
    console.warn('The published data has no local-group.json: only the four big galaxies are shown.');
    return indexLocalGroup(null);
  }
  return indexLocalGroup(parseLocalGroupCatalog(raw));
}

// ---------------------------------------------------------------------------------------
// As bodies

export function galaxyBodyId(galaxy: LocalGroupGalaxy): BodyId {
  return `galaxy-${galaxy.key}`;
}

/** The colour of its mark and name: a pale blue, apart from the stars' and the clusters'. */
export const GALAXY_COLOR = '#aebfff';

/** The galaxies made bodies so far, by body id. */
const made = new Map<BodyId, LocalGroupGalaxy>();
for (const giant of GIANTS) {
  made.set(galaxyBodyId(giant), giant);
}

export function galaxyOf(id: BodyId | null): LocalGroupGalaxy | null {
  return id === null ? null : (made.get(id) ?? null);
}

function galaxyDefinition(galaxy: LocalGroupGalaxy): BodyDefinition {
  // A place of no surface, as a cluster is: a parsec, so the camera can go right in.
  const radius = PARSEC_KM;
  return {
    id: galaxyBodyId(galaxy),
    name: galaxy.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'galaxy',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: GALAXY_COLOR,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** Makes a galaxy a body, if it is not yet, and returns its id. */
export function ensureGalaxyBody(store: EphemerisStore, galaxy: LocalGroupGalaxy): BodyId {
  const id = galaxyBodyId(galaxy);
  made.set(id, galaxy);
  if (!store.isPropagatedBody(id)) {
    const state = galaxyState(galaxy);
    store.addPropagatedBody(galaxyDefinition(galaxy), null, () => state, { exact: true });
  }
  return id;
}

/** The four big ones are bodies from the start (App.tsx): named on the sky, found by search. */
export function ensureLocalGroupGiants(store: EphemerisStore): void {
  const missing = GIANTS.filter((giant) => !store.isPropagatedBody(galaxyBodyId(giant)));
  if (missing.length === 0) {
    return;
  }
  store.addPropagatedBodies(
    missing.map((giant) => {
      const state = galaxyState(giant);
      return { body: galaxyDefinition(giant), elements: null, state: () => state, options: { exact: true } };
    }),
  );
}
