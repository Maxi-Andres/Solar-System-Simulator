import type { BodyId, StarCatalog } from '@sss/tools/types';
import { Canvas } from '@react-three/fiber';

import type { BeltSource } from '../core/belt.ts';
import type { CometSource } from '../core/comets.ts';
import type { SatelliteSource } from '../core/satellites.ts';
import type { Stars3dSource } from '../core/stars3d.ts';
import type { ExoplanetArchive } from '../core/exoplanetArchive.ts';
import type { PulsarArchive } from '../core/pulsars.ts';
import type { LazySource } from '../core/satellites.ts';
import { planetFramingKm } from '../core/exoplanets.ts';
import { exoPlanetOf } from '../core/planetarySystems.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import type { LightingMode } from '../state/store.ts';
import { useEffect, useMemo, type RefObject } from 'react';

import { renderDemand } from '../core/renderDemand.ts';

import { AsteroidBelt } from './AsteroidBelt.tsx';
import { BlackHoleLens } from './BlackHoleLens.tsx';
import { CameraRig } from './CameraRig.tsx';
import { CometField } from './Comets.tsx';
import { DistanceRings } from './DistanceRings.tsx';
import { ExoplanetHosts } from './ExoplanetHosts.tsx';
import { Pulsars } from './Pulsars.tsx';
import { HorizonScale } from './HorizonScale.tsx';
import { MilkyWay } from './MilkyWay.tsx';
import { NuclearCluster } from './NuclearCluster.tsx';
import { AlphaCentauriOrbits } from './AlphaCentauriOrbits.tsx';
import { SiriusOrbits } from './SiriusOrbits.tsx';
import { SatelliteSwarm } from './SatelliteSwarm.tsx';
import { LabelProjector } from './LabelProjector.tsx';
import { RenderOnDemand } from './RenderOnDemand.tsx';
import { ScaleBarProbe } from './ScaleBarProbe.tsx';
import type { ScaleBarElements } from '../ui/ScaleBar.tsx';
import type { SharedFrame } from './satellites.ts';
// Before any material compiles: replaces three's log-depth chunks. See logDepth.ts.
import { CAMERA_FAR_UNITS, CAMERA_NEAR_UNITS } from './logDepth.ts';
import { FOV_DEG, kmToUnits, MAX_VIEW_DISTANCE_KM } from './scale.ts';
import { SolarSystem } from './SolarSystem.tsx';
import { Starfield } from './Starfield.tsx';

/**
 * The WebGL canvas and camera rig.
 *
 * Two settings here do the heavy lifting for scale:
 *
 *  - `logarithmicDepthBuffer`. A conventional depth buffer distributes precision by
 *    1/z, so a near plane small enough to stand on Earth's surface would leave
 *    nothing for Neptune. The logarithmic buffer spreads precision evenly in orders
 *    of magnitude, which is exactly the shape of this scene -- once it counts from
 *    the near plane rather than from one scene unit, which three's own does not; see
 *    logDepth.ts for the 1.5 m it was costing everything within 1000 km.
 *  - A near plane of 1e-6 units (one metre) and a far plane past the star sphere.
 *    That is a range of 1e17, which only the log buffer makes survivable.
 *
 * The camera always orbits the origin, because the floating origin has already put
 * the focused body there.
 *
 * And two settings decide how much of the machine it takes:
 *
 *  - `frameloop="demand"`: a frame is drawn when something may have changed, not sixty
 *    times a second regardless. With the clock running that is every frame anyway; paused
 *    and untouched, it is none. See renderDemand.ts and RenderOnDemand.tsx.
 *  - `dpr`, capped at `MAX_PIXEL_RATIO`.
 */

/**
 * The most device pixels the canvas draws per CSS pixel.
 *
 * Fragment cost goes with the square of it: a 3x phone or a 4K laptop screen drawn at its
 * full ratio shades 2.25 times what it would at 2, through the same atmosphere ray march
 * and ring shader. Past 2 the extra detail is below what an eye resolves at arm's length
 * -- and the text, the one thing on screen where it would show, is DOM, laid over the
 * canvas and drawn by the browser at whatever the screen has. Below the cap nothing
 * changes: the reference laptop is 1.25, and draws at 1.25 as before.
 *
 * It is also react-three-fiber's own default, `[1, 2]`, so writing it down changes no
 * pixel; it is here so the choice is made in this file rather than inherited. Going
 * lower is not free: at 1 the reference laptop would shade 36 % fewer pixels, and the
 * browser would stretch the picture by 1.25 to fit -- every star, orbit line and limb
 * softened, which is a cost in exactly what this project exists to show.
 */
