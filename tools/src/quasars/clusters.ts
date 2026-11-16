import { APP_DISTANCES, scenePc, zCmbOf } from '../cosmicWeb/distances.ts';
import { unitVector } from '../laniakea/frames.ts';
import type { LaniakeaLandmark } from '../types.ts';
import { SZ_CLUSTER_BYTES, type SzClustersInfo } from './format.ts';
import { median } from './quasars.ts';
import type { AsuTable } from './sources.ts';

/**
 * The Planck SZ clusters (PSZ2: Planck Collaboration 2016, A&A 594, A27): the galaxy clusters
 * whose hot gas Planck saw over the whole sky by the shadow it casts on the CMB -- the
 * Sunyaev-Zeldovich effect, which does not dim with distance, so the catalogue is nearly
 * mass-limited out to z 1, across the sky but the Milky Way's plane and the brightest radio
 * sources. 1,653 detections; the 1,094 with a redshift from an identified cluster are drawn.
 *
 * ## Where, in which cosmology
 *
 * They are clusters of the galaxies the cosmic web draws, to z 0.97: placed as those are, at the
 * comoving distance of the CMB-frame redshift in Laniakea's cosmology (cosmicWeb/distances.ts),
 * so a cluster sits among its own galaxies wherever the SDSS drew them. Not the quasars' Planck
 * 2018: the clusters are not past the web, they are in it.
 *
 * ## Once each
 *
 * A cluster the app already draws by name -- one of Laniakea's landmarks (laniakea.json) or a
 * record-holder (recordHolders.ts) -- is left out here: within LANDMARK_MATCH_ARCMIN and, where
 * the landmark has a distance, the redshift it stands for within LANDMARK_MATCH_DZ.
 *
 * ## Mass
 *
 * M_SZ, the catalogue's mass within R500 from the SZ signal and an X-ray scaling relation
 * (A&A 594, A27, Sect. 7.2.1), 10^14 solar masses: a proxy, biased low by the hydrostatic
 * assumption (by about a fifth, the "mass bias" the paper discusses).
 */

export const LANDMARK_MATCH_ARCMIN = 10;
export const LANDMARK_MATCH_DZ = 0.02;

/** The famous ones the cross-identifications name, for the About and the checklist: by an ID in zID, SPT or ACT. */
export const NAMED_CLUSTERS: readonly { pattern: RegExp; name: string }[] = [
  { pattern: /SPT-?CL ?J2344-4243/i, name: 'Phoenix Cluster' },
  { pattern: /\bA0?370\b|ABELL 0?370\b/i, name: 'Abell 370' },
  { pattern: /MACS ?J0717/i, name: 'MACS J0717.5+3745' },
  { pattern: /\bA0?1689\b|ABELL 1689\b/i, name: 'Abell 1689' },
  { pattern: /\bA0?2218\b|ABELL 2218\b/i, name: 'Abell 2218' },
  { pattern: /\bA0?2029\b|ABELL 2029\b/i, name: 'Abell 2029' },
  { pattern: /\bA0?1656\b|ABELL 1656\b/i, name: 'Coma Cluster' },
  { pattern: /\bA0?2163\b|ABELL 2163\b/i, name: 'Abell 2163' },
];

export interface ClusterBuild {
  readonly info: SzClustersInfo;
  readonly bytes: Uint8Array;
}

/** What the app already draws by name, to leave out: a direction, and the redshift where known. */
export interface NamedPlace {
  readonly name: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly z: number | null;
}

/** Laniakea's cluster landmarks as NamedPlaces: the redshift their distance stands for in its cosmology. */
export function landmarkPlaces(landmarks: readonly LaniakeaLandmark[]): NamedPlace[] {
  return landmarks
    .filter((l) => l.kind === 'cluster')
    .map((l) => ({ name: l.name, raDeg: l.raDeg, decDeg: l.decDeg, z: l.distancePc > 0 ? APP_DISTANCES.redshift(l.distancePc / 1e6) : null }));
}

