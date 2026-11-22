import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { GALACTIC_BASIS } from '../scene/galactic.ts';
import { sceneToGalacticPc } from '../scene/NuclearCluster.tsx';
import {
  ClusterDust,
  clusterCentreGalactic,
  clusterDustResponder,
  clusterExtinctions,
  SunColumns,
  SUN_COLUMN_REFRESH_SHARE,
  type ClusterDustAnswer,
  type ClusterDustCatalog,
  type ClusterDustRequest,
  type DustPort,
} from './globularClusterDust.ts';
import * as nuclear from './nuclearCluster.ts';
import { PARSEC_KM } from './stars3d.ts';

/**
 * The globular clusters' dust (globularClusterDust.ts) is what GlobularClusters.tsx worked out
 * in its frame before -- both columns, every time -- now with the Sun's kept and the camera's in
 * a worker.
 */

const catalog: ClusterDustCatalog = {
  count: 4,
  x: [4000, -200, 7900, 12000],
  y: [300, 5000, -50, -9000],
  z: [-800, 2500, 120, 4000],
  vx: [120, -40, 10, 200],
  vy: [-60, 80, 0, -10],
  vz: [30, 0, -150, 90],
  extinctionV: [0.31, Number.NaN, 2.5, 0],
  basis: { x: { ...GALACTIC_BASIS.x }, y: { ...GALACTIC_BASIS.y }, z: { ...GALACTIC_BASIS.z } },
};

/** As GlobularClusters.tsx had it: each cluster's place through three, both columns from scratch. */
function reference(camera: readonly [number, number, number], motion: number): number[] {
  const out: number[] = [];
  const v = new THREE.Vector3();
  for (let k = 0; k < catalog.count; k += 1) {
    const fromSun = Number.isNaN(catalog.extinctionV[k]!) ? null : catalog.extinctionV[k]!;
    let value = 0;
    if (fromSun !== null && fromSun > 0) {
      v.set(catalog.x[k]! + catalog.vx[k]! * motion, catalog.y[k]! + catalog.vy[k]! * motion, catalog.z[k]! + catalog.vz[k]! * motion);
      const centre = sceneToGalacticPc(v.multiplyScalar(PARSEC_KM));
      const share = nuclear.dustColumn(camera, centre) / Math.max(nuclear.dustColumn([0, 0, 0], centre), 1e-30);
      value = fromSun * Math.min(1, share);
    }
    out.push(value);
  }
  return out;
}

describe('clusterCentreGalactic', () => {
  it('turns a centre as sceneToGalacticPc does, to the last bit', () => {
    for (const motion of [0, 1e-4, 0.37]) {
      for (let k = 0; k < catalog.count; k += 1) {
        const v = new THREE.Vector3(
          catalog.x[k]! + catalog.vx[k]! * motion,
          catalog.y[k]! + catalog.vy[k]! * motion,
          catalog.z[k]! + catalog.vz[k]! * motion,
        ).multiplyScalar(PARSEC_KM);
        expect(clusterCentreGalactic(catalog, k, motion)).toEqual(sceneToGalacticPc(v));
      }
    }
  });
});

describe('clusterExtinctions', () => {
  it('gives what both columns worked out every time gave, for cameras near and far', () => {
    const sun = new SunColumns(catalog.count);
    for (const camera of [
      [0, 0, 0],
      [8000, 0, 20],
      [-3000, 12000, 6000],
      [4100, 250, -700],
    ] as [number, number, number][]) {
      const out = clusterExtinctions(catalog, sun, camera, 0.01, new Float64Array(catalog.count));
      expect(Array.from(out)).toEqual(reference(camera, 0.01));
    }
  });

  it('none from the Sun where Harris gives none, or none above 0', () => {
    const out = clusterExtinctions(catalog, new SunColumns(catalog.count), [8000, 0, 0], 0, new Float64Array(catalog.count));
    expect(out[1]).toBe(0);
    expect(out[3]).toBe(0);
    // From the Sun, all of it.
    const fromSun = clusterExtinctions(catalog, new SunColumns(catalog.count), [0, 0, 0], 0, new Float64Array(catalog.count));
    expect(fromSun[0]).toBeCloseTo(0.31, 12);
  });
});

