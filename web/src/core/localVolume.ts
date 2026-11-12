import type { LocalVolumeCatalog } from '@sss/tools/types';

import type { BeltFetchers } from './belt.ts';
import type { Searchable } from './beltNames.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import {
  colourIndex,
  DISC_FLATTENING,
  ensureGalaxyBodies,
  type GalaxyModel,
  type LocalGroupGalaxy,
} from './localGroup.ts';
import { normalizeName } from './search.ts';

/**
 * Beyond the Local Group (G2): the Local Volume out to 11 Mpc -- the Sculptor group about NGC
 * 253, M81 and M82, Centaurus A and M83, IC 342 and the Maffeis, Canes Venatici's clouds -- and
 * the Virgo Cluster at 16.5 Mpc, each galaxy at its measured distance and on its sky position,
 * of its measured size and shape where measured, and as bright as its measured light.
 *
 * ## Measured
 *
 * From local-volume.json (tools/src/localVolume/): the Updated Nearby Galaxy Catalog's galaxies
 * (Karachentsev, Makarov & Kaisina 2013, AJ 145, 101) and the Extended Virgo Cluster Catalog's
 * members (Kim et al. 2014, ApJS 215, 22), less those McConnachie's catalogue already gives
 * (localGroup.ts) -- each with its centre, distance and how it was measured, V corrected for
 * the Milky Way's dust in front, B-V, de Vaucouleurs T type and class, Holmberg diameter or
 * half-light radius, axis ratio, inclination, position angle, radial velocity, HI mass and
 * group, where given. What the tool estimated is flagged there and said so here.
 *
 * ## Drawn as
 *
 * Each is a galaxy of localGroup.ts, its light a volume, its profile by its kind (volumeClass):
 *
 * - **A dwarf** -- a spheroidal, a dwarf elliptical, an irregular, a blue compact dwarf, a
 *   Magellanic spiral (T 9 and later), an elliptical fainter than M_V -17 -- a Plummer
 *   ellipsoid, as the Local Group's dwarfs are: half-light radius on its major axis, its axis
 *   ratio on the sky, its depth the geometric mean of the two.
 * - **An elliptical** (T -4 or earlier, or E in its class; M_V -17 or brighter): de
 *   Vaucouleurs's r^(1/4) law (1948), the Sersic profile of index 4, as a Prugniel-Simien
 *   ellipsoid (localGroup.ts prugnielSimien) -- its effective radius on its major axis, its
 *   axis ratio on the sky, its depth again the geometric mean.
 * - **A disc** (S0 to Sdm, T -3 to 8): an exponential disc of scale length h, DISC_FLATTENING
 *   times thinner, at its inclination and position angle; and, for the earlier types, a bulge
 *   with bulgeShare's share of its light, de Vaucouleurs's law of effective radius
 *   BULGE_RE_OVER_H h.
 *
 * ## Size
 *
 * The Virgo Cluster's giant ellipticals are their own Sersic fits, profile, size and light
 * (ELLIPTICAL_FITS). For the rest, the half-light radius on the major axis is the profile's
 * own: a Plummer ellipsoid's scale, an elliptical's effective radius, 1.678 scale lengths of a
 * disc (Graham & Driver 2005, PASA 22, 118). The EVCC's is measured (its r-band R50, made
 * major-axis by the axis ratio); the UNGC's the tool estimated as 0.529 of the Holmberg radius,
 * the median ratio over the 29 galaxies both catalogues hold, scatter a factor of 1.5
 * (tools/src/localVolume/localVolume.ts holmbergHalfLightRatio). Without one, its mark alone.
 *
 * ## Orientation
 *
 * Where the position angle is not measured, which way it is elongated on the sky is not known:
 * it is drawn round on the sky -- a disc facing us, an ellipsoid as deep as it is wide -- and its
 * panel says so. A disc's inclination is the catalogue's, or failing that its axis ratio's,
 * cos^2 i = (q^2 - q0^2) / (1 - q0^2) (Hubble 1926) with q0 = 1 / DISC_FLATTENING, the axis
 * ratio a disc as thick as these is seen at edge-on. Which side of a disc is nearer is measured
 * for none: the one 90 degrees clockwise of its major axis's position angle. From Earth it looks
 * the same either way.
 */

