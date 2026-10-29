import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { colorIndexToTemperature, starColor, surfaceLuminanceRelativeToSun } from '../scene/blackbody.ts';
import { componentState, matchComponent, measuredMassSun, measuredRadiusKm } from './alphaCentauri.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { STAR3D, STAR3D_FLOATS, starState, type StarNameIndex, type Stars3dSource } from './stars3d.ts';

/**
 * A catalogue star made into a body the camera can go to, as a comet or a belt asteroid is
 * (cometBodies.ts, beltBodies.ts): chosen from search, added to the store with no table,
 * placed every frame by its own linear space motion about the Sun -- the catalogue's
 * model, r(t) = r + v (t - J2000) -- and drawn by the star renderer, which already draws
 * its light. As a body it gains what a point lacks: a marker, a name on screen, a place
 * in the breadcrumb and the info panel.
 *
 * Kind 'star', the Sun's kind. A sphere only where a radius has been measured -- Alpha
 * Centauri's three so far (D3b) -- since none of the catalogues it comes from publishes
 * one; every other star is a marker at any range (`radiusPublished: false`), framed by a
 * nominal radius that is the Sun's -- a number for the camera to stand off by, and said to
 * be one.
 */

export function starBodyId(tier: number, index: number): BodyId {
  return `star-${tier}-${index}`;
}

export function parseStarBodyId(id: BodyId): { readonly tier: number; readonly index: number } | null {
  const match = /^star-(\d+)-(\d+)$/.exec(id);
  return match === null ? null : { tier: Number(match[1]), index: Number(match[2]) };
}

/** The nominal solar radius stellar radii are counted in, km (IAU 2015 B3). */
const SOLAR_RADIUS_KM = 695_700;

/** True for a catalogue star made a body: a star that is not the Sun. */
export function isCatalogueStar(body: BodyDefinition): boolean {
  return body.kind === 'star' && body.id !== 'sun';
}

/**
 * The radius a star body is framed by, km: the Sun's. **Not a measurement** -- the
 * catalogues give none -- and the body says so (`radiusPublished: false`). Eight of them is
 * 0.037 AU, close enough that the star is the brightest thing on screen by far.
 */
export const STAR_FRAMING_RADIUS_KM = 695_700;

/** What the info panel says about a star body, from names.json and its record. */
export interface StarBodyFacts {
  readonly tier: number;
  readonly index: number;
  /** Its ten floats, kept: what the panel reads its distance, motion and photometry from. */
  readonly record: Float32Array;
  readonly iau: boolean;
  readonly designations: readonly string[];
  readonly system: string | null;
  readonly nearest: number | null;
  readonly spectralType: string | null;
}

const facts = new Map<BodyId, StarBodyFacts>();

export function starBodyFacts(id: BodyId): StarBodyFacts | null {
  return facts.get(id) ?? null;
}

