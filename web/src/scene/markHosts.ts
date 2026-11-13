import type { BodyDefinition, BodyId, LocalVolumeCatalog } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { SGR_A_ID } from '../core/blackHoles.ts';
import {
  basinAt,
  groupOf,
  laniakeaCatalogue,
  positionPc as laniakeaPositionPc,
  structureBodyId,
  structureOf,
  type LaniakeaCatalogue,
} from '../core/laniakea.ts';
import { galaxyOf, galaxyPositionPc, GIANTS, type LocalGroupGalaxy } from '../core/localGroup.ts';
import { localVolumeCatalog, regionOf, virgoCentre } from '../core/localVolume.ts';
import { galacticCentrePc } from '../core/milkyWay.ts';
import type { Vec3 } from '../core/vec3.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { LOCAL_GROUP_EXTENT_KM, LOCAL_VOLUME_EXTENT_KM, MILKY_WAY_EXTENT_KM } from './homeName.ts';
import { FoldHosts, UNFOLDED, type FoldOf } from './markFolding.ts';
import { KM_PER_UNIT, PARSEC_KM } from './scale.ts';

/**
 * Who folds into whom (markFolding.ts): the hosts of this sky, and each mark's.
 *
 * - **The Milky Way**, at its centre, where its name is: everything in it -- the globular
 *   clusters, the pulsars, the remnants, the black holes, the stars and the Sun with all that
 *   goes round it. Sgr A*'s mark is the galaxy's own. Three hosts in one place, one inside the
 *   next, each with the reach its members fold by (markFolding.ts): the galaxy itself, its
 *   members folded as its disc shrinks on the screen as homeName.ts folds its names
 *   (MILKY_WAY_EXTENT_KM); its satellites, as SATELLITE_REACH_PC does; and the Local Group, as
 *   its megaparsec does. From afar its name is the Local Group's (homeName.ts), and so is its
 *   mark.
 * - **Andromeda**, its host the Local Group's. The Local Group's other galaxies by where they
 *   are (McConnachie 2012, AJ 144, 4, distances, as positions here): within SATELLITE_REACH_PC
 *   of Andromeda and nearer it than the Milky Way, a satellite of Andromeda's; within it of the
 *   Milky Way, the Milky Way's; any other, the Local Group's.
 * - **Beyond the Local Group**, each Local Volume group's brightest galaxy (local-volume.json's
 *   `group`), by luminosity: its members fold into it, and it into the Local Volume. A galaxy
 *   of no group, or alone in its group, into the Local Volume.
 * - **The Virgo Cluster**: M87 at its centre (localVolume.ts virgoCentre), for its main body,
 *   Virgo A, and its outskirts; each other substructure's brightest for that substructure's, and
 *   they into M87.
 *
 * - **The Local Volume**, its 11 Mpc about home: the Local Group and each of its groups fold
 *   into it as its reach shrinks on the screen, as homeName.ts folds their names
 *   (LOCAL_VOLUME_EXTENT_KM). Its mark is the Milky Way's.
 * - **Laniakea's galaxies** (G3, laniakea.ts): each group's brightest the host of its group,
 *   its reach the group's radius (laniakea.ts indexGroups) -- and present only while that is
 *   large on the screen (markFolding.ts), so ten thousand groups are not ten thousand marks
 *   from afar, only their light. A named cluster's group folds into the cluster's own mark, a
 *   body of its own, its reach its radius.
 * - **The named structures** (laniakea.ts landmarks, made bodies): a cluster into the
 *   supercluster or the attractor within CLUSTER_IN_SUPERCLUSTER_PC of it, nearest first; a
 *   supercluster, and a cluster in none, into the basin the galaxies' watersheds put it in
 *   (Dupuy & Courtois 2023); a basin, a void, a wall, a repeller into nothing. And all of them
 *   only once out of the Local Group (STRUCTURES_FROM_LY): from the Solar System they are not
 *   a second sky of names.
 */

/** The reach of a giant's satellites, pc: the virial radius both the Milky Way and Andromeda are given. */
export const SATELLITE_REACH_PC = 300_000;

/** Every host, the Milky Way first. */
export const MARK_HOSTS = new FoldHosts();