export function buildClusters(table: AsuTable, file: string, drawn: readonly NamedPlace[]): ClusterBuild {
  const n = table.rows;
  const { RAJ2000: ra, DEJ2000: dec, z, MSZ: msz } = table.numbers as Record<string, Float64Array>;
  const names = table.text.Name!;
  const ids = [table.text.zID!, table.text.MCXC!, table.text.ACT!, table.text.SPT!];
  const counts: Record<string, number> = { read: n, noRedshift: 0, alreadyDrawn: 0, kept: 0 };
  const leftOut: SzClustersInfo['leftOut'][number][] = [];
  const named: SzClustersInfo['named'][number][] = [];
  const kept: { position: [number, number, number]; z: number; mass: number }[] = [];
  const cosLimit = Math.cos((LANDMARK_MATCH_ARCMIN / 60) * (Math.PI / 180));
  const directions = drawn.map((d) => unitVector(d.raDeg, d.decDeg));
  for (let c = 0; c < n; c += 1) {
    const zc = z![c]!;
    if (!(zc > 0)) {
      counts.noRedshift! += 1;
      continue;
    }
    const u = unitVector(ra![c]!, dec![c]!);
    const twin = drawn.findIndex((d, k) => {
      const w = directions[k]!;
      if (u[0] * w[0] + u[1] * w[1] + u[2] * w[2] < cosLimit) return false;
      return d.z === null || Math.abs(d.z - zc) <= LANDMARK_MATCH_DZ;
    });
    if (twin >= 0) {
      counts.alreadyDrawn! += 1;
      const w = directions[twin]!;
      const separation = (Math.acos(Math.min(1, u[0] * w[0] + u[1] * w[1] + u[2] * w[2])) * 180 * 60) / Math.PI;
      leftOut.push({ psz2: names[c]!, as: drawn[twin]!.name, separationArcmin: Number(separation.toFixed(2)) });
      continue;
    }
    const zCmb = zCmbOf(ra![c]!, dec![c]!, zc);
    const ident = ids.map((list) => list[c] ?? '').join(' ');
    for (const { pattern, name } of NAMED_CLUSTERS) {
      if (pattern.test(ident)) named.push({ psz2: names[c]!, name, z: zc, massE14: Number((msz![c]! || Number.NaN).toFixed(2)) });
    }
    kept.push({ position: scenePc(ra![c]!, dec![c]!, zCmb), z: zc, mass: Number.isFinite(msz![c]!) && msz![c]! > 0 ? msz![c]! : Number.NaN });
  }
  counts.kept = kept.length;
  const bytes = new Uint8Array(kept.length * SZ_CLUSTER_BYTES);
  const view = new DataView(bytes.buffer);
  const k = kept.length;
  kept.forEach((cluster, i) => {
    for (let axis = 0; axis < 3; axis += 1) view.setFloat32((i * 3 + axis) * 4, cluster.position[axis]!, true);
    view.setFloat32(k * 12 + i * 4, cluster.z, true);
    view.setFloat32(k * 16 + i * 4, cluster.mass, true);
  });
  const masses = kept.map((c) => c.mass).filter(Number.isFinite);
  const zs = kept.map((c) => c.z);
  const r = (x: number) => Number(x.toFixed(3));
  return {
    bytes,
    info: {
      file,
      bytes: bytes.length,
      count: kept.length,
      counts,
      massRange: { min: r(Math.min(...masses)), median: r(median(masses)), max: r(Math.max(...masses)) },
      zRange: { min: r(Math.min(...zs)), median: r(median(zs)), max: r(Math.max(...zs)) },
      cosmologyNote:
        "Laniakea's (the cosmic web's): flat Lambda-CDM, H0 74.6, Omega_m 0.3, the comoving distance of the CMB-frame redshift -- the clusters are of the galaxies the cosmic web draws, and sit among them. Planck 2018 would put them 9-10% farther.",
      leftOut,
      named,
    },
  };
}
