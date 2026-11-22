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
import { planetarySystemOf, systemExtentKm } from '../core/planetarySystems.ts';
import { isCatalogueStar } from '../core/starBodies.ts';
import { BLACK_HOLE_SYSTEMS, blackHoleSystemOf } from '../core/blackHoles.ts';
import { galaxyLuminosity, galaxyOf } from '../core/localGroup.ts';
import { homeNames } from './homeName.ts';
import { labelBoard, labelsShown } from './labelBoard.ts';
import { foldedShown } from './markFolding.ts';
import { bodyFoldStrength, focusLineage, updateMarkHostsFromScene } from './markHosts.ts';
import { angularRadiusPixels, kmToUnits, unitsToKm } from './scale.ts';
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

/** The ids the names of the label board (labelBoard.ts) go by here, apart from any body's. */
const BOARD_PREFIX = 'board:';

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
  /** Within a rank, the more important first: a galaxy's luminosity. 0 where none is given. */
  readonly importance?: number;
  /** The text's box: its height, and its centre's offset below the point, pixels. */
  readonly height?: number;
  readonly dy?: number;
  /** Whether a mark is at the point: false for a name on a model, which has none. */
  readonly marked?: boolean;
}

/**
 * Which labels to show: the ones that fit, by precedence.
 *
 * The focused body first, always -- it is the one you asked about, and everything that
 * would cover its name yields to it. Then by rank (see `labelRank`); within a rank by
 * importance -- a galaxy's luminosity; the Milky Way's name, once it is named as one thing,
 * above all, since every name near it is of something in it. The names on its model, its
 * centre's and its arms', come after the bodies'. Then a label already on screen (`held`) keeps its place
 * against one that is not, and only then does depth decide.
 *
 * **One pass for every name.** The bodies' names and the names on the Milky Way's model
 * (its centre's, its arms'; see `labelBoard`) are decluttered together, so a name of one
 * never lies over a name of the other: "Milky Way" and "Large Magellanic Cloud" did.
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
    if ((a.importance ?? 0) !== (b.importance ?? 0)) {
      return (a.importance ?? 0) > (b.importance ?? 0) ? -1 : 1;
    }
    if (held.has(a.id) !== held.has(b.id)) {
      return held.has(a.id) ? -1 : 1;
    }
    return a.depth - b.depth;
  });

  const placed: LabelCandidate[] = [];
  const half = (label: LabelCandidate) => (label.height ?? LABEL_HEIGHT_PX) / 2;
  const middle = (label: LabelCandidate) => label.y + (label.dy ?? 0);
  // The placed labels by the grid cells they reach (see GRID_CELL_PX), so a candidate is
  // tested against its neighbours rather than every label placed before it. Each placed label
  // is filed under the cells of the rectangle holding its box and its marker's widest reach;
  // a candidate looks in the cells of the rectangle holding its own padded box and marker
  // reach. Any two that collide share a point of those, hence a cell, so the same labels win
  // as when each was tested against all. One with a number the grid cannot file -- not
  // finite, or absurdly far off screen -- is tested against all, both ways.
  const count = ordered.length;
  // Each placed label's numbers, worked out once rather than at every test against it.
  const placedX = new Float64Array(count);
  const placedY = new Float64Array(count);
  const placedLeft = new Float64Array(count);
  const placedRight = new Float64Array(count);
  const placedTop = new Float64Array(count);
  const placedBottom = new Float64Array(count);
  const placedMarked = new Uint8Array(count);
  const seen = new Int32Array(count);
  const grid = new Map<number, number[]>();
  const unfiled: number[] = [];
  let pass = 0;
  for (const candidate of ordered) {
    const holding = held.has(candidate.id);
    const padding = holding ? 0 : LABEL_PADDING_PX;
    const markerGap = holding ? DECLUTTER_PX * HELD_MARKER_FRACTION : DECLUTTER_PX;
    const x = candidate.x;
    const y = candidate.y;
    const marked = candidate.marked !== false;
    const boxLeft = x + candidate.offset;
    const boxRight = x + candidate.offset + candidate.width;
    const boxTop = middle(candidate) - half(candidate);
    const boxBottom = middle(candidate) + half(candidate);
    const left = x + candidate.offset - padding;
    const right = x + candidate.offset + candidate.width + padding;
    const top = middle(candidate) - half(candidate) - padding;
    const bottom = middle(candidate) + half(candidate) + padding;
    /** The test of every pair, as it always was. */
    const touches = (index: number): boolean =>
      (marked &&
        placedMarked[index] === 1 &&
        Math.abs(placedX[index]! - x) < markerGap &&
        Math.abs(placedY[index]! - y) < markerGap) ||
      (left < placedRight[index]! && placedLeft[index]! < right && top < placedBottom[index]! && placedTop[index]! < bottom);

    let collides = false;
    const reachLeft = Math.min(left, right, x - markerGap);
    const reachRight = Math.max(left, right, x + markerGap);
    const reachTop = Math.min(top, bottom, y - markerGap);
    const reachBottom = Math.max(top, bottom, y + markerGap);
    if (fileable(reachLeft, reachRight, reachTop, reachBottom)) {
      pass += 1;
      for (let u = 0; u < unfiled.length && !collides; u += 1) {
        collides = touches(unfiled[u]!);
      }
      const columnTo = Math.floor(reachRight / GRID_CELL_PX);
      const rowFrom = Math.floor(reachTop / GRID_CELL_PX);
      const rowTo = Math.floor(reachBottom / GRID_CELL_PX);
      for (let column = Math.floor(reachLeft / GRID_CELL_PX); column <= columnTo && !collides; column += 1) {
        for (let row = rowFrom; row <= rowTo && !collides; row += 1) {
          const cell = grid.get(column * GRID_ROW + row);
          if (cell === undefined) continue;
          for (let c = 0; c < cell.length; c += 1) {
            const index = cell[c]!;
            if (seen[index] !== pass) {
              seen[index] = pass;
              if (touches(index)) {
                collides = true;
                break;
              }
            }
          }
        }
      }
    } else {
      for (let index = 0; index < placed.length && !collides; index += 1) {
        collides = touches(index);
      }
    }
    if (collides) {
      continue;
    }
    const index = placed.length;
    placed.push(candidate);
    placedX[index] = x;
    placedY[index] = y;
    placedLeft[index] = boxLeft;
    placedRight[index] = boxRight;
    placedTop[index] = boxTop;
    placedBottom[index] = boxBottom;
    placedMarked[index] = marked ? 1 : 0;
    const fileLeft = Math.min(boxLeft, boxRight, x - DECLUTTER_PX);
    const fileRight = Math.max(boxLeft, boxRight, x + DECLUTTER_PX);
    const fileTop = Math.min(boxTop, boxBottom, y - DECLUTTER_PX);
    const fileBottom = Math.max(boxTop, boxBottom, y + DECLUTTER_PX);
    if (!fileable(fileLeft, fileRight, fileTop, fileBottom)) {
      unfiled.push(index);
      continue;
    }
    const columnTo = Math.floor(fileRight / GRID_CELL_PX);
    const rowFrom = Math.floor(fileTop / GRID_CELL_PX);
    const rowTo = Math.floor(fileBottom / GRID_CELL_PX);
    for (let column = Math.floor(fileLeft / GRID_CELL_PX); column <= columnTo; column += 1) {
      for (let row = rowFrom; row <= rowTo; row += 1) {
        const key = column * GRID_ROW + row;
        const cell = grid.get(key);
        if (cell === undefined) {
          grid.set(key, [index]);
        } else {
          cell.push(index);
        }
      }
    }
  }
  return placed;
}