/** The Galactic Centre about the Sun, scene frame, pc. */
export const GALACTIC_CENTRE_SCENE_PC: readonly [number, number, number] = (() => {
  const [x, y, z] = galacticCentrePc();
  const { x: ex, y: ey, z: ez } = GALACTIC_BASIS;
  return [ex.x * x + ey.x * y + ez.x * z, ex.y * x + ey.y * y + ez.y * z, ex.z * x + ey.z * y + ez.z * z];
})();

/** The Local Group's reach, pc, the extent homeName.ts folds its names by: the Milky Way's mark is the Local Group's. */
export const LOCAL_GROUP_REACH_PC = LOCAL_GROUP_EXTENT_KM / PARSEC_KM;

/** The Local Volume's reach, pc (homeName.ts LOCAL_VOLUME_EXTENT_KM): its groups', and the Local Group's, mark is the Milky Way's. */
export const LOCAL_VOLUME_REACH_PC = LOCAL_VOLUME_EXTENT_KM / PARSEC_KM;

export const LOCAL_VOLUME_HOST = MARK_HOSTS.add('local-volume', GALACTIC_CENTRE_SCENE_PC, null, LOCAL_VOLUME_REACH_PC);
export const LOCAL_GROUP_HOST = MARK_HOSTS.add('local-group', GALACTIC_CENTRE_SCENE_PC, 'local-volume', LOCAL_GROUP_REACH_PC);
export const MILKY_WAY_SATELLITES_HOST = MARK_HOSTS.add(
  'milky-way-satellites',
  GALACTIC_CENTRE_SCENE_PC,
  'local-group',
  SATELLITE_REACH_PC,
);
export const MILKY_WAY_HOST = MARK_HOSTS.add(
  'milky-way',
  GALACTIC_CENTRE_SCENE_PC,
  'milky-way-satellites',
  MILKY_WAY_EXTENT_KM / PARSEC_KM,
);

const tuple = (v: Vec3): [number, number, number] => [v.x, v.y, v.z];
const andromeda = GIANTS.find((giant) => giant.key === 'm31')!;
const ANDROMEDA_HOST = MARK_HOSTS.add('m31', tuple(galaxyPositionPc(andromeda)), 'local-group', SATELLITE_REACH_PC);

// ---------------------------------------------------------------------------------------
// The Local Group

const localGroupFolds = new Map<string, FoldOf>();

/** A Local Group galaxy's host, by where it is (see the header). */
function localGroupFold(galaxy: LocalGroupGalaxy): FoldOf {
  const known = localGroupFolds.get(galaxy.key);
  if (known !== undefined) {
    return known;
  }
  const at = tuple(galaxyPositionPc(galaxy));
  const fromMilkyWay = MARK_HOSTS.distancePc(MILKY_WAY_HOST, at);
  const fromAndromeda = MARK_HOSTS.distancePc(ANDROMEDA_HOST, at);
  const fold =
    galaxy.key === andromeda.key
      ? MARK_HOSTS.foldOf(ANDROMEDA_HOST)
      : fromAndromeda < SATELLITE_REACH_PC && fromAndromeda < fromMilkyWay
        ? { host: ANDROMEDA_HOST, separationPc: fromAndromeda }
        : fromMilkyWay < SATELLITE_REACH_PC
          ? { host: MILKY_WAY_SATELLITES_HOST, separationPc: fromMilkyWay }
          : { host: LOCAL_GROUP_HOST, separationPc: fromMilkyWay };
  localGroupFolds.set(galaxy.key, fold);
  return fold;
}

// ---------------------------------------------------------------------------------------
// Beyond: the Local Volume's groups and the Virgo Cluster's substructures

interface VolumeFolds {
  readonly catalog: LocalVolumeCatalog;
  readonly folds: readonly FoldOf[];
  /** The host each galaxy is the mark of, -1 none. */
  readonly marks: Int32Array;
}

let volume: VolumeFolds | null = null;

function luminosity(c: LocalVolumeCatalog, k: number): number {
  const v = c.vMag[k];
  return v == null ? 0 : 10 ** (-0.4 * (v - 5 * Math.log10(c.distancePc[k]! / 10)));
}

