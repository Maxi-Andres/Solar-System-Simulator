import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { useViewStore } from '../state/store.ts';

/**
 * The welcome / about screen.
 *
 * Deliberately says what this is and — more importantly — what it is not. A viewer
 * looking at a to-scale Solar System deserves to know which parts are measured and
 * which are approximated, so the honest caveats sit here rather than buried in the
 * source.
 */
export function AboutPanel({ store }: { store: EphemerisStore }) {
  const closePanel = useViewStore((state) => state.closePanel);
  const { window: windowInfo, source } = store.manifest;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(4,4,6,0.93)',
        backdropFilter: 'blur(3px)',
        overflowY: 'auto',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: '46rem', padding: '3rem 2rem 4rem', width: '100%' }}>
        <button
          type="button"
          onClick={closePanel}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '1.4rem',
            right: '1.6rem',
            background: 'transparent',
            border: '1px solid #2a2a2a',
            borderRadius: '0.3rem',
            color: '#8a8a8a',
            cursor: 'pointer',
            padding: '0.3rem 0.7rem',
            fontFamily: 'inherit',
            fontSize: '0.72rem',
            letterSpacing: '0.1em',
          }}
        >
          CLOSE
        </button>

        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 300,
            textAlign: 'center',
            letterSpacing: '0.02em',
            color: '#f0f0f0',
          }}
        >
          Max&rsquo;s Solar System
        </h1>
        <div style={{ height: 1, background: '#2a2a2a', margin: '1.1rem 0' }} />
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(1rem, 2.4vw, 1.3rem)',
            fontWeight: 300,
            textAlign: 'center',
            color: '#b8b8b8',
          }}
        >
          Real-time, real data, real scale
        </h2>
        <div style={{ height: 1, background: '#2a2a2a', margin: '1.1rem 0 1.8rem' }} />

        <Prose>
          Every position you see comes from <Strong>NASA/JPL Horizons</Strong>, the same
          ephemeris service mission planners use. Nothing here is a simulated orbit or an
          artist&rsquo;s approximation: the planets are where DE441 says they are, moving at the
          speeds it says they move.
        </Prose>

        <Prose>
          <Strong>Distances and sizes are real and never compressed.</Strong> That is unusual,
          and it has a consequence worth understanding: at true scale the planets are
          essentially invisible. Earth seen from the Sun&rsquo;s distance is 1/20th of a pixel.
          So when a body shrinks below about three pixels it is drawn as a marker instead of a
          sphere, and it fades back into a real sphere as you approach. That marker is the only
          place this simulator departs from physical scale.
        </Prose>

        <Section>What is measured</Section>
        <List
          items={[
            'Positions and velocities, interpolated from JPL state vectors. Error against JPL at finer resolution: 32 m for Earth, 9.7 km for Mercury.',
            'Radii and polar flattening from the IAU 2015 report — Saturn really is 9.8% shorter pole to pole.',
            'Rotation at each body’s real sidereal rate, retrograde where it is retrograde: Venus, Uranus and Pluto.',
            'Axis direction and prime meridian from the IAU rotational elements, so each body is turned the way it is actually turned. Checked against JPL’s own sub-solar point for every planet: worst disagreement 0.0026°.',
            'Surface maps registered to that axis, checked against the images’ own pixels. Earth’s noon really falls on Greenwich, and the daylit half is the half that should be lit.',
            'Orbits drawn as osculating ellipses, heliocentric, recomputed each deploy.',
            'Light time and relative speeds, computed from the same vectors.',
          ]}
        />

        <Section>What is approximated</Section>
        <List
          items={[
            'The starfield is procedurally generated, not a catalog. It is the one thing on screen that is not real. Gaia data replaces it later.',
            'Flood and Shadow lighting are legibility aids. Only Natural lighting is physical.',
            'Outside the downloaded window the app falls back to Keplerian propagation and says APPROXIMATE while it does.',
            'Surface maps are illustrative composites, not registered cartographic products. On the flattened bodies a feature can sit about 1.5° from its true latitude — Saturn is the worst; Earth and Mars are under 0.1°.',
            'Pluto’s southern hemisphere is invented. New Horizons could not photograph it — it was in polar winter during the 2015 flyby — so it is filled with the average colour of the rest rather than left black. Nothing south of about 40°S on Pluto is an observation.',
            'Saturn has no rings yet, and Earth has no clouds or night lights. Both are coming.',
          ]}
        />

        <Section>Getting around</Section>
        <List
          items={[
            'Drag to rotate. There is no pole to get stuck at — in space there is no up, so the view tumbles freely in any direction.',
            'Scroll to zoom. Each notch changes distance by a fixed ratio, so a few thousand km and tens of AU are equally easy to navigate.',
            'Click any body, label or table row to focus it. The camera reframes relative to that body’s own radius.',
            'Use the time controls to run fast, run backwards, or jump back to LIVE.',
          ]}
        />

        <Section>Data</Section>
        <Prose>
          Ephemerides from <Strong>{source.name}</Strong> {source.version}, DE441, generated{' '}
          {store.generatedAt.toISOString().slice(0, 10)}. Exact coverage runs{' '}
          {windowInfo.startUtc.slice(0, 10)} to {windowInfo.stopUtc.slice(0, 10)}; outside that
          range positions are propagated and flagged. Frame is barycentric, ecliptic of J2000.
        </Prose>

        <Prose>
          Courtesy of <Strong>NASA/JPL-Caltech</Strong>, Solar System Dynamics Group. This
          project is not affiliated with or endorsed by NASA or JPL.
        </Prose>
      </div>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ color: '#a4a4a4', fontSize: '0.88rem', lineHeight: 1.75, margin: '0 0 1.1rem' }}>
      {children}
    </p>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: '#e0e0e0', fontWeight: 600 }}>{children}</strong>;
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: '1.9rem 0 0.8rem',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: '#6a6a6a',
      }}
    >
      {children}
    </h3>
  );
}

function List({ items }: { items: readonly string[] }) {
  return (
    <ul style={{ margin: '0 0 1.1rem', paddingLeft: '1.1rem' }}>
      {items.map((item) => (
        <li
          key={item}
          style={{
            color: '#a4a4a4',
            fontSize: '0.84rem',
            lineHeight: 1.7,
            marginBottom: '0.5rem',
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
