import type { BodyDefinition, BodyId, LocalGroupCatalog } from '@sss/tools/types';

import { astrometricState } from './alphaCentauri.ts';
import type { BeltFetchers } from './belt.ts';
import { aliasField, type Searchable } from './beltNames.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes } from './exoplanets.ts';
import { CLUSTER_LF_STEP } from './globularClusterPopulation.ts';
import { clusterPopulation, meanLuminosity } from './globularClusters.ts';
import { DUST_DISC } from './milkyWay.ts';
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
 *   measured scale length, and in height, DISC_FLATTENING times thinner -- the mean of the
 *   discs Kregel et al. measured edge-on, since the thickness of the light is measured for
 *   none of the three -- at its measured inclination and position angle. Each one's from
 *   above is its face-on map (FaceOnMap below): its stars and its dust as they are, not an
 *   exponential.
 *   Andromeda's bulge beside it, a Prugniel-Simien sphere whose projection is the Sersic
 *   profile Courteau et al. fit (n 2.2, R_e 1.0 kpc), with the 24 % of its light they find
 *   in it.
 * - **The Small Cloud**: an exponential ellipsoid, of Gonidakis et al.'s scale length on the
 *   sky, elongated along the line of sight as Graczyk et al.'s eclipsing binaries show it.
 *
 * A galaxy whose size is not in the catalogue is drawn as its mark alone, and its panel says
 * so; one with no V, the same.
 *
 * The galaxies beyond, out to the Virgo Cluster, are made the same kind of galaxy from their
 * own catalogues (localVolume.ts), with one more profile: an elliptical's, a Prugniel-Simien
 * ellipsoid (`sersic`), and discs with a bulge drawn in the disc's own box.
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
      /** Its face-on map's name in galaxies/, where it has one (FaceOnMap). */
      readonly faceOnMap: string | null;
    }
  | {
      readonly kind: 'exponential-ellipsoid';
      /** Scale lengths, pc: major and minor on the sky, and along the line of sight. */
      readonly majorPc: number;
      readonly minorPc: number;
      readonly depthPc: number;
      readonly positionAngleDeg: number;
    }
  | {
      /**
       * An elliptical beyond the Local Group (localVolume.ts): a Prugniel-Simien ellipsoid,
       * whose projection is the Sersic profile of index n, its effective radii these.
       */
      readonly kind: 'sersic';
      /** Effective radii, pc: major and minor on the sky, and along the line of sight. */
      readonly majorPc: number;
      readonly minorPc: number;
      readonly depthPc: number;
      readonly positionAngleDeg: number;
      readonly sersicN: number;
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
  /** Its entry in local-volume.json, for one beyond the Local Group (localVolume.ts). */
  readonly volumeIndex?: number;
}

/**
 * A disc's scale length over its scale height: 7.3 +/- 2.2, the mean of the 34 edge-on discs
 * Kregel, van der Kruit & de Grijs measured (2002, MNRAS 334, 646).
 */
export const DISC_FLATTENING = 7.3;

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
      scaleHeightPc: 5300 / DISC_FLATTENING,
      inclinationDeg: 77,
      positionAngleDeg: 38,
      nearSideDeg: 38 + 270,
      bulge: { share: 0.23 / 0.96, effectiveRadiusPc: 1000, sersicN: 2.2 },
      faceOnMap: 'm31',
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
      scaleHeightPc: 1600 / DISC_FLATTENING,
      inclinationDeg: 52,
      positionAngleDeg: 22.5,
      nearSideDeg: 22.5 + 270,
      bulge: null,
      faceOnMap: 'm33',
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
      scaleHeightPc: 1400 / DISC_FLATTENING,
      inclinationDeg: 34,
      positionAngleDeg: 139.1,
      nearSideDeg: 139.1 - 90,
      bulge: null,
      faceOnMap: 'lmc',
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

/** A galaxy's size and shape on the sky: half-light radius along its major axis, ellipticity, position angle. */
export interface SkyShape {
  readonly halfLightArcmin: number | null;
  readonly ellipticity: number | null;
  readonly positionAngleDeg: number | null;
  /** Whose they are. */
  readonly source: string;
}

