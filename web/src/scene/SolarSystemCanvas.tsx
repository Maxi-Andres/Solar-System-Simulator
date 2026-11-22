import type { BodyId, StarCatalog } from '@sss/tools/types';
import { Canvas } from '@react-three/fiber';

import type { BeltSource } from '../core/belt.ts';
import type { CometSource } from '../core/comets.ts';
import type { SatelliteSource } from '../core/satellites.ts';
import type { Stars3dSource } from '../core/stars3d.ts';
import type { ExoplanetArchive } from '../core/exoplanetArchive.ts';
import type { PulsarArchive } from '../core/pulsars.ts';
import type { GlobularClusterArchive } from '../core/globularClusters.ts';
import type { LocalGroupArchive } from '../core/localGroup.ts';
import type { LocalVolumeArchive } from '../core/localVolume.ts';
import type { LaniakeaCatalogue, LaniakeaNameIndex } from '../core/laniakea.ts';
import type { LazySource } from '../core/satellites.ts';
import type { CosmicWebSource } from '../core/cosmicWeb.ts';
import { planetFramingKm } from '../core/exoplanets.ts';
import { exoPlanetOf } from '../core/planetarySystems.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { SimClock } from '../core/time.ts';
import { useViewStore, type LightingMode } from '../state/store.ts';
import { useEffect, useMemo, type RefObject } from 'react';

import { renderDemand } from '../core/renderDemand.ts';

import { AdaptiveResolution } from './AdaptiveResolution.tsx';
import { AsteroidBelt } from './AsteroidBelt.tsx';
import { BlackHoleLens } from './BlackHoleLens.tsx';
import { CameraRig } from './CameraRig.tsx';
import { CometField } from './Comets.tsx';
import { DistanceRings } from './DistanceRings.tsx';
import { ExoplanetHosts } from './ExoplanetHosts.tsx';
import { GlowComposite } from './GlowComposite.tsx';
import { SolarSystemWatch } from './SolarSystemWatch.tsx';
import type { GalaxyFeatureLayers } from './GalaxyFeatures.tsx';
import { LocalGroup } from './LocalGroup.tsx';
import { DwarfStars } from './DwarfStars.tsx';
import { MilkyWay } from './MilkyWay.tsx';
import { NuclearCluster } from './NuclearCluster.tsx';
import { SatelliteSwarm } from './SatelliteSwarm.tsx';
import { LabelProjector } from './LabelProjector.tsx';
import { LazyLayer, lazyLayer, useOnceOn } from './lazyLayer.tsx';
import { RenderOnDemand } from './RenderOnDemand.tsx';
import { ScaleBarProbe } from './ScaleBarProbe.tsx';
import { ShaderWarmup } from './ShaderWarmup.tsx';
import type { ScaleBarElements } from '../ui/ScaleBar.tsx';
import type { SharedFrame } from './satellites.ts';
// Before any material compiles: replaces three's log-depth chunks. See logDepth.ts.
import { CAMERA_FAR_UNITS, CAMERA_NEAR_UNITS } from './logDepth.ts';
import { FOV_DEG, kmToUnits, MAX_VIEW_DISTANCE_KM } from './scale.ts';
import { SolarSystem } from './SolarSystem.tsx';
import { Starfield } from './Starfield.tsx';

/**
 * The layers drawn far from the Sun, or off until switched on, each in a chunk of its own
 * (lazyLayer.tsx): out of the main chunk, so not parsed before the first frame. Those on
 * from the start are fetched now, beside the startup data, and are usually in before the
 * canvas first renders; the rest when first switched on.
 */