/** The groups' hosts and every galaxy's fold, once for a catalogue. */
export function volumeFolds(c: LocalVolumeCatalog): VolumeFolds {
  if (volume !== null && volume.catalog === c) {
    return volume;
  }
  const at = (k: number): [number, number, number] => [c.x[k]!, c.y[k]!, c.z[k]!];
  const members = new Map<string, number[]>();
  // The Virgo Cluster's main body and outskirts are M87's; any other substructure its own.
  const virgoKey = (g: string) => (g === '' || g === 'Virgo' || g === 'Virgo A' ? 'virgo' : `virgo:${g}`);
  for (let k = 0; k < c.count; k += 1) {
    const g = (c.group[k] ?? '').trim();
    const key = regionOf(c, k) === 'virgo' ? virgoKey(g) : g === '' ? null : `lv:${g}`;
    if (key !== null) {
      const list = members.get(key) ?? [];
      list.push(k);
      members.set(key, list);
    }
  }
  const brightest = (list: readonly number[]) =>
    list.reduce((best, k) => (luminosity(c, k) > luminosity(c, best) ? k : best), list[0]!);
  const marks = new Int32Array(c.count).fill(-1);
  const m87 = virgoCentre({ catalog: c });
  if (m87 !== null) {
    marks[m87] = MARK_HOSTS.add('virgo', at(m87), null);
  }
  for (const [key, list] of members) {
    if (key === 'virgo') continue;
    // A group of one is no group: it folds into nothing.
    if (list.length < 2 && !key.startsWith('virgo:')) continue;
    const mark = brightest(list);
    marks[mark] = MARK_HOSTS.add(key, at(mark), key.startsWith('virgo:') && m87 !== null ? 'virgo' : key.startsWith('virgo:') ? null : 'local-volume');
  }
  const folds: FoldOf[] = [];
  for (let k = 0; k < c.count; k += 1) {
    if (marks[k]! >= 0) {
      folds.push(MARK_HOSTS.foldOf(marks[k]!));
      continue;
    }
    const g = (c.group[k] ?? '').trim();
    const key = regionOf(c, k) === 'virgo' ? virgoKey(g) : g === '' ? null : `lv:${g}`;
    // A galaxy of no group, or alone in its own, is the Local Volume's own.
    const own = key === null ? -1 : MARK_HOSTS.indexOf(key);
    const host = own < 0 && regionOf(c, k) === 'local-volume' ? LOCAL_VOLUME_HOST : own;
    folds.push(host < 0 ? UNFOLDED : { host, separationPc: MARK_HOSTS.distancePc(host, at(k)) });
  }
  volume = { catalog: c, folds, marks };
  return volume;
}

// ---------------------------------------------------------------------------------------
// Marks

/** A galaxy's host and its distance from it. */
export function galaxyFold(galaxy: LocalGroupGalaxy): FoldOf {
  if (galaxy.laniakeaIndex !== undefined) {
    const lc = laniakeaCatalogue();
    return lc === null ? UNFOLDED : laniakeaFolds(lc).folds(galaxy.laniakeaIndex);
  }
  if (galaxy.volumeIndex === undefined) {
    return localGroupFold(galaxy);
  }
  const c = localVolumeCatalog();
  return c === null ? UNFOLDED : (volumeFolds(c).folds[galaxy.volumeIndex] ?? UNFOLDED);
}

/** The host a body's mark is the mark of, or -1. */
function hostMarkedBy(id: BodyId): number {
  if (id === SGR_A_ID) {
    return MILKY_WAY_HOST;
  }
  if (structureOf(id) !== null) {
    return MARK_HOSTS.indexOf(`structure:${id}`);
  }
  const galaxy = galaxyOf(id);
  if (galaxy === null) {
    return -1;
  }
  if (galaxy.laniakeaIndex !== undefined) {
    const lc = laniakeaCatalogue();
    return lc === null ? -1 : (laniakeaFolds(lc).marks[galaxy.laniakeaIndex] ?? -1);
  }
  if (galaxy.key === andromeda.key && galaxy.volumeIndex === undefined) {
    return ANDROMEDA_HOST;
  }
  const c = localVolumeCatalog();
  return galaxy.volumeIndex === undefined || c === null ? -1 : (volumeFolds(c).marks[galaxy.volumeIndex] ?? -1);
}

/**
 * A body's host and its distance from it: a galaxy's as above; Sgr A*, the Milky Way's own mark,
 * none; anything else is in the Milky Way, `fromSunPc` from the Sun.
 */