// ---------------------------------------------------------------------------------------
// Constants

/** An elliptical's Sersic index: de Vaucouleurs's r^(1/4) law (de Vaucouleurs 1948). */
export const ELLIPTICAL_SERSIC_N = 4;
/** A bulge's, the r^(1/4) law Simien & de Vaucouleurs fitted their bulges with (bulgeShare). */
export const BULGE_SERSIC_N = 4;
/** A bulge's effective radius over its disc's scale length: 0.22 +/- 0.09 (MacArthur, Courteau & Holtzman 2003, ApJ 582, 689). */
export const BULGE_RE_OVER_H = 0.22;
/** A bulge holding less of the light than this is not drawn: an Sd's. */
export const BULGE_LEAST_SHARE = 0.02;
/** An elliptical fainter than this, M_V, is a dwarf (drawn as the Local Group's are). */
export const DWARF_ELLIPTICAL_MV = -17;
/** Galaxies this bright or brighter, dereddened V, are named on the sky from the start: bodies once loaded. */
export const NAMED_V = 9.5;

const ARCMIN = Math.PI / 180 / 60;

// ---------------------------------------------------------------------------------------
// Which profile

export type VolumeClass = 'dwarf' | 'elliptical' | 'disc';

/** The T type a class's text stands for, where the catalogue gives the text alone. */
function typeFromClass(morphology: string): number | null {
  const m = morphology.trim();
  if (/^S0/i.test(m)) return -2;
  if (/^S[AB]{0,2}a/.test(m)) return 1;
  if (/^S[AB]{0,2}b/.test(m)) return 3;
  if (/^S[AB]{0,2}c/.test(m)) return 5;
  if (/^S[AB]{0,2}d/.test(m)) return 7;
  if (/^S[AB]{0,2}m/.test(m)) return 9;
  return null;
}

/**
 * What a galaxy is drawn as, from its class and T type (see the header): a dwarf, an
 * elliptical or a disc. Unclassified, a dwarf: most of the Local Volume's galaxies are.
 */
export function volumeClass(tType: number | null, morphology: string | null, absoluteV: number | null): VolumeClass {
  const m = (morphology ?? '').trim();
  const t = tType ?? (m === '' ? null : typeFromClass(m));
  const dwarfClass = /^d/.test(m) || /^(Sph|Tr|BCD|Im|Irr|Ir\b|IB?m|I\b|I0|BCG|HII)/i.test(m);
  if (dwarfClass || (t !== null && t >= 9) || (t === null && m === '')) {
    return 'dwarf';
  }
  const elliptical = (t !== null && t <= -4) || /^c?E(\d|\b|$|\+|\/)/.test(m);
  if (elliptical) {
    return absoluteV !== null && absoluteV <= DWARF_ELLIPTICAL_MV ? 'elliptical' : 'dwarf';
  }
  // The EVCC's "edge-on" is a disc whose type its edge hides.
  if (t === null && !/^S/.test(m) && !/edge-on/i.test(m)) {
    return 'dwarf';
  }
  return 'disc';
}

/**
 * A disc galaxy's bulge, its share of the light, by T type: Simien & de Vaucouleurs's fit to
 * the bulges and discs they decomposed (1986, ApJ 302, 564), in B,
 * m_bulge - m_total = 0.324 x - 0.054 x^2 + 0.0047 x^3, x = T + 5 -- 0.57 of an S0's light, 0.39
 * of an Sa's, 0.24 of an Sb's, 0.10 of an Sc's, 0.02 of an Sd's.
 */
export function bulgeShare(tType: number): number {
  const x = Math.min(Math.max(tType, -5), 10) + 5;
  const dm = 0.324 * x - 0.054 * x * x + 0.0047 * x * x * x;
  return 10 ** (-0.4 * dm);
}

