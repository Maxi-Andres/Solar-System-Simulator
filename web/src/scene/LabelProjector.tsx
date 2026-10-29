import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, type RefObject } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { bodiesToResolve, isShown } from './floatingOrigin.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { rebaseVisibleFrame, satelliteVisibility, type SharedFrame } from './satellites.ts';
import { ALPHA_CEN_SYSTEM, alphaCenMember } from '../core/alphaCenBodies.ts';
import { isCatalogueStar } from '../core/starBodies.ts';
import { angularRadiusPixels, kmToUnits } from './scale.ts';
import { projectToScreen } from './screenProjection.ts';

/** Scratch for the frame loop, which must not allocate. */
const scratch = new THREE.Vector3();

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
  /** The scene's snapshot of this frame, taken rather than worked out again. */
  readonly sharedFrame: SharedFrame;
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
 * Label precedence: the Sun, planets and dwarf planets first, then moons and asteroids,
 * then spacecraft and Earth satellites. Depth only decides between bodies of the same rank.
 */
/** Alpha Centauri A and B are named as a pair when their markers are this close, pixels. */
const PAIR_MERGE_PX = 14;

/** A system's names fold into one when its extent is under this many pixels. */
const SYSTEM_FOLD_PX = 24;
/** Or, with the focus elsewhere, when the camera is this many extents from it. */
const SYSTEM_OUTSIDE_EXTENTS = 3;
/** The Solar System's extent for that, km: 50 AU, the Kuiper belt's edge. */
const SOLAR_SYSTEM_EXTENT_KM = 50 * 149_597_870.7;
/** Alpha Centauri's: Proxima's distance from the pair, 13,000 AU. */
const ALPHA_CEN_EXTENT_KM = 13_000 * 149_597_870.7;

export function labelRank(kind: string, parent: BodyId | null): number {
  if (kind === 'spacecraft' || kind === 'satellite') {
    return 2;
  }
  return parent === null && kind !== 'asteroid' && kind !== 'comet' ? 0 : 1;
}

