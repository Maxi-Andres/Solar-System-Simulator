import { describe, expect, it } from 'vitest';
import { json2satrec } from 'satellite.js/io';

import { bulkStateTeme } from '../core/satelliteBodies.ts';
import { ISS_HORIZONS, ISS_OMM, issBulkRecord } from '../core/satelliteTestFixtures.ts';
import { utcToTdb } from '../core/time.ts';
import { writePlacedTier } from './SatelliteSwarm.tsx';
import { temeToEclipticMatrix } from '../core/teme.ts';
import { AU_KM } from './scale.ts';
import { GEO_RADIUS_KM, regionAreaSr, SATELLITE_REGIONS, writeSatelliteCrowding } from './satelliteCrowding.ts';
import { BULK_VERTEX_SHADER, bulkPositionF32, PLACED_VERTEX_SHADER, SATELLITE_FRAGMENT_SHADER } from './satelliteShader.ts';

/**
 * The bulk's vertex shader, through its float32 mirror, against the same model in
 * float64: what the GPU's arithmetic costs. And the crowding and fade rules.
 */

const epoch = json2satrec(ISS_OMM as unknown as Parameters<typeof json2satrec>[0]).jdsatepoch;
const matrix = temeToEclipticMatrix(epoch);

/** The float64 model's place, scene frame, Earth-centred. */
function exact(records: Float32Array, dt: number): [number, number, number] {
  const t = bulkStateTeme(records, 0, dt, new Float64Array(6));
  const m = matrix;
  return [
    m[0]! * t[0]! + m[1]! * t[1]! + m[2]! * t[2]!,
    m[3]! * t[0]! + m[4]! * t[1]! + m[5]! * t[2]!,
    m[6]! * t[0]! + m[7]! * t[1]! + m[8]! * t[2]!,
  ];
}

/** The worst float32 miss over a few minutes from `days`, metres. */
function worstMetres(days: number, earth = { x: 0, y: 0, z: 0 }): number {
  const records = issBulkRecord();
  let worst = 0;
  for (let k = 0; k < 50; k += 1) {
    const dt = days + k * 1e-4;
    const [x, y, z] = exact(records, dt);
    const gpu = bulkPositionF32(records, 0, dt, matrix, earth);
    worst = Math.max(worst, Math.hypot(gpu.x - earth.x - x, gpu.y - earth.y - y, gpu.z - earth.z - z) * 1000);
  }
  return worst;
}

describe('the bulk shader in float32', () => {
  it('is metres from float64 at the reference instant, and 0.3 km three days out', () => {
    // Measured: 6 m, 9 m an hour out, 104 m a day, 304 m at three.
    expect(worstMetres(0)).toBeLessThan(15);
    expect(worstMetres(1 / 24)).toBeLessThan(20);
    expect(worstMetres(1)).toBeLessThan(200);
    expect(worstMetres(3)).toBeLessThan(500);
    expect(worstMetres(-3)).toBeLessThan(500);
  });

  it('keeps that with the focus on a satellite: Earth 6,800 km off, split high and low', () => {
    // The case that matters: the camera on the ISS, and the dots around it. Earth's offset
    // is then thousands of km, and the dots near the focus are a few km from it, so the
    // two nearly cancel -- in float32, to the metre, only because the offset is split.
    const earth = { x: -4123.456789, y: 5234.987654, z: -1712.3456789 };
    expect(worstMetres(0, earth)).toBeLessThan(15);
  });

  it('rounds no worse than float32 itself with Earth an AU off the focus', () => {
    // Focus on the Sun: the answer is 1.5e8 km, whose float32 step is 16 km, and it is
    // rounded twice, high then low -- a few millionths of a degree from there, far under a
    // pixel. Measured: 14.6 km.
    const earth = { x: 0.98 * AU_KM, y: -0.21 * AU_KM, z: 3.3e3 };
    expect(worstMetres(0, earth)).toBeLessThan(17_000);
  });

  it('declares what the frame loop sets, and its log depth', () => {
    for (const name of ['uDtDays', 'uTeme', 'uEarthHigh', 'uEarthLow', 'uChipVisible', 'uRegimeCrowding', 'uFade', 'uHidden']) {
      expect(BULK_VERTEX_SHADER).toContain(name);
    }
    expect(BULK_VERTEX_SHADER).toContain('#include <logdepthbuf_vertex>');
    expect(PLACED_VERTEX_SHADER).toContain('#include <logdepthbuf_vertex>');
    expect(SATELLITE_FRAGMENT_SHADER).toContain('#include <logdepthbuf_fragment>');
    // J3's step, as the generator's recipe has it.
    expect(BULK_VERTEX_SHADER).toContain('atan(ey, ex)');
  });
});

