import type { LaniakeaLandmark } from '../types.ts';
import { asuNumber, type AsuRow } from '../localVolume/asu.ts';
import {
  C_KM_S,
  comovingDistanceMpc,
  czCmb,
  galacticToIcrs,
  icrsToRaDec,
  LITTLE_H,
  MODULUS_TO_FRACTION,
  modulusToPc,
  sceneAt,
  supergalacticToIcrs,
  unitVector,
  type Vec3,
} from './frames.ts';
import type { Cf4Galaxy, Cf4Group, PlacedGroup, TullyGalaxy } from './galaxies.ts';
import { BASINS, basinGrid, CF4_BOX_MPC_H, type WatershedGrid } from './watersheds.ts';

/**
 * The structures about Laniakea that have names: clusters, superclusters, Laniakea's basin
 * and its neighbours', the Great Attractor, voids and walls. Each placed from a catalogue
 * or a paper, cited in its `source`; where a number is the paper's own and not this
 * catalogue's, the note says so.
 *
 * ## Clusters
 *
 * Each named for the galaxy at its heart (CLUSTERS: its PGC number, the cluster's brightest
 * galaxy in K_s, which is the PGC1 of its nest in Tully 2015 save for Fornax and Antlia,
 * named by their central ellipticals NGC 1399 and NGC 3268) and placed from the catalogues:
 *
 * - centre and distance: the Cosmicflows-4 group that galaxy is in -- its centre and its
 *   weighted-mean modulus, a measured distance; where CF4 has none (Norma and Ophiuchus
 *   behind the Milky Way's plane, Abell 3266 and 3571 beyond its depth there), the 2MASS
 *   nest's: its members' mean direction and mean CMB-frame redshift (estimated);
 * - mass, radius and members from Tully's nest: the virial mass (from the velocity
 *   dispersion and the projected radius) and the second-turnaround radius, which Tully gives
 *   at H0 = 100 and are scaled here to 74.6 (both go as 1/H0); the member count of CF4's
 *   group where there is one, else the nest's.
 *
 * ## Superclusters
 *
 * Two definitions, both kept, because they are different things:
 *
 * - **As concentrations of rich clusters** (Einasto et al. 1997, A&AS 123, 119, Table A2):
 *   the superclusters of Abell clusters, centre and distance (h^-1 Mpc, by redshift) and the
 *   number of Abell clusters in each, for the ones the literature names (SUPERCLUSTERS).
 * - **As basins of attraction** (Dupuy & Courtois 2023, Table A.1; watersheds.ts):
 *   Laniakea, Apus, Hercules, Lepus, Perseus-Pisces and Shapley, each at its attractor, with
 *   its basin in basins.bin and the radius of a sphere of its volume; and the repellers'
 *   basins, the Sculptor Void's, the one beside the Bootes Void, and the Dipole and Cold
 *   Spot Repellers' (Hoffman et al. 2017), which Dupuy & Courtois find to be one.
 *
 * ## The Great Attractor
 *
 * Where the galaxies' streaming motions converge, as found from the elliptical galaxies'
 * peculiar velocities: galactic l 307, b +9, at 4,350 +- 350 km/s (Lynden-Bell et al. 1988,
 * ApJ 326, 19), the Norma Cluster near its heart (Kraan-Korteweg et al. 1996, Nature 379,
 * 519). With Cosmicflows-4 the attractor of Laniakea's basin lies farther, at 7,412 km/s
 * (Dupuy & Courtois 2023): written as the basin's.
 *
 * ## Voids and walls
 *
 * - The Local, Hercules and Sculptor Voids from Tully et al. 2019 (ApJ 880, 24; the
 *   Cosmicflows-3 Wiener-filter density): each at its deepest density minimum, with the
 *   rough extents of its -0.7 isodensity surface along SGX, SGY, SGZ. Their numbers are in
 *   km/s; turned into Mpc here at H0 74.6.
 * - The Sloan Great Wall (Gott et al. 2005, ApJ 624, 463): from 8.7h to 13.7h of right
 *   ascension in the SDSS's equatorial slice (|Dec| < 2 deg), at z 0.073, 450 Mpc long
 *   comoving at their H0 71 -- drawn as a line at that redshift's distance across that span.
 * - The CfA2 Great Wall (Geller & Huchra 1989, Science 246, 897), the "Coma Wall": from 9h to
 *   16.7h at a median z of 0.029, over Dec -8.5 to +42 (Gott et al.'s description) -- drawn
 *   through the Coma Cluster's declination.
 */

