import { SMALL_BODY_TOLERANCE_KM } from './config.ts';
import type { BodyDefinition } from './types.ts';

/**
 * The comets people look for, as bodies of their own with JPL's integrated trajectories:
 * the famous ones and the ones spacecraft have visited, whose orbits pass through the
 * app's twenty-year window.
 *
 * **Why not the comet cloud.** The 4,000 comets of step B2c are placed on two-body conics
 * from SBDB's osculating elements, and for a periodic comet those elements are at the
 * epoch of its last well-observed apparition. Measured against Horizons on 2026-10-19,
 * propagated to that day: 67P was 47.7 million km off (elements of 2015, Jupiter between),
 * 1P/Halley 27.6 million (1968), 2I/Borisov 2.8 million, 3I/ATLAS 1.3 million, 12P 453,000.
 * Horizons starts from the same solutions and integrates them -- every planet's pull, and
 * the outgassing that pushes a comet, as the non-gravitational parameters A1, A2, A3 JPL
 * fitted with each orbit. These are therefore drawn the way the named asteroids are
 * (smallBodies.ts): adaptive vectors, to a kilometre of Horizons, over the whole window,
 * chunked and fetched when wanted. They are left out of the cloud (`cometDesignations`),
 * so none is drawn twice.
 *
 * **What it costs, and what it buys.** Fetched on 2026-10-20 with fetchAdaptiveBody, all
 * eighteen covered the whole window: 17,572 samples in about 200 requests -- Encke the most,
 * 2,823 samples for its six perihelia; Halley, Hale-Bopp and Swift-Tuttle, slow and far out,
 * under 70 each. Against Horizons at 300 instants each, a third of them within twenty days
 * of the comet's closest pass to the Sun in the window, the table as published
 * interpolates to within 0.51 km for Halley, Encke, 67P, 2I, 3I and Tsuchinshan-ATLAS
 * (the README has the table).
 *
 * **Which solution.** Horizons keeps one orbit per apparition for a periodic comet, since
 * every perihelion passage changes it. `CAP` asks for the last apparition solution before
 * the date of the run (Horizons manual, "Small-body selection"); its integration then
 * covers the whole window, past and future, from that one fit. One solution and not one per
 * apparition, because switching between them would put a jump in the path -- by the very
 * difference between two fits of the same comet. Each solution's data arc is given below;
 * outside it the path is JPL's prediction, as every future position is.
 *
 * **Which comets**, each for a reason the app can show, all checked against Horizons on
 * 2026-10-20 to resolve to exactly one record with `DES=...;CAP;`:
 *
 *   - 1P/Halley: the comet; Giotto and the Vegas flew through its coma in 1986. Aphelion
 *     in 2023 inside the window.
 *   - 2P/Encke: round the Sun every 3.3 years, the first periodic comet after Halley's
 *     -- six perihelia in the window.
 *   - 9P/Tempel 1 (Deep Impact, 2005; Stardust-NExT, 2011), 19P/Borrelly (Deep Space 1,
 *     2001), 67P/Churyumov-Gerasimenko (Rosetta and Philae, 2014-2016), 81P/Wild 2
 *     (Stardust, 2004, which brought its dust back), 103P/Hartley 2 (EPOXI, 2010),
 *     21P/Giacobini-Zinner (ICE, 1985, the first comet a spacecraft met), 46P/Wirtanen
 *     (Rosetta's first target, and 0.08 AU from Earth in December 2018).
 *   - 12P/Pons-Brooks, the bright comet of spring 2024.
 *   - 109P/Swift-Tuttle and 55P/Tempel-Tuttle: the parents of the Perseids and the
 *     Leonids. 55P is at perihelion again in 2031.
 *   - C/1995 O1 (Hale-Bopp), C/2020 F3 (NEOWISE), C/2022 E3 (ZTF), C/2023 A3
 *     (Tsuchinshan-ATLAS): the great comets of 1997, 2020, 2023 and 2024. Hale-Bopp
 *     perihelion is outside the window and it is 50 AU out, but it is the comet people
 *     name, and a comet asked for by name should be found.
 *   - 2I/Borisov and 3I/ATLAS: the two interstellar comets, on hyperbolas.
 *
 * Left out: 73P/Schwassmann-Wachmann 3, broken into dozens of fragments, each its own
 * record (it stays in the cloud, fragment by fragment); and 1I/'Oumuamua, which SBDB
 * lists as an asteroid, not a comet -- and on a hyperbola, which the belt drops -- so it
 * is not drawn at all yet: a body for the asteroids' side, not this list.
 *
 * **Shape.** None drawn: a nucleus is irregular, and only spacecraft have seen any. A
 * marker (`shapeDrawn: false`), with the measured size where one is published -- from
 * SBDB's physical parameters, read 2026-10-20, which name each source -- and none where
 * it is not (`radiusPublished: false`, a nominal kilometre that only frames the camera).
 * GM where measured, which is only 67P; zero elsewhere, meaning unmeasured. No rotation
 * period: a comet's spin changes at every perihelion -- 67P's went from 12.76 h to 12.40 h
 * across 2015 (Mottola et al., A&A 569, L2, 2014, and SBDB's note) -- so no one value
 * holds over twenty years. Tempel 1 is the one given, 40.7 h, measured by Deep Impact.
 *
 * **Orbit lines.** The osculating ellipse about the Sun, as for the named asteroids,
 * where the orbit is closed. 2I, 3I, ZTF and Tsuchinshan-ATLAS are on hyperbolas (e =
 * 3.36, 6.14, 1.0003, 1.0001 in their JPL fits); the app draws no line for an open orbit,
 * and says so.
 */

