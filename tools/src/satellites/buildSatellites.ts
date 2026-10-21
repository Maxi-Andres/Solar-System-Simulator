import {
  CELESTRAK_GP_URL,
  SATELLITE_ACCURACY_DAYS,
  SATELLITE_CREDIT,
  SATELLITE_DRAG_ALTITUDE_KM,
  SATELLITE_FRAME_WINDOW_DAYS,
  SATELLITE_MAX_ELEMENT_AGE_DAYS,
  SATELLITE_SGP4_THRESHOLD_KM,
  SATELLITE_WINDOW_DAYS,
  SATELLITES_BULK_FILE,
  SATELLITES_NAMED_FILE,
  SATELLITES_NAMES_FILE,
  SATELLITES_SGP4_FILE,
} from '../config.ts';
import {
  SATELLITE_GROUPS,
  SATELLITE_OBJECT_TYPES,
  SATELLITE_RECORD_FLOATS,
  SATELLITE_REGIME_SHIFT,
  SATELLITE_REGIMES,
  SATELLITE_TYPE_SHIFT,
  type NamedSatellite,
  type SatelliteAccuracy,
  type SatelliteGroup,
  type SatelliteInfo,
  type SatelliteNames,
  type SatelliteObjectType,
  type SatelliteOmm,
  type SatelliteRegime,
  type SgpSatellite,
} from '../types.ts';
import { epochJdUtc, type CelestrakRead } from './celestrak.ts';
import { frameDrift, temeToEclipticJ2000 } from './frames.ts';
import {
  bulkElements,
  measureBulkError,
  packRecord,
  recordValues,
  satrecOf,
  sgp4Position,
  SGP4_EARTH_RADIUS_KM,
  type BulkElements,
} from './meanElements.ts';
import { EXCLUDED_NORAD_IDS, NAMED_SATELLITES } from './named.ts';

/**
 * From CelesTrak's groups to the three tiers the app reads: see SatelliteInfo in types.ts.
 *
 *   1. Every group's objects merged by NORAD number, each keeping the bit of every group it
 *      was in. The same object in two groups is the same element set, CelesTrak's one
 *      current one; where two ever differed the newer epoch would be kept.
 *   2. Starlink, OneWeb and Kuiper membership read from the name. On 2026-10-21 that found
 *      every one of the 11,121 in CelesTrak's `starlink` group and 27 more, launched the day
 *      before and not yet added to it.
 *   3. Left out: what the catalog draws from Horizons (TESS), element sets of objects in
 *      drag older than SATELLITE_MAX_ELEMENT_AGE_DAYS, and whatever SGP4 cannot place at
 *      the reference.
 *   4. The named satellites go to `named.json`. Every other object is turned into a bulk
 *      record, measured against full SGP4 over the window, and goes to the bulk -- or, if
 *      the record misses SGP4 by more than SATELLITE_SGP4_THRESHOLD_KM, to `sgp4.json`.
 *   5. The bulk's accuracy is measured on every record it holds, in float32 as the GPU
 *      will compute it, and published per regime.
 */

/** Everything the writer needs. */
export interface SatelliteBuild {
  readonly info: SatelliteInfo;
  readonly named: readonly NamedSatellite[];
  readonly sgp4: readonly SgpSatellite[];
  readonly bulk: Float32Array;
  readonly names: SatelliteNames;
  /** Named satellites the run could not find, by id, for the log. */
  readonly namedMissing: readonly string[];
}

const groupBit = (group: SatelliteGroup) => 1 << SATELLITE_GROUPS.indexOf(group);

/** Constellations read from the name: CelesTrak's names for them all start so. */
const NAME_GROUPS: readonly (readonly [RegExp, SatelliteGroup])[] = [
  [/^STARLINK/, 'starlink'],
  [/^ONEWEB/, 'oneweb'],
  [/^KUIPER/, 'kuiper'],
];

/** The orbit regime of a set of mean elements; see SATELLITE_REGIMES. */
export function regimeOf(elements: Pick<BulkElements, 'aKm' | 'e' | 'dM'>): SatelliteRegime {
  const apogeeAltitudeKm = elements.aKm * (1 + elements.e) - SGP4_EARTH_RADIUS_KM;
  if (apogeeAltitudeKm < 2000) {
    return 'leo';
  }
  if (elements.e >= 0.25) {
    return 'heo';
  }
  const revolutionsPerDay = elements.dM / (2 * Math.PI);
  return revolutionsPerDay > 0.9 && revolutionsPerDay < 1.1 ? 'geo' : 'meo';
}

