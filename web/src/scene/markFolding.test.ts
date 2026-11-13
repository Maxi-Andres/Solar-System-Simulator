import { describe, expect, it } from 'vitest';

import {
  FOLD_FULL_PX,
  FOLD_GONE_PX,
  FOLD_KEPT_TO,
  FOLD_SHOWN_FROM,
  foldedShown,
  FoldHosts,
  foldMembers,
  foldStrength,
  SYSTEM_FULL_PX,
  SYSTEM_GONE_PX,
  systemStrength,
} from './markFolding.ts';

describe('foldStrength', () => {
  it('is gone at a mark’s size from its host, whole at twice that, smooth between', () => {
    expect(foldStrength(0)).toBe(0);
    expect(foldStrength(FOLD_GONE_PX)).toBe(0);
    expect(foldStrength(FOLD_FULL_PX)).toBe(1);
    expect(foldStrength(1000)).toBe(1);
    expect(foldStrength((FOLD_GONE_PX + FOLD_FULL_PX) / 2)).toBeCloseTo(0.5, 12);
  });

  it('only grows as the member draws away on the screen', () => {
    let last = 0;
    for (let px = 0; px <= 40; px += 0.25) {
      const value = foldStrength(px);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });

  it('is a mark’s size, a few CSS pixels', () => {
    // Rings of four to six pixels' radius touch below twelve.
    expect(FOLD_GONE_PX).toBeGreaterThanOrEqual(8);
    expect(FOLD_GONE_PX).toBeLessThanOrEqual(16);
  });
});

describe('foldedShown', () => {
  it('needs more of the mark to appear than to stay', () => {
    expect(FOLD_SHOWN_FROM).toBeGreaterThan(FOLD_KEPT_TO);
    const between = (FOLD_SHOWN_FROM + FOLD_KEPT_TO) / 2;
    expect(foldedShown(between, false)).toBe(false);
    expect(foldedShown(between, true)).toBe(true);
  });

  it('does not flicker as the fold wobbles about one threshold', () => {
    let shown = true;
    const seen: boolean[] = [];
    for (const strength of [0.6, 0.45, 0.55, 0.4, 0.5, 0.36]) {
      shown = foldedShown(strength, shown);
      seen.push(shown);
    }
    expect(seen.every((value) => value)).toBe(true);
    shown = foldedShown(0.3, shown);
    expect(shown).toBe(false);
    for (const strength of [0.4, 0.5, 0.6, 0.45]) {
      shown = foldedShown(strength, shown);
      expect(shown).toBe(false);
    }
    expect(foldedShown(0.7, shown)).toBe(true);
  });
});

/** A galaxy at the origin, a satellite host 100 kpc off it, and the camera along z. */
function hosts(): FoldHosts {
  const h = new FoldHosts();
  h.add('galaxy', [0, 0, 0], null);
  h.add('satellite', [100_000, 0, 0], 'galaxy');
  return h;
}

describe('FoldHosts', () => {
  it('works each host’s pixels per parsec out from the camera’s distance to it', () => {
    const h = hosts();
    h.update([0, 0, 1_000_000], 1000, []);
    expect(h.scale[0]).toBeCloseTo(1000 / 1_000_000, 15);
    // A member 30 kpc out is 30 px from it: whole. 10 kpc, 10 px: folded.
    expect(h.member(0, 30_000)).toBe(1);
    expect(h.member(0, 10_000)).toBe(0);
  });

  it('folds a host into its own host, and its members with it', () => {
    const h = hosts();
    // From 10 Mpc, the satellite is 10 px from the galaxy: folded, and everything about it.
    h.update([0, 0, 10_000_000], 1000, []);
    expect(h.strength[0]).toBe(1);
    expect(h.strength[1]).toBe(0);
    expect(h.member(1, 1e9)).toBe(0);
    // From 1 Mpc it is 100 px off: open, and its members fold by their own distances.
    h.update([0, 0, 1_000_000], 1000, []);
    expect(h.strength[1]).toBe(1);
    expect(h.member(1, 50_000)).toBe(1);
  });

  it('never folds a pinned host -- the focus’s -- whatever the distance', () => {
    const h = hosts();
    h.update([0, 0, 10_000_000], 1000, h.chain(1));
    expect(h.strength[1]).toBe(1);
    // Its members still fold by their own distances from it.
    expect(h.member(1, 1_000)).toBe(0);
  });

  it('a host folds into nothing, and a member of no host is always whole', () => {
    const h = hosts();
    h.update([0, 0, 1e12], 1000, []);
    expect(h.strength[0]).toBe(1);
    expect(h.member(-1, 0)).toBe(1);
  });

  it('keeps the one it was given and refuses a host whose own host is unknown', () => {
    const h = hosts();
    expect(h.add('galaxy', [5, 5, 5], null)).toBe(0);
    expect(() => h.add('moon', [0, 0, 0], 'nowhere')).toThrow();
    expect(h.foldOf(1)).toEqual({ host: 0, separationPc: 100_000 });
    expect(h.chain(1)).toEqual([1, 0]);
  });
});

describe('foldMembers', () => {
  it('folds a catalogue at once, the pinned one never, and says when anything changed', () => {
    const h = hosts();
    h.update([0, 0, 1_000_000], 1000, []);
    const host = Int32Array.from([0, 0, 1, -1]);
    const separation = Float32Array.from([30_000, 10_000, 10_000, 0]);
    const out = new Float32Array(4).fill(1);
    expect(foldMembers(h, host, separation, out, 1)).toBe(true);
    expect(Array.from(out)).toEqual([1, 1, 0, 1]);
    expect(foldMembers(h, host, separation, out, -1)).toBe(true);
    expect(Array.from(out)).toEqual([1, 0, 0, 1]);
    expect(foldMembers(h, host, separation, out, -1)).toBe(false);
  });
});

describe('a host with a reach', () => {
  it('lets its members be drawn while its reach is big on the screen, none once it is small', () => {
    expect(systemStrength(SYSTEM_GONE_PX)).toBe(0);
    expect(systemStrength(SYSTEM_FULL_PX)).toBe(1);
    const h = new FoldHosts();
    // A Local Group of a megaparsec's reach, and a member 1.5 Mpc out.
    const g = h.add('group', [0, 0, 0], null, 1e6);
    const ppr = 1000;
    // From 2 Mpc the reach is 500 px: the member, 750 px off, whole.
    h.update([0, 0, 2e6], ppr, []);
    expect(h.member(g, 1.5e6)).toBe(1);
    // From 30 Mpc the reach is 33 px, under SYSTEM_GONE_PX: the member folded, though 50 px off.
    h.update([0, 0, 30e6], ppr, []);
    expect(1.5e6 * h.scale[g]!).toBeGreaterThan(FOLD_FULL_PX);
    expect(h.member(g, 1.5e6)).toBe(0);
  });

  it('leaves a host with no reach to the separation alone', () => {
    const h = new FoldHosts();
    const g = h.add('group', [0, 0, 0], null);
    h.update([0, 0, 30e6], 1000, []);
    expect(h.member(g, 1.5e6)).toBe(1);
  });
});