/** What differs from one comet to the next. */
interface CometSpec {
  readonly id: string;
  /** SBDB's full name, so the comet is found by what SBDB and the cloud call it. */
  readonly name: string;
  /**
   * The IAU designation with its prefix -- '1P', 'C/1995 O1' -- which is what Horizons is
   * asked for (`DES=`), and, without a `C/`, SBDB's primary designation, which the cloud
   * leaves out (see cometDesignations). The interstellar comets go by their C/ names here,
   * 'C/2019 Q4' for 2I: Horizons answers both with the same record, and SBDB knows only
   * the C/ one.
   */
  readonly designation: string;
  /** Where the adaptive sampling starts; it refines from there. */
  readonly stepDays: number;
  /** Mean radius, km, or three radii long axis first; null where none is published. */
  readonly radiiKm: number | readonly [number, number, number] | null;
  readonly gmKm3S2: number;
  readonly rotationPeriodHours: number | null;
}

/** The comet dots' pale blue (see Comets.tsx in web/), as a body. */
const COMET_COLOR = '#9ecbe6';

/**
 * The Horizons COMMAND for a comet: its designation, and the last apparition solution
 * before today -- 'DES=1P;CAP;', 'DES=C/1995 O1;CAP;'. `DES=` rather than a bare
 * designation, which Horizons would also search names with; `CAP` because without it a
 * periodic comet matches one record per apparition and Horizons answers with the list.
 */
export function cometCommand(designation: string): string {
  return `DES=${designation};CAP;`;
}

/** A comet COMMAND as cometCommand writes it: the prefix, then SBDB's designation. */
const COMET_COMMAND = /^DES=(?:[CPDXI]\/)?([^;/]+);CAP;$/;

/**
 * The SBDB designations of every comet in `catalog` -- '1P', '1995 O1' -- which the comet
 * cloud therefore leaves out, as catalogDesignations does the asteroids for the belt.
 * Given the catalog a run actually publishes, so a comet Horizons failed on stays in the
 * cloud rather than vanishing. A comet whose designation cannot be read fails here,
 * rather than being drawn twice.
 */
export function cometDesignations(catalog: readonly BodyDefinition[]): string[] {
  const designations: string[] = [];
  for (const body of catalog.filter((candidate) => candidate.kind === 'comet')) {
    const match = COMET_COMMAND.exec(body.horizonsId);
    if (match === null) {
      throw new Error(
        `${body.id} (Horizons '${body.horizonsId}') has no SBDB designation to leave out of the comets.`,
      );
    }
    designations.push(match[1]!);
  }
  return [...new Set(designations)].sort();
}

/** The nominal radius a comet with no published size is framed by, km. Not a measurement. */
export const UNMEASURED_NUCLEUS_FRAMING_KM = 1;

