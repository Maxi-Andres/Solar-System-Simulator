import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import type { BeltClass, BeltInfo, CometInfo, SatelliteInfo, StarCatalog } from '@sss/tools/types';

import { beltTiers, type BeltSource, type LoadedTier } from '../core/belt.ts';
import type { CometSource } from '../core/comets.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { BULK_WINDOW_DAYS, NAMED_WINDOW_DAYS, type SatelliteSource } from '../core/satellites.ts';
import { ESA_MODEL_CREDIT } from '../scene/craftModels.ts';
import { useViewStore } from '../state/store.ts';
import { useClosing } from './Presence.tsx';

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
export function AboutPanel({
  store,
  stars,
  belt,
  comets,
  satellites,
}: {
  store: EphemerisStore;
  stars: StarCatalog;
  belt: BeltSource;
  comets: CometSource;
  satellites: SatelliteSource;
}) {
  const closePanel = useViewStore((state) => state.closePanel);
  // Described from its own files, so only once they have arrived -- with the Asteroids
  // layer never switched on there is no belt here to describe -- and counted from the
  // tiers in hand, so the numbers follow the density the viewer chose.
  const beltView = useSyncExternalStore(belt.subscribe, () => belt.view);
  const beltInfo = beltView.tiers.length > 0 ? beltView.info : null;
  // The same for the comets: described once they are here.
  const cometInfo = useSyncExternalStore(comets.subscribe, () => comets.comets)?.info ?? null;
  // And the satellites.
  const satelliteInfo = useSyncExternalStore(satellites.subscribe, () => satellites.value)?.info ?? null;
  const closing = useClosing();
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
      className={closing ? 'overlay-exit' : 'overlay-enter'}
      style={{
        position: 'absolute',
        inset: 0,
        // No backdrop blur over a canvas that redraws every frame; see Panel.tsx.
        background: 'rgba(4,4,6,0.96)',
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
              smallMoonSentence(store),
              smallBodySentence(store),
              ...(beltInfo === null ? [] : [beltSentence(beltInfo, beltView.tiers)]),
              `${capitalised(spelled(craftCount(store)))} spacecraft — the ones travelling between the planets, the observatories at the Lagrange points, the craft orbiting Mars, the Moon and Jupiter, two rovers and a lander on Mars, and five that ended inside the window, Cassini among them — each from its own JPL trajectory, reconstructed from tracking where it has been and predicted where it is going. A spacecraft’s path is not an orbit, so no single step can follow it: Juice cruises for months on a curve one sample a day follows well inside a kilometre, then passes 8,640 km above Earth at 13 km/s. So the sampling refines itself, down to a minute, wherever the curve would stray from JPL’s by more than its tolerance: a kilometre near a body, and away from one an angle — ten microradians seen from the nearest, 15 km at the L1 point. That is about a fortieth of a pixel from Earth, and it is what stops the sampling chasing the few-kilometre steps where JPL’s trajectory files for those craft meet, about weekly. The orbiters of Mars and the Moon are the expensive ones — MRO goes round Mars every 112 minutes, all of it within the kilometre — so they are followed for ${spelled(CLOSE_ORBIT_MONTHS)} months either side of the build rather than ten years, and are absent outside that; Juno, whose orbit takes weeks, for the whole window.`,
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
              'Spacecraft trails drawn from JPL’s samples themselves, never from an ellipse: a craft changes orbit at every flyby and an ellipse would be wrong on both sides of one. The line is held to a fixed angle — a tenth of a milliradian, a quarter of a pixel — as seen from the nearest planet, so a flyby keeps every kilometre of its detail while a cruise through empty space costs a handful of points; and around the craft itself it is redrawn every frame from the same data the craft is placed with, so it runs into the marker at any zoom. It is a trail, as NASA Eyes draws one: only where the craft has been, reaching back one period of the orbit it is on now and fading with age, so Parker Solar Probe shows the loop it has just flown — bright at the craft, gone a period ago — rather than all of them.',
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
              `A spacecraft exists only where JPL has its path: from launch, and until its trajectory ends — for a mission still flying, until its latest prediction does. Outside that it is not drawn and cannot be chosen, because there is nothing honest to propagate it with. Where JPL’s path is stitched from two trajectory files that disagree, it jumps in a single minute. ${seamSentence(store)} The jumps are JPL’s and they are kept: the craft moves across them, and its trail breaks there rather than drawing a stroke nothing flew along.`,
              `Up close, spacecraft are their agencies’ own 3D models, at their true size in metres — Europa Clipper is 30.5 m across against a 3,100 km Europa. Models courtesy of NASA. Juice, Solar Orbiter, BepiColombo, Hera, Euclid, Gaia, Mars Express and the Trace Gas Orbiter are ESA’s, used by ESA’s written permission, their geometry as ESA made it: ${ESA_MODEL_CREDIT} Lucy’s, Psyche’s, IMAP’s, ESCAPADE’s, CAPSTONE’s and Orion’s are NASA’s, from its Eyes on the Solar System, and so are Hayabusa2’s and Danuri’s — NASA’s models of JAXA’s and KARI’s craft, neither agency having published one. Where no model may be used — many craft have none published at all — the craft is a plain white box of its published size, marked NO MODEL: as long as its solar-array span, as wide as one array, as deep as its body. A box says how big a craft is and claims nothing about its shape.`,
              `Not every spacecraft is here — ${spelled(craftCount(store))} are: those between the planets, at the Lagrange points, around the Moon and Mars, on the ground on Mars, and Juno, Cassini and Akatsuki at their planets. NASA Eyes shows 174, a chosen set of science missions. JPL Horizons, the source of every path here, carries about 276 spacecraft, spent rocket stages included. Around Earth, the tens of thousands of tracked objects — communications constellations such as Starlink, weather and navigation satellites, rocket bodies and debris — are the Satellites layer’s, from the public orbital elements CelesTrak publishes.`,
              'The craft on Mars are placed, not interpolated. JPL has no ephemeris worth using for them — Horizons keeps Curiosity at its 2012 landing site, fourteen kilometres from where it has driven since — so each rover stands where NASA’s mission maps put the end of its latest drive, facing the heading they report, and turns with Mars by the same rotation the surface map is drawn with. The maps give the sol of each drive, not the hour, so the rover moves on at the end of that sol, and between drives it is drawn where the last one ended: the line behind it joins those places, and the drives themselves went their own way between them. InSight never moved; its heading is not published, and it is drawn facing north. Mars here is the smooth reference ellipsoid, with no terrain — Curiosity is really at the bottom of Gale crater, 4.5 km below it — and the planet is a sphere of flat faces that sag up to 4 km inside that ellipsoid between their corners, which at a rover’s scale is everything. So under each one the ellipsoid itself is drawn, two degrees across, with the same map on it.',
              'Which way a spacecraft in space faces is modelled, not measured. JPL’s attitude records exist for some of them, as gigabytes of binary, and for none of Pioneer, Parker or JWST. So each is drawn by the rule it flies by: Voyager, Pioneer and New Horizons keep their dish on Earth; Parker keeps its heat shield on the Sun, JWST its sunshield, and the solar-powered craft their arrays. The roll about that axis is not published at all and is a convention here.',
              ...(beltInfo === null ? [] : [beltAccuracySentence(beltInfo)]),
              ...(cometInfo === null ? [] : [cometAccuracySentence(cometInfo)]),
              satelliteAccuracySentence(satelliteInfo),
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
              'Scroll to zoom. Each notch changes distance by a fixed ratio, so a few thousand km and hundreds of AU are equally easy to navigate. It pulls back to 2,000 AU — far enough to see the Voyagers and the Pioneers with the planets a dot between them.',
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

          {cometInfo !== null && (
            <Prose>
              Comet orbits from the <Strong>{cometInfo.source.name}</Strong>, queried{' '}
              {cometInfo.source.queriedAt.slice(0, 10)}: perihelion distance and time with the
              rest of each conic, and SBDB’s total-magnitude parameters where it has them, for{' '}
              {cometInfo.count.toLocaleString('en-US')} comets.
            </Prose>
          )}

          {beltInfo !== null && (
            <Prose>
              Asteroid orbits from the <Strong>{beltInfo.source.name}</Strong>, queried{' '}
              {beltInfo.source.queriedAt.slice(0, 10)}: osculating elements for every asteroid
              brighter than absolute magnitude {beltInfo.magnitudeLimit} on an elliptic orbit,{' '}
              {beltInfo.count.toLocaleString('en-US')} of them, heliocentric in the ecliptic of
              J2000.
            </Prose>
          )}

          <Prose>
            Earth satellite orbital elements from <Strong>CelesTrak</Strong> (Dr. T.S. Kelso),
            from data originated by the US Space Force’s <Strong>18th Space Defense
            Squadron</Strong> and published on <Strong>Space-Track.org</Strong>, fetched once a day
            when the data is built and never by your browser
            {satelliteInfo === null
              ? '.'
              : `: ${satelliteInfo.count.toLocaleString('en-US')} objects, queried ${satelliteInfo.source.queriedAt.slice(0, 10)}. ${satelliteInfo.credit}`}{' '}
            Propagated with <Strong>satellite.js</Strong> (MIT licence), David Vallado’s SGP4 in
            JavaScript.
          </Prose>

          <Prose>
            Courtesy of <Strong>NASA/JPL-Caltech</Strong>, Solar System Dynamics Group; where
            Curiosity and Perseverance stand, from NASA/JPL-Caltech’s <Strong>Mars mission maps</Strong>.
            Juice’s and Hera’s models are assembled from the ESA SPICE Service’s kernel
            datasets: {'ESA SPICE Service, JUICE Operational SPICE Kernel Dataset, https://doi.org/10.5270/esa-ybmj68p'}; {'ESA SPICE Service, Hera Operational SPICE Kernel Dataset, https://doi.org/10.57780/esa-k25x2cv'}.
            This project is not affiliated with or endorsed by NASA, JPL or ESA.
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
/**
 * How far either side of the build the close orbiters are followed, months. The
 * generator's CLOSE_ORBIT_WINDOW_MONTHS, restated: the web app does not import the tools'
 * configuration, and a test holds the two equal.
 */
export const CLOSE_ORBIT_MONTHS = 3;

/**
 * The small moons, as a paragraph. Counted from the data, because a moon JPL has nothing
 * for inside its window is left out of it -- Daphnis's ephemeris stops in 2018.
 */
export function smallMoonSentence(store: EphemerisStore): string {
  // Counted from the manifest: the moons themselves are fetched only system by system.
  const counts = Object.values(store.manifest.smallMoons ?? {});
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);
  if (total === 0) {
    return '';
  }
  const sized = counts.reduce((sum, entry) => sum + entry.sized, 0);
  const saturn = store.smallMoonCount('saturn')?.count ?? 0;
  return `And ${spelled(total)} small moons: every other satellite JPL publishes, Saturn’s 128 discoveries of 2025 among them. Most are a few kilometres of dark rock on a wide, tilted, often backward orbit, and for most an orbit is all that is known — JPL gives a size for ${spelled(sized)}, and the rest are drawn as markers rather than as spheres of a size nobody has measured. Their tables hold JPL’s positions to a hundredth of their radius but never finer than a kilometre — and far out, as for the spacecraft, to ten microradians seen from the planet — since JPL itself places the faintest of them only to hundreds of kilometres; they cover three months either side of the build for the inner moons, which go round in hours, and a year for the rest; outside that they are propagated and marked approximate. A small moon’s orbit is drawn only while it is the focus — Saturn’s all together would be a tangle of ${saturn} — and they are off until the Small Moons layer is switched on. And they cost nothing until you go there: each planet’s are fetched the first time its system is entered.`;
}

/** The named small bodies about the Sun, counted and their drawn shapes named from the data. */
export function smallBodySentence(store: EphemerisStore): string {
  const small = store.bodies.filter((body) => body.sampling !== undefined && body.parent === null);
  const drawn = small.filter((body) => body.shapeDrawn !== false);
  const listed = (names: readonly string[]) =>
    names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const round = listed(drawn.filter((body) => body.shapeModel === undefined).map((body) => body.name));
  const modelled = listed(drawn.filter((body) => body.shapeModel !== undefined).map((body) => body.name));
  const models =
    modelled === ''
      ? ' The irregular ones are markers until their shape models are in.'
      : ` ${modelled} are drawn from their mission teams’ own shape models — OSIRIS-REx’s, Hayabusa2’s, DART’s, New Horizons’ and Lucy’s — at true size, turned by the rotation of the very frame each model is published in, Bennu and Ryugu with their missions’ global maps draped on them and scaled to their measured albedo: Bennu reflects 4.4% of the light that falls on it. Ryugu’s model and map are ISAS/JAXA’s, converted and compressed here; its map’s images JAXA, University of Tokyo & collaborators’. Where a spin is known only near a flyby, the info panel says so. The rest, a tumbling peanut or a body no team has published a shape of, are markers.`;
  return `${capitalised(spelled(small.length))} named small bodies — the other dwarf planets, the largest asteroids, and the ones spacecraft here have visited or are flying to, Apophis for its 2029 pass inside the geostationary ring — from JPL’s own integrations rather than propagated elements, held to a kilometre everywhere because the craft fly beside them. Sizes, masses and spins from JPL’s Small-Body Database and the papers it cites. A shape is drawn only where one can be honestly: ${round} from their radii and rotation.${models}`;
}

/** Julian day to a calendar date, YYYY-MM-DD; a day's precision is all prose needs. */
function jdToDate(jd: number): string {
  return new Date((jd - 2440587.5) * 86_400_000).toISOString().slice(0, 10);
}

/** How many of the loaded asteroids are in any of `classes`. */
function classTotal(tiers: readonly LoadedTier[], classes: readonly BeltClass[]): number {
  let total = 0;
  for (const tier of tiers) {
    for (const name of classes) {
      total += tier.classCounts[name] ?? 0;
    }
  }
  return total;
}

/**
 * Geometric albedo the prose turns an absolute magnitude into a size at. A middling
 * value: the dark C-types are at 0.05 and the stony S-types at 0.25, so any one size
 * for an H is a factor of 1.5 either way, and is said as "about".
 */
const PROSE_ALBEDO = 0.1;

/** Diameter in km for an absolute magnitude: D = 1329 km / sqrt(albedo) · 10^(-H/5). */
export function diameterKm(H: number, albedo = PROSE_ALBEDO): number {
  return (1329 / Math.sqrt(albedo)) * 10 ** (-H / 5);
}

/** "about 4 km", "about 1.7 km": whole kilometres from two up. */
function aboutKm(H: number): string {
  const km = diameterKm(H);
  return `about ${km >= 2 ? Math.round(km) : km.toFixed(1)} km`;
}

/**
 * The belt, as a paragraph: counted from the tiers in hand, as the moons are from their
 * files -- so with the first tier alone it is 84,000 asteroids and says what the rest are.
 */
export function beltSentence(info: BeltInfo, tiers: readonly LoadedTier[]): string {
  const groups = [
    [classTotal(tiers, ['MBA', 'IMB', 'OMB']), 'in the main belt'],
    [classTotal(tiers, ['TJN']), 'Jupiter Trojans, sharing its orbit 60° ahead and behind'],
    [classTotal(tiers, ['MCA']), 'Mars-crossers'],
    [classTotal(tiers, ['APO', 'ATE', 'AMO', 'IEO']), 'near-Earth asteroids'],
    [classTotal(tiers, ['CEN']), 'centaurs among the giant planets'],
    [classTotal(tiers, ['TNO']), 'beyond Neptune'],
  ] as const;
  const parts = groups
    .filter(([count]) => count > 0)
    .map(([count, what]) => `${count.toLocaleString('en-US')} ${what}`);
  const listed =
    parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
  const loaded = tiers.reduce((sum, tier) => sum + tier.tier.count, 0);
  const all = tiers.length >= beltTiers(info).length;
  const faintestH = tiers.at(-1)?.tier.faintestH ?? null;
  const reach = faintestH === null ? '' : ` brighter than absolute magnitude ${faintestH} — down to ${aboutKm(faintestH)} across at an albedo of ${PROSE_ALBEDO}`;
  const which = all
    ? `every one of the ${loaded.toLocaleString('en-US')} asteroids JPL’s Small-Body Database knows${reach}${reach === '' ? ',' : ' —'}`
    : `the ${loaded.toLocaleString('en-US')} brightest of the ${info.count.toLocaleString('en-US')} asteroids JPL’s Small-Body Database knows, every one${reach} —`;
  const rest = all
    ? ''
    : ' The rest are a setting under Asteroids in the Layers panel, a magnitude at a time, because the whole catalogue is a download of its own.';
  return `The asteroid belt: ${which} each on its own orbit, at its own place on it${listed === '' ? '' : `: ${listed}`}.${rest} The graphics card places them, solving Kepler’s equation for every one of them on every frame, so the whole belt turns with the clock at any speed: the inner edge goes round in a little over three years, the outer in six. The ${spelled(info.excluded.length)} drawn as bodies of their own are left out of it, so none is drawn twice.`;
}

/** What the belt's positions are worth, and why its dots are the size they are. */
/**
 * The satellites, as a paragraph: what places them, how well, and for how long. The
 * measured figures from the data when it is here; the rule alone before.
 */
export function satelliteAccuracySentence(info: SatelliteInfo | null): string {
  const leo = info?.accuracy.find((row) => row.regime === 'leo') ?? null;
  const geo = info?.accuracy.find((row) => row.regime === 'geo') ?? null;
  const at = (row: typeof leo, days: number): string | null => {
    if (row === null) {
      return null;
    }
    const k = row.days.findIndex((day) => day >= days);
    return k < 0 ? null : `${Math.round(row.medianKm[k]!)} km (95%: ${Math.round(row.p95Km[k]!)} km)`;
  };
  const leoText = at(leo, BULK_WINDOW_DAYS);
  const geoText = at(geo, BULK_WINDOW_DAYS);
  const measured =
    leoText === null || geoText === null
      ? ''
      : ` Measured on each day’s own elements, the dots are off SGP4 by a median ${leoText} in low orbit at ${BULK_WINDOW_DAYS} days, and ${geoText} at the geostationary ring, where the Moon and Sun pull hardest.`;
  return (
    `Earth’s satellites are placed from the US Space Force’s element sets, which are not positions but the mean elements of one model, SGP4, fitted to radar and optical tracking. The named satellites, and a few hundred the simpler model cannot follow — Molniya and transfer orbits, Starlinks still raising their orbits — are run through SGP4 itself, which is how the elements are meant to be read: good to a kilometre or two near their epoch, drifting as drag does after it. The tens of thousands of others are dots placed by the graphics card from SGP4’s secular terms alone, J3 included and the short-period wobbles left out.` +
    measured +
    ` SGP4 answers in its own frame, true equator and mean equinox of the date, turned here into the ecliptic of J2000 through the 1976 precession and the 1980 nutation: against JPL Horizons’ International Space Station, built from the same element set, the station lands within 10 metres. The elements are only good for days: a named satellite is drawn within ${NAMED_WINDOW_DAYS} days of its own — the ISS’s, run back a week, is already 38 km off — and the dots within ${BULK_WINDOW_DAYS} days of the day the data was built; outside that they are not drawn at all. Every dot is a convention, a pixel or so whatever the distance: the ISS is 109 m across, a fifth of a pixel from a thousand kilometres. Satellites are off until the Satellites layer is switched on, and cost nothing before.`
  );
}

/** How many comets of `info` are on each kind of conic, from their class counts. */
function openCount(info: CometInfo): { readonly parabolic: number; readonly hyperbolic: number } {
  return { parabolic: info.classCounts.PAR ?? 0, hyperbolic: info.classCounts.HYP ?? 0 };
}

/** The comets: what they are drawn from, what the dots say, and what is approximate. */
export function cometAccuracySentence(info: CometInfo): string {
  const { parabolic, hyperbolic } = openCount(info);
  return (
    `The ${info.count.toLocaleString('en-US')} comets SBDB lists, each on its own two-body conic about the Sun — ${parabolic.toLocaleString('en-US')} on parabolas and ${hyperbolic.toLocaleString('en-US')} on hyperbolas among them, interstellar 3I/ATLAS at e = 6.14 — worked out in double precision with universal variables, so an orbit at e = 0.999 and one at 1.001 are handled by the same equation rather than two that each break near the other. Propagated, not looked up, like the belt: a comet that has passed a planet, or one whose orbit SBDB fitted decades ago, is off its real path by more than any rounding here, and outgassing pushes every active comet off a pure conic too. Each dot is a convention: a pixel or two, brighter and larger as the comet’s own magnitude rises toward the Sun — SBDB’s M1 + K1·log₁₀ r, seen from one AU — and where SBDB gives no magnitude parameters, as for half of them, a typical comet’s at the same distance stands in, so none goes missing from the map. Comets are off until the Comets layer is switched on, and cost nothing before.` +
    // The famous ones are not in the cloud but bodies of their own (famousComets.ts in tools/).
    ((info.excluded?.length ?? 0) > 0
      ? ` The ${info.excluded!.length} comets people look for by name — Halley, Encke, 67P, Hale-Bopp, the two interstellar ones and more — are not among the dots: they are bodies of their own, placed from JPL’s numerical integration of each orbit, planets’ pull and outgassing included, to within a kilometre of JPL’s numbers across the whole window.`
      : '')
  );
}

export function beltAccuracySentence(info: BeltInfo): string {
  const { minJd, maxJd } = info.elementEpochs;
  const epoch =
    jdToDate(minJd) === jdToDate(maxJd)
      ? `their epoch, ${jdToDate(minJd)}`
      : `their epochs, ${jdToDate(minJd)} to ${jdToDate(maxJd)}`;
  return `The belt’s asteroids are propagated, not looked up: each moves on the two-body ellipse of its osculating elements, with nothing to pull it off — no Jupiter, no Mars. Measured against JPL’s own integrations for Ceres, Vesta and Eros, that drifts 40,000 to 190,000 km a year either side of ${epoch}, and up to about a degree of its orbit ten years out; an asteroid that passes close to a planet drifts most, as Apophis would, which is one reason it and the other named bodies are drawn from JPL’s integrations instead. Nor is the cloud what anyone would see: it is a map of where the asteroids are. With your own eyes, from anywhere in this view, you would see almost none of them — only Vesta, at its best, is ever a naked-eye point from Earth. The dots are a convention, as the planets’ markers are: a pixel or so whatever the distance, a little larger and stronger for the brighter ones, and past the 15th magnitude a single pixel each, every magnitude given half the light of the one before however many asteroids are in it — an exposure, not their real light, which barely falls magnitude to magnitude because their numbers grow almost as fast as each gets fainter, and drawn that way a million and a half of them are a sheet — because a few-kilometre asteroid is under a hundredth of a pixel even from a million kilometres away. Its place is real; its size on screen is not. From afar the same convention goes one step further: as a population of them crowds onto fewer pixels — the main belt from thirty AU puts twenty of its million and a half on each — its dots are drawn fainter, by just enough to keep the pixels they cover from filling in, though the largest never fade below a point; and once its whole ring has shrunk to a smudge a dozen pixels in radius it fades out, as a moon does onto its planet, so the inner belt never paints over the Sun. A legibility convention, and nothing about the asteroids.`;
}

/** The spacecraft in this data. Counted, because a craft with no data in the window is left out of it. */
export function craftCount(store: EphemerisStore): number {
  return store.bodies.filter((body) => body.kind === 'spacecraft').length;
}

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** A count in words, as prose spells one; digits from a hundred on. */
export function spelled(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 100) {
    return n.toLocaleString('en-US');
  }
  if (n < 20) {
    return ONES[n]!;
  }
  const tens = TENS[Math.floor(n / 10)]!;
  return n % 10 === 0 ? tens : `${tens}-${ONES[n % 10]!}`;
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A jump this size or larger is named in the About text; smaller ones are counted. */
export const NOTABLE_JUMP_KM = 1000;

/**
 * The jumps in this data's spacecraft paths, as a sentence.
 *
 * Read from the manifest rather than written down, because JPL revises its trajectories
 * and the jumps move with them: between two runs a week apart Psyche's went from 239,513
 * km on 1 December 2026 to 1,622,330 km on 1 February 2027, and Europa Clipper's 954 km
 * handover was replaced by three others. A sentence typed into the source would have
 * been wrong by the next deploy.
 */
export function seamSentence(store: EphemerisStore): string {
  const notable = Object.entries(store.manifest.paths)
    .flatMap(([id, info]) =>
      info.seams.map((seam) => ({ name: store.body(id).name, ...seam })),
    )
    .filter((seam) => seam.jumpKm >= NOTABLE_JUMP_KM)
    .sort((a, b) => b.jumpKm - a.jumpKm);
  const largest = notable[0];
  if (largest === undefined) {
    return `In this data none jumps by ${NOTABLE_JUMP_KM.toLocaleString('en-US')} km or more.`;
  }
  const date = new Date((largest.startJd - 2440587.5) * 86_400_000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const size = `${Math.round(largest.jumpKm).toLocaleString('en-US')} km`;
  return notable.length === 1
    ? `In this data one jump is over ${NOTABLE_JUMP_KM.toLocaleString('en-US')} km: ${largest.name}’s, ${size} on ${date}.`
    : `In this data ${notable.length} are over ${NOTABLE_JUMP_KM.toLocaleString('en-US')} km, the largest ${largest.name}’s: ${size} on ${date}.`;
}

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
