import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { CMB_DIPOLE as TOOLS_CMB_DIPOLE, czCmb } from '../../../tools/src/laniakea/frames.ts';
import { cmbTexCoord, LAST_SCATTERING_RADIUS_KM } from '../scene/cmb.ts';
import { equatorialDirection, galacticDirection } from '../scene/galactic.ts';
import { equatorialToEcliptic } from '../scene/orientation.ts';
import { CMB_DIPOLE, CMB_DIPOLE_APEX, cmbFrameRedshift, COLD_SPOT, galacticToEquatorial, SPEED_OF_LIGHT_KM_S } from './cmbFrame.ts';
import { CF4_COSMOLOGY, comovingDistanceMpc } from './cosmology.ts';
import { FAMOUS_GALAXIES } from './famousGalaxies.ts';
import { FAR_LANDMARKS, farRingRadiusPc, GRB_RING_BURSTS, isBeam, type FarLandmark } from './farLandmarks.ts';
import {
  NEARBY_HOLDER_FRAMING_KM,
  RECORD_HOLDERS,
  recordHolderBodyId,
  recordHolderCosmology,
  recordHolderDirection,
  recordHolderDistances,
  recordHolderFramingKm,
  recordHolderOf,
  recordHolderPositionKm,
} from './recordHolders.ts';

const DEG = Math.PI / 180;
const landmark = (key: string): FarLandmark => FAR_LANDMARKS.find((l) => l.key === key)!;
const angleDeg = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number =>
  Math.acos(Math.min(1, (a.x * b.x + a.y * b.y + a.z * b.z) / Math.hypot(a.x, a.y, a.z) / Math.hypot(b.x, b.y, b.z))) / DEG;

describe('the CMB as a frame', () => {
  it('turns galactic into equatorial as the scene’s galactic frame does, to an arcsecond', () => {
    for (const [l, b] of [
      [0, 0],
      [264.021, 48.253],
      [209, -57],
      [123, 27],
      [300, -80],
    ] as const) {
      const { raDeg, decDeg } = galacticToEquatorial(l, b);
      expect(angleDeg(equatorialToEcliptic(equatorialDirection(raDeg, decDeg)), galacticDirection(l, b))).toBeLessThan(1 / 3600);
    }
  });

  it('puts the dipole’s hot pole where Planck does, in Crater, with the tools’ numbers', () => {
    expect(CMB_DIPOLE).toEqual(TOOLS_CMB_DIPOLE);
    // Planck Collaboration 2020, A&A 641, A1, Table 3: (RA, Dec) = (167.942, -6.944).
    expect(CMB_DIPOLE_APEX.raDeg).toBeCloseTo(167.942, 2);
    expect(CMB_DIPOLE_APEX.decDeg).toBeCloseTo(-6.944, 2);
    const dipole = landmark('cmb-dipole');
    expect(isBeam(dipole)).toBe(true);
    expect(dipole.record).toContain('369.82 km/s');
  });

  it('moves a redshift into the CMB’s frame as the tools move Laniakea’s galaxies', () => {
    for (const [ra, dec, z] of [
      [9.4214, -33.71631, 0.030187],
      [229.31005, 21.58554, 0.042423],
      [165.97478, 40.84998, 0.034524],
    ] as const) {
      expect(cmbFrameRedshift(ra, dec, z) * SPEED_OF_LIGHT_KM_S).toBeCloseTo(czCmb(ra, dec, z * SPEED_OF_LIGHT_KM_S), 3);
    }
  });
});

// The Cold Spot's circle on the wall, over the map's own cold region (as cmb.test.ts checks the map
// itself): read through the shader's lookup, every half degree within its radius.
describe('the Cold Spot', () => {
  it('sits on the map’s cold region, and its mirror in longitude is not cold', async () => {
    const dir = join(import.meta.dirname, '..', '..', 'public', 'cmb');
    const info = JSON.parse(await readFile(join(dir, 'cmb.json'), 'utf8')) as { file: string; zeroLevel: number; microkelvinPerStep: number };
    const png = PNG.sync.read(await readFile(join(dir, info.file)));
    const meanAround = (centre: { x: number; y: number; z: number }, radiusDeg: number): number => {
      let sum = 0;
      let count = 0;
      const cosRadius = Math.cos(radiusDeg * DEG);
      for (let lat = -90; lat <= 90; lat += 0.5) {
        const step = 0.5 / Math.max(0.05, Math.cos(lat * DEG));
        for (let lon = 0; lon < 360; lon += step) {
          const d = galacticDirection(lon, lat);
          if (d.x * centre.x + d.y * centre.y + d.z * centre.z < cosRadius) continue;
          const [u, v] = cmbTexCoord(d);
          const x = Math.min(png.width - 1, Math.floor(u * png.width));
          const y = Math.min(png.height - 1, Math.floor((1 - v) * png.height));
          sum += (png.data[(y * png.width + x) * 4]! - info.zeroLevel) * info.microkelvinPerStep;
          count += 1;
        }
      }
      return sum / count;
    };
    const spot = landmark('cmb-cold-spot');
    const direction = recordHolderDirection(spot);
    expect(angleDeg(direction, galacticDirection(COLD_SPOT.lDeg, COLD_SPOT.bDeg))).toBeLessThan(1);
    const extent = spot.extent;
    expect(extent.kind === 'sky-disc' ? extent.radiusDeg : NaN).toBe(5);
    expect(meanAround(direction, 5)).toBeLessThan(-60);
    expect(meanAround(galacticDirection(360 - COLD_SPOT.lDeg, COLD_SPOT.bDeg), 5)).toBeGreaterThan(-30);
  });

  it('is drawn on the wall, a circle 5 degrees in radius there', () => {
    const spot = landmark('cmb-cold-spot');
    const p = recordHolderPositionKm(spot);
    expect(Math.hypot(p.x, p.y, p.z) / LAST_SCATTERING_RADIUS_KM).toBeCloseTo(1, 6);
    const distancePc = 1e6 * recordHolderDistances(spot).comovingMpc;
    expect(Math.atan(farRingRadiusPc(spot, distancePc)! / distancePc) / DEG).toBeCloseTo(5, 9);
    // The supervoid in front of it, on the same line of sight.
    expect(angleDeg(recordHolderDirection(landmark('eridanus-supervoid')), recordHolderDirection(spot))).toBeLessThan(1e-6);
  });
});