/**
 * Sizes McConnachie's catalogue has none for, from the galaxies' own papers, by catalogue name.
 *
 * - **Leo P**: no half-light radius has been published -- its size was found by counting its
 *   stars, the light of so faint a galaxy being lost in the sky's. McQuinn et al. 2013 (AJ 146,
 *   145, Table 1) give the ellipse its stars fill: semi-major axis 70 +- 5 arcsec,
 *   ellipticity 0.52, position angle 335 deg, the 70 arcsec where their counts fall to the
 *   field's (Rhode et al. 2013, AJ 145, 149, find its stars reach the field 0.725 arcmin from
 *   its centre). The ellipticity and angle are theirs; the half-light radius is estimated as
 *   half that edge, 35 arcsec: a Plummer sphere's stars at twice its half-light radius are 4 %
 *   as crowded as at its centre, about where so faint a galaxy's are lost in the field's. A
 *   choice, and the About says so. (Two compilations give the 70 arcsec itself as a half-light
 *   radius: it is not one.)
 * - **KK 258**: the ESO-LV catalogue's surface photometry (Lauberts & Valentijn 1989, its B
 *   growth curve): a half-light ellipse 60.3 arcsec along its major axis, axis ratio 0.65, at
 *   43.1 deg -- the one half-light measurement of it there is. (McConnachie's 0.5 is the
 *   Karachentsev catalogues' axis ratio of its isophotal size, by eye.)
 */
export const SHAPE_OVERRIDES: Readonly<Record<string, SkyShape>> = {
  LeoP: {
    halfLightArcmin: 35 / 60,
    ellipticity: 0.52,
    positionAngleDeg: 335,
    source: 'McQuinn et al. 2013; radius estimated',
  },
  KK258: {
    halfLightArcmin: 60.3 / 2 / 60,
    ellipticity: 1 - 1 / 1.54,
    positionAngleDeg: 43.1,
    source: 'Lauberts & Valentijn 1989 (ESO-LV)',
  },
};

/** A catalogue entry's shape on the sky: the catalogue's, or its override where the catalogue has no size. */
export function catalogueShape(c: LocalGroupCatalog, k: number): SkyShape {
  const override = SHAPE_OVERRIDES[c.catalogueName[k]!];
  if (override !== undefined && c.halfLightArcmin[k] == null) {
    return override;
  }
  return {
    halfLightArcmin: c.halfLightArcmin[k] ?? null,
    ellipticity: c.ellipticity[k] ?? null,
    positionAngleDeg: c.positionAngleDeg[k] ?? null,
    source: 'McConnachie 2012 (2021 version)',
  };
}

/**
 * Why a galaxy has no light drawn, its mark only, by catalogue name: those the catalogue gives
 * no size or no V. Short, for its panel.
 */
export const UNDRAWN_REASONS: Readonly<Record<string, string>> = {
  '*Hydra1': 'An overdensity of stars, maybe debris; no size measured',
  '*Bootes3': 'Likely a disrupting dwarf’s debris; no size measured',
  '*CanisMajor': 'A dwarf or the disc’s warp, disputed; no size measured',
  'HIZSS3(A)': 'Behind the Milky Way’s plane: found in HI, no optical V',
  HIZSS3B: 'Behind the Milky Way’s plane: found in HI, no optical V',
};

/** A catalogue entry as a galaxy. */
export function catalogueGalaxy(c: LocalGroupCatalog, k: number): LocalGroupGalaxy {
  const distancePc = c.distancePc[k]!;
  const shape = catalogueShape(c, k);
  const rh = shape.halfLightArcmin;
  const e = shape.ellipticity;
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
            positionAngleDeg: shape.positionAngleDeg ?? 0,
          },
    shapeSource: shape.source,
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
    case 'sersic': {
      // Of the Prugniel-Simien profile in effective radii: its unit luminosity times a b c --
      // that within the reach it is drawn to (SERSIC_REACH), so all its light is drawn.
      const { unitLuminosity } = prugnielSimien(model.sersicN);
      const drawn = unitLuminosity * sersicLightWithin(SERSIC_REACH, model.sersicN);
      return { main: luminosity / (drawn * model.majorPc * model.minorPc * model.depthPc), bulge: 0 };
    }
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
// A disc from above