const MAX_PIXEL_RATIO = 2;

export { FOV_DEG };

export interface SolarSystemCanvasProps {
  readonly store: EphemerisStore;
  readonly stars: StarCatalog;
  /** The stars at their real distances; null until the sky is in. */
  readonly stars3d: Stars3dSource | null;
  /** The Star Map layer. */
  readonly showStarMap: boolean;
  readonly belt: BeltSource;
  /** Which of the belt's families are drawn; see the view store's `beltFamilies`. */
  readonly beltFamilies: number;
  readonly comets: CometSource;
  readonly satellites: SatelliteSource;
  /** Which of the satellites' chips are drawn; see the view store's `satelliteChips`. */
  readonly satelliteChips: number;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly showOrbits: boolean;
  readonly showTrails: boolean;
  readonly showIcons: boolean;
  readonly showLabels: boolean;
  readonly lighting: LightingMode;
  readonly visibleKinds: ReadonlySet<string>;
  readonly labelElements: RefObject<Map<BodyId, HTMLElement | null>>;
  readonly showDistanceRings: boolean;
  /** The distance rings' names, by ring, laid over the canvas like the bodies'. */
  readonly ringLabels: RefObject<(HTMLElement | null)[]>;
  /** The Milky Way model: the Milky Way Model layer, and its names, in GALAXY_LABELS order. */
  readonly showMilkyWay: boolean;
  /** The Nuclear Cluster Model layer: the sampled stars round Sgr A*. */
  readonly showNuclearCluster: boolean;
  readonly galaxyLabels: RefObject<(HTMLElement | null)[]>;
  /** The names of the Solar System's orbits laid over Sgr A* for scale (HorizonScale). */
  readonly horizonScaleLabels: RefObject<(HTMLElement | null)[]>;
  /** The scale bar's nodes, written by ScaleBarProbe. */
  readonly scaleBar: RefObject<ScaleBarElements | null>;
  /** The Exoplanet Archive, its hosts' rings, and what a click on one does. */
  readonly exoplanets: LazySource<ExoplanetArchive>;
  readonly showExoplanetHosts: boolean;
  readonly onPickHost: (host: number) => void;
  /** The pulsars, their markers, and what a click on one does. */
  readonly pulsars: LazySource<PulsarArchive>;
  readonly showPulsars: boolean;
  readonly onPickPulsar: (k: number) => void;
}

