import { STAR3D_OBLIQUITY_ARCSEC } from '../config.ts';
import {
  LANIAKEA_FLAGS,
  LANIAKEA_RECORD_FLOATS,
  type LaniakeaBasinGrid,
  type LaniakeaGroups,
  type LaniakeaInfo,
  type LaniakeaLandmark,
  type LaniakeaNames,
} from '../types.ts';
import { CMB_DIPOLE, H0, LITTLE_H, OMEGA_M } from './frames.ts';
import { ZONE_OF_AVOIDANCE, type LaniakeaBuild } from './galaxies.ts';
import { BASINS, basinGrid, CF4_BOX_MPC_H, DENSITY_SCALE, voxelToScene, WATERSHED_FILES, type BasinCrop } from './watersheds.ts';

/**
 * G3's files, from the build: what `laniakea/` holds and how laniakea.json describes it.
 *
 * - galaxies.bin: LANIAKEA_RECORD_FLOATS float32 a galaxy, most luminous first;
 * - details.bin: the columns an info panel wants (LaniakeaInfo.galaxies.details);
 * - names.json: the search index (LaniakeaNames);
 * - groups.json: the groups galaxies were placed with (LaniakeaGroups);
 * - density.bin, basins.bin: the CF4 reconstruction's overdensity and its watersheds
 *   (watersheds.ts);
 * - laniakea.json: LaniakeaInfo, written last.
 */

export const LANIAKEA_FILES = {
  galaxies: 'galaxies.bin',
  details: 'details.bin',
  names: 'names.json',
  groups: 'groups.json',
  density: 'density.bin',
  basins: 'basins.bin',
} as const;

export interface LaniakeaOutput {
  readonly info: LaniakeaInfo;
  readonly files: Readonly<Record<string, Uint8Array>>;
}

const encoder = new TextEncoder();
const json = (value: unknown) => encoder.encode(`${JSON.stringify(value)}\n`);

/** The galaxies' records, little-endian float32. */
export function galaxyRecords(build: LaniakeaBuild): Uint8Array {
  const n = build.galaxies.length;
  const bytes = new Uint8Array(n * LANIAKEA_RECORD_FLOATS * 4);
  const view = new DataView(bytes.buffer);
  build.galaxies.forEach((g, k) => {
    const values = [g.position[0], g.position[1], g.position[2], g.absV, g.bv, g.halfLightPc, g.axisRatio, g.positionAngleDeg, g.inclinationDeg, g.tType, g.flags, g.group];
    values.forEach((value, i) => view.setFloat32((k * LANIAKEA_RECORD_FLOATS + i) * 4, value, true));
  });
  return bytes;
}

/** The details' columns: see LaniakeaInfo.galaxies.details. */
export function galaxyDetails(build: LaniakeaBuild): Uint8Array {
  const n = build.galaxies.length;
  const floatColumns: ((g: LaniakeaBuild['galaxies'][number]) => number)[] = [
    (g) => g.z,
    (g) => g.luminosityDistancePc,
    (g) => g.distanceErrorPc,
    (g) => g.ownDistancePc,
    (g) => g.vMag,
    (g) => g.kMag,
  ];
  const bytes = new Uint8Array(n * 4 + n * 4 * floatColumns.length + n);
  const view = new DataView(bytes.buffer);
  build.galaxies.forEach((g, k) => {
    view.setUint32(k * 4, g.pgc, true);
    floatColumns.forEach((column, c) => view.setFloat32(n * 4 * (1 + c) + k * 4, column(g), true));
    view.setUint8(n * 4 * (1 + floatColumns.length) + k, g.methods);
  });
  return bytes;
}

export function galaxyNames(build: LaniakeaBuild): LaniakeaNames {
  return {
    count: build.galaxies.length,
    name: build.galaxies.map((g) => g.name),
    otherNames: build.galaxies.flatMap((g, k) => (g.otherNames.length === 0 ? [] : [[k, g.otherNames] as const])),
  };
}