/**
 * A disc's face-on map (tools/galaxies/prepare.py, galaxies/<name>.png and .json): its old
 * stars, its star formation and its dust where they are, as one would see them from straight
 * above, worked out by undoing its tilt in pictures of it -- a thin disc's picture is its
 * face-on map squeezed by cos i along its minor axis. Andromeda's, Triangulum's and the Large
 * Cloud's.
 *
 * - **Old stars**, from WISE's 3.4 um, which dust hardly dims: where the disc's light is,
 *   scaled to the disc's V luminosity (less its young stars').
 * - **Star formation**, M_Sun/yr/kpc^2, from GALEX's far-UV and WISE's 22 um (Leroy et al.
 *   2008): its young stars' light, YOUNG_V_PER_SFR of it per unit.
 * - **Dust**, as its A_V face-on, from Herschel: Andromeda's by its gas column (Marsh et al.
 *   2018) and Bohlin et al.'s gas to reddening, Triangulum's by its dust mass (z0MGS) and
 *   Draine et al. 2014's, less the 2.5 that overpredicts by Andromeda's stars (Dalcanton et al.
 *   2015); dimming each colour by Cardelli et al.'s curve.
 * - **Glowing gas**, the Large Cloud's alone, from SHASSA's H-alpha (galaxies/lmc-nebula.png,
 *   one channel): its HII regions' Balmer light, H-alpha and H-beta at Case B's 2.86
 *   (Osterbrock & Ferland 2006), as the V-band luminosity that carries the same energy,
 *   L_Sun/pc^2 -- drawn on the same exposure as the starlight, in the lines' own pink.
 *
 * Each is a sheet of its own thickness, as the Milky Way's are: the old stars the disc's
 * (DISC_FLATTENING); the dust the Milky Way's, the one dust layer whose thickness is measured;
 * the young stars the Milky Way's OB stars', YOUNG_HEIGHT_PC, thinner still, and the glowing
 * gas with the young stars that light it.
 */
export interface FaceOnMap {
  /** Pixels a side, and how far the map reaches either side of the centre, pc. */
  readonly size: number;
  readonly halfPc: number;
  /** Each channel's log10 at code 1 and 255 (0 is none): R old stars, G star formation, B dust. */
  readonly bounds: { readonly old: readonly [number, number]; readonly sfr: readonly [number, number]; readonly dust: readonly [number, number] };
  /** The decoded map summed over its area: old stars (its own units, pc^2), star formation (M_Sun/yr). */
  readonly oldSum: number;
  readonly sfrSum: number;
  /** Its glowing gas, where it has a map of it (<name>-nebula.png): that map's log10 at code 1 and 255. */
  readonly nebula?: { readonly bounds: readonly [number, number] };
}

/** The young stars' V light per unit of star formation, L_Sun per M_Sun/yr: see the header. */
export const YOUNG_V_PER_SFR = 2e9;
/** Their colour, B-V: a population formed steadily over the last hundred million years. */
export const YOUNG_COLOUR_INDEX = 0.05;
/** Their scale height, pc: the Milky Way's OB stars', 45 +/- 20 (Reed 2000, AJ 120, 314). */
export const YOUNG_HEIGHT_PC = 45;
/** The colours' wavelengths, um, for their extinction: about where sRGB's red, green and blue are. */
export const CHANNEL_WAVELENGTHS_UM = [0.61, 0.55, 0.46] as const;

/** A_lambda / A_V at `um` microns, optical and near-infrared: Cardelli, Clayton & Mathis 1989, R_V 3.1. */
export function extinctionCurve(um: number, rv = 3.1): number {
  const x = 1 / um;
  if (x < 1.1) {
    return 0.574 * x ** 1.61 + (-0.527 * x ** 1.61) / rv;
  }
  const y = x - 1.82;
  const a =
    1 + 0.17699 * y - 0.50447 * y ** 2 - 0.02427 * y ** 3 + 0.72085 * y ** 4 + 0.01979 * y ** 5 - 0.7753 * y ** 6 + 0.32999 * y ** 7;
  const b =
    1.41338 * y + 2.28305 * y ** 2 + 1.07233 * y ** 3 - 5.38434 * y ** 4 - 0.62251 * y ** 5 + 5.3026 * y ** 6 - 2.09002 * y ** 7;
  return a + b / rv;
}

/** A map's channel, decoded: its 8-bit code to its value (the shader does the same). */
export function decodeMapChannel(code: number, bounds: readonly [number, number]): number {
  return code < 0.5 ? 0 : 10 ** (bounds[0] + ((code - 1) / 254) * (bounds[1] - bounds[0]));
}

