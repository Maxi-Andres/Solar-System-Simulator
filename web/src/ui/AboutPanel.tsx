import { useCallback, useEffect, useRef, useState } from 'react';

import type { StarCatalog } from '@sss/tools/types';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { useViewStore } from '../state/store.ts';

/**
 * The welcome / about screen.
 *
 * Deliberately says what this is and — more importantly — what it is not. A viewer
 * looking at a to-scale Solar System deserves to know which parts are measured and
 * which are approximated, so the honest caveats sit here rather than buried in the
 * source.
 *
 * ## Why the scrolling is built by hand
 *
 * This is a long read on a full-bleed dark overlay, and the browser's own furniture
 * does it badly. Two things were wrong and both had the same cause — the close button
 * and the scrollbar were being left to the default behaviour of a scrolling box:
 *
 *  - **Close scrolled away with the text.** It was positioned against the scroll
 *    container, which means it moves with the content, so reading to the end left the
 *    only way out somewhere off the top of the screen. It is now a sibling of the
 *    scrolling region rather than a child of it, which is the fix that needs no
 *    `position: fixed` and no z-index argument.
 *  - **The scrollbar is gone**, replaced by a ring that fills as you read. A scrollbar
 *    on a page of thin greys is a bright vertical rule down one edge, and it answers
 *    "where am I" without ever answering "is there more".
 */