describe('crowding and fade', () => {
  const crowding = new Float32Array(4);
  // Ten thousand Starlink-like dots in LEO, at the payload's light.
  const regimes = { count: Float64Array.of(10_000, 0, 0, 0), light: Float64Array.of(10_000 * 1.8, 0, 0, 0) };

  it('leaves a view from inside the shells alone', () => {
    const fade = writeSatelliteCrowding(crowding, regimes, { x: 7000, y: 0, z: 0 }, 27, 900);
    expect(crowding[0]).toBe(1);
    expect(fade).toBe(1);
  });

  it('dims LEO from where it is a disc of a few hundred pixels', () => {
    writeSatelliteCrowding(crowding, regimes, { x: 120_000, y: 0, z: 0 }, 27, 900);
    expect(crowding[0]).toBeLessThan(1);
    expect(crowding[0]).toBeGreaterThan(0);
  });

  it('fades the whole population as the GEO ring closes up: gone at 12 pixels', () => {
    // A GEO ring of 12 px radius on a 900 px, 27-degree view is this far.
    const gone = (GEO_RADIUS_KM / 12) * (900 / (2 * Math.tan((13.5 * Math.PI) / 180)));
    expect(writeSatelliteCrowding(crowding, regimes, { x: gone * 1.01, y: 0, z: 0 }, 27, 900)).toBe(0);
    expect(writeSatelliteCrowding(crowding, regimes, { x: gone / 2.1, y: 0, z: 0 }, 27, 900)).toBe(1);
  });

  it('sees the GEO ring edge-on as a band, not as nothing', () => {
    const geo = SATELLITE_REGIONS[2]!;
    // In the equatorial plane: the ecliptic x axis is the equinox, in both.
    const edgeOn = regionAreaSr(geo, { x: 1e6, y: 0, z: 0 });
    const faceOn = regionAreaSr(geo, { x: 0, y: 1e6 * Math.sin(0.409), z: 1e6 * Math.cos(0.409) });
    expect(edgeOn).toBeGreaterThan(0);
    expect(faceOn).toBeGreaterThan(edgeOn);
  });
});

describe('the SGP4 tier on the CPU', () => {
  const satrec = json2satrec(ISS_OMM as unknown as Parameters<typeof json2satrec>[0]);
  const positions = new Float32Array(3);
  const info = new Float32Array(3);

  it('writes each satellite where SGP4 puts it, Earth-centred, in the scene frame', () => {
    const jd = ISS_HORIZONS[2]![0];
    writePlacedTier([satrec], jd, positions, info, new Set());
    expect(info[2]).toBe(1);
    const [, x, y, z] = ISS_HORIZONS[2]!;
    // Horizons' own ISS: the float32 buffer holds it to the metre at 7,000 km.
    expect(Math.hypot(positions[0]! - x, positions[1]! - y, positions[2]! - z) * 1000).toBeLessThan(10);
  });

  it('draws nothing outside the satellite’s week, nor one that is a body just now', () => {
    writePlacedTier([satrec], utcToTdb(satrec.jdsatepoch + 7.2), positions, info, new Set());
    expect(info[2]).toBe(0);
    writePlacedTier([satrec], ISS_HORIZONS[2]![0], positions, info, new Set([25544]));
    expect(info[2]).toBe(0);
  });
});