function comet(spec: CometSpec): BodyDefinition {
  const radii =
    spec.radiiKm === null
      ? null
      : typeof spec.radiiKm === 'number'
        ? ([spec.radiiKm, spec.radiiKm, spec.radiiKm] as const)
        : spec.radiiKm;
  const [a, b, c] = radii ?? [
    UNMEASURED_NUCLEUS_FRAMING_KM,
    UNMEASURED_NUCLEUS_FRAMING_KM,
    UNMEASURED_NUCLEUS_FRAMING_KM,
  ];
  return {
    id: spec.id,
    name: spec.name,
    horizonsId: cometCommand(spec.designation),
    stepDays: spec.stepDays,
    vectorWindow: 'full',
    center: '500@0',
    elementsCenter: '500@10',
    parent: null,
    kind: 'comet',
    radiusEquatorialKm: a,
    radiusPolarKm: c,
    triaxialRadiiKm: a === b ? null : [a, b, c],
    gmKm3S2: spec.gmKm3S2,
    gmBodyOnlyKm3S2: spec.gmKm3S2,
    rotationPeriodHours: spec.rotationPeriodHours,
    axialTiltDeg: null,
    rotation: null,
    color: COMET_COLOR,
    // Every comet's elements are fetched and published, open orbits too: whether an orbit
    // is closed is the data's to say, not the catalog's -- a comet near e = 1 can be
    // either at the instant of a run. The app draws no line for one that is not.
    drawOrbit: true,
    textures: null,
    rings: null,
    mission: null,
    sampling: { toleranceKm: SMALL_BODY_TOLERANCE_KM, windowMonths: null },
    ...(radii === null ? { radiusPublished: false } : {}),
    shapeDrawn: false,
  };
}

/**
 * The comets: the periodic ones by number, the long-period ones by date, then the two
 * interstellar ones.
 *
 * Radii from SBDB's physical parameters unless said otherwise; "Lamy" is Lamy, Toth,
 * Fernandez & Weaver, "The sizes, shapes, albedos, and colors of cometary nuclei", in
 * Comets II, pp. 223-264 (2004), whose effective diameters SBDB carries for most of them.
 * The data arcs are those of the solutions Horizons answered with on 2026-10-20.
 */
