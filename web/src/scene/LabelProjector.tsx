import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, type RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { bodiesToResolve } from './floatingOrigin.ts';
import { rebaseVisibleFrame, satelliteVisibility } from './satellites.ts';
import { angularRadiusPixels, kmToUnits } from './scale.ts';

/**
 * Projects each body to screen coordinates and positions its HTML label.
 *
 * The labels are real DOM elements living outside the canvas, which keeps text
 * crisp at any device pixel ratio and lets them be styled and clicked like ordinary
 * UI. This component only moves them: it writes transforms directly in the frame
 * loop, so labels track the scene at 60 fps without React re-rendering anything.
 */

/** Gap between a body's edge and its label, in pixels. */
const LABEL_GAP_PX = 14;

/** Markers closer together than this are decluttered, whatever their labels do. */
const DECLUTTER_PX = 26;

/** Height of a label's box, and the clear space kept around it, in pixels. */
const LABEL_HEIGHT_PX = 16;
const LABEL_PADDING_PX = 4;

/**
 * Width assumed for a label that has never been on screen, per character, in pixels.
 *
 * A hidden label has no width to measure. Guessing generously only costs a label that
 * would have fitted a frame of absence; once it is shown its real width is kept.
 */
const LABEL_CHAR_PX = 9;

/**
 * How close another marker may come to a label already on screen before it goes, as a
 * fraction of `DECLUTTER_PX`. Below one, so that a pair hovering at the threshold does
 * not swap every frame. See `declutterLabels`.
 */
const HELD_MARKER_FRACTION = 0.7;

export interface LabelProjectorProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
  /**
   * Body kinds currently switched on in the layers panel.
   *
   * The labels are DOM, not scene objects, so switching a kind off in the panel hid the
   * spheres and the orbits and left the names floating over empty space. Nothing else
   * knew: the scene walks its own list and never told this one.
   */
  readonly visibleKinds: ReadonlySet<string>;
  /** Bodies whose marker another covered this frame: their names go too. */
  readonly hiddenMarkers: ReadonlySet<BodyId>;
  /** Label elements, keyed by body id, owned by the overlay outside the canvas. */
  readonly elements: RefObject<Map<BodyId, HTMLElement | null>>;
}

/** A label at its anchor, with the box its text will occupy. */
export interface LabelCandidate {
  readonly id: BodyId;
  /** The body's own point on screen, pixels. */
  readonly x: number;
  readonly y: number;
  /** How far right of the point the text starts, pixels. */
  readonly offset: number;
  /** Width of the text, pixels. */
  readonly width: number;
  readonly depth: number;
  readonly rank: number;
}

/**
 * Which labels to show: the ones that fit, by precedence.
 *
 * The focused body first, always -- it is the one you asked about, and everything that
 * would cover its name yields to it. Then by rank (see `labelRank`). Within a rank, a
 * label already on screen (`held`) keeps its place against one that is not, and only
 * then does depth decide.
 *
 * **Why held labels win.** Depth alone flips: two craft a few pixels apart swap places in
 * depth as the camera turns, and with them which name is shown -- every frame, so the
 * names flickered as you dragged. The same goes for the edge of a collision, which a
 * label in motion crosses back and forth. So a newcomer must find clear space, padding
 * included, while a label already there is only displaced by a box actually touching it
 * or a marker well inside its own.
 *
 * Two labels collide when their markers are within `DECLUTTER_PX` of each other, or when
 * the boxes their text occupies overlap. Comparing the markers alone was the old rule, and
 * it let names run into each other: a label is a hundred pixels of text to the right of
 * its point, and two points thirty pixels apart can put "JUPITER" on top of "EUROPA
 * CLIPPER".
 */
export function declutterLabels(
  candidates: readonly LabelCandidate[],
  focus: BodyId,
  held: ReadonlySet<BodyId> = new Set(),
): LabelCandidate[] {
  const ordered = [...candidates].sort((a, b) => {
    if ((a.id === focus) !== (b.id === focus)) {
      return a.id === focus ? -1 : 1;
    }
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    if (held.has(a.id) !== held.has(b.id)) {
      return held.has(a.id) ? -1 : 1;
    }
    return a.depth - b.depth;
  });

  const placed: LabelCandidate[] = [];
  for (const candidate of ordered) {
    const holding = held.has(candidate.id);
    const padding = holding ? 0 : LABEL_PADDING_PX;
    const markerGap = holding ? DECLUTTER_PX * HELD_MARKER_FRACTION : DECLUTTER_PX;
    const left = candidate.x + candidate.offset - padding;
    const right = candidate.x + candidate.offset + candidate.width + padding;
    const top = candidate.y - LABEL_HEIGHT_PX / 2 - padding;
    const bottom = candidate.y + LABEL_HEIGHT_PX / 2 + padding;
    const collides = placed.some((other) => {
      const markersTouch =
        Math.abs(other.x - candidate.x) < markerGap &&
        Math.abs(other.y - candidate.y) < markerGap;
      const otherLeft = other.x + other.offset;
      const boxesTouch =
        left < otherLeft + other.width &&
        otherLeft < right &&
        top < other.y + LABEL_HEIGHT_PX / 2 &&
        other.y - LABEL_HEIGHT_PX / 2 < bottom;
      return markersTouch || boxesTouch;
    });
    if (!collides) {
      placed.push(candidate);
    }
  }
  return placed;
}

