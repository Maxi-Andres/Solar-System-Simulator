import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { starColor } from '../scene/blackbody.ts';
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
 * Kind 'star', the Sun's kind. Never a sphere: none of the catalogues it comes from
 * publishes a radius, so it is a marker at any range (`radiusPublished: false`), framed by
 * a nominal radius that is the Sun's -- a number for the camera to stand off by, and said
 * to be one.
 */

export function starBodyId(tier: number, index: number): BodyId {
  return `star-${tier}-${index}`;
}

export function parseStarBodyId(id: BodyId): { readonly tier: number; readonly index: number } | null {
  const match = /^star-(\d+)-(\d+)$/.exec(id);
  return match === null ? null : { tier: Number(match[1]), index: Number(match[2]) };
}

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

/** The body a star record becomes: a marker in the star's own colour, and its name. */
export function starBodyDefinition(id: BodyId, name: string, bv: number): BodyDefinition {
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
    radiusEquatorialKm: STAR_FRAMING_RADIUS_KM,
    radiusPolarKm: STAR_FRAMING_RADIUS_KM,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: colorHex(starColor(bv)),
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
    radiusPublished: false,
    shapeDrawn: false,
  };
}

/** How many star bodies are kept once made: the stars of a short tour, with their names. */
export const STAR_BODIES_KEPT = 12;

/** The star bodies added and still in the store, oldest first. */
const added: BodyId[] = [];

/**
 * Makes entry `k` of the star names a body in `store` and returns its id, reading its
 * record from its tier -- or on its own, if the tier is not in yet. The oldest go once
 * there are more than STAR_BODIES_KEPT, unless it is `keep`, the body the camera is on.
 */
export async function addStarBody(
  store: EphemerisStore,
  source: Stars3dSource,
  names: StarNameIndex,
  k: number,
  keep: BodyId,
): Promise<BodyId> {
  const { names: columns } = names;
  const tier = columns.tier[k]!;
  const index = columns.index[k]!;
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
      iau: columns.iau[k] ?? false,
      designations: columns.designations[k] ?? [],
      system: columns.system[k] ?? null,
      nearest: columns.nearest[k] ?? null,
      spectralType: columns.spectralType[k] ?? null,
    });
    // Exact: the linear motion is how the catalogue is meant to be read, not a fallback
    // from something better, so the interface does not call it APPROXIMATE.
    store.addPropagatedBody(
      starBodyDefinition(id, columns.display[k]!, record[STAR3D.bv]!),
      null,
      (jd) => starState(record, 0, jd),
      { exact: true },
    );
  }
  const at = added.indexOf(id);
  if (at >= 0) {
    added.splice(at, 1);
  }
  added.push(id);
  while (added.length > STAR_BODIES_KEPT) {
    const oldest = added.findIndex((candidate) => candidate !== keep && candidate !== id);
    if (oldest < 0) {
      break;
    }
    const [gone] = added.splice(oldest, 1);
    store.removePropagatedBody(gone!);
    facts.delete(gone!);
  }
  return id;
}
