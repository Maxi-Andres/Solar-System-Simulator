import { type CraftShape, SATELLITE_GROUPS, SATELLITE_RECORD_FLOATS } from '@sss/tools/types';
import { sgp4 } from 'satellite.js/sgp4';
import { describe, expect, it } from 'vitest';

import { labelRank } from '../scene/LabelProjector.tsx';
import { isShown } from '../scene/floatingOrigin.ts';
import { rebaseVisibleFrame } from '../scene/satellites.ts';
import {
  addBulkSatelliteBody,
  addNamedSatellites,
  bulkSatelliteBodyId,
  bulkStateTeme,
  geodeticHeightKm,
  namedSatelliteBodyId,
  satelliteFacts,
  satelliteNow,
  sgp4At,
} from './satelliteBodies.ts';
import { chipOfFlags, OTHER_CHIP, satelliteChipLayer } from './satelliteGroups.ts';
import { SATELLITE_FLOATS, TYPE_SHIFT } from './satellites.ts';
import { describeBody, layersFor, searchBodies } from './search.ts';
import {
  EARTH_AT,
  ISS_FLAGS,
  ISS_HORIZONS,
  issBulkRecord,
  issSatrec,
  makeStore,
  satelliteFixture,
} from './satelliteTestFixtures.ts';
import { tdbToUtc, utcToTdb } from './time.ts';

/**
 * Earth satellites as bodies, on synthetic Solar System data -- a Sun and an Earth held
 * still -- and the real ISS: so the frame tree, the window and the flags are tested before
 * `pnpm fetch:data`, and the ISS's place through the whole store against Horizons.
 */

describe('the bulk record layout', () => {
  it('is the generator’s', () => {
    expect(SATELLITE_FLOATS).toBe(SATELLITE_RECORD_FLOATS);
  });
});

describe('chips', () => {
  it('puts the ISS under Stations, whatever else it is', () => {
    expect(chipOfFlags(ISS_FLAGS, SATELLITE_GROUPS, TYPE_SHIFT)).toBe(0);
  });

  it('puts any debris under Debris, and a lone active payload under Other', () => {
    const debris = 2 << TYPE_SHIFT;
    expect(chipOfFlags(debris | 1, SATELLITE_GROUPS, TYPE_SHIFT)).toBe(6);
    expect(chipOfFlags(1, SATELLITE_GROUPS, TYPE_SHIFT)).toBe(OTHER_CHIP);
  });

  it('puts a GOES under Weather, not GEO', () => {
    const goes = (1 << SATELLITE_GROUPS.indexOf('weather')) | (1 << SATELLITE_GROUPS.indexOf('geo'));
    expect(chipOfFlags(goes, SATELLITE_GROUPS, TYPE_SHIFT)).toBe(2);
  });
});

