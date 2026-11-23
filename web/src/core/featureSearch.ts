import type { BodyId, ConstellationCatalog } from '@sss/tools/types';

import { CMB_DESCRIPTION_ID } from '../descriptions/subjects.ts';
import type { LevelId } from '../state/levels.ts';
import type { FramingView, LayerId } from '../state/store.ts';
import { aliasField, searchNames, type Searchable } from './beltNames.ts';
import { constellationLabels, skyDirection } from './constellations.ts';
import { BUBBLES } from './galacticBubbles.ts';
import { armLabelPoints, barLabelPoint } from './milkyWay.ts';
import { normalizeName } from './normalizeName.ts';
import { PARSEC_KM } from './stars3d.ts';
import { toScene, type StreamsFile } from './streams.ts';
import type { Vec3 } from './vec3.ts';

/**
 * What the app draws and names but is no body -- a constellation, a stellar stream, a spiral arm,
 * the Fermi bubbles, the Local Bubble, the cosmic microwave background -- as search results:
 * their names are on the screen, and searching them found nothing (Maxi, 2026-11-23). Each says
 * which layers draw it, switched on when it is chosen, and where to stand to see it: a breadcrumb
 * level, as its crumb goes, or a body to focus and a distance (and a direction) to frame it from.
 *
 * Kept free of React and of the store, as search.ts is: the matching is the name indexes' own
 * (beltNames.ts searchNames), the names here a small index of their own.
 */

/** Where choosing a feature goes. */
export type FeatureGo =
  | { readonly kind: 'level'; readonly level: LevelId }
  | { readonly kind: 'frame'; readonly focus: BodyId; readonly km: number; readonly view: FramingView | null };

export interface FeatureEntry {
  /** Unique among the features: the list's key. */
  readonly key: string;
  /** As its label writes it. */
  readonly name: string;
  /** The line under its name. */
  readonly detail: string;
  readonly otherNames: readonly string[];
  /** Switched on when it is chosen: what draws it, and its name. */
  readonly layers: readonly LayerId[];
  readonly go: FeatureGo;
  /** Its description's id, where it has one. */
  readonly about: BodyId | null;
}

const LY_KM = 9_460_730_472_580.8;
const EARTH_RADIUS_KM = 6_371;
const AU_KM = 149_597_870.7;

/** The Milky Way model's names (scene/MilkyWay.tsx GALAXY_LABELS) but the centre's, which is Sgr A*'s. */
function galaxyModelFeatures(): FeatureEntry[] {
  const arms = armLabelPoints().map(
    ({ name }): FeatureEntry => ({
      key: `arm-${name}`,
      name,
      detail: 'Spiral arm · modelled',
      // The Sun's own arm, by its other names.
      otherNames: name === 'Local Arm' ? ['Orion Arm', 'Orion–Cygnus Arm', 'Orion Spur'] : [],
      layers: ['milkyWay'],
      go: { kind: 'level', level: 'milky-way' },
      about: null,
    }),
  );
  const bar = barLabelPoint();
  return [
    ...arms,
    {
      key: 'galactic-bar',
      name: bar.name,
      detail: 'The Galaxy’s bar · modelled',
      otherNames: ['Long Bar'],
      layers: ['milkyWay'],
      go: { kind: 'level', level: 'milky-way' },
      about: null,
    },
  ];
}

/** The names drawn by layers of their own, with no catalogue behind them. */
function namedFeatures(): FeatureEntry[] {
  return [
    ...BUBBLES.map(
      (bubble): FeatureEntry => ({
        key: `bubbles-${bubble.key}`,
        name: bubble.name,
        detail: 'Galactic bubbles · measured outline',
        otherNames: bubble.key === 'fermi' ? ['Fermi bubble'] : ['eROSITA bubble'],
        layers: ['galacticBubbles'],
        // Shown from out in the galaxy, past 1,500 pc from the Sun: the galaxy whole, as its crumb.
        go: { kind: 'level', level: 'milky-way' },
        about: null,
      }),
    ),
    // scene/LocalInterstellar.tsx NAMES: about the Sun, each from far enough to be seen whole.
    {
      key: 'local-bubble',
      name: 'Local Bubble',
      detail: 'Cavity of hot gas about the Sun',
      otherNames: [],
      layers: ['localInterstellar'],
      // Three of its mean radii (225 pc) out: the layer fades it as it comes to fill the view.
      go: { kind: 'frame', focus: 'sun', km: 2_500 * LY_KM, view: null },
      about: null,
    },
    {
      key: 'radcliffe-wave',
      name: 'Radcliffe Wave',
      detail: 'Wave of gas clouds',
      otherNames: [],
      layers: ['localInterstellar'],
      go: { kind: 'frame', focus: 'sun', km: 12_000 * LY_KM, view: null },
      about: null,
    },
    {
      key: 'local-interstellar-cloud',
      name: 'Local Interstellar Cloud',
      detail: 'Interstellar cloud the Sun is in',
      otherNames: ['LIC', 'Local Fluff'],
      layers: ['localInterstellar'],
      go: { kind: 'frame', focus: 'sun', km: 30 * LY_KM, view: null },
      about: null,
    },
    // scene/LocalStructure.tsx NAMES, from the levels whose scale they are on.
    {
      key: 'zero-velocity-surface',
      name: 'Zero-velocity surface',
      detail: 'Local Group’s edge · computed',
      otherNames: [],
      layers: ['localStructure'],
      go: { kind: 'level', level: 'local-group' },
      about: null,
    },
    {
      key: 'council-of-giants',
      name: 'Council of Giants',
      detail: 'Ring of large galaxies · McCall 2014',
      otherNames: [],
      layers: ['localStructure'],
      go: { kind: 'level', level: 'local-volume' },
      about: null,
    },
    {
      key: 'local-sheet',
      name: 'Local Sheet',
      detail: 'Plane of nearby galaxies · McCall 2014',
      otherNames: [],
      layers: ['localStructure'],
      go: { kind: 'level', level: 'local-volume' },
      about: null,
    },
    // The observable universe's wall (App.tsx draws its name), its description the CMB's own.
    {
      key: 'cmb',
      name: 'Cosmic microwave background',
      detail: 'The oldest light · Planck',
      otherNames: ['CMB', 'Cosmic microwave background radiation'],
      layers: ['observableUniverse'],
      go: { kind: 'level', level: 'observable-universe' },
      about: CMB_DESCRIPTION_ID,
    },
    // Shells named on the heliosphere's and the magnetosphere's layers that are no region body.
    {
      key: 'hills-cloud',
      name: 'Inner Oort cloud (Hills)',
      detail: 'Comet cloud · inferred',
      otherNames: ['Hills cloud', 'inner Oort cloud'],
      layers: ['heliosphere'],
      go: { kind: 'frame', focus: 'sun', km: 60_000 * AU_KM, view: null },
      about: null,
    },
    {
      key: 'van-allen-belts',
      name: 'Van Allen belts',
      detail: 'Radiation belts · typical',
      otherNames: ['Van Allen radiation belts'],
      layers: ['magnetosphere'],
      go: { kind: 'frame', focus: 'earth', km: 15 * EARTH_RADIUS_KM, view: null },
      about: null,
    },
    {
      key: 'karman-line',
      name: 'Kármán line',
      detail: 'Edge of space · 100 km',
      otherNames: ['Karman line', 'edge of space'],
      layers: ['magnetosphere'],
      go: { kind: 'frame', focus: 'earth', km: 5 * EARTH_RADIUS_KM, view: null },
      about: null,
    },
  ];
}