/** A linear colour at unit luminance as a CSS hex, brightest channel at full: a marker's colour. */
export function colorHex(linear: readonly [number, number, number]): string {
  const peak = Math.max(...linear, 1e-9);
  const encode = (value: number): string => {
    const v = value / peak;
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${encode(linear[0])}${encode(linear[1])}${encode(linear[2])}`;
}

/**
 * The body a star record becomes: a marker in the star's own colour, and its name -- and,
 * for a star whose radius has been measured (Alpha Centauri's three, alphaCentauri.ts), a
 * sphere of that radius, drawn as the Sun's is (SolarSystem.tsx, starDiscExposure).
 */
export function starBodyDefinition(
  id: BodyId,
  name: string,
  bv: number,
  measuredRadiusKm: number | null = null,
  measuredMassSun: number | null = null,
): BodyDefinition {
  // A measured mass is what a planet's orbit about the star is drawn with (proximaPlanets.ts).
  const gm = measuredMassSun === null ? 0 : measuredMassSun * 1.3271244e11;
  const radius = measuredRadiusKm ?? STAR_FRAMING_RADIUS_KM;
  return {
    id,
    name,
    horizonsId: '',
    center: '500@10',
    elementsCenter: '500@10',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'star',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: gm,
    gmBodyOnlyKm3S2: gm,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: colorHex(starColor(bv)),
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
    radiusPublished: measuredRadiusKm !== null,
    shapeDrawn: measuredRadiusKm !== null,
  };
}

/** Each star body's disc exposure against the Sun's, and its colour index, where it has a disc. */
const discExposures = new Map<BodyId, number>();
const discColorIndices = new Map<BodyId, number>();

/**
 * Gives a star body that is not a 3D star's record -- an Exoplanet Archive host placed from
 * the Archive (archiveSystems.ts) -- its disc's colour index, and so its colour and
 * brightness, as addStarBody gives a record's.
 */
export function setStarDisc(id: BodyId, colorIndex: number): void {
  discExposures.set(id, surfaceLuminanceRelativeToSun(colorIndexToTemperature(colorIndex)));
  discColorIndices.set(id, colorIndex);
}

/** A star body's colour index, for its disc's colour: the Sun's 0.65 for any other body. */
export function starDiscColorIndex(id: BodyId): number {
  return discColorIndices.get(id) ?? 0.65;
}

/**
 * How bright a star body's disc is drawn against the Sun's: its surface luminance over
 * the Sun's, at the temperature its colour index gives (blackbody.ts) -- the same path its
 * colour takes, so the two cannot disagree. 1 for any other body.
 */
export function starDiscExposure(id: BodyId): number {
  return discExposures.get(id) ?? 1;
}

/** How many star bodies are kept once made: the stars of a short tour, with their names. */
export const STAR_BODIES_KEPT = 12;

/** The star bodies added and still in the store, oldest first. */
const added: BodyId[] = [];

/**
 * Star bodies that stay whatever else is gone to: Alpha Centauri's three and the stars of
 * the planetary systems, made bodies at start so they are named on the sky and can be gone
 * to from it (alphaCenBodies.ts, planetarySystems.ts).
 */
const pinned = new Set<BodyId>();

/**
 * Makes entry `k` of the star names a body in `store` and returns its id, reading its
 * record from its tier -- or on its own, if the tier is not in yet. The oldest go once
 * there are more than STAR_BODIES_KEPT, unless it is `keep`, the body the camera is on.
 * `massSun`, a star's published mass, is what its planets' orbits are drawn with, and
 * `radiusSun`, its measured radius, makes it a disc (planetarySystems.ts); Alpha
 * Centauri's three have theirs from alphaCentauri.ts.
 */
export async function addStarBody(
  store: EphemerisStore,
  source: Stars3dSource,
  names: StarNameIndex,
  k: number,
  keep: BodyId,
  pin = false,
  massSun: number | null = null,
  radiusSun: number | null = null,
): Promise<BodyId> {
  const { names: columns } = names;
  return addStarRecordBody(
    store,
    source,
    columns.tier[k]!,
    columns.index[k]!,
    {
      display: columns.display[k]!,
      iau: columns.iau[k] ?? false,
      designations: columns.designations[k] ?? [],
      system: columns.system[k] ?? null,
      nearest: columns.nearest[k] ?? null,
      spectralType: columns.spectralType[k] ?? null,
    },
    keep,
    pin,
    massSun,
    radiusSun,
  );
}

/** What names.json says of a star -- or, for one it does not name, what is known of it. */
export interface StarEntry {
  readonly display: string;
  readonly iau: boolean;
  readonly designations: readonly string[];
  readonly system: string | null;
  readonly nearest: number | null;
  readonly spectralType: string | null;
}

/**
 * Makes record `index` of tier `tier` a body, named by `entry`: addStarBody's work, for a
 * star found by its record rather than by its name -- an Exoplanet Archive host, most of
 * which names.json does not list (archiveSystems.ts). If the star is a body already it is
 * kept as it is, and only moved to the front of the queue.
 */
export async function addStarRecordBody(
  store: EphemerisStore,
  source: Stars3dSource,
  tier: number,
  index: number,
  entry: StarEntry,
  keep: BodyId,
  pin = false,
  massSun: number | null = null,
  radiusSun: number | null = null,
): Promise<BodyId> {
  const id = starBodyId(tier, index);
  if (!store.isPropagatedBody(id)) {
    const record = new Float32Array(await source.record(tier, index));
    if (record.length !== STAR3D_FLOATS) {
      throw new Error(`Star ${id} has no record.`);
    }
    facts.set(id, {
      tier,
      index,
      record,
      iau: entry.iau,
      designations: entry.designations,
      system: entry.system,
      nearest: entry.nearest,
      spectralType: entry.spectralType,
    });
    // Exact: the linear motion is how the catalogue is meant to be read, not a fallback
    // from something better, so the interface does not call it APPROXIMATE. Alpha
    // Centauri A and B are the exception: they follow their measured orbit instead
    // (alphaCentauri.ts), which a straight line from 1991 has long since left.
    const at = { x: record[STAR3D.x]!, y: record[STAR3D.y]!, z: record[STAR3D.z]! };
    const component = matchComponent(at);
    const radiusKm = measuredRadiusKm(at) ?? (radiusSun === null ? null : radiusSun * SOLAR_RADIUS_KM);
    if (radiusKm !== null) {
      discExposures.set(id, surfaceLuminanceRelativeToSun(colorIndexToTemperature(record[STAR3D.bv]!)));
      discColorIndices.set(id, record[STAR3D.bv]!);
    }
    store.addPropagatedBody(
      starBodyDefinition(id, entry.display, record[STAR3D.bv]!, radiusKm, measuredMassSun(at) ?? massSun),
      null,
      component === null ? (jd) => starState(record, 0, jd) : (jd) => componentState(component, jd),
      { exact: true },
    );
  }
  const at = added.indexOf(id);
  if (at >= 0) {
    added.splice(at, 1);
  }
  added.push(id);
  if (pin) {
    pinned.add(id);
  }
  while (added.filter((candidate) => !pinned.has(candidate)).length > STAR_BODIES_KEPT) {
    const oldest = added.findIndex(
      (candidate) => candidate !== keep && candidate !== id && !pinned.has(candidate),
    );
    if (oldest < 0) {
      break;
    }
    const [gone] = added.splice(oldest, 1);
    store.removePropagatedBody(gone!);
    facts.delete(gone!);
    discExposures.delete(gone!);
    discColorIndices.delete(gone!);
  }
  return id;
}
