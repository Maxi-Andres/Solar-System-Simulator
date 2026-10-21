import type {
  BodyDefinition,
  BodyId,
  CraftShape,
  OsculatingElements,
  SatelliteOmm,
} from '@sss/tools/types';
import type { SatRec } from 'satellite.js';
import { json2satrec } from 'satellite.js/io';
import { sgp4 } from 'satellite.js/sgp4';

import type { EphemerisStore, PropagatedOptions } from './ephemerisStore.ts';
import { solveKepler, stateToOsculatingElements } from './kepler.ts';
import { OTHER_CHIP, tagSatelliteBody, untagSatelliteBody } from './satelliteGroups.ts';
import {
  BULK_WINDOW_DAYS,
  NAMED_WINDOW_DAYS,
  SAT,
  SATELLITE_FLOATS,
  type SatelliteNameIndex,
  type Satellites,
} from './satellites.ts';
import { applyMatrix, satelliteInstant } from './teme.ts';
import { utcToTdb } from './time.ts';
import type { StateVector } from './vec3.ts';

/**
 * Earth satellites as bodies: the named ones from the start, and any other chosen from
 * search.
 *
 * SGP4 is the model the element sets are made for -- the 18th Space Defense Squadron fits
 * them with it -- so it is how they are read, through satellite.js (MIT, Vallado's 2006
 * code in JavaScript). Its answer is in TEME, which teme.ts turns into the scene's J2000
 * ecliptic; then it is Earth-relative, which is exactly the frame the frame tree wants of
 * a body whose parent is Earth. So each is added to the store as a propagated body about
 * its parent (see PropagatedOptions), and everything else -- marker, label, orbit, focus,
 * the info panel's distances -- is what any body gets.
 *
 * Only inside its window: NAMED_WINDOW_DAYS either side of its own element epoch for one on
 * SGP4, BULK_WINDOW_DAYS of the data's reference instant for one on the bulk model. Outside
 * it, it has no position, as a craft before launch has none, and the app steps the camera
 * back to Earth if it was there (see App.tsx).
 *
 * Its orbit is the osculating ellipse of its state, re-derived as it moves (the scene's
 * OrbitLine, as every body's): the two-body orbit it is on at this instant, which passes
 * through it by definition. It is not the path it will trace -- J2 turns a LEO orbit's
 * plane five degrees a day, and the short-period terms breathe its size by ten kilometres
 * a revolution -- and the ellipse follows those as they happen.
 *
 * Cost: one SGP4 call per satellite per frame it is resolved, and it is resolved only
 * while its orbit is a dozen pixels across (see satelliteVisibility); measured in
 * satelliteBodies.test.ts.
 */

const DEG = 180 / Math.PI;

/** The body id of a named satellite: its slug, prefixed, so it cannot meet a catalog id. */
export function namedSatelliteBodyId(id: string): BodyId {
  return `sat-${id}`;
}

/** The body id of an SGP4-tier satellite chosen from search: its catalogue number. */
export function sgpSatelliteBodyId(noradId: number): BodyId {
  return `sat-norad-${noradId}`;
}

/** The body id of bulk record `k` chosen from search. */
export function bulkSatelliteBodyId(k: number): BodyId {
  return `sat-bulk-${k}`;
}