// ---------------------------------------------------------------------------------------
// The tables

export interface ClusterDefinition {
  readonly name: string;
  readonly otherNames: readonly string[];
  /** The PGC number of the galaxy that names it in the catalogues. */
  readonly pgc: number;
  readonly note: string | null;
}

export const CLUSTERS: readonly ClusterDefinition[] = [
  { name: 'Virgo Cluster', otherNames: ['Virgo'], pgc: 41220, note: 'local-volume.json draws its galaxies one by one; here for reference.' },
  { name: 'Fornax Cluster', otherNames: ['Fornax', 'Abell S373'], pgc: 13418, note: null },
  { name: 'Antlia Cluster', otherNames: ['Antlia', 'Abell S636'], pgc: 30949, note: null },
  { name: 'Centaurus Cluster', otherNames: ['Abell 3526', 'Centaurus'], pgc: 43296, note: null },
  { name: 'Hydra Cluster', otherNames: ['Abell 1060', 'Hydra I'], pgc: 31478, note: null },
  {
    name: 'Norma Cluster',
    otherNames: ['Abell 3627'],
    pgc: 57612,
    note: 'Behind the Milky Way\'s plane, near the heart of the Great Attractor (Kraan-Korteweg et al. 1996, Nature 379, 519).',
  },
  { name: 'Pavo II Cluster', otherNames: ['Pavo II', 'Abell S805'], pgc: 62407, note: 'In the Pavo-Indus filament.' },
  { name: 'Perseus Cluster', otherNames: ['Abell 426', 'Perseus'], pgc: 12429, note: 'The heart of the Perseus-Pisces chain.' },
  { name: 'Abell 262', otherNames: [], pgc: 6962, note: 'In the Perseus-Pisces chain.' },
  { name: 'Coma Cluster', otherNames: ['Abell 1656', 'Coma'], pgc: 44715, note: null },
  { name: 'Leo Cluster', otherNames: ['Abell 1367'], pgc: 36487, note: 'With Coma, the Coma Supercluster.' },
  { name: 'Hercules Cluster', otherNames: ['Abell 2151'], pgc: 56962, note: null },
  { name: 'Abell 2199', otherNames: [], pgc: 58265, note: 'In the Hercules Supercluster.' },
  { name: 'Ophiuchus Cluster', otherNames: ['Ophiuchus'], pgc: 59827, note: 'Behind the Galactic bulge.' },
  { name: 'Abell 3558', otherNames: ['Shapley 8'], pgc: 47202, note: 'The core of the Shapley Supercluster.' },
  { name: 'Abell 3571', otherNames: [], pgc: 48896, note: 'In the Shapley Supercluster.' },
  { name: 'Abell 3266', otherNames: [], pgc: 15373, note: 'In the Horologium-Reticulum Supercluster.' },
];

/** Einasto et al. 1997 supercluster numbers kept, with the names given here. */
export const SUPERCLUSTERS: readonly { readonly sc: number; readonly name: string; readonly otherNames: readonly string[] }[] = [
  { sc: 124, name: 'Shapley Supercluster', otherNames: ['Shapley Concentration'] },
  { sc: 48, name: 'Horologium-Reticulum Supercluster', otherNames: ['Horologium Supercluster'] },
  { sc: 160, name: 'Hercules Supercluster', otherNames: [] },
  { sc: 117, name: 'Coma Supercluster', otherNames: ['Coma-Leo'] },
  { sc: 93, name: 'Leo Supercluster', otherNames: [] },
  { sc: 40, name: 'Perseus-Pisces Supercluster', otherNames: ['Perseus'] },
  { sc: 10, name: 'Pisces-Cetus Supercluster', otherNames: [] },
  { sc: 128, name: 'Hydra-Centaurus Supercluster', otherNames: [] },
  { sc: 109, name: 'Ursa Major Supercluster', otherNames: [] },
  { sc: 138, name: 'Bootes Supercluster', otherNames: [] },
  { sc: 158, name: 'Corona Borealis Supercluster', otherNames: [] },
  { sc: 9, name: 'Sculptor Supercluster', otherNames: [] },
  { sc: 67, name: 'Lepus Supercluster', otherNames: [] },
];