/** cos^2 i = (q^2 - q0^2) / (1 - q0^2): a disc's inclination from its axis ratio (Hubble 1926). */
export function inclinationFromAxisRatio(axisRatio: number, q0 = 1 / DISC_FLATTENING): number {
  const q = Math.min(1, Math.max(q0, axisRatio));
  const cos2 = (q * q - q0 * q0) / (1 - q0 * q0);
  return (Math.acos(Math.sqrt(Math.max(0, cos2))) * 180) / Math.PI;
}

/** The axis ratio a disc of thickness 1/q0 shows at inclination i: the inverse. */
export function axisRatioFromInclination(inclinationDeg: number, q0 = 1 / DISC_FLATTENING): number {
  const c = Math.cos((inclinationDeg * Math.PI) / 180);
  return Math.sqrt(c * c * (1 - q0 * q0) + q0 * q0);
}

// ---------------------------------------------------------------------------------------
// A catalogue entry as a galaxy

/** How each distance was measured, as the panel says it (the catalogue's code). */
const DISTANCE_METHODS: Readonly<Record<string, string>> = {
  TRGB: 'tip of the red giant branch',
  Cep: 'Cepheids',
  SBF: 'surface brightness fluctuations',
  txt: 'its stars’ texture',
  TF: 'Tully–Fisher',
  BS: 'its brightest stars',
  HB: 'its horizontal branch',
  RR: 'RR Lyrae',
  CMD: 'its stars’ colours and magnitudes',
  SN: 'a supernova',
  FP: 'the fundamental plane',
  PNLF: 'its planetary nebulae',
  geom: 'geometry',
  mem: 'its group’s',
  h: 'its velocity',
  "h'": 'its velocity',
  cluster: 'the cluster’s depth',
};

export function distanceMethodLabel(code: string): string {
  return DISTANCE_METHODS[code] ?? code;
}

/** What it is called as a key: "NGC 253" ngc-253. */
export function volumeKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Its absolute V; null with no V. */
function absoluteV(vMag: number | null, distancePc: number): number | null {
  return vMag === null ? null : vMag - 5 * Math.log10(distancePc / 10);
}

/** How its size was had, for its source line. */
export type SizeFrom = 'half-light' | 'half-light-estimated' | null;

/** Its shape, before it is a model: the scale of its profile and how it lies. */
export interface VolumeShape {
  readonly kind: VolumeClass;
  /** The profile's scale, pc: a Plummer's half-light radius, an elliptical's effective radius, a disc's scale length. */
  readonly scalePc: number | null;
  readonly sizeFrom: SizeFrom;
  /** Axis ratio on the sky drawn, 1 where its orientation is not known. */
  readonly axisRatio: number;
  /** Its position angle, or null: not measured, so drawn round. */
  readonly positionAngleDeg: number | null;
  /** A disc's inclination, and whether it came from the axis ratio. */
  readonly inclinationDeg: number;
  readonly inclinationFromAxisRatio: boolean;
  readonly bulgeShare: number;
}

export function volumeShape(c: LocalVolumeCatalog, k: number): VolumeShape {
  const distancePc = c.distancePc[k]!;
  const t = c.tType[k] ?? null;
  const morphology = c.morphology[k] ?? null;
  const kind = volumeClass(t, morphology, absoluteV(c.vMag[k] ?? null, distancePc));
  const pa = c.positionAngleDeg[k] ?? null;
  const measuredQ = c.axisRatio[k] ?? null;
  const measuredI = c.inclinationDeg[k] ?? null;
  // A disc's inclination: the catalogue's, or its axis ratio's; with no position angle, facing us.
  let inclinationDeg = 0;
  let fromAxisRatio = false;
  if (kind === 'disc' && pa !== null) {
    if (measuredI !== null) {
      inclinationDeg = measuredI;
    } else if (measuredQ !== null) {
      inclinationDeg = inclinationFromAxisRatio(measuredQ);
      fromAxisRatio = true;
    }
  }
  const axisRatio =
    pa === null
      ? 1
      : kind === 'disc'
        ? (measuredQ ?? axisRatioFromInclination(inclinationDeg))
        : Math.min(1, Math.max(0.05, measuredQ ?? 1));
  const tForBulge = t ?? (morphology === null ? null : typeFromClass(morphology));
  const share = kind === 'disc' && tForBulge !== null ? bulgeShare(tForBulge) : 0;
  const rh = c.halfLightArcmin[k] ?? null;
  const halfLightPc = rh === null ? null : Math.tan(rh * ARCMIN) * distancePc;
  return {
    kind,
    // The half-light radius as the profile's scale.
    scalePc: halfLightPc === null ? null : kind === 'disc' ? halfLightPc / 1.678 : halfLightPc,
    sizeFrom: rh === null ? null : (c.halfLightEstimated[k] ?? false) ? 'half-light-estimated' : 'half-light',
    axisRatio,
    positionAngleDeg: pa,
    inclinationDeg,
    inclinationFromAxisRatio: fromAxisRatio,
    bulgeShare: share >= BULGE_LEAST_SHARE ? share : 0,
  };
}