export function bodyFold(body: BodyDefinition, fromSunPc: readonly [number, number, number]): FoldOf {
  if (body.kind === 'structure') {
    const host = MARK_HOSTS.indexOf(`structure:${body.id}`);
    return host < 0 ? UNFOLDED : MARK_HOSTS.foldOf(host);
  }
  if (body.kind === 'galaxy') {
    const galaxy = galaxyOf(body.id);
    return galaxy === null ? UNFOLDED : galaxyFold(galaxy);
  }
  if (body.id === SGR_A_ID) {
    return UNFOLDED;
  }
  return { host: MILKY_WAY_HOST, separationPc: MARK_HOSTS.distancePc(MILKY_WAY_HOST, fromSunPc) };
}

/** The focus and what it goes round, up its parents: a moon's planet, a planet of another star its star. */
export function focusLineage(store: Pick<EphemerisStore, 'body'>, focus: BodyId): Set<BodyId> {
  const lineage = new Set<BodyId>();
  for (let id: BodyId | null = focus; id !== null && !lineage.has(id); id = store.body(id).parent) {
    lineage.add(id);
  }
  return lineage;
}

/**
 * How much of a body's mark is drawn this frame: never folded when it is the focus or what the
 * focus goes round (`focusLineage`). `fromKm` and `sunKm`, its position and the Sun's in any one
 * frame, km.
 */
export function bodyFoldStrength(
  body: BodyDefinition,
  fromKm: Vec3,
  sunKm: Vec3 | undefined,
  lineage: ReadonlySet<BodyId>,
): number {
  if (lineage.has(body.id) || sunKm === undefined) {
    return 1;
  }
  if (body.kind === 'structure') {
    // Its own host's strength: what it folds into above it, and the structures' fade.
    const host = MARK_HOSTS.indexOf(`structure:${body.id}`);
    return Math.min(structuresStrength(), host < 0 || host >= MARK_HOSTS.strength.length ? 1 : MARK_HOSTS.strength[host]!);
  }
  const fold = bodyFold(body, [
    (fromKm.x - sunKm.x) / PARSEC_KM,
    (fromKm.y - sunKm.y) / PARSEC_KM,
    (fromKm.z - sunKm.z) / PARSEC_KM,
  ]);
  return MARK_HOSTS.member(fold.host, fold.separationPc);
}

/** The hosts that may not fold while `focus` is looked at: those above it, and the one it marks. */
export function pinnedHosts(focus: BodyId): number[] {
  const own = hostMarkedBy(focus);
  const galaxy = galaxyOf(focus);
  const above =
    galaxy !== null ? galaxyFold(galaxy).host : focus === SGR_A_ID || structureOf(focus) !== null ? -1 : MILKY_WAY_HOST;
  return [...(own >= 0 ? MARK_HOSTS.chain(own) : []), ...(above >= 0 ? MARK_HOSTS.chain(above) : [])];
}

const last = { x: NaN, y: NaN, z: NaN, scale: NaN, focus: '' as BodyId, count: -1 };

/**
 * This frame's numbers for every host, from the camera about the Sun, parsecs, and the view's
 * pixels per radian, CSS pixels. Each catalogue calls it from its own frame: the first does the
 * work, the rest find it done.
 */
export function updateMarkHosts(cameraPc: readonly [number, number, number], pixelsPerRadian: number, focus: BodyId): void {
  // The galaxies' hosts are known once their catalogue is.
  const c = localVolumeCatalog();
  if (c !== null) volumeFolds(c);
  const lc = laniakeaCatalogue();
  if (lc !== null) laniakeaFolds(lc);
  if (
    last.x === cameraPc[0] &&
    last.y === cameraPc[1] &&
    last.z === cameraPc[2] &&
    last.scale === pixelsPerRadian &&
    last.focus === focus &&
    last.count === MARK_HOSTS.count
  ) {
    return;
  }
  MARK_HOSTS.update(cameraPc, pixelsPerRadian, pinnedHosts(focus));
  structures.strength = structuresFade(Math.hypot(cameraPc[0], cameraPc[1], cameraPc[2]));
  Object.assign(last, { x: cameraPc[0], y: cameraPc[1], z: cameraPc[2], scale: pixelsPerRadian, focus, count: MARK_HOSTS.count });
}