/** Tully et al. 2019: each void's deepest minimum, km/s, SGX SGY SGZ; its extents at -0.7, km/s. */
const VOIDS: readonly { name: string; otherNames: string[]; minimum: string; sgKmS: Vec3; extentKmS: Vec3; note: string }[] = [
  {
    name: 'Local Void',
    otherNames: [],
    minimum: 'Lacerta-2.4',
    sgKmS: [1650, -700, 1650],
    extentKmS: [5200, 3000, 4500],
    note: 'Its minima at negative SGZ are what Einasto et al. 1983 called the Southern Local Void. Its deepest parts lie close to the Milky Way\'s plane, behind the dust.',
  },
  {
    name: 'Hercules Void',
    otherNames: ['Northern Local Void', 'Northern Local Supervoid'],
    minimum: 'Bootes-8',
    sgKmS: [-1200, 4000, 5000],
    extentKmS: [11600, 7800, 14000],
    note: 'In front of the Hercules cluster complex; Einasto et al. 1983 named it the Northern Local Void.',
  },
  {
    name: 'Sculptor Void',
    otherNames: ['Southern Local Supervoid'],
    minimum: 'Reticulum-2.6',
    sgKmS: [-1200, -1700, -1700],
    extentKmS: [14500, 6500, 10200],
    note: 'Its nearest basin; the void (Fairall 1998) reaches far beyond, behind the Southern Supercluster of Fornax and Eridanus.',
  },
];

// ---------------------------------------------------------------------------------------
// Building them

export interface LandmarkParts {
  readonly cf4: readonly Cf4Galaxy[];
  readonly cf4Groups: ReadonlyMap<number, Cf4Group>;
  readonly tully: readonly TullyGalaxy[];
  readonly einasto: readonly AsuRow[];
  readonly groups: readonly PlacedGroup[];
  /** Voxels of each basin, by grid and number (watersheds.ts cropBasins). */
  readonly basinVoxels: Readonly<Record<WatershedGrid, Readonly<Record<number, number>>>>;
  readonly basinVoxelSize: number;
}

/** Comoving distance, pc, of a CMB-frame velocity. */
function redshiftPc(cmbKmS: number): number {
  return comovingDistanceMpc(cmbKmS / C_KM_S) * 1e6;
}

function landmark(fields: Partial<LaniakeaLandmark> & Pick<LaniakeaLandmark, 'name' | 'kind' | 'raDeg' | 'decDeg' | 'distancePc' | 'distanceMethod' | 'distanceEstimated' | 'source'>): LaniakeaLandmark {
  const [x, y, z] = sceneAt(fields.raDeg, fields.decDeg, fields.distancePc);
  return {
    otherNames: [],
    radiusPc: null,
    extentPc: null,
    sizeNote: null,
    massSun: null,
    massNote: null,
    members: null,
    group: -1,
    basin: null,
    path: null,
    note: null,
    ...fields,
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    distancePc: Math.round(fields.distancePc),
  };
}

/** Tully's H0 = 100 lengths and virial masses, at H0 74.6. */
const TULLY_SCALE = 100 / 74.6;

