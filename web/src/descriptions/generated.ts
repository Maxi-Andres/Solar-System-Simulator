import { NAMED_SATELLITES } from '@sss/tools/satellites/named';
import type { BodyDefinition, CraftShape } from '@sss/tools/types';

import { namedSatelliteBodyId } from '../core/satelliteBodies.ts';
import { NAMED_WINDOW_DAYS } from '../core/satellites.ts';
import { ESA_MODEL_CREDIT, MODEL_REQUEST_PX } from '../scene/craftModels.ts';
import { facingRule } from '../ui/facing.ts';
import type { DescriptionPoint } from './types.ts';

/**
 * The part of "how it is drawn here" that is read off the body's own data, so it can never
 * drift from what the app actually does: where its positions come from, the size and shape it
 * is drawn at, how it turns, and whose map covers it. A description's hand-written points add
 * what the data cannot say (an exposure, a colour convention).
 */

/** Who made each surface map, as public/textures/CREDITS.md lists it. */
export const TEXTURE_CREDITS: Readonly<Record<string, string>> = {
  'sun.jpg': 'Solar System Scope (CC BY 4.0)',
  'mercury.jpg': 'Solar System Scope (CC BY 4.0)',
  'venus.jpg': 'Solar System Scope (CC BY 4.0)',
  'earth.jpg': 'Solar System Scope (CC BY 4.0)',
  'mars.jpg': 'Solar System Scope (CC BY 4.0)',
  'jupiter.jpg': 'Solar System Scope (CC BY 4.0)',
  'saturn.jpg': 'Solar System Scope (CC BY 4.0)',
  'uranus.jpg': 'Solar System Scope (CC BY 4.0)',
  'neptune.jpg': 'Solar System Scope (CC BY 4.0)',
  'moon.jpg': 'NASA’s Scientific Visualization Studio, from LRO’s wide-angle camera (public domain)',
  'io.jpg': 'USGS Astrogeology, Galileo colour merged onto the Voyager–Galileo global mosaic (public domain)',
  'europa.jpg': 'USGS Astrogeology, the Voyager–Galileo global mosaic (public domain)',
  'ganymede.jpg': 'USGS Astrogeology, the Voyager–Galileo global mosaic (public domain)',
  'callisto.jpg': 'USGS Astrogeology, the Voyager–Galileo global mosaic (public domain)',
  'titan.jpg': 'USGS Astrogeology, Cassini’s 938 nm global mosaic, PIA19658 (public domain)',
  'enceladus.jpg': 'USGS Astrogeology, Cassini’s global mosaic, high-pass filtered (public domain)',
  'triton.jpg': 'USGS Astrogeology, Voyager 2’s colour global mosaic with its gaps filled (public domain)',
  'pluto.jpg': 'NASA/JHUAPL/SwRI, New Horizons’ global colour mosaic PIA11707, its unlit south filled (public domain)',
  'charon.jpg': 'USGS Astrogeology, New Horizons’ LORRI/MVIC global mosaic, its unlit south filled (public domain)',
  'ceres.jpg': 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA, Dawn’s clear-filter mosaic assembled by DLR, its gaps filled (public domain)',
};

const formatKm = (km: number): string => `${Math.round(km).toLocaleString('en-US')} km`;