/**
 * The SATCAT object type, or, for an object the SATCAT read does not cover (the debris
 * groups), the one its catalogue name states: "COSMOS 2251 DEB", "SL-8 R/B".
 */
export function objectTypeOf(
  name: string,
  satcatType: string | undefined,
  active: boolean,
): SatelliteObjectType {
  if (satcatType !== undefined && (SATELLITE_OBJECT_TYPES as readonly string[]).includes(satcatType)) {
    return satcatType as SatelliteObjectType;
  }
  if (/\bDEB\b/.test(name)) {
    return 'DEB';
  }
  if (/\bR\/B\b/.test(name)) {
    return 'R/B';
  }
  return active ? 'PAY' : 'UNK';
}

export function packFlags(groups: number, regime: SatelliteRegime, type: SatelliteObjectType): number {
  return (
    groups +
    SATELLITE_REGIMES.indexOf(regime) * 2 ** SATELLITE_REGIME_SHIFT +
    SATELLITE_OBJECT_TYPES.indexOf(type) * 2 ** SATELLITE_TYPE_SHIFT
  );
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) {
    return NaN;
  }
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.min(low + 1, sorted.length - 1);
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (position - low);
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/** The days the tier rule checks: enough to catch a parabola's miss anywhere in the window. */
function thresholdDays(windowDays: number): number[] {
  return [0, 1 / 24, 0.5, 1, 2, windowDays];
}

export interface BuildOptions {
  readonly read: CelestrakRead;
  /** UTC Julian day the records are given at. */
  readonly referenceJdUtc: number;
  readonly maxAgeDays?: number;
  readonly thresholdKm?: number;
  readonly windowDays?: number;
}