describe('a named satellite as a body', () => {
  const store = makeStore();
  const { satellites } = satelliteFixture();
  addNamedSatellites(store, satellites);
  const id = namedSatelliteBodyId('iss');

  it('hangs off Earth, as a satellite', () => {
    const iss = store.body(id);
    expect(iss.parent).toBe('earth');
    expect(iss.kind).toBe('satellite');
    expect(iss.radiusPublished).toBe(false);
    expect(store.elementsFor(id)?.semiMajorAxisKm).toBeGreaterThan(6700);
    expect(store.elementsFor(id)?.semiMajorAxisKm).toBeLessThan(6850);
  });

  it('is where Horizons puts the ISS, through the whole frame tree', () => {
    // Every instant Horizons gave that is inside the ISS's week; the last, a fortnight out,
    // is not, and has no state at all -- see the next test.
    const inside = ISS_HORIZONS.filter(([jd]) => store.isCoveredAt(id, jd));
    expect(inside).toHaveLength(ISS_HORIZONS.length - 1);
    for (const [jd, x, y, z] of inside) {
      const state = store.stateRelativeTo(id, 'earth', jd)!;
      const metres = Math.hypot(state.position.x - x, state.position.y - y, state.position.z - z) * 1000;
      expect(metres).toBeLessThan(10);
      // And about the Sun, it is Earth's place plus that.
      const root = store.stateInRoot(id, jd)!;
      expect(root.position.x - EARTH_AT.x).toBeCloseTo(state.position.x, 6);
    }
  });

  it('is not approximate inside its window, and is not there outside it', () => {
    const [jd] = ISS_HORIZONS[0]!;
    expect(store.stateRelativeTo(id, 'earth', jd)!.approximate).toBe(false);
    expect(store.isExactAt(jd, ['earth', id])).toBe(true);
    const window = store.coverage(id)!;
    // Seven days either side of the element epoch, in TDB.
    const epoch = utcToTdb(issSatrec().jdsatepoch);
    expect(window.startJd).toBeCloseTo(epoch - 7, 6);
    expect(window.stopJd).toBeCloseTo(epoch + 7, 6);
    expect(store.localState(id, window.stopJd + 0.01)).toBeNull();
    expect(store.isCoveredAt(id, window.stopJd + 0.01)).toBe(false);
  });

  it('is not even worked out while its orbit is too small on screen', () => {
    // From 2 AU away Earth's whole system is under a pixel: the ISS is not resolved.
    const [jd] = ISS_HORIZONS[0]!;
    const far = rebaseVisibleFrame(store, 'earth', jd, new Set(['earth', id]), { x: 3e5, y: 0, z: 0 }, 900, 27);
    expect(far.bodies.has(id)).toBe(false);
    const near = rebaseVisibleFrame(store, 'earth', jd, new Set(['earth', id]), { x: 50, y: 0, z: 0 }, 900, 27);
    expect(near.bodies.has(id)).toBe(true);
  });

  it('is found by name, operator and catalogue number, and says what it is', () => {
    const iss = store.body(id);
    expect(searchBodies(store.bodies, 'space station')[0]?.body.id).toBe(id);
    expect(searchBodies(store.bodies, '25544')[0]?.body.id).toBe(id);
    expect(searchBodies(store.bodies, '1998-067A')[0]?.body.id).toBe(id);
    expect(searchBodies(store.bodies, 'jaxa')[0]?.body.id).toBe(id);
    expect(describeBody(iss, 'Earth')).toBe('Earth satellite · NASA/Roscosmos/ESA/JAXA/CSA');
    expect(layersFor(iss)).toEqual(['satellites']);
    expect(labelRank(iss.kind, iss.parent)).toBe(labelRank('spacecraft', null));
  });

  it('is shown only with its chip on, as its group’s dots are', () => {
    const iss = store.body(id);
    expect(isShown(iss, new Set(['satellite', satelliteChipLayer(0)]))).toBe(true);
    expect(isShown(iss, new Set(['satellite', satelliteChipLayer(1)]))).toBe(false);
    expect(isShown(iss, new Set([satelliteChipLayer(0)]))).toBe(false);
  });

  it('knows its height above the ellipsoid, period and inclination', () => {
    const [jd] = ISS_HORIZONS[0]!;
    const now = satelliteNow(id, jd)!;
    expect(now.heightKm).toBeGreaterThan(400);
    expect(now.heightKm).toBeLessThan(430);
    expect(now.periodMinutes).toBeCloseTo(1440 / 15.4897, 0);
    expect(now.inclinationDeg).toBeCloseTo(51.63, 1);
    expect(satelliteFacts(id)?.noradId).toBe(25544);
  });
});

describe('a named satellite with a shape', () => {
  // The ISS as named.json carries it once it has its look: a published span and a shape.
  const store = makeStore();
  const { satellites } = satelliteFixture();
  const shape: CraftShape = {
    model: 'iss.glb',
    pivot: [0, 0, 0],
    metresPerUnit: 1,
    boxM: null,
    pointsAt: 'nadir',
    pointingPart: 'body-axes',
    pointingAxis: [0, -1, 0],
    rollAxis: [0, 0, 1],
  };
  addNamedSatellites(store, {
    ...satellites,
    named: [{ ...satellites.named[0]!, spanM: 109, shape }],
  });
  const iss = store.body(namedSatelliteBodyId('iss'));

  it('is framed by half its published span and drawn by the craft’s shape path', () => {
    expect(iss.kind).toBe('satellite');
    expect(iss.radiusEquatorialKm * 2000).toBeCloseTo(109, 9);
    expect(iss.mission?.shape).toEqual(shape);
    expect(iss.mission?.operator).toBe('NASA/Roscosmos/ESA/JAXA/CSA');
    // A size that is published, and a shape that is drawn: neither marker-only flag.
    expect(iss.radiusPublished).toBeUndefined();
    expect(iss.shapeDrawn).toBeUndefined();
  });

  it('is still a satellite to search and the panels', () => {
    expect(describeBody(iss, 'Earth')).toBe('Earth satellite · NASA/Roscosmos/ESA/JAXA/CSA');
    expect(labelRank(iss.kind, iss.parent)).toBe(labelRank('spacecraft', null));
  });
});