export function clusterLandmarks(parts: LandmarkParts): { landmarks: LaniakeaLandmark[]; missing: string[] } {
  const cf4ByPgc = new Map(parts.cf4.map((c) => [c.pgc, c]));
  const tullyByPgc = new Map(parts.tully.map((t) => [t.pgc, t]));
  const out: LaniakeaLandmark[] = [];
  const missing: string[] = [];
  for (const cluster of CLUSTERS) {
    const groupId = cf4ByPgc.get(cluster.pgc)?.group ?? (parts.cf4Groups.has(cluster.pgc) ? cluster.pgc : null);
    const group = groupId === null ? undefined : parts.cf4Groups.get(groupId);
    const tully = tullyByPgc.get(cluster.pgc);
    const nest = tully === undefined ? [] : parts.tully.filter((t) => t.nest === tully.nest);
    let raDeg: number;
    let decDeg: number;
    let distancePc: number;
    let method: string;
    let estimated: boolean;
    let index = -1;
    let members: number | null = null;
    if (group !== undefined && group.members >= 2) {
      raDeg = group.raDeg;
      decDeg = group.decDeg;
      const z = group.vCmb / C_KM_S;
      distancePc = modulusToPc(group.modulus) / (1 + z);
      method = `CF4 group (${(MODULUS_TO_FRACTION * group.modulusError * 100).toFixed(1)}%)`;
      estimated = false;
      members = group.members;
      index = parts.groups.findIndex((g) => g.source === 'cf4' && g.id === group.pgc1);
    } else if (tully !== undefined && nest.length >= 2) {
      const sum: Vec3 = [0, 0, 0];
      let velocity = 0;
      let counted = 0;
      for (const t of nest) {
        const u = unitVector(t.raDeg, t.decDeg);
        sum[0] += u[0];
        sum[1] += u[1];
        sum[2] += u[2];
        if (t.heliocentricKmS !== null) {
          velocity += czCmb(t.raDeg, t.decDeg, t.heliocentricKmS);
          counted += 1;
        }
      }
      ({ raDeg, decDeg } = icrsToRaDec(sum));
      distancePc = redshiftPc(velocity / counted);
      method = '2MASS group redshift';
      estimated = true;
      members = tully.nestMembers;
      index = parts.groups.findIndex((g) => g.source === '2mass' && g.id === tully.nest);
    } else {
      missing.push(cluster.name);
      continue;
    }
    const mass = tully?.nestVirialMass ?? null;
    const radius = tully?.nestR2t ?? null;
    out.push(
      landmark({
        name: cluster.name,
        otherNames: cluster.otherNames,
        kind: 'cluster',
        raDeg,
        decDeg,
        distancePc,
        distanceMethod: method,
        distanceEstimated: estimated,
        radiusPc: radius === null ? null : Math.round(radius * TULLY_SCALE * 1e6),
        sizeNote: radius === null ? null : 'Second-turnaround radius (Tully 2015), at H0 74.6.',
        massSun: mass === null ? null : Number((mass * 1e12 * TULLY_SCALE).toPrecision(3)),
        massNote: mass === null ? null : 'Virial mass of its 2MASS group (Tully 2015), at H0 74.6.',
        members,
        group: index,
        source: `Named by PGC ${cluster.pgc}; ${group !== undefined && group.members >= 2 ? 'Cosmicflows-4 (Tully et al. 2023)' : 'the 2MASS groups (Tully 2015)'}; mass and radius from Tully 2015.`,
        note: cluster.note,
      }),
    );
  }
  return { landmarks: out, missing };
}

export function superclusterLandmarks(rows: readonly AsuRow[]): { landmarks: LaniakeaLandmark[]; missing: string[] } {
  const out: LaniakeaLandmark[] = [];
  const missing: string[] = [];
  for (const sc of SUPERCLUSTERS) {
    const row = rows.find((r) => asuNumber(r, 'SC') === sc.sc);
    const ra = row === undefined ? null : asuNumber(row, '_RAJ2000');
    const dec = row === undefined ? null : asuNumber(row, '_DEJ2000');
    const dist = row === undefined ? null : asuNumber(row, 'Dist');
    if (row === undefined || ra === null || dec === null || dist === null) {
      missing.push(sc.name);
      continue;
    }
    const einastoName = (row['ID'] ?? '').trim();
    out.push(
      landmark({
        name: sc.name,
        otherNames: [...new Set([...sc.otherNames, ...(einastoName !== '' && `${einastoName} Supercluster` !== sc.name ? [einastoName] : [])])],
        kind: 'supercluster',
        raDeg: ra,
        decDeg: dec,
        distancePc: (dist / LITTLE_H) * 1e6,
        distanceMethod: 'Einasto et al. 1997 (redshift)',
        distanceEstimated: true,
        members: asuNumber(row, 'Nmembers'),
        source: `Einasto et al. 1997, A&AS 123, 119, Table A2: supercluster ${sc.sc} ("${einastoName}"), a concentration of Abell clusters; members counts Abell clusters.`,
      }),
    );
  }
  return { landmarks: out, missing };
}