/** Side of declutterLabels' grid cells, pixels: a marker's reach and more, most of a name. */
const GRID_CELL_PX = 96;
/**
 * Beyond this many pixels from the screen's corner a label is not filed in the grid: past
 * it a cell's index loses its integer steps long before the doubles run out.
 */
const GRID_LIMIT_PX = 1e7;
/** Cells per row of keys: more than twice GRID_LIMIT_PX / GRID_CELL_PX, so keys never meet. */
const GRID_ROW = 1 << 20;

/** True when a box can be filed in the grid: every side finite and within GRID_LIMIT_PX. */
function fileable(a: number, b: number, c: number, d: number): boolean {
  return (
    Math.abs(a) <= GRID_LIMIT_PX &&
    Math.abs(b) <= GRID_LIMIT_PX &&
    Math.abs(c) <= GRID_LIMIT_PX &&
    Math.abs(d) <= GRID_LIMIT_PX
  );
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

/** Each galaxy's luminosity, worked out once rather than per label per frame. */
const luminosities = new WeakMap<object, number>();

/** A body's importance among its rank: a galaxy's luminosity, solar V; any other's none. */
function labelImportance(id: BodyId): number {
  const galaxy = galaxyOf(id);
  if (galaxy === null) {
    return 0;
  }
  let luminosity = luminosities.get(galaxy);
  if (luminosity === undefined) {
    luminosity = galaxyLuminosity(galaxy) ?? 0;
    luminosities.set(galaxy, luminosity);
  }
  return luminosity;
}

/** Each black hole's system as the set its names fold from (blackHoles.ts); fixed data. */
const BLACK_HOLE_MEMBERS: readonly ReadonlySet<BodyId>[] = BLACK_HOLE_SYSTEMS.map(
  (system) => new Set([system.id, system.companion]),
);

/**
 * Where each label's transform last put it, so a label that has not moved is not written
 * again: a style write is a trip through the style system even with the same value.
 */
const placedAt = new WeakMap<HTMLElement, { x: number; y: number }>();

/**
 * The body labels this frame loop has shown and not hidden since, with their ids: the only
 * ones it can have to hide or measure. Kept here rather than read back off each element:
 * `element.style.display` is a trip into the style declaration, and asked of every one of a
 * thousand labels twice a frame it was most of a millisecond at the Milky Way's view. Only
 * this loop shows a body label (App.tsx starts each hidden), so the set is the truth -- but
 * for labels a previous mount of this component left shown, which its first frame sweeps.
 */
interface LabelDisplay {
  readonly shown: Map<HTMLElement, BodyId>;
  swept: boolean;
}

export function labelRank(kind: string, parent: BodyId | null): number {
  // A region (regions.ts) is a place, not a body: never ahead of one in the declutter. Nor a
  // star or Messier object marked (deepSky.ts): a catalogue's mark.
  if (kind === 'spacecraft' || kind === 'satellite' || kind === 'region' || kind === 'deep-sky') {
    return 2;
  }
  // A nebula (nebulae.ts) never wins a place over a planet or the Sun.
  if (kind === 'nebula') {
    return 1;
  }
  return parent === null && kind !== 'asteroid' && kind !== 'comet' ? 0 : 1;
}

/**
 * Kinds of body that are places out in the galaxy, not of the Solar System: a pulsar gone to,
 * a globular cluster, a supernova remnant -- or past it, another galaxy. Their names never fold into the Solar System's --
 * that would hide a remnant's name, its only way to be clicked, whenever the Sun's planets
 * are small on screen.
 */
const OUT_IN_THE_GALAXY: ReadonlySet<string> = new Set([
  'neutron-star',
  'globular-cluster',
  'supernova-remnant',
  'nebula',
  'deep-sky',
  'galaxy',
  'structure',
]);

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
    // The planetary systems': each folds onto its star, by system key.
    const planetary = new Map<string, { host: BodyId | null; members: Set<BodyId>; extentKm: number; name: string }>();
    for (const body of store.bodies) {
      const owner = planetarySystemOf(body.id);
      if (member(body.id) !== null || member(body.parent) !== null) {
        alphaCen.add(body.id);
      } else if (owner !== null) {
        let entry = planetary.get(owner.key);
        if (entry === undefined) {
          entry = { host: null, members: new Set(), extentKm: systemExtentKm(owner), name: owner.name };
          planetary.set(owner.key, entry);
        }
        entry.members.add(body.id);
        if (isCatalogueStar(body)) {
          entry.host = body.id;
        }
      } else if (!isCatalogueStar(body) && blackHoleSystemOf(body.id) === null && !OUT_IN_THE_GALAXY.has(body.kind)) {
        solar.add(body.id);
      }
    }
    const hosts = new Set<BodyId>();
    for (const entry of planetary.values()) {
      if (entry.host !== null) {
        hosts.add(entry.host);
      }
    }
    return { a: a?.id ?? null, b: b?.id ?? null, bName: b?.name ?? '', alphaCen, solar, planetary, hosts };
  }, [store, version]);
  // The labels showing another text than their own name this frame, and which.
  const altShown = useMemo(() => new Map<BodyId, string>(), []);
  // The body labels shown, by element; see LabelDisplay.
  const display = useMemo<LabelDisplay>(() => ({ shown: new Map(), swept: false }), []);
  // This frame's shown elements, kept between frames only to be cleared and refilled.
  const shownElements = useMemo(() => new Set<HTMLElement>(), []);

  useFrame(() => {
    const map = elements.current;
    if (map === null) {
      return;
    }

    // Taken whether or not it is used, so it is never left over for a later frame.
    const shared = sharedFrame.snapshot;
    sharedFrame.snapshot = null;

    // The names others placed this frame, for the one declutter pass below (labelBoard.ts).
    const posted = labelBoard.posted;
    labelBoard.posted = [];

    if (!display.swept) {
      // Once: whatever an earlier mount left shown is hidden, so the set starts true.
      display.swept = true;
      for (const element of map.values()) {
        hide(element);
      }
    }

    if (!visible) {
      labelsShown.active = false;
      for (const element of display.shown.keys()) {
        hideShown(element);
      }
      display.shown.clear();
      for (const label of posted) {
        hide(label.element);
      }
      held.clear();
      return;
    }

    // Read every width before anything is written, so the layout is computed once.
    for (const [element, id] of display.shown) {
      if (!widths.has(id)) {
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
    const sunKm = snapshot.bodies.get('sun')?.positionKm;
    updateMarkHostsFromScene(camera.position, sunKm, size.height, fov, focus);
    const lineage = focusLineage(store, focus);

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
      // (the Sun, Alpha Centauri A, a planetary system's star) and A's partner: they are
      // projected all the same, for the folding below to place a system's name and see the
      // pair meet, and dropped after it unless they carry one.
      const markerHidden = hiddenMarkers.has(body.id);
      if (
        markerHidden &&
        body.id !== 'sun' &&
        body.id !== systems.a &&
        body.id !== systems.b &&
        !systems.hosts.has(body.id)
      ) {
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

      // And its mark's fold into its host's (markFolding.ts): the name goes with the mark,
      // with hysteresis, so one at the edge does not come and go.
      if (!foldedShown(bodyFoldStrength(body, rebased.positionKm, sunKm, lineage), held.has(body.id))) {
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
        importance: labelImportance(body.id),
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
    // Farther out, the Sun's point is named for the level that is a point from there, or
    // not at all (homeName.ts).
    const sunRebased = snapshot.bodies.get('sun');
    const home =
      sunRebased === undefined
        ? null
        : homeNames(
            unitsToKm(
              scratch
                .set(kmToUnits(sunRebased.positionKm.x), kmToUnits(sunRebased.positionKm.y), kmToUnits(sunRebased.positionKm.z))
                .distanceTo(camera.position),
            ),
            size.height,
            fov,
          );
    const sunEntry = projected.find((entry) => entry.id === 'sun');
    if (sunEntry !== undefined && home !== null) {
      if (home.sun === 'none') {
        projected.splice(projected.indexOf(sunEntry), 1);
      } else if (home.sun !== 'own') {
        alt.set('sun', home.sun);
      }
    }
    // The Milky Way a small thing on screen: what is in it folds into its name, as a planet's
    // into the Solar System's; the other galaxies keep theirs.
    if (home?.galaxyFolded === true) {
      for (let i = projected.length - 1; i >= 0; i -= 1) {
        const kind = store.body(projected[i]!.id).kind;
        if (kind !== 'galaxy' && kind !== 'structure') {
          projected.splice(i, 1);
        }
      }
    }
    // Farther, the Local Group itself a small thing: its galaxies' names fold into its own, and
    // those beyond keep theirs (homeName.ts).
    if (home?.localGroupFolded === true) {
      for (let i = projected.length - 1; i >= 0; i -= 1) {
        const galaxy = galaxyOf(projected[i]!.id);
        if (galaxy !== null && galaxy.volumeIndex === undefined && galaxy.laniakeaIndex === undefined && projected[i]!.id !== focus) {
          projected.splice(i, 1);
        }
      }
    }
    // Farther still, the Local Volume a small thing (G3): its galaxies' names, and the Virgo
    // Cluster's, fold into its own and into the Virgo Cluster's (homeName.ts).
    if (home?.localVolumeFolded === true) {
      for (let i = projected.length - 1; i >= 0; i -= 1) {
        const galaxy = galaxyOf(projected[i]!.id);
        if (galaxy !== null && galaxy.volumeIndex !== undefined && projected[i]!.id !== focus) {
          projected.splice(i, 1);
        }
      }
    }
    // A planetary system folds onto its star when its planets' orbits are a few pixels
    // across: from the Sun, Tau Ceti and not its four candidates.
    for (const entry of systems.planetary.values()) {
      if (entry.host !== null) {
        fold(entry.members, entry.host, entry.extentKm, entry.name);
      }
    }
    // A black hole and the star about it fold onto the black hole likewise (blackHoles.ts).
    BLACK_HOLE_SYSTEMS.forEach((system, index) => {
      fold(BLACK_HOLE_MEMBERS[index]!, system.id, system.extentKm, system.name);
    });
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

    // With the names the Milky Way's model placed, which it shows unless they lose here.
    const boardElements = new Map<string, HTMLElement>();
    for (const label of posted) {
      const id = `${BOARD_PREFIX}${label.key}`;
      boardElements.set(id, label.element);
      projected.push({ ...label, id, depth: 0 });
    }

    for (const candidate of declutterLabels(projected, focus, held)) {
      shown.add(candidate.id);
      if (boardElements.has(candidate.id)) {
        continue;
      }

      const element = map.get(candidate.id);
      if (element == null) {
        continue;
      }
      shownElements.add(element);
      // Placed before it is shown, so it never appears for a frame where it last was.
      const x = candidate.x + candidate.offset;
      const last = placedAt.get(element);
      if (last === undefined || last.x !== x || last.y !== candidate.y) {
        element.style.transform = `translate(${x}px, ${candidate.y}px) translateY(-50%)`;
        if (last === undefined) {
          placedAt.set(element, { x, y: candidate.y });
        } else {
          last.x = x;
          last.y = candidate.y;
        }
      }
      if (!display.shown.has(element)) {
        element.style.display = 'block';
        display.shown.set(element, candidate.id);
      }
    }

    // Only a label shown before can need hiding.
    for (const element of display.shown.keys()) {
      if (!shownElements.has(element)) {
        hideShown(element);
        display.shown.delete(element);
      }
    }
    shownElements.clear();
    for (const [id, element] of boardElements) {
      if (!shown.has(id)) {
        hide(element);
      }
    }

    held.clear();
    for (const id of shown) {
      held.add(id);
    }
    labelsShown.active = true;
    labelsShown.ids = held;
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

/** Hides a body label this loop knows it shows: no need to ask the element. */
function hideShown(element: HTMLElement): void {
  element.style.display = 'none';
}
