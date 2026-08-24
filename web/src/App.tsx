/**
 * Step 0 -- scaffolding.
 *
 * For now this only confirms the stack boots. In step 3 it will mount
 * <SolarSystemCanvas /> with the UI drawn on top as an overlay.
 */
export function App() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        width: '100%',
        height: '100%',
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 'clamp(1.1rem, 3.5vw, 2rem)',
          fontWeight: 700,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
        }}
      >
        Solar System
      </h1>
      <p style={{ margin: 0, fontSize: '0.8rem', letterSpacing: '0.12em', color: '#7a7a7a' }}>
        Step 0 &middot; scaffolding ready
      </p>
      <p style={{ margin: 0, fontSize: '0.7rem', letterSpacing: '0.08em', color: '#4a4a4a' }}>
        Ephemerides courtesy of NASA/JPL-Caltech
      </p>
    </div>
  );
}
