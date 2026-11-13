import type { BodyDefinition, BodyId, LocalVolumeCatalog } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { SGR_A_ID } from '../core/blackHoles.ts';
import { galaxyOf, galaxyPositionPc, GIANTS, type LocalGroupGalaxy } from '../core/localGroup.ts';
import { localVolumeCatalog, regionOf, virgoCentre } from '../core/localVolume.ts';
import { galacticCentrePc } from '../core/milkyWay.ts';
import type { Vec3 } from '../core/vec3.ts';
import { GALACTIC_BASIS } from './galactic.ts';
import { LOCAL_GROUP_EXTENT_KM, MILKY_WAY_EXTENT_KM } from './homeName.ts';
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
 *   `group`), by luminosity: its members fold into it, and it into nothing. A galaxy of no
 *   group, or alone in its group, folds into nothing.
 * - **The Virgo Cluster**: M87 at its centre (localVolume.ts virgoCentre), for its main body,
 *   Virgo A, and its outskirts; each other substructure's brightest for that substructure's, and
 *   they into M87.
 *
 * Laniakea's galaxies (G3) are the same thing again -- their groups' and clusters' brightest as
 * hosts, an index into these a galaxy -- and go in the same way.
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

export const LOCAL_GROUP_HOST = MARK_HOSTS.add('local-group', GALACTIC_CENTRE_SCENE_PC, null, LOCAL_GROUP_REACH_PC);
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
    marks[mark] = MARK_HOSTS.add(key, at(mark), key.startsWith('virgo:') && m87 !== null ? 'virgo' : null);
  }
  const folds: FoldOf[] = [];
  for (let k = 0; k < c.count; k += 1) {
    if (marks[k]! >= 0) {
      folds.push(MARK_HOSTS.foldOf(marks[k]!));
      continue;
    }
    const g = (c.group[k] ?? '').trim();
    const key = regionOf(c, k) === 'virgo' ? virgoKey(g) : g === '' ? null : `lv:${g}`;
    const host = key === null ? -1 : MARK_HOSTS.indexOf(key);
    folds.push(host < 0 ? UNFOLDED : { host, separationPc: MARK_HOSTS.distancePc(host, at(k)) });
  }
  volume = { catalog: c, folds, marks };
  return volume;
}

// ---------------------------------------------------------------------------------------
// Marks

/** A galaxy's host and its distance from it. */
export function galaxyFold(galaxy: LocalGroupGalaxy): FoldOf {
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
  const galaxy = galaxyOf(id);
  if (galaxy === null) {
    return -1;
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
  const above = galaxy !== null ? galaxyFold(galaxy).host : focus === SGR_A_ID ? -1 : MILKY_WAY_HOST;
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