const Laniakea = lazyLayer(() => import('./Laniakea.tsx').then((m) => m.Laniakea), true);
const CosmicWeb = lazyLayer(() => import('./CosmicWeb.tsx').then((m) => m.CosmicWeb), true);
const Quasars = lazyLayer(() => import('./Quasars.tsx').then((m) => m.Quasars), true);
const FarLandmarks = lazyLayer(() => import('./FarLandmarks.tsx').then((m) => m.FarLandmarks), true);
const SkyVolume = lazyLayer(() => import('./SkyVolume.tsx').then((m) => m.SkyVolume), true);
const GlobularClusters = lazyLayer(() => import('./GlobularClusters.tsx').then((m) => m.GlobularClusters), true);
const GalaxyFeatures = lazyLayer(() => import('./GalaxyFeatures.tsx').then((m) => m.GalaxyFeatures), true);
const SupernovaRemnants = lazyLayer(() => import('./SupernovaRemnants.tsx').then((m) => m.SupernovaRemnants), true);
const HorizonScale = lazyLayer(() => import('./HorizonScale.tsx').then((m) => m.HorizonScale), true);
const CosmicMicrowaveBackground = lazyLayer(
  () => import('./CosmicMicrowaveBackground.tsx').then((m) => m.CosmicMicrowaveBackground),
  true,
);
const AlphaCentauriOrbits = lazyLayer(() => import('./AlphaCentauriOrbits.tsx').then((m) => m.AlphaCentauriOrbits), true);
const SiriusOrbits = lazyLayer(() => import('./SiriusOrbits.tsx').then((m) => m.SiriusOrbits), true);
const StellarFlybys = lazyLayer(() => import('./StellarFlybys.tsx').then((m) => m.StellarFlybys), true);
// Off at first: fetched the first time each is switched on.
const Pulsars = lazyLayer(() => import('./Pulsars.tsx').then((m) => m.Pulsars));
const Constellations = lazyLayer(() => import('./Constellations.tsx').then((m) => m.Constellations));
const Heliosphere = lazyLayer(() => import('./Heliosphere.tsx').then((m) => m.Heliosphere));
const Magnetosphere = lazyLayer(() => import('./Magnetosphere.tsx').then((m) => m.Magnetosphere));
const Aurora = lazyLayer(() => import('./Aurora.tsx').then((m) => m.Aurora));
const MeteorShowers = lazyLayer(() => import('./MeteorShowers.tsx').then((m) => m.MeteorShowers));

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
 *    times a second regardless. Under warp that is every frame; at real time, as often as
 *    something on screen moves a quarter of a pixel; paused and untouched, none. See
 *    renderDemand.ts and RenderOnDemand.tsx.
 *  - `dpr`, capped at `MAX_PIXEL_RATIO` -- and cut while the camera moves, on a GPU that
 *    cannot keep up, back in full when it stops (AdaptiveResolution.tsx).
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
  /** The CMB's sphere and the record-holders (G4): the Observable Universe layer. */
  readonly showObservableUniverse: boolean;
  readonly cmbLabel: RefObject<HTMLElement | null>;
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
  /** The globular clusters, their marks and the stars of the one the camera is near. */
  readonly globularClusters: LazySource<GlobularClusterArchive>;
  readonly showGlobularClusters: boolean;
  readonly onPickCluster: (k: number) => void;
  /** The Supernova Remnants layer: their rings (their names and marks are the bodies'). */
  readonly showSupernovaRemnants: boolean;
  /** The Local Group's galaxies, the dwarfs' marks, and what a click on one does. */
  readonly localGroup: LazySource<LocalGroupArchive>;
  readonly showLocalGroup: boolean;
  readonly onPickGalaxy: (k: number) => void;
  /** The galaxies beyond, out to the Virgo Cluster, and what a click on one's mark does. */
  readonly localVolume: LazySource<LocalVolumeArchive>;
  readonly onPickVolumeGalaxy: (k: number) => void;
  /** Laniakea and beyond, its layers, and what a click on a galaxy's mark does. */
  readonly laniakea: LazySource<LaniakeaCatalogue>;
  readonly laniakeaNames: LazySource<LaniakeaNameIndex>;
  readonly showLaniakea: boolean;
  /** The Basins of Attraction layer, and which of its basins are on (core/basinChips.ts). */
  readonly showBasins: boolean;
  readonly basinChips: number;
  /** The Flow Lines layer: the velocity field's streamlines. */
  readonly showFlowLines: boolean;
  readonly onPickLaniakeaGalaxy: (k: number) => void;
  /** The cosmic web past it: the SDSS Galaxies and Filaments layers. */
  readonly cosmicWeb: CosmicWebSource;
  readonly showSdssGalaxies: boolean;
  readonly showFilaments: boolean;
  /** The nebulae, the stellar streams, the bubbles and the local interstellar medium (GalaxyFeatures). */
  readonly galaxyFeatures: GalaxyFeatureLayers;
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
  showObservableUniverse,
  cmbLabel,
  scaleBar,
  exoplanets,
  showExoplanetHosts,
  onPickHost,
  pulsars,
  showPulsars,
  onPickPulsar,
  globularClusters,
  showGlobularClusters,
  onPickCluster,
  showSupernovaRemnants,
  localGroup,
  showLocalGroup,
  onPickGalaxy,
  localVolume,
  onPickVolumeGalaxy,
  laniakea,
  laniakeaNames,
  showLaniakea,
  showBasins,
  basinChips,
  showFlowLines,
  onPickLaniakeaGalaxy,
  cosmicWeb,
  showSdssGalaxies,
  showFilaments,
  galaxyFeatures,
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
  // The layers off at first, mounted once first switched on and kept after (lazyLayer.tsx):
  // each hides itself while off, as before.
  const pulsarsMounted = useOnceOn(showPulsars);
  const constellationsMounted = useOnceOn(useViewStore((state) => state.layers.constellations));
  const heliosphereMounted = useOnceOn(useViewStore((state) => state.layers.heliosphere));
  const magnetosphereMounted = useOnceOn(useViewStore((state) => state.layers.magnetosphere));
  const auroraMounted = useOnceOn(useViewStore((state) => state.layers.aurora));
  const meteorShowersMounted = useOnceOn(useViewStore((state) => state.layers.meteorShowers));
  // The sphere the camera never leaves, about the Sun, whatever it is focused on: inside the
  // CMB's, as everyone is (scale.ts MAX_VIEW_DISTANCE_KM, CameraRig's bound).
  const cameraBound = useMemo(
    () => ({
      radius: kmToUnits(MAX_VIEW_DISTANCE_KM),
      centre: (out: { set: (x: number, y: number, z: number) => unknown }): boolean => {
        const sun = store.sunFromFocus(focus, clock.tdbJulianDay);
        if (sun === null) return false;
        out.set(kmToUnits(sun.position.x), kmToUnits(sun.position.y), kmToUnits(sun.position.z));
        return true;
      },
    }),
    [store, clock, focus],
  );

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
    showGlobularClusters,
    showSupernovaRemnants,
    showLocalGroup,
    showNuclearCluster,
    showLaniakea,
    showBasins,
    basinChips,
    showFlowLines,
    showSdssGalaxies,
    showFilaments,
    showObservableUniverse,
    galaxyFeatures,
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
      onCreated={({ gl, scene }) => {
        // The scene itself never moves. Left to recompose its matrix every frame, three takes
        // that as its world having changed and updates every object's world matrix under it,
        // whatever each asks: a hidden body, a static group (matrixWorldAutoUpdate,
        // matrixAutoUpdate) recomputed with the rest. Static, each object updates when it
        // moves or its parent does -- every object here that sets its matrix by hand says so
        // with matrixWorldNeedsUpdate, as three asks.
        scene.matrixAutoUpdate = false;
        // three checks every program it links for errors, and to do so asks the driver for
        // its log as soon as it is linked: a wait, on the main thread, for each compile to
        // finish -- 178 ms of the first frame's 290, measured. In development the check
        // stays, so a broken shader still says why; a published build runs shaders that
        // development has compiled first.
        gl.debug.checkShaderErrors = import.meta.env.DEV;
        // Asked of the driver now, while it has nothing else to do. A question to the GPU
        // waits for everything sent before it, and the first frame used to ask it (a map's
        // filtering, SolarSystem.tsx) behind the first frame's shader compiles: 104 ms of
        // waiting for one number, measured on a production build. three keeps the answer.
        gl.capabilities.getMaxAnisotropy();
      }}
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
      {/* Every glow, laid over the frame once, its light past white spilled into a halo (glowBuffer.ts). */}
      <GlowComposite />
      <MilkyWay store={store} clock={clock} focus={focus} visible={showMilkyWay} labels={galaxyLabels} />
      <NuclearCluster catalog={stars} store={store} clock={clock} focus={focus} showModel={showNuclearCluster} />
      {/* After the glow: it draws the glow again, into its cube, with this frame's uniforms. */}
      <BlackHoleLens store={store} clock={clock} focus={focus} />
      <ExoplanetHosts
        source={exoplanets}
        store={store}
        clock={clock}
        focus={focus}
        // Rings and nothing else: Icons off takes them too.
        visible={showExoplanetHosts && showIcons}
        onPick={onPickHost}
      />
      <LazyLayer>
        {pulsarsMounted && (
          <Pulsars
            source={pulsars}
            store={store}
            clock={clock}
            focus={focus}
            // Markers and nothing else, as the hosts' rings.
            visible={showPulsars && showIcons}
            onPick={onPickPulsar}
          />
        )}
      </LazyLayer>
      <LazyLayer>
        <SupernovaRemnants
          store={store}
          clock={clock}
          focus={focus}
          visible={showSupernovaRemnants}
          showRings={showIcons}
        />
      </LazyLayer>
      <LocalGroup
        source={localGroup}
        store={store}
        clock={clock}
        focus={focus}
        visible={showLocalGroup}
        showMarks={showIcons}
        onPick={onPickGalaxy}
        volume={localVolume}
        onPickVolume={onPickVolumeGalaxy}
      />
      <LazyLayer>
        <Laniakea
          source={laniakea}
          names={laniakeaNames}
          store={store}
          clock={clock}
          focus={focus}
          visible={showLaniakea}
          showMarks={showIcons}
          showBasins={showBasins}
          basinChips={basinChips}
          showFlows={showFlowLines}
          onPick={onPickLaniakeaGalaxy}
        />
      </LazyLayer>
      <LazyLayer>
        <CosmicWeb source={cosmicWeb} store={store} clock={clock} focus={focus} showGalaxies={showSdssGalaxies} showFilaments={showFilaments} />
      </LazyLayer>
      {/* Its layers read from the store, its data its own (core/quasars.ts): nothing above needs them. */}
      <LazyLayer>
        <Quasars store={store} clock={clock} focus={focus} />
      </LazyLayer>
      <LazyLayer>
        <FarLandmarks store={store} clock={clock} focus={focus} />
      </LazyLayer>
      <DwarfStars source={localGroup} catalog={stars} store={store} clock={clock} focus={focus} visible={showLocalGroup} />
      <LazyLayer>
        <SkyVolume galaxyKey="smc" store={store} clock={clock} focus={focus} visible={showLocalGroup} />
      </LazyLayer>
      <LazyLayer>
        <GlobularClusters
          source={globularClusters}
          catalog={stars}
          store={store}
          clock={clock}
          focus={focus}
          visible={showGlobularClusters}
          showMarks={showIcons}
          onPick={onPickCluster}
        />
      </LazyLayer>
      <LazyLayer>
        <GalaxyFeatures store={store} clock={clock} focus={focus} layers={galaxyFeatures} />
      </LazyLayer>
      <LazyLayer>
        <HorizonScale store={store} clock={clock} focus={focus} labels={horizonScaleLabels} />
      </LazyLayer>
      <LazyLayer>{heliosphereMounted && <Heliosphere store={store} clock={clock} focus={focus} />}</LazyLayer>
      <LazyLayer>{magnetosphereMounted && <Magnetosphere store={store} clock={clock} focus={focus} />}</LazyLayer>
      <LazyLayer>{auroraMounted && <Aurora store={store} clock={clock} focus={focus} />}</LazyLayer>
      <LazyLayer>{meteorShowersMounted && <MeteorShowers store={store} clock={clock} focus={focus} />}</LazyLayer>
      {/* Its names posted before LabelProjector's declutter, which runs after it. */}
      <LazyLayer>{constellationsMounted && <Constellations store={store} clock={clock} focus={focus} />}</LazyLayer>
      <SolarSystemWatch store={store} clock={clock} focus={focus} />
      <LazyLayer>
        <CosmicMicrowaveBackground store={store} clock={clock} focus={focus} visible={showObservableUniverse} label={cmbLabel} />
      </LazyLayer>
      <LazyLayer>
        <AlphaCentauriOrbits store={store} clock={clock} focus={focus} stars3d={stars3d} visible={showOrbits} />
      </LazyLayer>
      <LazyLayer>
        <SiriusOrbits store={store} clock={clock} focus={focus} visible={showOrbits} />
      </LazyLayer>
      <LazyLayer>
        <StellarFlybys store={store} clock={clock} focus={focus} />
      </LazyLayer>
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
        bound={cameraBound}
      />
      <ScaleBarProbe elements={scaleBar} />
      {/* Fewer pixels while the camera moves on a GPU that cannot keep up; all of them at rest. */}
      <AdaptiveResolution />
      {/* Decides whether another frame follows this one. See renderDemand.ts. */}
      <RenderOnDemand store={store} />
      {/* The first frame's shaders compiled before it is drawn, off the main thread. */}
      <ShaderWarmup />
    </Canvas>
  );
}