describe('the bulk model', () => {
  it('stays within a few kilometres of SGP4 for the ISS over three days', () => {
    // The generator measured LEO at a median 3 to 4 km in this window, 8 km at 95%. The
    // record here is built from the ISS's own SGP4 fields; if the recipe were misread --
    // a rate in the wrong unit, J3 on the wrong axis -- this would be hundreds off.
    const satrec = issSatrec();
    const records = issBulkRecord();
    const out = new Float64Array(6);
    let worst = 0;
    for (let hours = -72; hours <= 72; hours += 1.7) {
      const dt = hours / 24;
      bulkStateTeme(records, 0, dt, out);
      const teme = sgp4At(satrec, satrec.jdsatepoch + dt)!;
      const km = Math.hypot(out[0]! - teme.position.x, out[1]! - teme.position.y, out[2]! - teme.position.z);
      worst = Math.max(worst, km);
    }
    expect(worst).toBeLessThan(15);
  });

  it('gives a velocity of the orbit’s speed, about 7.66 km/s for the ISS', () => {
    const out = bulkStateTeme(issBulkRecord(), 0, 0.3, new Float64Array(6));
    expect(Math.hypot(out[3]!, out[4]!, out[5]!)).toBeCloseTo(7.66, 1);
  });

  it('makes a dot a body, approximate, and lets the earlier go', () => {
    const store = makeStore();
    const { satellites, names } = satelliteFixture();
    const id = addBulkSatelliteBody(store, satellites, names, 0, 'earth')!;
    expect(id).toBe(bulkSatelliteBodyId(0));
    const jd = utcToTdb(satellites.info.referenceJdUtc + 1);
    const state = store.stateRelativeTo(id, 'earth', jd)!;
    expect(state.approximate).toBe(true);
    expect(store.isExactAt(jd, [id])).toBe(false);
    // Three days of the data's reference instant, and no more.
    expect(store.localState(id, utcToTdb(satellites.info.referenceJdUtc + 3.1))).toBeNull();
    expect(satelliteNow(id, jd)!.heightKm).toBeGreaterThan(390);
  });
});

describe('geodetic height', () => {
  it('is the radius less the equatorial radius on the equator, and the polar one at a pole', () => {
    expect(geodeticHeightKm(6378.137 + 420, 0)).toBeCloseTo(420, 6);
    expect(geodeticHeightKm(0, 6356.752314 + 420)).toBeCloseTo(420, 3);
  });

  it('is not the centre distance less a sphere: 21 km apart over a pole', () => {
    const r = 6356.752 + 420;
    expect(r - 6378.137 - geodeticHeightKm(0, r)).toBeCloseTo(-21.4, 1);
  });
});

describe('what SGP4 costs', () => {
  it('places 370 satellites in well under a frame', () => {
    // The SGP4 tier's size. Measured on the development laptop: 0.9 to 1.8 ms for all of
    // them. The bound is a frame's worth, generous for a slow CI machine.
    const satrec = issSatrec();
    const jd = tdbToUtc(ISS_HORIZONS[3]![0]);
    for (let k = 0; k < 2000; k += 1) {
      sgp4(satrec, (jd - satrec.jdsatepoch) * 1440 + k * 1e-3);
    }
    const start = performance.now();
    for (let k = 0; k < 370; k += 1) {
      sgp4(satrec, (jd - satrec.jdsatepoch) * 1440 + k * 1e-3);
    }
    const ms = performance.now() - start;
    console.info(`[satelliteBodies.test] 370 SGP4 calls: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(16);
  });
});