export function groupColumns(build: LaniakeaBuild): LaniakeaGroups {
  const r = (v: number) => Math.round(v);
  return {
    count: build.groups.length,
    source: build.groups.map((g) => g.source),
    id: build.groups.map((g) => g.id),
    name: build.groups.map((g) => g.name),
    raDeg: build.groups.map((g) => Number(g.raDeg.toFixed(4))),
    decDeg: build.groups.map((g) => Number(g.decDeg.toFixed(4))),
    x: build.groups.map((g) => r(g.position[0])),
    y: build.groups.map((g) => r(g.position[1])),
    z: build.groups.map((g) => r(g.position[2])),
    distancePc: build.groups.map((g) => r(g.distancePc)),
    luminosityDistancePc: build.groups.map((g) => r(g.luminosityDistancePc)),
    distanceErrorPc: build.groups.map((g) => (g.distanceErrorPc === null ? null : r(g.distanceErrorPc))),
    distanceEstimated: build.groups.map((g) => g.distanceEstimated),
    members: build.groups.map((g) => g.members),
    catalogueMembers: build.groups.map((g) => g.catalogueMembers),
    depthSigmaPc: build.groups.map((g) => (g.depthSigmaPc === null ? null : r(g.depthSigmaPc))),
  };
}

export interface LaniakeaAssembly {
  readonly build: LaniakeaBuild;
  readonly density: { size: number; values: Int8Array; source: string };
  readonly basins: BasinCrop;
  readonly basinSize: number;
  readonly landmarks: readonly LaniakeaLandmark[];
  readonly sources: LaniakeaInfo['sources'];
}

function percentile(sorted: readonly number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))]!;
}

