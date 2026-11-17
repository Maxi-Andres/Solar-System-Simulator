import { describe, expect, it } from 'vitest';

import { comovingDistanceMpc } from './frames.ts';
import { KBC_VOID_Z, paperVoids, SUPERCLUSTERS, voidLandmarks } from './landmarks.ts';

describe('the voids from papers of their own', () => {
  it('are among the voids, after Tully et al.’s three', () => {
    expect(voidLandmarks().map((v) => v.name)).toEqual(['Local Void', 'Hercules Void', 'Sculptor Void', 'Giant Void', 'KBC Void']);
  });

  it('put the Giant Void at z 0.11 toward Canes Venatici, 300 Mpc across', () => {
    const giant = paperVoids().find((v) => v.name === 'Giant Void')!;
    expect(giant.distancePc / 1e6).toBeCloseTo(comovingDistanceMpc(0.11), 0);
    expect(giant.extentPc).toEqual([300e6, 300e6, 300e6]);
    expect(giant.status).toBeUndefined();
  });

  it('put the KBC Void about us, out to z 0.07, and say it is disputed', () => {
    const kbc = paperVoids().find((v) => v.name === 'KBC Void')!;
    expect([kbc.x, kbc.y, kbc.z]).toEqual([0, 0, 0]);
    expect(kbc.extentPc![0] / 2e6).toBeCloseTo(comovingDistanceMpc(KBC_VOID_Z), 0);
    // About 300 Mpc at H0 70 is about 280 at Cosmicflows-4's 74.6.
    expect(kbc.extentPc![0] / 2e6).toBeGreaterThan(270);
    expect(kbc.extentPc![0] / 2e6).toBeLessThan(290);
    expect(kbc.status?.label).toBe('disputed');
  });
});

describe('the Caelum Supercluster', () => {
  it('is Einasto et al.’s candidate 59, said so', () => {
    const caelum = SUPERCLUSTERS.find((s) => s.name === 'Caelum Supercluster')!;
    expect(caelum.sc).toBe(59);
    expect(caelum.status?.label).toBe('candidate');
  });
});
