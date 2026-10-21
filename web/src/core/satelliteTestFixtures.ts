import type { BodyDefinition, Manifest, SatelliteInfo, SatelliteOmm, VectorTable } from '@sss/tools/types';
import { SATELLITE_GROUPS } from '@sss/tools/types';
import type { SatRec } from 'satellite.js';
import { json2satrec } from 'satellite.js/io';

import { EphemerisStore } from './ephemerisStore.ts';
import { chipOfFlags } from './satelliteGroups.ts';
import { SAT, SATELLITE_FLOATS, TYPE_SHIFT, type SatelliteNameIndex, type Satellites } from './satellites.ts';

/**
 * The ISS, as an element set and as JPL Horizons places it, and a Sun and an Earth held
 * still: what the satellite tests share. Not a test file itself, so importing it runs no
 * tests twice.
 */
/**
 * The ISS's element set of 2026-10-21, as CelesTrak published it (GP JSON). Horizons
 * says of its ISS (-125544) "Trajectory is TLE-based", revised the same day, so from this
 * instant on it is this very element set run through SGP4 -- and the only difference left
 * between the two is the frame conversion, which is what is being tested.
 */
export const ISS_OMM: SatelliteOmm = {
  OBJECT_NAME: 'ISS (ZARYA)',
  OBJECT_ID: '1998-067A',
  EPOCH: '2026-10-21T01:08:59.469792',
  MEAN_MOTION: 15.48967427,
  ECCENTRICITY: 0.00067597,
  INCLINATION: 51.6327,
  RA_OF_ASC_NODE: 37.2623,
  ARG_OF_PERICENTER: 289.5321,
  MEAN_ANOMALY: 70.4938,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: 'U',
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 59126,
  BSTAR: 0.00018187691,
  MEAN_MOTION_DOT: 9.575e-5,
  MEAN_MOTION_DDOT: 0,
};

/**
 * Horizons, queried 2026-10-21: COMMAND='-125544', CENTER='500@399', REF_PLANE='ECLIPTIC',
 * REF_SYSTEM='ICRF', VEC_TABLE=2, OUT_UNITS='KM-S'. TDB Julian day, then x, y, z in km --
 * geocentric, ecliptic of J2000, exactly the app's frame. The first five span the two
 * hours after the epoch; the last three run on two weeks, to hold the conversion across
 * the nutation's own half-month wobble.
 */
export const ISS_HORIZONS: readonly (readonly [number, number, number, number])[] = [
  [2461334.541666667, 5.801405962328836e3, -4.099978345892052e2, -3.518963894909109e3],
  [2461334.5625, -1.22772201673559e3, 5.925638481142047e3, 3.090327055302161e3],
  [2461334.583333333, -4.728889431503691e3, -4.825110748201948e3, 7.752714513655949e2],
  [2461334.604166667, 5.399027880403194e3, -1.679328861686694e3, -3.773358015455764e3],
  [2461334.625, -3.370448710606782e1, 6.292562675829824e3, 2.563888736995231e3],
  [2461337.541666667, -5.885363477188151e3, 1.775441136084815e3, 2.902895223944832e3],
  [2461341.541666667, -5.471810186358969e3, 3.468063812008839e3, 2.061677999690784e3],
  [2461348.541666667, 3.599946069036320e3, -5.725300118974406e3, -6.680192905316469e2],
];

const START = 2_461_300.5;
const STOP = START + 100;
const EARTH_GM = 398_600.4418;
export const EARTH_AT = { x: 1.2e8, y: -8.6e7, z: 3000 };

