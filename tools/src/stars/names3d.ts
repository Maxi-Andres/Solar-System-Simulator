import type { Stars3dNames } from '../types.ts';
import type { Stars3dBuild } from './build3d.ts';
import type { SkyBuild } from './buildStarCatalog.ts';
import type { BscStar } from './bsc.ts';
import { parseGreekDesignation, shortForms, spelledOut } from './designations.ts';
import { NEARBY_STARS, type NearbyStar } from './nearbySystems.ts';
import { WGSN_NAMES, type WgsnEntry } from './wgsn.ts';

/**
 * The search index of the 3D stars: who has a name, and which record it is.
 *
 * Three sources of names, in order of authority:
 *
 *  1. **The IAU's proper names** (wgsn.ts). Joined by HIP number; by position for the
 *     names it gives none (exoplanet hosts, mostly), within 3" of the star's J2000
 *     direction -- the list's positions are at epoch 2000 too -- and within 2 mag of its
 *     V where the list gives a magnitude.
 *  2. **The nearest systems** (nearbySystems.ts): the catalogue designations people know
 *     them by -- Wolf 359, Lalande 21185, Luyten's Star -- and which system each star
 *     belongs to. Joined by Gaia DR3 id, or HIP for the stars Gaia saturates.
 *  3. **Bayer and Flamsteed designations** from the Bright Star Catalogue, joined by HD
 *     number: "Epsilon Eridani", "61 Cygni".
 *
 * A star keeps the most authoritative name as its display and every other as a
 * designation, plus its catalogue numbers -- HR, HD, HIP, Gaia DR3 -- so a search for any
 * of them lands on it.
 */

const POSITION_RADIUS_DEG = 3 / 3600;
const MAGNITUDE_TOLERANCE = 2;

interface Entry {
  display: string;
  iau: boolean;
  readonly designations: Set<string>;
  system: string | null;
  nearest: number | null;
  spectralType: string | null;
}

export interface NamesInput {
  readonly build: Stars3dBuild;
  /** The sky the build extends: its stars carry the HD numbers and spectral types. */
  readonly sky: SkyBuild;
  /** Null when the Bright Star Catalogue could not be read. */
  readonly bsc: readonly BscStar[] | null;
  readonly wgsn?: readonly WgsnEntry[];
  readonly nearby?: readonly NearbyStar[];
  /** How many of the nearest systems get a rank. */
  readonly nearestSystems?: number;
}

export interface NamesBuild {
  readonly names: Stars3dNames;
  /** IAU names with no star here: beyond 100 pc and not in the sky, or no distance. */
  readonly wgsnUnmatched: number;
  readonly wgsnMatchedByPosition: number;
  /** Nearby-system stars named in nearbySystems.ts and not found: a stale id is a bug. */
  readonly nearbyUnmatched: readonly string[];
  readonly bscDesignations: number;
}

/** "* tet Eri" and "V* V2500 Oph" are SIMBAD's ways of writing "tet Eri", "V2500 Oph". */
function cleanDesignation(text: string): string {
  return text.replace(/^V?\*\s+/, '').replace(/\s+/g, ' ').trim();
}

