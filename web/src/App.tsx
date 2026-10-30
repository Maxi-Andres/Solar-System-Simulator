import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';

import type { DistanceMode, EphemerisStore } from './core/ephemerisStore.ts';
import { addNamedSatellites } from './core/satelliteBodies.ts';
import { chipShown, SATELLITE_CHIPS, satelliteChipLayer } from './core/satelliteGroups.ts';
import type { Signal } from './core/signal.ts';
import { useSignal } from './core/useSignal.ts';
import { useSimulation } from './core/useSimulation.ts';
import { useStoreVersion } from './core/useStoreVersion.ts';
import { DETAIL_RELEASE_MS } from './scene/detailRelease.ts';
import { isShown, SMALL_MOON_LAYER, systemOf } from './scene/floatingOrigin.ts';
import { SolarSystemCanvas } from './scene/SolarSystemCanvas.tsx';
import { useViewStore } from './state/store.ts';
import { AboutPanel } from './ui/AboutPanel.tsx';
import {
  ALPHA_CEN_MEMBERS,
  alphaCenEntries,
  alphaCenView,
  ensureAlphaCenBodies,
  type AlphaCenKey,
} from './core/alphaCenBodies.ts';
import {
  ensurePlanetarySystems,
  PLANETARY_SYSTEMS,
  registeredSystem,
  systemFramingKm,
  systemView,
} from './core/planetarySystems.ts';
import { ensureArchiveSystem } from './core/archiveSystems.ts';
import { archivePlanetId, CURATED_HOSTS } from './core/exoplanetArchive.ts';
import { addStarBody } from './core/starBodies.ts';
import { ensureBlackHoles } from './core/blackHoles.ts';
import { renderDemand } from './core/renderDemand.ts';
import { BodyPicker, type AlphaCenNavigator, type PlanetSystemsNavigator } from './ui/BodyPicker.tsx';
import { ScaleBar, type ScaleBarElements } from './ui/ScaleBar.tsx';
import {
  CENSUS_EDGE_COLOR,
  CENSUS_EDGE_LABEL,
  DISTANCE_RINGS_LY,
  ringLabel,
} from './scene/distanceRings.ts';
import { GALAXY_LABELS } from './scene/MilkyWay.tsx';
import { HORIZON_SCALE_RINGS } from './scene/HorizonScale.tsx';
import { InfoPanel } from './ui/InfoPanel.tsx';
import { LayersPanel } from './ui/LayersPanel.tsx';
import { LightingPanel } from './ui/LightingPanel.tsx';
import { Presence } from './ui/Presence.tsx';
import { ReadoutPanel } from './ui/ReadoutPanel.tsx';
import { SearchPanel } from './ui/SearchPanel.tsx';
import { TimeControls } from './ui/TimeControls.tsx';
import { Toolbar } from './ui/Toolbar.tsx';

/**
 * Step 4 -- the interface.
 *
 * Layout follows NASA Eyes: breadcrumb top-left, time controls bottom-left, tool
 * rail on the right, panels sliding out beside it. Labels are HTML positioned by the
 * scene each frame rather than sprites, which keeps them crisp and clickable.
 *
 * This component re-renders when something it lays out changes -- the store arriving,
 * a layer, the focus -- and not with the clock. What shows a number that moves with time
 * is wrapped in `OnReadout`, which re-renders just that on the readout beat. See signal.ts
 * for what it cost when all of this re-rendered ten times a second.
 */

/** Which catalog `kind` values each layer switch controls. */
const LAYER_KINDS: Record<string, readonly string[]> = {
  // The black holes are always drawn, as another star is; their names go with the stars'.
  planets: ['planet', 'star', 'black-hole'],
  dwarfPlanets: ['dwarf-planet'],
  asteroids: ['asteroid'],
  // The comet dots (see CometField), and a comet made a body from search (cometBodies.ts).
  comets: ['comet'],
  moons: ['moon'],
  smallMoons: [SMALL_MOON_LAYER],
  spacecraft: ['spacecraft'],
  // The named satellites as bodies, the rest as dots (see SatelliteSwarm), each also
  // under its chip -- see visibleKinds.
  satellites: ['satellite'],
};

