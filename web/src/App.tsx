import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { DistanceMode, EphemerisStore } from './core/ephemerisStore.ts';
import type { Signal } from './core/signal.ts';
import { useSignal } from './core/useSignal.ts';
import { useSimulation } from './core/useSimulation.ts';
import { useStoreVersion } from './core/useStoreVersion.ts';
import { isShown, SMALL_MOON_LAYER, systemOf } from './scene/floatingOrigin.ts';
import { SolarSystemCanvas } from './scene/SolarSystemCanvas.tsx';
import { useViewStore } from './state/store.ts';
import { AboutPanel } from './ui/AboutPanel.tsx';
import { BodyPicker } from './ui/BodyPicker.tsx';
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
  planets: ['planet', 'star'],
  dwarfPlanets: ['dwarf-planet'],
  asteroids: ['asteroid'],
  moons: ['moon'],
  smallMoons: [SMALL_MOON_LAYER],
  spacecraft: ['spacecraft'],
};

export function App() {
  const { store, stars, belt, clock, error, readout } = useSimulation();
  const [distanceMode, setDistanceMode] = useState<DistanceMode>('center');

  const focus = useViewStore((state) => state.focus);
  const setFocus = useViewStore((state) => state.setFocus);
  const layers = useViewStore((state) => state.layers);
  const lighting = useViewStore((state) => state.lighting);
  const openPanel = useViewStore((state) => state.openPanel);
  const setLayer = useViewStore((state) => state.setLayer);

  const labelElements = useRef<Map<BodyId, HTMLElement | null>>(new Map());

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
    return kinds;
  }, [layers]);

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

  // The belt likewise: 3 MB, asked for once the ephemerides are in -- never in the way of
  // the first view -- and only if the Asteroids layer is on. Once here it is kept.
  useEffect(() => {
    if (store !== null && visibleKinds.has('asteroid')) {
      void belt.request();
    }
  }, [store, belt, visibleKinds]);

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
      if (body.kind === 'spacecraft' && !store.isCoveredAt(focus, clock.tdbJulianDay)) {
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
        belt={belt}
        clock={clock}
        focus={focus}
        showOrbits={layers.orbits}
        showTrails={layers.trails}
        showIcons={layers.icons}
        showLabels={layers.labels && uiVisible}
        lighting={lighting}
        visibleKinds={visibleKinds}
        labelElements={labelElements}
      />

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

          {/* Each panel stays mounted for its closing animation; see Presence.tsx. */}
          <Presence show={openPanel === 'body'}>
            <OnReadout signal={readout}>
              {(tick) => (
                <InfoPanel
                  store={store}
                  jd={clock.tdbJulianDay}
                  distanceMode={distanceMode}
                  tick={tick}
                />
              )}
            </OnReadout>
          </Presence>
          <Presence show={openPanel === 'search'}>
            <SearchPanel store={store} clock={clock} focus={focus} />
          </Presence>
          <Presence show={openPanel === 'layers'}>
            <LayersPanel />
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
        <AboutPanel store={store} stars={stars} belt={belt} />
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
      {body.name}
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