/** A supergalactic point in Mpc/h, as RA, Dec and distance (pc). */
function fromSupergalactic(sgMpcH: Vec3): { raDeg: number; decDeg: number; distancePc: number } {
  const icrs = supergalacticToIcrs(sgMpcH);
  const { raDeg, decDeg } = icrsToRaDec(icrs);
  return { raDeg, decDeg, distancePc: (Math.hypot(...sgMpcH) / LITTLE_H) * 1e6 };
}

export function basinLandmarks(parts: Pick<LandmarkParts, 'basinVoxels' | 'basinVoxelSize'>): LaniakeaLandmark[] {
  const voxelMpc3 = (CF4_BOX_MPC_H / parts.basinVoxelSize / LITTLE_H) ** 3;
  return BASINS.map((row) => {
    const fit = row.galaxies ?? row.groups!;
    const { raDeg, decDeg, distancePc } = fromSupergalactic(fit.sgMpcH);
    const basin: { grid: WatershedGrid; label: number }[] = [];
    const sizes: string[] = [];
    for (const reconstruction of ['galaxies', 'groups'] as const) {
      const f = row[reconstruction];
      const grid = basinGrid(row.kind, reconstruction);
      if (f !== null && grid !== null) {
        basin.push({ grid, label: f.label });
        const voxels = parts.basinVoxels[grid][f.label] ?? 0;
        sizes.push(`${reconstruction} ${((voxels * voxelMpc3) / 1e6).toFixed(1)} million Mpc^3`);
      }
    }
    const voxels = parts.basinVoxels[basin[0]!.grid][basin[0]!.label] ?? 0;
    const radiusPc = Math.cbrt((3 * voxels * voxelMpc3) / (4 * Math.PI)) * 1e6;
    const isLaniakea = row.name === 'Laniakea';
    return landmark({
      name: isLaniakea ? 'Laniakea Supercluster' : row.kind === 'attraction' ? `${row.name} basin` : /Repeller/.test(row.name) ? row.name : `${row.name} repeller`,
      otherNames: isLaniakea ? ['Laniakea'] : row.name === 'Dipole Repeller and Cold Spot Repeller' ? ['Dipole Repeller', 'Cold Spot Repeller'] : [],
      kind: row.kind === 'attraction' ? 'basin' : 'repeller',
      raDeg,
      decDeg,
      distancePc,
      distanceMethod: 'CF4 velocity field (Dupuy & Courtois 2023)',
      distanceEstimated: true,
      radiusPc: Math.round(radiusPc),
      sizeNote: `Radius of a sphere of its basin's volume (${sizes.join('; ')}); its shape is the basin's, in basins.bin.`,
      basin,
      massSun: isLaniakea ? 1e17 : null,
      massNote: isLaniakea ? 'About 10^17 solar masses (Tully et al. 2014, Nature 513, 71, from Cosmicflows-2).' : null,
      source: `Dupuy & Courtois 2023, A&A 678, A176, Table A.1: the ${row.kind === 'attraction' ? 'attractor' : 'repeller'} of the basin; the Cosmicflows-4 reconstruction of Courtois et al. 2023.`,
      note: isLaniakea
        ? 'Defined by the flow of galaxies, not by an edge one could see (Tully et al. 2014, Nature 513, 71: about 10^17 solar masses, 160 Mpc across). A basin of its own in the CF4 galaxies\' reconstruction; in the CF4 groups\' the Milky Way\'s flow ends at Shapley, which then takes Laniakea in, and Valade et al. 2024 (Nature Astronomy 8, 1610) find the data slightly prefer that. Placed at its attractor.'
        : row.name === 'Shapley'
          ? 'In the CF4 groups\' reconstruction its basin takes in Laniakea and Apus too (27 million (Mpc/h)^3).'
          : null,
    });
  });
}