/** Its profile in three dimensions, from its shape (see the header). */
export function volumeModel(shape: VolumeShape): GalaxyModel | null {
  const s = shape.scalePc;
  if (s === null || !(s > 0)) {
    return null;
  }
  const pa = shape.positionAngleDeg ?? 0;
  switch (shape.kind) {
    case 'dwarf':
    case 'elliptical': {
      const minor = s * shape.axisRatio;
      const depth = Math.sqrt(s * minor);
      return shape.kind === 'dwarf'
        ? { kind: 'plummer', majorPc: s, minorPc: minor, depthPc: depth, positionAngleDeg: pa }
        : { kind: 'sersic', majorPc: s, minorPc: minor, depthPc: depth, positionAngleDeg: pa, sersicN: ELLIPTICAL_SERSIC_N };
    }
    case 'disc':
      return {
        kind: 'disc',
        scaleLengthPc: s,
        scaleHeightPc: s / DISC_FLATTENING,
        inclinationDeg: shape.inclinationDeg,
        positionAngleDeg: pa,
        nearSideDeg: pa + 270,
        bulge:
          shape.bulgeShare > 0
            ? { share: shape.bulgeShare, effectiveRadiusPc: BULGE_RE_OVER_H * s, sersicN: BULGE_SERSIC_N }
            : null,
        faceOnMap: null,
      };
  }
}

/** Whose its shape is, for its panel. */
function shapeSourceOf(c: LocalVolumeCatalog, k: number, sizeFrom: SizeFrom): string {
  const catalogue = c.sample[k] === 'evcc' ? 'Kim et al. 2014 (EVCC)' : 'Karachentsev et al. 2013 (UNGC)';
  return sizeFrom === 'half-light-estimated' ? `${catalogue}; radius estimated` : catalogue;
}

/** A giant elliptical's own fit (ELLIPTICAL_FITS): Sersic index, effective radius, V. */
export interface EllipticalFit {
  readonly sersicN: number;
  /** Effective radius of the major-axis profile, arcsec. */
  readonly effectiveArcsec: number;
  /** Total V the fit integrates to, and the Milky Way's A_V in front. */
  readonly vTotal: number;
  readonly extinctionV: number;
}

/**
 * The Virgo Cluster's giant ellipticals as Kormendy, Fisher, Cornell & Bender fit them (2009,
 * ApJS 182, 216, Table 1; their profiles VizieR J/ApJS/182/216): the Sersic function fitted to each one's major-axis V profile, out
 * to its faint envelope, and the total V it integrates to. The EVCC's half-light radius and
 * magnitude, from SExtractor's Kron aperture, miss that envelope -- M87 came out 1.0' across
 * and 0.6 magnitudes fainter -- so for these the fit stands instead. By NGC number.
 *
 * The fit's effective radius is that of the major-axis profile, not the half-light radius of
 * the light within the last isophote measured (Table 1's columns 16-18, 72"-203" for these):
 * drawn so, the fit's own extrapolation holds the rest of its light, far out and faint. Its
 * index past 10 for M87 and M86 is past where Prugniel and Simien's density was fitted (n up
 * to 10).
 */