export function AboutPanel({ store, stars }: { store: EphemerisStore; stars: StarCatalog }) {
  const closePanel = useViewStore((state) => state.closePanel);
  const { window: windowInfo, source } = store.manifest;
  const scroller = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState<ScrollState>({ progress: 0, scrollable: false });

  const measure = useCallback(() => {
    const element = scroller.current;
    if (element !== null) {
      setScroll(scrollState(element.scrollTop, element.scrollHeight, element.clientHeight));
    }
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (element === null) {
      return;
    }
    measure();
    element.addEventListener('scroll', measure, { passive: true });
    // Content reflows when the window narrows, which changes both numbers.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) {
      observer.observe(child);
    }
    return () => {
      element.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  /** One screenful down, so the ring is a control and not only a readout. */
  const pageDown = () => {
    const element = scroller.current;
    element?.scrollBy({ top: element.clientHeight * 0.85, behavior: 'smooth' });
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(4,4,6,0.93)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        ref={scroller}
        className="scroll-hidden"
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          // Not the default `stretch`, and this is why the bottom padding kept
          // disappearing: a stretched flex item is sized to the container, so once the
          // text is longer than the window the content spills out of the item and the
          // item's own padding-bottom stays up at the fold instead of following the
          // last line down.
          alignItems: 'flex-start',
        }}
      >
        <div style={{ maxWidth: '46rem', padding: '3rem 2rem 7rem', width: '100%' }}>
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
              'Twenty-one moons — every one massive enough to have pulled itself round, plus Phobos and Deimos — from JPL’s own satellite ephemerides, measured from their planet’s centre. Each is sampled finely enough to land within a hundredth of its own radius, which for Phobos, round Mars every 7 hours 39 minutes, means every fifteen minutes. Its worst error is 48 metres.',
              'Radii and polar flattening from the IAU 2015 report — Saturn really is 9.8% shorter pole to pole.',
              'Rotation at each body’s real sidereal rate, retrograde where it is retrograde: Venus, Uranus and Pluto.',
              'Axis direction and prime meridian from the IAU rotational elements, so each body is turned the way it is actually turned. Checked against JPL’s own sub-solar point for every planet: worst disagreement 0.0026°.',
              'The moons are turned and shaped the same way, from the IAU model in the form JPL publishes it — every periodic term kept, because some are anything but small: Mimas’s face swings 45° over 71 years, dragged by its resonance with Tethys, and Triton’s pole circles by 32°. Each is the real triaxial shape, long axis on its planet: Phobos is 26 by 23 by 18 km. Checked against JPL for all twenty-one: poles within 0.002°, and the face each turns to its planet within 0.007°.',
              'Surface maps registered to that axis, checked against the images’ own pixels. Earth’s noon really falls on Greenwich, and the daylit half is the half that should be lit.',
              'Earth’s city lights come up where the Sun is more than 18° below the horizon — the end of astronomical twilight — so they trail the terminator by about 2000 km instead of switching on at it. VIIRS Day/Night Band, 2012.',
              'Earth has a real sky. Rayleigh scattering, ray-marched through an exponential atmosphere, with the scattering coefficient computed from the refractive index of air rather than picked to look right — it reproduces the published optical depth of Earth’s atmosphere at 550 nm to three parts in a thousand. That is why the haze is strongest at the limb, where a ray crosses seventy times more air than it does looking straight down, and why the band above the terminator goes orange: on a path that long, blue has already been scattered away.',
              'Sunsets, from the same physics rather than from a colour ramp. The sunlight reaching the ground and the clouds is attenuated by the air it came down through, so it loses a fifth of its blue at noon and almost all of it near the terminator: the light there is rgb(255, 106, 3) at a quarter of its strength. That is what turns the clouds amber on the daylit side of the line.',
              'Earth’s oceans are as rough as Cox and Munk measured the sea to be from its sun glitter, and reflect at water’s refractive index rather than the generic one every renderer assumes. That is what puts a real glint on the water and none on the land.',
              'Orbits drawn as osculating ellipses around whatever each body orbits — the Sun for a planet, the planet alone for a moon — re-derived from the body’s own state as it moves, so the line always passes through it.',
              `The sky is ESA’s Hipparcos and Tycho-2 catalogues together: every one of the ${stars.count.toLocaleString('en-US')} stars down to magnitude ${stars.magnitudeLimit} is a real star, at its own right ascension and declination, moving at its own proper motion, and coloured from its own measured B−V through Planck’s law and the CIE observer — so Betelgeuse is orange because it is 3,600 K. The check is Orion’s belt: nobody arranged those three stars, and if the epoch shift and the rotation into the ecliptic are right they land in a row on their own. They do, with Alnilam 0.09° off the line across a 2.74° span, which is the sky’s own figure.`,
              'The Sun has glare, and its shape is a measurement of the eye rather than a bloom filter. Most of what you see around the Sun is not coming from the Sun’s direction at all — it is its light scattered sideways inside whatever is looking. That scatter has been measured for a century, and the CIE disability-glare equation describes it: the veil falls as 10/θ³ + 5/θ², with θ in degrees. It follows the inverse square law on its own, so the halo is 3.9° wide from Mercury’s orbit, 1.8° from Earth’s and 0.34° from Saturn’s with nothing animating it, and it takes the Sun’s own colour because scattered sunlight is still sunlight.',
              'The Sun’s disc is overexposed, and that is the physical answer rather than a stylistic one. Its photosphere radiates σT⁴/π, which at 5,772 K is 154,000 times the radiance of the sunlit Earth this scene’s exposure is set for — so a correct render of the Sun is a flat white circle with nothing in it. It is drawn at 45 times full scale, which is still three and a half thousand times *under* the true value, chosen so red clips across the whole map and what survives of the granulation is in the blue channel. The disc then averages 255, 249, 60 on screen; reading NASA’s own render of the Sun pixel by pixel gives 255, 249, 59.',
            'Light time and relative speeds, computed from the same vectors.',
            ]}
          />

          <Section>What is approximated</Section>
          <List
            items={[
              `How bright a star is drawn is compressed, and that is this picture’s exposure. The sky spans about thirteen orders of magnitude and a screen has three, so every image of space chooses which three to show; here the brightest star in the catalogue is white, the faintest at magnitude ${stars.magnitudeLimit} is at 2% of it — five code values out of 255, which is what a limiting magnitude already means — and the response between them is linear in magnitude — the eye’s own scale, which is what the magnitude system was built from. Sirius outshines a magnitude ${stars.magnitudeLimit} star by nearly six thousand to one in the sky and by fifty to one here. Size is not a separate setting: it is where a star’s point spread falls below the darkest step a display can show. That spread is a Gaussian core 0.54 pixels wide plus a power-law tail carrying a tenth of the light — the same shape as the Sun’s glare, because every real optical system scatters a few percent of a source into a halo and a Gaussian alone cannot. Both are measured against NASA’s render: the core reproduces its median star at 2.26 pixels, and the tail was solved from its brightest, 13.5 pixels across, which a Gaussian could not have taken past 4.2. Solving the two frames against each other — the brightest stars all falling under one transform — also says that render was at a 30.6° field where this is at 27°, which is why its sky reads a little tighter than this one at the same number of stars.`,
              'Stars sit on a sphere rather than at their real distances, so there is no parallax. The nearest star drawn would move 0.742 arcseconds from one side of Earth’s orbit to the other, which is under a hundredth of a pixel. Real distances come with the nearby-star work, not here.',
              'A photographic Milky Way panorama was tried behind the stars and taken out again. It was correctly placed — on the galactic frame, checked against Sagittarius A*, Andromeda and both Magellanic Clouds — and still wrong: a photograph’s stars arrive already blurred by an atmosphere and a lens, so no resolution turns them back into points. It lit 31.8% of the sky where the reference lights 0.9%.',
              'The Sun’s glare has no brightness setting at all: the veil is the illuminance the disc delivers, E = L·π·sin²θ, so it is tied to whatever exposure the disc is drawn at and cannot drift from it. What still differs from NASA’s render is how fast it falls — theirs goes as θ⁻³·⁵ where the eye’s equation is between θ⁻³ and θ⁻², so their glow ends at 1.72° from Earth’s distance and this one reaches 3.6°. An optical instrument is tighter than an eye: most of the eye’s veil is scattered inside the eye itself, and a lens has no retina.',
              'Flood and Shadow lighting are legibility aids. Only Natural lighting is physical.',
              'Outside the downloaded window the app falls back to Keplerian propagation and says APPROXIMATE while it does. The moons have a narrower window than the planets — a year either side of the build, against ten — because Phobos alone needs 35,000 samples a year. Their data arrives in pieces as the clock reaches it, so a moon can be missing for a moment, never misplaced.',
              'The moons are mostly grey, because that is how they were mapped: Galileo, Cassini and Voyager photographed them through clear filters, and the colour versions that exist are enhanced into the ultraviolet and infrared. The Moon is in natural colour, Titan is its surface at 938 nm seen through the haze, and Io and Triton carry uncalibrated mission colour.',
              'Several moons were half in darkness when they were photographed: the northern hemispheres of Uranus’s five and of Triton when Voyager 2 passed, Charon’s south for New Horizons. Like Pluto’s south, those areas are filled with the average of what was seen. Nothing there is an observation.',
              'Deimos has no map. The only global one cannot be placed — its two sources disagree about where longitude zero is — so it is drawn in flat colour rather than possibly half a turn wrong.',
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
              'The sky is single-scattering only, and the cost of that is measurable rather than theoretical: held against NASA’s render, the last stretch of the fade into night — from a tenth of full brightness down to black — takes 4.5% of Earth’s radius here against their 9.9%. The twilight glow past the terminator comes out about six times too faint and far too red, where theirs is a neutral grey. Both are the signature of the same gap: after several bounces a spectrum flattens, and light that a single-scattering model throws away is still in the air. Closing it needs precomputed multiple scattering, which is a piece of work in its own right.',
              'It also has no aerosols, no ozone and no refraction, so there is none of the white haze that hangs low in a real atmosphere and the Sun sets about half a degree late. Aerosols are the reason the easy one is missing: their loading varies tenfold with place and season, so it would be the first fitted number in a model that currently has none.',
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
            {windowInfo.startUtc.slice(0, 10)} to {windowInfo.stopUtc.slice(0, 10)}, and a year
            either side of the build for the fast moons; outside that range positions are
            propagated and flagged. Frame is barycentric, ecliptic of J2000.
          </Prose>

          <Prose>
            Stars from <Strong>ESA Hipparcos</Strong> (1997) and <Strong>Tycho-2</Strong> (2000),
            read through the <Strong>VizieR</Strong> service at CDS Strasbourg:{' '}
            {stars.count.toLocaleString('en-US')} stars complete to magnitude{' '}
            {stars.magnitudeLimit}, positions at J2000 and carried to the date on screen by their
            own proper motions. Neither catalogue is a sky on its own — Tycho-2 is missing the
            brightest stars, whose light saturated its star mapper, and Hipparcos never completed
            the faint ones — so{' '}
            {stars.sources.map((source) => `${source.stars.toLocaleString('en-US')} from ${source.table}`).join(' and ')}.
          </Prose>

          <Prose>
            Courtesy of <Strong>NASA/JPL-Caltech</Strong>, Solar System Dynamics Group. This
            project is not affiliated with or endorsed by NASA or JPL.
          </Prose>
        </div>
      </div>

      {/*
        Outside the scrolling region, so they stay put. Both were children of it once,
        which is why Close used to disappear as soon as anyone read past the first
        screen.
      */}
      <button
        type="button"
        onClick={closePanel}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: '1.4rem',
          right: '1.6rem',
          background: 'rgba(4,4,6,0.8)',
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

      <ScrollProgress
        progress={scroll.progress}
        visible={scroll.scrollable}
        onClick={pageDown}
      />
    </div>
  );
}