export function buildSatellites(options: BuildOptions): SatelliteBuild {
  const {
    read,
    referenceJdUtc,
    maxAgeDays = SATELLITE_MAX_ELEMENT_AGE_DAYS,
    thresholdKm = SATELLITE_SGP4_THRESHOLD_KM,
    windowDays = SATELLITE_WINDOW_DAYS,
  } = options;

  // 1-2. Merge by NORAD number, with every group's bit.
  const merged = new Map<number, { omm: SatelliteOmm; groups: number }>();
  for (const [group, rows] of read.gp) {
    for (const omm of rows) {
      const entry = merged.get(omm.NORAD_CAT_ID);
      if (entry === undefined) {
        merged.set(omm.NORAD_CAT_ID, { omm, groups: groupBit(group) });
        continue;
      }
      entry.groups |= groupBit(group);
      if (epochJdUtc(omm.EPOCH) > epochJdUtc(entry.omm.EPOCH)) {
        entry.omm = omm;
      }
    }
  }
  for (const entry of merged.values()) {
    for (const [pattern, group] of NAME_GROUPS) {
      if (pattern.test(entry.omm.OBJECT_NAME)) {
        entry.groups |= groupBit(group);
      }
    }
  }

  const namedById = new Map(NAMED_SATELLITES.map((entry) => [entry.noradId, entry]));
  const dropped = { stale: 0, invalid: 0, excluded: 0 };
  const named: NamedSatellite[] = [];
  const sgp4: SgpSatellite[] = [];
  const bulkValues: number[][] = [];
  const bulkNames = { name: [] as string[], noradId: [] as number[], cosparId: [] as string[], ageDays: [] as number[] };
  const bulkRegimes: SatelliteRegime[] = [];
  const bulkSatrecs: NonNullable<ReturnType<typeof satrecOf>>[] = [];
  const groupCounts: Partial<Record<SatelliteGroup, number>> = {};
  const regimeCounts: Partial<Record<SatelliteRegime, number>> = {};
  let minEpoch = Infinity;
  let maxEpoch = -Infinity;
  const checkDays = thresholdDays(windowDays);

  // Ascending NORAD number: a stable order, and the catalogue's own.
  for (const noradId of [...merged.keys()].sort((a, b) => a - b)) {
    const { omm, groups } = merged.get(noradId)!;
    if (EXCLUDED_NORAD_IDS.has(noradId)) {
      dropped.excluded += 1;
      continue;
    }
    const epoch = epochJdUtc(omm.EPOCH);
    const satrec = satrecOf(omm);
    if (
      satrec !== null &&
      referenceJdUtc - epoch > maxAgeDays &&
      satrec.a * (1 - satrec.ecco) * SGP4_EARTH_RADIUS_KM - SGP4_EARTH_RADIUS_KM < SATELLITE_DRAG_ALTITUDE_KM
    ) {
      dropped.stale += 1;
      continue;
    }
    // SGP4 must place it at the reference itself; one it puts underground there, or whose
    // elements it refuses, has nothing to be drawn from.
    if (satrec === null || sgp4Position(satrec, referenceJdUtc) === null) {
      dropped.invalid += 1;
      continue;
    }
    // Classified on the element set's own mean elements, so every tier is classified alike.
    const regime = regimeOf({
      aKm: satrec.a * SGP4_EARTH_RADIUS_KM,
      e: satrec.ecco,
      dM: satrec.no * 1440,
    });
    const satcat = read.satcat.get(noradId);
    const type = objectTypeOf(omm.OBJECT_NAME, satcat?.objectType, (groups & groupBit('active')) !== 0);
    const flags = packFlags(groups, regime, type);
    const launchDate = satcat?.launchDate ?? null;

    const entry = namedById.get(noradId);
    if (entry !== undefined) {
      named.push({
        id: entry.id,
        name: entry.name,
        noradId,
        cosparId: omm.OBJECT_ID,
        operator: entry.operator,
        launchDate,
        flags,
        note: entry.note,
        // Its look, from the list rather than CelesTrak: see named.ts.
        ...(entry.look === null ? {} : { spanM: entry.look.spanM, shape: entry.look.shape }),
        omm,
      });
    } else {
      // Null where SGP4 places it at the reference but stops somewhere else in the window:
      // re-entering. Full SGP4 in the browser reports that itself, so it is SGP4's to draw.
      const elements = bulkElements(satrec, referenceJdUtc, windowDays);
      const values = elements === null ? null : recordValues(elements, flags);
      const misses =
        values === null ? null : measureBulkError(satrec, values, referenceJdUtc, checkDays, true);
      const worst = misses === null ? null : Math.max(...misses);
      if (worst === null || worst > thresholdKm) {
        sgp4.push({ flags, launchDate, bulkErrorKm: worst === null ? null : round(worst, 1), omm });
      } else {
        bulkValues.push(values!);
        bulkSatrecs.push(satrec);
        bulkRegimes.push(regime);
        bulkNames.name.push(omm.OBJECT_NAME);
        bulkNames.noradId.push(noradId);
        bulkNames.cosparId.push(omm.OBJECT_ID);
        bulkNames.ageDays.push(round(epoch - referenceJdUtc, 2));
      }
    }
    minEpoch = Math.min(minEpoch, epoch);
    maxEpoch = Math.max(maxEpoch, epoch);
    regimeCounts[regime] = (regimeCounts[regime] ?? 0) + 1;
    for (const group of SATELLITE_GROUPS) {
      if ((groups & groupBit(group)) !== 0) {
        groupCounts[group] = (groupCounts[group] ?? 0) + 1;
      }
    }
  }

  const bulk = new Float32Array(bulkValues.length * SATELLITE_RECORD_FLOATS);
  bulkValues.forEach((values, index) => packRecord(bulk, index, values));

  // 5. The bulk's accuracy, from the float32 records as written.
  const accuracy: SatelliteAccuracy[] = [];
  for (const regime of SATELLITE_REGIMES) {
    const columns: number[][] = SATELLITE_ACCURACY_DAYS.map(() => []);
    bulkRegimes.forEach((candidate, index) => {
      if (candidate !== regime) {
        return;
      }
      const record = bulk.subarray(index * SATELLITE_RECORD_FLOATS, (index + 1) * SATELLITE_RECORD_FLOATS);
      const misses = measureBulkError(bulkSatrecs[index]!, record, referenceJdUtc, SATELLITE_ACCURACY_DAYS, true);
      if (misses === null) {
        return;
      }
      misses.forEach((miss, column) => columns[column]!.push(miss));
    });
    const count = columns[0]!.length;
    if (count === 0) {
      continue;
    }
    for (const column of columns) {
      column.sort((a, b) => a - b);
    }
    accuracy.push({
      regime,
      count,
      days: SATELLITE_ACCURACY_DAYS.map((day) => round(day, 4)),
      medianKm: columns.map((column) => round(quantile(column, 0.5), 1)),
      p95Km: columns.map((column) => round(quantile(column, 0.95), 1)),
    });
  }

  const namedFound = new Set(named.map((satellite) => satellite.id));
  const namedMissing = NAMED_SATELLITES.filter((entry) => !namedFound.has(entry.id)).map((entry) => entry.id);
  const matrix = temeToEclipticJ2000(referenceJdUtc);

  const info: SatelliteInfo = {
    source: { name: 'CelesTrak GP data (OMM), via its GP and SATCAT APIs', url: CELESTRAK_GP_URL, queriedAt: read.queriedAt },
    credit: SATELLITE_CREDIT,
    referenceJdUtc,
    frame: {
      elements: 'TEME',
      temeToEclipticJ2000: [...matrix],
      maxErrorArcsec: round(frameDrift(referenceJdUtc, SATELLITE_FRAME_WINDOW_DAYS), 2),
      windowDays: SATELLITE_FRAME_WINDOW_DAYS,
    },
    groups: SATELLITE_GROUPS,
    groupCounts: Object.fromEntries(
      SATELLITE_GROUPS.filter((group) => groupCounts[group] !== undefined).map((group) => [group, groupCounts[group]]),
    ),
    groupsMissing: read.missing,
    regimes: SATELLITE_REGIMES,
    regimeCounts: Object.fromEntries(
      SATELLITE_REGIMES.filter((regime) => regimeCounts[regime] !== undefined).map((regime) => [regime, regimeCounts[regime]]),
    ),
    objectTypes: SATELLITE_OBJECT_TYPES,
    count: named.length + bulkValues.length + sgp4.length,
    named: { file: SATELLITES_NAMED_FILE, count: named.length },
    bulk: {
      file: SATELLITES_BULK_FILE,
      count: bulkValues.length,
      bytes: bulk.byteLength,
      recordFloats: SATELLITE_RECORD_FLOATS,
    },
    names: { file: SATELLITES_NAMES_FILE },
    sgp4: { file: SATELLITES_SGP4_FILE, count: sgp4.length, thresholdKm, windowDays },
    epochs: { minJdUtc: minEpoch, maxJdUtc: maxEpoch },
    maxElementAgeDays: maxAgeDays,
    dropped,
    accuracy,
  };
  return { info, named, sgp4, bulk, names: bulkNames, namedMissing };
}