export function App() {
  const {
    store,
    stars,
    stars3d,
    starNames,
    belt,
    comets,
    names,
    satellites,
    satelliteNames,
    exoplanets,
    clock,
    error,
    readout,
  } = useSimulation();
  const [distanceMode, setDistanceMode] = useState<DistanceMode>('center');

  const focus = useViewStore((state) => state.focus);
  const setFocus = useViewStore((state) => state.setFocus);
  const requestFraming = useViewStore((state) => state.requestFraming);
  const layers = useViewStore((state) => state.layers);
  const lighting = useViewStore((state) => state.lighting);
  const openPanel = useViewStore((state) => state.openPanel);
  const setLayer = useViewStore((state) => state.setLayer);
  const beltTiers = useViewStore((state) => state.beltTiers);
  const beltFamilies = useViewStore((state) => state.beltFamilies);
  const satelliteChips = useViewStore((state) => state.satelliteChips);

  const labelElements = useRef<Map<BodyId, HTMLElement | null>>(new Map());
  const ringLabels = useRef<(HTMLElement | null)[]>([]);

  // Alpha Centauri on the breadcrumb (D3b): a star of it made a body when chosen, from the
  // star names, then focused -- framed from farther out when the system itself is asked for.
  const alphaCen = useMemo<AlphaCenNavigator | null>(() => {
    if (store === null || stars3d === null || starNames === null) {
      return null;
    }
    const names = Object.fromEntries(ALPHA_CEN_MEMBERS.map((member) => [member.key, member.name])) as Record<
      AlphaCenKey,
      string
    >;
    return {
      names,
      go: (key, framingKm) => {
        // Its light is drawn by the 3D stars: asked for now, as search does.
        void stars3d.request();
        starNames
          .request()
          .then(async () => {
            const index = starNames.value;
            const entries = index === null ? null : alphaCenEntries(index.names);
            if (index === null || entries === null) {
              return;
            }
            const id = await addStarBody(store, stars3d, index, entries[key], useViewStore.getState().focus, true);
            // The system, not one star: framed from out of the pair's orbital plane.
            if (framingKm !== undefined) {
              requestFraming(framingKm, alphaCenView());
            }
            setFocus(id);
            renderDemand.request();
          })
          .catch((error: unknown) => {
            console.error(`Could not go to ${names[key]}`, error);
          });
      },
    };
  }, [stars3d, starNames, store, requestFraming, setFocus]);

  // The planetary systems on the breadcrumb (D4a): a system's star -- a body from the start,
  // made one now if it is not yet -- focused and framed with its planets' orbits.
  const planetSystems = useMemo<PlanetSystemsNavigator | null>(() => {
    if (store === null || stars3d === null || starNames === null) {
      return null;
    }
    return {
      go: (key) => {
        // One of the Archive's, gone to before: its star is a body already.
        const archived = registeredSystem(key);
        if (archived !== null) {
          requestFraming(systemFramingKm(archived.system), systemView(archived.system, archived.host));
          setFocus(archived.host);
          renderDemand.request();
          return;
        }
        const system = PLANETARY_SYSTEMS.find((candidate) => candidate.key === key);
        if (system === undefined) {
          return;
        }
        void stars3d.request();
        starNames
          .request()
          .then(async () => {
            const index = starNames.value;
            if (index === null) {
              return;
            }
            const host = (await ensurePlanetarySystems(store, stars3d, index, useViewStore.getState().focus)).get(key);
            if (host === undefined) {
              return;
            }
            requestFraming(systemFramingKm(system), systemView(system, host));
            setFocus(host);
            renderDemand.request();
          })
          .catch((error: unknown) => {
            console.error(`Could not go to ${system.name}`, error);
          });
      },
    };
  }, [stars3d, starNames, store, requestFraming, setFocus]);

  // The NASA Exoplanet Archive's systems (D4b): a host clicked on the map, or found by
  // search, made a body with its planets about it (archiveSystems.ts) and framed as a
  // system -- or, with `planet`, that planet gone to. A host whose system is drawn from its
  // papers goes to that system instead (CURATED_HOSTS).
  const goToArchive = useCallback(
    (host: number, planet: number | null = null): void => {
      if (store === null) {
        return;
      }
      exoplanets
        .request()
        .then(async () => {
          const archive = exoplanets.value;
          if (archive === null) {
            return;
          }
          const curated = CURATED_HOSTS[archive.catalog.hosts.name[host]!];
          if (curated !== undefined) {
            if (curated === 'alpha-centauri') {
              alphaCen?.go('Proxima');
            } else {
              planetSystems?.go(curated);
            }
            return;
          }
          // Its light is drawn by the 3D stars, where it is one: asked for now.
          void stars3d?.request();
          const made = await ensureArchiveSystem(store, archive, host, stars3d, useViewStore.getState().focus);
          if (made === null) {
            return;
          }
          const planetId = planet === null ? null : archivePlanetId(planet);
          if (planetId !== null && made.system.planets.some((candidate) => candidate.id === planetId)) {
            setFocus(planetId);
          } else {
            requestFraming(systemFramingKm(made.system), systemView(made.system, made.host));
            setFocus(made.host);
          }
          renderDemand.request();
        })
        .catch((error: unknown) => {
          console.error('Could not go to that planetary system', error);
        });
    },
    [store, exoplanets, stars3d, alphaCen, planetSystems, requestFraming, setFocus],
  );

  // The black holes, and the stars about them, are bodies from the start: nothing to fetch,
  // every number is in blackHoles.ts.
  useEffect(() => {
    if (store !== null) {
      ensureBlackHoles(store);
      renderDemand.request();
    }
  }, [store]);

  // Alpha Centauri's three are bodies from the start, pinned: named on the sky from
  // anywhere, and a click on a name goes there, as for the planets (alphaCenBodies.ts).
  // So are the planetary systems' stars, with their planets (planetarySystems.ts).
  useEffect(() => {
    if (store === null || stars3d === null || starNames === null) {
      return;
    }
    let cancelled = false;
    starNames
      .request()
      .then(async () => {
        const index = starNames.value;
        if (cancelled || index === null) {
          return;
        }
        await ensureAlphaCenBodies(store, stars3d, index, useViewStore.getState().focus);
        await ensurePlanetarySystems(store, stars3d, index, useViewStore.getState().focus);
        renderDemand.request();
      })
      .catch((error: unknown) => {
        console.error('Could not place Alpha Centauri', error);
      });
    return () => {
      cancelled = true;
    };
  }, [store, stars3d, starNames]);
  const galaxyLabels = useRef<(HTMLElement | null)[]>([]);
  const horizonScaleLabels = useRef<(HTMLElement | null)[]>([]);
  const scaleBar = useRef<ScaleBarElements | null>(null);

  // The Sun is a 'star' but rides along with the Planets switch: nobody expects to
  // turn off the Sun separately, and NASA Eyes does not offer that either.
  const visibleKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const [layerId, kindList] of Object.entries(LAYER_KINDS)) {
      if (layers[layerId as keyof typeof layers]) {
        for (const kind of kindList) {
          kinds.add(kind);
        }
      }
    }
    // The satellites' chips, as kinds of their own: a named satellite is shown only while
    // its chip is on, as its group's dots are (see isShown).
    SATELLITE_CHIPS.forEach((_, index) => {
      if (chipShown(satelliteChips, index)) {
        kinds.add(satelliteChipLayer(index));
      }
    });
    return kinds;
  }, [layers, satelliteChips]);

  // A planet's small moons are fetched when its system is entered -- the planet, one of
  // its moons or a craft about it in focus -- and not a moment before. The labels below
  // list every body, so the app redraws when they arrive.
  const version = useStoreVersion(store);
  useEffect(() => {
    // Nothing is fetched while the Small Moons layer is off.
    if (store !== null && visibleKinds.has('moon') && visibleKinds.has(SMALL_MOON_LAYER)) {
      void store.loadSmallMoons(systemOf(store, focus));
    }
  }, [store, focus, visibleKinds]);

  // The belt likewise: asked for once the ephemerides are in -- never in the way of the
  // first view -- and only if the Asteroids layer is on, as many tiers as the viewer chose.
  // Switched off, its GPU copies go at once (see AsteroidBelt) and every tier past the
  // first half a minute later, as a body's maps do once it has been small that long: up to
  // 54 MB is not worth holding for a layer nobody is looking at, and a quick look without
  // it should not cost the download again. The first tier, 3 MB, is kept.
  useEffect(() => {
    if (store === null) {
      return;
    }
    if (visibleKinds.has('asteroid')) {
      void belt.request(beltTiers);
      return;
    }
    const timer = setTimeout(() => belt.release(1), DETAIL_RELEASE_MS);
    return () => clearTimeout(timer);
  }, [store, belt, visibleKinds, beltTiers]);

  // The comets likewise, once, 150 KB, the first time their layer is on.
  useEffect(() => {
    if (store !== null && visibleKinds.has('comet')) {
      void comets.request();
    }
  }, [store, comets, visibleKinds]);

  // And the satellites, once, the first time their layer is on -- or search asks. The named
  // ones become bodies the moment they arrive (see satelliteBodies.ts).
  useEffect(() => {
    if (store !== null && visibleKinds.has('satellite')) {
      void satellites.request();
    }
  }, [store, satellites, visibleKinds]);
  const satelliteData = useSyncExternalStore(satellites.subscribe, () => satellites.value);
  useEffect(() => {
    if (store !== null && satelliteData !== null) {
      addNamedSatellites(store, satelliteData);
    }
  }, [store, satelliteData]);

  // Switching a layer off while standing on one of its bodies would leave the camera
  // orbiting something that is no longer drawn. Step back to what it orbits.
  useEffect(() => {
    if (store === null) {
      return;
    }
    const body = store.body(focus);
    if (!isShown(body, visibleKinds) && (body.parent !== null || body.kind === 'spacecraft')) {
      setFocus(body.parent ?? 'sun');
    }
  }, [store, focus, visibleKinds, setFocus]);

  // A spacecraft can also stop existing under the camera: run the clock back past its
  // launch, or forward past the end of its trajectory, and it has no position at all --
  // and neither, measured from it, does anything else. So it steps back too, to what it
  // flies with.
  //
  // Checked on the readout beat, as it was when this whole component re-rendered on it,
  // but by listening rather than re-rendering: asking the question draws nothing.
  useEffect(() => {
    if (store === null) {
      return;
    }
    const check = (): void => {
      const body = store.body(focus);
      // And a famous comet on an open orbit: with no ellipse to carry it on, it is not placed
      // outside its table either (see the elements in ephemerisStore.ts).
      // And a satellite outside the days its elements are good for (see satelliteBodies.ts).
      const unplaceable =
        body.kind === 'spacecraft' ||
        body.kind === 'satellite' ||
        (body.kind === 'comet' && !store.isPropagatedBody(focus) && store.elementsFor(focus) === null);
      if (unplaceable && !store.isCoveredAt(focus, clock.tdbJulianDay)) {
        setFocus(body.parent ?? 'sun');
      }
    };
    check();
    return readout.subscribe(check);
  }, [store, focus, clock, readout, setFocus]);

  // What is on screen, for the exactness flag: worked out when that changes, rather than
  // on every beat of the readout that shows it.
  const shownIds = useMemo(
    () =>
      store === null
        ? []
        : (void version,
          store.bodies.filter((body) => isShown(body, visibleKinds)).map((body) => body.id)),
    [store, visibleKinds, version],
  );

  if (error !== null) {
    return (
      <Centered>
        <p style={{ color: '#e06c5a', maxWidth: '32rem', textAlign: 'center' }}>{error}</p>
        <p style={{ color: '#6a6a6a', fontSize: '0.8rem' }}>
          Run <code>pnpm fetch:data</code> to generate the ephemerides and the sky.
        </p>
      </Centered>
    );
  }

  if (store === null || stars === null) {
    return (
      <Centered>
        <p style={{ letterSpacing: '0.2em', color: '#6a6a6a' }}>LOADING EPHEMERIDES</p>
      </Centered>
    );
  }

  const uiVisible = layers.userInterface;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <SolarSystemCanvas
        store={store}
        stars={stars}
        stars3d={stars3d}
        showStarMap={layers.starMap}
        belt={belt}
        beltFamilies={beltFamilies}
        comets={comets}
        satellites={satellites}
        satelliteChips={satelliteChips}
        clock={clock}
        focus={focus}
        showOrbits={layers.orbits}
        showTrails={layers.trails}
        showIcons={layers.icons}
        showLabels={layers.labels && uiVisible}
        lighting={lighting}
        visibleKinds={visibleKinds}
        labelElements={labelElements}
        showDistanceRings={layers.distanceRings}
        ringLabels={ringLabels}
        showMilkyWay={layers.milkyWay}
        showNuclearCluster={layers.nuclearCluster}
        galaxyLabels={galaxyLabels}
        horizonScaleLabels={horizonScaleLabels}
        scaleBar={scaleBar}
        exoplanets={exoplanets}
        showExoplanetHosts={layers.exoplanetHosts}
        onPickHost={goToArchive}
      />

      {(layers.distanceRings || layers.starMap) && layers.labels && uiVisible && (
        <RingLabels elements={ringLabels} />
      )}
      {layers.milkyWay && layers.labels && uiVisible && <GalaxyLabels elements={galaxyLabels} />}
      {layers.labels && uiVisible && <HorizonScaleLabels elements={horizonScaleLabels} />}

      <LabelLayer
        store={store}
        version={version}
        focus={focus}
        onFocus={setFocus}
        elements={labelElements}
      />

      {uiVisible && (
        <>
          {/* Top-left: where you are, and the list of everywhere else. */}
          <BodyPicker
            store={store}
            focus={focus}
            onFocus={setFocus}
            visibleKinds={visibleKinds}
            clock={clock}
            readout={readout}
            alphaCen={alphaCen}
            planetSystems={planetSystems}
          />

          {/* Bottom-left: time. */}
          <div style={{ position: 'absolute', bottom: '1.25rem', left: '1.25rem' }}>
            <OnReadout signal={readout}>
              {(tick) => (
                <TimeControls
                  clock={clock}
                  // Exact for what is on screen. The moons' window is two years and the
                  // planets' twenty, so the answer depends on whether the moons are shown.
                  exact={store.isExactAt(clock.tdbJulianDay, shownIds)}
                  tick={tick}
                />
              )}
            </OnReadout>
          </div>

          <Toolbar />

          {/* Bottom-right: how long a length on screen is, at the focus. */}
          <ScaleBar elements={scaleBar} focusName={store.body(focus).name} />

          {/* Each panel stays mounted for its closing animation; see Presence.tsx. */}
          <Presence show={openPanel === 'body'}>
            <OnReadout signal={readout}>
              {(tick) => (
                <InfoPanel
                  store={store}
                  jd={clock.tdbJulianDay}
                  distanceMode={distanceMode}
                  tick={tick}
                  stars3d={stars3d}
                />
              )}
            </OnReadout>
          </Presence>
          <Presence show={openPanel === 'search'}>
            <SearchPanel
              store={store}
              clock={clock}
              focus={focus}
              belt={belt}
              names={names}
              comets={comets}
              satellites={satellites}
              satelliteNames={satelliteNames}
              stars3d={stars3d}
              starNames={starNames}
              exoplanets={exoplanets}
              onArchive={goToArchive}
            />
          </Presence>
          <Presence show={openPanel === 'layers'}>
            <LayersPanel belt={belt} satellites={satellites} />
          </Presence>
          <Presence show={openPanel === 'lighting'}>
            <LightingPanel />
          </Presence>
          <Presence show={openPanel === 'readout'}>
            <OnReadout signal={readout}>
              {(tick) => (
                <ReadoutPanel
                  store={store}
                  jd={clock.tdbJulianDay}
                  distanceMode={distanceMode}
                  onDistanceMode={setDistanceMode}
                  visibleKinds={visibleKinds}
                  tick={tick}
                />
              )}
            </OnReadout>
          </Presence>
        </>
      )}

      <Presence show={openPanel === 'about'}>
        <AboutPanel
          store={store}
          stars={stars}
          belt={belt}
          comets={comets}
          satellites={satellites}
          stars3d={stars3d}
          exoplanets={exoplanets}
        />
      </Presence>

      {/* The only way back once the interface is switched off. */}
      {!uiVisible && (
        <button
          type="button"
          onClick={() => setLayer('userInterface', true)}
          style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            background: 'rgba(14,14,17,0.85)',
            border: '1px solid #2a2a2a',
            borderRadius: '0.3rem',
            color: '#6a6a6a',
            fontFamily: 'inherit',
            fontSize: '0.66rem',
            letterSpacing: '0.12em',
            padding: '0.3rem 0.6rem',
            cursor: 'pointer',
          }}
        >
          SHOW INTERFACE
        </button>
      )}
    </div>
  );
}

