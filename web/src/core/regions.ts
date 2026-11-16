import type { BodyDefinition, BodyId } from '@sss/tools/types';

/**
 * The Solar System's regions made bodies (kind 'region'): points that are computed rather than
 * observed -- the Lagrange points (lagrange.ts) -- and the marks on boundaries that are modelled
 * rather than seen -- the heliopause's nose, the Voyagers' crossings (heliosphere.ts), the
 * magnetopause's (magnetosphere.ts). None is an object: each is a place, made a body so that it
 * is named, found by search and can be gone to, with a panel saying what of it is measured.
 *
 * Each belongs to one of three layers, switched by pseudo-kinds as the record-holders' layer is
 * (scene/floatingOrigin.ts isShown): every one of them is also of the kind 'region', which each
 * layer lists too, so the label pass's kind test lets them through.
 */

/** The pseudo-kinds the three layers switch them by (App.tsx LAYER_KINDS). */
export type RegionLayer = 'lagrange-point' | 'heliosphere' | 'magnetosphere';

export interface RegionFact {
  readonly label: string;
  readonly value: string;
}

export interface Region {
  readonly id: BodyId;
  readonly name: string;
  readonly layer: RegionLayer;
  /** What it is, a few words, for the search and the panel: "Lagrange point", "Crossing · measured". */
  readonly kindLabel: string;
  /** True for a place measured (a Voyager crossing); false for one computed or modelled. */
  readonly measured: boolean;
  /** The panel's rows, every number with where it comes from. */
  readonly facts: readonly RegionFact[];
  /** How far from it the camera stands when it is gone to, km. */
  readonly framingKm: number;
  /** Its parent in the frame tree: Earth for what moves with Earth, null for what is about the Sun. */
  readonly parent: BodyId | null;
  readonly color: string;
  /**
   * A shell about the Sun -- the Oort cloud -- made a body at the Sun's centre so that it can be
   * found and gone to: it has no place of its own, so the panel gives no distance to it.
   */
  readonly centredOnSun?: boolean;
}

const regions = new Map<BodyId, Region>();

/** Registers a region; the same id twice keeps the first. */
export function registerRegion(region: Region): void {
  if (!regions.has(region.id)) regions.set(region.id, region);
}

export function regionOf(id: BodyId | null): Region | null {
  return id === null ? null : (regions.get(id) ?? null);
}

/** The layer each pseudo-kind belongs to, for search.ts layersFor. */
export const REGION_LAYER_IDS = {
  'lagrange-point': 'lagrangePoints',
  heliosphere: 'heliosphere',
  magnetosphere: 'magnetosphere',
} as const satisfies Record<RegionLayer, string>;

/**
 * A region's body: a point, of no size -- a kilometre for the camera to keep clear of -- and
 * marked, never a sphere (shapeDrawn false, so its name sits on its mark).
 */
export function regionDefinition(region: Region): BodyDefinition {
  return {
    id: region.id,
    name: region.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: region.parent,
    kind: 'region',
    radiusEquatorialKm: 1,
    radiusPolarKm: 1,
    triaxialRadiiKm: null,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    color: region.color,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
    radiusPublished: false,
    shapeDrawn: false,
  };
}
