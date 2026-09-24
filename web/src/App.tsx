import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { DistanceMode } from './core/ephemerisStore.ts';
import { useSimulation } from './core/useSimulation.ts';
import { SolarSystemCanvas } from './scene/SolarSystemCanvas.tsx';
import { useViewStore } from './state/store.ts';
import { AboutPanel } from './ui/AboutPanel.tsx';
import { InfoPanel } from './ui/InfoPanel.tsx';
import { LayersPanel } from './ui/LayersPanel.tsx';
import { LightingPanel } from './ui/LightingPanel.tsx';
import { Presence } from './ui/Presence.tsx';
import { ReadoutPanel } from './ui/ReadoutPanel.tsx';
import { TimeControls } from './ui/TimeControls.tsx';
import { Toolbar } from './ui/Toolbar.tsx';

/**
 * Step 4 -- the interface.
 *
 * Layout follows NASA Eyes: breadcrumb top-left, time controls bottom-left, tool
 * rail on the right, panels sliding out beside it. Labels are HTML positioned by the
 * scene each frame rather than sprites, which keeps them crisp and clickable.
 */

/** Which catalog `kind` values each layer switch controls. */
const LAYER_KINDS: Record<string, readonly string[]> = {
  planets: ['planet', 'star'],
  dwarfPlanets: ['dwarf-planet'],
  moons: ['moon'],
  spacecraft: ['spacecraft'],
};

export function App() {
  const { store, stars, clock, error, frame } = useSimulation();
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

  // Switching a layer off while standing on one of its bodies would leave the camera
  // orbiting something that is no longer drawn. Step back to what it orbits.
  useEffect(() => {
    if (store === null) {
      return;
    }
    const body = store.body(focus);
    if (!visibleKinds.has(body.kind) && body.parent !== null) {
      setFocus(body.parent);
    }
  }, [store, focus, visibleKinds, setFocus]);

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

  const jd = clock.tdbJulianDay;
  // Exact for what is on screen. The moons' window is two years and the planets'
  // twenty, so the answer depends on whether the moons are shown at all.
  const exact = store.isExactAt(
    jd,
    store.bodies.filter((body) => visibleKinds.has(body.kind)).map((body) => body.id),
  );
  const uiVisible = layers.userInterface;

  // The system the picker's second row lists: the focused planet's, or the planet a
  // focused moon belongs to.
  const focusBody = store.body(focus);
  const system = focusBody.parent ?? focusBody.id;
  const systemMoons = visibleKinds.has('moon')
    ? store.bodies.filter((body) => body.parent === system)
    : [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <SolarSystemCanvas
        store={store}
        stars={stars}
        clock={clock}
        focus={focus}
        showOrbits={layers.orbits}
        showIcons={layers.icons}
        showLabels={layers.labels && uiVisible}
        lighting={lighting}
        visibleKinds={visibleKinds}
        labelElements={labelElements}
      />

      {/* Label layer. The scene writes transforms into these nodes every frame. */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {store.bodies.map((body) => (
          <button
            key={body.id}
            type="button"
            // The frame loop writes this element's transform sixty times a second, so the
            // stylesheet must keep its hands off that property. See index.css.
            className="tracks-scene"
            ref={(element) => {
              labelElements.current.set(body.id, element);
            }}
            onClick={() => setFocus(body.id)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              display: 'none',
              background: 'transparent',
              border: 'none',
              padding: '0.15rem 0.2rem',
              margin: 0,
              color: body.id === focus ? '#ffffff' : '#c0c0c0',
              fontFamily: 'inherit',
              fontSize: '0.72rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              pointerEvents: 'auto',
              textShadow: '0 0 6px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)',
            }}
          >
            {body.name}
          </button>
        ))}
      </div>

      {uiVisible && (
        <>
          {/* Top-left: breadcrumb and body picker. */}
          <div style={{ position: 'absolute', top: '1rem', left: '1.25rem' }}>
            <div
              style={{
                letterSpacing: '0.22em',
                fontSize: '0.78rem',
                color: '#c8c8c8',
                textTransform: 'uppercase',
              }}
            >
              Solar System <span style={{ color: '#4a4a4a' }}>&rsaquo;</span>{' '}
              <span style={{ color: '#fff' }}>{store.body(focus).name}</span>
            </div>
            <div
              style={{
                marginTop: '0.6rem',
                display: 'flex',
                gap: '0.3rem',
                flexWrap: 'wrap',
                maxWidth: '28rem',
              }}
            >
              {store.bodies
                .filter((body) => body.parent === null && visibleKinds.has(body.kind))
                .map((body) => (
                  <BodyButton
                    key={body.id}
                    body={body}
                    active={body.id === focus || body.id === system}
                    onClick={() => setFocus(body.id)}
                  />
                ))}
            </div>
            {/* The moons of whichever system is in focus. Twenty-one of them in the row
                above would bury the planets; here they are the ones you are near. */}
            {systemMoons.length > 0 && (
              <div
                style={{
                  marginTop: '0.3rem',
                  display: 'flex',
                  gap: '0.3rem',
                  flexWrap: 'wrap',
                  maxWidth: '28rem',
                }}
              >
                {systemMoons.map((body) => (
                  <BodyButton
                    key={body.id}
                    body={body}
                    active={body.id === focus}
                    onClick={() => setFocus(body.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Bottom-left: time. */}
          <div style={{ position: 'absolute', bottom: '1.25rem', left: '1.25rem' }}>
            <TimeControls clock={clock} exact={exact} tick={frame} />
          </div>

          <Toolbar />

          {/* Each panel stays mounted for its closing animation; see Presence.tsx. */}
          <Presence show={openPanel === 'body'}>
            <InfoPanel store={store} jd={jd} distanceMode={distanceMode} tick={frame} />
          </Presence>
          <Presence show={openPanel === 'layers'}>
            <LayersPanel />
          </Presence>
          <Presence show={openPanel === 'lighting'}>
            <LightingPanel />
          </Presence>
          <Presence show={openPanel === 'readout'}>
            <ReadoutPanel
              store={store}
              jd={jd}
              distanceMode={distanceMode}
              onDistanceMode={setDistanceMode}
              visibleKinds={visibleKinds}
              tick={frame}
            />
          </Presence>
        </>
      )}

      <Presence show={openPanel === 'about'}>
        <AboutPanel store={store} stars={stars} />
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

function BodyButton({
  body,
  active,
  onClick,
}: {
  body: BodyDefinition;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? '#1e2a24' : 'rgba(0,0,0,0.4)',
        border: `1px solid ${active ? '#3ddc84' : '#2a2a2a'}`,
        color: active ? '#3ddc84' : '#8a8a8a',
        padding: '0.24rem 0.55rem',
        fontSize: '0.68rem',
        letterSpacing: '0.06em',
        cursor: 'pointer',
        fontFamily: 'inherit',
        borderRadius: '0.2rem',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: body.color, marginRight: '0.35rem' }}>&#9679;</span>
      {body.name}
    </button>
  );
}

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
