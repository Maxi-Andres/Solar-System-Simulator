import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { BodyId } from '@sss/tools/types';

import type { EphemerisStore } from '../../core/ephemerisStore.ts';
import {
  FICTION,
  FICTION_COLOR,
  FICTION_LINES,
  FICTION_SHIPS,
  fictionBodyId,
  fictionReadingId,
  fictionTag,
  valueOf,
  type FictionLineRecord,
} from '../../core/fiction.ts';
import { placeFiction } from '../../core/fictionBodies.ts';
import { parkedOf, placeShips, voyageOf } from '../../core/hailMary.ts';
import { renderDemand } from '../../core/renderDemand.ts';
import type { SimClock } from '../../core/time.ts';
import { useViewStore } from '../../state/store.ts';
import { boxOf, labelBoard } from '../labelBoard.ts';
import { useFrame } from '../lazyLayer.tsx';
import { ORBIT_OPACITY } from '../orbitGeometry.ts';
import type { SharedFrame } from '../satellites.ts';
import { kmToUnits } from '../scale.ts';
import { projectToScreen } from '../screenProjection.ts';
import { createFictionObject, createFictionWorldExtras, fictionWorldMaterial, planetshineStrength } from './fictionLooks.ts';
import { CENTRIFUGE_SPIN_RAD_S } from './looks/hailMary.ts';
import { setFictionMakers } from './fictionHooks.ts';

// Before any fictional body exists, so SolarSystem builds each in its look (fictionHooks.ts).
setFictionMakers({
  material: fictionWorldMaterial,
  extras: createFictionWorldExtras,
  object: createFictionObject,
  planetshineStrength,
  pose: (id, jd, out) => {
    // A parked ship (the Blip-A) along its motion, not spinning.
    const parked = parkedOf(id);
    if (parked !== null) {
      if (jd < parked.fromJd) return null;
      parked.pose(jd, out);
      return CRUISE;
    }
    const voyage = voyageOf(id);
    const pose = voyage?.pose(jd, out) ?? null;
    if (voyage === null || pose === null) return null;
    // Spun up from arrival at the model's own rate, a turn every few seconds of simulated time.
    const spinPhase = pose.centrifuge ? (((jd - voyage.arrivalJd) * 86_400 * CENTRIFUGE_SPIN_RAD_S) % (2 * Math.PI)) : 0;
    return pose.centrifuge ? { centrifuge: true, spinPhase } : CRUISE;
  },
});

/**
 * The Fiction layer (core/fiction.ts), its own chunk: loaded the first time the layer is switched
 * on (SolarSystemCanvas.tsx, lazyLayer.tsx), and kept, as the other layers off at first are. Off,
 * it is never fetched, and nothing fictional is a body: the cost is none.
 *
 * Its worlds and ships are bodies like any other, drawn by SolarSystem in their looks and hidden
 * with the layer (floatingOrigin.ts isShown); this makes them bodies, as soon as what they are
 * anchored to is one -- Alpha Centauri's and τ Ceti's stars are placed once the star names are in
 * (App.tsx), which may be after the layer is first on.
 *
 * What is no body it draws itself, in its frame: the Hail Mary's path, a straight line from Earth
 * to τ Ceti; and the Petrova lines, from a star to a planet, with their names. Each from this
 * frame's rebased positions (SolarSystem's snapshot, SharedFrame), the same doubles the bodies are
 * drawn at, written into a two-point line -- nothing allocated, and nothing at all while the layer
 * is off.
 */