/** Pixels per radian of a view `heightPx` CSS pixels tall. */
export function pixelsPerRadian(heightPx: number, fovDeg: number): number {
  return heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
}

/**
 * `updateMarkHosts` from the scene's own numbers: the camera in scene units and the Sun in km,
 * both in the frame about the focus; the view's height, CSS pixels, and its field of view.
 */
export function updateMarkHostsFromScene(
  cameraUnits: Vec3,
  sunKm: Vec3 | undefined,
  heightPx: number,
  fovDeg: number,
  focus: BodyId,
): void {
  if (sunKm === undefined) {
    return;
  }
  updateMarkHosts(
    [
      (cameraUnits.x * KM_PER_UNIT - sunKm.x) / PARSEC_KM,
      (cameraUnits.y * KM_PER_UNIT - sunKm.y) / PARSEC_KM,
      (cameraUnits.z * KM_PER_UNIT - sunKm.z) / PARSEC_KM,
    ],
    pixelsPerRadian(heightPx, fovDeg),
    focus,
  );
}

/** A catalogue's marks as `foldMembers` reads them: each one's host and distance from it, and its fold. */
export interface MemberFolds {
  readonly host: Int32Array;
  readonly separationPc: Float32Array;
  /** This frame's, 1 drawn whole to 0 folded away: a buffer attribute's array. */
  readonly value: Float32Array;
}

/** Marks all in the Milky Way, at `positionPc` (x, y, z each, about the Sun, scene frame). */
export function milkyWayMembers(positionPc: Float32Array, count: number): MemberFolds {
  const host = new Int32Array(count).fill(MILKY_WAY_HOST);
  const separationPc = new Float32Array(count);
  for (let k = 0; k < count; k += 1) {
    separationPc[k] = MARK_HOSTS.distancePc(MILKY_WAY_HOST, [positionPc[k * 3]!, positionPc[k * 3 + 1]!, positionPc[k * 3 + 2]!]);
  }
  return { host, separationPc, value: new Float32Array(count).fill(1) };
}

/** Marks of galaxies, each its own host (galaxyFold). */
export function galaxyMembers(galaxies: readonly LocalGroupGalaxy[]): MemberFolds {
  const host = new Int32Array(galaxies.length);
  const separationPc = new Float32Array(galaxies.length);
  galaxies.forEach((galaxy, i) => {
    const fold = galaxyFold(galaxy);
    host[i] = fold.host;
    separationPc[i] = fold.separationPc;
  });
  return { host, separationPc, value: new Float32Array(galaxies.length).fill(1) };
}

// ---------------------------------------------------------------------------------------
// Laniakea (G3): its groups, and the named structures

/** A cluster folds into a supercluster, or the Great Attractor, within this of it, pc: the nearest. */
export const CLUSTER_IN_SUPERCLUSTER_PC = 35e6;

/**
 * The named structures come in as the camera leaves the Local Group, light years from the Sun:
 * gone within STRUCTURES_FROM_LY, whole from STRUCTURES_FULL_LY -- past the Local Group's own
 * view (8 million), before the Local Volume's (100 million).
 */
export const STRUCTURES_FROM_LY = 10e6;
export const STRUCTURES_FULL_LY = 30e6;

/** A light year in parsecs. */
const LIGHT_YEAR_PC = 0.30660139378555057;