/**
 * Label precedence: the Sun, planets and dwarf planets first, then moons, then
 * spacecraft. Depth only decides between bodies of the same rank.
 */
export function labelRank(kind: string, parent: BodyId | null): number {
  if (kind === 'spacecraft') {
    return 2;
  }
  return parent === null ? 0 : 1;
}

export function LabelProjector({
  store,
  clock,
  focus,
  visible,
  visibleKinds,
  hiddenMarkers,
  elements,
}: LabelProjectorProps) {
  const { camera, size } = useThree();
  const scratch = new THREE.Vector3();
  // Each label's measured width, kept once it has been on screen. Text does not change.
  const widths = useMemo(() => new Map<BodyId, number>(), []);
  // The labels shown last frame, which keep their places. See `declutterLabels`.
  const held = useMemo(() => new Set<BodyId>(), []);
  const wanted = useMemo(
    () => bodiesToResolve(store, visibleKinds, focus),
    [store, visibleKinds, focus],
  );

  useFrame(() => {
    const map = elements.current;
    if (map === null) {
      return;
    }

    if (!visible) {
      for (const element of map.values()) {
        if (element !== null) {
          element.style.display = 'none';
        }
      }
      held.clear();
      return;
    }

    // Read every width before anything is written, so the layout is computed once.
    for (const [id, element] of map) {
      if (element !== null && element.style.display === 'block' && !widths.has(id)) {
        const width = element.offsetWidth;
        if (width > 0) {
          widths.set(id, width);
        }
      }
    }

    // The camera has already moved this frame (CameraRig runs first), but its matrices
    // are only brought up to date when the scene renders. Projecting through them as they
    // are put every name one frame behind its marker, which while dragging is a gap that
    // opens and closes: the labels swim. Updated here, they land where the render will.
    camera.updateMatrixWorld();

    const jd = clock.tdbJulianDay;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const snapshot = rebaseVisibleFrame(
      store,
      focus,
      jd,
      wanted,
      camera.position,
      size.height,
      fov,
    );

    const projected: LabelCandidate[] = [];

    for (const body of store.bodies) {
      // A kind that is switched off has nothing on screen to be labelled.
      if (!visibleKinds.has(body.kind)) {
        continue;
      }

      const rebased = snapshot.bodies.get(body.id);
      if (rebased === undefined) {
        continue;
      }

      // Its marker is hidden behind another's: a name with nothing beside it would be
      // naming nothing. See markerDeclutter.ts.
      if (hiddenMarkers.has(body.id)) {
        continue;
      }

      // The same rule the marker follows, so a name never floats where no marker is.
      // Half-way through the marker's fade is where the label goes.
      if (
        body.id !== focus &&
        satelliteVisibility(store, snapshot, body, camera.position, size.height, fov) < 0.5
      ) {
        continue;
      }

      scratch.set(
        kmToUnits(rebased.positionKm.x),
        kmToUnits(rebased.positionKm.y),
        kmToUnits(rebased.positionKm.z),
      );

      const distanceUnits = scratch.distanceTo(camera.position);
      scratch.project(camera);

      // z outside [-1, 1] means behind the camera or past the far plane.
      if (scratch.z < -1 || scratch.z > 1) {
        continue;
      }

      // Offset the label past the body's own disc so it never overlaps the sphere.
      const pixelRadius = angularRadiusPixels(
        body.radiusEquatorialKm,
        distanceUnits * 1000,
        size.height,
        fov,
      );

      projected.push({
        id: body.id,
        x: (scratch.x * 0.5 + 0.5) * size.width,
        y: (-scratch.y * 0.5 + 0.5) * size.height,
        depth: distanceUnits,
        offset: Math.min(pixelRadius, size.height * 0.4) + LABEL_GAP_PX,
        width: widths.get(body.id) ?? body.name.length * LABEL_CHAR_PX,
        rank: labelRank(body.kind, body.parent),
      });
    }

    // Declutter: nearest body wins a contested spot. Sorting by depth means the
    // thing you are looking at keeps its name when a distant body drifts behind it.
    //
    // Except that a moon never takes a spot from a planet. A moon on the near side of
    // Jupiter is closer to the camera than Jupiter is, and by depth alone it would
    // take the name of the planet it is there to be seen around. And a spacecraft never
    // takes one from either: Juice passing Earth is there to be seen passing Earth.
    // The focused body outranks them all. See `declutterLabels`.
    const shown = new Set<BodyId>();

    for (const candidate of declutterLabels(projected, focus, held)) {
      shown.add(candidate.id);

      const element = map.get(candidate.id);
      if (element == null) {
        continue;
      }
      element.style.display = 'block';
      element.style.transform = `translate(${candidate.x + candidate.offset}px, ${
        candidate.y
      }px) translateY(-50%)`;
    }

    for (const [id, element] of map) {
      if (element !== null && !shown.has(id)) {
        element.style.display = 'none';
      }
    }

    held.clear();
    for (const id of shown) {
      held.add(id);
    }
  });

  return null;
}