export function drawnFromData(body: BodyDefinition, coverage: Coverage | null = null): DescriptionPoint[] {
  // A spacecraft or an Earth satellite is not a sphere with a map: see craftFromData.
  if (body.kind === 'spacecraft' || body.kind === 'satellite') return craftFromData(body, coverage);
  const points: DescriptionPoint[] = [];

  if (body.horizonsId !== '') {
    const about = body.center === '500@0' ? 'the Solar System’s barycentre' : 'the centre of the body it orbits';
    // A fast moon is sampled more often than once a day: said in hours or minutes, never as
    // a fraction of a day.
    const stepMinutes = Math.round(body.stepDays * 1440);
    const every =
      body.stepDays === 1
        ? 'day'
        : body.stepDays > 1
          ? `${body.stepDays} days`
          : stepMinutes === 60
            ? 'hour'
            : stepMinutes % 60 === 0
              ? `${stepMinutes / 60} hours`
              : `${stepMinutes} minutes`;
    // DE441 integrates the Moon with the Sun and planets; other moons come from their own
    // system's satellite ephemeris (JUP365, SAT441 and the rest), not from DE441.
    // Pluto is Horizons' 999: DE441 carries the Pluto system's barycentre, PLU060 Pluto about
    // it. A small body about the Sun is JPL's own orbit solution for it, integrated by Horizons
    // with the planets pulling on it; for Eris and Haumea that solution is the system's
    // barycentre (moons/minorPlanetMoons.ts).
    const smallBody = body.kind === 'dwarf-planet' || body.kind === 'asteroid';
    const ephemeris =
      body.id === 'moon'
        ? 'DE441, which carries the Moon along with the Sun and planets'
        : body.id === 'pluto'
          ? 'DE441 for the Pluto system’s barycentre, and PLU060, the Pluto system’s own ephemeris, for Pluto about it'
          : body.kind === 'moon'
            ? body.parent === 'pluto'
              ? 'PLU060, the Pluto system’s satellite ephemeris'
              : body.id === 'dimorphos'
                ? 'the DART team’s reconstruction of its orbit about Didymos after the impact, merged with Hera’s'
                : // A dwarf planet's or trans-Neptunian's moon (moons/minorPlanetMoons.ts): its vectors
                  // are about the primary's own centre, Horizons 9xxxxxxxx.
                  /^500@9\d{8}$/.test(body.center)
                  ? 'JPL’s satellite orbit solution for its system, fitted to the moons’ measured positions in telescope images'
                  : 'its planet’s satellite ephemeris'
            : smallBody
              ? 'JPL’s own orbit solution for it, integrated with the planets’ pull'
              : 'DE441 for the Sun and planets';
    // Sampled adaptively (the small moons and the small bodies about the Sun): refined until
    // the curve between samples stays within a set distance of JPL's, not at one step.
    const sampled =
      body.sampling === undefined
        ? `sampled every ${every}`
        : `sampled as finely as needed to stay within ${body.sampling.toleranceKm} km of JPL’s path`;
    points.push({
      title: 'Where it is',
      text:
        `From JPL’s ephemeris through Horizons (${ephemeris}), ${sampled} ` +
        `about ${about} and interpolated between samples, so at any moment it is ` +
        `where JPL puts it, to within the sampling’s tolerance.`,
      cite: ['de440'],
    });
  }

  const round = body.radiusEquatorialKm === body.radiusPolarKm && body.triaxialRadiiKm === null;
  const axes = body.triaxialRadiiKm?.map((km) => Math.round(km).toLocaleString('en-US')).join(', ');
  points.push({
    title: 'Its size and shape',
    // A body whose size is measured but whose shape cannot be placed (shapeDrawn false) is a
    // marker, not a sphere or an ellipsoid: see the scene's `sized`.
    text:
      body.shapeDrawn === false
        ? `A marker only, not a body: its size is measured${axes === undefined ? '' : ` — semi-axes ${axes} km`} — but its shape is not drawn, so the panel gives its dimensions instead.`
        : round
          ? `A sphere of radius ${formatKm(body.radiusEquatorialKm)}, its real size, never enlarged.`
          : axes !== undefined
            ? `An ellipsoid with three different semi-axes, ${axes} km.`
            : `An ellipsoid, ${formatKm(body.radiusEquatorialKm)} at the equator and ${formatKm(body.radiusPolarKm)} at the poles.`,
  });

  if (body.rotation !== null && body.rotationPeriodHours !== null) {
    // A negative rate is a body turning backwards about the IAU's north pole (Venus, Uranus):
    // said in words, never as a negative period; under two days, in hours.
    const days = 360 / Math.abs(body.rotation.rotationRateDegPerDay);
    const period = days < 2 ? `${(days * 24).toFixed(2)} hours` : `${days.toFixed(2)} days`;
    const backwards = body.rotation.rotationRateDegPerDay < 0 ? ', backwards against that pole' : '';
    points.push({
      title: 'How it turns',
      text:
        `Its pole points to right ascension ${body.rotation.poleRaDeg}°, declination ${body.rotation.poleDecDeg}°, ` +
        `and it turns once in ${period}${backwards}, as the IAU’s rotation model gives it.`,
      cite: ['archinal2018'],
    });
  }

  // The illustrative set is the one drawn (ACTIVE_TEXTURE_SET in scene/SolarSystem.tsx); the
  // photometric files of Earth, Mars and Neptune are in the repository but not shown.
  const map = body.textures?.illustrative?.file ?? body.textures?.photometric?.file ?? null;
  if (map !== null) {
    points.push({
      title: 'Its surface map',
      text: `${map}, by ${TEXTURE_CREDITS[map] ?? 'see public/textures/CREDITS.md'}.`,
    });
  }

  return points;
}