/** The reference instant for a read: when it was asked, to the whole minute, as a UTC JD. */
export function referenceFor(queriedAt: string): number {
  const ms = Math.floor(Date.parse(queriedAt) / 60_000) * 60_000;
  return ms / 86_400_000 + 2440587.5;
}

/** The log lines for a build. */
export function describeSatellites(build: SatelliteBuild): string[] {
  const { info } = build;
  const lines = [
    `[satellites] ${info.count} satellites: ${info.named.count} named, ${info.bulk.count} bulk ` +
      `(${(info.bulk.bytes / 1e6).toFixed(2)} MB), ${info.sgp4.count} on SGP4 (bulk off by > ${info.sgp4.thresholdKm} km)`,
    `[satellites] dropped ${info.dropped.stale} stale (> ${info.maxElementAgeDays} d in drag), ` +
      `${info.dropped.invalid} SGP4 cannot place, ${info.dropped.excluded} drawn from Horizons`,
    `[satellites] regimes ${SATELLITE_REGIMES.map((regime) => `${regime} ${info.regimeCounts[regime] ?? 0}`).join(', ')}`,
    `[satellites] frame matrix good to ${info.frame.maxErrorArcsec}" over ±${info.frame.windowDays} d`,
  ];
  for (const row of info.accuracy) {
    lines.push(
      `[satellites]   bulk vs SGP4, ${row.regime} (${row.count}): ` +
        row.days.map((day, k) => `${day < 1 ? `${Math.round(day * 24)}h` : `${day}d`} ${row.medianKm[k]}/${row.p95Km[k]}`).join(', ') +
        ' km (median/p95)',
    );
  }
  if (info.groupsMissing.length > 0) {
    lines.push(`[satellites] groups not read this run: ${info.groupsMissing.join(', ')}`);
  }
  if (build.namedMissing.length > 0) {
    lines.push(`[satellites] named satellites not in this run's data: ${build.namedMissing.join(', ')}`);
  }
  return lines;
}