/** How much of the structures' marks and names is drawn, 0 to 1, from the camera's distance from the Sun, pc. */
export function structuresFade(cameraFromSunPc: number): number {
  const ly = cameraFromSunPc / LIGHT_YEAR_PC;
  const t = (Math.log(ly) - Math.log(STRUCTURES_FROM_LY)) / (Math.log(STRUCTURES_FULL_LY) - Math.log(STRUCTURES_FROM_LY));
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

const structures = { strength: 0 };

/** This frame's fade of the structures (structuresFade, from the camera given to updateMarkHosts). */
export function structuresStrength(): number {
  return structures.strength;
}

interface LaniakeaFolds {
  readonly catalogue: LaniakeaCatalogue;
  /** The host each galaxy is the mark of, -1 none. */
  readonly marks: Int32Array;
  /** Each galaxy's host and its distance from it; -1 for one of no group, a place of its own. */
  readonly host: Int32Array;
  readonly separationPc: Float32Array;
  readonly folds: (k: number) => FoldOf;
}

let laniakea: LaniakeaFolds | null = null;

/** A structure's host, by its body's id: "structure:structure-coma-cluster". */
export function structureHostKey(name: string): string {
  return `structure:${structureBodyId({ name })}`;
}

/** The structures' hosts and every galaxy's fold, once for a catalogue (see the header). */
export function laniakeaFolds(c: LaniakeaCatalogue): LaniakeaFolds {
  if (laniakea !== null && laniakea.catalogue === c) {
    return laniakea;
  }
  const landmarks = c.info.landmarks;
  const at = (l: (typeof landmarks)[number]): [number, number, number] => [l.x, l.y, l.z];
  const basinOf = (p: readonly [number, number, number]): string | null => {
    if (c.basins === null) return null;
    const label = basinAt(c.basins, 'galaxiesAttraction', p);
    if (label === 0) return null;
    const basin = landmarks.find(
      (l) => l.kind === 'basin' && l.basin?.some((b) => b.grid === 'galaxiesAttraction' && b.label === label),
    );
    return basin === undefined ? null : structureHostKey(basin.name);
  };
  // Basins first, then what folds into them, then what folds into those.
  for (const l of landmarks) {
    if (l.kind === 'basin' || l.kind === 'void' || l.kind === 'wall' || l.kind === 'repeller') {
      MARK_HOSTS.add(structureHostKey(l.name), at(l), null, l.kind === 'basin' ? (l.radiusPc ?? Infinity) : Infinity);
    }
  }
  for (const l of landmarks) {
    if (l.kind === 'supercluster' || l.kind === 'attractor') {
      MARK_HOSTS.add(structureHostKey(l.name), at(l), basinOf(at(l)));
    }
  }
  const above = landmarks.filter((l) => l.kind === 'supercluster' || l.kind === 'attractor');
  for (const l of landmarks) {
    if (l.kind !== 'cluster') continue;
    let parent: string | null = null;
    let best = CLUSTER_IN_SUPERCLUSTER_PC;
    for (const s of above) {
      const d = Math.hypot(s.x - l.x, s.y - l.y, s.z - l.z);
      if (d < best) {
        best = d;
        parent = structureHostKey(s.name);
      }
    }
    MARK_HOSTS.add(structureHostKey(l.name), at(l), parent ?? basinOf(at(l)), l.radiusPc ?? Infinity);
  }
  // The groups: a named cluster's is the cluster's own host; any other of two or more its
  // brightest's, present only while its radius is large on the screen.
  const groups = c.groupBrightest.length;
  const groupHost = new Int32Array(groups).fill(-1);
  const marks = new Int32Array(c.count).fill(-1);
  for (let g = 0; g < groups; g += 1) {
    const b = c.groupBrightest[g]!;
    if (b < 0) continue;
    const landmark = c.groupLandmark.get(g);
    if (landmark !== undefined) {
      groupHost[g] = MARK_HOSTS.indexOf(structureHostKey(landmarks[landmark]!.name));
      continue;
    }
    if (c.groupMembers[g]! < 2) continue;
    const radius = c.groupRadiusPc[g]!;
    groupHost[g] = MARK_HOSTS.add(`lk:g${g}`, laniakeaPositionPc(c, b), null, radius, radius);
    marks[b] = groupHost[g]!;
  }
  const host = new Int32Array(c.count).fill(-1);
  const separationPc = new Float32Array(c.count).fill(Infinity);
  for (let k = 0; k < c.count; k += 1) {
    const g = groupOf(c, k);
    const h = g < 0 ? -1 : groupHost[g]!;
    if (h < 0 || marks[k] === h) continue;
    host[k] = h;
    separationPc[k] = MARK_HOSTS.distancePc(h, laniakeaPositionPc(c, k));
  }
  const folds = (k: number): FoldOf => {
    const own = marks[k]!;
    if (own >= 0) return MARK_HOSTS.foldOf(own);
    return host[k]! < 0 ? UNFOLDED : { host: host[k]!, separationPc: separationPc[k]! };
  };
  laniakea = { catalogue: c, marks, host, separationPc, folds };
  return laniakea;
}
