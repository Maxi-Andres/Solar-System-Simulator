import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { bodiesToResolve, rebaseFrame } from '../scene/floatingOrigin.ts';
import { rebaseVisibleFrame } from '../scene/satellites.ts';
import {
  EphemerisStore,
  loadEphemerisData,
  type EphemerisData,
  type Fetcher,
} from './ephemerisStore.ts';

/**
 * The moons, checked against JPL rather than against themselves.
 *
 * Positions are Horizons' own, captured for one instant that sits between samples for
 * every moon -- 13:37 TDB, which no step in the catalog lands on -- so each comparison
 * exercises the chunk lookup, the interpolator and the frame tree together.
 *
 * Skipped without generated data, and case by case once the capture instant has left a
 * moon's two-year window: the weekly regeneration re-centres that window on the present,
 * so a fixed date falls out of it about a year after it was captured. When that
 * happens, recapture with a date inside the new window.
 */

const DATA_ROOT = join(import.meta.dirname, '../../public');

const diskFetcher: Fetcher = async (path) =>
  JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;

async function tryLoad(): Promise<EphemerisData | null> {
  try {
    return await loadEphemerisData(diskFetcher, '/');
  } catch {
    return null;
  }
}

const data = await tryLoad();
const describeWithData = data === null ? describe.skip : describe;

/** 2026-10-07 13:37:00 TDB, off every sampling grid in the catalog. */
const CAPTURE_JD = 2461321.0673611;

/**
 * Captured with EPHEM_TYPE='VECTORS', TLIST at CAPTURE_JD, REF_PLANE='ECLIPTIC',
 * CENTER at each planet's body center -- the same frame the tables are in. km.
 */
const JPL_RELATIVE: Readonly<Record<string, readonly [number, number, number]>> = {
  moon: [-3.439826785124996e5, 1.551213383523481e5, -4.147474986000845e3],
  phobos: [-4.41313977467688e3, 7.934037392915041e3, 2.598468686014162e3],
  deimos: [-1.60474791241133e4, -1.600423445824083e4, 6.052544815858048e3],
  io: [3.941248132481805e5, -1.461947944825118e5, 3.542226111449127e2],
  titan: [-1.240261943896107e6, 2.030327450904005e5, 1.868477839837168e4],
  miranda: [-2.430328881533058e4, 2.569748114490469e4, 1.247565781409758e5],
  triton: [2.131432590063742e5, -9.770477310532668e4, -2.662778402525088e5],
  charon: [1.138223919604895e4, 1.526105580673683e4, 4.627805175853743e3],
};

/** Io against the Solar System barycenter, same instant: the whole tree at once. */
const JPL_IO_BARYCENTRIC = [-5.276025142261116e8, 5.924838186780967e8, 9.35858708855775e6] as const;

function gap(a: { x: number; y: number; z: number }, b: readonly number[]): number {
  return Math.hypot(a.x - b[0]!, a.y - b[1]!, a.z - b[2]!);
}

describeWithData('the moons against JPL Horizons', () => {
  const store = new EphemerisStore(data!);

  it('puts every checked moon where JPL does, relative to its planet', async () => {
    for (const [id, expected] of Object.entries(JPL_RELATIVE)) {
      if (!store.isExactAt(CAPTURE_JD, [id])) {
        console.warn(`[moons.test] ${id}: capture instant is outside its window; skipped.`);
        continue;
      }
      const body = store.body(id);
      await store.whenLoadedAt(CAPTURE_JD, [id]);
      const state = store.stateRelativeTo(id, body.parent!, CAPTURE_JD);

      expect(state, id).not.toBeNull();
      expect(state!.approximate, id).toBe(false);
      // The catalog's own budget is a hundredth of the body's radius; its measured
      // worst case, over three whole orbits, was 0.0091. Twice that is the bound.
      expect(gap(state!.position, expected) / body.radiusEquatorialKm, id).toBeLessThan(0.02);
    }
  });

  it("adds Io to Jupiter to find it in the Solar System's own frame", async () => {
    if (!store.isExactAt(CAPTURE_JD, ['io'])) {
      return;
    }
    await store.whenLoadedAt(CAPTURE_JD, ['io']);
    const state = store.stateInRoot('io', CAPTURE_JD);

    // Io relative to Jupiter is good to kilometres; this is off by 585 km, and all of
    // it is Jupiter's own table. Measured against JPL across 2026 at six-hour spacing,
    // Jupiter's centre is up to 956 km out at its 32-day step -- 0.013 of its radius --
    // because the Galileans swing that centre around the system's barycentre by about
    // 200 km every few days, which one sample a month cannot follow. Pluto and Charon
    // are the same effect, larger.
    //
    // It moves the whole Jovian system together, so nothing drawn changes: Io against
    // Jupiter is exact, and 956 km at 4 AU is a third of an arcsecond from Earth --
    // under a two-hundredth of a pixel.
    expect(state).not.toBeNull();
    expect(gap(state!.position, JPL_IO_BARYCENTRIC)).toBeLessThan(1200);
  });
});