/**
 * What a disc's map stands for, per unit of each channel: the old stars' and the young stars'
 * V luminosity per pc^2, and the optical depth in V; and the scale heights, pc, of the old
 * stars' sheet, the young stars' and the dust's.
 */
export function faceOnScales(
  galaxy: LocalGroupGalaxy,
  map: FaceOnMap,
): {
  readonly old: number;
  readonly young: number;
  readonly dustTauV: number;
  readonly heightsPc: readonly [number, number, number];
} | null {
  const luminosity = galaxyLuminosity(galaxy);
  const model = galaxy.model;
  if (luminosity === null || model === null || model.kind !== 'disc') {
    return null;
  }
  const disc = (1 - (model.bulge?.share ?? 0)) * luminosity;
  const young = YOUNG_V_PER_SFR * map.sfrSum;
  const dust = DUST_DISC.scaleHeightPc;
  return {
    old: Math.max(0, disc - young) / map.oldSum,
    // Per M_Sun/yr/kpc^2: a kpc^2 is a million pc^2.
    young: YOUNG_V_PER_SFR / 1e6,
    // The map's dust is A_V: an optical depth of A_V / 2.5 log10 e.
    dustTauV: 1 / 1.0857,
    heightsPc: [model.scaleHeightPc, YOUNG_HEIGHT_PC, dust],
  };
}

