import { describe, expect, it } from 'vitest';

import { deepSkyLayerKind, deepSkyOf, MESSIER_MARK_KIND, NOTABLE_STAR_KIND } from './deepSky.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import { MESSIER_MARKS, messierMarkBodyId } from './messier.ts';
import {
  ensureNotableStars,
  NOTABLE_STARS,
  notableStarBodyId,
  notableStarFraming,
  notableStarOf,
  notableStarState,
  SKIPPED,
} from './notableStars.ts';
import { layersFor } from './search.ts';

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const J2000 = 2451545.0;
const star = (key: string) => NOTABLE_STARS.find((candidate) => candidate.key === key)!;

function emptyStore(): EphemerisStore {
  return new EphemerisStore({
    manifest: { bodies: [], tables: {} },
    bodies: [],
    vectors: new Map(),
    elements: new Map(),
    generatedAt: new Date(0),
  } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);
}

describe('the notable stars', () => {
  it('are each where their distance puts them at J2000', () => {
    for (const entry of NOTABLE_STARS) {
      const p = notableStarState(entry)(J2000).position;
      expect(Math.hypot(p.x, p.y, p.z) / PARSEC_KM, entry.key).toBeCloseTo(entry.distancePc, 3);
    }
  });

  it('take their parallaxes as published, Gaia’s less its zero-point', () => {
    // Luhman 16: 501.557 mas, ground-based, as is: 1.9938 pc.
    expect(star('luhman-16').distancePc).toBeCloseTo(1.99379, 4);
    // HD 140283: Gaia's 16.2672 mas plus 0.017: 61.41 pc.
    expect(star('hd-140283').distancePc).toBeCloseTo(1000 / 16.2842, 6);
    // V404 Cyg's radio parallax: 2.39 kpc, as Miller-Jones et al. give it.
    expect(star('v404-cyg').distancePc / 1000).toBeCloseTo(2.39, 2);
    for (const entry of NOTABLE_STARS) {
      if (entry.distanceUpPc !== null) expect(entry.distanceUpPc, entry.key).toBeGreaterThan(0);
      if (entry.distanceDownPc !== null) expect(entry.distanceDownPc, entry.key).toBeGreaterThan(0);
    }
  });

  it('move the fast ones along their proper motion: WISE 0855 by 8.2″ a year', () => {
    const wise = star('wise-0855');
    const at = notableStarState(wise);
    const a = at(J2000).position;
    const b = at(J2000 + 365.25).position;
    const moved = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    const arcsec = (moved / Math.hypot(a.x, a.y, a.z)) * (180 / Math.PI) * 3600;
    expect(arcsec).toBeCloseTo(Math.hypot(8123.7, 673.2) / 1000, 2);
    // The slow ones stand still.
    const still = notableStarState(star('uy-sct'));
    expect(still(J2000 + 36525).position).toEqual(still(J2000).position);
  });

  it('say why each one asked for and not drawn is not', () => {
    expect(SKIPPED.map((entry) => entry.name)).toEqual(['μ Cephei', 'ρ Cassiopeiae', 'WR 104', 'G-cloud']);
    for (const entry of SKIPPED) expect(entry.reason.length).toBeGreaterThan(40);
  });

  it('become bodies once, in their own layer apart from the Messier marks', () => {
    const store = emptyStore();
    ensureNotableStars(store);
    ensureNotableStars(store);
    for (const entry of NOTABLE_STARS) {
      const id = notableStarBodyId(entry);
      expect(store.isPropagatedBody(id)).toBe(true);
      expect(store.body(id).kind).toBe('deep-sky');
      expect(notableStarOf(id)).toBe(entry);
      expect(notableStarFraming(id)).not.toBeNull();
      expect(deepSkyLayerKind(id)).toBe(NOTABLE_STAR_KIND);
      expect(layersFor(store.body(id))).toEqual(['notableStars']);
    }
    expect(deepSkyOf('notable-gaia-bh2')?.label).toBe('Stellar black hole');
    expect(deepSkyOf('notable-tabby')?.aliases).toContain('KIC 8462852');
    expect(deepSkyLayerKind(messierMarkBodyId(MESSIER_MARKS[0]!))).toBe(MESSIER_MARK_KIND);
  });
});

describe('the supernovae', () => {
  // Their hosts' centres as the Local Volume layer has them (UNGC): M101 and M82.
  const hosts: Record<string, readonly [number, number]> = {
    'sn-2023ixf': [210.80333, 54.35056],
    'sn-2011fe': [210.80333, 54.35056],
    'sn-2014j': [148.97458, 69.6825],
  };

  it('are each inside its host on the sky, at its distance, framed with the host about it', () => {
    const rad = Math.PI / 180;
    for (const [key, [ra, dec]] of Object.entries(hosts)) {
      const sn = star(key);
      const cos =
        Math.sin(sn.decDeg * rad) * Math.sin(dec * rad) + Math.cos(sn.decDeg * rad) * Math.cos(dec * rad) * Math.cos((sn.raDeg - ra) * rad);
      // M101 spans 29' across, M82 11': each well within.
      expect(Math.acos(Math.min(1, cos)) / rad, key).toBeLessThan(0.15);
      expect(sn.type).toBe('Supernova');
      expect(notableStarFraming(notableStarBodyId(sn))!.km).toBeGreaterThan(1000 * PARSEC_KM);
    }
    expect(star('sn-2023ixf').distancePc).toBe(star('sn-2011fe').distancePc);
  });
});