export function assembleLaniakea(parts: LaniakeaAssembly): LaniakeaOutput {
  const { build } = parts;
  const galaxies = galaxyRecords(build);
  const details = galaxyDetails(build);
  const names = json(galaxyNames(build));
  // Groups named for their landmark where one is placed with them.
  for (const landmark of parts.landmarks) {
    if (landmark.group >= 0) {
      build.groups[landmark.group]!.name = landmark.name;
    }
  }
  const groups = json(groupColumns(build));
  const density = new Uint8Array(parts.density.values.buffer, parts.density.values.byteOffset, parts.density.values.byteLength);
  const gridOrder = Object.keys(WATERSHED_FILES) as LaniakeaBasinGrid[];
  const crop = parts.basins;
  const cropBytes = crop.size[0] * crop.size[1] * crop.size[2];
  const basins = new Uint8Array(cropBytes * gridOrder.length);
  gridOrder.forEach((grid, i) => basins.set(crop.grids[grid], i * cropBytes));
  const distances = build.galaxies.map((g) => g.distancePc).sort((a, b) => a - b);
  const voxelPc = (size: number) => (CF4_BOX_MPC_H / size) * (1e6 / LITTLE_H);
  const voxelMpc3 = (voxelPc(parts.basinSize) / 1e6) ** 3;
  const info: LaniakeaInfo = {
    generatedAt: new Date().toISOString(),
    sources: parts.sources,
    frame: 'Heliocentric; ICRS rotated about its x axis by the IAU 1976 obliquity, 84381.448": the scene frame. Galaxies at their comoving distance.',
    obliquityArcsec: STAR3D_OBLIQUITY_ARCSEC,
    cosmology: {
      h0KmSMpc: H0,
      omegaM: OMEGA_M,
      cmbDipole: { ...CMB_DIPOLE },
      note: 'Flat Lambda-CDM at Cosmicflows-4\'s H0 (Tully et al. 2023) and the CF4 reconstructions\' Omega_m (Courtois et al. 2023). Redshifts in the CMB frame, Planck\'s dipole (Planck Collaboration 2020, A&A 641, A1). A measured modulus is a luminosity distance; positions are comoving, d_L / (1 + z).',
    },
    galaxies: {
      file: LANIAKEA_FILES.galaxies,
      bytes: galaxies.length,
      count: build.galaxies.length,
      recordFloats: LANIAKEA_RECORD_FLOATS,
      details: { file: LANIAKEA_FILES.details, bytes: details.length },
      names: { file: LANIAKEA_FILES.names, bytes: names.length, count: build.galaxies.length },
      counts: build.counts,
      distanceRangePc: {
        min: Math.round(distances[0] ?? 0),
        median: Math.round(percentile(distances, 0.5)),
        max: Math.round(distances[distances.length - 1] ?? 0),
      },
    },
    groups: { file: LANIAKEA_FILES.groups, bytes: groups.length, count: build.groups.length },
    calibration: {
      vMinusK: build.vMinusK.map((r) => ({ ...r, value: Number(r.value.toFixed(3)), scatter: Number.isNaN(r.scatter) ? -1 : Number(r.scatter.toFixed(3)), tMin: Number.isFinite(r.tMin) ? r.tMin : -99, tMax: Number.isFinite(r.tMax) ? r.tMax : 99 })),
      halfLightPerR25: build.halfLight.map((r) => ({ ...r, value: Number(r.value.toFixed(3)), scatterDex: Number(r.scatterDex.toFixed(3)), tMin: Number.isFinite(r.tMin) ? r.tMin : -99, tMax: Number.isFinite(r.tMax) ? r.tMax : 99 })),
      d25PerK20: { value: Number(build.d25PerK20.value.toFixed(3)), calibrators: build.d25PerK20.calibrators, scatterDex: Number(build.d25PerK20.scatterDex.toFixed(3)) },
      note: 'Measured on this run\'s galaxies (laniakea/galaxies.ts): V-K_s over galaxies with HyperLEDA B (A_B < 0.2, cz_CMB < 10,000) and 2MRS K_s; half-light over D25 radius on the Virgo galaxies local-volume.json measures (the EVCC\'s r-band R50); D25 over the K_s 20 mag/arcsec^2 radius where HyperLEDA and 2MRS both give one. tMin/tMax +-99 are open bins; scatter -1: a bin too small, given the all-types value.',
    },
    zoneOfAvoidance: {
      description: '2MRS does not survey the sky within 5 degrees of the Milky Way\'s plane, nor within 8 degrees of it within 30 degrees of the Galactic centre, where its dust and stars hide what lies behind (Huchra et al. 2012). Nothing is drawn there that was not observed: the galaxies inside are other catalogues\' (flag ZONE_OF_AVOIDANCE).',
      absBDeg: ZONE_OF_AVOIDANCE.absBDeg,
      absBNearCentreDeg: ZONE_OF_AVOIDANCE.absBNearCentreDeg,
      nearCentreLDeg: ZONE_OF_AVOIDANCE.nearCentreLDeg,
      galaxiesInside: build.galaxies.filter((g) => (g.flags & LANIAKEA_FLAGS.ZONE_OF_AVOIDANCE) !== 0).length,
    },
    coverage: [
      '2MRS: every galaxy brighter than K_s 11.75 outside the zone of avoidance, 91% of the sky; flux-limited, so ever fewer and only the most luminous with distance -- its median redshift is 0.028 (120 Mpc).',
      'Cosmicflows-4 Fundamental Plane distances: the SDSS\'s (Howlett et al. 2022, MNRAS 515, 953) out to z 0.1 (400 Mpc) in the SDSS footprint of the northern Galactic cap, and 6dFGS\'s (Springob et al. 2014, MNRAS 445, 2677) south of the equator to 16,000 km/s (210 Mpc): beyond 2MRS\'s depth the map holds those patches only.',
      'Cosmicflows-4 Tully-Fisher distances (Kourkchi et al. 2020, ApJ 896, 3): spirals all over the sky to about 15,000 km/s.',
      'The reconstruction (density.bin, basins.bin) fills the whole cube, but is constrained only where there are distances: at its edges, and behind the zone of avoidance, it is the fit\'s prior, the cosmic mean.',
    ],
    density: {
      file: LANIAKEA_FILES.density,
      bytes: density.length,
      size: [parts.density.size, parts.density.size, parts.density.size],
      offset: [0, 0, 0],
      cubeVoxels: parts.density.size,
      voxelPc: Math.round(voxelPc(parts.density.size)),
      voxelToScene: voxelToScene(parts.density.size, [0, 0, 0]).map((v) => Number(v.toPrecision(10))),
      scale: DENSITY_SCALE,
      source: parts.density.source,
    },
    basins: {
      file: LANIAKEA_FILES.basins,
      bytes: basins.length,
      size: crop.size,
      offset: crop.offset,
      cubeVoxels: parts.basinSize,
      voxelPc: Math.round(voxelPc(parts.basinSize)),
      voxelToScene: voxelToScene(parts.basinSize, crop.offset).map((v) => Number(v.toPrecision(10))),
      grids: gridOrder,
      home: crop.home,
      basins: BASINS.flatMap((row) =>
        (['galaxies', 'groups'] as const).flatMap((reconstruction) => {
          const fit = row[reconstruction];
          const grid = basinGrid(row.kind, reconstruction);
          if (fit === null || grid === null) {
            return [];
          }
          const voxels = crop.voxels[grid][fit.label] ?? 0;
          return [{ name: row.name, kind: row.kind, grid, label: fit.label, voxels, volumeMpc3: Math.round(voxels * voxelMpc3), paperVolumeMpcH3: fit.volumeMpcH3 }];
        }),
      ),
      source: 'Dupuy & Courtois 2023, A&A 678, A176: the watersheds of the Cosmicflows-4 velocity field of Courtois et al. 2023, https://projets.ip2i.in2p3.fr/cosmicflows/ (CF4_new_128-z008_watersheds-fits.zip).',
    },
    landmarks: parts.landmarks,
  };
  return {
    info,
    files: {
      [LANIAKEA_FILES.galaxies]: galaxies,
      [LANIAKEA_FILES.details]: details,
      [LANIAKEA_FILES.names]: names,
      [LANIAKEA_FILES.groups]: groups,
      [LANIAKEA_FILES.density]: density,
      [LANIAKEA_FILES.basins]: basins,
    },
  };
}

