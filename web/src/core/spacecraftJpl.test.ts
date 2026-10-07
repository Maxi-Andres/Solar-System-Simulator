import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { SPACECRAFT_ANGULAR_TOLERANCE, SPACECRAFT_TOLERANCE_KM } from '@sss/tools/config';

import { loadEphemerisStore, type EphemerisStore, type Fetcher } from './ephemerisStore.ts';

/**
 * The spacecraft, against JPL.
 *
 * Positions captured from Horizons at instants that sit between samples on purpose --
 * to the tenth of a second rather than on the one-minute grid -- and inside the hardest
 * stretches of each path: closest approach at a flyby, perihelion. If the adaptive
 * sampling had left an encounter too coarse, this is where it would show.
 *
 * Captured 2026-09-25 with EPHEM_TYPE=VECTORS, REF_PLANE=ECLIPTIC, REF_SYSTEM=ICRF, in
 * km. A predicted trajectory can be revised; if one of these starts failing by a lot
 * after a regeneration, recapture before suspecting the interpolation.
 */

const DATA_ROOT = join(import.meta.dirname, '../../public');

const diskFetcher: Fetcher = async (path) =>
  JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;

async function tryLoad(): Promise<EphemerisStore | null> {
  try {
    const store = await loadEphemerisStore(diskFetcher, '/');
    return store.bodies.some((body) => body.kind === 'spacecraft') ? store : null;
  } catch {
    return null;
  }
}

const store = await tryLoad();
const describeWithData = store === null ? describe.skip : describe;

/** One Horizons state: body, what it is measured from, instant (TDB), position (km). */
interface Capture {
  readonly id: string;
  readonly note: string;
  readonly from: 'ssb' | 'earth';
  readonly jd: number;
  readonly position: readonly [number, number, number];
}

const CAPTURES: readonly Capture[] = [
  {
    id: 'juice',
    note: 'Earth flyby, closest approach 15,019 km from the centre',
    from: 'ssb',
    jd: 2461311.9905093,
    position: [1.491404711189913e8, 1.228975739150172e7, 1.248517280818336e4],
  },
  {
    id: 'europa-clipper',
    note: 'Earth flyby, closest approach 9,619 km from the centre',
    from: 'ssb',
    jd: 2461378.3447338,
    position: [4.715401553006688e7, 1.389449977706659e8, 3.046517252914608e3],
  },
  {
    id: 'parker-solar-probe',
    note: 'perihelion',
    from: 'ssb',
    jd: 2461022.0281713,
    position: [3.37208500847973e6, 9.131487554691281e6, -6.391939986232575e4],
  },
  {
    id: 'psyche',
    note: 'Mars flyby',
    from: 'ssb',
    jd: 2461176.5591435,
    position: [2.068292404543045e8, 2.859316749007417e7, -4.480010616568319e6],
  },
  {
    id: 'voyager-1',
    note: 'interstellar cruise',
    from: 'ssb',
    jd: 2461308.8123456,
    position: [-4.810693975819771e9, -2.046275089920805e10, 1.480465868676212e10],
  },
  {
    id: 'jwst',
    note: 'halo orbit about L2, measured from Earth',
    from: 'earth',
    jd: 2461308.4567891,
    position: [1.182653299100083e6, 3.273226888922438e5, 2.523187830468522e5],
  },
];

describeWithData('spacecraft positions against JPL', () => {
  const s = store!;

  for (const capture of CAPTURES) {
    it(`puts ${capture.id} within its tolerance at ${capture.note}`, async () => {
      if (!s.isCoveredAt(capture.id, capture.jd)) {
        // The window moves with every build; an instant it has left says nothing.
        console.warn(`[spacecraftJpl.test] ${capture.id} capture is outside the data; skipped.`);
        return;
      }
      await s.whenLoadedAt(capture.jd, [capture.id, 'earth']);
      const state =
        capture.from === 'earth'
          ? s.stateRelativeTo(capture.id, 'earth', capture.jd)
          : s.stateInRoot(capture.id, capture.jd);
      expect(state, capture.id).not.toBeNull();

      const [x, y, z] = capture.position;
      const miss = Math.hypot(state!.position.x - x, state!.position.y - y, state!.position.z - z);
      // The generator's own rule: a kilometre, or ten microradians seen from the nearest
      // full-window body, whichever is larger (SPACECRAFT_ANGULAR_TOLERANCE in tools).
      const craft = s.stateInRoot(capture.id, capture.jd)!.position;
      let nearest = Infinity;
      for (const body of s.bodies.filter((candidate) => candidate.vectorWindow === 'full')) {
        const at = s.stateInRoot(body.id, capture.jd)!.position;
        nearest = Math.min(nearest, Math.hypot(craft.x - at.x, craft.y - at.y, craft.z - at.z));
      }
      const toleranceKm = Math.max(SPACECRAFT_TOLERANCE_KM, SPACECRAFT_ANGULAR_TOLERANCE * nearest);
      expect(miss, capture.id).toBeLessThan(toleranceKm);
    });
  }

  it('is absent before launch and after the end of its path, never approximate', () => {
    const span = s.coverage('parker-solar-probe')!;
    expect(s.stateInRoot('parker-solar-probe', span.startJd - 1)).toBeNull();
    expect(s.stateInRoot('parker-solar-probe', span.stopJd + 1)).toBeNull();
  });
});