/** Radius of the progress ring, in the SVG's own units. */
const RING_RADIUS = 13;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * How much of the page is behind you, and that there is a page at all.
 *
 * A ring rather than a bar, at the foot of the column rather than down the edge: on a
 * screen this dark a vertical rule reads as a piece of the design, and a small mark
 * where the text runs out reads as an invitation. It is a button as well as a readout —
 * the arrow is the part that says "there is more", and pressing it acts on that.
 *
 * It fades out over the last stretch rather than at the very end, so it is gone by the
 * time it would be sitting on top of the last paragraph with nothing left to report.
 */
function ScrollProgress({
  progress,
  visible,
  onClick,
}: {
  progress: number;
  visible: boolean;
  onClick: () => void;
}) {
  const opacity = visible ? indicatorOpacity(progress) : 0;

  return (
    // The centring lives on a wrapper rather than on the button, so the button's own
    // transform is free for the press animation every control here shares. A `transform`
    // set inline would beat the stylesheet's and swallow it.
    <div
      style={{
        position: 'absolute',
        bottom: '1.6rem',
        left: '50%',
        transform: 'translateX(-50%)',
        opacity,
        // Untouchable once invisible, so it cannot swallow a click on the text beneath.
        pointerEvents: opacity === 0 ? 'none' : 'auto',
        transition: 'opacity 220ms ease',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label="Scroll down"
        aria-hidden={opacity === 0}
        style={{
          display: 'grid',
          placeItems: 'center',
          width: '2.6rem',
          height: '2.6rem',
          padding: 0,
          background: 'rgba(4,4,6,0.8)',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
        }}
      >
        <svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
          {/* The track, so the ring reads as a fraction of something rather than an arc. */}
          <circle cx="16" cy="16" r={RING_RADIUS} fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
          <circle
            cx="16"
            cy="16"
            r={RING_RADIUS}
            fill="none"
            stroke="#8a8a8a"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
            // Start the fill at the top and run it clockwise, the way reading runs.
            transform="rotate(-90 16 16)"
          />
          <polyline
            points="12,14 16,19 20,14"
            fill="none"
            stroke="#8a8a8a"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export interface ScrollState {
  /** 0 at the top, 1 once the last line is on screen. */
  readonly progress: number;
  /** False when everything already fits, in which case there is nothing to report. */
  readonly scrollable: boolean;
}

/**
 * Where the reader is, from the three numbers a scrolling element exposes.
 *
 * Pulled out of the component because every interesting case here is an edge case and
 * none of them is reachable from a test that has to render a browser: a page that fits,
 * a page one pixel taller than the window, and the rubber-band overscroll that macOS
 * and iOS report as a negative `scrollTop` or as a `scrollTop` past the end.
 */
export function scrollState(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): ScrollState {
  const travel = scrollHeight - clientHeight;
  // A pixel of slack: sub-pixel layout rounding routinely leaves a scrollHeight a
  // fraction taller than the client, and a ring that appears full on a page nobody can
  // scroll is worse than no ring.
  if (travel <= 1) {
    return { progress: 1, scrollable: false };
  }
  return { progress: Math.min(1, Math.max(0, scrollTop / travel)), scrollable: true };
}

/**
 * Fraction of the reading at which the indicator starts getting out of the way.
 *
 * Not at the very end: the last paragraph is the one it would be sitting on top of, and
 * by then it has nothing left to say.
 */
export const INDICATOR_FADE_START = 0.88;

/** How visible the ring is at a given progress, 1 to 0. */
export function indicatorOpacity(progress: number): number {
  if (progress <= INDICATOR_FADE_START) {
    return 1;
  }
  return Math.max(0, 1 - (progress - INDICATOR_FADE_START) / (1 - INDICATOR_FADE_START));
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