export const FAMOUS_COMETS: readonly BodyDefinition[] = [
  // 1P/Halley. JPL#75, data arc 1835-1994, epoch 1968, with non-gravitational terms.
  // Giotto's images give 14.9 x 8.2 km (Keller et al., A&A 187, 807, 1987, via SBDB); the
  // Vegas' 14 x 7.5 x 7.5 (Sagdeev et al., Nature 321, 262, 1986): the two short axes
  // equal, so the third is taken as the second.
  comet({
    id: '1p-halley',
    name: '1P/Halley',
    designation: '1P',
    stepDays: 8,
    radiiKm: [7.45, 4.1, 4.1],
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 2P/Encke. JPL#K273/23, arc 2018-2026, non-grav. 4.8 km (Lamy).
  comet({
    id: '2p-encke',
    name: '2P/Encke',
    designation: '2P',
    stepDays: 2,
    radiiKm: 2.4,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 9P/Tempel 1. JPL#K284/2, arc 2008-2025, non-grav. 6.0 +- 0.2 km mean, 7.6 x 4.9 km
  // in outline, and the 40.7 h period: A'Hearn et al., Science 310, 258 (2005), via SBDB.
  comet({
    id: '9p-tempel-1',
    name: '9P/Tempel 1',
    designation: '9P',
    stepDays: 4,
    radiiKm: 3.0,
    gmKm3S2: 0,
    rotationPeriodHours: 40.7,
  }),
  // 12P/Pons-Brooks. JPL#K242/85, arc 1953-2025: a purely gravitational fit, the one
  // here without non-gravitational terms. No published nucleus size.
  comet({
    id: '12p-pons-brooks',
    name: '12P/Pons-Brooks',
    designation: '12P',
    stepDays: 4,
    radiiKm: null,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 19P/Borrelly. JPL#K283/1, arc 2014-2025, non-grav. 4.8 km (Lamy, via SBDB).
  comet({
    id: '19p-borrelly',
    name: '19P/Borrelly',
    designation: '19P',
    stepDays: 4,
    radiiKm: 2.4,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 21P/Giacobini-Zinner. JPL#K253/4, arc 2011-2024, non-grav. 2.0 km (Lamy, via SBDB).
  comet({
    id: '21p-giacobini-zinner',
    name: '21P/Giacobini-Zinner',
    designation: '21P',
    stepDays: 4,
    radiiKm: 1.0,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 46P/Wirtanen. JPL#K243/4, arc 2013-2023, non-grav. 1.2 km (Lamy, via SBDB).
  comet({
    id: '46p-wirtanen',
    name: '46P/Wirtanen',
    designation: '46P',
    stepDays: 4,
    radiiKm: 0.6,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 55P/Tempel-Tuttle. JPL#J985/69, arc 1865-1998, non-grav. 3.6 km (Lamy, via SBDB).
  comet({
    id: '55p-tempel-tuttle',
    name: '55P/Tempel-Tuttle',
    designation: '55P',
    stepDays: 8,
    radiiKm: 1.8,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 67P/Churyumov-Gerasimenko. JPL#K284/1, arc 2008-2025, non-grav. 3.4 +- 0.1 km
  // equivalent diameter: a contact binary, lobes 4.1 x 3.3 x 1.8 and 2.6 x 2.3 x 1.8 km
  // (Sierks et al., Science 347, aaa1044, 2015). GM 6.622e-7 km^3/s^2 from Rosetta's
  // radio tracking: Paetzold et al., Nature 530, 63 (2016). Both via SBDB.
  comet({
    id: '67p-churyumov-gerasimenko',
    name: '67P/Churyumov-Gerasimenko',
    designation: '67P',
    stepDays: 4,
    radiiKm: 1.7,
    gmKm3S2: 6.622e-7,
    rotationPeriodHours: null,
  }),
  // 81P/Wild 2. JPL#K222/37, arc 2014-2024, non-grav. 4.0 km (Lamy, via SBDB).
  comet({
    id: '81p-wild-2',
    name: '81P/Wild 2',
    designation: '81P',
    stepDays: 4,
    radiiKm: 2.0,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 103P/Hartley 2. JPL#K233/5, arc 2008-2025, non-grav. 1.6 km (Lamy, via SBDB).
  comet({
    id: '103p-hartley-2',
    name: '103P/Hartley 2',
    designation: '103P',
    stepDays: 4,
    radiiKm: 0.8,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 109P/Swift-Tuttle. JPL#32, arc 1737-1995, gravitational. 26 km (Lamy, via SBDB).
  comet({
    id: '109p-swift-tuttle',
    name: '109P/Swift-Tuttle',
    designation: '109P',
    stepDays: 32,
    radiiKm: 13,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // Hale-Bopp. JPL#226, arc 1993-2022, gravitational. 60 +- 20 km: Fernandez, Earth Moon
  // Planets 89, 3 (2002), via SBDB.
  comet({
    id: 'c-1995-o1-hale-bopp',
    name: 'C/1995 O1 (Hale-Bopp)',
    designation: 'C/1995 O1',
    stepDays: 32,
    radiiKm: 30,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // NEOWISE. JPL#31, arc 2020-2021, gravitational. No published size.
  comet({
    id: 'c-2020-f3-neowise',
    name: 'C/2020 F3 (NEOWISE)',
    designation: 'C/2020 F3',
    stepDays: 4,
    radiiKm: null,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // ZTF. JPL#82, arc 2021-2024, non-grav. No published size.
  comet({
    id: 'c-2022-e3-ztf',
    name: 'C/2022 E3 (ZTF)',
    designation: 'C/2022 E3',
    stepDays: 4,
    radiiKm: null,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // Tsuchinshan-ATLAS. JPL#113, arc 2022-2026, non-grav. No published size.
  comet({
    id: 'c-2023-a3-tsuchinshan-atlas',
    name: 'C/2023 A3 (Tsuchinshan-ATLAS)',
    designation: 'C/2023 A3',
    stepDays: 2,
    radiiKm: null,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 2I/Borisov, C/2019 Q4. JPL#54, arc 2019-2020, non-grav. Only bounds on its size:
  // 0.2 to 0.5 km in radius (Jewitt et al., ApJL 888, L23, 2020) -- none given here.
  // Named with both designations, so a search for either finds it.
  comet({
    id: '2i-borisov',
    name: '2I/Borisov (C/2019 Q4)',
    designation: 'C/2019 Q4',
    stepDays: 4,
    radiiKm: null,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
  // 3I/ATLAS, C/2025 N1. JPL#54, arc 2025-2026, non-grav. No measured size.
  comet({
    id: '3i-atlas',
    name: '3I/ATLAS (C/2025 N1)',
    designation: 'C/2025 N1',
    stepDays: 4,
    radiiKm: null,
    gmKm3S2: 0,
    rotationPeriodHours: null,
  }),
];