/** The bulk record of a body id, or null for any other body. */
export function parseBulkSatelliteBodyId(id: BodyId): number | null {
  const match = /^sat-bulk-(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/** The NORAD number of an SGP4-tier body id, or null for any other body. */
export function parseSgpSatelliteBodyId(id: BodyId): number | null {
  const match = /^sat-norad-(\d+)$/.exec(id);
  return match === null ? null : Number(match[1]);
}

/**
 * The radius a satellite is framed by, km: about the ISS's half-span, 55 m. **Not a
 * measurement** of any of them, and the body says so (`radiusPublished: false`): it is how
 * far the camera stands off -- eight of these, 400 m -- and nothing is drawn that size.
 */
export const SATELLITE_FRAMING_RADIUS_KM = 0.05;

/** Marker colour of a satellite body: a warm white, apart from the craft's own colours. */
export const SATELLITE_BODY_COLOR = '#f2e2b8';

/** Which model places a satellite body. */
export type SatelliteModel = 'sgp4' | 'secular';

/** What the info panel says about a satellite body; see satelliteNow for the rest. */
export interface SatelliteFacts {
  /** How the data names it: the named list's own name, or CelesTrak's OBJECT_NAME. */
  readonly name: string;
  /** Which tier it came from. */
  readonly tier: 'named' | 'sgp4' | 'bulk';
  readonly model: SatelliteModel;
  readonly noradId: number;
  readonly cosparId: string;
  /** Who flies it; null where the data does not say -- every satellite but the named. */
  readonly operator: string | null;
  /** ISO date; null where CelesTrak's SATCAT has none, or the data does not carry it. */
  readonly launchDate: string | null;
  /** What its model does poorly for it, in words; null where it is the right model. */
  readonly note: string | null;
  /** Packed group mask, regime and object type; see SATELLITE_RECORD_FLOATS. */
  readonly flags: number;
  /** Element epoch, UTC Julian day. */
  readonly epochJdUtc: number;
  /** For an SGP4 body, its record; null for one on the bulk model. */
  readonly satrec: SatRec | null;
  /** For a bulk body, its record index and the records; null otherwise. */
  readonly bulk: { readonly k: number; readonly satellites: Satellites } | null;
}

const facts = new Map<BodyId, SatelliteFacts>();

export function satelliteFacts(id: BodyId): SatelliteFacts | null {
  return facts.get(id) ?? null;
}

/** The TEME position and velocity SGP4 gives for `jdUtc`, or null where it cannot. */
export function sgp4At(satrec: SatRec, jdUtc: number): ReturnType<typeof sgp4> {
  const result = sgp4(satrec, (jdUtc - satrec.jdsatepoch) * 1440);
  return result === null || satrec.error !== 0 ? null : result;
}

/** Turns a TEME state into the scene's frame with the instant's matrix. */
function toScene(matrix: Float64Array, teme: Float64Array): StateVector {
  const out = new Float64Array(6);
  applyMatrix(matrix, teme[0]!, teme[1]!, teme[2]!, out, 0);
  // The velocity through the same matrix: the frame's own turning, precession, is 1e-11
  // rad/s against the orbit's 1e-3, and is left out.
  applyMatrix(matrix, teme[3]!, teme[4]!, teme[5]!, out, 3);
  return {
    position: { x: out[0]!, y: out[1]!, z: out[2]! },
    velocity: { x: out[3]!, y: out[4]!, z: out[5]! },
  };
}

/**
 * A satellite's SGP4 state about Earth at `jdTdb`, km and km/s, J2000 ecliptic -- or null
 * where SGP4 cannot place it (decayed, or its elements out of range by then).
 */
export function sgp4State(satrec: SatRec, jdTdb: number): StateVector | null {
  const { jdUtc, matrix } = satelliteInstant(jdTdb);
  const teme = sgp4At(satrec, jdUtc);
  if (teme === null) {
    return null;
  }
  const { position: r, velocity: v } = teme;
  return toScene(matrix, Float64Array.of(r.x, r.y, r.z, v.x, v.y, v.z));
}

/** The bulk model's elements for record `k`, `dtDays` after the reference, J3 applied. */
export interface BulkElements {
  a: number;
  e: number;
  i: number;
  node: number;
  peri: number;
  M: number;
  /** dM/dt at the instant, rad/day: the secular rate and the drag term's slope. */
  n: number;
}

/**
 * The bulk model's mean elements of record `k`, `dtDays` (UTC days) after the reference
 * instant, in float64: SatelliteInfo's recipe -- the secular drift, the drag parabola, then
 * J3's long-period term on the eccentricity vector -- written into `out`.
 */
export function bulkElements(records: Float32Array, k: number, dtDays: number, out: BulkElements): BulkElements {
  const base = k * SATELLITE_FLOATS;
  const e = records[base + SAT.e]!;
  const peri = records[base + SAT.peri]! + records[base + SAT.dPeri]! * dtDays;
  const M = records[base + SAT.M]! + records[base + SAT.dM]! * dtDays + records[base + SAT.ddM]! * dtDays * dtDays;
  const ex = e * Math.cos(peri);
  const ey = e * Math.sin(peri) + records[base + SAT.ay]!;
  // A perfectly circular orbit keeps its perigee, as the shader's does.
  const periJ3 = ex === 0 && ey === 0 ? peri : Math.atan2(ey, ex);
  out.a = records[base + SAT.a]!;
  out.e = Math.hypot(ex, ey);
  out.i = records[base + SAT.i]!;
  out.node = records[base + SAT.node]! + records[base + SAT.dNode]! * dtDays;
  out.peri = periJ3;
  out.M = M + peri - periJ3;
  out.n = records[base + SAT.dM]! + 2 * records[base + SAT.ddM]! * dtDays;
  return out;
}

const scratchElements: BulkElements = { a: 0, e: 0, i: 0, node: 0, peri: 0, M: 0, n: 0 };

/**
 * Bulk record `k`'s TEME state about Earth, `dtDays` after the reference: the shader's
 * model in float64, km and km/s, into `out` (six numbers).
 *
 * The velocity is the ellipse's at the instant's mean motion; the drift of the node and
 * perigee adds about a thousandth to it in LEO, and is left out. It is what the orbit
 * line and the speed readout are drawn from, not where the satellite is.
 */
export function bulkStateTeme(records: Float32Array, k: number, dtDays: number, out: Float64Array): Float64Array {
  const el = bulkElements(records, k, dtDays, scratchElements);
  const E = solveKepler(el.M, el.e);
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const b = el.a * Math.sqrt(1 - el.e * el.e);
  const xp = el.a * (cosE - el.e);
  const yp = b * sinE;
  const Edot = el.n / 86_400 / (1 - el.e * cosE);
  const vxp = -el.a * sinE * Edot;
  const vyp = b * cosE * Edot;
  const cN = Math.cos(el.node);
  const sN = Math.sin(el.node);
  const cI = Math.cos(el.i);
  const sI = Math.sin(el.i);
  const cW = Math.cos(el.peri);
  const sW = Math.sin(el.peri);
  const Px = cN * cW - sN * sW * cI;
  const Py = sN * cW + cN * sW * cI;
  const Pz = sW * sI;
  const Qx = -cN * sW - sN * cW * cI;
  const Qy = -sN * sW + cN * cW * cI;
  const Qz = cW * sI;
  out[0] = Px * xp + Qx * yp;
  out[1] = Py * xp + Qy * yp;
  out[2] = Pz * xp + Qz * yp;
  out[3] = Px * vxp + Qx * vyp;
  out[4] = Py * vxp + Qy * vyp;
  out[5] = Pz * vxp + Qz * vyp;
  return out;
}

/** Bulk record `k`'s state about Earth at `jdTdb`, J2000 ecliptic. */
export function bulkState(satellites: Satellites, k: number, jdTdb: number): StateVector {
  const { jdUtc, matrix } = satelliteInstant(jdTdb);
  const teme = bulkStateTeme(satellites.records, k, jdUtc - satellites.info.referenceJdUtc, new Float64Array(6));
  return toScene(matrix, teme);
}

/** The window an SGP4 satellite is drawn in, TDB Julian days, from its epoch in UTC. */
export function sgp4Window(epochJdUtc: number): { readonly startJd: number; readonly stopJd: number } {
  return {
    startJd: utcToTdb(epochJdUtc - NAMED_WINDOW_DAYS),
    stopJd: utcToTdb(epochJdUtc + NAMED_WINDOW_DAYS),
  };
}

/** The window the bulk is drawn in, TDB Julian days, from the data's reference instant. */
export function bulkWindow(referenceJdUtc: number): { readonly startJd: number; readonly stopJd: number } {
  return {
    startJd: utcToTdb(referenceJdUtc - BULK_WINDOW_DAYS),
    stopJd: utcToTdb(referenceJdUtc + BULK_WINDOW_DAYS),
  };
}

/** What a named satellite is drawn as up close, from `named.json`; see NamedSatellite. */
export interface SatelliteLook {
  readonly spanM: number;
  readonly shape: CraftShape;
  readonly operator: string;
  readonly launchDate: string | null;
}

/**
 * The body a satellite becomes: a marker, a label, an orbit; no size claimed.
 *
 * Unless it has a `look` -- a named satellite with a model or a NO MODEL box, as the
 * spacecraft have -- and then it is framed and drawn as a spacecraft is: its radius half
 * its published span, and its `mission.shape` the craft's shape path in SolarSystem.tsx
 * reads, asked for at MODEL_REQUEST_PX, shown from `shapeShownPx`, let go when small.
 * Its `kind` stays 'satellite', which is what the panels and search go by.
 */
export function satelliteDefinition(id: BodyId, name: string, look: SatelliteLook | null = null): BodyDefinition {
  if (look !== null) {
    const radiusKm = look.spanM / 2 / 1000;
    // Its span is published, and it is drawn: framed, and labelled clear of it, as a
    // craft is -- so neither marker-only flag is carried over.
    const { radiusPublished: _published, shapeDrawn: _drawn, ...marker } = satelliteDefinition(id, name);
    return {
      ...marker,
      radiusEquatorialKm: radiusKm,
      radiusPolarKm: radiusKm,
      mission: {
        // A date with no time: the SATCAT's, which is all the panel shows.
        launchUtc: look.launchDate ?? '',
        operator: look.operator,
        endUtc: null,
        windowMonths: null,
        site: null,
        shape: look.shape,
      },
    };
  }
  return {
    id,
    name,
    horizonsId: '',
    center: '500@399',
    elementsCenter: '500@399',
    stepDays: 0,
    vectorWindow: 'full',
    parent: 'earth',
    kind: 'satellite',
    radiusEquatorialKm: SATELLITE_FRAMING_RADIUS_KM,
    radiusPolarKm: SATELLITE_FRAMING_RADIUS_KM,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: SATELLITE_BODY_COLOR,
    drawOrbit: true,
    textures: null,
    rings: null,
    mission: null,
    radiusPublished: false,
    shapeDrawn: false,
  };
}

type Entry = Parameters<EphemerisStore['addPropagatedBodies']>[0][number];

/**
 * A satellite's store entry, or null where it cannot be placed at its own epoch -- said
 * on the console, rather than drawn somewhere invented.
 */
function entryFor(
  store: EphemerisStore,
  id: BodyId,
  name: string,
  epochJdUtc: number,
  state: (jd: number) => StateVector | null,
  options: PropagatedOptions,
  look: SatelliteLook | null = null,
): Entry | null {
  const epochJd = utcToTdb(epochJdUtc);
  const atEpoch = state(epochJd);
  const elements: OsculatingElements | null =
    atEpoch === null
      ? null
      : stateToOsculatingElements(atEpoch, store.body('earth').gmBodyOnlyKm3S2, epochJd, id, '500@399');
  if (elements === null) {
    console.warn(`${name} cannot be placed at its own epoch; it is left out.`);
    return null;
  }
  return { body: satelliteDefinition(id, name, look), elements, state, options };
}

/** SGP4's record for an OMM, or null where satellite.js cannot read it. */
export function satrecOf(omm: SatelliteOmm, name: string): SatRec | null {
  try {
    return json2satrec(omm as unknown as Parameters<typeof json2satrec>[0]);
  } catch (error) {
    console.warn(`SGP4 cannot read the elements of ${name}`, error);
    return null;
  }
}

/** Registers what search and the panels read of a satellite body. */
function register(id: BodyId, known: SatelliteFacts, chip: number, catalogueName?: string): void {
  facts.set(id, known);
  tagSatelliteBody(id, {
    chip,
    operator: known.operator,
    noradId: known.noradId,
    cosparId: known.cosparId,
    ...(catalogueName === undefined || catalogueName === known.name ? {} : { catalogueName }),
  });
}

/** Adds every named satellite to `store`, once: those SGP4 can read and place. */
export function addNamedSatellites(store: EphemerisStore, satellites: Satellites): void {
  const entries: Entry[] = [];
  satellites.named.forEach((satellite, index) => {
    const id = namedSatelliteBodyId(satellite.id);
    if (store.isPropagatedBody(id)) {
      return;
    }
    const satrec = satrecOf(satellite.omm, satellite.name);
    if (satrec === null) {
      return;
    }
    // Data from before the shapes has none, and such a satellite stays a marker.
    const look: SatelliteLook | null =
      satellite.shape === undefined || satellite.spanM === undefined
        ? null
        : {
            spanM: satellite.spanM,
            shape: satellite.shape,
            operator: satellite.operator,
            launchDate: satellite.launchDate,
          };
    const entry = entryFor(
      store,
      id,
      satellite.name,
      satrec.jdsatepoch,
      (jd) => sgp4State(satrec, jd),
      { aboutParent: true, coverage: sgp4Window(satrec.jdsatepoch), exact: true },
      look,
    );
    if (entry === null) {
      return;
    }
    register(
      id,
      {
        name: satellite.name,
        tier: 'named',
        model: 'sgp4',
        noradId: satellite.noradId,
        cosparId: satellite.cosparId,
        operator: satellite.operator,
        launchDate: satellite.launchDate,
        note: satellite.note,
        flags: satellite.flags,
        epochJdUtc: satrec.jdsatepoch,
        satrec,
        bulk: null,
      },
      satellites.namedChips[index] ?? OTHER_CHIP,
      satellite.omm.OBJECT_NAME,
    );
    entries.push(entry);
  });
  store.addPropagatedBodies(entries);
}

/** The satellite bodies added from search and still in the store: two at most. */
const added = new Set<BodyId>();

/** Lets the earlier search-made satellites go, but `id` and `keep`. */
function forgetEarlier(store: EphemerisStore, id: BodyId, keep: BodyId): void {
  for (const previous of added) {
    if (previous !== id && previous !== keep) {
      store.removePropagatedBody(previous);
      facts.delete(previous);
      untagSatelliteBody(previous);
      added.delete(previous);
    }
  }
  added.add(id);
}

/**
 * Makes SGP4-tier satellite `k` a body and returns its id, or null where it cannot be
 * placed: on full SGP4, as a named one, and so not flagged approximate. The earlier ones
 * made from search go, unless one is `keep`, the body the camera is on.
 */
export function addSgpSatelliteBody(store: EphemerisStore, satellites: Satellites, k: number, keep: BodyId): BodyId | null {
  const satellite = satellites.sgp4[k]!;
  const id = sgpSatelliteBodyId(satellite.omm.NORAD_CAT_ID);
  if (!store.isPropagatedBody(id)) {
    const name = satellite.omm.OBJECT_NAME;
    const satrec = satrecOf(satellite.omm, name);
    const entry =
      satrec === null
        ? null
        : entryFor(store, id, name, satrec.jdsatepoch, (jd) => sgp4State(satrec, jd), {
            aboutParent: true,
            coverage: sgp4Window(satrec.jdsatepoch),
            exact: true,
          });
    if (satrec === null || entry === null) {
      return null;
    }
    register(
      id,
      {
        name,
        tier: 'sgp4',
        model: 'sgp4',
        noradId: satellite.omm.NORAD_CAT_ID,
        cosparId: satellite.omm.OBJECT_ID,
        operator: null,
        launchDate: satellite.launchDate,
        note: null,
        flags: satellite.flags,
        epochJdUtc: satrec.jdsatepoch,
        satrec,
        bulk: null,
      },
      satellites.sgp4Chips[k] ?? OTHER_CHIP,
    );
    store.addPropagatedBodies([entry]);
  }
  forgetEarlier(store, id, keep);
  return id;
}

/**
 * Makes bulk record `k` a body and returns its id, or null where it cannot be placed. On
 * the bulk model, in float64 -- the shader's own model, so the body is where its dot was
 * -- and flagged APPROXIMATE for it, which it is: SGP4 with its periodic terms left out,
 * off by what SatelliteInfo.accuracy says. The dot is hidden while it is a body.
 */
export function addBulkSatelliteBody(
  store: EphemerisStore,
  satellites: Satellites,
  names: SatelliteNameIndex,
  k: number,
  keep: BodyId,
): BodyId | null {
  const id = bulkSatelliteBodyId(k);
  if (!store.isPropagatedBody(id)) {
    const name = names.names.name[k]!;
    const reference = satellites.info.referenceJdUtc;
    const entry = entryFor(store, id, name, reference, (jd) => bulkState(satellites, k, jd), {
      aboutParent: true,
      coverage: bulkWindow(reference),
    });
    if (entry === null) {
      return null;
    }
    register(
      id,
      {
        name,
        tier: 'bulk',
        model: 'secular',
        noradId: names.names.noradId[k]!,
        cosparId: names.names.cosparId[k]!,
        operator: null,
        launchDate: null,
        note: null,
        flags: satellites.records[k * SATELLITE_FLOATS + SAT.flags]!,
        epochJdUtc: reference + names.names.ageDays[k]!,
        satrec: null,
        bulk: { k, satellites },
      },
      satellites.chips[k] ?? OTHER_CHIP,
    );
    store.addPropagatedBodies([entry]);
  }
  forgetEarlier(store, id, keep);
  return id;
}

/** What a satellite is doing at an instant, for the info panel. */
export interface SatelliteNow {
  /** Height above the WGS-84 ellipsoid, km. */
  readonly heightKm: number;
  /** Orbital period from the model's mean motion of the instant, minutes. */
  readonly periodMinutes: number;
  /** Mean inclination to the equator of date, degrees. */
  readonly inclinationDeg: number;
  /** Instant minus element epoch, days: how far the model is carrying the elements. */
  readonly ageDays: number;
}

/**
 * Height above the WGS-84 ellipsoid of a point `rho` km from the polar axis and `z` km
 * above the equator, km: Bowring's iteration, three passes -- below a millimetre for
 * anything in orbit. Not the distance from Earth's centre less its radius, which for the
 * ISS over a pole would be 21 km low: the flattening.
 */
export function geodeticHeightKm(rho: number, z: number): number {
  const a = 6378.137;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  let latitude = Math.atan2(z, rho * (1 - e2));
  for (let pass = 0; pass < 3; pass += 1) {
    const sin = Math.sin(latitude);
    const n = a / Math.sqrt(1 - e2 * sin * sin);
    latitude = Math.atan2(z + e2 * n * sin, rho);
  }
  const cos = Math.cos(latitude);
  const sin = Math.sin(latitude);
  // The form that holds at every latitude, poles included.
  return rho * cos + z * sin - a * Math.sqrt(1 - e2 * sin * sin);
}

/** A satellite body's height, period and inclination at `jdTdb`; null where it has none. */
export function satelliteNow(id: BodyId, jdTdb: number): SatelliteNow | null {
  const known = facts.get(id);
  if (known === undefined) {
    return null;
  }
  const { jdUtc } = satelliteInstant(jdTdb);
  // TEME's z is the true pole of date, which is what a height above the ellipsoid needs.
  if (known.satrec !== null) {
    const teme = sgp4At(known.satrec, jdUtc);
    if (teme === null) {
      return null;
    }
    const { x, y, z } = teme.position;
    return {
      heightKm: geodeticHeightKm(Math.hypot(x, y), z),
      periodMinutes: (2 * Math.PI) / teme.meanElements.nm,
      inclinationDeg: teme.meanElements.im * DEG,
      ageDays: jdUtc - known.epochJdUtc,
    };
  }
  if (known.bulk === null) {
    return null;
  }
  const { k, satellites } = known.bulk;
  const dt = jdUtc - satellites.info.referenceJdUtc;
  const teme = bulkStateTeme(satellites.records, k, dt, new Float64Array(6));
  const el = bulkElements(satellites.records, k, dt, { a: 0, e: 0, i: 0, node: 0, peri: 0, M: 0, n: 0 });
  return {
    heightKm: geodeticHeightKm(Math.hypot(teme[0]!, teme[1]!), teme[2]!),
    periodMinutes: (2 * Math.PI * 1440) / el.n,
    inclinationDeg: el.i * DEG,
    ageDays: jdUtc - known.epochJdUtc,
  };
}