export function LabelProjector({
  store,
  clock,
  focus,
  visible,
  visibleKinds,
  hiddenMarkers,
  sharedFrame,
  elements,
}: LabelProjectorProps) {
  const { camera, size } = useThree();
  // Each label's measured width, kept once it has been on screen. Text does not change.
  const widths = useMemo(() => new Map<BodyId, number>(), []);
  // The labels shown last frame, which keep their places. See `declutterLabels`.
  const held = useMemo(() => new Set<BodyId>(), []);
  // This frame's, kept between frames only to be cleared and refilled.
  const shown = useMemo(() => new Set<BodyId>(), []);
  // Re-derived when a planet's small moons arrive, as the scene's is.
  const version = useStoreVersion(store);
  const wanted = useMemo(
    () => (void version, bodiesToResolve(store, visibleKinds, focus)),
    [store, visibleKinds, focus, version],
  );
  // The star systems the names fold into from afar: see foldSystems below.
  const systems = useMemo(() => {
    void version;
    const member = (id: BodyId | null) => (id === null ? null : alphaCenMember(id));
    const a = store.bodies.find((body) => member(body.id) === 'A');
    const b = store.bodies.find((body) => member(body.id) === 'B');
    const alphaCen = new Set<BodyId>();
    const solar = new Set<BodyId>();
    for (const body of store.bodies) {
      if (member(body.id) !== null || member(body.parent) !== null) {
        alphaCen.add(body.id);
      } else if (!isCatalogueStar(body)) {
        solar.add(body.id);
      }
    }
    return { a: a?.id ?? null, b: b?.id ?? null, bName: b?.name ?? '', alphaCen, solar };
  }, [store, version]);
  // The labels showing another text than their own name this frame, and which.
  const altShown = useMemo(() => new Map<BodyId, string>(), []);

  useFrame(() => {
    const map = elements.current;
    if (map === null) {
      return;
    }

    // Taken whether or not it is used, so it is never left over for a later frame.
    const shared = sharedFrame.snapshot;
    sharedFrame.snapshot = null;

    if (!visible) {
      for (const element of map.values()) {
        hide(element);
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
    // The scene's, when it ran this frame for this focus and instant; see SharedFrame.
    // Otherwise worked out here, exactly as the scene would have.
    const snapshot =
      shared !== null && shared.focus === focus && shared.jd === jd
        ? shared
        : rebaseVisibleFrame(store, focus, jd, wanted, camera.position, size.height, fov);

    const projected: LabelCandidate[] = [];
    const unmarked = new Set<BodyId>();

    for (const body of store.bodies) {
      // A kind that is switched off has nothing on screen to be labelled.
      if (!visibleKinds.has(body.kind) || !isShown(body, visibleKinds)) {
        continue;
      }

      const rebased = snapshot.bodies.get(body.id);
      if (rebased === undefined) {
        continue;
      }

      // Its marker is hidden behind another's: a name with nothing beside it would be
      // naming nothing. See markerDeclutter.ts. Except the bodies a system's name goes on
      // (the Sun, Alpha Centauri A) and A's partner: they are projected all the same, for
      // the folding below to place a system's name and see the pair meet, and dropped
      // after it unless they carry one.
      const markerHidden = hiddenMarkers.has(body.id);
      if (markerHidden && body.id !== 'sun' && body.id !== systems.a && body.id !== systems.b) {
        continue;
      }
      if (markerHidden) {
        unmarked.add(body.id);
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
      // Behind the camera, read off its depth: see screenProjection.ts.
      if (!projectToScreen(scratch, camera, scratch)) {
        continue;
      }

      // Offset the label past the body's own disc so it never overlaps the sphere -- the
      // disc that is drawn. A body drawn as a marker only (`shapeDrawn: false`: a comet,
      // a belt asteroid, Apophis) has none, and offsetting by the size it would have put
      // its name hundreds of pixels from its marker once the camera framed it: framing
      // stands eight radii off, where a radius is an eighth of the view.
      const pixelRadius =
        body.shapeDrawn === false
          ? 0
          : angularRadiusPixels(body.radiusEquatorialKm, distanceUnits * 1000, size.height, fov);

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

    // Systems seen from afar, named as systems. From light years out the Solar System is a
    // point, and one of its bodies' names -- Haumea, whichever won the spot -- stood for it;
    // so did Rigil Kentaurus for Alpha Centauri. Once a system's extent is a few pixels its
    // names fold into one, on the body it centres on: "Solar System" on the Sun, "Alpha
    // Centauri" on its A. Nearer, Alpha Centauri opens into Proxima and the pair, and the
    // pair -- A and B, 11 to 36 AU apart -- stays "Rigil Kentaurus + Toliman" until its two
    // markers part. Nearer still, every star is its own name.
    const alt = new Map<BodyId, string>();
    const fold = (members: ReadonlySet<BodyId>, keep: BodyId, extentKm: number, name: string): boolean => {
      const kept = projected.find((entry) => entry.id === keep);
      if (kept === undefined) {
        return false;
      }
      // Folded when it is a few pixels across, from anywhere; and when the focus is in
      // another system and the camera stands outside this one, since then it is a place
      // being looked across at, not one being visited. From the Sun, Proxima is two
      // degrees from Rigil Kentaurus: far apart on screen, and still one place, there.
      const extentPx = angularRadiusPixels(extentKm, kept.depth * 1000, size.height, fov);
      const visiting = members.has(focus);
      const outside = kept.depth * 1000 > SYSTEM_OUTSIDE_EXTENTS * extentKm;
      if (extentPx >= SYSTEM_FOLD_PX && (visiting || !outside)) {
        return false;
      }
      for (let i = projected.length - 1; i >= 0; i -= 1) {
        if (members.has(projected[i]!.id) && projected[i]!.id !== keep) {
          projected.splice(i, 1);
        }
      }
      alt.set(keep, name);
      return true;
    };
    fold(systems.solar, 'sun', SOLAR_SYSTEM_EXTENT_KM, 'Solar System');
    if (systems.a !== null && !fold(systems.alphaCen, systems.a, ALPHA_CEN_EXTENT_KM, ALPHA_CEN_SYSTEM) && systems.b !== null) {
      const a = projected.find((entry) => entry.id === systems.a);
      const b = projected.find((entry) => entry.id === systems.b);
      if (a !== undefined && b !== undefined && Math.hypot(a.x - b.x, a.y - b.y) < PAIR_MERGE_PX) {
        projected.splice(projected.indexOf(b), 1);
        alt.set(a.id, `${store.body(a.id).name} + ${systems.bName}`);
      }
    }
    // The representatives whose own marker is hidden, and which carry no system's name.
    for (let i = projected.length - 1; i >= 0; i -= 1) {
      if (unmarked.has(projected[i]!.id) && !alt.has(projected[i]!.id)) {
        projected.splice(i, 1);
      }
    }

    // Written into the labels, and their widths taken for the declutter: estimated the
    // frame the text changes, measured from the next.
    for (const [id, element] of map) {
      const text = alt.get(id) ?? null;
      if ((altShown.get(id) ?? null) === text) {
        continue;
      }
      setAltText(element, text);
      widths.delete(id);
      if (text === null) {
        altShown.delete(id);
      } else {
        altShown.set(id, text);
      }
    }
    for (let i = 0; i < projected.length; i += 1) {
      const text = alt.get(projected[i]!.id);
      if (text !== undefined && !widths.has(projected[i]!.id)) {
        projected[i] = { ...projected[i]!, width: text.length * LABEL_CHAR_PX };
      }
    }

    // Declutter: nearest body wins a contested spot. Sorting by depth means the
    // thing you are looking at keeps its name when a distant body drifts behind it.
    //
    // Except that a moon never takes a spot from a planet. A moon on the near side of
    // Jupiter is closer to the camera than Jupiter is, and by depth alone it would
    // take the name of the planet it is there to be seen around. And a spacecraft never
    // takes one from either: Juice passing Earth is there to be seen passing Earth.
    // The focused body outranks them all. See `declutterLabels`.
    shown.clear();

    for (const candidate of declutterLabels(projected, focus, held)) {
      shown.add(candidate.id);

      const element = map.get(candidate.id);
      if (element == null) {
        continue;
      }
      if (element.style.display !== 'block') {
        element.style.display = 'block';
      }
      element.style.transform = `translate(${candidate.x + candidate.offset}px, ${
        candidate.y
      }px) translateY(-50%)`;
    }

    for (const [id, element] of map) {
      if (!shown.has(id)) {
        hide(element);
      }
    }

    held.clear();
    for (const id of shown) {
      held.add(id);
    }
  });

  return null;
}

/**
 * Shows a label's alternative text in place of its name, or its name again (null). The
 * label holds both (App.tsx BodyLabel), so React's own text is never written over.
 */
function setAltText(element: HTMLElement | null, text: string | null): void {
  if (element === null) {
    return;
  }
  const name = element.querySelector<HTMLElement>('[data-label-name]');
  const alt = element.querySelector<HTMLElement>('[data-label-alt]');
  if (name === null || alt === null) {
    return;
  }
  alt.textContent = text ?? '';
  alt.style.display = text === null ? 'none' : 'inline';
  name.style.display = text === null ? 'inline' : 'none';
}

/**
 * Hides a label that is not already hidden.
 *
 * Most of the five hundred are hidden on any given frame, and were each told so again
 * every frame. Reading an inline style back is a property lookup; writing one, even the
 * same value, is a trip through the style system that no browser promises to skip.
 */
function hide(element: HTMLElement | null): void {
  if (element !== null && element.style.display !== 'none') {
    element.style.display = 'none';
  }
}
