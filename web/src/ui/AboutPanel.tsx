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
            'Earth’s city lights come up where the Sun is more than 18° below the horizon — the end of astronomical twilight — so they trail the terminator by about 2000 km instead of switching on at it. VIIRS Day/Night Band, 2012.',
            'Earth has a real sky. Rayleigh scattering, ray-marched through an exponential atmosphere, with the scattering coefficient computed from the refractive index of air rather than picked to look right — it reproduces the published optical depth of Earth’s atmosphere at 550 nm to three parts in a thousand. That is why the haze is strongest at the limb, where a ray crosses seventy times more air than it does looking straight down, and why the band above the terminator goes orange: on a path that long, blue has already been scattered away.',
            'Sunsets, from the same physics rather than from a colour ramp. The sunlight reaching the ground and the clouds is attenuated by the air it came down through, so it loses a fifth of its blue at noon and almost all of it near the terminator: the light there is rgb(255, 106, 3) at a quarter of its strength. That is what turns the clouds amber on the daylit side of the line.',
            'Earth’s oceans are as rough as Cox and Munk measured the sea to be from its sun glitter, and reflect at water’s refractive index rather than the generic one every renderer assumes. That is what puts a real glint on the water and none on the land.',
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
            'Surface maps are composites, not registered cartographic products — NASA imagery with colour and contrast added by its authors, so they read more vividly than a camera would. On the flattened bodies a feature can sit about 1.5° from its true latitude; Saturn is the worst, Earth and Mars are under 0.1°.',
            'Pluto’s southern hemisphere is invented. New Horizons could not photograph it — it was in polar winter during the 2015 flyby — so it is filled with the average colour of the rest rather than left black. Nothing south of about 40°S on Pluto is an observation.',
            'Saturn’s rings are at real radii, lying in its real equatorial plane — which is why they open and close as it orbits. The ring map is a radial strip whose radii are not published, so they were fitted from the image against surveyed ring boundaries: good to about 1400 km, which is wider than the Encke Gap it draws. Every division is present and roughly placed, none at a surveyed radius.',
            'Saturn’s rings are drawn at a constant brightness — the one place here that is knowingly not measured. Their radii, plane, shadow and band structure are all real; only the light model is faked. A physical one was built and corrected four times and still brightened 3.6× too much seen edge-on, where the reference images do not brighten at all. Getting it right needs a measured particle phase curve and a proper multiple-scattering solution, which is a project of its own.',
            'Saturn casts its real shadow across the rings, from its oblate silhouette. With the Sun near the ring plane, as now, it reaches about 431,000 km and crosses the whole system; with the rings wide open it barely reaches them.',
            'The rings cast their real shadow back onto Saturn, from their own optical depth along the Sun’s path — so the band sweeps across the planet over its 29.5-year year and swaps hemispheres at equinox. How dark it gets is calibrated rather than derived: the light reaching a shadowed point indirectly is one constant standing in for ringshine and diffuse transmission.',
            'Earth’s cloud deck is a fixed composite of MODIS passes from 2001, never the weather on the date shown. It sits 5 km up — one global mean standing in for everything from 1 km of stratocumulus to 15 km of tropical anvil — and drifts west at the equatorial trade-wind speed. A rigid deck cannot do winds that reverse with latitude, so that drift is right at the equator and wrong at 45°. Its opacity is read as an optical depth rather than straight off the file, since what the composite measures is how much cloud is in the column and not how much light gets through it.',
            'The colour of the city lights is invented, because the instrument had none to give: the Day/Night Band is a single broad channel, so it measures how much light and not what colour. The amber is the chromaticity of high-pressure sodium street lighting, which is what most of the world was lit by in 2012 and is being replaced by white LEDs as you read this.',
            'How bright those lights are drawn is chosen, like the ring brightness. A city seen from orbit is about five orders of magnitude fainter than the same ground at noon; scaled honestly against the daylit side, every one of them would be black.',
            'Earth’s surface map is drawn 30% less saturated than the file it comes from. The file is an illustrative composite with colour added by its authors, and it reads more vividly than a camera would. How much to take off is a judgement, set by eye against NASA’s render; the correction is applied when drawing, never to the image on disk.',
            'The sky is single-scattering only, and has no aerosols, no ozone and no refraction. So it under-lights the deep blue and the twilight band, has none of the white haze that hangs low in a real atmosphere, and lets the Sun set about half a degree late. Aerosol loading is the reason the easy one is missing: it varies tenfold with place and season, so it would be the first fitted number in a model that currently has none.',
            'Earth’s land/water mask is derived rather than published — from the flat colour NASA fills deep water with in one of its maps, read as a coverage fraction so the shoreline is not drawn as the staircase the 20 km grid makes. It lands at 69.7% water against the true 70.8%, because that map draws the shallow continental shelves instead of filling them, so a rim of every coast counts as land.',
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