describe('SunColumns', () => {
  it('works the Sun’s column out once while the cluster stays put, and again once it has moved', () => {
    const spy = vi.spyOn(nuclear, 'dustColumn');
    try {
      const sun = new SunColumns(2);
      const centre: [number, number, number] = [5000, 100, -30];
      const first = sun.column(0, centre);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(sun.column(0, centre)).toBe(first);
      // Moved less than the share: kept.
      const d = Math.hypot(...centre);
      sun.column(0, [centre[0] + 0.5 * SUN_COLUMN_REFRESH_SHARE * d, centre[1], centre[2]]);
      expect(spy).toHaveBeenCalledTimes(1);
      // Another cluster has its own.
      sun.column(1, centre);
      expect(spy).toHaveBeenCalledTimes(2);
      // Moved more: worked out again, to the new place.
      const moved: [number, number, number] = [centre[0] + 2 * SUN_COLUMN_REFRESH_SHARE * d, centre[1], centre[2]];
      expect(sun.column(0, moved)).toBe(nuclear.dustColumn([0, 0, 0], moved));
      expect(spy).toHaveBeenCalledTimes(4);
    } finally {
      spy.mockRestore();
    }
  });
});

/** A worker stand-in: answers on `flush`, as a worker answers between frames. */
class FakePort implements DustPort {
  onmessage: ((event: MessageEvent<ClusterDustAnswer>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly sent: ClusterDustRequest[] = [];
  terminated = false;
  private readonly respond = clusterDustResponder();
  private queue: ClusterDustAnswer[] = [];

  postMessage(message: ClusterDustRequest): void {
    this.sent.push(message);
    const answer = this.respond(structuredClone(message));
    if (answer !== null) this.queue.push(answer);
  }

  terminate(): void {
    this.terminated = true;
  }

  flush(): void {
    const answers = this.queue;
    this.queue = [];
    for (const data of answers) this.onmessage?.({ data } as MessageEvent<ClusterDustAnswer>);
  }
}

describe('ClusterDust', () => {
  it('answers at once with no worker', () => {
    const dust = new ClusterDust(catalog);
    let got: Float64Array | null = null;
    expect(dust.ask([8000, 0, 20], 0, (values) => (got = values))).toBe(true);
    expect(Array.from(got!)).toEqual(reference([8000, 0, 20], 0));
    expect(dust.busy).toBe(false);
  });

  it('asks the worker one question at a time, and takes its answer when it comes', () => {
    const dust = new ClusterDust(catalog);
    const port = new FakePort();
    dust.attach(port);
    expect(port.sent[0]!.type).toBe('catalog');
    const answers: Float64Array[] = [];
    expect(dust.ask([-3000, 12000, 6000], 0.2, (values) => answers.push(values))).toBe(true);
    expect(dust.busy).toBe(true);
    expect(dust.ask([0, 0, 0], 0, () => answers.push(new Float64Array()))).toBe(false);
    expect(answers).toHaveLength(0);
    port.flush();
    expect(dust.busy).toBe(false);
    expect(answers).toHaveLength(1);
    expect(Array.from(answers[0]!)).toEqual(reference([-3000, 12000, 6000], 0.2));
  });

  it('works the question out here if the worker fails, and drops the answer of one detached', () => {
    const dust = new ClusterDust(catalog);
    const port = new FakePort();
    dust.attach(port);
    const answers: Float64Array[] = [];
    dust.ask([8000, 0, 20], 0, (values) => answers.push(values));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    port.onerror?.({} as ErrorEvent);
    error.mockRestore();
    expect(port.terminated).toBe(true);
    expect(answers).toHaveLength(1);
    expect(Array.from(answers[0]!)).toEqual(reference([8000, 0, 20], 0));

    const second = new FakePort();
    dust.attach(second);
    dust.ask([4100, 250, -700], 0, (values) => answers.push(values));
    dust.detach();
    second.flush();
    expect(answers).toHaveLength(1);
    expect(dust.busy).toBe(false);
  });

  it('works out one cluster’s for its stars as the whole catalogue’s does', () => {
    const dust = new ClusterDust(catalog);
    const all = reference([4100, 250, -700], 0.05);
    expect(dust.one(0, [4100, 250, -700], 0.05)).toBe(all[0]);
    expect(dust.one(2, [4100, 250, -700], 0.05)).toBe(all[2]);
    expect(dust.one(1, [4100, 250, -700], 0.05)).toBe(0);
  });
});