/** The span of time a body's path covers, TDB Julian days: EphemerisStore.coverage's. */
export interface Coverage {
  readonly startJd: number;
  readonly stopJd: number;
}

/**
 * Who made each craft model this app draws, as public/models/CREDITS.md lists it. Only the
 * craft with descriptions are here; any other falls back to that file.
 */
export const MODEL_CREDITS: Readonly<Record<string, string>> = {
  'voyager.glb': 'NASA Visualization Technology Applications and Development (VTAD), from NASA’s Voyager 3D model page — one model for both Voyagers, which were built alike',
  'new-horizons.glb': 'NASA VTAD, from NASA’s New Horizons 3D model page',
  'parker-solar-probe.glb': 'NASA VTAD, from NASA’s Parker Solar Probe 3D model page',
  'jwst.glb': 'NASA, from NASA 3D Resources (its “James Webb Space Telescope (B)”)',
  'iss.glb': 'NASA VTAD, from NASA’s Space Station 3D model page; it shows the station as it was about 2020',
  'hubble.glb': 'NASA VTAD, from NASA’s Hubble 3D model page',
};

/** A TDB Julian day as a calendar date in words, e.g. "5 September 1977". */
function dateInWords(jd: number): string {
  return new Date((jd - 2440587.5) * 86_400_000).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

const formatMetres = (m: number): string => `${Number(m.toFixed(2)).toLocaleString('en-US')} m`;

/**
 * "How it is drawn here" for a spacecraft or a named Earth satellite, read off its own data
 * and the code that draws it: where its path comes from and how it is sampled, what stands
 * in its place up close and whose that is, its size, the rule it is turned by, and its trail.
 * `coverage`, when the app passes it, gives the dates the data's path runs between.
 */
function craftFromData(body: BodyDefinition, coverage: Coverage | null): DescriptionPoint[] {
  const points: DescriptionPoint[] = [];
  const satellite = body.kind === 'satellite';

  if (satellite) {
    const entry = NAMED_SATELLITES.find((named) => namedSatelliteBodyId(named.id) === body.id);
    points.push({
      title: 'Where it is',
      text:
        `From the element set the US Space Force publishes for it${entry === undefined ? '' : ` (NORAD ${entry.noradId})`}, ` +
        'as CelesTrak serves it, propagated in the browser with SGP4 — the model the elements are fitted with — ' +
        'through satellite.js, and turned from SGP4’s TEME frame into the scene’s. The elements are refreshed with ' +
        'each day’s data, and the panel gives their age; elements carried further drift, so it is drawn only within ' +
        `${NAMED_WINDOW_DAYS} days either side of their epoch, where SGP4 stayed within about 40 km of JPL’s own track ` +
        'even for the ISS, the worst case among the named satellites.',
      cite: ['vallado2006'],
    });
    points.push({
      title: 'Its orbit line',
      text:
        'The ellipse drawn is the two-body orbit it is on at this instant, worked out again as it moves — not the path ' +
        'it will trace: Earth’s equatorial bulge turns a low orbit’s plane by several degrees a day, and the ellipse ' +
        'follows that as it happens.',
    });
  } else if (body.horizonsId !== '') {
    const about =
      body.parent === null
        ? 'the Solar System’s barycentre'
        : body.parent === 'earth'
          ? 'Earth’s centre, since it moves with Earth'
          : 'the centre of the body it moves with';
    const every = body.stepDays === 1 ? 'day' : `${body.stepDays} days`;
    const launchJd =
      body.mission === null || body.mission.launchUtc === ''
        ? null
        : Date.parse(body.mission.launchUtc) / 86_400_000 + 2440587.5;
    let span =
      ' The data cover a window around the day they were built, from launch at the earliest to wherever JPL’s latest trajectory ends.';
    if (coverage !== null) {
      span = ` In this build of the data JPL’s path runs from ${dateInWords(coverage.startJd)} to ${dateInWords(coverage.stopJd)}`;
      span +=
        launchJd !== null && launchJd < coverage.startJd - 1
          ? `; it was launched on ${dateInWords(launchJd)}, and what it did before the window is not in the data, nor drawn.`
          : '.';
    }
    const ended =
      typeof body.mission?.endUtc === 'string'
        ? ` Its path is cut on ${dateInWords(Date.parse(body.mission.endUtc) / 86_400_000 + 2440587.5)}, when it ended.`
        : '';
    points.push({
      title: 'Where it is',
      text:
        `From JPL Horizons, spacecraft ${body.horizonsId}: the trajectory its navigators reconstructed and, while it flies, ` +
        `their latest prediction, about ${about}. Sampled at first every ${every}, and refined down to a minute ` +
        'wherever interpolating between samples would stray from JPL’s path by more than ten millionths of the ' +
        `distance to the nearest body, and never by more than a kilometre close to one.${span}${ended}`,
    });
  }

  const shape: CraftShape | null = body.mission?.shape ?? null;
  if (shape === null) {
    points.push({
      title: 'What stands in its place',
      text: 'A marker, at every distance: no dimensions of it have been published, so nothing is drawn its size.',
    });
  } else if (shape.model !== null) {
    const credit =
      shape.modelOwner === 'ESA'
        ? `ESA, by its written permission (${ESA_MODEL_CREDIT})`
        : (MODEL_CREDITS[shape.model] ?? 'NASA; see public/models/CREDITS.md');
    const scale =
      shape.metresPerUnit === 1
        ? 'authored in metres and drawn at that size'
        : `scaled at ${shape.metresPerUnit} m to each of its units, from a published dimension`;
    points.push({
      title: 'What stands in its place',
      text:
        `A 3D model of it, ${shape.model}, by ${credit}: compressed, every triangle kept, ${scale}. ` +
        `It is fetched once the craft is ${MODEL_REQUEST_PX * 2} pixels across on the screen; farther off it is a marker.`,
    });
  } else if (shape.boxM !== null) {
    const [x, y, z] = shape.boxM;
    points.push({
      title: 'What stands in its place',
      text:
        `A box marked NO MODEL, ${formatMetres(x)} × ${formatMetres(y)} × ${formatMetres(z)}, its published dimensions: ` +
        'no model of it may be used here.',
    });
  }

  points.push({
    title: 'Its size',
    text:
      body.radiusPublished === false
        ? 'No size of it is published: the camera frames it as if it were a metre or so across, and nothing is drawn that size.'
        : `${formatMetres(body.radiusEquatorialKm * 2000)} across at its widest, deployed: the panel’s Span, and what the camera frames it by.`,
  });

  if (shape !== null) {
    points.push({
      title: 'Which way it faces',
      text:
        `${facingRule(shape)}: a rule for how it flies, not its measured attitude, which no data here carry.` +
        (shape.facingNote === undefined ? '' : ` ${shape.facingNote}`),
    });
  }

  if (!satellite) {
    const around = body.parent === null ? 'the Sun' : body.parent === 'earth' ? 'Earth' : 'what it orbits';
    points.push({
      title: 'Its trail',
      text:
        'In the Trails layer, on by default: the way it came, drawn from the same JPL samples and white, as NASA Eyes ' +
        `draws trails. On a closed orbit about ${around} it reaches one turn of that orbit back, fading with age; on ` +
        'none — leaving for good, or on a path no single body’s orbit describes, as a halo orbit about a Lagrange point ' +
        'is — it is all of the path the data hold. Where JPL’s trajectory files meet and disagree, ' +
        'the trail has a gap: nothing flew across it.',
    });
  }

  return points;
}