export function parseFaceOnMap(raw: unknown): FaceOnMap {
  const map = raw as FaceOnMap;
  if (typeof map?.size !== 'number' || typeof map.halfPc !== 'number' || typeof map.oldSum !== 'number') {
    throw new Error('not a face-on map');
  }
  if (map.nebula !== undefined && !(Array.isArray(map.nebula?.bounds) && map.nebula.bounds.length === 2)) {
    throw new Error('not a face-on map: its nebula has no bounds');
  }
  return map;
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
 * The faintest column a galaxy's box may cut, over the white column: a fifth of the light the
 * volumes' shaders stop drawing at (0.0005), so the box's faces never show.
 */
export const BOX_FLOOR = 1e-4;

/**
 * Half the extent of its box, pc, along its own axes (galaxyAxes): out to where its light is
 * a ten-thousandth of its centre's -- 8 scale radii of a Plummer sphere or an exponential
 * ellipsoid, 7 of a disc -- and, for one bright enough that even that is seen against
 * `whiteColumn` (L_Sun/pc^2 drawn white), on to where its brightest line of sight past the box
 * is below BOX_FLOOR of white. M32 is 77 times white at its centre and at 8 scale radii still
 * 2 % of it: its box showed, a faint square about it; it reaches 30 scale radii. A disc seen
 * edge-on is brightest along its plane, 2 h rho0 through its centre, and that is what its
 * faces are reckoned against.
 */
export function galaxyExtentPc(galaxy: LocalGroupGalaxy, whiteColumn = Infinity): readonly [number, number, number] | null {
  const model = galaxy.model;
  if (model === null) {
    return null;
  }
  const densities = centralDensities(galaxy);
  const rho0 = densities === null || !Number.isFinite(whiteColumn) ? 0 : densities.main / whiteColumn;
  switch (model.kind) {
    case 'plummer': {
      // Its column at k scale radii off its centre is (1 + k^2)^-2 of that through it, 4/3 rho0 a.
      const peak = (4 / 3) * rho0 * Math.max(model.majorPc, model.minorPc, model.depthPc);
      const k = Math.max(8, Math.sqrt(Math.max(0, Math.sqrt(peak / BOX_FLOOR) - 1)));
      return [k * model.majorPc, k * model.minorPc, k * model.depthPc];
    }
    case 'exponential-ellipsoid': {
      // e^-m: through its centre 2 rho0 a, k scale lengths off it about rho0 a sqrt(2 pi k) e^-k.
      const k = Math.max(8, exponentialReach(rho0 * Math.max(model.majorPc, model.minorPc, model.depthPc)));
      return [k * model.majorPc, k * model.minorPc, k * model.depthPc];
    }
    case 'disc': {
      // Edge-on, along its plane k scale lengths off its centre, about rho0 h sqrt(2 pi k) e^-k;
      // through its centre k scale heights off its plane, 2 rho0 h e^-k.
      const along = rho0 * model.scaleLengthPc;
      const r = Math.max(7, exponentialReach(along)) * model.scaleLengthPc;
      const z = Math.max(7, Math.log(Math.max(1, (2 * along) / BOX_FLOOR))) * model.scaleHeightPc;
      if (galaxy.giant || model.bulge === null || densities === null) {
        return [r, r, z];
      }
      // A bulge drawn in the disc's own box (scene/galaxyColumns.ts), which must hold it: far
      // above a thin disc's plane its light still shows.
      const bulgeRho = Number.isFinite(whiteColumn) ? densities.bulge / whiteColumn : 0;
      const reach = sersicReach(bulgeRho * model.bulge.effectiveRadiusPc, model.bulge.sersicN) * model.bulge.effectiveRadiusPc;
      return [Math.max(r, reach), Math.max(r, reach), Math.max(z, reach)];
    }
    case 'sersic': {
      // Its column k effective radii off its centre, along its longest axis, rho0 c Sigma(k).
      const k = sersicReach(rho0 * Math.max(model.majorPc, model.minorPc, model.depthPc), model.sersicN);
      return [k * model.majorPc, k * model.minorPc, k * model.depthPc];
    }
  }
}

/**
 * How far a Prugniel-Simien profile is drawn, effective radii: the table of its columns
 * reaches this far (scene/galaxyColumns.ts). Beyond it lies a fifth of a per cent of a de
 * Vaucouleurs profile's light.
 */
export const SERSIC_REACH = 30;

/**
 * The projected column of a Prugniel-Simien profile of unit central density and unit
 * effective radius, `m` effective radii off its centre: very nearly the Sersic profile,
 * Sigma_e e^(-b (m^(1/n) - 1)), its Sigma_e such that it holds the profile's whole light,
 * 2 pi n Sigma_e e^b b^(-2n) Gamma(2n) = the unit luminosity (prugnielSimien).
 */
export function sersicUnitColumn(m: number, n: number): number {
  const { b, unitLuminosity } = prugnielSimien(n);
  const sigmaE = unitLuminosity / (2 * Math.PI * n * Math.exp(b) * b ** (-2 * n) * gamma(2 * n));
  return sigmaE * Math.exp(-b * (m ** (1 / n) - 1));
}

/**
 * The share of a Sersic profile's light within `k` effective radii on the sky: the regularized
 * incomplete gamma function P(2n, b k^(1/n)), by its series. A de Vaucouleurs profile holds
 * 99.8 % of its light within SERSIC_REACH; M87's, of index 11.8, 93 %.
 */
export function sersicLightWithin(k: number, n: number): number {
  const { b } = prugnielSimien(n);
  const a = 2 * n;
  const x = b * k ** (1 / n);
  let term = 1 / a;
  let sum = term;
  for (let i = 1; i < 500 && term > sum * 1e-15; i += 1) {
    term *= x / (a + i);
    sum += term;
  }
  return Math.min(1, Math.exp(-x + a * Math.log(x) - Math.log(gamma(a))) * sum);
}

/**
 * The effective radii out to which a Prugniel-Simien profile is drawn, its brightest column
 * there `peak` (rho0 times its longest scale, over the white column) times its unit column:
 * where that falls below BOX_FLOOR, never under 8, never past SERSIC_REACH.
 */
export function sersicReach(peak: number, n: number): number {
  if (!(peak > 0)) {
    return 8;
  }
  const { b } = prugnielSimien(n);
  const atCentre = sersicUnitColumn(0, n) * peak;
  const k = atCentre <= BOX_FLOOR ? 0 : (Math.log(atCentre / BOX_FLOOR) / b) ** n;
  return Math.min(SERSIC_REACH, Math.max(8, k));
}

/** The k at which peak sqrt(2 pi k) e^-k falls to BOX_FLOOR: by iteration, from 8. */
function exponentialReach(peak: number): number {
  let k = 8;
  for (let i = 0; i < 8; i += 1) {
    k = Math.max(1, Math.log(Math.max(1e-30, (peak * Math.sqrt(2 * Math.PI * k)) / BOX_FLOOR)));
  }
  return k;
}

/**
 * The radius, pc, within which half its light lies as seen on the sky, about: a Plummer
 * sphere's scale radius, the geometric mean of its two axes; an exponential disc's 1.678
 * scale lengths; an exponential ellipsoid's 2.027 of its major scale length, worked out from
 * its column. Only how big it looks: what decides when it is too small for a pixel
 * (scene/LocalGroup.tsx).
 */
export function galaxyHalfLightPc(galaxy: LocalGroupGalaxy): number | null {
  const model = galaxy.model;
  if (model === null) {
    return null;
  }
  switch (model.kind) {
    case 'plummer':
      return Math.sqrt(model.majorPc * model.minorPc);
    case 'exponential-ellipsoid':
      return 2.027 * model.majorPc;
    case 'disc':
      return 1.678 * model.scaleLengthPc;
    case 'sersic':
      return Math.sqrt(model.majorPc * model.minorPc);
  }
}

/**
 * A dwarf's glow shows if its centre is this bright or brighter, mag/arcsec^2: five magnitudes
 * below the column drawn white (scene/LocalGroup.tsx WHITE_MU, 21), a hundredth of full
 * strength -- a tenth of the screen's brightness once encoded. Fornax's centre as drawn, 23.5,
 * shows; Draco's, 25.4, faintly; Hercules's, 27.5, and every ultra-faint's, do not.
 */
export const GLOW_SHOWN_MU = 26;

/**
 * How many of a faint dwarf's brightest stars, and how bright, V, the camera brings them when
 * going to it: its fifth brightest at V 6, two magnitudes above the stars' limit, V 8 -- the
 * stars' response is a line in magnitude from the brightest star in the sky to that limit
 * (scene/starRendering.ts), and a star near it is a dot at the edge of seeing.
 */
export const FRAMING_STARS = 5;
export const FRAMING_STARS_V = 6;

/**
 * An elliptical is framed on its light out to where it is this bright, mag/arcsec^2: three
 * magnitudes below the column drawn white, where it still shows clearly (galaxyFramingKm).
 */
export const FRAMING_MU = 24;

/** Nearer than this, in half-light radii (galaxyHalfLightPc), a dwarf is about the camera, not in front of it. */
export const FRAMING_NEAREST_RADII = 3;

/**
 * The M_V its `count` brightest stars are as bright as, expected: as many stars as give its
 * light, of the population its stars are drawn from (core/dwarfStars.ts) -- the globular
 * clusters' 12 Gyr table nearest its [Fe/H], the clusters' default where none is measured --
 * counted down from the brightest. Hercules, of 9 x 10^4 stars at [Fe/H] -2.41, has its
 * brightest at M_V -2.4 and its fifth at -1.6; Segue 1, of 1,400, its brightest at +0.5 and its
 * fifth at +3.3.
 */
export function brightestStarsV(galaxy: LocalGroupGalaxy, feH: number | null, count = FRAMING_STARS): number | null {
  const luminosity = galaxyLuminosity(galaxy);
  if (luminosity === null) {
    return null;
  }
  const population = clusterPopulation(feH);
  const stars = luminosity / meanLuminosity(population);
  let brighter = 0;
  for (const [mv, share] of population.rows) {
    const here = share * stars;
    if (brighter + here >= count) {
      return mv + (CLUSTER_LF_STEP * (count - brighter)) / here;
    }
    brighter += here;
  }
  return population.rows[population.rows.length - 1]![0] + CLUSTER_LF_STEP;
}

/**
 * Its centre's surface brightness, mag/arcsec^2, as drawn: a Plummer ellipsoid's column
 * through its centre is its luminosity over pi a b, whatever its depth.
 */
export function plummerCentreMu(galaxy: LocalGroupGalaxy): number | null {
  const model = galaxy.model;
  const luminosity = galaxyLuminosity(galaxy);
  if (model === null || model.kind !== 'plummer' || luminosity === null) {
    return null;
  }
  return surfaceBrightness(luminosity / (Math.PI * model.majorPc * model.minorPc));
}

/**
 * How far from its centre the camera stands when going to it, km: where it can be seen.
 *
 * - **All of it in view**: its light out to where it fades into the dark -- four scale
 *   lengths of a disc or of the Small Cloud, three scale radii of a dwarf -- in the inner half
 *   of the frame's height, seven times that out: 21 half-light radii of a dwarf. Fornax's
 *   glow, 23.5 mag/arcsec^2 at its centre, is seen from there, 16.5 kpc out.
 * - **A faint dwarf, its stars**: one whose centre is fainter than GLOW_SHOWN_MU is no light,
 *   from there or from anywhere -- it is seen by its stars, as it was found. From 21 half-light
 *   radii none show: Hercules's brightest, M_V -2.4, is V 11.1 4.8 kpc out, past the stars'
 *   limit, V 8. So it is gone to no farther than where its FRAMING_STARS brightest are V
 *   FRAMING_STARS_V -- five at V 6 -- and no nearer than FRAMING_NEAREST_RADII half-light
 *   radii, three, where its body fills the frame. Hercules is gone to 380 pc out, not 4.8
 *   kpc -- its fifth brightest would be V 6 at 320 -- its brightest V 5.6 and twenty stars
 *   brighter than V 7.5; Segue 1 64 pc out, its brightest V 4.6. The largest and faintest stop
 *   at the three radii short of it, their stars still faint: Antlia II 6.9 kpc out, Crater II
 *   3.1, Sextans 1.7, Andromeda's faint dwarfs 0.5 to 4 kpc.
 *
 * Discs, the Small Cloud, the ellipticals and the dwarfs whose light shows are framed whole,
 * as before -- and every dwarf beyond the Local Group, whose stars are not drawn.
 */
export function galaxyFramingKm(galaxy: LocalGroupGalaxy): number {
  const model = galaxy.model;
  if (model === null) {
    return 2000 * PARSEC_KM;
  }
  if (model.kind === 'disc') {
    return 7 * 4 * model.scaleLengthPc * PARSEC_KM;
  }
  if (model.kind === 'exponential-ellipsoid') {
    return 7 * 4 * model.majorPc * PARSEC_KM;
  }
  if (model.kind === 'sersic') {
    // An elliptical's light out to three effective radii, four-fifths of it for n = 4 -- or,
    // nearer, out to where it fades below FRAMING_MU along its major axis: a steep profile,
    // M87's of index 11.8, is at its effective radius already 25.7 mag/arcsec^2, its light
    // further out a halo too faint to frame. M87 is framed on its inner 19 kpc, not its 59.
    const densities = centralDensities(galaxy);
    const { b } = prugnielSimien(model.sersicN);
    const peak = densities === null ? 0 : (densities.main * model.depthPc * sersicUnitColumn(1, model.sersicN)) / columnAt(FRAMING_MU);
    const root = peak > 0 ? 1 + Math.log(peak) / b : 0;
    const fades = root > 0 ? root ** model.sersicN : 0;
    return 7 * Math.min(3, Math.max(0.1, fades)) * model.majorPc * PARSEC_KM;
  }
  const whole = 7 * 3 * model.majorPc;
  // Beyond the Local Group no dwarf's stars are drawn (DwarfStars.tsx): framed whole.
  if (galaxy.volumeIndex !== undefined) {
    return whole * PARSEC_KM;
  }
  const mu = plummerCentreMu(galaxy);
  const k = galaxy.catalogueIndex;
  const brightest = brightestStarsV(galaxy, k === null ? null : (readCatalog?.feH[k] ?? null));
  if (mu === null || mu <= GLOW_SHOWN_MU || brightest === null) {
    return whole * PARSEC_KM;
  }
  const shown = 10 ** ((FRAMING_STARS_V - brightest) / 5 + 1);
  const nearest = FRAMING_NEAREST_RADII * galaxyHalfLightPc(galaxy)!;
  return Math.max(nearest, Math.min(whole, shown)) * PARSEC_KM;
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
      designation: galaxies.map((galaxy) => aliasField(galaxy.otherNames)),
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
  ensureGalaxyBodies(store, GIANTS);
}

/** Makes these galaxies bodies, those not yet, at once: one rebuild of the store for all. */
export function ensureGalaxyBodies(store: EphemerisStore, galaxies: readonly LocalGroupGalaxy[]): void {
  for (const galaxy of galaxies) {
    made.set(galaxyBodyId(galaxy), galaxy);
  }
  const missing = galaxies.filter((galaxy) => !store.isPropagatedBody(galaxyBodyId(galaxy)));
  if (missing.length === 0) {
    return;
  }
  store.addPropagatedBodies(
    missing.map((galaxy) => {
      const state = galaxyState(galaxy);
      return { body: galaxyDefinition(galaxy), elements: null, state: () => state, options: { exact: true } };
    }),
  );
}