export const ELLIPTICAL_FITS: Readonly<Record<string, EllipticalFit>> = {
  '4472': { sersicN: 5.99, effectiveArcsec: 269.29, vTotal: 8.0, extinctionV: 0.072 },
  '4486': { sersicN: 11.84, effectiveArcsec: 703.91, vTotal: 8.3, extinctionV: 0.072 },
  '4649': { sersicN: 5.36, effectiveArcsec: 132.05, vTotal: 8.53, extinctionV: 0.086 },
  '4406': { sersicN: 10.27, effectiveArcsec: 2341.62, vTotal: 8.53, extinctionV: 0.096 },
  '4365': { sersicN: 7.11, effectiveArcsec: 184.22, vTotal: 9.27, extinctionV: 0.068 },
  '4374': { sersicN: 7.98, effectiveArcsec: 142.08, vTotal: 8.83, extinctionV: 0.131 },
  '4261': { sersicN: 7.49, effectiveArcsec: 99.97, vTotal: 9.96, extinctionV: 0.059 },
  '4382': { sersicN: 6.12, effectiveArcsec: 128.89, vTotal: 8.82, extinctionV: 0.101 },
  '4636': { sersicN: 5.65, effectiveArcsec: 336.03, vTotal: 8.83, extinctionV: 0.09 },
  '4552': { sersicN: 9.22, effectiveArcsec: 138.6, vTotal: 9.47, extinctionV: 0.133 },
  '4621': { sersicN: 5.36, effectiveArcsec: 74.63, vTotal: 9.44, extinctionV: 0.107 },
  '4473': { sersicN: 4.0, effectiveArcsec: 51.79, vTotal: 10.1, extinctionV: 0.092 },
};

/** A Virgo galaxy's own fit, by any of its names that is an NGC number. */
export function ellipticalFit(c: LocalVolumeCatalog, k: number): EllipticalFit | null {
  if (c.sample[k] !== 'evcc') {
    return null;
  }
  for (const name of [c.name[k]!, ...c.otherNames[k]!]) {
    const match = /^NGC\s*0*(\d+)$/i.exec(name.trim());
    const fit = match === null ? undefined : ELLIPTICAL_FITS[match[1]!];
    if (fit !== undefined) {
      return fit;
    }
  }
  return null;
}

/** A catalogue entry as a galaxy. */
export function volumeGalaxy(c: LocalVolumeCatalog, k: number, key = volumeKey(c.name[k]!)): LocalGroupGalaxy {
  const distancePc = c.distancePc[k]!;
  const vMag = c.vMag[k] ?? null;
  const hi = c.logHiMassSun[k] ?? null;
  // Its own B-V, or as the Local Group's: by its gas (localGroup.ts colourIndex).
  const lightForColour = vMag === null ? null : 10 ** (-0.4 * (vMag - 5 * Math.log10(distancePc / 10) - 4.81));
  const bMinusV = c.colourIndex[k] ?? colourIndex(hi === null ? null : 10 ** hi / 1e6, lightForColour);
  const shape = volumeShape(c, k);
  const error = c.distanceErrorPc[k] ?? null;
  const method = distanceMethodLabel(c.distanceMethod[k]!);
  const fit = ellipticalFit(c, k);
  if (fit !== null) {
    const major = Math.tan((fit.effectiveArcsec / 3600) * (Math.PI / 180)) * distancePc;
    const minor = major * shape.axisRatio;
    return {
      key,
      name: c.name[k]!,
      otherNames: c.otherNames[k]!,
      catalogueIndex: null,
      ambiguous: false,
      raDeg: c.raDeg[k]!,
      decDeg: c.decDeg[k]!,
      distancePc,
      distanceUpPc: error,
      distanceDownPc: error,
      distanceSource: c.distanceEstimated[k] ? `${method}, estimated` : method,
      vMag: fit.vTotal - fit.extinctionV,
      colourIndex: bMinusV,
      model: {
        kind: 'sersic',
        majorPc: major,
        minorPc: minor,
        depthPc: Math.sqrt(major * minor),
        positionAngleDeg: shape.positionAngleDeg ?? 0,
        sersicN: fit.sersicN,
      },
      shapeSource: 'Kormendy et al. 2009',
      giant: false,
      volumeIndex: k,
    };
  }
  return {
    key,
    name: c.name[k]!,
    otherNames: c.otherNames[k]!,
    catalogueIndex: null,
    ambiguous: false,
    raDeg: c.raDeg[k]!,
    decDeg: c.decDeg[k]!,
    distancePc,
    distanceUpPc: error,
    distanceDownPc: error,
    distanceSource: c.distanceEstimated[k] ? `${method}, estimated` : method,
    vMag,
    colourIndex: bMinusV,
    model: volumeModel(shape),
    shapeSource: shapeSourceOf(c, k, shape.sizeFrom),
    giant: false,
    volumeIndex: k,
  };
}