describeWithData('a moon whose data has not arrived', () => {
  it('is absent rather than approximate while its chunk is on the way', () => {
    // A loader that never answers: the state of the first frame after startup.
    const pending = new EphemerisStore({ ...data!, loadChunk: () => new Promise(() => {}) });
    const jd = CAPTURE_JD;
    if (!pending.isExactAt(jd, ['io'])) {
      return;
    }

    expect(pending.stateRelativeTo('io', 'jupiter', jd)).toBeNull();
    // The Moon ships whole with the planets, so it is there from the first frame.
    expect(pending.stateRelativeTo('moon', 'earth', jd)).not.toBeNull();
  });

  it('asks for a chunk once, however many frames want it', () => {
    let calls = 0;
    const counting = new EphemerisStore({
      ...data!,
      loadChunk: () => {
        calls += 1;
        return new Promise(() => {});
      },
    });
    const jd = counting.coverage('phobos')!.startJd + 3.3;

    for (let frame = 0; frame < 60; frame += 1) {
      counting.stateRelativeTo('phobos', 'mars', jd);
    }
    expect(calls).toBe(1);
  });

  it('costs nothing at all while the moons are switched off', () => {
    let calls = 0;
    const counting = new EphemerisStore({
      ...data!,
      loadChunk: () => {
        calls += 1;
        return new Promise(() => {});
      },
    });
    const jd = counting.coverage('io')!.startJd + 100;

    const withoutMoons = bodiesToResolve(counting, new Set(['star', 'planet', 'dwarf-planet']), 'sun');
    rebaseFrame(counting, 'sun', jd, withoutMoons);
    expect(calls).toBe(0);

    const withMoons = bodiesToResolve(counting, new Set(['star', 'planet', 'dwarf-planet', 'moon']), 'sun');
    rebaseFrame(counting, 'sun', jd, withMoons);
    // One per short-window moon: the Moon ships whole and needs no fetch.
    expect(calls).toBe(20);
  });

  it('fetches a moon only once its system has opened up on screen', () => {
    const requested: string[] = [];
    const counting = new EphemerisStore({
      ...data!,
      loadChunk: (id) => {
        requested.push(id);
        return new Promise(() => {});
      },
    });
    const jd = counting.coverage('io')!.startJd + 100;
    const kinds = new Set(['star', 'planet', 'dwarf-planet', 'moon']);

    // The default view: the Sun in focus from eight solar radii. No moon can be seen
    // from there, and none is fetched.
    const sunView = { x: 0, y: 0, z: 8 * 695.7 };
    rebaseVisibleFrame(counting, 'sun', jd, bodiesToResolve(counting, kinds, 'sun'), sunView, 1080, 27);
    expect(requested).toEqual([]);

    // Jupiter in focus from eight of its radii: its four moons, and nothing else.
    const jupiterView = { x: 0, y: 0, z: 8 * 71.492 };
    rebaseVisibleFrame(
      counting,
      'jupiter',
      jd,
      bodiesToResolve(counting, kinds, 'jupiter'),
      jupiterView,
      1080,
      27,
    );
    expect(requested.sort()).toEqual(['callisto', 'europa', 'ganymede', 'io']);
  });
});

describeWithData('a moon outside its window', () => {
  const store = new EphemerisStore(data!);

  it('falls back to its elements, around its planet, and says so', () => {
    const past = store.coverage('titan')!.startJd - 400;
    const state = store.stateRelativeTo('titan', 'saturn', past);

    expect(state).not.toBeNull();
    expect(state!.approximate).toBe(true);
    // Still on an orbit the size of Titan's: propagated about Saturn, not the Sun.
    const r = Math.hypot(state!.position.x, state!.position.y, state!.position.z);
    expect(r).toBeGreaterThan(1.18e6);
    expect(r).toBeLessThan(1.26e6);
  });

  it('makes the view approximate only if the moons are in it', () => {
    const past = store.coverage('titan')!.startJd - 400;
    const planets = store.bodies.filter((body) => body.parent === null).map((body) => body.id);

    // Two years back the planets are still exact; Titan is not.
    expect(store.isExactAt(past, planets)).toBe(true);
    expect(store.isExactAt(past, [...planets, 'titan'])).toBe(false);
  });
});