export function greatAttractor(): LaniakeaLandmark {
  const icrs = galacticToIcrs(307, 9);
  const { raDeg, decDeg } = icrsToRaDec(icrs);
  return landmark({
    name: 'Great Attractor',
    kind: 'attractor',
    raDeg,
    decDeg,
    distancePc: redshiftPc(4350),
    distanceMethod: 'redshift (Lynden-Bell et al. 1988)',
    distanceEstimated: true,
    source: 'Lynden-Bell et al. 1988, ApJ 326, 19: galactic l 307, b +9, 4,350 +- 350 km/s.',
    note: 'Where the galaxies about us stream toward, behind the Milky Way\'s plane; the Norma Cluster lies near its heart (Kraan-Korteweg et al. 1996). Cosmicflows-4 puts the attractor of Laniakea\'s basin farther, at 7,412 km/s (the Laniakea Supercluster entry).',
  });
}

export function voidLandmarks(): LaniakeaLandmark[] {
  return VOIDS.map((v) => {
    const sgMpc: Vec3 = [v.sgKmS[0] / 74.6, v.sgKmS[1] / 74.6, v.sgKmS[2] / 74.6];
    const icrs = supergalacticToIcrs(sgMpc);
    const { raDeg, decDeg } = icrsToRaDec(icrs);
    return landmark({
      name: v.name,
      otherNames: v.otherNames,
      kind: 'void',
      raDeg,
      decDeg,
      distancePc: Math.hypot(...sgMpc) * 1e6,
      distanceMethod: 'CF3 density field (Tully et al. 2019)',
      distanceEstimated: true,
      extentPc: [Math.round((v.extentKmS[0] / 74.6) * 1e6), Math.round((v.extentKmS[1] / 74.6) * 1e6), Math.round((v.extentKmS[2] / 74.6) * 1e6)],
      sizeNote: `Placed at its deepest minimum (${v.minimum}); the extents are those of its -0.7 isodensity surface along SGX, SGY, SGZ -- rough, and not centred on the minimum.`,
      source: 'Tully et al. 2019, ApJ 880, 24 (Cosmicflows-3: Cosmography of the Local Void).',
      note: v.note,
    });
  });
}

export function wallLandmarks(): LaniakeaLandmark[] {
  const sloanZ = 0.073;
  const sloanPc = comovingDistanceMpc(sloanZ) * 1e6;
  const sloanPath = [8.7, 9.95, 11.2, 12.45, 13.7].map((h) => sceneAt(h * 15, 0, sloanPc).map(Math.round) as unknown as Vec3);
  const cfaZ = 0.029;
  const cfaPc = comovingDistanceMpc(cfaZ) * 1e6;
  const comaDec = 27.98;
  const cfaPath = [9, 11, 13, 15, 16.7].map((h) => sceneAt(h * 15, comaDec, cfaPc).map(Math.round) as unknown as Vec3);
  return [
    landmark({
      name: 'Sloan Great Wall',
      kind: 'wall',
      raDeg: 11.2 * 15,
      decDeg: 0,
      distancePc: sloanPc,
      distanceMethod: 'redshift (Gott et al. 2005)',
      distanceEstimated: true,
      radiusPc: Math.round((450 / 2) * (71 / 74.6) * 1e6),
      sizeNote: 'Half its comoving length, 450 Mpc at Gott et al.\'s H0 71 (1.37 billion light years as seen), at H0 74.6.',
      path: sloanPath,
      source: 'Gott et al. 2005, ApJ 624, 463: 8.7h to 13.7h in the SDSS equatorial slice, z 0.073.',
      note: 'Seen in a slice 4 degrees thick: its extent north and south of the equator is not measured there. Drawn as a line.',
    }),
    landmark({
      name: 'CfA2 Great Wall',
      otherNames: ['Coma Wall', 'Great Wall'],
      kind: 'wall',
      raDeg: 13 * 15,
      decDeg: comaDec,
      distancePc: cfaPc,
      distanceMethod: 'redshift (Geller & Huchra 1989)',
      distanceEstimated: true,
      radiusPc: Math.round((240 / 2) * (71 / 74.6) * 1e6),
      sizeNote: 'Half its comoving length, 240 Mpc at Gott et al.\'s H0 71, at H0 74.6.',
      path: cfaPath,
      source: 'Geller & Huchra 1989, Science 246, 897; extent from Gott et al. 2005: 9h to 16.7h, Dec -8.5 to +42, median z 0.029.',
      note: 'A sheet spanning 50 degrees of declination, drawn as a line through the Coma Cluster\'s.',
    }),
  ];
}
