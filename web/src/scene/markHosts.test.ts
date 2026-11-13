import type { BodyDefinition, LocalVolumeCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { SGR_A_ID } from '../core/blackHoles.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { ensureGalaxyBodies, galaxyBodyId, GIANTS, type LocalGroupGalaxy } from '../core/localGroup.ts';
import { indexLocalVolume } from '../core/localVolume.ts';
import {
  bodyFold,
  bodyFoldStrength,
  focusLineage,
  GALACTIC_CENTRE_SCENE_PC,
  galaxyFold,
  LOCAL_GROUP_HOST,
  MARK_HOSTS,
  milkyWayMembers,
  MILKY_WAY_HOST,
  MILKY_WAY_SATELLITES_HOST,
  pinnedHosts,
  SATELLITE_REACH_PC,
  updateMarkHosts,
} from './markHosts.ts';
import { UNFOLDED } from './markFolding.ts';

/**
 * Who folds into whom (markHosts.ts): the Milky Way's own, the Local Group's by where each
 * galaxy is, the Local Volume's groups and the Virgo Cluster's substructures by the catalogue.
 */

const giant = (key: string): LocalGroupGalaxy => GIANTS.find((galaxy) => galaxy.key === key)!;
const ANDROMEDA = MARK_HOSTS.indexOf('m31');

function body(id: string, kind: string): BodyDefinition {
  return { id, kind, name: id, parent: null } as unknown as BodyDefinition;
}

describe('the Local Group', () => {
  it('puts the Clouds among the Milky Way’s satellites, at their distance from its centre', () => {
    for (const key of ['lmc', 'smc']) {
      const fold = galaxyFold(giant(key));
      expect(fold.host).toBe(MILKY_WAY_SATELLITES_HOST);
      expect(fold.separationPc).toBeGreaterThan(40_000);
      expect(fold.separationPc).toBeLessThan(70_000);
    }
  });

  it('puts Triangulum in Andromeda, and Andromeda in the Local Group, whose mark is the Milky Way’s', () => {
    const m33 = galaxyFold(giant('m33'));
    expect(m33.host).toBe(ANDROMEDA);
    expect(m33.separationPc).toBeGreaterThan(150_000);
    expect(m33.separationPc).toBeLessThan(SATELLITE_REACH_PC);
    const m31 = galaxyFold(giant('m31'));
    expect(m31.host).toBe(LOCAL_GROUP_HOST);
    // 785 kpc from the Sun, 780 from the Galactic Centre.
    expect(m31.separationPc).toBeGreaterThan(700_000);
    expect(m31.separationPc).toBeLessThan(820_000);
  });

  it('gives a dwarf beside Andromeda to Andromeda, one far from both to the Local Group', () => {
    const near = { ...giant('m33'), key: 'test-near-andromeda', raDeg: 10.68, decDeg: 41.27 + 3, distancePc: 790_000 };
    expect(galaxyFold(near).host).toBe(ANDROMEDA);
    const free = { ...giant('m33'), key: 'test-free', raDeg: 296.24, decDeg: -14.8, distancePc: 480_000 };
    const fold = galaxyFold(free);
    expect(fold.host).toBe(LOCAL_GROUP_HOST);
    expect(fold.separationPc).toBeGreaterThan(SATELLITE_REACH_PC);
  });
});

describe('the Milky Way’s', () => {
  it('folds the Sun, a cluster, a pulsar into the Milky Way, at their distance from its centre', () => {
    const sun = bodyFold(body('sun', 'star'), [0, 0, 0]);
    expect(sun.host).toBe(MILKY_WAY_HOST);
    expect(sun.separationPc).toBeCloseTo(8150, -1);
    const members = milkyWayMembers(Float32Array.from([0, 0, 0]), 1);
    expect(members.host[0]).toBe(MILKY_WAY_HOST);
    expect(members.separationPc[0]).toBeCloseTo(8150, -1);
  });

  it('folds Sgr A*, the galaxy’s own mark, into nothing', () => {
    expect(bodyFold(body(SGR_A_ID, 'black-hole'), [8000, 0, 0])).toEqual(UNFOLDED);
  });

  it('never folds what is above the focus', () => {
    expect(pinnedHosts(galaxyBodyId(giant('m33')))).toEqual(expect.arrayContaining([ANDROMEDA, LOCAL_GROUP_HOST]));
    expect(pinnedHosts(galaxyBodyId(giant('m31')))).toEqual(expect.arrayContaining([ANDROMEDA, LOCAL_GROUP_HOST]));
    expect(pinnedHosts('sun')).toEqual([MILKY_WAY_HOST, MILKY_WAY_SATELLITES_HOST, LOCAL_GROUP_HOST]);
  });

  it('never folds the focus, nor what it goes round', () => {
    const parents: Record<string, string | null> = { moon: 'earth', earth: null, sun: null };
    const store = { body: (id: string) => ({ parent: parents[id] ?? null }) } as unknown as EphemerisStore;
    const lineage = focusLineage(store, 'moon');
    expect([...lineage].sort()).toEqual(['earth', 'moon']);
    // From 10 Mpc the Milky Way is a few pixels: the Sun folds into it, the Earth and the Moon do not.
    updateMarkHosts([0, 0, 1e7], 1000, 'moon');
    const at = { x: 0, y: 0, z: 0 };
    expect(bodyFoldStrength(body('sun', 'star'), at, at, lineage)).toBe(0);
    expect(bodyFoldStrength(body('earth', 'planet'), at, at, lineage)).toBe(1);
    expect(bodyFoldStrength(body('moon', 'moon'), at, at, lineage)).toBe(1);
  });

  it('folds the clusters from the centre out as the galaxy shrinks on the screen', () => {
    // Seen from 90 kpc above the centre, the disc 170 px: 5.5 px a 500 pc, whole at 2.2 kpc.
    const [cx, cy, cz] = GALACTIC_CENTRE_SCENE_PC;
    updateMarkHosts([cx, cy, cz + 9e4], 1000, 'earth');
    expect(MARK_HOSTS.member(MILKY_WAY_HOST, 500)).toBe(0);
    expect(MARK_HOSTS.member(MILKY_WAY_HOST, 50_000)).toBe(1);
    // From 50 kpc, every cluster but the innermost few hundred parsecs is open.
    updateMarkHosts([cx, cy, cz + 5e4], 1000, 'earth');
    expect(MARK_HOSTS.member(MILKY_WAY_HOST, 1_500)).toBe(1);
  });

  it('folds all of them once the disc is small on the screen, as its names are, keeping its satellites', () => {
    // From 1 Mpc the disc is 15 px: no cluster is drawn, however far out; the Clouds still are.
    const [cx, cy, cz] = GALACTIC_CENTRE_SCENE_PC;
    updateMarkHosts([cx, cy, cz + 1e6], 1000, 'earth');
    expect(MARK_HOSTS.member(MILKY_WAY_HOST, 100_000)).toBe(0);
    expect(MARK_HOSTS.member(MILKY_WAY_SATELLITES_HOST, 50_000)).toBe(1);
    // From 30 Mpc the Local Group is 33 px: its galaxies fold into its mark, the Milky Way's.
    updateMarkHosts([cx, cy, cz + 3e7], 1000, 'earth');
    expect(MARK_HOSTS.member(LOCAL_GROUP_HOST, 800_000)).toBe(0);
    expect(MARK_HOSTS.strength[MILKY_WAY_HOST]).toBe(1);
  });
});

describe('beyond the Local Group', () => {
  // Three M81 group galaxies, one of no group, one alone in its group; and the Virgo Cluster's.
  const CATALOGUE = {
    sources: {},
    frame: '',
    count: 10,
    sample: ['ungc', 'ungc', 'ungc', 'ungc', 'ungc', 'evcc', 'evcc', 'evcc', 'evcc', 'evcc'],
    name: ['M81', 'M82', 'KDG 61', 'KK 1', 'NGC 1', 'M87', 'M86', 'M49', 'VCC 1', 'VCC 2'],
    otherNames: [[], [], [], [], [], [], [], [], [], []],
    x: [3.6e6, 3.6e6 + 40_000, 3.6e6 - 60_000, 5e6, 7e6, 16.5e6, 16.5e6 + 300_000, 16.5e6 + 1.3e6, 16.5e6 + 1.4e6, 17e6],
    y: Array(10).fill(0),
    z: Array(10).fill(0),
    distancePc: [3.6e6, 3.6e6, 3.6e6, 5e6, 7e6, 16.5e6, 16.5e6, 16.5e6, 16.5e6, 17e6],
    vMag: [6.9, 8.4, 14, 15, 12, 8.6, 8.9, 8.4, 15, 15],
    group: ['M81', 'M81', 'M81', null, 'NGC 1', 'Virgo A', 'Virgo A', 'Virgo B', 'Virgo B', 'Virgo'],
  } as unknown as LocalVolumeCatalog;
  const archive = indexLocalVolume({
    ...CATALOGUE,
    ...Object.fromEntries(
      [
        'raDeg',
        'decDeg',
        'distanceErrorPc',
        'colourIndex',
        'tType',
        'morphology',
        'diameterArcmin',
        'halfLightArcmin',
        'axisRatio',
        'inclinationDeg',
        'positionAngleDeg',
        'radialVelocityKmS',
        'logHiMassSun',
      ].map((column) => [column, Array(10).fill(null)]),
    ),
    distanceMethod: Array(10).fill('TRGB'),
    distanceEstimated: Array(10).fill(false),
    colourEstimated: Array(10).fill(true),
    halfLightEstimated: Array(10).fill(false),
  } as LocalVolumeCatalog);
  const g = archive.galaxies;

  it('folds a group into its brightest, and the brightest into nothing', () => {
    const m81 = MARK_HOSTS.indexOf('lv:M81');
    expect(galaxyFold(g[0]!)).toEqual(UNFOLDED);
    expect(galaxyFold(g[1]!)).toEqual({ host: m81, separationPc: 40_000 });
    expect(galaxyFold(g[2]!)).toEqual({ host: m81, separationPc: 60_000 });
  });

  it('folds a galaxy of no group, or alone in its own, into nothing', () => {
    expect(galaxyFold(g[3]!)).toEqual(UNFOLDED);
    expect(galaxyFold(g[4]!)).toEqual(UNFOLDED);
  });

  it('folds Virgo A and the outskirts into M87, another substructure into its brightest, and that into M87', () => {
    const virgo = MARK_HOSTS.indexOf('virgo');
    const b = MARK_HOSTS.indexOf('virgo:Virgo B');
    expect(galaxyFold(g[5]!)).toEqual(UNFOLDED);
    expect(galaxyFold(g[6]!)).toEqual({ host: virgo, separationPc: 300_000 });
    expect(galaxyFold(g[9]!)).toEqual({ host: virgo, separationPc: 500_000 });
    expect(galaxyFold(g[7]!)).toEqual({ host: virgo, separationPc: 1.3e6 });
    expect(galaxyFold(g[8]!).host).toBe(b);
    expect(galaxyFold(g[8]!).separationPc).toBeCloseTo(100_000, -1);
  });

  it('opens a group as the camera nears it, and keeps the focus’s group open from anywhere', () => {
    const m81 = MARK_HOSTS.indexOf('lv:M81');
    updateMarkHosts([0, 0, 0], 1000, 'earth');
    // From the Sun, 3.6 Mpc off: M82's 40 kpc are 11 px, folded.
    expect(MARK_HOSTS.member(m81, 40_000)).toBe(0);
    updateMarkHosts([3.6e6, 0, 500_000], 1000, 'earth');
    expect(MARK_HOSTS.member(m81, 40_000)).toBe(1);
    // M82 focused: M81's host pinned -- M81 itself folds into nothing anyway.
    ensureGalaxyBodies({ isPropagatedBody: () => true } as unknown as EphemerisStore, [g[1]!]);
    expect(pinnedHosts(galaxyBodyId(g[1]!))).toContain(m81);
  });
});