/**
 * Re-renders what it wraps on every beat of `signal`, and nothing around it.
 *
 * A function child rather than a hook in each panel, so the panels keep taking `jd` and
 * `tick` as props and need not know where the beat comes from.
 */
function OnReadout({
  signal,
  children,
}: {
  signal: Signal;
  children: (tick: number) => React.ReactNode;
}) {
  const tick = useSignal(signal);
  return <>{children(tick)}</>;
}

/**
 * The body names, laid over the canvas. The scene writes transforms into these nodes every
 * frame; React only creates them, and recolours one when the focus moves.
 *
 * They used to be written inline in `App`, which re-rendered ten times a second: five
 * hundred buttons, each with a new style object and a new ref callback -- and React
 * answers a new ref callback by calling the old one with null and the new one with the
 * element, so every label was taken out of the scene's map and put back, ten times a
 * second, to change nothing. Memoised here, with one ref callback per body kept for good
 * and two shared style objects, a focus change re-renders the two labels whose colour it
 * changes, and no ref is called again.
 */
const LabelLayer = memo(function LabelLayer({
  store,
  version,
  focus,
  onFocus,
  elements,
}: {
  store: EphemerisStore;
  /** The store's version: the list grows when a planet's small moons arrive. */
  version: number;
  focus: BodyId;
  onFocus: (id: BodyId) => void;
  elements: RefObject<Map<BodyId, HTMLElement | null>>;
}) {
  void version;
  const refs = useMemo(
    () => new Map<BodyId, (element: HTMLElement | null) => void>(),
    [elements],
  );
  const refFor = (id: BodyId): ((element: HTMLElement | null) => void) => {
    let ref = refs.get(id);
    if (ref === undefined) {
      ref = (element) => {
        elements.current.set(id, element);
      };
      refs.set(id, ref);
    }
    return ref;
  };

  return (
    <div style={LABEL_LAYER_STYLE}>
      {store.bodies.map((body) => (
        <BodyLabel
          key={body.id}
          body={body}
          focused={body.id === focus}
          elementRef={refFor(body.id)}
          onFocus={onFocus}
        />
      ))}
    </div>
  );
});

