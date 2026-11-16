import { describe, expect, it } from 'vitest';

import { equatorialDirection } from '../scene/galactic.ts';
import { equatorialToEcliptic } from '../scene/orientation.ts';
import { mpcToKm, OBSERVABLE_RADIUS_MPC } from './cosmology.ts';
import { describeBody, layersFor, searchBodies } from './search.ts';
import {
  RECORD_HOLDERS,
  recordHolderBodyId,
  recordHolderDirection,
  recordHolderDistances,
  recordHolderOf,
  recordHolderPositionKm,
  recordHoldersFade,
} from './recordHolders.ts';
import type { BodyDefinition } from '@sss/tools/types';

const LY_KM = 299_792.458 * 365.25 * 86_400;
const holder = (key: string) => RECORD_HOLDERS.find((h) => h.key === key)!;

describe('the record-holders', () => {
  it('are each one body, by a key of their own', () => {
    const ids = new Set(RECORD_HOLDERS.map(recordHolderBodyId));
    expect(ids.size).toBe(RECORD_HOLDERS.length);
    for (const h of RECORD_HOLDERS) expect(recordHolderOf(recordHolderBodyId(h))).toBe(h);
    expect(recordHolderOf('sun')).toBeNull();
  });

  it('lie on the sky where the scene’s own equatorial frame puts them', () => {
    for (const h of RECORD_HOLDERS) {
      const own = recordHolderDirection(h);
      const scene = equatorialToEcliptic(equatorialDirection(h.raDeg, h.decDeg));
      expect(own.x).toBeCloseTo(scene.x, 12);
      expect(own.y).toBeCloseTo(scene.y, 12);
      expect(own.z).toBeCloseTo(scene.z, 12);
    }
  });

  it('are all inside the observable universe, and farther the higher their redshift', () => {
    const sorted = [...RECORD_HOLDERS].sort((a, b) => a.z - b.z);
    let last = 0;
    for (const h of sorted) {
      const p = recordHolderPositionKm(h);
      const r = Math.hypot(p.x, p.y, p.z);
      expect(r).toBeLessThan(mpcToKm(OBSERVABLE_RADIUS_MPC));
      expect(r).toBeGreaterThanOrEqual(last);
      last = r;
    }
  });

  it('hold the redshifts their papers give', () => {
    expect(holder('mom-z14').z).toBe(14.44);
    expect(holder('jades-gs-z14-0').z).toBe(14.1796);
    expect(holder('gn-z11').z).toBe(10.6034);
    expect(holder('j0313-1806').z).toBe(7.6423);
    expect(holder('grb-090429b').spectroscopic).toBe(false);
    // HD1 where its spectrum puts it, not where its colours did.
    expect(holder('hd1').z).toBe(4.0);
    expect(recordHolderDistances(holder('mom-z14')).comovingLy / 1e9).toBeCloseTo(33.86, 2);
  });

  it('are shown from past Laniakea’s view, not on its sky', () => {
    expect(recordHoldersFade(1.8e9 * LY_KM)).toBe(0);
    expect(recordHoldersFade(3e9 * LY_KM)).toBe(0);
    expect(recordHoldersFade(10e9 * LY_KM)).toBe(1);
    expect(recordHoldersFade(400e9 * LY_KM)).toBe(1);
    expect(recordHoldersFade(5e9 * LY_KM)).toBeGreaterThan(0);
  });

  it('are found by name and other names, said what they are, and in the Observable Universe layer', () => {
    const body = { id: recordHolderBodyId(holder('ton-618')), name: 'TON 618', kind: 'structure', parent: null } as unknown as BodyDefinition;
    expect(searchBodies([body], 'tonantzintla').map((r) => r.body.id)).toEqual([body.id]);
    expect(describeBody(body, null)).toBe('Quasar · z 2.219');
    expect(layersFor(body)).toEqual(['observableUniverse']);
  });
});

describe('the named structures from the observable universe', () => {
  it('fold into the Nearby Universe as its 700 Mpc shrinks to 160 pixels, as its name does', async () => {
    const { nearbyUniverseFold } = await import('../scene/markHosts.ts');
    expect(nearbyUniverseFold(400)).toBe(1);
    expect(nearbyUniverseFold(320)).toBe(1);
    expect(nearbyUniverseFold(240)).toBeCloseTo(0.5, 9);
    expect(nearbyUniverseFold(160)).toBe(0);
    expect(nearbyUniverseFold(20)).toBe(0);
  });
});