export function buildNames({
  build,
  sky,
  bsc,
  wgsn = WGSN_NAMES,
  nearby = NEARBY_STARS,
  nearestSystems = 100,
}: NamesInput): NamesBuild {
  // Everything below is by table index; the index file's positions come at the end.
  const { table, order, tierStarts } = build;
  const skyStarOf = (index: number) => {
    const row = table.sky[index]!;
    return row >= 0 ? sky.stars[row]! : null;
  };
  const byHip = new Map<number, number>();
  const byGaia = new Map<bigint, number>();
  const byHd = new Map<number, number>();
  // Positions bucketed by whole degrees of declination: enough for a few hundred lookups.
  const byDec = new Map<number, number[]>();
  for (let index = 0; index < table.count; index += 1) {
    const hip = table.hip[index]!;
    if (hip > 0 && !byHip.has(hip)) {
      byHip.set(hip, index);
    }
    if (table.gaiaId[index]! !== 0n) {
      byGaia.set(table.gaiaId[index]!, index);
    }
    const hd = skyStarOf(index)?.hd ?? null;
    if (hd !== null && !byHd.has(hd)) {
      byHd.set(hd, index);
    }
    const band = Math.floor(table.decDeg[index]!);
    let list = byDec.get(band);
    if (list === undefined) {
      list = [];
      byDec.set(band, list);
    }
    list.push(index);
  }
  const nearestTo = (raDeg: number, decDeg: number, magnitude: number | null): number | null => {
    let best: number | null = null;
    let bestSeparation = POSITION_RADIUS_DEG;
    for (let band = Math.floor(decDeg) - 1; band <= Math.floor(decDeg) + 1; band += 1) {
      for (const index of byDec.get(band) ?? []) {
        const dRa = ((table.raDeg[index]! - raDeg + 540) % 360) - 180;
        const separation = Math.hypot(
          dRa * Math.cos(decDeg * (Math.PI / 180)),
          table.decDeg[index]! - decDeg,
        );
        if (
          separation <= bestSeparation &&
          (magnitude === null || Math.abs(table.vMag[index]! - magnitude) <= MAGNITUDE_TOLERANCE)
        ) {
          best = index;
          bestSeparation = separation;
        }
      }
    }
    return best;
  };

  const entries = new Map<number, Entry>();
  const entryFor = (index: number, display: string, iau: boolean): Entry => {
    let entry = entries.get(index);
    if (entry === undefined) {
      entry = {
        display,
        iau,
        designations: new Set(),
        system: null,
        nearest: null,
        spectralType: skyStarOf(index)?.spectralType ?? null,
      };
      entries.set(index, entry);
    }
    return entry;
  };

  // 1. The IAU's names.
  let wgsnUnmatched = 0;
  let wgsnMatchedByPosition = 0;
  for (const [name, designation, hip, bayer, , component, wds, raDeg, decDeg, magnitude] of wgsn) {
    let index = hip !== null ? byHip.get(hip) : undefined;
    if (index === undefined && raDeg !== null && decDeg !== null) {
      const found = nearestTo(raDeg, decDeg, magnitude);
      if (found !== null) {
        index = found;
        wgsnMatchedByPosition += 1;
      }
    }
    if (index === undefined) {
      wgsnUnmatched += 1;
      continue;
    }
    const entry = entries.get(index);
    if (entry !== undefined && entry.iau) {
      // Two IAU names on one record: components the catalogue does not resolve.
      entry.designations.add(name);
    } else {
      const fresh = entryFor(index, name, true);
      fresh.display = name;
      fresh.iau = true;
    }
    const named = entries.get(index)!;
    const suffix = component === null ? '' : ` ${component}`;
    if (designation !== null) {
      named.designations.add(cleanDesignation(designation));
    }
    if (bayer !== null) {
      const parsed = parseGreekDesignation(bayer);
      if (parsed !== null) {
        named.designations.add(`${spelledOut(parsed)}${suffix}`);
        for (const form of shortForms(parsed)) {
          named.designations.add(`${form}${suffix}`);
        }
      } else {
        named.designations.add(`${bayer}${suffix}`);
      }
    }
    if (wds !== null) {
      named.system ??= `WDS J${wds}`;
    }
  }

  // 2. The nearest systems.
  const nearbyUnmatched: string[] = [];
  const systemDistance = new Map<string, number>();
  const membersOf = new Map<string, number[]>();
  for (const star of nearby) {
    const index =
      (star.gaiaDr3 !== null ? byGaia.get(BigInt(star.gaiaDr3)) : undefined) ??
      (star.hip !== null ? byHip.get(star.hip) : undefined);
    if (index === undefined) {
      nearbyUnmatched.push(star.name);
      continue;
    }
    const existing = entries.get(index);
    const entry = entryFor(index, star.name, false);
    if (existing !== undefined && existing.display !== star.name) {
      entry.designations.add(star.name);
    }
    for (const designation of star.designations ?? []) {
      entry.designations.add(designation);
    }
    entry.spectralType ??= star.spectralType;
    const system = star.system ?? star.name;
    if (star.system !== null) {
      entry.system = star.system;
    }
    const distance = 1000 / table.parallaxMas[index]!;
    systemDistance.set(system, Math.min(systemDistance.get(system) ?? Infinity, distance));
    membersOf.set(system, [...(membersOf.get(system) ?? []), index]);
  }
  [...systemDistance.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, nearestSystems)
    .forEach(([system], rank) => {
      for (const index of membersOf.get(system) ?? []) {
        entries.get(index)!.nearest = rank + 1;
      }
    });

  // 3. Bayer and Flamsteed, by HD number.
  let bscDesignations = 0;
  for (const star of bsc ?? []) {
    const index = byHd.get(star.hd);
    if (index === undefined) {
      continue;
    }
    const existing = entries.get(index);
    if (star.designation === null) {
      if (existing !== undefined) {
        existing.designations.add(`HR ${star.hr}`);
      }
      continue;
    }
    bscDesignations += 1;
    const entry = entryFor(index, spelledOut(star.designation), false);
    entry.designations.add(spelledOut(star.designation));
    for (const form of shortForms(star.designation)) {
      entry.designations.add(form);
    }
    entry.designations.add(`HR ${star.hr}`);
    entry.spectralType ??= star.spectralType;
    const ccdm = skyStarOf(index)?.ccdm ?? null;
    if (entry.system === null && ccdm !== null) {
      entry.system = `CCDM J${ccdm}`;
    }
  }

  // Catalogue numbers last, and the display never repeated as a designation.
  const ordered = [...entries.entries()].sort(
    (a, b) => table.vMag[a[0]]! - table.vMag[b[0]]! || a[0] - b[0],
  );
  const positionOf = new Map<number, number>();
  for (const [index] of ordered) {
    positionOf.set(index, -1);
  }
  order.forEach((index, position) => {
    if (positionOf.has(index)) {
      positionOf.set(index, position);
    }
  });
  const names: {
    -readonly [K in keyof Stars3dNames]: Stars3dNames[K] extends readonly (infer U)[] ? U[] : Stars3dNames[K];
  } = {
    count: ordered.length,
    display: [],
    iau: [],
    designations: [],
    system: [],
    nearest: [],
    spectralType: [],
    tier: [],
    index: [],
  };
  for (const [index, entry] of ordered) {
    const hd = skyStarOf(index)?.hd ?? null;
    if (hd !== null) {
      entry.designations.add(`HD ${hd}`);
    }
    if (table.hip[index]! > 0) {
      entry.designations.add(`HIP ${table.hip[index]}`);
    }
    if (table.gaiaId[index]! !== 0n) {
      entry.designations.add(`Gaia DR3 ${table.gaiaId[index]}`);
    }
    entry.designations.delete(entry.display);
    const position = positionOf.get(index)!;
    let tier = 0;
    while (tier + 1 < tierStarts.length && tierStarts[tier + 1]! <= position) {
      tier += 1;
    }
    names.display.push(entry.display);
    names.iau.push(entry.iau);
    names.designations.push([...entry.designations]);
    names.system.push(entry.system);
    names.nearest.push(entry.nearest);
    names.spectralType.push(entry.spectralType);
    names.tier.push(tier);
    names.index.push(position - tierStarts[tier]!);
  }

  return { names, wgsnUnmatched, wgsnMatchedByPosition, nearbyUnmatched, bscDesignations };
}