export function SolarSystemCanvas({
  store,
  stars,
  stars3d,
  showStarMap,
  belt,
  beltFamilies,
  comets,
  satellites,
  satelliteChips,
  clock,
  focus,
  showOrbits,
  showTrails,
  showIcons,
  showLabels,
  lighting,
  visibleKinds,
  labelElements,
  showDistanceRings,
  ringLabels,
  showMilkyWay,
  showNuclearCluster,
  galaxyLabels,
  horizonScaleLabels,
  scaleBar,
  exoplanets,
  showExoplanetHosts,
  onPickHost,
  pulsars,
  showPulsars,
  onPickPulsar,
}: SolarSystemCanvasProps) {
  const focusBody = store.body(focus);
  const radiusUnits = kmToUnits(focusBody.radiusEquatorialKm);
  // Eight radii, or for a planet of another star -- no disc, no radius -- its orbit about
  // the star (exoplanets.ts planetFramingKm).
  const otherPlanet = exoPlanetOf(focus);
  const framingUnits = otherPlanet === null ? radiusUnits * 8 : kmToUnits(planetFramingKm(otherPlanet));
  // The scene writes it, the labels read it: which markers lost their spot this frame.
  // SolarSystem's frame runs before LabelProjector's, being declared first.
  const hiddenMarkers = useMemo(() => new Set<BodyId>(), []);
  // The same way, this frame's rebased positions: worked out once, by the scene, and
  // read by the labels instead of being worked out again. See SharedFrame.
  const sharedFrame = useMemo<SharedFrame>(() => ({ snapshot: null }), []);

  // Anything the scene is told changes what it draws, and almost none of it reaches a
  // react-three-fiber prop, which would ask for a frame by itself: the scene reads these
  // inside its frame loop. So a change asks here.
  useEffect(() => {
    renderDemand.request();
  }, [
    store,
    stars,
    clock,
    focus,
    showOrbits,
    showTrails,
    showIcons,
    showLabels,
    lighting,
    visibleKinds,
    satelliteChips,
    showDistanceRings,
    showStarMap,
    showExoplanetHosts,
    showPulsars,
    showNuclearCluster,
  ]);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, MAX_PIXEL_RATIO]}
      gl={{
        logarithmicDepthBuffer: true,
        antialias: true,
        // The Sun is genuinely far brighter than anything else in frame, so a
        // filmic curve keeps it from blowing out everything around it.
        toneMapping: 3, // THREE.ACESFilmicToneMapping
      }}
      camera={{ fov: FOV_DEG, near: CAMERA_NEAR_UNITS, far: CAMERA_FAR_UNITS }}
      style={{ position: 'absolute', inset: 0, background: '#000' }}
    >
      <Starfield
        catalog={stars}
        clock={clock}
        store={store}
        focus={focus}
        stars3d={stars3d}
        showMap={showStarMap}
        sunShown={visibleKinds.has('star')}
      />
      <SolarSystem
        store={store}
        clock={clock}
        focus={focus}
        showOrbits={showOrbits}
        showTrails={showTrails}
        showIcons={showIcons}
        lighting={lighting}
        visibleKinds={visibleKinds}
        hiddenMarkers={hiddenMarkers}
        sharedFrame={sharedFrame}
      />
      {/*
        Between the two on purpose: it reads the scene's snapshot before the labels take
        it, and frame callbacks run in mount order. See AsteroidBelt.
      */}
      <AsteroidBelt
        source={belt}
        store={store}
        clock={clock}
        focus={focus}
        visible={visibleKinds.has('asteroid')}
        families={beltFamilies}
        sharedFrame={sharedFrame}
      />
      <CometField
        source={comets}
        store={store}
        clock={clock}
        focus={focus}
        visible={visibleKinds.has('comet')}
        sharedFrame={sharedFrame}
      />
      <SatelliteSwarm
        source={satellites}
        store={store}
        clock={clock}
        focus={focus}
        visible={visibleKinds.has('satellite')}
        chips={satelliteChips}
        sharedFrame={sharedFrame}
      />
      <DistanceRings
        store={store}
        clock={clock}
        focus={focus}
        visible={showDistanceRings}
        censusVisible={showStarMap && stars3d !== null}
        labels={ringLabels}
      />
      <MilkyWay store={store} clock={clock} focus={focus} visible={showMilkyWay} labels={galaxyLabels} />
      <NuclearCluster catalog={stars} store={store} clock={clock} focus={focus} showModel={showNuclearCluster} />
      {/* After the glow: it draws the glow again, into its cube, with this frame's uniforms. */}
      <BlackHoleLens store={store} clock={clock} focus={focus} />
      <ExoplanetHosts
        source={exoplanets}
        store={store}
        clock={clock}
        focus={focus}
        visible={showExoplanetHosts}
        onPick={onPickHost}
      />
      <Pulsars source={pulsars} store={store} clock={clock} focus={focus} visible={showPulsars} onPick={onPickPulsar} />
      <HorizonScale store={store} clock={clock} focus={focus} labels={horizonScaleLabels} />
      <AlphaCentauriOrbits store={store} clock={clock} focus={focus} stars3d={stars3d} visible={showOrbits} />
      <SiriusOrbits store={store} clock={clock} focus={focus} visible={showOrbits} />
      <LabelProjector
        store={store}
        clock={clock}
        focus={focus}
        visible={showLabels}
        visibleKinds={visibleKinds}
        hiddenMarkers={hiddenMarkers}
        sharedFrame={sharedFrame}
        elements={labelElements}
      />
      <CameraRig
        focusKey={focus}
        // Not left to the `camera` prop above, which r3f reads only when it first
        // creates the camera and silently ignores afterwards. See CameraRig.
        fovDeg={FOV_DEG}
        // Framing relative to the body's own radius, so switching from the Sun to
        // Pluto -- six orders of magnitude apart -- arrives at the same apparent
        // size instead of burying the camera or losing the body entirely.
        framingDistance={framingUnits}
        minDistance={radiusUnits * 1.05}
        maxDistance={kmToUnits(MAX_VIEW_DISTANCE_KM)}
      />
      <ScaleBarProbe elements={scaleBar} />
      {/* Decides whether another frame follows this one. See renderDemand.ts. */}
      <RenderOnDemand store={store} />
    </Canvas>
  );
}
