import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { FrameTree, type StateProvider } from './frames.ts';
import type { StateVector } from './vec3.ts';

function body(id: string, parent: string | null): BodyDefinition {
  return {
    id,
    name: id,
    horizonsId: '0',
    stepDays: 1,
    center: '500@0',
    elementsCenter: '500@10',
    parent,
    kind: 'planet',
    radiusEquatorialKm: 1,
    radiusPolarKm: 1,
    gmKm3S2: 1,
    rotationPeriodHours: 1,
    axialTiltDeg: 0,
    color: '#ffffff',
    drawOrbit: true,
    texture: null,
  };
}

function state(x: number, vx = 0): StateVector {
  return { position: { x, y: 0, z: 0 }, velocity: { x: vx, y: 0, z: 0 } };
}

/**
 * A nested system standing in for what phase A brings: a planet on a barycentric
 * orbit, a moon around it, and a station around the moon.
 */
const NESTED = [
  body('sun', null),
  body('jupiter', null),
  body('io', 'jupiter'),
  body('station', 'io'),
];

const PROVIDER: StateProvider = (id) =>
  ({
    sun: state(1_000, 0.01),
    jupiter: state(778_000_000, 13),
    io: state(421_700, 17),
    station: state(2_000, 1),
  })[id] ?? null;

describe('FrameTree construction', () => {
  it('rejects duplicate ids', () => {
    expect(() => new FrameTree([body('a', null), body('a', null)])).toThrow(/Duplicate body id/);
  });

  it('rejects a parent that is not in the catalog', () => {
    expect(() => new FrameTree([body('io', 'jupiter')])).toThrow(/unknown parent "jupiter"/);
  });

  it('rejects a cycle', () => {
    expect(() => new FrameTree([body('a', 'b'), body('b', 'a')])).toThrow(/Cycle in the frame tree/);
  });
});

describe('FrameTree navigation', () => {
  const tree = new FrameTree(NESTED);

  it('lists ancestors nearest-first up to the root', () => {
    expect(tree.ancestorsOf('station')).toEqual(['io', 'jupiter']);
    expect(tree.ancestorsOf('io')).toEqual(['jupiter']);
    expect(tree.ancestorsOf('jupiter')).toEqual([]);
  });

  it('lists children, with the root addressed as null', () => {
    expect(tree.childrenOf(null).map((b) => b.id)).toEqual(['sun', 'jupiter']);
    expect(tree.childrenOf('jupiter').map((b) => b.id)).toEqual(['io']);
    expect(tree.childrenOf('station')).toEqual([]);
  });

  it('throws on an unknown body rather than returning undefined', () => {
    expect(() => tree.get('nope')).toThrow(/Unknown body/);
    expect(tree.has('nope')).toBe(false);
  });
});

describe('resolveInRoot', () => {
  const tree = new FrameTree(NESTED);

  it('passes through a body already in the root frame', () => {
    expect(tree.resolveInRoot('jupiter', PROVIDER)!.position.x).toBe(778_000_000);
  });

  it('sums the chain for a nested body', () => {
    // station + io + jupiter
    expect(tree.resolveInRoot('station', PROVIDER)!.position.x).toBe(778_000_000 + 421_700 + 2_000);
  });

  it('sums velocities along with positions', () => {
    expect(tree.resolveInRoot('station', PROVIDER)!.velocity.x).toBe(13 + 17 + 1);
  });

  it('returns null when a link in the chain has no data', () => {
    const partial: StateProvider = (id) => (id === 'jupiter' ? null : PROVIDER(id));

    expect(tree.resolveInRoot('station', partial)).toBeNull();
  });
});

describe('resolveRelative', () => {
  const tree = new FrameTree(NESTED);

  it('is zero for a body relative to itself', () => {
    const relative = tree.resolveRelative('io', 'io', PROVIDER)!;

    expect(relative.position.x).toBe(0);
    expect(relative.velocity.x).toBe(0);
  });

  it('gives the direct local state for a child seen from its parent', () => {
    expect(tree.resolveRelative('io', 'jupiter', PROVIDER)!.position.x).toBe(421_700);
  });

  it('cancels the shared ancestry instead of differencing huge numbers', () => {
    // This is the precision argument for resolveRelative: Io seen from Jupiter is
    // 421,700 km exactly, not the difference of two ~7.8e8 km barycentric vectors.
    // With a large enough parent offset, the naive route loses digits and this does
    // not.
    const far: StateProvider = (id) => (id === 'jupiter' ? state(1e17) : PROVIDER(id));
    const viaCancellation = tree.resolveRelative('io', 'jupiter', far)!.position.x;

    const naive =
      tree.resolveInRoot('io', far)!.position.x - tree.resolveInRoot('jupiter', far)!.position.x;

    expect(viaCancellation).toBe(421_700);
    expect(naive).not.toBe(421_700);
  });

  it('handles a grandchild seen from its grandparent', () => {
    expect(tree.resolveRelative('station', 'jupiter', PROVIDER)!.position.x).toBe(421_700 + 2_000);
  });

  it('handles bodies in different branches by going through the root', () => {
    // Io seen from the Sun: (jupiter + io) - sun
    expect(tree.resolveRelative('io', 'sun', PROVIDER)!.position.x).toBe(
      778_000_000 + 421_700 - 1_000,
    );
  });

  it('is antisymmetric', () => {
    const forward = tree.resolveRelative('io', 'sun', PROVIDER)!;
    const backward = tree.resolveRelative('sun', 'io', PROVIDER)!;

    expect(forward.position.x).toBe(-backward.position.x);
    expect(forward.velocity.x).toBe(-backward.velocity.x);
  });

  it('returns null when data is missing anywhere on either path', () => {
    const partial: StateProvider = (id) => (id === 'io' ? null : PROVIDER(id));

    expect(tree.resolveRelative('station', 'sun', partial)).toBeNull();
  });
});

describe('the v1 shape: one level, everything on the barycenter', () => {
  const flat = new FrameTree([body('sun', null), body('earth', null), body('mars', null)]);
  const provider: StateProvider = (id: BodyId) =>
    ({ sun: state(1_000), earth: state(149_600_000), mars: state(227_900_000) })[id] ?? null;

  it('resolves to the local state unchanged', () => {
    expect(flat.resolveInRoot('earth', provider)!.position.x).toBe(149_600_000);
  });

  it('still computes Earth as seen from Mars correctly', () => {
    expect(flat.resolveRelative('earth', 'mars', provider)!.position.x).toBe(
      149_600_000 - 227_900_000,
    );
  });
});
