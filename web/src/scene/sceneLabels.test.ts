import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { labelBoard } from './labelBoard.ts';
import { SceneLabels } from './sceneLabels.ts';

/** Every read and write of an element's inline style, by property. */
interface StyleLog {
  reads: Map<string, number>;
  writes: Map<string, number>;
}

/** Just enough of an element: a style that logs, a box only while displayed. */
function fakeElement(log: StyleLog) {
  const values: Record<string, string> = {};
  const style = new Proxy(values, {
    get(target, key: string) {
      log.reads.set(key, (log.reads.get(key) ?? 0) + 1);
      return target[key] ?? '';
    },
    set(target, key: string, value: string) {
      log.writes.set(key, (log.writes.get(key) ?? 0) + 1);
      target[key] = value;
      return true;
    },
  });
  return {
    style,
    values,
    textContent: '' as string | null,
    className: '',
    appendChild: () => undefined,
    remove: () => undefined,
    get offsetWidth() {
      return values['display'] === 'none' ? 0 : 40;
    },
    get offsetHeight() {
      return values['display'] === 'none' ? 0 : 10;
    },
  };
}

type FakeElement = ReturnType<typeof fakeElement>;

let log: StyleLog;
let made: FakeElement[];

beforeEach(() => {
  log = { reads: new Map(), writes: new Map() };
  made = [];
  (globalThis as { document?: unknown }).document = {
    createElement: () => {
      const element = fakeElement(log);
      made.push(element);
      return element;
    },
  };
  labelBoard.posted = [];
});

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
  labelBoard.posted = [];
});

function labels(names: string[]): SceneLabels {
  const host = { appendChild: () => undefined };
  const canvas = { parentElement: { parentElement: host } } as unknown as HTMLCanvasElement;
  const result = new SceneLabels(canvas, names, 'test');
  // The first element made is the names' layer.
  made.shift();
  log.reads.clear();
  log.writes.clear();
  return result;
}

const camera = new THREE.PerspectiveCamera(50, 2, 0.1, 1000);
camera.updateMatrixWorld();
const size = { width: 200, height: 100 };
const ahead = new THREE.Vector3(0, 0, -10);

const total = (counts: Map<string, number>) => [...counts.values()].reduce((a, b) => a + b, 0);

describe('names of things that are not bodies', () => {
  it('posts a name where its point is, measured once, and writes nothing again while nothing changes', () => {
    const names = labels(['Stream']);
    expect(names.place(0, ahead, camera, size, 0.8)).toBe(true);
    // Never measured, so shown to be measured.
    expect(made[0]!.values['display']).toBe('block');
    expect(made[0]!.values['transform']).toBe('translate(100px, 50px) translate(-50%, -50%)');
    expect(made[0]!.values['opacity']).toBe('0.8');
    expect(labelBoard.posted).toHaveLength(1);
    expect(labelBoard.posted[0]).toMatchObject({ key: 'test-0', x: 100, y: 50, width: 40, height: 10, offset: -20 });

    labelBoard.posted = [];
    log.writes.clear();
    names.place(0, ahead, camera, size, 0.8);
    expect(total(log.writes)).toBe(0);
    expect(labelBoard.posted).toHaveLength(1);
  });

  it('leaves a name the declutter pass hid hidden: shown by the pass if it wins, not here', () => {
    const names = labels(['Stream']);
    names.place(0, ahead, camera, size, 0.8);
    // The declutter pass (LabelProjector) hides it: it lost.
    made[0]!.values['display'] = 'none';
    log.writes.clear();
    labelBoard.posted = [];
    names.place(0, ahead, camera, size, 0.8);
    expect(log.writes.get('display') ?? 0).toBe(0);
    expect(made[0]!.values['display']).toBe('none');
    // Still posted with the box it was measured at.
    expect(labelBoard.posted[0]).toMatchObject({ width: 40, height: 10 });
  });

  it('writes the place and the opacity each only when it changes', () => {
    const names = labels(['Stream']);
    names.place(0, ahead, camera, size, 0.8);
    log.writes.clear();
    names.place(0, ahead, camera, size, 0.5);
    expect([log.writes.get('transform') ?? 0, log.writes.get('opacity') ?? 0]).toEqual([0, 1]);
    names.place(0, new THREE.Vector3(1, 0, -10), camera, size, 0.5);
    expect([log.writes.get('transform') ?? 0, log.writes.get('opacity') ?? 0]).toEqual([1, 1]);
    // Past full, full: the same opacity.
    names.place(0, new THREE.Vector3(1, 0, -10), camera, size, 1);
    names.place(0, new THREE.Vector3(1, 0, -10), camera, size, 3);
    expect(log.writes.get('opacity')).toBe(2);
  });

  it('hides a name off screen, behind the camera or faded, and then asks nothing of it', () => {
    const names = labels(['A', 'B', 'C']);
    for (let i = 0; i < 3; i += 1) names.place(i, ahead, camera, size, 1);
    labelBoard.posted = [];
    expect(names.place(0, new THREE.Vector3(0, 0, 10), camera, size, 1)).toBe(false);
    expect(names.place(1, new THREE.Vector3(100, 0, -10), camera, size, 1)).toBe(false);
    expect(names.place(2, ahead, camera, size, 0)).toBe(false);
    expect(made.map((element) => element.values['display'])).toEqual(['none', 'none', 'none']);
    expect(labelBoard.posted).toHaveLength(0);
    log.reads.clear();
    log.writes.clear();
    names.hideAll();
    names.hide(1);
    expect([total(log.reads), total(log.writes)]).toEqual([0, 0]);
  });

  it('hides every name of a layer never placed without a look at one', () => {
    const names = labels(['A', 'B', 'C', 'D']);
    names.hideAll();
    expect([total(log.reads), total(log.writes)]).toEqual([0, 0]);
  });
});
