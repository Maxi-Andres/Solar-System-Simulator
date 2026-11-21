import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { BodyDefinition, BodyId, Manifest, VectorTable } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { describeWithData as withData } from './describeWithData.ts';
import { EphemerisStore, loadEphemerisStore, type BodyState, type Fetcher } from './ephemerisStore.ts';
import { addStates, subtractStates, ZERO_STATE, type StateVector } from './vec3.ts';

/**
 * The store remembers each body's local state for the instant last asked, and the Sun as
 * seen from the focus. These tests hold it to two things: the answers are the very doubles
 * the plain walk gives, and nothing remembered outlives the data or the instant it was for.
 */

/** A table of `count` samples one day apart from `startJd`, moving linearly along x. */
function linearTable(id: BodyId, startJd: number, count: number, x0: number, vxKmS: number): VectorTable {
  const t = Array.from({ length: count }, (_, i) => startJd + i);
  const x = t.map((jd) => x0 + vxKmS * (jd - startJd) * 86_400);
  return {
    id,
    horizonsId: id,
    center: '',
    count,
    t,
    x,
    y: t.map(() => 1.5),
    z: t.map(() => -2.25),
    vx: t.map(() => vxKmS),
    vy: t.map(() => 0),
    vz: t.map(() => 0),
  } as unknown as VectorTable;
}

function body(id: BodyId, parent: BodyId | null): BodyDefinition {
  return { id, parent, drawOrbit: false, radiusEquatorialKm: 1 } as unknown as BodyDefinition;
}

/**
 * The Sun and Earth with whole tables, and the Moon chunked in two, its chunks handed over
 * only when the test says.
 */