// ---------------------------------------------------------------------------------------
// The summary

export function describeLaniakea(output: LaniakeaOutput, build: LaniakeaBuild): string[] {
  const { info } = output;
  const c = info.galaxies.counts;
  const n = info.galaxies.count;
  const mpc = (pc: number) => `${(pc / 1e6).toFixed(1)} Mpc`;
  const lines: string[] = [];
  lines.push(
    `[laniakea] ${n} galaxies: ${c['CF4'] ?? 0} with a CF4 distance, ${c['TWO_MRS'] ?? 0} in 2MRS (${c['2mrsMatchedByTully'] ?? 0} matched by Tully's PGC, ` +
      `${c['2mrsMatchedToCf4ByPosition'] ?? 0} to CF4 by position). Left out: ${build.excluded.local.length} drawn by local-group.json or local-volume.json, ` +
      `${build.excluded.drawnByTheApp} by the app (M31), ${build.excluded.quasars} 2MRS quasars, ${build.excluded.noRedshift} 2MRS galaxies with no redshift, ${build.excluded.tooNear} under 500 km/s, ` +
      `${build.excluded.duplicatePgc} 2MRS rows on a PGC already taken.`,
  );
  lines.push(
    `[laniakea] placed: own CF4 distance ${c['DISTANCE_OWN'] ?? 0}, CF4 group's ${c['DISTANCE_GROUP'] ?? 0}, linked to a CF4 group through its 2MASS nest ${c['DISTANCE_LINKED'] ?? 0}, ` +
      `by redshift ${c['DISTANCE_REDSHIFT'] ?? 0} (${c['GROUP_REDSHIFT'] ?? 0} at their nest's mean); depth drawn within a group for ${c['DEPTH_DRAWN'] ?? 0}.`,
  );
  lines.push(
    `[laniakea] CF4 methods: ${['SNIa', 'TF', 'FP', 'SBF', 'SNII', 'TRGB', 'Cepheid', 'Maser'].map((m) => `${m} ${c[`method ${m}`] ?? 0}`).join(', ')}.`,
  );
  lines.push(
    `[laniakea] V: measured ${c['V_MEASURED'] ?? 0}, from K_s ${c['V_FROM_K'] ?? 0}, none ${c['no V'] ?? 0}; colour from type ${c['COLOUR_ESTIMATED'] ?? 0}; ` +
      `size from D25 ${n - (c['SIZE_FROM_K'] ?? 0) - (c['no size'] ?? 0)}, from K_s ${c['SIZE_FROM_K'] ?? 0}, none ${c['no size'] ?? 0}; position angle ${c['position angle'] ?? 0}; T type ${c['T type'] ?? 0}.`,
  );
  lines.push(
    `[laniakea] checks: ${c['HyperLEDA record not a galaxy'] ?? 0} HyperLEDA records not a galaxy's (not used), ${c['V from K: B disagreed'] ?? 0} V from K_s where B disagreed by over 1.5 mag, ` +
      `${c['CF4 group not in the groups table'] ?? 0} CF4 galaxies whose group the groups table lacks, ${c["too far from their group's centre"] ?? 0} too far from their group's centre to be placed with it.`,
  );
  lines.push(
    `[laniakea] distances ${mpc(info.galaxies.distanceRangePc.min)} to ${mpc(info.galaxies.distanceRangePc.max)}, median ${mpc(info.galaxies.distanceRangePc.median)}; ` +
      `${info.zoneOfAvoidance.galaxiesInside} in 2MRS's zone of avoidance; ${info.groups.count} groups.`,
  );
  lines.push(
    `[laniakea] V-K_s by type: ${info.calibration.vMinusK.map((r) => `${r.bin} ${r.value.toFixed(2)} (${r.calibrators}${r.scatter >= 0 ? `, rms ${r.scatter.toFixed(2)}` : ''})`).join(', ')}.`,
  );
  lines.push(
    `[laniakea] half-light / R25: ${info.calibration.halfLightPerR25.map((r) => `${r.bin} ${r.value.toFixed(3)} (${r.calibrators}, ${r.scatterDex.toFixed(2)} dex)`).join(', ')}; ` +
      `R25 / R_K20 ${info.calibration.d25PerK20.value.toFixed(2)} (${info.calibration.d25PerK20.calibrators}, ${info.calibration.d25PerK20.scatterDex.toFixed(2)} dex).`,
  );
  const brightest = build.galaxies
    .slice(0, 8)
    .map((g) => `${g.name} ${g.absV.toFixed(2)}`)
    .join(', ');
  lines.push(`[laniakea] most luminous (M_V): ${brightest}.`);
  lines.push(
    `[laniakea] basins (voxels, volume vs the paper's): ${info.basins.basins
      .map((b) => `${b.name} [${b.grid}] ${b.voxels} = ${(b.volumeMpc3 * LITTLE_H ** 3 / 1e6).toFixed(2)} vs ${(b.paperVolumeMpcH3 / 1e6).toFixed(1)} million (Mpc/h)^3`)
      .join('; ')}. The Milky Way's voxel: ${Object.entries(info.basins.home)
      .map(([grid, label]) => `${grid} ${label}`)
      .join(', ')}.`,
  );
  lines.push(`[laniakea] density ${info.density.cubeVoxels}^3 from ${info.density.source.split(':')[0]}; basins cropped to ${info.basins.size.join('x')} at ${info.basins.offset.join(',')}.`);
  lines.push(
    `[laniakea] landmarks: ${info.landmarks.map((l) => `${l.name} ${(l.distancePc / 1e6).toFixed(0)} Mpc${l.distanceEstimated ? '*' : ''}`).join(', ')} (* estimated).`,
  );
  lines.push(
    `[laniakea] files: ${Object.entries(output.files)
      .map(([file, bytes]) => `${file} ${(bytes.length / 1e6).toFixed(2)} MB`)
      .join(', ')}.`,
  );
  return lines;
}