// ---------------------------------------------------------------------------------------
// Groups, for the lists

/** Where a galaxy beyond the Local Group is: the Local Volume, or the Virgo Cluster. */
export type VolumeRegion = 'local-volume' | 'virgo';

/** A group of the lists: its name, where it is, and its members, brightest first. */
export interface VolumeGroup {
  readonly label: string;
  readonly region: VolumeRegion;
  readonly members: readonly number[];
}

export function regionOf(c: LocalVolumeCatalog, k: number): VolumeRegion {
  return c.sample[k] === 'evcc' ? 'virgo' : 'local-volume';
}

/** A Local Volume group with fewer members than this is listed with the field, as Others. */
export const LEAST_GROUP = 3;

/**
 * A group's name as the list writes it: "M81" the M81 Group, none the field; in the Virgo
 * Cluster its substructures, "Virgo A" as it is, the W' cloud, and the rest its outskirts.
 */
export function groupLabel(group: string | null, region: VolumeRegion): string {
  const g = (group ?? '').trim();
  if (region === 'virgo') {
    // The tool's substructures (tools/src/localVolume/ virgoPlacement); "Virgo" its outskirts.
    if (g === '' || g === 'Virgo') return 'Outskirts';
    if (g === 'Virgo LVC') return 'Low Velocity Cloud';
    return g.replace(/^Virgo (W'?|M)$/, '$1 Cloud');
  }
  if (g === '') {
    return 'Field';
  }
  return /group|cloud|cluster|sheet|association/i.test(g) ? g : `${g} Group`;
}

// ---------------------------------------------------------------------------------------
// The archive

export interface LocalVolumeArchive {
  /** In the catalogue's order. */
  readonly galaxies: readonly LocalGroupGalaxy[];
  readonly catalog: LocalVolumeCatalog;
  readonly search: Searchable;
  /** The brightest, made bodies once loaded: named on the sky (NAMED_V). */
  readonly named: readonly number[];
  /** The groups, the Local Volume's then Virgo's, each with most members first. */
  readonly groups: readonly VolumeGroup[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseLocalVolumeCatalog(raw: unknown): LocalVolumeCatalog {
  if (!isRecord(raw) || typeof raw['count'] !== 'number' || !Array.isArray(raw['name'])) {
    throw new Error('local-volume.json is not a catalogue of galaxies.');
  }
  for (const [column, values] of Object.entries(raw)) {
    if (Array.isArray(values) && values.length !== raw['count']) {
      throw new Error(`local-volume.json's ${column} does not have one entry each.`);
    }
  }
  return raw as unknown as LocalVolumeCatalog;
}

/** The catalogue last read, for the panels. */
let readCatalog: LocalVolumeCatalog | null = null;

export function localVolumeCatalog(): LocalVolumeCatalog | null {
  return readCatalog;
}

export function indexLocalVolume(catalog: LocalVolumeCatalog): LocalVolumeArchive {
  readCatalog = catalog;
  const used = new Set<string>();
  const galaxies: LocalGroupGalaxy[] = [];
  for (let k = 0; k < catalog.count; k += 1) {
    let key = volumeKey(catalog.name[k]!) || `lv-${k}`;
    if (used.has(key)) {
      key = `${key}-${k}`;
    }
    used.add(key);
    galaxies.push(volumeGalaxy(catalog, k, key));
  }
  const byBrightness = (a: number, b: number) => (catalog.vMag[a] ?? 99) - (catalog.vMag[b] ?? 99);
  const named = galaxies
    .map((_, k) => k)
    .filter((k) => (catalog.vMag[k] ?? Infinity) <= NAMED_V)
    .sort(byBrightness);
  // A Local Volume group of one or two -- a pair, a galaxy and the neighbour it is bound to --
  // is listed with the field.
  const sizes = new Map<string, number>();
  for (let k = 0; k < catalog.count; k += 1) {
    const id = `${regionOf(catalog, k)}:${groupLabel(catalog.group[k] ?? null, regionOf(catalog, k))}`;
    sizes.set(id, (sizes.get(id) ?? 0) + 1);
  }
  const grouped = new Map<string, { region: VolumeRegion; members: number[] }>();
  for (let k = 0; k < catalog.count; k += 1) {
    const region = regionOf(catalog, k);
    const own = groupLabel(catalog.group[k] ?? null, region);
    const label =
      region === 'local-volume' && (own === 'Field' || sizes.get(`${region}:${own}`)! < LEAST_GROUP) ? 'Others' : own;
    const id = `${region}:${label}`;
    let entry = grouped.get(id);
    if (entry === undefined) {
      entry = { region, members: [] };
      grouped.set(id, entry);
    }
    entry.members.push(k);
  }
  const groups = [...grouped.entries()]
    .map(([id, { region, members }]) => ({ label: id.slice(id.indexOf(':') + 1), region, members: members.sort(byBrightness) }))
    // The Local Volume's first; the field and the cluster's outskirts last of each; then by size.
    .sort((a, b) => {
      if (a.region !== b.region) return a.region === 'local-volume' ? -1 : 1;
      const lastA = a.label === 'Others' || a.label === 'Outskirts';
      const lastB = b.label === 'Others' || b.label === 'Outskirts';
      if (lastA !== lastB) return lastA ? 1 : -1;
      return b.members.length - a.members.length || a.label.localeCompare(b.label);
    });
  return {
    galaxies,
    catalog,
    search: {
      display: galaxies.map((galaxy) => normalizeName(galaxy.name)),
      designation: galaxies.map((galaxy) => normalizeName(galaxy.otherNames.join(' '))),
    },
    named,
    groups,
  };
}

export async function loadLocalVolumeArchive(fetchers: BeltFetchers, basePath = '/'): Promise<LocalVolumeArchive | null> {
  const raw = await fetchers.json(`${basePath}data/local-volume.json`);
  if (raw === null) {
    console.warn('The published data has no local-volume.json: nothing beyond the Local Group is shown.');
    return null;
  }
  return indexLocalVolume(parseLocalVolumeCatalog(raw));
}

/** Where a galaxy made a body is, beyond the Local Group; null for one of the Local Group. */
export function volumeRegion(galaxy: LocalGroupGalaxy | null): VolumeRegion | null {
  if (galaxy === null || galaxy.volumeIndex === undefined || readCatalog === null) {
    return null;
  }
  return regionOf(readCatalog, galaxy.volumeIndex);
}

/** The named galaxies made bodies (App.tsx, once loaded): named on the sky, and listed. */
export function ensureNamedVolumeGalaxies(store: EphemerisStore, archive: LocalVolumeArchive): void {
  ensureGalaxyBodies(
    store,
    archive.named.map((k) => archive.galaxies[k]!),
  );
}

/**
 * The Virgo Cluster's centre, for its breadcrumb: M87, at the centre of its main body,
 * cluster A (Mei et al. 2007, ApJ 655, 144) -- or, missing from the data, its brightest member.
 */
export function virgoCentre(archive: LocalVolumeArchive): number | null {
  const names = (k: number) => [archive.catalog.name[k]!, ...archive.catalog.otherNames[k]!].map(normalizeName);
  let brightest: number | null = null;
  for (let k = 0; k < archive.catalog.count; k += 1) {
    if (archive.catalog.sample[k] !== 'evcc') {
      continue;
    }
    if (names(k).some((name) => name === 'm87' || name === 'm 87' || name === 'ngc 4486')) {
      return k;
    }
    if (brightest === null || (archive.catalog.vMag[k] ?? 99) < (archive.catalog.vMag[brightest] ?? 99)) {
      brightest = k;
    }
  }
  return brightest;
}