/**
 * The distance rings' names, laid over the canvas as the bodies' are; DistanceRings moves
 * them. Quieter than a body's name, because a ring is a ruler and not a thing.
 */
function RingLabels({ elements }: { elements: RefObject<(HTMLElement | null)[]> }) {
  return (
    <div style={LABEL_LAYER_STYLE}>
      {DISTANCE_RINGS_LY.map((lightYears, index) => (
        <span
          key={lightYears}
          className="tracks-scene"
          ref={(element) => {
            elements.current[index] = element;
          }}
          style={RING_LABEL_STYLE}
        >
          {ringLabel(lightYears)}
        </span>
      ))}
      {/* The census edge, last: see distanceRings.ts. Shown by the Star Map layer. */}
      <span
        className="tracks-scene"
        ref={(element) => {
          elements.current[DISTANCE_RINGS_LY.length] = element;
        }}
        style={CENSUS_LABEL_STYLE}
      >
        {CENSUS_EDGE_LABEL}
      </span>
    </div>
  );
}

/**
 * The Milky Way model's names -- the Galactic Centre and the arms -- laid over the canvas;
 * MilkyWay moves them. In the rulers' quiet style, and in italics: they name parts of a
 * model, not bodies.
 */
function GalaxyLabels({ elements }: { elements: RefObject<(HTMLElement | null)[]> }) {
  return (
    <div style={LABEL_LAYER_STYLE}>
      {GALAXY_LABELS.map((name, index) => (
        <span
          key={name}
          className="tracks-scene"
          ref={(element) => {
            elements.current[index] = element;
          }}
          style={GALAXY_LABEL_STYLE}
        >
          {name}
        </span>
      ))}
    </div>
  );
}