function fixture() {
  const waiting: { index: number; deliver: () => void }[] = [];
  const moonChunks = [linearTable('moon', 0, 11, 384_000, 1), linearTable('moon', 10, 11, 384_000 + 864_000, 1)];
  const manifest = {
    bodies: ['sun', 'earth', 'moon'],
    tables: {
      sun: { startJd: 0, stopJd: 20, chunks: null },
      earth: { startJd: 0, stopJd: 20, chunks: null },
      moon: {
        startJd: 0,
        stopJd: 20,
        chunks: [
          { startJd: 0, stopJd: 10 },
          { startJd: 10, stopJd: 20 },
        ],
      },
    },
    paths: {},
    surfaces: {},
    smallMoons: {},
  } as unknown as Manifest;
  const store = new EphemerisStore({
    manifest,
    bodies: [body('sun', null), body('earth', null), body('moon', 'earth')],
    vectors: new Map([
      ['sun', linearTable('sun', 0, 21, 1_000.125, 0.01)],
      ['earth', linearTable('earth', 0, 21, 149_597_870.7, 29.78)],
    ]),
    elements: new Map(),
    loadChunk: (_id, index) =>
      new Promise<VectorTable>((resolve) => {
        waiting.push({ index, deliver: () => resolve(moonChunks[index]!) });
      }),
    loadPath: null,
  });
  /** Hands over every chunk asked for so far and lets the store take them in. */
  const deliver = async () => {
    for (const request of waiting.splice(0)) request.deliver();
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  return { store, deliver };
}

describe('the remembered states', () => {
  it('gives back the same answer, the same object, for the same instant', () => {
    const { store } = fixture();
    const first = store.localState('earth', 3.25)!;
    expect(store.localState('earth', 3.25)).toBe(first);
    const sun = store.sunFromFocus('earth', 3.25)!;
    expect(store.sunFromFocus('earth', 3.25)).toBe(sun);
    expect(sun).toEqual(store.stateRelativeTo('sun', 'earth', 3.25));
  });

  it('works an instant out again when the instant changes', () => {
    const { store } = fixture();
    const before = store.localState('earth', 3.25)!;
    const sunBefore = store.sunFromFocus('earth', 3.25)!;
    const after = store.localState('earth', 4.5)!;
    expect(after).not.toBe(before);
    expect(after.position.x).toBeGreaterThan(before.position.x);
    const sunAfter = store.sunFromFocus('earth', 4.5)!;
    expect(sunAfter.position.x).not.toBe(sunBefore.position.x);
    // And back: the earlier instant's answer, worked out again, is the same doubles.
    expect(store.localState('earth', 3.25)).toEqual(before);
  });

  it('answers for a chunked moon once its chunk lands, even at an instant already asked', async () => {
    const { store, deliver } = fixture();
    // Asked while paused at one instant: nothing yet, and the chunk is on its way.
    expect(store.localState('moon', 2.5)).toBeNull();
    expect(store.stateRelativeTo('moon', 'sun', 2.5)).toBeNull();
    expect(store.sunFromFocus('moon', 2.5)).toBeNull();
    await deliver();
    // The same instant, now answered.
    const moon = store.localState('moon', 2.5);
    expect(moon).not.toBeNull();
    expect(store.stateRelativeTo('moon', 'sun', 2.5)).not.toBeNull();
    expect(store.sunFromFocus('moon', 2.5)).not.toBeNull();
  });

  it('forgets everything when a chunk arrives, so nothing kept outlives the data it came from', async () => {
    const { store, deliver } = fixture();
    const earth = store.localState('earth', 9.75)!;
    // The Moon near its chunk's end asks for its neighbour too.
    expect(store.localState('moon', 9.75)).toBeNull();
    await deliver();
    const moon = store.localState('moon', 9.75)!;
    expect(store.localState('moon', 9.75)).toBe(moon);
    // Earth's was worked out again after the arrival, to the same doubles.
    expect(store.localState('earth', 9.75)).not.toBe(earth);
    expect(store.localState('earth', 9.75)).toEqual(earth);
    // The neighbour it asked for lands: the Moon's is worked out again too.
    await deliver();
    const again = store.localState('moon', 9.75)!;
    expect(again).not.toBe(moon);
    expect(again).toEqual(moon);
  });

  it('forgets a body taken away, and answers for the one added in its place', () => {
    const { store } = fixture();
    const probe = body('probe', null);
    const at = (x: number) => (): StateVector => ({ position: { x, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } });
    store.addPropagatedBody(probe, null, at(1), { exact: true });
    const sun = store.localState('sun', 5)!.position.x;
    expect(store.localState('probe', 5)!.position.x).toBe(1 + sun);
    store.removePropagatedBody('probe');
    store.addPropagatedBody(probe, null, at(2), { exact: true });
    expect(store.localState('probe', 5)!.position.x).toBe(2 + sun);
  });
});

/** The walk as it was before anything was remembered: arrays, a set, a state per link. */
function plainRelative(store: EphemerisStore, id: BodyId, observerId: BodyId, jd: number): BodyState | null {
  if (id === observerId) return { ...ZERO_STATE, approximate: false };
  let approximate = false;
  const provider = (link: BodyId): StateVector | null => {
    const local = store.localState(link, jd);
    if (local?.approximate === true) approximate = true;
    // A fresh copy, so nothing remembered is reused.
    return local === null ? null : { position: { ...local.position }, velocity: { ...local.velocity } };
  };
  const targetChain = [id, ...store.tree.ancestorsOf(id)];
  const observerChain = [observerId, ...store.tree.ancestorsOf(observerId)];
  const observerSet = new Set(observerChain);
  const commonIndex = targetChain.findIndex((frame) => observerSet.has(frame));
  const targetLinks = commonIndex === -1 ? targetChain : targetChain.slice(0, commonIndex);
  const commonFrame = commonIndex === -1 ? null : (targetChain[commonIndex] ?? null);
  const observerLinks =
    commonFrame === null ? observerChain : observerChain.slice(0, observerChain.indexOf(commonFrame));
  const sum = (links: readonly BodyId[]): StateVector | null => {
    let total = ZERO_STATE;
    for (const link of links) {
      const state = provider(link);
      if (state === null) return null;
      total = addStates(total, state);
    }
    return total;
  };
  const target = sum(targetLinks);
  const observer = sum(observerLinks);
  if (target === null || observer === null) return null;
  return { ...subtractStates(target, observer), approximate };
}

const DATA_ROOT = join(import.meta.dirname, '../../public');
const diskFetcher: Fetcher = async (path) =>
  JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;
const store = await loadEphemerisStore(diskFetcher, '/').catch(() => null);

withData(store !== null)('the remembered walk against the generated data', () => {
  const s = store!;

  it('gives every body seen from every other the very doubles of the plain walk', async () => {
    const window = s.manifest.window;
    const instants = [window.startJd + 0.3, (window.startJd + window.stopJd) / 2 + 0.123456789];
    const ids = s.bodies.map((b) => b.id);
    for (const jd of instants) {
      await s.whenLoadedAt(jd);
      for (const observer of ['sun', 'earth', 'moon', 'io', ids[ids.length - 1]!]) {
        if (!s.tree.has(observer)) continue;
        for (const id of ids) {
          const remembered = s.stateRelativeTo(id, observer, jd);
          const plain = plainRelative(s, id, observer, jd);
          expect(remembered).toStrictEqual(plain);
        }
        expect(s.sunFromFocus(observer, jd)).toStrictEqual(plainRelative(s, 'sun', observer, jd));
      }
      for (const id of ids) {
        const root = s.stateInRoot(id, jd);
        const plain = s.tree.resolveInRoot(id, (link) => s.localState(link, jd));
        if (plain === null) {
          expect(root).toBeNull();
        } else {
          expect(root?.position).toStrictEqual(plain.position);
          expect(root?.velocity).toStrictEqual(plain.velocity);
        }
      }
    }
  });
});