export function FictionLayer({
  store,
  clock,
  focus,
  visible,
  showOrbits,
  showLabels,
  sharedFrame,
}: {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  readonly showOrbits: boolean;
  readonly showLabels: boolean;
  readonly sharedFrame: SharedFrame;
}) {
  useEffect(() => {
    const placed = (): boolean =>
      FICTION.every((record) => store.isPropagatedBody(fictionBodyId(record.id))) &&
      FICTION_SHIPS.every((ship) => store.isPropagatedBody(fictionBodyId(ship.id)));
    // Adding a body tells the store's listeners, this one among them: not placed again inside.
    let placing = false;
    const place = (): void => {
      if (placing) return;
      placing = true;
      try {
        if (placeFiction(store).length + placeShips(store).length > 0) renderDemand.request();
      } finally {
        placing = false;
      }
    };
    place();
    if (placed()) return undefined;
    // A ship leaves from where Earth was at its launch: that instant's chunk of Earth's and the
    // Sun's tables is fetched first, which no frame at today's date would ask for.
    let live = true;
    for (const ship of FICTION_SHIPS) {
      if (ship.voyage === undefined) continue;
      const launch = valueOf(ship.voyage.launchJd);
      if (launch === null) continue;
      store
        .whenLoadedAt(launch, [ship.voyage.from, 'sun'])
        .then(() => {
          if (live) place();
        })
        .catch(() => undefined);
    }
    const unsubscribe = store.subscribe(() => {
      place();
      if (placed()) unsubscribe();
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [store]);

  const scene = useThree((state) => state.scene);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  // The lines: the voyage's, then each Petrova line's. Two points each, rewritten each frame.
  const lines = useMemo(() => {
    const make = (colour: THREE.ColorRepresentation, opacity: number, additive: boolean) => {
      const positions = new Float32Array(6);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.LineBasicMaterial({
        color: colour,
        transparent: true,
        opacity,
        depthWrite: false,
        ...(additive ? { blending: THREE.AdditiveBlending } : {}),
      });
      const line = new THREE.Line(geometry, material);
      // Placed in the camera's frame each frame: its bounds mean nothing.
      line.frustumCulled = false;
      line.visible = false;
      line.matrixAutoUpdate = false;
      return { line, positions };
    };
    return {
      // Only a ship with a voyage has a path; a parked one has none drawn.
      voyages: FICTION_SHIPS.filter((ship) => ship.voyage !== undefined).map((ship) => ({
        ship,
        ...make(FICTION_COLOR, ORBIT_OPACITY, false),
      })),
      petrova: FICTION_LINES.map((record) => ({
        record,
        ...make(new THREE.Color().setRGB(record.colour[0], record.colour[1], record.colour[2], THREE.LinearSRGBColorSpace), 0.9, true),
      })),
    };
  }, []);
  useEffect(() => {
    const group = new THREE.Group();
    for (const { line } of [...lines.voyages, ...lines.petrova]) group.add(line);
    scene.add(group);
    return () => {
      scene.remove(group);
      for (const { line } of [...lines.voyages, ...lines.petrova]) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    };
  }, [scene, lines]);

  // The Petrova lines' names: clickable, as a body's is, each to its "about".
  const readAbout = useViewStore((state) => state.readAbout);
  // Made in an effect, not a memo: a memo's DOM is made twice under StrictMode and one copy left
  // behind, never placed.
  const names = useRef<{ readonly layer: HTMLElement; readonly elements: readonly HTMLElement[] } | null>(null);
  useEffect(() => {
    const host = gl.domElement.parentElement?.parentElement ?? gl.domElement.parentElement ?? null;
    if (host === null) return undefined;
    const layer = document.createElement('div');
    Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    const elements = FICTION_LINES.map((record) => {
      const element = nameElement(record);
      element.addEventListener('click', () => readAbout(fictionReadingId(record.id)));
      layer.appendChild(element);
      return element;
    });
    host.appendChild(layer);
    names.current = { layer, elements };
    return () => {
      layer.remove();
      names.current = null;
    };
  }, [gl, readAbout]);

  // The line's ends and its name's point, in the scene and then on the screen.
  const scratch = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      at: new THREE.Vector3(),
      onScreenA: new THREE.Vector3(),
      onScreenB: new THREE.Vector3(),
      onScreenAt: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(() => {
    const snapshot = sharedFrame.snapshot;
    const current = snapshot !== null && snapshot.focus === focus && snapshot.jd === clock.tdbJulianDay;
    if (!visible || !current) {
      if (!visible) {
        for (const { line } of [...lines.voyages, ...lines.petrova]) line.visible = false;
        names.current?.elements.forEach(hide);
      }
      return;
    }
    const sun = snapshot.bodies.get('sun');

    // The voyage: from Earth at launch to the destination at arrival, in the Sun's frame, moved
    // with the Sun's place in this frame.
    for (const { ship, line, positions } of lines.voyages) {
      const voyage = voyageOf(fictionBodyId(ship.id));
      line.visible = showOrbits && voyage !== null && sun !== undefined && snapshot.bodies.has(fictionBodyId(ship.id));
      if (!line.visible || voyage === null || sun === undefined) continue;
      const end = voyage.trip.distanceKm;
      write(positions, 0, sun.positionKm.x + voyage.startKm.x, sun.positionKm.y + voyage.startKm.y, sun.positionKm.z + voyage.startKm.z);
      write(
        positions,
        3,
        sun.positionKm.x + voyage.startKm.x + voyage.direction.x * end,
        sun.positionKm.y + voyage.startKm.y + voyage.direction.y * end,
        sun.positionKm.z + voyage.startKm.z + voyage.direction.z * end,
      );
      line.geometry.attributes['position']!.needsUpdate = true;
    }

    // The Petrova lines: star to planet, each where both are this frame.
    lines.petrova.forEach(({ record, line, positions }, k) => {
      const planet = snapshot.bodies.get(record.planet);
      const starId = record.planet === 'venus' || !store.isPropagatedBody(record.planet) ? 'sun' : (store.body(record.planet).parent ?? 'sun');
      const star = snapshot.bodies.get(starId);
      line.visible = planet !== undefined && star !== undefined;
      const element = names.current?.elements[k];
      if (planet === undefined || star === undefined) {
        if (element !== undefined) hide(element);
        return;
      }
      write(positions, 0, star.positionKm.x, star.positionKm.y, star.positionKm.z);
      write(positions, 3, planet.positionKm.x, planet.positionKm.y, planet.positionKm.z);
      line.geometry.attributes['position']!.needsUpdate = true;
      if (element === undefined) return;
      if (!showLabels) {
        hide(element);
        return;
      }
      // Named partway out from the star, where the line is clear of both ends -- when it is long
      // enough on screen to be a line at all.
      scratch.a.set(kmToUnits(star.positionKm.x), kmToUnits(star.positionKm.y), kmToUnits(star.positionKm.z));
      scratch.b.set(kmToUnits(planet.positionKm.x), kmToUnits(planet.positionKm.y), kmToUnits(planet.positionKm.z));
      scratch.at.copy(scratch.a).lerp(scratch.b, 0.55);
      const { onScreenA, onScreenB, onScreenAt } = scratch;
      const onA = projectToScreen(scratch.a, camera, onScreenA);
      const onB = projectToScreen(scratch.b, camera, onScreenB);
      const span = Math.hypot((onScreenA.x - onScreenB.x) * size.width, (onScreenA.y - onScreenB.y) * size.height) / 2;
      if (
        !onA ||
        !onB ||
        span < LINE_NAMED_PX ||
        !projectToScreen(scratch.at, camera, onScreenAt) ||
        Math.abs(onScreenAt.x) > 1 ||
        Math.abs(onScreenAt.y) > 1
      ) {
        hide(element);
        return;
      }
      const x = (onScreenAt.x * 0.5 + 0.5) * size.width;
      const y = (-onScreenAt.y * 0.5 + 0.5) * size.height;
      element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      let box = boxOf(element);
      if (box.width === 0 && element.style.display === 'none') {
        element.style.display = 'block';
        box = boxOf(element);
      }
      // Posted to the labels' one declutter, which shows it if it wins (labelBoard.ts).
      labelBoard.posted.push({
        key: `fiction-line-${record.id}`,
        element,
        x,
        y,
        offset: -box.width / 2,
        dy: 0,
        width: box.width,
        height: box.height,
        rank: 1,
        importance: 0,
        marked: false,
      });
    });
  });

  return null;
}

const CRUISE = { centrifuge: false, spinPhase: 0 } as const;

/** How long a Petrova line must be on screen to carry its name, px. */
const LINE_NAMED_PX = 120;

/** A point into a line's two, in the camera-relative scene units the bodies are drawn in. */
function write(positions: Float32Array, at: number, xKm: number, yKm: number, zKm: number): void {
  positions[at] = kmToUnits(xKm);
  positions[at + 1] = kmToUnits(yKm);
  positions[at + 2] = kmToUnits(zKm);
}

function hide(element: HTMLElement): void {
  if (element.style.display !== 'none') element.style.display = 'none';
}

/** A line's name as a body's label is: its name, then the FICTION tag. Clickable, to its about. */
function nameElement(record: FictionLineRecord): HTMLElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'tracks-scene';
  Object.assign(element.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    display: 'none',
    background: 'transparent',
    border: 'none',
    padding: '0.15rem 0.2rem',
    margin: '0',
    color: '#c08080',
    fontFamily: 'inherit',
    fontSize: '0.66rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    pointerEvents: 'auto',
    textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
  } satisfies Partial<CSSStyleDeclaration>);
  element.textContent = record.name;
  const tag = document.createElement('span');
  tag.textContent = fictionTag(record);
  Object.assign(tag.style, { marginLeft: '0.45em', color: FICTION_COLOR, fontSize: '0.56rem', letterSpacing: '0.14em' });
  element.appendChild(tag);
  return element;
}