/**
 * The names of the orbits laid over Sgr A* for scale (HorizonScale): in the rulers' quiet
 * style, since they are rulers.
 */
function HorizonScaleLabels({ elements }: { elements: RefObject<(HTMLElement | null)[]> }) {
  return (
    <div style={LABEL_LAYER_STYLE}>
      {HORIZON_SCALE_RINGS.map((ring, index) => (
        <span
          key={ring.label}
          className="tracks-scene"
          ref={(element) => {
            elements.current[index] = element;
          }}
          style={RING_LABEL_STYLE}
        >
          {ring.label}
        </span>
      ))}
    </div>
  );
}

const BodyLabel = memo(function BodyLabel({
  body,
  focused,
  elementRef,
  onFocus,
}: {
  body: BodyDefinition;
  focused: boolean;
  elementRef: (element: HTMLElement | null) => void;
  onFocus: (id: BodyId) => void;
}) {
  return (
    <button
      type="button"
      // The frame loop writes this element's transform sixty times a second, so the
      // stylesheet must keep its hands off that property. See index.css.
      className="tracks-scene"
      ref={elementRef}
      onClick={() => onFocus(body.id)}
      style={focused ? FOCUSED_LABEL_STYLE : LABEL_STYLE}
    >
      <span data-label-name="">{body.name}</span>
      {/* Shown instead of the name when the label stands for more than its body: a whole
          star system seen from afar, or Alpha Centauri's pair (LabelProjector). */}
      <span data-label-alt="" style={{ display: 'none' }} />
    </button>
  );
});

const LABEL_LAYER_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
};

/**
 * A label's look. `display` starts as none and belongs to the frame loop from then on.
 * It is the same in both objects, so React -- which writes only what differs between the
 * old style and the new -- never puts it back when the focus moves.
 */
const LABEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  display: 'none',
  background: 'transparent',
  border: 'none',
  padding: '0.15rem 0.2rem',
  margin: 0,
  color: '#c0c0c0',
  fontFamily: 'inherit',
  fontSize: '0.72rem',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  pointerEvents: 'auto',
  textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
};

const FOCUSED_LABEL_STYLE: React.CSSProperties = { ...LABEL_STYLE, color: '#ffffff' };

const RING_LABEL_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  display: 'none',
  color: '#8a96a3',
  fontSize: '0.64rem',
  letterSpacing: '0.12em',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
};

const CENSUS_LABEL_STYLE: React.CSSProperties = { ...RING_LABEL_STYLE, color: CENSUS_EDGE_COLOR };

const GALAXY_LABEL_STYLE: React.CSSProperties = {
  ...RING_LABEL_STYLE,
  color: '#9aa4b4',
  fontStyle: 'italic',
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.9rem',
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
}