function body(id: string, kind: BodyDefinition['kind'], gm: number): BodyDefinition {
  return {
    id,
    name: id === 'earth' ? 'Earth' : 'Sun',
    horizonsId: id,
    stepDays: 1,
    vectorWindow: 'full',
    center: '500@0',
    elementsCenter: '500@10',
    parent: null,
    kind,
    radiusEquatorialKm: id === 'earth' ? 6378.137 : 695_700,
    radiusPolarKm: id === 'earth' ? 6356.752 : 695_700,
    triaxialRadiiKm: null,
    gmKm3S2: gm,
    gmBodyOnlyKm3S2: gm,
    rotationPeriodHours: 24,
    axialTiltDeg: null,
    rotation: null,
    color: '#ffffff',
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

function still(id: string, at: { x: number; y: number; z: number }): VectorTable {
  const t: number[] = [];
  for (let jd = START; jd <= STOP; jd += 1) {
    t.push(jd);
  }
  const constant = (value: number) => t.map(() => value);
  return {
    id,
    horizonsId: id,
    center: '500@0',
    count: t.length,
    t,
    x: constant(at.x),
    y: constant(at.y),
    z: constant(at.z),
    vx: constant(0),
    vy: constant(0),
    vz: constant(0),
  };
}

/** A Sun and an Earth, still, from 2026-09-26 for a hundred days. */
export function makeStore(): EphemerisStore {
  const bodies = [body('sun', 'star', 1.327e11), body('earth', 'planet', EARTH_GM)];
  const vectors = new Map([
    ['sun', still('sun', { x: 0, y: 0, z: 0 })],
    ['earth', still('earth', EARTH_AT)],
  ]);
  const manifest: Manifest = {
    generatedAt: '2026-10-21T00:00:00Z',
    source: { name: 'test', version: '0', url: '' },
    frame: { center: '500@0', refPlane: 'ECLIPTIC', refSystem: 'ICRF', units: 'KM-S' },
    window: { startJd: START, stopJd: STOP, startUtc: '', stopUtc: '' },
    bodies: ['sun', 'earth'],
    tables: {
      sun: { startJd: START, stopJd: STOP, chunks: null },
      earth: { startJd: START, stopJd: STOP, chunks: null },
    },
    paths: {},
    surfaces: {},
  };
  return new EphemerisStore({ manifest, bodies, vectors, elements: new Map(), loadChunk: null, loadPath: null });
}

/** Stations and active, LEO, payload: the ISS's flags. */
export const ISS_FLAGS = (1 << SATELLITE_GROUPS.indexOf('stations')) | (1 << SATELLITE_GROUPS.indexOf('active'));

export function issSatrec(): SatRec {
  return json2satrec(ISS_OMM as unknown as Parameters<typeof json2satrec>[0]);
}

/**
 * A bulk record made from the ISS's own SGP4 initialisation, at its epoch: what the
 * generator writes, from the same fields -- SGP4's secular rates, its drag term on the
 * mean anomaly, and J3's long-period term.
 */
export function issBulkRecord(): Float32Array {
  const s = issSatrec();
  const record = new Float32Array(SATELLITE_FLOATS);
  record[SAT.a] = s.a * 6378.135;
  record[SAT.e] = s.ecco;
  record[SAT.i] = s.inclo;
  record[SAT.node] = s.nodeo;
  record[SAT.peri] = s.argpo;
  record[SAT.M] = s.mo > Math.PI ? s.mo - 2 * Math.PI : s.mo;
  record[SAT.dM] = s.mdot * 1440;
  record[SAT.dNode] = s.nodedot * 1440;
  record[SAT.dPeri] = s.argpdot * 1440;
  // SGP4 adds no·t2cof·t² to the mean anomaly, t in minutes.
  record[SAT.ddM] = s.no * s.t2cof * 1440 * 1440;
  record[SAT.ay] = s.aycof / (s.a * (1 - s.ecco * s.ecco));
  record[SAT.flags] = ISS_FLAGS;
  return record;
}

/** One named satellite, the ISS, and one bulk record made from it. */
export function satelliteFixture(): { satellites: Satellites; names: SatelliteNameIndex } {
  const satrec = issSatrec();
  const info = {
    referenceJdUtc: satrec.jdsatepoch,
    groups: SATELLITE_GROUPS,
    regimes: ['leo', 'meo', 'geo', 'heo'],
    accuracy: [],
  } as unknown as SatelliteInfo;
  const satellites: Satellites = {
    info,
    named: [
      {
        id: 'iss',
        name: 'International Space Station',
        noradId: 25544,
        cosparId: '1998-067A',
        operator: 'NASA/Roscosmos/ESA/JAXA/CSA',
        launchDate: '1998-11-20',
        flags: ISS_FLAGS,
        note: null,
        omm: ISS_OMM,
      },
    ],
    sgp4: [],
    records: issBulkRecord(),
    chips: Uint8Array.of(0),
    namedChips: Uint8Array.of(chipOfFlags(ISS_FLAGS, SATELLITE_GROUPS, TYPE_SHIFT)),
    sgp4Chips: new Uint8Array(0),
  };
  const names: SatelliteNameIndex = {
    names: { name: ['ISS (ZARYA)'], noradId: [25544], cosparId: ['1998-067A'], ageDays: [0] },
    display: ['iss zarya'],
    designation: ['1998 067a'],
    byNorad: new Map([[25544, 0]]),
  };
  return { satellites, names };
}