/** The features named whether or not any catalogue is in. */
export function staticFeatures(): FeatureEntry[] {
  return [...galaxyModelFeatures(), ...namedFeatures()];
}

function unit(v: Vec3): Vec3 {
  const n = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / n, y: v.y / n, z: v.z / n };
}

/** A view looking along `toward` -- the camera behind the focus, the thing beyond it -- with `north` up. */
function lookingToward(toward: Vec3, north: Vec3): FramingView {
  const d = unit(toward);
  const along = north.x * d.x + north.y * d.y + north.z * d.z;
  const upRaw = { x: north.x - along * d.x, y: north.y - along * d.y, z: north.z - along * d.z };
  const up = Math.hypot(upRaw.x, upRaw.y, upRaw.z) < 1e-6 ? { x: 1, y: 0, z: 0 } : unit(upRaw);
  return { direction: [-d.x, -d.y, -d.z], up: [up.x, up.y, up.z] };
}

/**
 * The constellations, by every name their labels write: seen from Earth's side away from them,
 * 2 million km out, celestial north up -- Earth small in front of the figure, as from the ground.
 */
export function constellationFeatures(catalog: ConstellationCatalog): FeatureEntry[] {
  const north = skyDirection(0, 90);
  // A constellation written in two places is one result, at its first label.
  const seen = new Set<string>();
  const labels = constellationLabels(catalog).filter((label) => !seen.has(label.name) && seen.add(label.name) !== null);
  return labels.map(
    (label, k): FeatureEntry => ({
      key: `constellation-${k}`,
      name: label.name,
      detail: 'Constellation',
      otherNames: [],
      layers: ['constellations'],
      go: { kind: 'frame', focus: 'earth', km: 2e6, view: lookingToward(label.direction, north) },
      about: null,
    }),
  );
}

/**
 * The stellar streams, by name: the Sun in focus, framed from two and a half times the stream's
 * farthest point, looking at it -- the ecliptic's north up.
 */
export function streamFeatures(file: StreamsFile): FeatureEntry[] {
  return file.streams.map((stream, k): FeatureEntry => {
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    let farthest = 0;
    for (const piece of stream.pieces) {
      for (let i = 0; i + 2 < piece.length; i += 3) {
        const [x, y, z] = toScene(piece[i]!, piece[i + 1]!, piece[i + 2]!);
        sx += x;
        sy += y;
        sz += z;
        n += 1;
        farthest = Math.max(farthest, Math.hypot(x, y, z));
      }
    }
    const centre = n === 0 || Math.hypot(sx, sy, sz) === 0 ? null : { x: sx / n, y: sy / n, z: sz / n };
    return {
      key: `stream-${k}`,
      name: stream.name,
      detail: 'Stellar stream',
      otherNames: stream.galstreams === stream.name ? [] : [stream.galstreams],
      layers: ['stellarStreams'],
      go: {
        kind: 'frame',
        focus: 'sun',
        km: Math.max(2.5 * farthest, 1_000) * PARSEC_KM,
        view: centre === null ? null : lookingToward(centre, { x: 0, y: 0, z: 1 }),
      },
      about: null,
    };
  });
}

/** Features made searchable: their names, and their other names, as a name index makes them. */
export interface FeatureIndex extends Searchable {
  readonly entries: readonly FeatureEntry[];
}

export function featureIndex(entries: readonly FeatureEntry[]): FeatureIndex {
  return {
    entries,
    display: entries.map((entry) => normalizeName(entry.name)),
    designation: entries.map((entry) => aliasField(entry.otherNames)),
  };
}

/** The features `query` names, best first, each with searchNames's score (EXACT_NAME_SCORE for a name typed whole). */
export function searchFeatures(index: FeatureIndex, query: string, limit = 12): { readonly entry: FeatureEntry; readonly score: number }[] {
  return searchNames(index, query, limit).map(({ k, score }) => ({ entry: index.entries[k]!, score }));
}