describe('the protoclusters and the large structures', () => {
  it('label every claim and every disputed one where its name is', () => {
    expect(landmark('hercules-corona-borealis-great-wall').record).toContain('[claim]');
    expect(landmark('giant-grb-ring').record).toContain('[claim]');
    expect(landmark('giant-arc').record).toContain('[disputed]');
    expect(landmark('big-ring').record).toContain('[disputed]');
    expect(landmark('eridanus-supervoid').record).toContain('[disputed]');
    expect(landmark('boss-great-wall').record).not.toMatch(/claim|disputed/);
  });

  it('are at their papers’ redshifts, the protoclusters among them', () => {
    expect(FAR_LANDMARKS.filter((l) => l.kind === 'protocluster').map((l) => [l.key, l.z])).toEqual([
      ['spiderweb', 2.1585],
      ['spt2349-56', 4.304],
      ['hyperion', 2.45],
    ]);
  });

  it('draw a ring of the size their papers give, at Planck’s H0', () => {
    // The BOSS Great Wall's 271 h^-1 Mpc, h 0.6766.
    expect(farRingRadiusPc(landmark('boss-great-wall'), 1)! / 1e6).toBeCloseTo(271 / 0.6766 / 2, 6);
    // The Big Ring's 400 Mpc at H0 70.
    expect(farRingRadiusPc(landmark('big-ring'), 1)! / 1e6).toBeCloseTo((400 * 70) / 67.66 / 2, 6);
    // The GRB ring's 1,720 Mpc at its paper's 2,770 Mpc: a little larger at Planck's distance to z 0.822.
    const grb = farRingRadiusPc(landmark('giant-grb-ring'), 1)! / 1e6;
    expect(grb).toBeGreaterThan(860);
    expect(grb).toBeLessThan(950);
    // An arc and a patch of sky: marks only.
    expect(farRingRadiusPc(landmark('giant-arc'), 1)).toBeNull();
    expect(farRingRadiusPc(landmark('hercules-corona-borealis-great-wall'), 1)).toBeNull();
  });

  it('mark the GRB ring at its nine bursts’ middle, each within its 43 degrees of it', () => {
    const centre = recordHolderDirection(landmark('giant-grb-ring'));
    for (const [l, b] of GRB_RING_BURSTS) {
      expect(angleDeg(centre, galacticDirection(l, b))).toBeLessThan(43 / 2 + 5);
    }
  });

  it('are bodies as the record-holders are, not counted among them', () => {
    for (const l of FAR_LANDMARKS) {
      expect(recordHolderOf(recordHolderBodyId(l))).toBe(l);
      expect(RECORD_HOLDERS).not.toContain(l);
    }
  });
});

describe('the famous galaxies', () => {
  it('are placed as Laniakea’s galaxies by redshift are: CMB frame, Cosmicflows-4', () => {
    for (const galaxy of FAMOUS_GALAXIES) {
      expect(galaxy.nearby).toBe(true);
      expect(recordHolderCosmology(galaxy)).toBe(CF4_COSMOLOGY);
      expect(recordHolderOf(recordHolderBodyId(galaxy))).toBe(galaxy);
      const zCmb = cmbFrameRedshift(galaxy.raDeg, galaxy.decDeg, galaxy.z);
      expect(recordHolderDistances(galaxy).comovingMpc).toBeCloseTo(comovingDistanceMpc(zCmb, CF4_COSMOLOGY), 6);
      expect(recordHolderFramingKm(galaxy)).toBe(NEARBY_HOLDER_FRAMING_KM);
    }
    const mpc = (key: string) => recordHolderDistances(FAMOUS_GALAXIES.find((g) => g.key === key)!).comovingMpc;
    expect(mpc('cartwheel-galaxy')).toBeGreaterThan(110);
    expect(mpc('cartwheel-galaxy')).toBeLessThan(130);
    expect(mpc('hoags-object')).toBeGreaterThan(165);
    expect(mpc('hoags-object')).toBeLessThan(185);
  });
});
